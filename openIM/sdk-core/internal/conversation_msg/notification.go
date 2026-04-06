// Copyright © 2023 OpenIM SDK. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package conversation_msg

import (
	"context"
	"fmt"
	"reflect"
	"runtime"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/network"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	constant2 "github.com/openimsdk/protocol/constant"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
)

const (
	syncWait = iota
	asyncNoWait
	asyncWait
)

// InitSyncProgress is initialize Sync when reinstall.
const InitSyncProgress = 10

func (c *Conversation) Work(c2v common.Cmd2Value) {
	log.ZDebug(c2v.Ctx, "NotificationCmd start", "caller", c2v.Caller, "cmd", c2v.Cmd, "value", c2v.Value)
	defer log.ZDebug(c2v.Ctx, "NotificationCmd end", "caller", c2v.Caller, "cmd", c2v.Cmd, "value", c2v.Value)
	switch c2v.Cmd {
	case constant.CmdNewMsgCome:
		c.doMsgNew(c2v)
	case constant.CmdNotification:
		c.doNotificationManager(c2v)
	case constant.CmdSyncData:
		c.syncData(c2v)
	case constant.CmdSyncFlag:
		c.syncFlag(c2v)
	case constant.CmdMsgSyncInReinstall:
		c.doMsgSyncByReinstalled(c2v)
	}
}

func (c *Conversation) syncFlag(c2v common.Cmd2Value) {
	ctx := c2v.Ctx
	syncFlag := c2v.Value.(sdk_struct.CmdNewMsgComeToConversation).SyncFlag
	seqs := c2v.Value.(sdk_struct.CmdNewMsgComeToConversation).Seqs
	switch syncFlag {
	case constant.AppDataSyncBegin, constant.LargeDataSyncBegin:
		c.ConversationListener().OnSyncServerStart(true)

	case constant.AppDataSyncData, constant.LargeDataSyncData:
		log.ZDebug(ctx, "AppDataSyncBegin")
		c.seqs = seqs
		c.startTime = time.Now()
		c.ConversationListener().OnSyncServerProgress(1)
		asyncWaitFunctions := []func(c context.Context) error{
			c.group.IncrSyncJoinGroupWithoutEvent,
			c.relation.IncrSyncFriendsWithoutEvent,
		}
		runSyncFunctions(ctx, asyncWaitFunctions, asyncWait)
		c.addInitProgress(InitSyncProgress * 4 / 10)              // add 40% of InitSyncProgress as progress
		c.ConversationListener().OnSyncServerProgress(c.progress) // notify server current Progress

		syncWaitFunctions := []func(c context.Context) error{
			c.IncrSyncConversationsWithoutEvent,
			c.SyncAllConUnreadAndCreateNewConWithoutTrigger,
			c.SyncConversationGroupsWithOutEvent,
		}
		runSyncFunctions(ctx, syncWaitFunctions, syncWait)
		log.ZWarn(ctx, "core data sync over", nil, "cost time", time.Since(c.startTime).String())
		c.addInitProgress(InitSyncProgress * 6 / 10)              // add 60% of InitSyncProgress as progress
		c.ConversationListener().OnSyncServerProgress(c.progress) // notify server current Progress

		asyncNoWaitFunctions := []func(c context.Context) error{
			c.user.SyncLoginUserInfoWithoutNotice,
			c.relation.SyncAllBlackListWithoutNotice,
		}
		runSyncFunctions(ctx, asyncNoWaitFunctions, asyncNoWait)

	case constant.AppDataSyncEnd, constant.LargeDataSyncEnd:
		log.ZDebug(ctx, "AppDataSyncEnd", "time", time.Since(c.startTime).String())
		c.progress = 100
		c.ConversationListener().OnSyncServerProgress(c.progress)
		c.ConversationListener().OnSyncServerFinish(true)
		totalUnreadCount, err := c.db.GetTotalUnreadMsgCountNewerDB(ctx)
		if err != nil {
			log.ZWarn(ctx, "GetTotalUnreadMsgCountDB err", err)
		} else {
			c.ConversationListener().OnTotalUnreadMessageCountChanged(totalUnreadCount)
		}
	case constant.MsgSyncData:
		c.seqs = seqs
		log.ZDebug(ctx, "MsgSyncBegin")
		c.syncData(c2v)

	case constant.MsgSyncBegin:
		c.ConversationListener().OnSyncServerStart(false)

	case constant.MsgSyncFailed:
		c.ConversationListener().OnSyncServerFailed(false)
	case constant.MsgSyncEnd:
		log.ZDebug(ctx, "MsgSyncEnd", "time", time.Since(c.startTime).String())
		c.ConversationListener().OnSyncServerFinish(false)
	}
}

