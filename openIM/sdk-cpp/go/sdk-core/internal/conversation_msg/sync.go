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
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/utils/datautil"

	"github.com/openimsdk/tools/log"
)

func (c *Conversation) SyncAllConUnreadAndCreateNewCon(ctx context.Context) error {
	startTime := time.Now()
	log.ZDebug(ctx, "start SyncAllConUnreadAndCreateNewCon")

	seqs := c.seqs

	if len(seqs) == 0 {
		return nil
	}
	var conversationChangedIDs []string
	var conversationIDsNeedSync []string

	stepStartTime := time.Now()
	conversationsOnLocal, err := c.db.GetAllConversations(ctx)
	if err != nil {
		log.ZWarn(ctx, "get all conversations err", err)
		return err
	}
	log.ZDebug(ctx, "GetAllConversations completed", "duration", time.Since(stepStartTime).String())

	conversationsOnLocalMap := datautil.SliceToMap(conversationsOnLocal, func(e *model_struct.LocalConversation) string {
		return e.ConversationID
	})

	stepStartTime = time.Now()
	for conversationID, v := range seqs {
		var unreadCount int64
		c.seqCache.SetSeq(conversationID, v.MaxSeq, v.HasReadSeq)

		unreadCount = v.MaxSeq - v.HasReadSeq - v.SubtractUnread
		if unreadCount < 0 {
			unreadCount = 0
			log.ZWarn(ctx, "unread count calculated to be less than 0", nil,
				"conversationID", conversationID,
				"maxSeq", v.MaxSeq,
				"hasReadSeq", v.HasReadSeq,
				"subtractUnread", v.SubtractUnread,
			)
		}
		if conversation, ok := conversationsOnLocalMap[conversationID]; ok {
			if conversation.UnreadCount != int32(unreadCount) {
				if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"unread_count": unreadCount}); err != nil {
					log.ZWarn(ctx, "UpdateColumnsConversation err", err, "conversationID", conversationID)
					continue
				}
				conversationChangedIDs = append(conversationChangedIDs, conversationID)
			}
		} else {
			conversationIDsNeedSync = append(conversationIDsNeedSync, conversationID)
		}
	}
	log.ZDebug(ctx, "Process seqs completed", "duration", time.Since(stepStartTime).String())

	if len(conversationIDsNeedSync) > 0 {
		stepStartTime = time.Now()
		r, err := c.getConversationsByIDsFromServer(ctx, conversationIDsNeedSync)
		if err != nil {
			log.ZWarn(ctx, "getServerConversationsByIDs err", err, "conversationIDs", conversationIDsNeedSync)
			return err
		}
		log.ZDebug(ctx, "getServerConversationsByIDs completed", "duration", time.Since(stepStartTime).String())
		conversationsOnServer := datautil.Batch(converter.ServerConversationToLocal, r.Conversations)
		stepStartTime = time.Now()
		if err := c.batchAddFaceURLAndName(ctx, conversationsOnServer...); err != nil {
			log.ZWarn(ctx, "batchAddFaceURLAndName err", err, "conversationsOnServer", conversationsOnServer)
			return err
		}
		log.ZDebug(ctx, "batchAddFaceURLAndName completed", "duration", time.Since(stepStartTime).String())

		for _, conversation := range conversationsOnServer {
			var unreadCount int32
			v, ok := seqs[conversation.ConversationID]
			if !ok {
				continue
			}
			if v.MaxSeq-v.HasReadSeq < 0 {
				unreadCount = 0
				log.ZWarn(ctx, "unread count is less than 0", nil, "server seq", v, "conversation", conversation)
			} else {
				unreadCount = int32(v.MaxSeq - v.HasReadSeq)
			}
			conversation.UnreadCount = unreadCount
		}

		stepStartTime = time.Now()
		err = c.db.BatchInsertConversationList(ctx, conversationsOnServer)
		if err != nil {
			log.ZWarn(ctx, "BatchInsertConversationList err", err, "conversationsOnServer", conversationsOnServer)
		}
		log.ZDebug(ctx, "BatchInsertConversationList completed", "duration", time.Since(stepStartTime).String())
	}

	log.ZDebug(ctx, "update conversations", "conversations", conversationChangedIDs)
	if len(conversationChangedIDs) > 0 {
		stepStartTime = time.Now()
		_ = c.OnConversationChanged(ctx, conversationChangedIDs)
		_ = c.OnTotalUnreadMessageCountChanged(ctx)
		log.ZDebug(ctx, "DispatchUpdateConversation completed", "duration", time.Since(stepStartTime).String())
	}

	log.ZDebug(ctx, "SyncAllConversationHashReadSeqs completed", "totalDuration", time.Since(startTime).String())
	// seqs is only valid for this sync cycle; clear it to avoid using stale
	// server state in subsequent syncs (which could restore cleared unread counts).
	c.seqs = nil
	return nil
}

