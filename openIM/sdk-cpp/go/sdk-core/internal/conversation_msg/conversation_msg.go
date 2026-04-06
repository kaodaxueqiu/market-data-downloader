package conversation_msg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"runtime/debug"
	"sort"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/internal/encryption"
	"github.com/openimsdk/openim-sdk-core/v3/internal/group"
	"github.com/openimsdk/openim-sdk-core/v3/internal/interaction"
	"github.com/openimsdk/openim-sdk-core/v3/internal/relation"
	"github.com/openimsdk/openim-sdk-core/v3/internal/signaling"
	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/internal/user"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/cache"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/hotcold"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	"github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

const (
	conversationSyncLimit          int64 = math.MaxInt64
	searchMessageGoroutineLimit    int   = 10
	ConversationHotColdMaxHotCount int   = 300
)

var SearchContentType = []int{constant.Text, constant.AtText, constant.File}

type Conversation struct {
	*interaction.LongConnMgr
	db                           db_interface.DataBase
	ConversationListener         func() open_im_sdk_callback.OnConversationListener
	msgListener                  func() open_im_sdk_callback.OnAdvancedMsgListener
	msgKvListener                func() open_im_sdk_callback.OnMessageKvInfoListener
	batchMsgListener             func() open_im_sdk_callback.OnBatchMsgListener
	businessListener             func() open_im_sdk_callback.OnCustomBusinessListener
	conversationGroupListenerVar func() open_im_sdk_callback.OnConversationGroupListener
	conversationEventQueue       *common.EventQueue
	msgSyncerCh                  chan common.Cmd2Value
	groupCh                      chan common.Cmd2Value
	userCh                       chan common.Cmd2Value
	relationCh                   chan common.Cmd2Value
	loginUserID                  string
	platform                     int32
	DataDir                      string
	relation                     *relation.Relation
	group                        *group.Group
	user                         *user.User
	file                         *file.File
	seqCache                     *cache.ConversationSeqCache
	messagePullForwardEndSeqMap  *cache.ConversationSeqContextCache
	messagePullReverseEndSeqMap  *cache.ConversationSeqContextCache
	IsExternalExtensions         bool
	msgOffset                    int
	progress                     int
	conversationSyncMutex        sync.Mutex
	conversationGroupSyncMutex   sync.Mutex
	filterGroupCreateMutex       sync.Mutex
	seqs                         map[string]*msg.Seqs
	signaling                    *signaling.LiveSignaling
	isReadOffConv                map[string]struct{}

	startTime time.Time

	typing *typing
	//messagePullMinSeqCache Minimum seq for caching during message retrieval to
	//avoid multiple fetches of read group chat messages.
	messagePullMinSeqCache map[string]int64
	//messagePullMinSeqCacheLock Lock for messagePullMinSeqCache
	w                sync.Mutex
	messageEncryptor encryption.MessageEncryptor

	streamHandler *streamHandler

	pinnedMsgHandler           *pinnedMsgHandler
	conversationHotColdManager *ConversationHotSyncManager
	conversationChangedBatcher *ConversationChangedBatcher

	sender                            *messageSender
	senderOnce                        sync.Once
	unreadConversationGroupSubscribed bool
	unreadConversationGroupLock       sync.Mutex
	conversationGroupCacheLock        sync.RWMutex
	conversationGroupCache            conversationGroupCacheState
	filterConversationGroupNames      []string
	conversationGroupTimingObserverMu sync.RWMutex
	conversationGroupTimingObserver   func(ConversationGroupInjectedTiming)
}

type conversationGroupChangeCacheItem struct {
	UnreadCount      int32
	RecvMsgOpt       int32
	HasLatestMessage bool
	IsMarked         bool
	IsPinned         bool
	GroupAtType      int32
	IsGroupChat      bool
}

type ConversationGroupInjectedTiming struct {
	ConversationIDs []string
	StartedAt       time.Time
	FinishedAt      time.Time
	Duration        time.Duration
	UsedFallback    bool
	BuildPlan       time.Duration
	LoadGroups      time.Duration
	GroupChangedCB  time.Duration
	MemberChangedCB time.Duration
	Fallback        time.Duration
	ChangedGroups   int
	MemberAdded     int
	MemberDeleted   int
}

func (c *Conversation) LoginUserID() string {
	return c.loginUserID
}

func (c *Conversation) ConversationEventQueue() *common.EventQueue {
	return c.conversationEventQueue
}

func (c *Conversation) BatchAddFaceURLAndName(ctx context.Context, val []*model_struct.LocalConversation) error {
	return c.batchAddFaceURLAndName(ctx, val...)
}

func (c *Conversation) HotKeys() []string {
	return c.conversationHotColdManager.HotKeys()
}

func (c *Conversation) ClearHotKeys(ctx context.Context) error {
	return c.conversationHotColdManager.Clear(ctx)
}

func (c *Conversation) SetDataBase(db db_interface.DataBase) {
	c.db = db
	if err := c.rebuildConversationGroupChangeCache(context.Background()); err != nil {
		log.ZWarn(context.Background(), "rebuildConversationGroupChangeCache failed", err)
	}
}

func (c *Conversation) SetLoginUserID(loginUserID string) {
	c.loginUserID = loginUserID
}

func (c *Conversation) SetPlatform(platform int32) {
	c.platform = platform
}

func (c *Conversation) SetDataDir(DataDir string) {
	c.DataDir = DataDir
}

func (c *Conversation) SetMsgListener(msgListener func() open_im_sdk_callback.OnAdvancedMsgListener) {
	c.msgListener = msgListener
}

