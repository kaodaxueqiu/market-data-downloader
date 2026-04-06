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
	"encoding/json"
	"errors"
	"sort"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	pbMsg "github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

func (c *Conversation) sendGroupMessageReadReceiptSvr(ctx context.Context, conversationID string, m map[string]string) error {
	req := &pbMsg.MarkGroupMessageReadReq{UserID: c.loginUserID, ConversationID: conversationID, ClientMsgs: m}
	return api.MarkGroupMessageRead.Execute(ctx, req)
}
func (c *Conversation) getGroupMessageReadList(ctx context.Context, conversationID string, clientMsgID string,
	listType int32, pag *sdkws.RequestPagination) (*pbMsg.GetGroupMessageHasReadResp, error) {
	return api.GetGroupMessageHasRead.Invoke(ctx, &pbMsg.GetGroupMessageHasReadReq{
		ConversationID: conversationID,
		ClientMsgID:    clientMsgID,
		Type:           listType,
		Pagination:     pag,
	})
}

func (c *Conversation) getConversationMaxSeqAndSetHasRead(ctx context.Context, conversationID string) error {
	maxSeq, err := c.db.GetConversationNormalMsgSeq(ctx, conversationID)
	if err != nil {
		return err
	}
	if maxSeq == 0 {
		return nil
	}
	return c.setConversationHasReadSeq(ctx, conversationID, maxSeq)
}

// mark a conversation's all message as read
func (c *Conversation) markConversationMessageAsRead(ctx context.Context, conversationID string) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()
	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	if conversation.UnreadCount == 0 {
		log.ZWarn(ctx, "unread count is 0", nil, "conversationID", conversationID)
		return nil
	}
	// get the maximum sequence number of messages in the table that are not sent by oneself
	peerUserMaxSeq, err := c.db.GetConversationPeerNormalMsgSeq(ctx, conversationID)
	if err != nil {
		return err
	}
	// get the maximum sequence number of messages in the table
	maxSeq, err := c.db.GetConversationNormalMsgSeq(ctx, conversationID)
	if err != nil {
		return err
	}
	switch conversation.ConversationType {
	case constant.SingleChatType:
		msgs, err := c.db.GetUnreadMessage(ctx, conversationID)
		if err != nil {
			return err
		}
		log.ZDebug(ctx, "get unread message", "msgs", len(msgs))
		msgIDs, seqs := c.getAsReadMsgMapAndList(ctx, msgs)
		if len(seqs) == 0 {
			log.ZWarn(ctx, "seqs is empty", nil, "conversationID", conversationID)
			if err := c.markConversationAsReadServer(ctx, conversationID, maxSeq, seqs); err != nil {
				return err
			}
		} else {
			log.ZDebug(ctx, "markConversationMessageAsRead", "conversationID", conversationID, "seqs",
				seqs, "peerUserMaxSeq", peerUserMaxSeq, "maxSeq", maxSeq)
			if err := c.markConversationAsReadServer(ctx, conversationID, maxSeq, seqs); err != nil {
				return err
			}
			_, err = c.db.MarkConversationMessageAsReadDB(ctx, conversationID, msgIDs)
			if err != nil {
				log.ZWarn(ctx, "MarkConversationMessageAsRead err", err, "conversationID", conversationID, "msgIDs", msgIDs)
			}
		}
	case constant.ReadGroupChatType, constant.NotificationChatType:
		log.ZDebug(ctx, "markConversationMessageAsRead", "conversationID", conversationID, "peerUserMaxSeq", peerUserMaxSeq, "maxSeq", maxSeq)
		if err := c.markConversationAsReadServer(ctx, conversationID, maxSeq, nil); err != nil {
			return err
		}
	}

	if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"unread_count": 0}); err != nil {
		log.ZError(ctx, "UpdateColumnsConversation err", err, "conversationID", conversationID)
	}
	log.ZDebug(ctx, "update columns sucess")
	c.unreadChangeTrigger(ctx, conversationID, peerUserMaxSeq == maxSeq)
	return nil
}

