//go:build !js
// +build !js

package db

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func newBenchDB(b *testing.B) *DataBase {
	b.Helper()

	dir := b.TempDir()
	userID := "bench_user"

	db, err := NewDataBase(context.Background(), userID, dir, 0)
	if err != nil {
		b.Fatalf("NewDataBase failed: %v", err)
	}
	b.Cleanup(func() {
		_ = db.Close(context.Background())
		_ = os.RemoveAll(dir)
	})
	return db
}

func benchConversationIDs(n int) []string {
	ids := make([]string, 0, n)
	for i := 0; i < n; i++ {
		ids = append(ids, fmt.Sprintf("conv_%03d", i))
	}
	return ids
}

func legacyBatchInsertMessageMap(ctx context.Context, db *DataBase, insertMsg map[string][]*model_struct.LocalChatLog) error {
	for conversationID, messages := range insertMsg {
		if len(messages) == 0 {
			continue
		}
		if err := db.BatchInsertMessageList(ctx, conversationID, messages); err != nil {
			return err
		}
	}
	return nil
}

func BenchmarkBatchInsertMessageMap_50Conversations_1MsgEach(b *testing.B) {
	ctx := context.Background()
	db := newBenchDB(b)

	conversationIDs := benchConversationIDs(50)
	for _, conversationID := range conversationIDs {
		if err := db.initChatLog(ctx, conversationID); err != nil {
			b.Fatalf("initChatLog failed: %v", err)
		}
	}

	b.Run("legacy_per_table", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			insertMsg := make(map[string][]*model_struct.LocalChatLog, len(conversationIDs))
			for _, conversationID := range conversationIDs {
				insertMsg[conversationID] = []*model_struct.LocalChatLog{
					{
						ClientMsgID: fmt.Sprintf("%s_%d", conversationID, i),
						SendID:      "user_a",
						RecvID:      "user_b",
						SessionType: constant.SingleChatType,
						ContentType: constant.Text,
						Content:     "hello",
						SendTime:    time.Now().UnixMilli(),
						CreateTime:  time.Now().UnixMilli(),
					},
				}
			}
			b.StartTimer()

			if err := legacyBatchInsertMessageMap(ctx, db, insertMsg); err != nil {
				b.Fatalf("legacyBatchInsertMessageMap failed: %v", err)
			}
		}
	})

	b.Run("optimized_single_tx", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			insertMsg := make(map[string][]*model_struct.LocalChatLog, len(conversationIDs))
			for _, conversationID := range conversationIDs {
				insertMsg[conversationID] = []*model_struct.LocalChatLog{
					{
						ClientMsgID: fmt.Sprintf("%s_%d_opt", conversationID, i),
						SendID:      "user_a",
						RecvID:      "user_b",
						SessionType: constant.SingleChatType,
						ContentType: constant.Text,
						Content:     "hello",
						SendTime:    time.Now().UnixMilli(),
						CreateTime:  time.Now().UnixMilli(),
					},
				}
			}
			b.StartTimer()

			if err := db.BatchInsertMessageMap(ctx, insertMsg); err != nil {
				b.Fatalf("BatchInsertMessageMap failed: %v", err)
			}
		}
	})
}

func legacyBatchUpdateConversationList(ctx context.Context, db *DataBase, conversationList []*model_struct.LocalConversation) error {
	for _, v := range conversationList {
		if v == nil {
			continue
		}
		if err := db.UpdateConversation(ctx, v); err != nil {
			return err
		}
	}
	return nil
}

func BenchmarkBatchUpdateConversationList_50Rows(b *testing.B) {
	ctx := context.Background()
	db := newBenchDB(b)

	conversationIDs := benchConversationIDs(50)
	conversations := make([]*model_struct.LocalConversation, 0, len(conversationIDs))
	for _, conversationID := range conversationIDs {
		conversations = append(conversations, &model_struct.LocalConversation{
			ConversationID:    conversationID,
			ConversationType:  constant.SingleChatType,
			UserID:            "user_b",
			ShowName:          "user_b",
			LatestMsg:         `{"content":"init"}`,
			LatestMsgSendTime: 1,
		})
	}
	if err := db.BatchInsertConversationList(ctx, conversations); err != nil {
		b.Fatalf("BatchInsertConversationList failed: %v", err)
	}

	updateList := make([]*model_struct.LocalConversation, 0, len(conversations))
	for _, c := range conversations {
		updateList = append(updateList, &model_struct.LocalConversation{
			ConversationID:        c.ConversationID,
			LatestMsg:             `{"content":"update"}`,
			LatestMsgSendTime:     2,
			UnreadCount:           1,
			UpdateUnreadCountTime: 2,
		})
	}

	b.Run("legacy_loop_UpdateConversation", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			now := time.Now().UnixMilli()
			for _, v := range updateList {
				v.LatestMsgSendTime = now + int64(i)
				v.UpdateUnreadCountTime = now + int64(i)
				v.UnreadCount = int32(i % 5)
			}
			b.StartTimer()

			if err := legacyBatchUpdateConversationList(ctx, db, updateList); err != nil {
				b.Fatalf("legacyBatchUpdateConversationList failed: %v", err)
			}
		}
	})

	b.Run("optimized_single_tx", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			now := time.Now().UnixMilli()
			for _, v := range updateList {
				v.LatestMsgSendTime = now + int64(i)
				v.UpdateUnreadCountTime = now + int64(i)
				v.UnreadCount = int32(i % 5)
			}
			b.StartTimer()

			if err := db.BatchUpdateConversationList(ctx, updateList); err != nil {
				b.Fatalf("BatchUpdateConversationList failed: %v", err)
			}
		}
	})
}