func (c *Conversation) SetMsgKvListener(msgKvListener func() open_im_sdk_callback.OnMessageKvInfoListener) {
	c.msgKvListener = msgKvListener
}

func (c *Conversation) SetBatchMsgListener(batchMsgListener func() open_im_sdk_callback.OnBatchMsgListener) {
	c.batchMsgListener = batchMsgListener
}

func (c *Conversation) SetBusinessListener(businessListener func() open_im_sdk_callback.OnCustomBusinessListener) {
	c.businessListener = businessListener
}

func (c *Conversation) SetConversationGroupListener(conversationGroupListener func() open_im_sdk_callback.OnConversationGroupListener) {
	c.unreadConversationGroupSubscribed = true
	c.conversationGroupListenerVar = conversationGroupListener
}

func (c *Conversation) SetConversationGroupInjectedTimingObserver(observer func(ConversationGroupInjectedTiming)) {
	c.conversationGroupTimingObserverMu.Lock()
	defer c.conversationGroupTimingObserverMu.Unlock()
	c.conversationGroupTimingObserver = observer
}

func (c *Conversation) conversationGroupInjectedTimingObserver() func(ConversationGroupInjectedTiming) {
	c.conversationGroupTimingObserverMu.RLock()
	defer c.conversationGroupTimingObserverMu.RUnlock()
	return c.conversationGroupTimingObserver
}

func (c *Conversation) setPullMinSeq(conversationID string, seq int64) {
	c.w.Lock()
	defer c.w.Unlock()
	c.messagePullMinSeqCache[conversationID] = seq
}
func (c *Conversation) getPullMinSeq(conversationID string) int64 {
	c.w.Lock()
	defer c.w.Unlock()
	return c.messagePullMinSeqCache[conversationID]
}
func (c *Conversation) existPullMinSeq(conversationID string) bool {
	c.w.Lock()
	defer c.w.Unlock()
	_, ok := c.messagePullMinSeqCache[conversationID]
	return ok
}
func (c *Conversation) clearPullMinSeq(conversationID string) {
	c.w.Lock()
	defer c.w.Unlock()
	delete(c.messagePullMinSeqCache, conversationID)

}
func (c *Conversation) clearAllPullMinSeq() {
	c.w.Lock()
	defer c.w.Unlock()
	c.messagePullMinSeqCache = make(map[string]int64)
}

func NewConversation(
	longConnMgr *interaction.LongConnMgr,
	msgSyncerCh, groupCh, relationCh, userCh chan common.Cmd2Value, conversationEventQueue *common.EventQueue,
	relation *relation.Relation,
	group *group.Group, user *user.User,
	file *file.File,
	signaling *signaling.LiveSignaling) *Conversation {
	n := &Conversation{
		LongConnMgr:                 longConnMgr,
		conversationEventQueue:      conversationEventQueue,
		msgSyncerCh:                 msgSyncerCh,
		groupCh:                     groupCh,
		relationCh:                  relationCh,
		userCh:                      userCh,
		relation:                    relation,
		group:                       group,
		user:                        user,
		file:                        file,
		seqCache:                    cache.NewConversationSeqCache(),
		messagePullForwardEndSeqMap: cache.NewConversationSeqContextCache(),
		messagePullReverseEndSeqMap: cache.NewConversationSeqContextCache(),
		msgOffset:                   0,
		progress:                    0,
		signaling:                   signaling,
		messagePullMinSeqCache:      make(map[string]int64),
		isReadOffConv:               make(map[string]struct{}),
	}
	n.typing = newTyping(n)
	n.messageEncryptor = encryption.NewConversationEncryptor(n.LoginUserID, longConnMgr)
	n.streamHandler = newStreamHandler(n)
	n.pinnedMsgHandler = newPinnedMsgHandler(n)
	n.conversationChangedBatcher = NewConversationChangedBatcher(n.onConversationChanged)
	n.conversationHotColdManager = NewConversationHotSyncManager(hotcold.New(n.db, hotcold.NamespaceConversation,
		ConversationHotColdMaxHotCount), n.ColdConversationSync)
	n.unreadConversationGroupSubscribed = true
	n.filterConversationGroupNames = n.avaliableFilterNames()
	return n
}

func (c *Conversation) Load(ctx context.Context) error {
	return c.conversationHotColdManager.Load(ctx)
}

func (c *Conversation) getSender() *messageSender {
	c.senderOnce.Do(func() {
		c.sender = newMessageSender(c)
	})
	return c.sender
}

type onlineMsgKey struct {
	ClientMsgID string
	ServerMsgID string
}

