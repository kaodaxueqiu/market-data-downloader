package conversation_msg

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
)

var (
	sessionTypeError = errs.New("session type error")
)

func (c *Conversation) OnUpdateMessageAvatarAndNickname(ctx context.Context, data *common.UpdateMessageInfo) error {
	switch data.SessionType {
	case constant.SingleChatType:
		if data.UserID == c.loginUserID {
			conversationIDList, err := c.db.GetAllSingleConversationIDList(ctx)
			if err != nil {
				log.ZError(ctx, "GetAllSingleConversationIDList err", err)
				return err
			} else {
				log.ZDebug(ctx, "get single conversationID list", "conversationIDList", conversationIDList)
				for _, conversationID := range conversationIDList {
					err := c.db.UpdateMsgSenderFaceURLAndSenderNickname(ctx, conversationID, data.UserID, data.FaceURL, data.Nickname)
					if err != nil {
						log.ZError(ctx, "UpdateMsgSenderFaceURLAndSenderNickname err", err)
						continue
					}
				}

			}
		} else {
			conversationID := c.getConversationIDBySessionType(data.UserID, constant.SingleChatType)
			err := c.db.UpdateMsgSenderFaceURLAndSenderNickname(ctx, conversationID, data.UserID, data.FaceURL, data.Nickname)
			if err != nil {
				log.ZError(ctx, "UpdateMsgSenderFaceURLAndSenderNickname err", err)
			}

		}
	case constant.ReadGroupChatType:
		conversationID := c.getConversationIDBySessionType(data.GroupID, constant.ReadGroupChatType)
		err := c.db.UpdateMsgSenderFaceURLAndSenderNickname(ctx, conversationID, data.UserID, data.FaceURL, data.Nickname)
		if err != nil {
			log.ZError(ctx, "UpdateMsgSenderFaceURLAndSenderNickname err", err)
		}
	case constant.NotificationChatType:
		conversationID := c.getConversationIDBySessionType(data.UserID, constant.NotificationChatType)
		err := c.db.UpdateMsgSenderFaceURLAndSenderNickname(ctx, conversationID, data.UserID, data.FaceURL, data.Nickname)
		if err != nil {
			log.ZError(ctx, "UpdateMsgSenderFaceURLAndSenderNickname err", err)
		}
	default:
		log.ZError(ctx, "not support sessionType", nil, "data", data)
		return sessionTypeError.Wrap()
	}
	return nil
}
func (c *Conversation) OnUpdateConversationAvatarAndNickname(ctx context.Context, data *common.SourceIDAndSessionType) error {
	var lc model_struct.LocalConversation
	log.ZInfo(ctx, "UpdateConFaceUrlAndNickName", "data", data)
	switch data.SessionType {
	case constant.SingleChatType:
		lc.UserID = data.SourceID
		lc.ConversationID = c.getConversationIDBySessionType(data.SourceID, constant.SingleChatType)
		lc.ConversationType = constant.SingleChatType
	case constant.ReadGroupChatType:
		conversationID, conversationType, err := c.getConversationTypeByGroupID(ctx, data.SourceID)
		if err != nil {
			return err
		}
		lc.GroupID = data.SourceID
		lc.ConversationID = conversationID
		lc.ConversationType = conversationType
	case constant.NotificationChatType:
		lc.UserID = data.SourceID
		lc.ConversationID = c.getConversationIDBySessionType(data.SourceID, constant.NotificationChatType)
		lc.ConversationType = constant.NotificationChatType
	default:
		log.ZError(ctx, "not support sessionType", nil, "sessionType", data.SessionType)
		return sessionTypeError.Wrap()
	}

	lc.ShowName = data.Nickname
	lc.FaceURL = data.FaceURL
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()
	oldConversation, err := c.db.GetConversation(ctx, lc.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "GetConversation err", err)
		return nil
	}
	if oldConversation.ShowName == lc.ShowName && oldConversation.FaceURL == lc.FaceURL {
		log.ZDebug(ctx, "ignore update conversation avatar and nickname", "conversationID", lc.ConversationID)
		return nil
	}
	err = c.db.UpdateConversation(ctx, &lc)
	if err != nil {
		return err
	}
	return c.OnConversationChanged(ctx, []string{lc.ConversationID})
}

