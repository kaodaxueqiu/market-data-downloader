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
	"errors"

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

// Delete the local and server
func (c *Conversation) clearConversationFromLocalAndServer(ctx context.Context, conversationID string, f func(ctx context.Context, conversationID string) error) error {
	_, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}

	// Use conversationID to remove conversations and messages from the server first
	err = c.clearConversationMsgFromServer(ctx, conversationID)
	if err != nil {
		if errors.Is(errs.Unwrap(err), errs.ErrRecordNotFound) {
			log.ZWarn(ctx, "clearConversationMsgFromServer err", err, "conversationID", conversationID)
		} else {
			return err
		}
	}

	if err := c.clearConversationAndDeleteAllMsg(ctx, conversationID, false, f); err != nil {
		return err
	}

	_ = c.OnConversationChanged(ctx, []string{conversationID})
	_ = c.OnTotalUnreadMessageCountChanged(ctx)

	return nil
}

func (c *Conversation) clearConversationAndDeleteAllMsg(ctx context.Context, conversationID string, markDelete bool, f func(ctx context.Context, conversationID string) error) error {
	err := c.getConversationMaxSeqAndSetHasRead(ctx, conversationID)
	if err != nil {
		return err
	}
	if markDelete {
		err = c.db.MarkDeleteConversationAllMessages(ctx, conversationID)
	} else {
		err = c.db.DeleteConversationAllMessages(ctx, conversationID)
	}
	if err != nil {
		return err
	}
	log.ZDebug(ctx, "reset conversation", "conversationID", conversationID)
	err = f(ctx, conversationID)
	if err != nil {
		return err
	}
	return nil
}

// Delete all messages
func (c *Conversation) deleteAllMsgFromLocalAndServer(ctx context.Context) error {
	// Delete the server first (high error rate), then delete it.
	err := c.deleteAllMessageFromServer(ctx)
	if err != nil {
		return err
	}
	err = c.deleteAllMsgFromLocal(ctx, false)
	if err != nil {
		return err
	}
	_ = c.OnTotalUnreadMessageCountChanged(ctx)

	return nil
}

// Delete all messages from the local
func (c *Conversation) deleteAllMsgFromLocal(ctx context.Context, markDelete bool) error {
	conversations, err := c.db.GetAllConversationListDB(ctx)
	if err != nil {
		return err
	}
	var successCids []string
	log.ZDebug(ctx, "deleteAllMsgFromLocal", "conversations", conversations, "markDelete", markDelete)
	for _, v := range conversations {
		if err := c.clearConversationAndDeleteAllMsg(ctx, v.ConversationID, markDelete, c.db.ClearConversation); err != nil {
			log.ZError(ctx, "clearConversation err", err, "conversationID", v.ConversationID)
			continue
		}
		successCids = append(successCids, v.ConversationID)
	}

	_ = c.OnConversationChanged(ctx, successCids)
	_ = c.OnTotalUnreadMessageCountChanged(ctx)
	return nil

}

// Delete a message from the local
func (c *Conversation) deleteMessage(ctx context.Context, conversationID string, clientMsgID string, opt *pbMsg.DeleteSyncOpt) error {
	_, err := c.db.GetMessage(ctx, conversationID, clientMsgID)
	if err != nil {
		return err
	}
	localMessage, err := c.db.GetMessage(ctx, conversationID, clientMsgID)
	if err != nil {
		return err
	}
	if localMessage.Seq == 0 || localMessage.Status == constant.MsgStatusSendFailed {
		log.ZInfo(ctx, "delete msg seq is 0 or status is send failed, try again", "msg", localMessage)
		return c.deleteMessageFromLocal(ctx, conversationID, clientMsgID)
	}
	err = c.deleteMessagesFromServer(ctx, conversationID, []int64{localMessage.Seq}, nil, opt)
	if err != nil {
		return err
	}

	return c.deleteMessageFromLocal(ctx, conversationID, clientMsgID)
}