func (c *Conversation) doMsgNew(c2v common.Cmd2Value) {
	allMsg := c2v.Value.(sdk_struct.CmdNewMsgComeToConversation).Msgs
	ctx := c2v.Ctx
	var isTriggerUnReadCount bool
	insertMsg := make(map[string][]*model_struct.LocalChatLog, 10)
	updateMsg := make(map[string][]*model_struct.LocalChatLog, 10)
	var exceptionMsg []*model_struct.LocalChatLog
	var newMessages sdk_struct.NewMsgList

	var isUnreadCount, isConversationUpdate, isHistory, isNotPrivate, isSenderConversationUpdate bool

	conversationChangedSet := make(map[string]*model_struct.LocalConversation)
	newConversationSet := make(map[string]*model_struct.LocalConversation)
	conversationSet := make(map[string]*model_struct.LocalConversation)
	phConversationChangedSet := make(map[string]*model_struct.LocalConversation)
	phNewConversationSet := make(map[string]*model_struct.LocalConversation)
	conversationIDs := make([]string, 0, len(allMsg))
	totalIncomingMsgs := 0

	log.ZDebug(ctx, "message come here conversation ch", "conversation length", len(allMsg))
	b := time.Now()

	onlineMap := make(map[onlineMsgKey]struct{})

	for conversationID, msgs := range allMsg {
		totalIncomingMsgs += len(msgs.Msgs)
		conversationIDs = append(conversationIDs, conversationID)
		err := c.messageEncryptor.Decryption(ctx, msgs.Msgs, conversationID)
		if err != nil {
			log.ZWarn(ctx, "encrypt message failed", err, "messages", msgs.Msgs)
		}

		log.ZDebug(ctx, "parse message in one conversation", "conversationID", conversationID, "message length", len(msgs.Msgs), "data", msgs.Msgs)

		// Only query existing messages for self-sent messages (SendID == loginUserID).
		// For others' duplicates, we tolerate dropping on insert (ON CONFLICT DO NOTHING).
		selfClientIDs := make([]string, 0, len(msgs.Msgs))
		for _, msg := range msgs.Msgs {
			if msg.SendID == c.loginUserID {
				selfClientIDs = append(selfClientIDs, msg.ClientMsgID)
			}
		}

		var clientMsgs []*model_struct.LocalChatLog
		if len(selfClientIDs) > 0 {
			clientMsgs, err = c.db.GetMessagesByClientMsgIDs(ctx, conversationID, selfClientIDs)
			if err != nil {
				log.ZWarn(ctx, "GetMessagesByClientMsgIDs failed", err, "conversationID", conversationID, "clientIDs", selfClientIDs)
			}
		}
		clientMsgMap := datautil.SliceToMap(clientMsgs, func(e *model_struct.LocalChatLog) string {
			return e.ClientMsgID
		})

		var insertMessage, selfInsertMessage, othersInsertMessage []*model_struct.LocalChatLog
		var updateMessage []*model_struct.LocalChatLog

		for _, v := range msgs.Msgs {
			log.ZDebug(ctx, "parse message ", "conversationID", conversationID, "msg", v)
			isHistory = utils.GetSwitchFromOptions(v.Options, constant.IsHistory)

			isUnreadCount = utils.GetSwitchFromOptions(v.Options, constant.IsUnreadCount)

			isConversationUpdate = utils.GetSwitchFromOptions(v.Options, constant.IsConversationUpdate)

			isNotPrivate = utils.GetSwitchFromOptions(v.Options, constant.IsNotPrivate)

			isSenderConversationUpdate = utils.GetSwitchFromOptions(v.Options, constant.IsSenderConversationUpdate)

			msg := converter.MsgDataToMsgStruct(v)

			//When the message has been marked and deleted by the cloud, it is directly inserted locally without any conversation and message update.
			if msg.Status == constant.MsgStatusHasDeleted {
				dbMessage := converter.MsgStructToLocalChatLog(msg)
				c.handleExceptionMessages(ctx, nil, dbMessage)
				exceptionMsg = append(exceptionMsg, dbMessage)
				insertMessage = append(insertMessage, dbMessage)
				continue
			}

			msg.Status = constant.MsgStatusSendSuccess

			//De-analyze data
			err := converter.PopulateMsgStructByContentType(msg)
			if err != nil {
				log.ZError(ctx, "Parsing data error:", err, "type: ", msg.ContentType, "msg", msg)
				continue
			}

			if !isNotPrivate {
				msg.AttachedInfoElem.IsPrivateChat = true
			}
			if conversationID == "" {
				log.ZError(ctx, "conversationID is empty", errors.New("conversationID is empty"), "msg", msg)
				continue
			}
			if !isHistory {
				onlineMap[onlineMsgKey{ClientMsgID: v.ClientMsgID, ServerMsgID: v.ServerMsgID}] = struct{}{}
				newMessages = append(newMessages, msg)

			}
			log.ZDebug(ctx, "decode message", "msg", msg)
			if v.SendID == c.loginUserID { //seq
				// Messages sent by myself  //if  sent through  this terminal
				existingMsg, ok := clientMsgMap[msg.ClientMsgID]
				if ok {
					log.ZInfo(ctx, "have message", "msg", msg)
					if existingMsg.Seq == 0 {
						if !isConversationUpdate {
							msg.Status = constant.MsgStatusFiltered
						}
						updateMessage = append(updateMessage, converter.MsgStructToLocalChatLog(msg))
					} else {
						dbMessage := converter.MsgStructToLocalChatLog(msg)
						c.handleExceptionMessages(ctx, existingMsg, dbMessage)
						insertMessage = append(insertMessage, dbMessage)
						exceptionMsg = append(exceptionMsg, dbMessage)
					}
				} else {
					log.ZInfo(ctx, "sync message", "msg", msg)
					lc := model_struct.LocalConversation{
						ConversationType:  v.SessionType,
						LatestMsg:         utils.StructToJsonString(msg),
						LatestMsgSendTime: msg.SendTime,
						ConversationID:    conversationID,
					}
					switch v.SessionType {
					case constant.SingleChatType:
						lc.UserID = v.RecvID
					case constant.WriteGroupChatType, constant.ReadGroupChatType:
						lc.GroupID = v.GroupID
					}
					if isConversationUpdate {
						if isSenderConversationUpdate {
							log.ZDebug(ctx, "updateConversation msg", "message", v, "conversation", lc)
							c.updateConversation(&lc, conversationSet)
						}
						newMessages = append(newMessages, msg)
					}
					if isHistory {
						selfInsertMessage = append(selfInsertMessage, converter.MsgStructToLocalChatLog(msg))
					}
				}
			} else { //Sent by others
				lc := model_struct.LocalConversation{
					ConversationType:  v.SessionType,
					LatestMsg:         utils.StructToJsonString(msg),
					LatestMsgSendTime: msg.SendTime,
					ConversationID:    conversationID,
				}
				switch v.SessionType {
				case constant.SingleChatType:
					lc.UserID = v.SendID
					lc.ShowName = msg.SenderNickname
					lc.FaceURL = msg.SenderFaceURL
				case constant.WriteGroupChatType, constant.ReadGroupChatType:
					lc.GroupID = v.GroupID
				case constant.NotificationChatType:
					lc.UserID = v.SendID
				}
				if isUnreadCount {
					if c.seqCache.IsNewMsg(conversationID, msg.Seq) {
						isTriggerUnReadCount = true
						lc.UnreadCount = 1
						c.seqCache.IncrMaxSeq(conversationID, 1)
					}
				}
				if isConversationUpdate {
					c.updateConversation(&lc, conversationSet)
					newMessages = append(newMessages, msg)
				}
				if isHistory {
					othersInsertMessage = append(othersInsertMessage, converter.MsgStructToLocalChatLog(msg))
				}
			}
		}
		insertMsg[conversationID] = append(insertMessage, c.faceURLAndNicknameHandle(ctx, selfInsertMessage, othersInsertMessage, conversationID)...)
		if len(updateMessage) > 0 {
			updateMsg[conversationID] = updateMessage

		}
	}

	insertMsgTotal := 0
	for _, ms := range insertMsg {
		insertMsgTotal += len(ms)
	}
	updateMsgTotal := 0
	for _, ms := range updateMsg {
		updateMsgTotal += len(ms)
	}
	log.ZDebug(
		ctx,
		"doMsgNew phase1 done",
		"duration", time.Since(b).String(),
		"conversations", len(allMsg),
		"incomingMsgs", totalIncomingMsgs,
		"insertConversations", len(insertMsg),
		"insertMsgs", insertMsgTotal,
		"updateConversations", len(updateMsg),
		"updateMsgs", updateMsgTotal,
	)

	//todo The lock granularity needs to be optimized to the conversation level.
	lockWaitStart := time.Now()
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()
	if wait := time.Since(lockWaitStart); wait > 20*time.Millisecond {
		log.ZDebug(ctx, "doMsgNew waited for conversationSyncMutex", "wait", wait.String())
	}

	tGetMultipleConversationDB := time.Now()
	list, err := c.db.GetMultipleConversationDB(ctx, conversationIDs)
	if err != nil {
		log.ZError(ctx, "GetMultipleConversationDB", err, "conversationIDs", conversationIDs)
		return
	}
	log.ZDebug(ctx, "GetMultipleConversationDB done", "duration", time.Since(tGetMultipleConversationDB).String(), "count", len(list))

	var hList []*model_struct.LocalConversation
	tBuildLocalConversationMap := time.Now()
	m := datautil.SliceToMap(list, func(e *model_struct.LocalConversation) string {
		if e.LatestMsgSendTime == 0 {
			hList = append(hList, e)
		}
		return e.ConversationID
	})
	log.ZDebug(ctx, "doMsgNew buildLocalConversationMap done", "duration", time.Since(tBuildLocalConversationMap).String(), "local", len(list), "hidden", len(hList))

	tDiff := time.Now()
	c.diff(ctx, m, conversationSet, conversationChangedSet, newConversationSet)
	log.ZDebug(ctx, "diff done", "duration", time.Since(tDiff).String(), "new", len(newConversationSet), "changed", len(conversationChangedSet))
	log.ZDebug(ctx, "doMsgNew conversationChanges", "new", len(newConversationSet), "changed", len(conversationChangedSet))

	//seq sync message update
	tBatchUpdateMessageList := time.Now()
	if err := c.batchUpdateMessageList(ctx, updateMsg); err != nil {
		log.ZError(ctx, "sync seq normal message err  :", err)
	}
	log.ZDebug(ctx, "batchUpdateMessageList done", "duration", time.Since(tBatchUpdateMessageList).String())

	//Normal message storage
	tBatchInsertMessageList := time.Now()
	_ = c.batchInsertMessageList(ctx, insertMsg)
	log.ZDebug(ctx, "batchInsertMessageList done", "duration", time.Since(tBatchInsertMessageList).String())

	//
	for _, v := range hList {
		if nc, ok := newConversationSet[v.ConversationID]; ok {
			phConversationChangedSet[v.ConversationID] = nc
			nc.RecvMsgOpt = v.RecvMsgOpt
			nc.GroupAtType = v.GroupAtType
			nc.IsPinned = v.IsPinned
			nc.IsPrivateChat = v.IsPrivateChat
			if nc.IsPrivateChat {
				nc.BurnDuration = v.BurnDuration
			}
			if v.UnreadCount != 0 {
				nc.UnreadCount = v.UnreadCount
			}
			nc.IsNotInGroup = v.IsNotInGroup
			nc.AttachedInfo = v.AttachedInfo
			nc.Ex = v.Ex
			nc.IsMsgDestruct = v.IsMsgDestruct
			nc.MsgDestructTime = v.MsgDestructTime
		}
	}

	for k, v := range newConversationSet {
		if _, ok := phConversationChangedSet[v.ConversationID]; !ok {
			phNewConversationSet[k] = v
		}
	}

	tBatchUpdateConversationList := time.Now()
	if err := c.db.BatchUpdateConversationList(ctx, append(datautil.Values(conversationChangedSet), datautil.Values(phConversationChangedSet)...)); err != nil {
		log.ZError(ctx, "insert changed conversation err :", err)
	}
	log.ZDebug(ctx, "BatchUpdateConversationList done", "duration", time.Since(tBatchUpdateConversationList).String(), "count", len(conversationChangedSet)+len(phConversationChangedSet))
	//New conversation storage

	tBatchInsertConversationList := time.Now()
	if err := c.db.BatchInsertConversationList(ctx, datautil.Values(phNewConversationSet)); err != nil {
		log.ZError(ctx, "insert new conversation err:", err)
	}
	log.ZDebug(ctx, "BatchInsertConversationList done", "duration", time.Since(tBatchInsertConversationList).String(), "count", len(phNewConversationSet))
	log.ZDebug(ctx, "doMsgNew before callbacks", "duration", time.Since(b).String(), "conversations", len(allMsg), "incomingMsgs", totalIncomingMsgs)

	if c.batchMsgListener() != nil {
		c.batchNewMessages(ctx, newMessages, conversationChangedSet, newConversationSet, onlineMap)
	} else {
		c.newMessage(ctx, newMessages, conversationChangedSet, newConversationSet, onlineMap)
	}
	if len(newConversationSet) > 0 {
		c.ConversationListener().OnNewConversation(utils.StructToJsonString(datautil.Values(newConversationSet)))
	}
	if len(conversationChangedSet) > 0 {
		c.notifyConversationChanged(ctx, datautil.Values(conversationChangedSet))
	}

	if isTriggerUnReadCount {
		_ = c.OnTotalUnreadMessageCountChanged(ctx)
	}

	//Exception message storage
	for _, v := range exceptionMsg {
		log.ZWarn(ctx, "exceptionMsg show: ", nil, "msg", *v)
	}

	log.ZDebug(ctx, "doMsgNew done", "duration", time.Since(b).String(), "conversations", len(allMsg), "incomingMsgs", totalIncomingMsgs, "newMessages", len(newMessages))
}