func (c *Conversation) OnUpdateConversationLatestMessageSenderProfile(ctx context.Context, data *common.UpdateMessageInfo) error {
	switch data.SessionType {
	case constant.ReadGroupChatType:
		conversationID := c.getConversationIDBySessionType(data.GroupID, constant.ReadGroupChatType)
		lc, err := c.db.GetConversation(ctx, conversationID)
		if err != nil {
			log.ZWarn(ctx, "getConversation err", err)
			return err
		}
		var latestMsg sdk_struct.MsgStruct
		err = json.Unmarshal([]byte(lc.LatestMsg), &latestMsg)
		if err != nil {
			log.ZError(ctx, "latestMsg,Unmarshal err", err)
		} else {
			//If the sender of the latest message in the conversation
			//happens to be a member of the group whose status has changed,
			//then update the sender's avatar and nickname for the latest message.
			if latestMsg.SendID == data.UserID {
				latestMsg.SenderFaceURL = data.FaceURL
				latestMsg.SenderNickname = data.Nickname
				newLatestMessage := utils.StructToJsonString(latestMsg)
				lc.LatestMsg = newLatestMessage
				err = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg": newLatestMessage})
				if err != nil {
					log.ZError(ctx, "updateConversationLatestMsgModel err", err)
				} else {
					var cList []*model_struct.LocalConversation
					cList = append(cList, lc)
					c.notifyConversationChanged(ctx, cList)
				}

			}
		}
	}
	return nil
}

func (c *Conversation) OnConversationChanged(ctx context.Context, conversationIDs []string) error {
	return c.conversationChangedBatcher.Enqueue(ctx, conversationIDs)
}

func (c *Conversation) onConversationChanged(ctx context.Context, conversationIDs []string) error {
	log.ZInfo(ctx, "OnConversationChanged", "caller", common.GetCaller(2), "conversationIDs", conversationIDs)
	conversations, err := c.db.GetMultipleConversationDB(ctx, conversationIDs)
	if err != nil {
		log.ZError(ctx, "getMultipleConversationModel err", err)
		return err
	}
	var newCList []*model_struct.LocalConversation
	for _, v := range conversations {
		if v.LatestMsgSendTime != 0 {
			newCList = append(newCList, v)
		}
	}
	if len(newCList) == 0 {
		log.ZInfo(ctx, "ignore OnConversationChanged", "conversationIDs", conversationIDs)
		return nil
	}
	log.ZInfo(ctx, "OnConversationChanged", "data", newCList)
	c.notifyConversationChanged(ctx, newCList)
	return nil
}

type conversationGroupTimingBreakdown struct {
	UsedFallback                  bool
	BuildPlanDuration             time.Duration
	LoadGroupsDuration            time.Duration
	GroupChangedCallbackDuration  time.Duration
	MemberChangedCallbackDuration time.Duration
	FallbackDuration              time.Duration
	ChangedGroups                 int
	MemberAddedGroups             int
	MemberDeletedGroups           int
}

func (c *Conversation) notifyConversationGroupChanged(ctx context.Context, conversations []*model_struct.LocalConversation) conversationGroupTimingBreakdown {
	var breakdown conversationGroupTimingBreakdown
	if !c.unreadConversationGroupSubscribed {
		return breakdown
	}
	if c.conversationGroupListenerVar == nil {
		return breakdown
	}
	if err := c.notifyConversationGroupChangedPrecise(ctx, conversations, &breakdown); err != nil {
		log.ZWarn(ctx, "precise conversation group change notify failed, fallback to full scan", err)
		breakdown.UsedFallback = true
		fallbackStartedAt := time.Now()
		c.notifyConversationGroupChangedNoCache(ctx, conversations)
		breakdown.FallbackDuration = time.Since(fallbackStartedAt)
	}
	return breakdown
}

type conversationGroupChangeDiff struct {
	ConversationID  string
	UnreadCountOld  int32
	UnreadCountNew  int32
	UnreadChanged   bool
	IsMarkedNew     bool
	IsMarkedChanged bool
	IsPinnedNew     bool
	IsPinnedChanged bool
	OldState        conversationGroupChangeCacheItem
	NewState        conversationGroupChangeCacheItem
	Existed         bool
}