func (c *Conversation) sendGroupMessageReadReceipt(ctx context.Context, conversationID string,
	clientMsgIDs []string) error {
	localConversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	if localConversation.ConversationType != constant.ReadGroupChatType {
		return sdkerrs.ErrNotSupportType
	}
	msgs, err := c.db.GetMessagesByClientMsgIDs(ctx, conversationID, clientMsgIDs)
	if err != nil {
		return err
	}
	if len(msgs) == 0 {
		return sdkerrs.ErrMsgEmpty
	}
	var newMsgIDs []string
	m := make(map[string]string)
	for _, msg := range msgs {
		if msg.ContentType > constant.NotificationBegin && msg.ContentType < constant.NotificationEnd {
			continue
		}
		if msg.Seq == 0 {
			continue
		}
		if msg.SendID == c.loginUserID {
			continue
		}
		newMsgIDs = append(newMsgIDs, msg.ClientMsgID)
		m[msg.ClientMsgID] = msg.SendID
	}
	log.ZDebug(ctx, "sendGroupMessageReadReceipt", "conversationID", conversationID,
		"newMsgIDs", newMsgIDs, "m", m)

	if _, ok := c.isReadOffConv[conversationID]; ok {
		return nil
	}

	if err := c.sendGroupMessageReadReceiptSvr(ctx, conversationID, m); err != nil {
		if sdkerrs.ErrGroupReadOff.Is(err) {
			c.isReadOffConv[conversationID] = struct{}{}
		}
		return err
	}
	_, err = c.db.MarkConversationMessageAsReadDB(ctx, conversationID, newMsgIDs)
	if err != nil {
		log.ZWarn(ctx, "MarkConversationMessageAsRead err", err, "conversationID", conversationID,
			"msgIDs", clientMsgIDs, "newMsgIDs", newMsgIDs)
	}
	return nil
}

// mark a conversation's message as read by seqs
func (c *Conversation) markMessagesAsReadByMsgID(ctx context.Context, conversationID string, msgIDs []string) error {
	_, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	msgs, err := c.db.GetMessagesByClientMsgIDs(ctx, conversationID, msgIDs)
	if err != nil {
		return err
	}
	if len(msgs) == 0 {
		return nil
	}
	var hasReadSeq = msgs[0].Seq
	maxSeq, err := c.db.GetConversationNormalMsgSeq(ctx, conversationID)
	if err != nil {
		return err
	}
	markAsReadMsgIDs, seqs := c.getAsReadMsgMapAndList(ctx, msgs)
	log.ZDebug(ctx, "msgs len", "markAsReadMsgIDs", len(markAsReadMsgIDs), "seqs", seqs)
	if len(seqs) == 0 {
		log.ZWarn(ctx, "seqs is empty", nil, "conversationID", conversationID)
		return nil
	}
	if err := c.markMsgAsRead2Server(ctx, conversationID, seqs); err != nil {
		return err
	}
	decrCount, err := c.db.MarkConversationMessageAsReadDB(ctx, conversationID, markAsReadMsgIDs)
	if err != nil {
		return err
	}
	if err := c.db.DecrConversationUnreadCount(ctx, conversationID, decrCount); err != nil {
		log.ZError(ctx, "decrConversationUnreadCount err", err, "conversationID", conversationID,
			"decrCount", decrCount)
	}
	c.unreadChangeTrigger(ctx, conversationID, hasReadSeq == maxSeq && msgs[0].SendID != c.loginUserID)
	return nil
}

func (c *Conversation) getAsReadMsgMapAndList(ctx context.Context,
	msgs []*model_struct.LocalChatLog) (asReadMsgIDs []string, seqs []int64) {
	for _, msg := range msgs {
		if !msg.IsRead && msg.SendID != c.loginUserID {
			if msg.Seq == 0 {
				log.ZWarn(ctx, "exception seq", errors.New("exception message "), "msg", msg)
			} else {
				asReadMsgIDs = append(asReadMsgIDs, msg.ClientMsgID)
				seqs = append(seqs, msg.Seq)
			}
		} else {
			log.ZWarn(ctx, "msg can't marked as read", nil, "msg", msg)
		}
	}
	return
}

func (c *Conversation) unreadChangeTrigger(ctx context.Context, conversationID string, latestMsgIsRead bool) {
	if latestMsgIsRead {
		_ = c.OnUpdateConversationLatestMessageState(ctx, conversationID)
	}
	_ = c.OnConversationChanged(ctx, []string{conversationID})
	_ = c.OnTotalUnreadMessageCountChanged(ctx)
}

