package conversation_msg

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/patrickmn/go-cache"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	"github.com/openimsdk/protocol/constant"
	pbMsg "github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/log"
)

const maxStreamLastTriggerLength = 200

func (c *Conversation) doStreamMsgNotification(ctx context.Context, msg *sdkws.MsgData) error {
	return c.streamHandler.doStreamMsgNotification(ctx, msg)
}

func (c *Conversation) handlerStreamTimeout(ctx context.Context, msgs []*sdk_struct.MsgStruct) {
	for _, msg := range msgs {
		if msg.ContentType != constant.Stream {
			continue
		}
		conversationID := msg.ConversationID()
		if conversationID == "" {
			continue
		}
		streamElem := msg.StreamElem
		if streamElem == nil {
			log.ZError(ctx, "handler stream message elem is nil", nil, "msg", msg)
			continue
		}
		if streamElem.End {
			continue
		}
		c.streamHandler.tryAsyncSync(ctx, conversationID, msg.ClientMsgID, msg.Seq)
	}
}

func newStreamHandler(c *Conversation) *streamHandler {
	const streamCacheTime = time.Minute * 10
	return &streamHandler{
		c:    c,
		msgs: cache.New(streamCacheTime, streamCacheTime),
	}
}

type streamPacket struct {
	LocalMsg          *model_struct.LocalChatLog
	Packet            *sdk_struct.StreamElem
	Cache             map[int]string
	Syncing           bool
	LastTriggerLength int
}

type streamHandler struct {
	c    *Conversation
	lock sync.Mutex
	msgs *cache.Cache
}

func (x *streamHandler) syncStreamMsg(ctx context.Context, conversationID string, clientMsgID string, seq int64) error {
	ctx, cancel := context.WithTimeout(ctx, time.Second*10)
	defer cancel()
	req := &pbMsg.GetStreamMsgReq{
		ConversationID: conversationID,
		ClientMsgID:    clientMsgID,
		Seq:            seq,
	}
	resp, err := x.c.getStreamMsg(ctx, req)
	if err != nil {
		return err
	}
	tips := &sdkws.StreamMsgTips{
		ConversationID: conversationID,
		ClientMsgID:    clientMsgID,
		StartIndex:     0,
		Packets:        resp.Packets,
		End:            resp.End,
	}
	return x.doTips(ctx, tips, true)
}

func (x *streamHandler) asyncStreamMsg(ctx context.Context, conversationID string, clientMsgID string, seq int64) {
	ctx = context.WithoutCancel(ctx)
	go func() {
		if err := x.syncStreamMsg(ctx, conversationID, clientMsgID, seq); err != nil {
			log.ZError(ctx, "syncStreamMsg failed", err, "conversationID", conversationID, "clientMsgID", clientMsgID)
		}
	}()
}

func (x *streamHandler) parseStreamMsgTips(content []byte) (*sdkws.StreamMsgTips, error) {
	var notificationElem sdkws.NotificationElem
	if err := json.Unmarshal(content, &notificationElem); err != nil {
		return nil, err
	}
	var tips sdkws.StreamMsgTips
	if err := json.Unmarshal([]byte(notificationElem.Detail), &tips); err != nil {
		return nil, err
	}
	return &tips, nil
}

func (x *streamHandler) getMsg(ctx context.Context, conversationID, clientMsgID string) (*streamPacket, error) {
	key := conversationID + "::" + clientMsgID
	if val, ok := x.msgs.Get(key); ok {
		return val.(*streamPacket), nil
	}
	dbMsg, err := x.c.db.GetMessage(ctx, conversationID, clientMsgID)
	if err != nil {
		return nil, err
	}
	if dbMsg.ContentType != constant.Stream {
		return nil, errors.New("content type is not stream")
	}
	var streamElem sdk_struct.StreamElem
	if err := json.Unmarshal([]byte(dbMsg.Content), &streamElem); err != nil {
		log.ZError(ctx, "unmarshal stream msg tips failed", err, "msg", dbMsg)
	}
	sp := &streamPacket{
		LocalMsg: dbMsg,
		Packet:   &streamElem,
		Cache:    make(map[int]string),
	}
	x.msgs.SetDefault(key, sp)
	return sp, nil
}