type conversationGroupEventPlan struct {
	changedGroupIDs map[string]struct{}
	memberAdded     map[string][]string
	memberDeleted   map[string][]string
}

func newConversationGroupEventPlan() *conversationGroupEventPlan {
	return &conversationGroupEventPlan{
		changedGroupIDs: make(map[string]struct{}),
		memberAdded:     make(map[string][]string),
		memberDeleted:   make(map[string][]string),
	}
}

func (p *conversationGroupEventPlan) addChangedGroupID(groupID string) {
	if groupID == "" {
		return
	}
	p.changedGroupIDs[groupID] = struct{}{}
}

func (p *conversationGroupEventPlan) addMemberAdded(groupID string, conversationID string) {
	if groupID == "" || conversationID == "" {
		return
	}
	p.memberAdded[groupID] = append(p.memberAdded[groupID], conversationID)
}

func (p *conversationGroupEventPlan) addMemberDeleted(groupID string, conversationID string) {
	if groupID == "" || conversationID == "" {
		return
	}
	p.memberDeleted[groupID] = append(p.memberDeleted[groupID], conversationID)
}

func (p *conversationGroupEventPlan) changedGroupIDList() []string {
	groupIDs := make([]string, 0, len(p.changedGroupIDs))
	for groupID := range p.changedGroupIDs {
		if len(p.memberAdded[groupID]) > 0 || len(p.memberDeleted[groupID]) > 0 {
			continue
		}
		groupIDs = append(groupIDs, groupID)
	}
	return groupIDs
}

func (p *conversationGroupEventPlan) empty() bool {
	return len(p.changedGroupIDs) == 0 && len(p.memberAdded) == 0 && len(p.memberDeleted) == 0
}

func matchConversationFilterGroup(item conversationGroupChangeCacheItem, groupName string) bool {
	switch groupName {
	case constant.ConversationGroupFilterNameUnread:
		return item.UnreadCount > 0
	case constant.ConversationGroupFilterNameMarked:
		return item.IsMarked
	case constant.ConversationGroupFilterNameMentionMe:
		return item.GroupAtType != constant.AtNormal
	case constant.ConversationGroupFilterNameSingleChat:
		return !item.IsGroupChat
	case constant.ConversationGroupFilterNameGroupChat:
		return item.IsGroupChat
	case constant.ConversationGroupFilterNamePinned:
		return item.IsPinned
	default:
		return false
	}
}

func (c *Conversation) rebuildConversationGroupChangeCache(ctx context.Context) error {
	return c.rebuildConversationGroupCaches(ctx)
}

func (c *Conversation) diffConversationGroupChanges(conversations []*model_struct.LocalConversation) []conversationGroupChangeDiff {
	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.ensureConversationGroupCachesLocked()
	c.ensureDefaultFilterConversationGroupsLocked()

	diffs := make([]conversationGroupChangeDiff, 0, len(conversations))
	cache := &c.conversationGroupCache
	for _, conversation := range conversations {
		if conversation == nil || conversation.ConversationID == "" {
			continue
		}
		current := newConversationGroupCacheItem(conversation)
		previous, ok := cache.changeItems[conversation.ConversationID]
		if !ok {
			previous = conversationGroupChangeCacheItem{}
		}
		cache.changeItems[conversation.ConversationID] = current
		previousUnreadCount := conversationGroupUnreadCount(previous)
		currentUnreadCount := conversationGroupUnreadCount(current)
		delta := currentUnreadCount - previousUnreadCount
		for groupID := range cache.groupIDsByConversation[conversation.ConversationID] {
			if c.isFilterConversationGroupByID(groupID) {
				continue
			}
			cache.unreadByGroupID[groupID] += delta
		}
		for _, groupName := range c.filterConversationGroupNames {
			oldMatch := ok && matchConversationFilterGroup(previous, groupName)
			newMatch := matchConversationFilterGroup(current, groupName)
			switch {
			case oldMatch && newMatch:
				cache.unreadByGroupID[groupName] += delta
			case oldMatch:
				c.removeConversationGroupMembershipLocked(groupName, conversation.ConversationID)
				cache.unreadByGroupID[groupName] -= conversationGroupUnreadCount(previous)
			case newMatch:
				c.upsertConversationGroupMembershipLocked(groupName, conversation.ConversationID)
				cache.unreadByGroupID[groupName] += conversationGroupUnreadCount(current)
			}
		}
		diffs = append(diffs, conversationGroupChangeDiff{
			ConversationID:  conversation.ConversationID,
			UnreadCountOld:  previousUnreadCount,
			UnreadCountNew:  currentUnreadCount,
			UnreadChanged:   previousUnreadCount != currentUnreadCount,
			IsMarkedNew:     current.IsMarked,
			IsMarkedChanged: previous.IsMarked != current.IsMarked,
			IsPinnedNew:     current.IsPinned,
			IsPinnedChanged: previous.IsPinned != current.IsPinned,
			OldState:        previous,
			NewState:        current,
			Existed:         ok,
		})
	}
	return diffs
}