func (c *Conversation) doUnreadCount(ctx context.Context, conversation *model_struct.LocalConversation, hasReadSeq int64, seqs []int64) error {
	if conversation.ConversationType == constant.SingleChatType {
		if len(seqs) != 0 {
			var hasReadMessage *model_struct.LocalChatLog
			msg, err := c.db.GetMessageBySeq(ctx, conversation.ConversationID, hasReadSeq)
			if err != nil && !errs.ErrRecordNotFound.Is(err) {
				return err
			}
			if err == nil {
				hasReadMessage = msg
			}

			if hasReadMessage != nil && hasReadMessage.IsRead {
				return errs.New("read info from self can be ignored").Wrap()
			}

			if _, err := c.db.MarkConversationMessageAsReadBySeqs(ctx, conversation.ConversationID, seqs); err != nil {
				return err
			}

		} else {
			return errs.New("seqList is empty", "conversationID", conversation.ConversationID, "hasReadSeq", hasReadSeq).Wrap()
		}

		// Only when hasReadSeq is greater than cached hasReadSeq do we recalculate unread count.
		cachedHasReadSeq := c.seqCache.GetHasReadSeq(conversation.ConversationID)
		if hasReadSeq > cachedHasReadSeq {
			currentMaxSeq := c.seqCache.GetMaxSeq(conversation.ConversationID)
			if currentMaxSeq == 0 {
				return errs.New("currentMaxSeq is 0", "conversationID", conversation.ConversationID).Wrap()
			}
			unreadCount := currentMaxSeq - hasReadSeq
			if unreadCount < 0 {
				log.ZWarn(ctx, "unread count is less than 0", nil, "conversationID", conversation.ConversationID, "currentMaxSeq", currentMaxSeq, "hasReadSeq", hasReadSeq)
				unreadCount = 0
			}
			if err := c.db.UpdateColumnsConversation(ctx, conversation.ConversationID, map[string]interface{}{"unread_count": unreadCount}); err != nil {
				return err
			}
			// Only when we accept a newer hasReadSeq do we update the cache.
			c.seqCache.SetHasReadSeq(conversation.ConversationID, hasReadSeq)
		}

		latestMsg := &sdk_struct.MsgStruct{}
		if err := json.Unmarshal([]byte(conversation.LatestMsg), latestMsg); err != nil {
			log.ZError(ctx, "Unmarshal err", err, "conversationID", conversation.ConversationID, "latestMsg", conversation.LatestMsg)
			return err
		}
		isLatestMsgRead := (!latestMsg.IsRead) && datautil.Contain(latestMsg.Seq, seqs...)
		if isLatestMsgRead {
			if err := c.OnUpdateConversationLatestMessageState(ctx, conversation.ConversationID); err != nil {
				return err
			}
		}

		// Trigger conversation changed and total unread changed only when something actually changed.
		if hasReadSeq > cachedHasReadSeq || isLatestMsgRead {
			_ = c.OnConversationChanged(ctx, []string{conversation.ConversationID})
		}
		if hasReadSeq > cachedHasReadSeq {
			_ = c.OnTotalUnreadMessageCountChanged(ctx)
		}
	} else {
		if err := c.db.UpdateColumnsConversation(ctx, conversation.ConversationID, map[string]interface{}{"unread_count": 0}); err != nil {
			log.ZError(ctx, "UpdateColumnsConversation err", err, "conversationID", conversation.ConversationID)
			return err
		}
		// Group/notification conversations always reset unread_count to 0 here,
		// so we trigger a conversation change event and total unread change directly.
		_ = c.OnConversationChanged(ctx, []string{conversation.ConversationID})
		_ = c.OnTotalUnreadMessageCountChanged(ctx)
	}

	return nil
}