func (c *Conversation) doMsgSyncByReinstalled(c2v common.Cmd2Value) {
	allMsg := c2v.Value.(sdk_struct.CmdMsgSyncInReinstall).Msgs
	ctx := c2v.Ctx
	msgLen := len(allMsg)
	c.msgOffset += msgLen
	total := c2v.Value.(sdk_struct.CmdMsgSyncInReinstall).Total

	insertMsg := make(map[string][2][]*model_struct.LocalChatLog, 10)
	conversationList := make([]*model_struct.LocalConversation, 0)
	var exceptionMsg []*model_struct.LocalChatLog

	log.ZDebug(ctx, "message come here conversation ch in reinstalled", "conversation length", msgLen)
	b := time.Now()

	groupMemberMap := make(map[string][]string, 10)

	for conversationID, msgs := range allMsg {
		err := c.messageEncryptor.Decryption(ctx, msgs.Msgs, conversationID)
		if err != nil {
			log.ZWarn(ctx, "encrypt message failed", err, "messages", msgs.Msgs)
		}

		log.ZDebug(ctx, "parse message in one conversation", "conversationID",
			conversationID, "message length", len(msgs.Msgs))
		var insertMessage, selfInsertMessage, othersInsertMessage []*model_struct.LocalChatLog
		var latestMsg *sdk_struct.MsgStruct
		if len(msgs.Msgs) == 0 {
			log.ZWarn(ctx, "msg.Msgs is empty", errs.New("msg.Msgs is empty"), "conversationID", conversationID)
			continue
		}
		for _, v := range msgs.Msgs {
			if v.SessionType == constant.ReadGroupChatType {
				groupMemberMap[v.GroupID] = append(groupMemberMap[v.GroupID], v.SendID)
			}

			log.ZDebug(ctx, "parse message ", "conversationID", conversationID, "msg", v)
			msg := converter.MsgDataToMsgStruct(v)

			//When the message has been marked and deleted by the cloud, it is directly inserted locally without any conversation and message update.
			if msg.Status == constant.MsgStatusHasDeleted {
				dbMessage := converter.MsgStructToLocalChatLog(msg)
				c.handleExceptionMessages(ctx, nil, dbMessage)
				exceptionMsg = append(exceptionMsg, dbMessage)
				insertMessage = append(insertMessage, dbMessage)
				continue
			}
			msg.Status = constant.MsgStatusSendSuccess

			err := converter.PopulateMsgStructByContentType(msg)
			if err != nil {
				log.ZError(ctx, "Parsing data error:", err, "type: ", msg.ContentType, "msg", msg)
				continue
			}

			if conversationID == "" {
				log.ZError(ctx, "conversationID is empty", errors.New("conversationID is empty"), "msg", msg)
				continue
			}

			log.ZDebug(ctx, "decode message", "msg", msg)
			if v.SendID == c.loginUserID {
				// Messages sent by myself  //if  sent through  this terminal
				log.ZInfo(ctx, "sync message in reinstalled", "msg", msg)

				latestMsg = msg

				selfInsertMessage = append(selfInsertMessage, converter.MsgStructToLocalChatLog(msg))
			} else { //Sent by others
				othersInsertMessage = append(othersInsertMessage, converter.MsgStructToLocalChatLog(msg))

				latestMsg = msg
			}
		}

		if latestMsg != nil {
			conversationList = append(conversationList, &model_struct.LocalConversation{
				LatestMsg:         utils.StructToJsonString(latestMsg),
				LatestMsgSendTime: latestMsg.SendTime,
				ConversationID:    conversationID,
			})
		} else {
			log.ZWarn(ctx, "latestMsg is nil", errs.New("latestMsg is nil"), "conversationID", conversationID)
		}

		insertMsg[conversationID] = [2][]*model_struct.LocalChatLog{
			append(insertMessage, selfInsertMessage...),
			othersInsertMessage,
		}

	}
	b1 := time.Now()
	// Synchronize the group members for this batch of messages
	groupIDs := datautil.Keys(groupMemberMap)
	err := c.group.IncrSyncGroupAndMember(ctx, groupIDs...)
	if err != nil {
		log.ZError(ctx, "IncrSyncGroupAndMember", err)
	}
	log.ZDebug(ctx, "IncrSyncGroupAndMember", "cost time", time.Since(b1).String(), "len", len(allMsg))
	b2 := time.Now()
	// Use the latest group member or user information to fill in the profile pictures and nicknames of the messages
	mergedInsertMsg := c.FillSenderProfileBatch(ctx, insertMsg)
	log.ZDebug(ctx, "FillSenderProfileBatch", "cost time", time.Since(b2).String(), "len", len(allMsg))
	// message storage
	_ = c.batchInsertMessageList(ctx, mergedInsertMsg)

	// conversation storage
	if err := c.db.BatchUpdateConversationList(ctx, conversationList); err != nil {
		log.ZError(ctx, "insert new conversation err:", err)
	}
	log.ZDebug(ctx, "doMsgSyncByReinstalled before callbacks", "duration", time.Since(b).String(), "conversations", len(allMsg))

	// log.ZDebug(ctx, "progress is", "msgLen", msgLen, "msgOffset", c.msgOffset, "total", total, "now progress is", (c.msgOffset*(100-InitSyncProgress))/total + InitSyncProgress)
	if total > 0 {
		c.ConversationListener().OnSyncServerProgress((c.msgOffset*(100-InitSyncProgress))/total + InitSyncProgress)
	}
	//Exception message storage
	for _, v := range exceptionMsg {
		log.ZWarn(ctx, "exceptionMsg show: ", nil, "msg", *v)
	}
}