func (c *Conversation) getCachedFilterGroupConversation(groupName string) ([]string, bool) {
	if !c.isFilterConversationGroupByID(groupName) {
		return nil, false
	}
	return c.cachedConversationGroupMembers(groupName)
}

func (c *Conversation) cachedFilterGroupUnreadCount(groupName string) (int32, bool) {
	if !c.isFilterConversationGroupByID(groupName) {
		return 0, false
	}
	return c.cachedConversationGroupUnread(groupName)
}

func (c *Conversation) buildConversationGroupEventPlan(ctx context.Context, conversations []*model_struct.LocalConversation) (*conversationGroupEventPlan, error) {
	plan := newConversationGroupEventPlan()
	diffs := c.diffConversationGroupChanges(conversations)
	for _, diff := range diffs {
		if diff.UnreadChanged {
			groupIDs, ok := c.cachedConversationGroupIDsByConversationID(diff.ConversationID, false)
			if !ok {
				groupIDs, err := c.db.GetConversationGroupIDsByConversationIdDB(ctx, diff.ConversationID)
				if err != nil {
					return nil, err
				}
				for _, groupID := range groupIDs {
					if c.isFilterConversationGroupByID(groupID) {
						continue
					}
					plan.addChangedGroupID(groupID)
				}
				continue
			}
			for _, groupID := range groupIDs {
				plan.addChangedGroupID(groupID)
			}
		}
		for _, groupName := range c.filterConversationGroupNames {
			oldMatch := diff.Existed && matchConversationFilterGroup(diff.OldState, groupName)
			newMatch := matchConversationFilterGroup(diff.NewState, groupName)
			if oldMatch && newMatch {
				if diff.UnreadCountOld != diff.UnreadCountNew {
					plan.addChangedGroupID(groupName)
				}
				continue
			}
			if !oldMatch && newMatch {
				plan.addMemberAdded(groupName, diff.ConversationID)
				continue
			}
			if oldMatch {
				plan.addMemberDeleted(groupName, diff.ConversationID)
			}
		}
	}
	return plan, nil
}

func (c *Conversation) notifyConversationGroupChangedPrecise(ctx context.Context, conversations []*model_struct.LocalConversation, breakdown *conversationGroupTimingBreakdown) error {
	if len(conversations) == 0 {
		return nil
	}
	buildPlanStartedAt := time.Now()
	plan, err := c.buildConversationGroupEventPlan(ctx, conversations)
	if breakdown != nil {
		breakdown.BuildPlanDuration += time.Since(buildPlanStartedAt)
	}
	if err != nil {
		return err
	}
	if plan.empty() {
		return nil
	}
	groupIDs := plan.changedGroupIDList()
	if breakdown != nil {
		breakdown.MemberAddedGroups = len(plan.memberAdded)
		breakdown.MemberDeletedGroups = len(plan.memberDeleted)
	}
	if len(groupIDs) > 0 {
		loadGroupsStartedAt := time.Now()
		groups, err := c.getLocalConversationGroups(ctx, groupIDs)
		if breakdown != nil {
			breakdown.LoadGroupsDuration += time.Since(loadGroupsStartedAt)
		}
		if err != nil {
			return err
		}
		if len(groups) > 0 {
			if breakdown != nil {
				breakdown.ChangedGroups = len(groups)
			}
			groupChangedStartedAt := time.Now()
			c.conversationGroupListenerVar().OnConversationGroupChanged(utils.StructToJsonStringDefault(groups))
			if breakdown != nil {
				breakdown.GroupChangedCallbackDuration += time.Since(groupChangedStartedAt)
			}
		}
	}
	memberChangedStartedAt := time.Now()
	c.notifyConversationGroupMemberChanges(ctx, plan.memberAdded, plan.memberDeleted)
	if breakdown != nil {
		breakdown.MemberChangedCallbackDuration += time.Since(memberChangedStartedAt)
	}
	return nil
}