// Delete messages from the local
func (c *Conversation) deleteMessages(ctx context.Context, conversationID string, clientMsgIDs []string, isSync bool) error {
	msgs, err := c.db.GetMessagesByClientMsgIDs(ctx, conversationID, clientMsgIDs)
	if err != nil {
		return err
	}
	if len(msgs) == 0 {
		return sdkerrs.ErrMsgEmpty
	}

	var (
		validSeqs     []int64
		otherSeqs     []int64
		localOnlyMsgs []*model_struct.LocalChatLog
		remoteMsgs    []*model_struct.LocalChatLog
	)

	for _, msg := range msgs {
		if msg.Status == constant.MsgStatusSendFailed || msg.Seq == 0 {
			localOnlyMsgs = append(localOnlyMsgs, msg)
		} else {
			remoteMsgs = append(remoteMsgs, msg)
		}
	}
	if len(localOnlyMsgs) > 0 {
		log.ZInfo(ctx, "delete local only msgs", "clientMsgIDs", localOnlyMsgs)
		msgIDs := datautil.Slice(localOnlyMsgs, func(m *model_struct.LocalChatLog) string { return m.ClientMsgID })
		if err := c.deleteMessagesFromLocal(ctx, conversationID, msgIDs); err != nil {
			return err
		}
	}
	if len(remoteMsgs) == 0 {
		return nil
	}
	for _, msg := range remoteMsgs {
		if isSync {
			if msg.SendID == c.loginUserID {
				validSeqs = append(validSeqs, msg.Seq)
			} else {
				otherSeqs = append(otherSeqs, msg.Seq)
			}
		} else {
			validSeqs = append(validSeqs, msg.Seq)
		}
	}

	err = c.deleteMessagesFromServer(ctx, conversationID, validSeqs, otherSeqs, &pbMsg.DeleteSyncOpt{IsSyncOther: isSync})
	if err != nil {
		return err
	}
	msgIDs := datautil.Slice(remoteMsgs, func(m *model_struct.LocalChatLog) string { return m.ClientMsgID })

	return c.deleteMessagesFromLocal(ctx, conversationID, msgIDs)
}

func (c *Conversation) deleteMessagesFromLocal(ctx context.Context, conversationID string, clientMsgIDs []string) error {
	if _, err := c.db.DeleteMessagesByClientMsgIDs(ctx, conversationID, clientMsgIDs); err != nil {
		return err
	}

	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}

	var latestMsg sdk_struct.MsgStruct
	// Convert the latest message in the conversation table.
	utils.JsonStringToStruct(conversation.LatestMsg, &latestMsg)

	if datautil.Contain(latestMsg.ClientMsgID, clientMsgIDs...) {
		log.ZDebug(ctx, "latestMsg deleted", "seq", latestMsg.Seq, "clientMsgID", latestMsg.ClientMsgID)
		msg, err := c.db.GetLatestActiveMessage(ctx, conversationID, false)
		if err != nil {
			return err
		}

		latestMsgSendTime := latestMsg.SendTime
		latestMsgStr := ""
		if len(msg) > 0 {
			latestMsg = *converter.LocalChatLogToMsgStruct(msg[0])

			latestMsgStr = utils.StructToJsonString(latestMsg)
			latestMsgSendTime = latestMsg.SendTime
		}
		if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg": latestMsgStr, "latest_msg_send_time": latestMsgSendTime}); err != nil {
			return err
		}
		_ = c.OnConversationChanged(ctx, []string{conversationID})

	}
	//c.msgListener().OnMsgDeleted(utils.StructToJsonString(s))
	return nil
}