func (c *Conversation) doReadDrawing(ctx context.Context, msg *sdkws.MsgData) error {
	tips := &sdkws.MarkAsReadTips{}
	err := utils.UnmarshalNotificationElem(msg.Content, tips)
	if err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}
	log.ZDebug(ctx, "do readDrawing", "tips", tips)
	conversation, err := c.db.GetConversation(ctx, tips.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "GetConversation err", err, "conversationID", tips.ConversationID)
		return err

	}
	if tips.MarkAsReadUserID != c.loginUserID {
		if len(tips.Seqs) == 0 {
			if tips.HasReadSeq > 0 {
				tips.Seqs = []int64{tips.HasReadSeq}
			} else {
				return nil
			}
		}
		messages, err := c.db.GetMessagesBySeqs(ctx, tips.ConversationID, tips.Seqs)
		if err != nil {
			log.ZWarn(ctx, "GetMessagesBySeqs err", err, "conversationID", tips.ConversationID, "seqs", tips.Seqs)
			return err

		}
		if conversation.ConversationType == constant.SingleChatType {
			latestMsg := &sdk_struct.MsgStruct{}
			if err := json.Unmarshal([]byte(conversation.LatestMsg), latestMsg); err != nil {
				log.ZWarn(ctx, "Unmarshal err", err, "conversationID", tips.ConversationID, "latestMsg", conversation.LatestMsg)
				return err
			}
			var successMsgIDs []string
			for _, message := range messages {
				attachInfo := sdk_struct.AttachedInfoElem{}
				_ = utils.JsonStringToStruct(message.AttachedInfo, &attachInfo)
				attachInfo.HasReadTime = msg.SendTime
				message.AttachedInfo = utils.StructToJsonString(attachInfo)
				message.IsRead = true
				if err = c.db.UpdateMessage(ctx, tips.ConversationID, message); err != nil {
					log.ZWarn(ctx, "UpdateMessage err", err, "conversationID", tips.ConversationID, "message", message)
					return err
				} else {
					if latestMsg.ClientMsgID == message.ClientMsgID {
						latestMsg.IsRead = message.IsRead
						conversation.LatestMsg = utils.StructToJsonString(latestMsg)
						_ = c.OnUpsertConversationLatestMessage(ctx, conversation)

					}
					successMsgIDs = append(successMsgIDs, message.ClientMsgID)
				}
			}
			var messageReceiptResp = []*sdk_struct.MessageReceipt{{UserID: tips.MarkAsReadUserID, MsgIDList: successMsgIDs,
				SessionType: conversation.ConversationType, ReadTime: msg.SendTime}}
			c.msgListener().OnRecvC2CReadReceipt(utils.StructToJsonString(messageReceiptResp))
		}
	} else {
		return c.doUnreadCount(ctx, conversation, tips.HasReadSeq, tips.Seqs)
	}
	return nil
}

func (c *Conversation) doResetAsUnreadTips(ctx context.Context, msg *sdkws.MsgData) error {
	tips := &sdkws.ResetAsUnreadTips{}
	err := utils.UnmarshalNotificationElem(msg.Content, tips)
	if err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}
	log.ZDebug(ctx, "do MarkAsUnreadTips", "tips", tips)
	var changed bool
	for conversationID := range tips.Conversations {
		conversation, err := c.db.GetConversation(ctx, conversationID)
		if err != nil {
			log.ZWarn(ctx, "GetConversation err", err, "conversationID", conversationID)
			continue
		}
		dbUnreadCount := conversation.UnreadCount
		unreadCount := int32(tips.Num)
		if unreadCount <= 0 {
			unreadCount = 1
		}
		if dbUnreadCount != unreadCount {
			if err := c.db.UpdateColumnsConversation(ctx, conversation.ConversationID, map[string]interface{}{"unread_count": conversation.UnreadCount}); err != nil {
				return err
			}
			conversation.UnreadCount = unreadCount
			c.notifyConversationChanged(ctx, []*model_struct.LocalConversation{conversation})
			changed = true
		}
	}
	if changed {
		c.OnTotalUnreadMessageCountChanged(ctx)
	}
	return nil
}

