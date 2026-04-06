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

	"github.com/openimsdk/openim-sdk-core/v3/pkg/datasyncer"
)

func (c *Conversation) IncrSyncConversations(ctx context.Context) error {
	return c.incrSyncConversations(ctx, false)
}

func (c *Conversation) IncrSyncConversationsWithoutEvent(ctx context.Context) error {
	return c.incrSyncConversations(ctx, true)
}

func (c *Conversation) incrSyncConversations(ctx context.Context, disableEvent bool) error {
	backend := datasyncer.NewConversationBackend(c.loginUserID, c.db, &conversationEvent{conversation: c}, c)
	return datasyncer.SyncIncremental(ctx, backend, new(datasyncer.SyncOptions).SetDeleteLocal(false).SetDisableEvent(disableEvent))
}

func (c *Conversation) IncrSyncConversationsWithLock(ctx context.Context) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()
	return c.IncrSyncConversations(ctx)
}

// ColdConversationSync is a ColdConversationHandler implementation.
// It performs a best-effort server sync for the provided conversation IDs and upserts them locally.
func (c *Conversation) ColdConversationSync(ctx context.Context, conversationIDs []string) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()
	backend := datasyncer.NewConversationBackend(c.loginUserID, c.db, &conversationEvent{conversation: c}, c)

	return backend.SyncConversationsByIDsWithHash(ctx, conversationIDs)
}