func (c *Conversation) doNotificationManager(c2v common.Cmd2Value) {
	ctx := c2v.Ctx
	allMsg := c2v.Value.(sdk_struct.CmdNewMsgComeToConversation).Msgs

	for conversationID, msgs := range allMsg {
		log.ZDebug(ctx, "notification handling", "conversationID", conversationID, "msgs", msgs)

		// First, process all the notifications
		for _, msg := range msgs.Msgs {
			if msg.ContentType > constant.FriendNotificationBegin && msg.ContentType < constant.FriendNotificationEnd {
				_ = common.DispatchRelationNotification(ctx, msg, c.relationCh)
			} else if msg.ContentType > constant.UserNotificationBegin && msg.ContentType < constant.UserNotificationEnd {
				_ = common.DispatchUserNotification(ctx, msg, c.userCh)
			} else if msg.ContentType > constant.GroupNotificationBegin && msg.ContentType < constant.GroupNotificationEnd {
				_ = common.DispatchGroupNotification(ctx, msg, c.groupCh)
			} else if msg.ContentType > constant.SignalingNotificationBegin && msg.ContentType < constant.SignalingNotificationEnd {
				c.signaling.DoNotification(ctx, msg)
			} else {
				c.DoNotification(ctx, msg)
			}
		}

		// After all notifications are processed, update the sequence number
		if len(msgs.Msgs) != 0 {
			lastMsg := msgs.Msgs[len(msgs.Msgs)-1]
			log.ZDebug(ctx, "SetNotificationSeq", "conversationID", conversationID, "seq", lastMsg.Seq)
			if lastMsg.Seq != 0 {
				if err := c.db.SetNotificationSeq(ctx, conversationID, lastMsg.Seq); err != nil {
					// Log an error if setting the sequence number fails
					log.ZError(ctx, "SetNotificationSeq err", err, "conversationID", conversationID, "lastMsg", lastMsg)
				}
			}
		}
	}
}

func (c *Conversation) DoNotification(ctx context.Context, msg *sdkws.MsgData) {
	if err := c.doNotification(ctx, msg); err != nil {
		log.ZWarn(ctx, "DoConversationNotification failed", err)
	}
}

func (c *Conversation) doNotification(ctx context.Context, msg *sdkws.MsgData) error {
	switch msg.ContentType {
	case constant.ConversationChangeNotification:
		return c.DoConversationChangedNotification(ctx, msg)
	case constant.ConversationPrivateChatNotification: // 1701
		return c.DoConversationIsPrivateChangedNotification(ctx, msg)
	case constant.ConversationGroupChangedNotification: // 1704
		return c.DoConversationGroupChangedNotification(ctx, msg)
	case constant.BusinessNotification:
		return c.doBusinessNotification(ctx, msg)
	case constant.RevokeNotification: // 2101
		return c.doRevokeMsg(ctx, msg)
	case constant.ClearConversationNotification: // 1703
		return c.doClearConversations(ctx, msg)
	case constant.DeleteMsgsNotification:
		return c.doDeleteMsgs(ctx, msg)
	case constant.ModifyMessageNotification:
		return c.doModifyMessage(ctx, msg)
	case constant.DeleteUserAllMessagesInConvNotification:
		return c.doDeleteUserAllMessagesInConv(ctx, msg)
	case constant.HasReadReceipt: // 2200
		return c.doReadDrawing(ctx, msg)
	case constant2.HasResetUnreadReceipt:
		return c.doResetAsUnreadTips(ctx, msg)
	case constant.HasGroupReadReceipt:
		return c.doGroupMessageHasRead(ctx, msg)
	case constant.StreamMsgNotification:
		return c.doStreamMsgNotification(ctx, msg)
	case constant.MsgPinned:
		return c.doConversationPinnedMsg(ctx, msg)
	}
	return errs.New("unknown tips type", "contentType", msg.ContentType).Wrap()
}

