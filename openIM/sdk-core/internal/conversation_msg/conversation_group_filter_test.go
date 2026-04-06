package conversation_msg

import (
	"context"
	"testing"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func TestAddNotLoadedLazyLoadConversationGroups_DoesNotDuplicatePresetFilters(t *testing.T) {
	conv := &Conversation{
		filterConversationGroupNames: []string{
			constant.ConversationGroupFilterNameUnread,
			constant.ConversationGroupFilterNameMarked,
			constant.ConversationGroupFilterNameMentionMe,
			constant.ConversationGroupFilterNameSingleChat,
			constant.ConversationGroupFilterNameGroupChat,
			constant.ConversationGroupFilterNamePinned,
		},
	}

	origin := make([]*model_struct.LocalConversationGroup, 0, len(conv.filterConversationGroupNames))
	for _, groupID := range conv.filterConversationGroupNames {
		origin = append(origin, conv.defaultFilterConversationGroup(groupID))
	}

	groups, err := conv.addNotLoadedLazyLoadConversationGroups(context.Background(), origin)
	if err != nil {
		t.Fatalf("addNotLoadedLazyLoadConversationGroups failed: %v", err)
	}
	if len(groups) != len(conv.filterConversationGroupNames) {
		t.Fatalf("unexpected group count, got=%d want=%d", len(groups), len(conv.filterConversationGroupNames))
	}

	seen := make(map[string]int, len(groups))
	for _, group := range groups {
		if group == nil {
			continue
		}
		seen[group.ConversationGroupID]++
	}
	for _, groupID := range conv.filterConversationGroupNames {
		if seen[groupID] != 1 {
			t.Fatalf("expected preset group %s to appear once, got=%d", groupID, seen[groupID])
		}
	}
}

func TestAddNotLoadedLazyLoadConversationGroups_TreatsSameNamedFilterAsLoaded(t *testing.T) {
	conv := &Conversation{
		filterConversationGroupNames: []string{constant.ConversationGroupFilterNameUnread},
	}
	origin := []*model_struct.LocalConversationGroup{{
		ConversationGroupID:   "server-unread",
		Name:                  "Unread",
		Serial:                99,
		ConversationGroupType: constant.ConversationGroupTypeFilter,
	}}

	groups, err := conv.addNotLoadedLazyLoadConversationGroups(context.Background(), origin)
	if err != nil {
		t.Fatalf("addNotLoadedLazyLoadConversationGroups failed: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("unexpected group count, got=%d want=1", len(groups))
	}
	if groups[0].ConversationGroupID != "server-unread" {
		t.Fatalf("expected existing server filter group to be preserved, got=%q", groups[0].ConversationGroupID)
	}
}