func (c *Conversation) doGroupMessageHasRead(ctx context.Context, msg *sdkws.MsgData) error {
	tips := &sdkws.GroupMsgReadTips{}
	err := utils.UnmarshalNotificationElem(msg.Content, tips)
	if err != nil {
		log.ZWarn(ctx, "UnmarshalNotificationElem err", err, "msg", msg)
		return err
	}
	log.ZDebug(ctx, "do readDrawing", "tips", tips)
	// every conversation has msg id list
	messageIDMap := make(map[string][]string)
	messageMap := make(map[string]*sdk_struct.GroupMessageReadInfo)
	for _, read := range tips.Reads {
		if v, ok := messageIDMap[read.ConversationID]; ok {
			messageIDMap[read.ConversationID] = append(v, read.ClientMsgID)
		} else {
			messageIDMap[read.ConversationID] = []string{read.ClientMsgID}
		}
		var readUsers []*sdk_struct.ReaderInfo
		for _, user := range read.Users {
			readUsers = append(readUsers, &sdk_struct.ReaderInfo{UserID: user.UserID, ReadTime: user.ReadTime})
		}
		temp := &sdk_struct.GroupMessageReadInfo{ClientMsgID: read.ClientMsgID,
			HasReadCount: read.ReadNum, UnreadCount: read.UnreadNum, ReadUsers: readUsers}
		messageMap[read.ClientMsgID] = temp

	}
	for conversationID, msgIDs := range messageIDMap {
		lc, err := c.db.GetConversation(ctx, conversationID)
		if err != nil {
			continue
		}
		localMessageList, err := c.db.GetMessagesByClientMsgIDs(ctx, conversationID, msgIDs)
		if err != nil {
			log.ZWarn(ctx, "GetMessagesByClientMsgIDs err", err, "conversationID",
				conversationID, "msgIDs", msgIDs)
			continue
		}
		var messageReceipts []*sdk_struct.GroupMessageReadInfo
		for _, message := range localMessageList {
			if v, ok := messageMap[message.ClientMsgID]; ok {
				userIDs := func(readers []*sdk_struct.ReaderInfo) []string {
					var ids []string
					for _, reader := range readers {
						ids = append(ids, reader.UserID)
					}
					return ids
				}(v.ReadUsers)

				attachInfo := sdk_struct.AttachedInfoElem{}
				_ = utils.JsonStringToStruct(message.AttachedInfo, &attachInfo)
				attachInfo.GroupHasReadInfo.HasReadCount = v.HasReadCount
				attachInfo.GroupHasReadInfo.UnreadCount = v.UnreadCount
				message.AttachedInfo = utils.StructToJsonString(attachInfo)
				if utils.IsContain(c.loginUserID, userIDs) {
					message.IsRead = true
				}
				if err = c.db.UpdateMessage(ctx, conversationID, message); err != nil {
					log.ZError(ctx, "UpdateMessage err", err, "conversationID",
						conversationID, "message", message)
				} else {
					_ = c.OnUpdateConversationLatestMessageAttachInfo(ctx, &common.GroupHasReadMessageInfo{
						ConversationID: conversationID,
						ClientMsgID:    message.ClientMsgID,
						AttacheInfo:    &attachInfo,
					})
					memberInfo, err := c.assemGroupMemberInfo(ctx, v.ReadUsers, lc)
					if err != nil {
						log.ZWarn(ctx, "assemGroupMemberInfo err", err, "conversation", lc,
							"readUsers", v.ReadUsers)
						continue
					}
					temp := &sdk_struct.GroupMessageReadInfo{ClientMsgID: message.ClientMsgID,
						HasReadCount: v.HasReadCount, UnreadCount: v.UnreadCount, ReadMembers: memberInfo}
					messageReceipts = append(messageReceipts, temp)
				}
			}

		}
		if len(messageReceipts) > 0 {
			r := sdk_struct.GroupMessageReceipt{ConversationID: conversationID, GroupMessageReadInfo: messageReceipts}
			c.msgListener().OnRecvGroupReadReceipt(utils.StructToJsonString(r))
		}

	}
	return nil
}
func (c *Conversation) min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func sortByUserID(members []*model_struct.LocalGroupMember) {
	sort.Slice(members, func(i, j int) bool {
		return members[i].UserID < members[j].UserID
	})
}
func (c *Conversation) getGroupMessageReaderList(ctx context.Context, conversationID string, clientMsgID string,
	filter, offset, count int32) ([]*model_struct.LocalGroupMember, error) {
	lc, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	message, err := c.db.GetMessage(ctx, conversationID, clientMsgID)
	if err != nil {
		return nil, err
	}
	var attachedInfo sdk_struct.AttachedInfoElem
	_ = utils.JsonStringToStruct(message.AttachedInfo, &attachedInfo)
	page := sdkws.RequestPagination{
		PageNumber: offset/count + 1,
		ShowNumber: count,
	}
	switch filter {
	case constant.GroupMessageReadList:
		if attachedInfo.GroupHasReadInfo.HasReadCount == 0 {
			return nil, nil
		}
		if int(offset+count) > len(attachedInfo.GroupHasReadInfo.HasReadUserList) {
			resp, err := c.getGroupMessageReadList(ctx, conversationID, clientMsgID, filter, &page)
			if err != nil {
				log.ZWarn(ctx, "getGroupMessageReadList err", err, "conversationID", conversationID, "clientMsgID", clientMsgID)
				return c.assemGroupMemberInfo(ctx, attachedInfo.GroupHasReadInfo.HasReadUserList, lc)
			}
			var serverHasReadUserList []*sdk_struct.ReaderInfo
			for _, i2 := range resp.Reads {
				serverHasReadUserList = append(serverHasReadUserList, &sdk_struct.ReaderInfo{UserID: i2.UserID,
					ReadTime: i2.ReadTime})
			}
			if len(attachedInfo.GroupHasReadInfo.HasReadUserList) < constant.MaxHasReadNum {
				//It means that the incremental data that can be stored has been retrieved from the server.
				if offset < constant.MaxHasReadNum {
					addUser := serverHasReadUserList[0:c.min(constant.MaxHasReadNum-
						len(attachedInfo.GroupHasReadInfo.HasReadUserList), len(serverHasReadUserList))]
					attachedInfo.GroupHasReadInfo.HasReadUserList =
						append(attachedInfo.GroupHasReadInfo.HasReadUserList, addUser...)
					message.AttachedInfo = utils.StructToJsonString(attachedInfo)
					err = c.db.UpdateMessage(ctx, lc.ConversationID, message)
					if err != nil {
						log.ZWarn(ctx, "update message err", err)
					}
				}

			}
			return c.assemGroupMemberInfo(ctx, serverHasReadUserList, lc)

		} else {
			usersInfo := attachedInfo.GroupHasReadInfo.HasReadUserList[offset : offset+count]
			return c.assemGroupMemberInfo(ctx, usersInfo, lc)

		}
	case constant.GroupMessageUnreadList:
		if attachedInfo.GroupHasReadInfo.HasReadCount == 0 {
			memberInfo, err := c.db.GetGroupMemberListSplit(ctx, lc.GroupID, constant.GroupFilterNotSelf, int(offset), int(count))
			if err != nil {
				return nil, err
			}
			sortByUserID(memberInfo)
			return memberInfo, nil
		}
		resp, err := c.getGroupMessageReadList(ctx, conversationID, clientMsgID, filter, &page)
		if err != nil {
			log.ZWarn(ctx, "getGroupMessageReadList err", err, "conversationID", conversationID, "clientMsgID", clientMsgID)
			return nil, err
		}
		var serverHasReadUserList []*sdk_struct.ReaderInfo
		for _, i2 := range resp.Reads {
			serverHasReadUserList = append(serverHasReadUserList, &sdk_struct.ReaderInfo{UserID: i2.UserID,
				ReadTime: i2.ReadTime})
		}
		return c.assemGroupMemberInfo(ctx, serverHasReadUserList, lc)

	}
	return nil, nil

}

