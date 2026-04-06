package conversation_msg

import (
	"reflect"
	"sort"
	"testing"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	pbConversation "github.com/openimsdk/protocol/conversation"
)

func TestConversationCalculateDiff_PartialSync(t *testing.T) {
	conv := &Conversation{}
	localGroups := map[string]*model_struct.LocalConversationGroup{
		"group-keep": {
			ConversationGroupID:   "group-keep",
			Name:                  "keep",
			Serial:                1,
			Version:               10,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
		},
		"group-update": {
			ConversationGroupID:   "group-update",
			Name:                  "before-update",
			Serial:                2,
			Version:               11,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
		},
		"group-member-only": {
			ConversationGroupID:   "group-member-only",
			Name:                  "member-only",
			Serial:                3,
			Version:               12,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
		},
	}
	localMembers := map[string][]string{
		"group-keep":        {"c1"},
		"group-update":      {"c1", "c2"},
		"group-member-only": {"c3", "c4"},
	}
	serverGroups := []*pbConversation.ConversationGroup{
		{
			ConversationGroupID:   "group-keep",
			Name:                  "keep",
			Order:                 1,
			Version:               10,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
			ConversationIDs:       []string{"c1"},
		},
		{
			ConversationGroupID:   "group-update",
			Name:                  "after-update",
			Order:                 2,
			Version:               13,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                true,
			ConversationIDs:       []string{"c2", "c5"},
		},
		{
			ConversationGroupID:   "group-member-only",
			Name:                  "member-only",
			Order:                 3,
			Version:               12,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
			ConversationIDs:       []string{"c4", "c6"},
		},
		{
			ConversationGroupID:   "group-added",
			Name:                  "added",
			Order:                 4,
			Version:               1,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
			ConversationIDs:       []string{"c7", "c8"},
		},
		{
			ConversationGroupID:   "group-added-empty",
			Name:                  "added-empty",
			Order:                 5,
			Version:               1,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			Hidden:                false,
		},
	}

	addedGroup, deletedGroup, updatedGroup, addedMembers, deletedMembers := conv.calculateDiff(localGroups, localMembers, serverGroups, false)

	assertConversationGroupIDs(t, addedGroup, []string{"group-added", "group-added-empty"})
	assertConversationGroupIDs(t, deletedGroup, nil)
	assertConversationGroupIDs(t, updatedGroup, []string{"group-update"})

	updatedByID := conversationGroupsByID(updatedGroup)
	if updatedByID["group-update"].Name != "after-update" {
		t.Fatalf("expected updated group name to be propagated, got %q", updatedByID["group-update"].Name)
	}
	if !updatedByID["group-update"].Hidden {
		t.Fatalf("expected updated group hidden flag to be propagated")
	}

	assertStringSliceMapEqual(t, addedMembers, map[string][]string{
		"group-added":       {"c7", "c8"},
		"group-member-only": {"c6"},
		"group-update":      {"c5"},
	})
	assertStringSliceMapEqual(t, deletedMembers, map[string][]string{
		"group-member-only": {"c3"},
		"group-update":      {"c1"},
	})
}

func TestConversationCalculateDiff_FullSyncDeleteAndFilterBoundary(t *testing.T) {
	conv := &Conversation{}
	localGroups := map[string]*model_struct.LocalConversationGroup{
		"group-keep": {
			ConversationGroupID:   "group-keep",
			Name:                  "keep",
			Serial:                1,
			Version:               10,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
		},
		"group-delete": {
			ConversationGroupID:   "group-delete",
			Name:                  "delete",
			Serial:                2,
			Version:               11,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
		},
		"group-filter": {
			ConversationGroupID:   "group-filter",
			Name:                  "filter",
			Serial:                3,
			Version:               12,
			ConversationGroupType: constant.ConversationGroupTypeFilter,
		},
		"": {
			ConversationGroupID:   "",
			ConversationGroupType: constant.ConversationGroupTypeNormal,
		},
		"group-nil": nil,
	}
	localMembers := map[string][]string{
		"group-keep":   {"c1"},
		"group-delete": {"c2", "c3"},
		"group-filter": {"c4"},
		"":             {"cx"},
		"group-nil":    {"cy"},
	}
	serverGroups := []*pbConversation.ConversationGroup{
		nil,
		{
			ConversationGroupID:   "",
			Name:                  "ignored-empty-id",
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			ConversationIDs:       []string{"ignored"},
		},
		{
			ConversationGroupID:   "group-keep",
			Name:                  "keep",
			Order:                 1,
			Version:               10,
			ConversationGroupType: constant.ConversationGroupTypeNormal,
			ConversationIDs:       []string{"c1"},
		},
	}

	addedGroup, deletedGroup, updatedGroup, addedMembers, deletedMembers := conv.calculateDiff(localGroups, localMembers, serverGroups, true)

	assertConversationGroupIDs(t, addedGroup, nil)
	assertConversationGroupIDs(t, updatedGroup, nil)
	assertConversationGroupIDs(t, deletedGroup, []string{"group-delete"})
	assertStringSliceMapEqual(t, addedMembers, nil)
	assertStringSliceMapEqual(t, deletedMembers, map[string][]string{
		"group-delete": {"c2", "c3"},
	})
}

func assertConversationGroupIDs(t *testing.T, groups []*model_struct.LocalConversationGroup, want []string) {
	t.Helper()
	got := make([]string, 0, len(groups))
	for _, group := range groups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		got = append(got, group.ConversationGroupID)
	}
	sort.Strings(got)
	want = append([]string{}, want...)
	sort.Strings(want)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected conversation group ids, got=%v want=%v", got, want)
	}
}

func conversationGroupsByID(groups []*model_struct.LocalConversationGroup) map[string]*model_struct.LocalConversationGroup {
	result := make(map[string]*model_struct.LocalConversationGroup, len(groups))
	for _, group := range groups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		result[group.ConversationGroupID] = group
	}
	return result
}

func assertStringSliceMapEqual(t *testing.T, got, want map[string][]string) {
	t.Helper()
	gotNormalized := normalizeStringSliceMap(got)
	wantNormalized := normalizeStringSliceMap(want)
	if !reflect.DeepEqual(gotNormalized, wantNormalized) {
		t.Fatalf("unexpected string slice map, got=%v want=%v", gotNormalized, wantNormalized)
	}
}

func normalizeStringSliceMap(input map[string][]string) map[string][]string {
	if len(input) == 0 {
		return map[string][]string{}
	}
	result := make(map[string][]string, len(input))
	for key, values := range input {
		if key == "" {
			continue
		}
		copied := append([]string(nil), values...)
		sort.Strings(copied)
		result[key] = copied
	}
	return result
}