func (c *Conversation) notifyConversationGroupChangedNoCache(ctx context.Context, conversations []*model_struct.LocalConversation) {
	if c.conversationGroupListenerVar == nil {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	var groups []*model_struct.LocalConversationGroup
	for _, conversation := range conversations {
		groupsSingle, err := c.GetConversationGroupIDsByConversationID(ctx, conversation.ConversationID)
		if err != nil {
			log.ZError(ctx, "GetConversationGroupIDsByConversationID err", err)
			continue
		}
		groupInfo, err := c.listConversationGroupsFromLocal(ctx, groupsSingle)
		if err != nil {
			log.ZError(ctx, "_new_listConversationGroupsFromLocal err", err)
			continue
		}
		groups = append(groups, groupInfo...)
	}
	group, err := c.addNotLoadedLazyLoadConversationGroups(ctx, groups)
	if err != nil {
		log.ZError(ctx, "listFilterConversationGroups err", err)
		// when error, fallback to no filter conversation groups
		if len(groups) > 0 {
			groupListener.OnConversationGroupChanged(utils.StructToJsonString(groups))
		}
	} else {
		if len(group) > 0 {
			groupListener.OnConversationGroupChanged(utils.StructToJsonString(group))
		}
	}
}

func (c *Conversation) notifyConversationChanged(ctx context.Context, data []*model_struct.LocalConversation) {
	log.ZDebug(ctx, "notifyConversationChanged", "data", data)
	if observer := c.conversationGroupInjectedTimingObserver(); observer != nil {
		conversationIDs := make([]string, 0, len(data))
		for _, conversation := range data {
			if conversation == nil || conversation.ConversationID == "" {
				continue
			}
			conversationIDs = append(conversationIDs, conversation.ConversationID)
		}
		startedAt := time.Now()
		breakdown := c.notifyConversationGroupChanged(ctx, data)
		finishedAt := time.Now()
		observer(ConversationGroupInjectedTiming{
			ConversationIDs: conversationIDs,
			StartedAt:       startedAt,
			FinishedAt:      finishedAt,
			Duration:        finishedAt.Sub(startedAt),
			UsedFallback:    breakdown.UsedFallback,
			BuildPlan:       breakdown.BuildPlanDuration,
			LoadGroups:      breakdown.LoadGroupsDuration,
			GroupChangedCB:  breakdown.GroupChangedCallbackDuration,
			MemberChangedCB: breakdown.MemberChangedCallbackDuration,
			Fallback:        breakdown.FallbackDuration,
			ChangedGroups:   breakdown.ChangedGroups,
			MemberAdded:     breakdown.MemberAddedGroups,
			MemberDeleted:   breakdown.MemberDeletedGroups,
		})
	} else {
		c.notifyConversationGroupChanged(ctx, data)
	}
	listener := c.ConversationListener()
	if listener != nil {
		listener.OnConversationChanged(utils.StructToJsonString(data))
	}
}

func (c *Conversation) unreadConversationGroupChanged(ctx context.Context, data string) []*model_struct.LocalConversationGroup {
	if data == "" {
		return nil
	}
	var conversations []*model_struct.LocalConversation
	if err := utils.JsonStringToStruct(data, &conversations); err != nil {
		log.ZWarn(ctx, "parse conversationList for unread change failed", err)
		return nil
	}
	if len(conversations) == 0 {
		return nil
	}

	changedGroupIDs := make(map[string]struct{})
	filterGroups, err := c.listFilterConversationGroups(ctx)
	if err != nil {
		log.ZWarn(ctx, "list filter conversation groups failed", err)
	}
	for _, group := range filterGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		changedGroupIDs[group.ConversationGroupID] = struct{}{}
	}
	for _, conversation := range conversations {
		if conversation == nil || conversation.ConversationID == "" {
			continue
		}
		groupIDs, ok := c.cachedConversationGroupIDsByConversationID(conversation.ConversationID, false)
		if !ok {
			groupIDs, err = c.db.GetConversationGroupIDsByConversationIdDB(ctx, conversation.ConversationID)
			if err != nil {
				log.ZWarn(ctx, "GetConversationGroupIDsByConversationIdDB for unread change failed", err, "conversationID", conversation.ConversationID)
				continue
			}
		}
		for _, groupID := range groupIDs {
			if groupID == "" {
				continue
			}
			changedGroupIDs[groupID] = struct{}{}
		}
	}
	if len(changedGroupIDs) == 0 {
		return nil
	}
	groupIDList := make([]string, 0, len(changedGroupIDs))
	for groupID := range changedGroupIDs {
		groupIDList = append(groupIDList, groupID)
	}
	groups, err := c.listConversationGroupsFromLocal(ctx, groupIDList)
	if err != nil {
		log.ZWarn(ctx, "list conversation groups for unread change failed", err)
		return nil
	}
	return groups
}