func (c *Conversation) assemGroupMemberInfo(ctx context.Context, usersInfo []*sdk_struct.ReaderInfo,
	lc *model_struct.LocalConversation) (result []*model_struct.LocalGroupMember, err error) {
	userIDs := func(readers []*sdk_struct.ReaderInfo) []string {
		var ids []string
		for _, reader := range readers {
			ids = append(ids, reader.UserID)
		}
		return ids
	}(usersInfo)
	if len(userIDs) == 0 {
		return nil, nil
	}
	groupMemberList, err := c.db.GetGroupSomeMemberInfo(ctx, lc.GroupID, userIDs)
	if err != nil {
		return nil, err
	}
	groupMemberInfoMap := datautil.SliceToMap(groupMemberList, func(e *model_struct.LocalGroupMember) string {
		return e.UserID
	})
	notGroupMemberIDs := datautil.SliceSubAny(userIDs, groupMemberList, func(e *model_struct.LocalGroupMember) string {
		return e.UserID
	})
	if len(notGroupMemberIDs) > 0 {
		notUsers, err := c.user.GetUsersInfoWithCache(ctx, notGroupMemberIDs)
		if err != nil {
			log.ZWarn(ctx, "user info not found", err, "notGroupMembers", notGroupMemberIDs)
		}

		for _, user := range notUsers {
			gm := model_struct.LocalGroupMember{}
			gm.UserID = user.UserID
			gm.FaceURL = user.FaceURL
			gm.Nickname = user.Nickname
			groupMemberInfoMap[user.UserID] = &gm
		}
	}
	for _, info := range usersInfo {
		if v, ok := groupMemberInfoMap[info.UserID]; ok {
			result = append(result, v)
		} else {
			result = append(result, &model_struct.LocalGroupMember{UserID: info.UserID})
		}

	}
	return result, nil
}
func (c *Conversation) groupMessageHasReadInfo(ctx context.Context, conversationID string,
	list *sdk_struct.NewMsgList, isReverse bool, viewType int) {
	lc, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		log.ZWarn(ctx, "get conversation err", err)
		return
	}
	err = c.conversationHotColdManager.Promote(ctx, conversationID)
	if err != nil {
		log.ZWarn(ctx, "promote err", err)
	}
	var thisEndSeq int64
	if isReverse {
		thisEndSeq, _ = c.messagePullReverseEndSeqMap.Load(conversationID, viewType)
	} else {
		thisEndSeq, _ = c.messagePullForwardEndSeqMap.Load(conversationID, viewType)
	}
	var msgIDs []string
	if lc.ConversationType == constant.ReadGroupChatType {
		exist := c.existPullMinSeq(lc.ConversationID)
		if exist && (thisEndSeq >= c.getPullMinSeq(lc.ConversationID)) {
			log.ZDebug(ctx, "has pull in cache", "thisEndSeq", thisEndSeq, "getPullMinSeq",
				c.getPullMinSeq(lc.ConversationID))
			return
		}
		for _, chatLog := range *list {
			if chatLog.ContentType > constant.NotificationBegin && chatLog.ContentType < constant.NotificationEnd {
				continue
			}
			if chatLog.Seq == 0 {
				continue
			}
			msgIDs = append(msgIDs, chatLog.ClientMsgID)
		}
		if len(msgIDs) == 0 {
			return
		}
		apiReq := pbMsg.GetGroupMessageReadNumReq{UserID: c.loginUserID, ConversationID: lc.ConversationID,
			ClientMsgIDs: msgIDs}
		apiResp, err := api.GetGroupMessageReadNum.Invoke(ctx, &apiReq)
		if err != nil {
			log.ZWarn(ctx, "get group message read num err", err)
			return
		}
		var messageReceipts []*sdk_struct.GroupMessageReadInfo
		for _, msgStruct := range *list {
			if v, ok := apiResp.Num[msgStruct.ClientMsgID]; ok && (v.ReadNum >
				msgStruct.AttachedInfoElem.GroupHasReadInfo.HasReadCount ||
				(v.UnreadNum < msgStruct.AttachedInfoElem.GroupHasReadInfo.UnreadCount && v.UnreadNum != 0)) {
				temp := &sdk_struct.GroupMessageReadInfo{ClientMsgID: msgStruct.ClientMsgID,
					HasReadCount: v.ReadNum, UnreadCount: v.UnreadNum}
				msgStruct.AttachedInfoElem.GroupHasReadInfo.HasReadCount = v.ReadNum
				msgStruct.AttachedInfoElem.GroupHasReadInfo.UnreadCount = v.UnreadNum
				localMessage := converter.MsgStructToLocalChatLog(msgStruct)
				err = c.db.UpdateMessage(ctx, lc.ConversationID, localMessage)
				if err != nil {
					log.ZWarn(ctx, "update message err", err)
					continue
				}
				messageReceipts = append(messageReceipts, temp)

			}
		}
		if len(messageReceipts) > 0 {
			r := sdk_struct.GroupMessageReceipt{ConversationID: lc.ConversationID, GroupMessageReadInfo: messageReceipts}
			c.msgListener().OnRecvGroupReadReceipt(utils.StructToJsonString(r))
		}
		c.setPullMinSeq(lc.ConversationID, thisEndSeq)
	}

}
