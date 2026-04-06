package conversation_msg

import (
	"context"
	"encoding/json"
	"slices"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/simplelru"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	"github.com/openimsdk/protocol/constant"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

func (c *Conversation) doConversationPinnedMsg(ctx context.Context, msg *sdkws.MsgData) error {
	var n sdkws.NotificationElem
	if err := json.Unmarshal(msg.Content, &n); err != nil {
		return errs.WrapMsg(err, "json unmarshal notification elem failed")
	}
	var tips sdkws.MsgPinnedTips
	if err := json.Unmarshal([]byte(n.Detail), &tips); err != nil {
		return errs.WrapMsg(err, "json unmarshal pinned tips failed")
	}
	return c.pinnedMsgHandler.doTips(ctx, &tips)
}

func (c *Conversation) SetConversationPinnedMsg(ctx context.Context, conversationID string, clientMsgID string, pinned bool) error {
	message, err := c.waitForMessageSyncSeq(ctx, conversationID, clientMsgID)
	if err != nil {
		return err
	}
	return c.pinnedMsgHandler.SetConversationPinnedMsg(ctx, conversationID, message.Seq, pinned)
}

func (c *Conversation) GetConversationPinnedMsg(ctx context.Context, conversationID string) ([]*sdk_struct.MsgStruct, error) {
	res, err := c.pinnedMsgHandler.GetConversationPinnedMsg(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	return datautil.Slice(res, func(e *pbConversation.ConversationPinnedMsg) *sdk_struct.MsgStruct {
		return converter.LocalChatLogToMsgStruct(converter.MsgDataToLocalChatLog(e.Msg))
	}), nil
}

type pinnedMsgElem struct {
	resp    *pbConversation.GetConversationPinnedMsgResp
	deleted bool
	time    time.Time
}

func (x *pinnedMsgElem) getCreateTimeVersion() (int64, int64) {
	if x == nil || x.resp == nil {
		return 0, 0
	}
	return x.resp.CreateTime, x.resp.Version
}

func (x *pinnedMsgElem) Reliable() bool {
	if x.deleted {
		return false
	}
	if x.time.Sub(time.Now()) < 0 {
		return false
	}
	return true
}

type pinnedMsgResult struct {
	done chan struct{}
	resp *pbConversation.GetConversationPinnedMsgResp
	err  error
}

func (x *pinnedMsgResult) Result(ctx context.Context) ([]*pbConversation.ConversationPinnedMsg, error) {
	select {
	case <-ctx.Done():
		return nil, context.Cause(ctx)
	case <-x.done:
		if x.resp != nil {
			return x.resp.Msgs, nil
		}
		return nil, x.err
	}
}

func newPinnedMsgHandler(c *Conversation) *pinnedMsgHandler {
	lru, _ := simplelru.NewLRU[string, *pinnedMsgElem](1000, nil)
	return &pinnedMsgHandler{
		c:        c,
		response: make(map[string]*pinnedMsgResult),
		cache:    lru,
	}
}

type pinnedVersion struct {
	CreateTime int64
	Version    int64
}

// NeedSync x is old, nv is new
func (x pinnedVersion) NeedSync(nv pinnedVersion) bool {
	if x.CreateTime > nv.CreateTime {
		return false
	} else if x.CreateTime < nv.CreateTime {
		return true
	} else {
		return x.Version < nv.Version
	}
}

func newPinnedVersionFromMsgPinnedTips(tips *sdkws.MsgPinnedTips) pinnedVersion {
	return pinnedVersion{
		CreateTime: tips.CreateTime,
		Version:    tips.Version,
	}
}

func newPinnedVersionFromResp(resp *pbConversation.GetConversationPinnedMsgResp) pinnedVersion {
	return pinnedVersion{
		CreateTime: resp.CreateTime,
		Version:    resp.Version,
	}
}

type pinnedMsgHandler struct {
	c        *Conversation
	lock     sync.Mutex
	response map[string]*pinnedMsgResult
	cache    *simplelru.LRU[string, *pinnedMsgElem]
	incr     uint
}

func (x *pinnedMsgHandler) doTips(ctx context.Context, tips *sdkws.MsgPinnedTips) error {
	if tips.Pinned {
		return x.doPinned(ctx, tips)
	} else {
		return x.doDelete(ctx, tips)
	}
}

func (x *pinnedMsgHandler) onChangedPinnedMsg(ctx context.Context, conversationID string, msgs []*pbConversation.ConversationPinnedMsg) {
	log.ZDebug(ctx, "onChangedPinnedMsg", "conversationID", conversationID, "msgs", msgs)
	type ConversationPinnedMsg struct {
		UserID     string                `json:"userID"`
		PinnedTime int64                 `json:"pinnedTime"`
		Msg        *sdk_struct.MsgStruct `json:"msg"`
	}
	data := utils.StructToJsonString(struct {
		ConversationID string                   `json:"conversationID"`
		Msgs           []*ConversationPinnedMsg `json:"msgs"`
	}{ConversationID: conversationID, Msgs: datautil.Slice(msgs, func(e *pbConversation.ConversationPinnedMsg) *ConversationPinnedMsg {
		return &ConversationPinnedMsg{
			UserID:     e.UserID,
			PinnedTime: e.PinnedTime,
			Msg:        converter.LocalChatLogToMsgStruct(converter.MsgDataToLocalChatLog(e.Msg)),
		}
	})})
	x.c.msgListener().OnChangedPinnedMsg(data)
}

func (x *pinnedMsgHandler) asyncCallLock(ctx context.Context, conversationID string) *pinnedMsgResult {
	x.lock.Lock()
	resp := x.asyncCall(ctx, conversationID)
	x.lock.Unlock()
	return resp
}

func (x *pinnedMsgHandler) asyncCall(ctx context.Context, conversationID string) *pinnedMsgResult {
	return x.asyncGetCall(ctx, conversationID, false)
}

func (x *pinnedMsgHandler) asyncGetCall(ctx context.Context, conversationID string, force bool) *pinnedMsgResult {
	resp, ok := x.response[conversationID]
	if ok {
		return resp
	}
	resp = &pinnedMsgResult{
		done: make(chan struct{}),
	}
	x.response[conversationID] = resp
	req := pbConversation.GetConversationPinnedMsgReq{
		ConversationID: conversationID,
		UserID:         x.c.loginUserID,
	}
	local, ok := x.cache.Peek(conversationID)
	if ok && (!force) {
		req.CreateTime = local.resp.CreateTime
		req.Version = local.resp.Version
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second*10)
		defer cancel()
		apiResp, err := x.c.getConversationPinnedMsg(ctx, &req)
		if err != nil && errs.ErrRecordNotFound.Is(err) {
			err = nil
			apiResp = &pbConversation.GetConversationPinnedMsgResp{}
		}
		x.lock.Lock()
		defer func() {
			close(resp.done)
			x.lock.Unlock()
		}()
		delete(x.response, conversationID)
		if force {
			local = nil
		}
		if err != nil {
			if oldVal, ok := x.cache.Peek(conversationID); ok && oldVal.resp != nil {
				oldVal.deleted = true
				resp.resp = oldVal.resp
				resp.err = err
				return
			}
			resp.err = err
			return
		}
		if local != nil && len(apiResp.Msgs) == 0 && local.resp.CreateTime == apiResp.CreateTime && local.resp.Version == apiResp.Version {
			apiResp.Msgs = local.resp.Msgs
		}
		resp.resp = apiResp
		x.cache.Add(conversationID, &pinnedMsgElem{
			resp:    apiResp,
			deleted: false,
			time:    time.Now().Add(time.Hour),
		})
		if local == nil || local.resp.CreateTime != apiResp.CreateTime || local.resp.Version != apiResp.Version {
			x.onChangedPinnedMsg(ctx, conversationID, apiResp.Msgs)
		}
	}()
	return resp
}

func (x *pinnedMsgHandler) doDelete(ctx context.Context, tips *sdkws.MsgPinnedTips) error {
	x.lock.Lock()
	defer x.lock.Unlock()
	val, ok := x.cache.Get(tips.ConversationID)
	if ok && val.resp.CreateTime == tips.CreateTime && val.resp.Version+1 == tips.Version {
		val.resp.Version = tips.Version
		val.resp.Msgs = slices.DeleteFunc(val.resp.Msgs, func(e *pbConversation.ConversationPinnedMsg) bool {
			if e == nil || e.Msg == nil {
				return false
			}
			return e.Msg.Seq == tips.Seq
		})
		x.onChangedPinnedMsg(ctx, tips.ConversationID, val.resp.Msgs)
		return nil
	}
	x.asyncCall(ctx, tips.ConversationID)
	return nil
}

func (x *pinnedMsgHandler) doPinned(ctx context.Context, tips *sdkws.MsgPinnedTips) error {
	x.lock.Lock()
	defer x.lock.Unlock()
	val, ok := x.cache.Get(tips.ConversationID)
	if ok && (!newPinnedVersionFromResp(val.resp).NeedSync(newPinnedVersionFromMsgPinnedTips(tips))) {
		return nil
	}
	x.asyncCall(ctx, tips.ConversationID)
	return nil
}

func (x *pinnedMsgHandler) onMsgModified(ctx context.Context, conversationID string, seq int64) {
	if seq <= 0 {
		return
	}
	x.lock.Lock()
	defer x.lock.Unlock()
	res, ok := x.cache.Get(conversationID)
	if !ok {
		return
	}
	for _, msg := range res.resp.GetMsgs() {
		if msg.GetMsg().GetSeq() == seq {
			x.asyncGetCall(ctx, conversationID, true)
			return
		}
	}
}

func (x *pinnedMsgHandler) GetConversationPinnedMsg(ctx context.Context, conversationID string) ([]*pbConversation.ConversationPinnedMsg, error) {
	x.lock.Lock()
	res, ok := x.cache.Get(conversationID)
	if ok && res.Reliable() {
		msgs := res.resp.Msgs
		x.lock.Unlock()
		return msgs, nil
	}
	resp := x.asyncCall(ctx, conversationID)
	x.lock.Unlock()
	return resp.Result(ctx)
}

func (x *pinnedMsgHandler) SetConversationPinnedMsg(ctx context.Context, conversationID string, seq int64, pinned bool) error {
	msg, err := x.c.db.GetMessageBySeq(ctx, conversationID, seq)
	if err != nil {
		return err
	}
	if msg.ContentType == constant.MsgRevokeNotification || msg.ContentType == constant.DeleteMsgsNotification || len(msg.Content) == 0 {
		return errs.ErrArgs.WrapMsg("msg is not valid")
	}
	req := &pbConversation.SetConversationPinnedMsgReq{
		ConversationID: conversationID,
		UserID:         x.c.loginUserID,
		Seq:            seq,
		Pinned:         pinned,
	}
	resp, err := x.c.setConversationPinnedMsg(ctx, req)
	if err != nil {
		return err
	}
	if resp.Version != 0 {
		x.asyncCallLock(ctx, conversationID)
	}
	return nil
}

func (x *pinnedMsgHandler) Disconnect() {
	x.lock.Lock()
	defer x.lock.Unlock()
	values := x.cache.Values()
	for i := range values {
		values[i].deleted = true
	}
}