// Delete messages from local
func (c *Conversation) deleteMessageFromLocal(ctx context.Context, conversationID string, clientMsgID string) error {
	s, err := c.db.GetMessage(ctx, conversationID, clientMsgID)
	if err != nil {
		return err
	}

	if err := c.db.UpdateColumnsMessage(ctx, conversationID, clientMsgID, map[string]interface{}{"status": constant.MsgStatusHasDeleted}); err != nil {
		return err
	}

	if !s.IsRead && s.SendID != c.loginUserID {
		if err := c.db.DecrConversationUnreadCount(ctx, conversationID, 1); err != nil {
			return err
		}
		_ = c.OnConversationChanged(ctx, []string{conversationID})
		_ = c.OnTotalUnreadMessageCountChanged(ctx)
	}

	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}

	var latestMsg sdk_struct.MsgStruct
	// Convert the latest message in the conversation table.
	utils.JsonStringToStruct(conversation.LatestMsg, &latestMsg)

	if latestMsg.ClientMsgID == clientMsgID {
		log.ZDebug(ctx, "latestMsg deleted", "seq", latestMsg.Seq, "clientMsgID", latestMsg.ClientMsgID)
		msg, err := c.db.GetLatestActiveMessage(ctx, conversationID, false)
		if err != nil {
			return err
		}

		latestMsgSendTime := latestMsg.SendTime
		latestMsgStr := ""
		if len(msg) > 0 {
			latestMsg = *converter.LocalChatLogToMsgStruct(msg[0])

			latestMsgStr = utils.StructToJsonString(latestMsg)
			latestMsgSendTime = latestMsg.SendTime
		}
		if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg": latestMsgStr, "latest_msg_send_time": latestMsgSendTime}); err != nil {
			return err
		}
		_ = c.OnConversationChanged(ctx, []string{conversationID})
	}

	messageList := c.LocalChatLog2MsgStruct([]*model_struct.LocalChatLog{s})
	if len(messageList) < 1 {
		return errs.New("LocalChatLog2MsgStruct failed").Wrap()
	}
	c.msgListener().OnMsgDeleted(utils.StructToJsonString(messageList[0]))
	return nil
}

func (c *Conversation) deleteUserAllMessagesFromLocal(ctx context.Context, conversationID, userID string, msgs []*model_struct.LocalChatLog) error {
	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}

	var isUpdateConv bool
	for _, m := range msgs {
		if err := c.db.UpdateColumnsMessage(ctx, conversationID, m.ClientMsgID, map[string]interface{}{"status": constant.MsgStatusHasDeleted}); err != nil {
			return err
		}

		if !m.IsRead && m.SendID != c.loginUserID {
			if err := c.db.DecrConversationUnreadCount(ctx, conversationID, 1); err != nil {
				return err
			}
			isUpdateConv = true
		}

		var latestMsg sdk_struct.MsgStruct
		// Convert the latest message in the conversation table.
		_ = utils.JsonStringToStruct(conversation.LatestMsg, &latestMsg)

		if latestMsg.ClientMsgID == m.ClientMsgID {
			log.ZDebug(ctx, "latestMsg deleted", "seq", latestMsg.Seq, "clientMsgID", latestMsg.ClientMsgID)
			msg, err := c.db.GetLatestActiveMessage(ctx, conversationID, false)
			if err != nil {
				return err
			}

			latestMsgSendTime := latestMsg.SendTime
			latestMsgStr := ""
			if len(msg) > 0 {
				latestMsg = *converter.LocalChatLogToMsgStruct(msg[0])
				latestMsgStr = utils.StructToJsonString(latestMsg)
				latestMsgSendTime = latestMsg.SendTime
			}
			if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg": latestMsgStr, "latest_msg_send_time": latestMsgSendTime}); err != nil {
				return err
			}
			_ = c.OnConversationChanged(ctx, []string{conversationID})
		}
	}
	if isUpdateConv {
		_ = c.OnConversationChanged(ctx, []string{conversationID})
		_ = c.OnTotalUnreadMessageCountChanged(ctx)
	}

	m := sdk_struct.DeleteUserAllMsgsListenerMsg{
		ConversationID: conversationID,
		UserID:         userID,
	}

	c.msgListener().OnDeleteUserAllMsgsInConv(utils.StructToJsonString(m))
	return nil
}

func (c *Conversation) doDeleteMsgs(ctx context.Context, msg *sdkws.MsgData) error {
	tips := sdkws.DeleteMsgsTips{}
	utils.UnmarshalNotificationElem(msg.Content, &tips)
	log.ZDebug(ctx, "doDeleteMsgs", "seqs", tips.Seqs)
	for _, v := range tips.Seqs {
		msg, err := c.db.GetMessageBySeq(ctx, tips.ConversationID, v)
		if err != nil {
			log.ZWarn(ctx, "GetMessageBySeq err", err, "conversationID", tips.ConversationID, "seq", v)
			continue
		}
		if err := c.deleteMessageFromLocal(ctx, tips.ConversationID, msg.ClientMsgID); err != nil {
			log.ZWarn(ctx, "deleteMessageFromLocal err", err, "conversationID", tips.ConversationID, "seq", v)
			return err
		}
	}
	return nil
}