func (x *streamHandler) doStreamMsgNotification(ctx context.Context, msg *sdkws.MsgData) error {
	tips, err := x.parseStreamMsgTips(msg.Content)
	if err != nil {
		return err
	}
	log.ZDebug(ctx, "=====> do streamMsgNotification", "tips", tips)
	return x.doTips(ctx, tips, false)
}

func (x *streamHandler) tryAsyncSync(ctx context.Context, conversationID string, clientMsgID string, seq int64) {
	ctx = context.WithoutCancel(ctx)
	fn := func() bool {
		x.lock.Lock()
		defer x.lock.Unlock()
		sp, err := x.getMsg(ctx, conversationID, clientMsgID)
		if err != nil {
			log.ZDebug(ctx, "getMsg failed", err, "conversationID", conversationID, "clientMsgID", clientMsgID)
			return false
		}
		if sp.Syncing {
			return false
		}
		sp.Syncing = true
		return true
	}
	go func() {
		if fn() {
			if err := x.syncStreamMsg(ctx, conversationID, clientMsgID, seq); err != nil {
				log.ZError(ctx, "syncStreamMsg failed", err, "conversationID", conversationID, "clientMsgID", clientMsgID)
			}
		}
	}()
}

func (x *streamHandler) doTips(ctx context.Context, tips *sdkws.StreamMsgTips, isApiSync bool) error {
	x.lock.Lock()
	defer x.lock.Unlock()
	sp, err := x.getMsg(ctx, tips.ConversationID, tips.ClientMsgID)
	if err != nil {
		return err
	}
	if sp.Packet.End {
		log.ZDebug(ctx, "stream msg tips end", "tips", tips)
		return nil
	}
	if isApiSync {
		sp.Syncing = false
	}
	if len(sp.Packet.Packets) < int(tips.StartIndex) {
		for i := range tips.Packets {
			sp.Cache[int(tips.StartIndex)+i] = tips.Packets[i]
		}
		log.ZWarn(ctx, "db stream msg packets is not enough", nil, "streamElem", sp.Packet, "tips", tips)
		if !sp.Syncing {
			sp.Syncing = true
			x.asyncStreamMsg(ctx, tips.ConversationID, tips.ClientMsgID, sp.LocalMsg.Seq)
		}
		return nil
	}
	sp.Packet.Packets = sp.Packet.Packets[:tips.StartIndex]
	for i, packet := range tips.Packets {
		delete(sp.Cache, int(tips.StartIndex)+i)
		sp.Packet.Packets = append(sp.Packet.Packets, packet)
	}
	for i := len(sp.Packet.Packets); ; i++ {
		pkt, ok := sp.Cache[i]
		if !ok {
			break
		}
		delete(sp.Cache, i)
		sp.Packet.Packets = append(sp.Packet.Packets, pkt)
	}
	sp.Packet.End = tips.End
	content := utils.StructToJsonString(sp.Packet)
	if sp.LocalMsg.Content == content {
		log.ZDebug(ctx, "stream msg unchanged")
		return nil
	}
	sp.LocalMsg.Content = content
	triggerConversation := sp.LastTriggerLength < maxStreamLastTriggerLength
	if triggerConversation {
		sp.LastTriggerLength = len(sp.Packet.Content)
		for _, packet := range sp.Packet.Packets {
			sp.LastTriggerLength += len(packet)
		}
	}
	return x.setStreamMsg(ctx, tips.ConversationID, sp.LocalMsg, sp.Packet.End, triggerConversation)
}

func (x *streamHandler) setStreamMsg(ctx context.Context, conversationID string, msg *model_struct.LocalChatLog, end bool, triggerConversation bool) error {
	if end {
		if err := x.c.db.UpdateMessage(ctx, conversationID, msg); err != nil {
			return err
		}
	}
	x.c.msgListener().OnMessageModified(utils.StructToJsonString(converter.LocalChatLogToMsgStruct(msg)))
	if end || triggerConversation {
		_ = x.c.OnUpdateConversationLatestMessageContent(ctx, &common.ModifyMessageInfo{
			ConversationID: conversationID,
			ClientMsgID:    msg.ClientMsgID,
			NewMessage:     converter.LocalChatLogToMsgStruct(msg),
		})
	}
	return nil
}