func (c *Conversation) addInitProgress(progress int) {
	c.progress += progress
	if c.progress > 100 {
		c.progress = 100
	}
}

func (c *Conversation) diff(ctx context.Context, local, generated, cc, nc map[string]*model_struct.LocalConversation) {
	var newConversations []*model_struct.LocalConversation
	for _, v := range generated {
		if localC, ok := local[v.ConversationID]; ok {
			if localC.IsHidden {
				localC.IsHidden = false
				_ = c.db.UpdateColumnsConversation(ctx, v.ConversationID, map[string]interface{}{"is_hidden": false})
			}
			if v.LatestMsgSendTime > localC.LatestMsgSendTime {
				localC.UnreadCount = localC.UnreadCount + v.UnreadCount
				localC.LatestMsg = v.LatestMsg
				localC.LatestMsgSendTime = v.LatestMsgSendTime
				cc[v.ConversationID] = localC
			} else {
				localC.UnreadCount = localC.UnreadCount + v.UnreadCount
				cc[v.ConversationID] = localC
			}

		} else {
			newConversations = append(newConversations, v)
		}
	}
	if err := c.batchAddFaceURLAndName(ctx, newConversations...); err != nil {
		log.ZError(ctx, "batchAddFaceURLAndName err", err, "conversations", newConversations)
	} else {
		for _, v := range newConversations {
			nc[v.ConversationID] = v
		}
	}
}