func (c *Conversation) doModifyMessage(ctx context.Context, msg *sdkws.MsgData) error {
	var oldModifiedCount int64
	tips := sdkws.ModifyMsgTips{}
	utils.UnmarshalNotificationElem(msg.Content, &tips)
	log.ZDebug(ctx, "doModifyMessage", "tips", tips)

	message, err := c.db.GetMessageBySeq(ctx, tips.ConversationID, tips.Seq)
	if err != nil {
		log.ZWarn(ctx, "GetMessageBySeq err", err, "conversationID", tips.ConversationID, "seq", tips.Seq)
		return nil
	}
	var attachedInfo sdk_struct.AttachedInfoElem
	err = utils.JsonStringToStruct(message.AttachedInfo, &attachedInfo)
	if err != nil {
		log.ZWarn(context.Background(), "JsonStringToStruct error", err, "localMessage.AttachedInfo", message.AttachedInfo)
	}
	if attachedInfo.LastModified != nil {
		oldModifiedCount = attachedInfo.LastModified.ModifiedCount
	} else {
		attachedInfo.LastModified = &sdk_struct.LastModified{}
	}
	if tips.ModifiedCount >= oldModifiedCount {
		attachedInfo.LastModified.ModifiedTime = tips.ModifiedTime
		attachedInfo.LastModified.UserID = tips.UserID
		attachedInfo.LastModified.ModifiedCount = tips.ModifiedCount
		message.AttachedInfo = utils.StructToJsonString(attachedInfo)
		message.Content = tips.NewContent

		if err := c.db.UpdateMessage(ctx, tips.ConversationID, message); err != nil {
			log.ZError(ctx, "UpdateMessageBySeq failed", err, "tips", &tips)
			return errs.Wrap(err)
		}
		_ = c.OnUpdateConversationLatestMessageContent(ctx, &common.ModifyMessageInfo{
			ConversationID: tips.ConversationID,
			ClientMsgID:    message.ClientMsgID,
			NewMessage:     converter.LocalChatLogToMsgStruct(message),
		})
		c.msgListener().OnMessageModified(utils.StructToJsonString(converter.LocalChatLogToMsgStruct(message)))
		c.pinnedMsgHandler.onMsgModified(ctx, tips.ConversationID, tips.Seq)
	} else {
		log.ZDebug(ctx, "Expired notification doModifyMessage", "tips.ModifiedTime", tips.ModifiedTime, "oldModifiedCount", oldModifiedCount)
	}
	return nil
}

func (c *Conversation) doDeleteUserAllMessagesInConv(ctx context.Context, msg *sdkws.MsgData) error {
	tips := sdkws.DeleteUserAllMessagesInConvTips{}
	_ = utils.UnmarshalNotificationElem(msg.Content, &tips)
	log.ZDebug(ctx, "doDeleteUserAllMessagesInConv")
	msgs, err := c.db.GetMessageByUserID(ctx, tips.ConversationID, tips.UserID)
	if err != nil {
		return err
	}

	if err = c.deleteUserAllMessagesFromLocal(ctx, tips.ConversationID, tips.UserID, msgs); err != nil {
		return err
	}
	return nil
}

func (c *Conversation) doClearConversations(ctx context.Context, msg *sdkws.MsgData) error {
	tips := &sdkws.ClearConversationTips{}
	err := utils.UnmarshalNotificationElem(msg.Content, tips)
	if err != nil {
		return err
	}

	log.ZDebug(ctx, "doClearConversations", "tips", tips)
	for _, v := range tips.ConversationIDs {
		if err := c.clearConversationAndDeleteAllMsg(ctx, v, false, c.db.ClearConversation); err != nil {
			log.ZWarn(ctx, "clearConversation err", err, "conversationID", v)
			return err
		}
	}
	_ = c.OnConversationChanged(ctx, tips.ConversationIDs)
	_ = c.OnTotalUnreadMessageCountChanged(ctx)
	return nil
}

func (c *Conversation) deleteUserAllMessagesInConv(ctx context.Context, conversationID string, userID string) error {
	err := c.deleteUserAllMessageInConvFromServer(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	return nil
}