func (c *Conversation) OnTotalUnreadMessageCountChanged(ctx context.Context) error {
	log.ZInfo(ctx, "OnTotalUnreadMessageCountChanged", "caller", common.GetCaller(2))
	totalUnreadCount, err := c.db.GetTotalUnreadMsgCountDB(ctx)
	if err != nil {
		log.ZWarn(ctx, "TotalUnreadMessageChanged GetTotalUnreadMsgCountDB err", err)
	} else {
		log.ZDebug(ctx, "TotalUnreadMessageChanged", "totalUnreadCount", totalUnreadCount)
		c.ConversationListener().OnTotalUnreadMessageCountChanged(totalUnreadCount)
	}
	return nil
}

func (c *Conversation) getConversationLatestMsgClientID(latestMsg string) string {
	msg := &sdk_struct.MsgStruct{}
	if err := json.Unmarshal([]byte(latestMsg), msg); err != nil {
		log.ZError(context.Background(), "getConversationLatestMsgClientID", err, "latestMsg", latestMsg)
	}
	return msg.ClientMsgID
}

func (c *Conversation) OnUpsertConversationLatestMessage(ctx context.Context, conversation *model_struct.LocalConversation) error {
	log.ZInfo(ctx, "OnUpsertConversationLatestMessage", "caller", common.GetCaller(2), "conversationID", conversation.ConversationID)
	getConversationLatestMsgClientID := func(latestMsg string) string {
		msg := &sdk_struct.MsgStruct{}
		if err := json.Unmarshal([]byte(latestMsg), msg); err != nil {
			log.ZError(context.Background(), "getConversationLatestMsgClientID", err, "latestMsg", latestMsg)
		}
		return msg.ClientMsgID
	}
	var list []*model_struct.LocalConversation
	oc, err := c.db.GetConversation(ctx, conversation.ConversationID)
	if err == nil {
		if conversation.LatestMsgSendTime >= oc.LatestMsgSendTime || getConversationLatestMsgClientID(conversation.LatestMsg) == getConversationLatestMsgClientID(oc.LatestMsg) { // The session update of asynchronous messages is subject to the latest sending time
			err := c.db.UpdateColumnsConversation(ctx, conversation.ConversationID, map[string]interface{}{"latest_msg_send_time": conversation.LatestMsgSendTime, "latest_msg": conversation.LatestMsg})
			if err != nil {
				log.ZError(ctx, "updateConversationLatestMsgModel", err, "conversationID", conversation.ConversationID)
			} else {
				oc.LatestMsgSendTime = conversation.LatestMsgSendTime
				oc.LatestMsg = conversation.LatestMsg
				list = append(list, oc)
				data := utils.StructToJsonString(list)
				log.ZInfo(ctx, "OnConversationChanged", "data", data)
				c.notifyConversationChanged(ctx, list)
			}
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		log.ZDebug(ctx, "new conversation", "lc", conversation)
		err4 := c.db.InsertConversation(ctx, conversation)
		if err4 != nil {
			log.ZWarn(ctx, "insert new conversation err", err4)
		} else {
			list = append(list, conversation)
			c.ConversationListener().OnNewConversation(utils.StructToJsonString(list))
		}
	} else {
		log.ZWarn(ctx, "GetConversation err", err)
	}
	return nil
}

func (c *Conversation) OnUpdateConversationLatestMessageContent(ctx context.Context, data *common.ModifyMessageInfo) error {
	log.ZInfo(ctx, "OnUpdateConversationLatestMessageContent", "caller", common.GetCaller(2), "data", data)
	newMessage := data.NewMessage
	lc, err := c.db.GetConversation(ctx, data.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "getConversation err", err)
		return err
	}
	var latestMsg sdk_struct.MsgStruct
	err = json.Unmarshal([]byte(lc.LatestMsg), &latestMsg)
	if err != nil {
		log.ZWarn(ctx, "latestMsg,Unmarshal err", err)
		return err
	}
	if latestMsg.ClientMsgID == data.ClientMsgID {
		if latestMsg.AttachedInfoElem != nil && latestMsg.AttachedInfoElem.LastModified != nil {
			if latestMsg.AttachedInfoElem.LastModified.ModifiedCount >= newMessage.AttachedInfoElem.LastModified.ModifiedCount {
				log.ZDebug(ctx, "ignore update latest message", "latestMsg", latestMsg, "newMessage", newMessage)
				return nil
			}
		}
		newLatestMessage := utils.StructToJsonString(newMessage)
		lc.LatestMsg = newLatestMessage
		err = c.db.UpdateColumnsConversation(ctx, data.ConversationID, map[string]interface{}{"latest_msg": newLatestMessage})
		if err != nil {
			log.ZWarn(ctx, "updateConversationLatestMsgModel err", err)
			return err
		}
		var cList []*model_struct.LocalConversation
		cList = append(cList, lc)
		c.notifyConversationChanged(ctx, cList)
	}
	return nil
}