func (c *Conversation) genConversationGroupAtType(lc *model_struct.LocalConversation, s *sdk_struct.MsgStruct) {
	if s.ContentType == constant.AtText {
		tagMe := utils.IsContain(c.loginUserID, s.AtTextElem.AtUserList)
		tagAll := utils.IsContain(constant.AtAllString, s.AtTextElem.AtUserList)
		if tagAll {
			if tagMe {
				lc.GroupAtType = constant.AtAllAtMe
				return
			}
			lc.GroupAtType = constant.AtAll
			return
		}
		if tagMe {
			lc.GroupAtType = constant.AtMe
		}
	}
}

func (c *Conversation) batchUpdateMessageList(ctx context.Context, updateMsg map[string][]*model_struct.LocalChatLog) error {
	if updateMsg == nil {
		return nil
	}
	for conversationID, messages := range updateMsg {
		conversation, err := c.db.GetConversation(ctx, conversationID)
		if err != nil {
			log.ZError(ctx, "GetConversation err", err, "conversationID", conversationID)
			continue
		}
		latestMsg := &sdk_struct.MsgStruct{}
		if err := json.Unmarshal([]byte(conversation.LatestMsg), latestMsg); err != nil {
			log.ZError(ctx, "Unmarshal err", err, "conversationID",
				conversationID, "latestMsg", conversation.LatestMsg, "messages", messages)
			continue
		}
		for _, v := range messages {
			v1 := new(model_struct.LocalChatLog)
			v1.ClientMsgID = v.ClientMsgID
			v1.Seq = v.Seq
			v1.Status = v.Status
			v1.RecvID = v.RecvID
			v1.SessionType = v.SessionType
			v1.ServerMsgID = v.ServerMsgID
			v1.SendTime = v.SendTime
			err := c.db.UpdateMessage(ctx, conversationID, v1)
			if err != nil {
				return errs.WrapMsg(err, "BatchUpdateMessageList failed")
			}
			if latestMsg.ClientMsgID == v.ClientMsgID {
				latestMsg.ServerMsgID = v.ServerMsgID
				latestMsg.Seq = v.Seq
				latestMsg.SendTime = v.SendTime
				latestMsg.Status = v.Status
				conversation.LatestMsg = utils.StructToJsonString(latestMsg)

				_ = c.OnUpsertConversationLatestMessage(ctx, conversation)

			}
		}

	}
	return nil
}