func (c *Conversation) syncData(c2v common.Cmd2Value) {
	c.pinnedMsgHandler.Disconnect()

	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()

	ctx := c2v.Ctx
	c.startTime = time.Now()
	network.CloseIdleHttpConnections()
	c.clearAllPullMinSeq()
	c.group.Reset()

	// Synchronous sync functions
	syncFuncs := []func(c context.Context) error{
		c.SyncAllConUnreadAndCreateNewCon,
	}

	runSyncFunctions(ctx, syncFuncs, syncWait)

	// Asynchronous sync functions
	asyncFuncs := []func(c context.Context) error{
		c.user.SyncLoginUserInfo,
		c.relation.SyncAllBlackList,
		c.group.SyncAllJoinedGroupsWithLock,
		c.relation.IncrSyncFriendsWithLock,
		c.IncrSyncConversationsWithLock,
		c.SyncConversationGroups,
	}
	runSyncFunctions(ctx, asyncFuncs, asyncNoWait)
}

func runSyncFunctions(ctx context.Context, funcs []func(c context.Context) error, mode int) {
	var wg sync.WaitGroup

	for _, fn := range funcs {
		switch mode {
		case asyncWait:
			wg.Add(1)
			go executeSyncFunction(ctx, fn, &wg)
		case asyncNoWait:
			go executeSyncFunction(ctx, fn, nil)
		case syncWait:
			executeSyncFunction(ctx, fn, nil)
		}
	}

	if mode == asyncWait {
		wg.Wait()
	}
}

func executeSyncFunction(ctx context.Context, fn func(c context.Context) error, wg *sync.WaitGroup) {
	if wg != nil {
		defer wg.Done()
	}

	funcName := runtime.FuncForPC(reflect.ValueOf(fn).Pointer()).Name()
	startTime := time.Now()
	err := fn(ctx)
	duration := time.Since(startTime)
	if err != nil {
		log.ZWarn(ctx, fmt.Sprintf("%s sync error", funcName), err, "duration", duration.String())
	} else {
		log.ZDebug(ctx, fmt.Sprintf("%s completed successfully", funcName), "duration", duration.String())
	}
}

func (c *Conversation) DoConversationChangedNotification(ctx context.Context, msg *sdkws.MsgData) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()

	//var notification sdkws.ConversationChangedNotification
	tips := &sdkws.ConversationUpdateTips{}
	if err := utils.UnmarshalNotificationElem(msg.Content, tips); err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}

	err := c.IncrSyncConversations(ctx)
	if err != nil {
		log.ZWarn(ctx, "IncrSyncConversations err", err)
		return err
	}
	return nil
}

func (c *Conversation) DoConversationIsPrivateChangedNotification(ctx context.Context, msg *sdkws.MsgData) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()

	tips := &sdkws.ConversationSetPrivateTips{}
	if err := utils.UnmarshalNotificationElem(msg.Content, tips); err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}

	err := c.IncrSyncConversations(ctx)
	if err != nil {
		log.ZWarn(ctx, "IncrSyncConversations err", err)
		return err
	}
	return nil
}

func (c *Conversation) DoConversationGroupChangedNotification(ctx context.Context, msg *sdkws.MsgData) error {
	tips := &sdkws.ConversationGroupChangeTips{}
	if err := utils.UnmarshalNotificationElem(msg.Content, tips); err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}
	//if err := c.applyConversationGroupChanges(ctx, tips.Groups); err != nil {
	//	log.ZWarn(ctx, "applyConversationGroupChanges err", err)
	//	return err
	//}
	c.triggerConversationGroupSync(ctx)
	return nil
}

func (c *Conversation) doBusinessNotification(ctx context.Context, msg *sdkws.MsgData) error {
	var n sdk_struct.NotificationElem
	err := utils.JsonStringToStruct(string(msg.Content), &n)
	if err != nil {
		log.ZError(ctx, "unmarshal failed", err, "msg", msg)
		return err

	}
	c.businessListener().OnRecvCustomBusinessMessage(n.Detail)
	return nil
}