func (c *Conversation) OnUpdateConversationLatestMessageState(ctx context.Context, conversationID string) error {
	log.ZInfo(ctx, "OnUpdateConversationLatestMessageState", "caller", common.GetCaller(2), "conversationID", conversationID)
	var latestMsg sdk_struct.MsgStruct
	l, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		log.ZError(ctx, "getConversationLatestMsgModel err", err, "conversationID", conversationID)
		return err
	} else {
		err := json.Unmarshal([]byte(l.LatestMsg), &latestMsg)
		if err != nil {
			log.ZError(ctx, "latestMsg,Unmarshal err", err)
		} else {
			latestMsg.IsRead = true
			newLatestMessage := utils.StructToJsonString(latestMsg)
			err = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg_send_time": latestMsg.SendTime, "latest_msg": newLatestMessage})
			if err != nil {
				log.ZError(ctx, "updateConversationLatestMsgModel err", err)
			}
		}
	}
	return nil
}

func (c *Conversation) OnUpdateConversationLatestMessageAttachInfo(ctx context.Context, data *common.GroupHasReadMessageInfo) error {
	log.ZInfo(ctx, "OnUpdateConversationLatestMessageAttachInfo", "caller", common.GetCaller(2), "data", data)
	lc, err := c.db.GetConversation(ctx, data.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "getConversation err", err)
		return err
	}
	var latestMsg sdk_struct.MsgStruct
	err = json.Unmarshal([]byte(lc.LatestMsg), &latestMsg)
	if err != nil {
		log.ZWarn(ctx, "latestMsg,Unmarshal err", err)
		return err
	}
	if latestMsg.ClientMsgID == data.ClientMsgID {
		latestMsg.AttachedInfoElem = data.AttacheInfo
		newLatestMessage := utils.StructToJsonString(latestMsg)
		lc.LatestMsg = newLatestMessage
		err = c.db.UpdateColumnsConversation(ctx, data.ConversationID, map[string]interface{}{"latest_msg": newLatestMessage})
		if err != nil {
			log.ZWarn(ctx, "updateConversationLatestMsgModel err", err)
			return err
		}
		var cList []*model_struct.LocalConversation
		cList = append(cList, lc)
		c.notifyConversationChanged(ctx, cList)

	}
	return nil
}