func (c *Conversation) batchInsertMessageList(ctx context.Context, insertMsg map[string][]*model_struct.LocalChatLog) error {
	if insertMsg == nil {
		return nil
	}

	// Prefer a single-transaction batch insert when supported by the DB implementation.
	type messageBatchInserter interface {
		BatchInsertMessageMap(ctx context.Context, insertMsg map[string][]*model_struct.LocalChatLog) error
	}
	if bi, ok := c.db.(messageBatchInserter); ok {
		return bi.BatchInsertMessageMap(ctx, insertMsg)
	}

	for conversationID, messages := range insertMsg {
		if len(messages) == 0 {
			continue
		}
		err := c.db.BatchInsertMessageList(ctx, conversationID, messages)
		if err != nil {
			log.ZError(ctx, "BatchInsertMessageList detail err:", err, "conversationID", conversationID, "messages", messages)
			for _, v := range messages {
				e := c.db.InsertMessage(ctx, conversationID, v)
				if e != nil {
					log.ZError(ctx, "InsertMessage err", err, "conversationID", conversationID, "message", v)
				}
			}
		}

	}
	return nil
}

func (c *Conversation) filterMessages(
	ctx context.Context,
	raw sdk_struct.NewMsgList,
) sdk_struct.NewMsgList {
	sort.Sort(raw)

	result := make(sdk_struct.NewMsgList, 0, len(raw))
	for _, w := range raw {
		if w.ContentType == constant.Typing {
			c.typing.onNewMsg(ctx, w)
			continue
		}
		result = append(result, w)
	}
	return result
}
func (c *Conversation) newMessage(
	ctx context.Context,
	newMessagesList sdk_struct.NewMsgList,
	cc, nc map[string]*model_struct.LocalConversation,
	onlineMsg map[onlineMsgKey]struct{},
) {
	messages := c.filterMessages(ctx, newMessagesList)
	if len(messages) == 0 {
		return
	}

	// -------- Arrival--------
	for _, w := range messages {
		if _, ok := onlineMsg[onlineMsgKey{
			ClientMsgID: w.ClientMsgID,
			ServerMsgID: w.ServerMsgID,
		}]; ok {
			c.msgListener().OnRecvOnlineOnlyMessage(utils.StructToJsonString(w))
		} else {
			c.msgListener().OnRecvNewMessage(utils.StructToJsonString(w))
		}
	}

	// -------- Offline Notify --------
	if !c.GetBackground() {
		return
	}

	u, err := c.user.GetSelfUserInfo(ctx)
	if err != nil || u.GlobalRecvMsgOpt != constant.ReceiveMessage {
		return
	}

	for _, w := range messages {
		conversationID := utils.GetConversationIDByMsg(w)

		if v, ok := cc[conversationID]; ok && v.RecvMsgOpt == constant.ReceiveMessage {
			c.msgListener().OnRecvOfflineNewMessage(utils.StructToJsonString(w))
			continue
		}
		if v, ok := nc[conversationID]; ok && v.RecvMsgOpt == constant.ReceiveMessage {
			c.msgListener().OnRecvOfflineNewMessage(utils.StructToJsonString(w))
		}
	}
}
func (c *Conversation) batchNewMessages(
	ctx context.Context,
	newMessagesList sdk_struct.NewMsgList,
	cc, nc map[string]*model_struct.LocalConversation,
	onlineMsg map[onlineMsgKey]struct{},
) {
	messages := c.filterMessages(ctx, newMessagesList)
	if len(messages) == 0 {
		return
	}

	// -------- Arrival --------
	var normalMsgs sdk_struct.NewMsgList

	for _, w := range messages {
		key := onlineMsgKey{
			ClientMsgID: w.ClientMsgID,
			ServerMsgID: w.ServerMsgID,
		}

		if _, ok := onlineMsg[key]; ok {
			c.msgListener().
				OnRecvOnlineOnlyMessage(utils.StructToJsonString(w))
		} else {
			normalMsgs = append(normalMsgs, w)
		}
	}

	if len(normalMsgs) > 0 {
		c.batchMsgListener().
			OnRecvNewMessages(utils.StructToJsonString(normalMsgs))
	}

	// -------- Offline Notify --------
	if !c.GetBackground() {
		return
	}

	u, err := c.user.GetSelfUserInfo(ctx)
	if err != nil || u.GlobalRecvMsgOpt != constant.ReceiveMessage {
		return
	}

	var notify sdk_struct.NewMsgList
	for _, w := range messages {
		conversationID := utils.GetConversationIDByMsg(w)

		if v, ok := cc[conversationID]; ok && v.RecvMsgOpt == constant.ReceiveMessage {
			notify = append(notify, w)
			continue
		}
		if v, ok := nc[conversationID]; ok && v.RecvMsgOpt == constant.ReceiveMessage {
			notify = append(notify, w)
		}
	}

	if len(notify) > 0 {
		c.batchMsgListener().
			OnRecvOfflineNewMessages(utils.StructToJsonString(notify))
	}
}

