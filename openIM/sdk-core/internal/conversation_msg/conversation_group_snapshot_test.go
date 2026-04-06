package conversation_msg

import (
	"context"
	"testing"

	sdkconstant "github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	dbpkg "github.com/openimsdk/openim-sdk-core/v3/pkg/db"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func TestGetLocalConversationGroup_FilterCacheMissUsesDBMetadata(t *testing.T) {
	ctx := context.Background()
	db, err := dbpkg.NewDataBase(ctx, "group-cache-user", t.TempDir(), 0)
	if err != nil {
		t.Fatalf("NewDataBase failed: %v", err)
	}
	defer func() {
		_ = db.Close(ctx)
	}()

	groupID := sdkconstant.ConversationGroupFilterNameUnread
	if err := db.UpsertConversationGroupsDB(ctx, []*model_struct.LocalConversationGroup{{
		ConversationGroupID:   groupID,
		Name:                  "custom unread",
		Serial:                77,
		Version:               9,
		Ex:                    "{\"source\":\"db\"}",
		ConversationGroupType: sdkconstant.ConversationGroupTypeFilter,
		Hidden:                true,
	}}); err != nil {
		t.Fatalf("UpsertConversationGroupsDB failed: %v", err)
	}

	conv := &Conversation{
		db:                           db,
		filterConversationGroupNames: []string{groupID},
	}

	group, err := conv.getLocalConversationGroup(ctx, groupID)
	if err != nil {
		t.Fatalf("getLocalConversationGroup failed: %v", err)
	}
	if group == nil {
		t.Fatal("expected group, got nil")
	}
	if group.Name != "custom unread" {
		t.Fatalf("expected db name, got %q", group.Name)
	}
	if group.Serial != 77 {
		t.Fatalf("expected db serial, got %d", group.Serial)
	}
	if !group.Hidden {
		t.Fatalf("expected hidden=true from db metadata")
	}
	if group.Ex != "{\"source\":\"db\"}" {
		t.Fatalf("expected db ex, got %q", group.Ex)
	}

	cached, ok := conv.cachedConversationGroup(groupID)
	if !ok || cached == nil {
		t.Fatal("expected group metadata to be written back into cache")
	}
	if cached.Name != "custom unread" || cached.Serial != 77 || !cached.Hidden {
		t.Fatalf("unexpected cached group metadata: %+v", cached)
	}
}

func TestGetConversationIDsByGroupID_FilterCacheMissSeedsDefaultCache(t *testing.T) {
	groupID := sdkconstant.ConversationGroupFilterNameUnread
	conv := &Conversation{
		filterConversationGroupNames: []string{groupID},
		conversationGroupCache: conversationGroupCacheState{
			changeItems: map[string]conversationGroupChangeCacheItem{
				"c1": {UnreadCount: 3},
				"c2": {UnreadCount: 0},
			},
		},
	}

	conversationIDs, err := conv.getConversationIDsByGroupID(context.Background(), groupID)
	if err != nil {
		t.Fatalf("getConversationIDsByGroupID failed: %v", err)
	}
	if len(conversationIDs) != 1 || conversationIDs[0] != "c1" {
		t.Fatalf("unexpected conversationIDs, got=%v want=[c1]", conversationIDs)
	}

	cached, ok := conv.cachedConversationGroup(groupID)
	if !ok || cached == nil {
		t.Fatal("expected default filter metadata to be cached after miss")
	}
	if cached.Name != "Unread" {
		t.Fatalf("expected default filter name, got %q", cached.Name)
	}
	if cached.ConversationGroupType != sdkconstant.ConversationGroupTypeFilter {
		t.Fatalf("expected filter group type, got %d", cached.ConversationGroupType)
	}
	if cached.UnreadCount != 3 {
		t.Fatalf("expected cached unread count to be recomputed, got %d", cached.UnreadCount)
	}
	if len(cached.ConversationIDs) != 1 || cached.ConversationIDs[0] != "c1" {
		t.Fatalf("unexpected cached conversationIDs, got=%v want=[c1]", cached.ConversationIDs)
	}
}