func (c *Conversation) SyncAllConUnreadAndCreateNewConWithoutTrigger(ctx context.Context) error {
	startTime := time.Now()
	log.ZDebug(ctx, "start SyncAllConUnreadAndCreateNewCon")

	seqs := c.seqs

	if len(seqs) == 0 {
		return nil
	}
	var conversationChangedIDs []string
	var conversationIDsNeedSync []string

	stepStartTime := time.Now()
	conversationsOnLocal, err := c.db.GetAllConversations(ctx)
	if err != nil {
		log.ZWarn(ctx, "get all conversations err", err)
		return err
	}
	log.ZDebug(ctx, "GetAllConversations completed", "duration", time.Since(stepStartTime).String())

	conversationsOnLocalMap := datautil.SliceToMap(conversationsOnLocal, func(e *model_struct.LocalConversation) string {
		return e.ConversationID
	})

	stepStartTime = time.Now()
	for conversationID, v := range seqs {
		var unreadCount int64
		c.seqCache.SetSeq(conversationID, v.MaxSeq, v.HasReadSeq)

		unreadCount = v.MaxSeq - v.HasReadSeq - v.SubtractUnread
		if unreadCount < 0 {
			unreadCount = 0
			log.ZWarn(ctx, "unread count calculated to be less than 0", nil,
				"conversationID", conversationID,
				"maxSeq", v.MaxSeq,
				"hasReadSeq", v.HasReadSeq,
				"subtractUnread", v.SubtractUnread,
			)
		}
		if conversation, ok := conversationsOnLocalMap[conversationID]; ok {
			if conversation.UnreadCount != int32(unreadCount) {
				if err := c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"unread_count": unreadCount}); err != nil {
					log.ZWarn(ctx, "UpdateColumnsConversation err", err, "conversationID", conversationID)
					continue
				}
				conversationChangedIDs = append(conversationChangedIDs, conversationID)
			}
		} else {
			conversationIDsNeedSync = append(conversationIDsNeedSync, conversationID)
		}
	}
	log.ZDebug(ctx, "Process seqs completed", "duration", time.Since(stepStartTime).String())

	if len(conversationIDsNeedSync) > 0 {
		stepStartTime = time.Now()
		r, err := c.getConversationsByIDsFromServer(ctx, conversationIDsNeedSync)
		if err != nil {
			log.ZWarn(ctx, "getServerConversationsByIDs err", err, "conversationIDs", conversationIDsNeedSync)
			return err
		}
		log.ZDebug(ctx, "getServerConversationsByIDs completed", "duration", time.Since(stepStartTime).String())
		conversationsOnServer := datautil.Batch(converter.ServerConversationToLocal, r.Conversations)
		stepStartTime = time.Now()
		if err := c.batchAddFaceURLAndName(ctx, conversationsOnServer...); err != nil {
			log.ZWarn(ctx, "batchAddFaceURLAndName err", err, "conversationsOnServer", conversationsOnServer)
			return err
		}
		log.ZDebug(ctx, "batchAddFaceURLAndName completed", "duration", time.Since(stepStartTime).String())

		for _, conversation := range conversationsOnServer {
			var unreadCount int32
			v, ok := seqs[conversation.ConversationID]
			if !ok {
				continue
			}
			if v.MaxSeq-v.HasReadSeq < 0 {
				unreadCount = 0
				log.ZWarn(ctx, "unread count is less than 0", nil, "server seq", v, "conversation", conversation)
			} else {
				unreadCount = int32(v.MaxSeq - v.HasReadSeq)
			}
			conversation.UnreadCount = unreadCount
		}

		stepStartTime = time.Now()
		err = c.db.BatchInsertConversationList(ctx, conversationsOnServer)
		if err != nil {
			log.ZWarn(ctx, "BatchInsertConversationList err", err, "conversationsOnServer", conversationsOnServer)
		}
		log.ZDebug(ctx, "BatchInsertConversationList completed", "duration", time.Since(stepStartTime).String())
	}

	log.ZDebug(ctx, "update conversations", "conversations", conversationChangedIDs)

	log.ZDebug(ctx, "SyncAllConversationHashReadSeqs completed", "totalDuration", time.Since(startTime).String())
	// Clear seqs after using them once to prevent subsequent syncs from
	// recalculating unread counts based on outdated server snapshots.
	c.seqs = nil
	return nil
}