func (c *Conversation) updateConversation(lc *model_struct.LocalConversation, cs map[string]*model_struct.LocalConversation) {
	if oldC, ok := cs[lc.ConversationID]; !ok {
		cs[lc.ConversationID] = lc
	} else {
		if lc.LatestMsgSendTime > oldC.LatestMsgSendTime {
			oldC.UnreadCount = oldC.UnreadCount + lc.UnreadCount
			oldC.LatestMsg = lc.LatestMsg
			oldC.LatestMsgSendTime = lc.LatestMsgSendTime
			cs[lc.ConversationID] = oldC
		} else {
			oldC.UnreadCount = oldC.UnreadCount + lc.UnreadCount
			cs[lc.ConversationID] = oldC
		}
	}
}

func (c *Conversation) batchAddFaceURLAndName(ctx context.Context, conversations ...*model_struct.LocalConversation) error {
	if len(conversations) == 0 {
		return nil
	}
	var userIDs, groupIDs []string
	for _, conversation := range conversations {
		if conversation.ConversationType == constant.SingleChatType ||
			conversation.ConversationType == constant.NotificationChatType {
			userIDs = append(userIDs, conversation.UserID)
		} else if conversation.ConversationType == constant.ReadGroupChatType {
			groupIDs = append(groupIDs, conversation.GroupID)
		}
	}

	// if userIDs = nil, return nil, nil
	users, err := c.batchGetUserNameAndFaceURL(ctx, userIDs...)
	if err != nil {
		return err
	}

	groupInfoList, err := c.group.GetSpecifiedGroupsInfoSafe(ctx, groupIDs)
	if err != nil {
		return err
	}

	groups := datautil.SliceToMap(groupInfoList, func(groupInfo *model_struct.LocalGroup) string {
		return groupInfo.GroupID
	})

	for _, conversation := range conversations {
		if conversation.ConversationType == constant.SingleChatType ||
			conversation.ConversationType == constant.NotificationChatType {
			if v, ok := users[conversation.UserID]; ok {
				conversation.FaceURL = v.FaceURL
				conversation.ShowName = v.Nickname
			} else {
				log.ZWarn(ctx, "user info not found", errors.New("user not found"), "userID", conversation.UserID)

				conversation.FaceURL = ""
				conversation.ShowName = "UserNotFound"
			}
		} else if conversation.ConversationType == constant.ReadGroupChatType {
			if v, ok := groups[conversation.GroupID]; ok {
				conversation.FaceURL = v.FaceURL
				conversation.ShowName = v.GroupName
			} else {
				log.ZWarn(ctx, "group info not found", errors.New("group not found"),
					"groupID", conversation.GroupID)
			}

		}
	}

	return nil
}

func (c *Conversation) batchGetUserNameAndFaceURL(ctx context.Context, userIDs ...string) (map[string]*model_struct.LocalUser,
	error) {
	m := make(map[string]*model_struct.LocalUser)
	var notInFriend []string

	if len(userIDs) == 0 {
		return m, nil
	}

	friendList, err := c.relation.Db().GetFriendInfoList(ctx, userIDs)
	if err != nil {
		log.ZWarn(ctx, "BatchGetUserNameAndFaceURL", err, "userIDs", userIDs)
		notInFriend = userIDs
	} else {
		notInFriend = datautil.SliceSub(userIDs, datautil.Slice(friendList, func(e *model_struct.LocalFriend) string {
			return e.FriendUserID
		}))
	}
	for _, localFriend := range friendList {
		userInfo := &model_struct.LocalUser{UserID: localFriend.FriendUserID, FaceURL: localFriend.FaceURL}
		if localFriend.Remark != "" {
			userInfo.Nickname = localFriend.Remark
		} else {
			userInfo.Nickname = localFriend.Nickname
		}
		m[localFriend.FriendUserID] = userInfo
	}

	usersInfo, err := c.user.GetUsersInfoWithCache(ctx, notInFriend)
	if err != nil {
		return nil, err
	}

	for _, userInfo := range usersInfo {
		m[userInfo.UserID] = userInfo
	}
	return m, nil
}

func (c *Conversation) getUserNameAndFaceURL(ctx context.Context, userID string) (faceURL, name string, err error) {
	friendInfo, err := c.relation.Db().GetFriendInfoByFriendUserID(ctx, userID)
	if err == nil {
		faceURL = friendInfo.FaceURL
		if friendInfo.Remark != "" {
			name = friendInfo.Remark
		} else {
			name = friendInfo.Nickname
		}
		return faceURL, name, nil
	}
	userInfo, err := c.user.GetUserInfoWithCache(ctx, userID)
	if err != nil {
		return "", "", nil
	}
	return userInfo.FaceURL, userInfo.Nickname, nil
}

func (c *Conversation) ConsumeConversationEventLoop(ctx context.Context) {
	c.conversationHotColdManager.Run(ctx)
	defer c.conversationChangedBatcher.Close()
	defer func() {
		if r := recover(); r != nil {
			diagnose.ReportPanic(ctx, r)
			err := fmt.Sprintf("panic: %+v\n%s", r, debug.Stack())
			log.ZWarn(ctx, "DoListener panic", nil, "panic info", err)
		}
	}()
	c.conversationEventQueue.ConsumeLoop(ctx, func(ctx context.Context, event *common.Event) {
		cmd, ok := event.Data.(common.Cmd2Value)
		if !ok {
			log.ZWarn(ctx, "invalid event data in conversationEventQueue", nil)
			return
		}

		log.ZInfo(cmd.Ctx, "recv cmd", "caller", cmd.Caller, "cmd", cmd.Cmd, "value", cmd.Value)
		c.Work(cmd)
		log.ZInfo(cmd.Ctx, "done cmd", "caller", cmd.Caller, "cmd", cmd.Cmd, "value", cmd.Value)
	}, func(msg string, err error, fields ...any) {
		log.ZError(ctx, msg, err, fields...)
	})
}
