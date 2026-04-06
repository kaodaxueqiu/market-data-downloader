package test

import (
	"encoding/json"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdk_params_callback"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/wrapperspb"
	"github.com/openimsdk/tools/mcontext"
)

type conversationGroupCallbackEventType string

const (
	conversationGroupCallbackAdded         conversationGroupCallbackEventType = "added"
	conversationGroupCallbackChanged       conversationGroupCallbackEventType = "changed"
	conversationGroupCallbackDeleted       conversationGroupCallbackEventType = "deleted"
	conversationGroupCallbackMemberAdded   conversationGroupCallbackEventType = "member_added"
	conversationGroupCallbackMemberDeleted conversationGroupCallbackEventType = "member_deleted"
)

type conversationGroupCallbackEvent struct {
	eventType conversationGroupCallbackEventType
	groupID   string
	at        time.Time
}

type conversationChangedEvent struct {
	conversationID string
	unreadCount    int32
	isPinned       bool
	at             time.Time
}

type conversationGroupInjectedTimingEvent struct {
	conversationIDs []string
	startedAt       time.Time
	finishedAt      time.Time
	duration        time.Duration
	usedFallback    bool
	buildPlan       time.Duration
	loadGroups      time.Duration
	groupChangedCB  time.Duration
	memberChangedCB time.Duration
	fallback        time.Duration
	changedGroups   int
	memberAdded     int
	memberDeleted   int
}

type measuringConversationListener struct {
	next    open_im_sdk_callback.OnConversationListener
	eventCh chan conversationChangedEvent
}

func newMeasuringConversationListener(next open_im_sdk_callback.OnConversationListener) *measuringConversationListener {
	return &measuringConversationListener{
		next:    next,
		eventCh: make(chan conversationChangedEvent, 256),
	}
}

func (l *measuringConversationListener) OnSyncServerStart(reinstalled bool) {
	if l.next != nil {
		l.next.OnSyncServerStart(reinstalled)
	}
}

func (l *measuringConversationListener) OnSyncServerFinish(reinstalled bool) {
	if l.next != nil {
		l.next.OnSyncServerFinish(reinstalled)
	}
}

func (l *measuringConversationListener) OnSyncServerProgress(progress int) {
	if l.next != nil {
		l.next.OnSyncServerProgress(progress)
	}
}

func (l *measuringConversationListener) OnSyncServerFailed(reinstalled bool) {
	if l.next != nil {
		l.next.OnSyncServerFailed(reinstalled)
	}
}

func (l *measuringConversationListener) OnNewConversation(conversationList string) {
	if l.next != nil {
		l.next.OnNewConversation(conversationList)
	}
}

func (l *measuringConversationListener) OnConversationChanged(conversationList string) {
	now := time.Now()
	var conversations []*model_struct.LocalConversation
	if err := json.Unmarshal([]byte(conversationList), &conversations); err == nil {
		for _, conversation := range conversations {
			if conversation == nil || conversation.ConversationID == "" {
				continue
			}
			l.eventCh <- conversationChangedEvent{
				conversationID: conversation.ConversationID,
				unreadCount:    conversation.UnreadCount,
				isPinned:       conversation.IsPinned,
				at:             now,
			}
		}
	}
	if l.next != nil {
		l.next.OnConversationChanged(conversationList)
	}
}

func (l *measuringConversationListener) OnTotalUnreadMessageCountChanged(totalUnreadCount int32) {
	if l.next != nil {
		l.next.OnTotalUnreadMessageCountChanged(totalUnreadCount)
	}
}

func (l *measuringConversationListener) OnConversationUserInputStatusChanged(change string) {
	if l.next != nil {
		l.next.OnConversationUserInputStatusChanged(change)
	}
}

type measuringConversationGroupListener struct {
	next    open_im_sdk_callback.OnConversationGroupListener
	eventCh chan conversationGroupCallbackEvent
}

func newMeasuringConversationGroupListener(next open_im_sdk_callback.OnConversationGroupListener) *measuringConversationGroupListener {
	return &measuringConversationGroupListener{
		next:    next,
		eventCh: make(chan conversationGroupCallbackEvent, 128),
	}
}

func (l *measuringConversationGroupListener) emit(eventType conversationGroupCallbackEventType, groupID string) {
	if groupID == "" {
		return
	}
	l.eventCh <- conversationGroupCallbackEvent{
		eventType: eventType,
		groupID:   groupID,
		at:        time.Now(),
	}
}

func (l *measuringConversationGroupListener) emitGroupList(eventType conversationGroupCallbackEventType, payload string) {
	var groups []*model_struct.LocalConversationGroup
	if err := json.Unmarshal([]byte(payload), &groups); err != nil {
		return
	}
	for _, group := range groups {
		if group == nil {
			continue
		}
		l.emit(eventType, group.ConversationGroupID)
	}
}

func (l *measuringConversationGroupListener) OnConversationGroupAdded(conversationGroupList string) {
	l.emitGroupList(conversationGroupCallbackAdded, conversationGroupList)
	if l.next != nil {
		l.next.OnConversationGroupAdded(conversationGroupList)
	}
}

func (l *measuringConversationGroupListener) OnConversationGroupDeleted(conversationGroupList string) {
	l.emitGroupList(conversationGroupCallbackDeleted, conversationGroupList)
	if l.next != nil {
		l.next.OnConversationGroupDeleted(conversationGroupList)
	}
}

func (l *measuringConversationGroupListener) OnConversationGroupChanged(conversationGroupList string) {
	l.emitGroupList(conversationGroupCallbackChanged, conversationGroupList)
	if l.next != nil {
		l.next.OnConversationGroupChanged(conversationGroupList)
	}
}

func (l *measuringConversationGroupListener) OnConversationGroupMemberAdded(change string) {
	var payload sdk_params_callback.ConversationGroupMemberChangedCallback
	if err := json.Unmarshal([]byte(change), &payload); err == nil && payload.Group != nil {
		l.emit(conversationGroupCallbackMemberAdded, payload.Group.ConversationGroupID)
	}
	if l.next != nil {
		l.next.OnConversationGroupMemberAdded(change)
	}
}

func (l *measuringConversationGroupListener) OnConversationGroupMemberDeleted(change string) {
	var payload sdk_params_callback.ConversationGroupMemberChangedCallback
	if err := json.Unmarshal([]byte(change), &payload); err == nil && payload.Group != nil {
		l.emit(conversationGroupCallbackMemberDeleted, payload.Group.ConversationGroupID)
	}
	if l.next != nil {
		l.next.OnConversationGroupMemberDeleted(change)
	}
}

type noopConversationGroupListener struct{}

func (noopConversationGroupListener) OnConversationGroupAdded(string)         {}
func (noopConversationGroupListener) OnConversationGroupDeleted(string)       {}
func (noopConversationGroupListener) OnConversationGroupChanged(string)       {}
func (noopConversationGroupListener) OnConversationGroupMemberAdded(string)   {}
func (noopConversationGroupListener) OnConversationGroupMemberDeleted(string) {}

func newConversationGroupInjectedTimingObserver(eventCh chan<- conversationGroupInjectedTimingEvent) func(open_im_sdk.ConversationGroupInjectedTiming) {
	return func(timing open_im_sdk.ConversationGroupInjectedTiming) {
		eventCh <- conversationGroupInjectedTimingEvent{
			conversationIDs: append([]string(nil), timing.ConversationIDs...),
			startedAt:       timing.StartedAt,
			finishedAt:      timing.FinishedAt,
			duration:        timing.Duration,
			usedFallback:    timing.UsedFallback,
			buildPlan:       timing.BuildPlan,
			loadGroups:      timing.LoadGroups,
			groupChangedCB:  timing.GroupChangedCB,
			memberChangedCB: timing.MemberChangedCB,
			fallback:        timing.Fallback,
			changedGroups:   timing.ChangedGroups,
			memberAdded:     timing.MemberAdded,
			memberDeleted:   timing.MemberDeleted,
		}
	}
}

func getConversationByIDForTest(t *testing.T, conversationID string) *model_struct.LocalConversation {
	t.Helper()
	conversations, err := open_im_sdk.IMUserContext.Conversation().GetMultipleConversation(ctx, []string{conversationID})
	if err != nil {
		t.Fatalf("GetMultipleConversation failed: %v", err)
	}
	for _, conversation := range conversations {
		if conversation != nil && conversation.ConversationID == conversationID {
			return conversation
		}
	}
	return nil
}

func getAllConversationGroupsForTest(t *testing.T) []*model_struct.LocalConversationGroup {
	t.Helper()
	groups, err := open_im_sdk.IMUserContext.Conversation().GetConversationGroups(ctx, constant.ConversationGroupQueryAll)
	if err != nil {
		t.Fatalf("GetConversationGroups(all) failed: %v", err)
	}
	return groups
}

func findConversationGroupByID(groups []*model_struct.LocalConversationGroup, groupID string) *model_struct.LocalConversationGroup {
	for _, group := range groups {
		if group != nil && group.ConversationGroupID == groupID {
			return group
		}
	}
	return nil
}

func waitConversationMatch(t *testing.T, conversationID string, timeout time.Duration, match func(*model_struct.LocalConversation) bool) *model_struct.LocalConversation {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		conversation := getConversationByIDForTest(t, conversationID)
		if conversation != nil && match(conversation) {
			return conversation
		}
		if time.Now().After(deadline) {
			t.Fatalf("conversation %s did not match expected state within %s", conversationID, timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func waitConversationGroupExists(t *testing.T, groupID string, timeout time.Duration) *model_struct.LocalConversationGroup {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		group := findConversationGroupByID(getAllConversationGroupsForTest(t), groupID)
		if group != nil {
			return group
		}
		if time.Now().After(deadline) {
			t.Fatalf("conversation group %s not found within %s", groupID, timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func waitConversationGroupDeleted(t *testing.T, groupID string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		if findConversationGroupByID(getAllConversationGroupsForTest(t), groupID) == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("conversation group %s still exists after %s", groupID, timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func waitConversationGroupMatch(t *testing.T, groupID string, timeout time.Duration, match func(*model_struct.LocalConversationGroup) bool) *model_struct.LocalConversationGroup {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		group := waitConversationGroupExists(t, groupID, timeout)
		if match(group) {
			return group
		}
		if time.Now().After(deadline) {
			t.Fatalf("conversation group %s did not match expected state within %s", groupID, timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func pickConversationIDForLifecycle(t *testing.T) string {
	t.Helper()
	conversations, err := open_im_sdk.IMUserContext.Conversation().GetConversationListSplit(ctx, 0, 20)
	if err != nil {
		t.Fatalf("GetConversationListSplit failed: %v", err)
	}
	for _, conversation := range conversations {
		if conversation != nil && conversation.ConversationID != "" {
			return conversation.ConversationID
		}
	}
	t.Skip("no conversation available for lifecycle/perf test")
	return ""
}

func waitConversationGroupCallbackLatency(t *testing.T, eventCh <-chan conversationGroupCallbackEvent, eventType conversationGroupCallbackEventType, groupID string, startedAt time.Time, timeout time.Duration) time.Duration {
	t.Helper()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		select {
		case evt := <-eventCh:
			if evt.eventType == eventType && evt.groupID == groupID {
				return evt.at.Sub(startedAt)
			}
		case <-timer.C:
			t.Fatalf("conversation group callback %s for group %s not received within %s", eventType, groupID, timeout)
		}
	}
}

func waitConversationPinnedChangedEvent(t *testing.T, eventCh <-chan conversationChangedEvent, conversationID string, pinned bool, timeout time.Duration) conversationChangedEvent {
	t.Helper()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		select {
		case evt := <-eventCh:
			if evt.conversationID == conversationID && evt.isPinned == pinned {
				return evt
			}
		case <-timer.C:
			t.Fatalf("conversation changed callback for conversation %s with isPinned=%v not received within %s", conversationID, pinned, timeout)
		}
	}
}

func waitConversationGroupInjectedTimingEvent(t *testing.T, eventCh <-chan conversationGroupInjectedTimingEvent, conversationID string, timeout time.Duration) conversationGroupInjectedTimingEvent {
	t.Helper()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		select {
		case evt := <-eventCh:
			for _, id := range evt.conversationIDs {
				if id == conversationID {
					return evt
				}
			}
		case <-timer.C:
			t.Fatalf("conversation group injected timing for conversation %s not received within %s", conversationID, timeout)
		}
	}
}

func drainConversationChangedEvents(eventCh <-chan conversationChangedEvent) {
	for {
		select {
		case <-eventCh:
		default:
			return
		}
	}
}

func drainConversationGroupCallbackEvents(eventCh <-chan conversationGroupCallbackEvent) {
	for {
		select {
		case <-eventCh:
		default:
			return
		}
	}
}

func drainConversationGroupInjectedTimingEvents(eventCh <-chan conversationGroupInjectedTimingEvent) {
	for {
		select {
		case <-eventCh:
		default:
			return
		}
	}
}

func summarizeDurations(values []time.Duration) (min, max, avg, p50, p95, total time.Duration) {
	if len(values) == 0 {
		return 0, 0, 0, 0, 0, 0
	}
	sorted := append([]time.Duration(nil), values...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	min = sorted[0]
	max = sorted[len(sorted)-1]
	for _, value := range sorted {
		total += value
	}
	avg = total / time.Duration(len(sorted))
	p50 = sorted[(len(sorted)-1)/2]
	p95 = sorted[(len(sorted)-1)*95/100]
	return min, max, avg, p50, p95, total
}

func containsConversationID(ids []string, target string) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}

func Test_ConversationGroupLifecycle_FullCase(t *testing.T) {
	conversationID := pickConversationIDForLifecycle(t)
	name := fmt.Sprintf("cg_lifecycle_%d", time.Now().UnixNano())
	group, err := open_im_sdk.IMUserContext.Conversation().CreateConversationGroup(ctx, &sdk_params_callback.CreateConversationGroupReq{
		Name:                  name,
		Order:                 10,
		ConversationGroupType: pbConversation.ConversationGroupType_ConversationGroupTypeNormal,
	})
	if err != nil {
		t.Fatalf("CreateConversationGroup failed: %v", err)
	}
	if group == nil || group.ConversationGroupID == "" {
		t.Fatalf("CreateConversationGroup returned empty group: %+v", group)
	}
	groupID := group.ConversationGroupID
	defer func() {
		_ = open_im_sdk.IMUserContext.Conversation().DeleteConversationGroup(ctx, groupID)
	}()

	waitConversationGroupExists(t, groupID, 8*time.Second)

	updatedName := name + "_updated"
	updatedEx := fmt.Sprintf("{\"k\":\"v_%d\"}", time.Now().UnixNano())
	updated, err := open_im_sdk.IMUserContext.Conversation().UpdateConversationGroup(ctx, &sdk_params_callback.UpdateConversationGroupReq{
		ConversationGroupID: groupID,
		Name:                wrapperspb.String(updatedName),
		Ex:                  wrapperspb.String(updatedEx),
		Hidden:              wrapperspb.Bool(false),
	})
	if err != nil {
		t.Fatalf("UpdateConversationGroup failed: %v", err)
	}
	if updated == nil || updated.ConversationGroupID != groupID {
		t.Fatalf("UpdateConversationGroup returned unexpected group: %+v", updated)
	}

	waitConversationGroupMatch(t, groupID, 8*time.Second, func(group *model_struct.LocalConversationGroup) bool {
		return group.Name == updatedName && group.Ex == updatedEx
	})

	const targetOrder int64 = 123
	if err := open_im_sdk.IMUserContext.Conversation().SetConversationGroupOrder(ctx, []*pbConversation.ConversationGroupOrder{
		{ConversationGroupID: groupID, Order: targetOrder},
	}); err != nil {
		t.Fatalf("SetConversationGroupOrder failed: %v", err)
	}

	waitConversationGroupMatch(t, groupID, 8*time.Second, func(group *model_struct.LocalConversationGroup) bool {
		return group.Serial == targetOrder
	})

	if err := open_im_sdk.IMUserContext.Conversation().AddConversationsToGroups(ctx, []string{conversationID}, []string{groupID}); err != nil {
		t.Fatalf("AddConversationsToGroups failed: %v", err)
	}

	waitConversationGroupMatch(t, groupID, 8*time.Second, func(group *model_struct.LocalConversationGroup) bool {
		return containsConversationID(group.ConversationIDs, conversationID)
	})

	groupsByConversation, err := open_im_sdk.IMUserContext.Conversation().GetConversationGroupByConversationID(ctx, conversationID)
	if err != nil {
		t.Fatalf("GetConversationGroupByConversationID failed: %v", err)
	}
	found := false
	for _, candidate := range groupsByConversation {
		if candidate != nil && candidate.ConversationGroupID == groupID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("group %s not returned by GetConversationGroupByConversationID for conversation %s", groupID, conversationID)
	}

	info, err := open_im_sdk.IMUserContext.Conversation().GetConversationGroupInfoWithConversations(ctx, &sdk_params_callback.GetConversationGroupInfoWithConversationsReq{
		ConversationGroupID: groupID,
		Pagination:          conversationGroupExportConfig.Pagination,
	})
	if err != nil {
		t.Fatalf("GetConversationGroupInfoWithConversations failed: %v", err)
	}
	if info == nil || info.Group == nil || info.Group.ConversationGroupID != groupID {
		t.Fatalf("unexpected group info response: %+v", info)
	}
	if !containsConversationID(info.Group.ConversationIDs, conversationID) {
		t.Fatalf("conversation %s missing from group info: %+v", conversationID, info.Group)
	}

	if err := open_im_sdk.IMUserContext.Conversation().RemoveConversationsFromGroups(ctx, []string{conversationID}, []string{groupID}); err != nil {
		t.Fatalf("RemoveConversationsFromGroups failed: %v", err)
	}

	waitConversationGroupMatch(t, groupID, 8*time.Second, func(group *model_struct.LocalConversationGroup) bool {
		return !containsConversationID(group.ConversationIDs, conversationID)
	})

	if err := open_im_sdk.IMUserContext.Conversation().DeleteConversationGroup(ctx, groupID); err != nil {
		t.Fatalf("DeleteConversationGroup failed: %v", err)
	}
	waitConversationGroupDeleted(t, groupID, 8*time.Second)
}

func Test_ConversationGroupCallbackEndToEndLatency(t *testing.T) {
	conversationID := pickConversationIDForLifecycle(t)
	previousListener := open_im_sdk.IMUserContext.ConversationGroupListener()
	listener := newMeasuringConversationGroupListener(previousListener)
	open_im_sdk.IMUserContext.SetConversationGroupListener(listener)
	defer open_im_sdk.IMUserContext.SetConversationGroupListener(previousListener)

	name := fmt.Sprintf("cg_callback_perf_%d", time.Now().UnixNano())
	timeout := 15 * time.Second
	var groupID string
	defer func() {
		if groupID == "" {
			return
		}
		_ = open_im_sdk.IMUserContext.Conversation().DeleteConversationGroup(ctx, groupID)
	}()

	createStartedAt := time.Now()
	group, err := open_im_sdk.IMUserContext.Conversation().CreateConversationGroup(ctx, &sdk_params_callback.CreateConversationGroupReq{
		Name:                  name,
		Order:                 30,
		ConversationGroupType: pbConversation.ConversationGroupType_ConversationGroupTypeNormal,
	})
	if err != nil {
		t.Fatalf("CreateConversationGroup failed: %v", err)
	}
	if group == nil || group.ConversationGroupID == "" {
		t.Fatalf("CreateConversationGroup returned empty group: %+v", group)
	}
	groupID = group.ConversationGroupID
	createLatency := waitConversationGroupCallbackLatency(t, listener.eventCh, conversationGroupCallbackAdded, groupID, createStartedAt, timeout)
	waitConversationGroupExists(t, groupID, timeout)

	updatedName := name + "_updated"
	updatedEx := fmt.Sprintf("{\"perf\":\"%d\"}", time.Now().UnixNano())
	updateStartedAt := time.Now()
	_, err = open_im_sdk.IMUserContext.Conversation().UpdateConversationGroup(ctx, &sdk_params_callback.UpdateConversationGroupReq{
		ConversationGroupID: groupID,
		Name:                wrapperspb.String(updatedName),
		Ex:                  wrapperspb.String(updatedEx),
		Hidden:              wrapperspb.Bool(false),
	})
	if err != nil {
		t.Fatalf("UpdateConversationGroup failed: %v", err)
	}
	updateLatency := waitConversationGroupCallbackLatency(t, listener.eventCh, conversationGroupCallbackChanged, groupID, updateStartedAt, timeout)

	memberAddStartedAt := time.Now()
	if err := open_im_sdk.IMUserContext.Conversation().AddConversationsToGroups(ctx, []string{conversationID}, []string{groupID}); err != nil {
		t.Fatalf("AddConversationsToGroups failed: %v", err)
	}
	memberAddLatency := waitConversationGroupCallbackLatency(t, listener.eventCh, conversationGroupCallbackMemberAdded, groupID, memberAddStartedAt, timeout)

	memberDeleteStartedAt := time.Now()
	if err := open_im_sdk.IMUserContext.Conversation().RemoveConversationsFromGroups(ctx, []string{conversationID}, []string{groupID}); err != nil {
		t.Fatalf("RemoveConversationsFromGroups failed: %v", err)
	}
	memberDeleteLatency := waitConversationGroupCallbackLatency(t, listener.eventCh, conversationGroupCallbackMemberDeleted, groupID, memberDeleteStartedAt, timeout)

	deleteStartedAt := time.Now()
	if err := open_im_sdk.IMUserContext.Conversation().DeleteConversationGroup(ctx, groupID); err != nil {
		t.Fatalf("DeleteConversationGroup failed: %v", err)
	}
	deleteLatency := waitConversationGroupCallbackLatency(t, listener.eventCh, conversationGroupCallbackDeleted, groupID, deleteStartedAt, timeout)
	waitConversationGroupDeleted(t, groupID, timeout)
	groupID = ""

	totalLatency := createLatency + updateLatency + memberAddLatency + memberDeleteLatency + deleteLatency
	t.Logf(
		"conversation group callback end-to-end latency: create=%s update=%s member_add=%s member_delete=%s delete=%s total=%s",
		createLatency,
		updateLatency,
		memberAddLatency,
		memberDeleteLatency,
		deleteLatency,
		totalLatency,
	)
}

func Test_ConversationGroupCallbackLatencyUnderPinnedToggleStress(t *testing.T) {
	const (
		iterations = 20
		timeout    = 20 * time.Second
	)

	conversationID := pickConversationIDForLifecycle(t)
	originalConversation := getConversationByIDForTest(t, conversationID)
	if originalConversation == nil {
		t.Fatalf("conversation %s not found", conversationID)
	}
	originalPinned := originalConversation.IsPinned
	defer func() {
		_ = open_im_sdk.IMUserContext.Conversation().SetConversation(ctx, conversationID, &pbConversation.ConversationReq{
			ConversationID: conversationID,
			IsPinned:       wrapperspb.Bool(originalPinned),
		})
	}()

	previousConversationListener := open_im_sdk.IMUserContext.ConversationListener()
	previousGroupListener := open_im_sdk.IMUserContext.ConversationGroupListener()
	conversationListener := newMeasuringConversationListener(previousConversationListener)
	groupListener := newMeasuringConversationGroupListener(previousGroupListener)
	open_im_sdk.IMUserContext.SetConversationListener(conversationListener)
	open_im_sdk.IMUserContext.SetConversationGroupListener(groupListener)
	defer open_im_sdk.IMUserContext.SetConversationListener(previousConversationListener)
	defer open_im_sdk.IMUserContext.SetConversationGroupListener(previousGroupListener)

	drainConversationChangedEvents(conversationListener.eventCh)
	drainConversationGroupCallbackEvents(groupListener.eventCh)

	groupID := constant.ConversationGroupFilterNamePinned
	groupLatencies := make([]time.Duration, 0, iterations)
	conversationLatencies := make([]time.Duration, 0, iterations)
	callbackGaps := make([]time.Duration, 0, iterations)
	currentPinned := originalPinned

	for i := 1; i <= iterations; i++ {
		targetPinned := !currentPinned
		expectedEvent := conversationGroupCallbackMemberDeleted
		if targetPinned {
			expectedEvent = conversationGroupCallbackMemberAdded
		}

		startedAt := time.Now()
		if err := open_im_sdk.IMUserContext.Conversation().SetConversation(ctx, conversationID, &pbConversation.ConversationReq{
			ConversationID: conversationID,
			IsPinned:       wrapperspb.Bool(targetPinned),
		}); err != nil {
			t.Fatalf("SetConversation(isPinned=%v) failed: %v", targetPinned, err)
		}

		groupLatency := waitConversationGroupCallbackLatency(t, groupListener.eventCh, expectedEvent, groupID, startedAt, timeout)
		conversationEvt := waitConversationPinnedChangedEvent(t, conversationListener.eventCh, conversationID, targetPinned, timeout)
		conversationLatency := conversationEvt.at.Sub(startedAt)
		callbackGap := conversationEvt.at.Add(-groupLatency).Sub(startedAt)

		groupLatencies = append(groupLatencies, groupLatency)
		conversationLatencies = append(conversationLatencies, conversationLatency)
		callbackGaps = append(callbackGaps, callbackGap)
		currentPinned = targetPinned

		t.Logf(
			"conversation group callback latency iteration=%d targetPinned=%v action_to_group_callback=%s action_to_conversation_changed=%s group_to_conversation_gap=%s opid=%q",
			i,
			targetPinned,
			groupLatency,
			conversationLatency,
			callbackGap,
			mcontext.GetOperationID(ctx),
		)
	}

	groupMin, groupMax, groupAvg, groupP50, groupP95, groupTotal := summarizeDurations(groupLatencies)
	conversationMin, conversationMax, conversationAvg, conversationP50, conversationP95, conversationTotal := summarizeDurations(conversationLatencies)
	gapMin, gapMax, gapAvg, gapP50, gapP95, gapTotal := summarizeDurations(callbackGaps)
	t.Logf(
		"conversation group callback pinned-toggle summary: iterations=%d group_latency[min=%s max=%s avg=%s p50=%s p95=%s total=%s] conversation_latency[min=%s max=%s avg=%s p50=%s p95=%s total=%s] callback_gap[min=%s max=%s avg=%s p50=%s p95=%s total=%s]",
		iterations,
		groupMin,
		groupMax,
		groupAvg,
		groupP50,
		groupP95,
		groupTotal,
		conversationMin,
		conversationMax,
		conversationAvg,
		conversationP50,
		conversationP95,
		conversationTotal,
		gapMin,
		gapMax,
		gapAvg,
		gapP50,
		gapP95,
		gapTotal,
	)
}

func Test_ConversationGroupInjectedLatencyUnderPinnedToggleStress(t *testing.T) {
	const (
		iterations = 20
		timeout    = 20 * time.Second
	)

	conversationID := pickConversationIDForLifecycle(t)
	originalConversation := getConversationByIDForTest(t, conversationID)
	if originalConversation == nil {
		t.Fatalf("conversation %s not found", conversationID)
	}
	originalPinned := originalConversation.IsPinned
	defer func() {
		open_im_sdk.IMUserContext.SetConversationGroupInjectedTimingObserver(nil)
		_ = open_im_sdk.IMUserContext.Conversation().SetConversation(ctx, conversationID, &pbConversation.ConversationReq{
			ConversationID: conversationID,
			IsPinned:       wrapperspb.Bool(originalPinned),
		})
	}()

	previousConversationListener := open_im_sdk.IMUserContext.ConversationListener()
	previousGroupListener := open_im_sdk.IMUserContext.ConversationGroupListener()
	conversationListener := newMeasuringConversationListener(previousConversationListener)
	open_im_sdk.IMUserContext.SetConversationListener(conversationListener)
	open_im_sdk.IMUserContext.SetConversationGroupListener(noopConversationGroupListener{})
	defer open_im_sdk.IMUserContext.SetConversationListener(previousConversationListener)
	defer open_im_sdk.IMUserContext.SetConversationGroupListener(previousGroupListener)

	timingCh := make(chan conversationGroupInjectedTimingEvent, 256)
	open_im_sdk.IMUserContext.SetConversationGroupInjectedTimingObserver(newConversationGroupInjectedTimingObserver(timingCh))

	drainConversationChangedEvents(conversationListener.eventCh)
	drainConversationGroupInjectedTimingEvents(timingCh)

	injectedLatencies := make([]time.Duration, 0, iterations)
	totalLatencies := make([]time.Duration, 0, iterations)
	buildPlanLatencies := make([]time.Duration, 0, iterations)
	loadGroupsLatencies := make([]time.Duration, 0, iterations)
	groupChangedCallbackLatencies := make([]time.Duration, 0, iterations)
	memberChangedCallbackLatencies := make([]time.Duration, 0, iterations)
	fallbackLatencies := make([]time.Duration, 0, iterations)
	currentPinned := originalPinned

	for i := 1; i <= iterations; i++ {
		targetPinned := !currentPinned
		startedAt := time.Now()
		if err := open_im_sdk.IMUserContext.Conversation().SetConversation(ctx, conversationID, &pbConversation.ConversationReq{
			ConversationID: conversationID,
			IsPinned:       wrapperspb.Bool(targetPinned),
		}); err != nil {
			t.Fatalf("SetConversation(isPinned=%v) failed: %v", targetPinned, err)
		}

		timingEvt := waitConversationGroupInjectedTimingEvent(t, timingCh, conversationID, timeout)
		conversationEvt := waitConversationPinnedChangedEvent(t, conversationListener.eventCh, conversationID, targetPinned, timeout)

		injectedLatency := timingEvt.duration
		totalLatency := conversationEvt.at.Sub(startedAt)
		injectedLatencies = append(injectedLatencies, injectedLatency)
		totalLatencies = append(totalLatencies, totalLatency)
		buildPlanLatencies = append(buildPlanLatencies, timingEvt.buildPlan)
		loadGroupsLatencies = append(loadGroupsLatencies, timingEvt.loadGroups)
		groupChangedCallbackLatencies = append(groupChangedCallbackLatencies, timingEvt.groupChangedCB)
		memberChangedCallbackLatencies = append(memberChangedCallbackLatencies, timingEvt.memberChangedCB)
		fallbackLatencies = append(fallbackLatencies, timingEvt.fallback)
		currentPinned = targetPinned

		t.Logf(
			"conversation group injected latency iteration=%d targetPinned=%v injected=%s build_plan=%s load_groups=%s group_changed_cb=%s member_changed_cb=%s fallback=%s changed_groups=%d member_added_groups=%d member_deleted_groups=%d action_to_conversation_changed=%s",
			i,
			targetPinned,
			injectedLatency,
			timingEvt.buildPlan,
			timingEvt.loadGroups,
			timingEvt.groupChangedCB,
			timingEvt.memberChangedCB,
			timingEvt.fallback,
			timingEvt.changedGroups,
			timingEvt.memberAdded,
			timingEvt.memberDeleted,
			totalLatency,
		)
	}

	injectedMin, injectedMax, injectedAvg, injectedP50, injectedP95, injectedTotal := summarizeDurations(injectedLatencies)
	totalMin, totalMax, totalAvg, totalP50, totalP95, totalAll := summarizeDurations(totalLatencies)
	buildPlanMin, buildPlanMax, buildPlanAvg, buildPlanP50, buildPlanP95, buildPlanTotal := summarizeDurations(buildPlanLatencies)
	loadGroupsMin, loadGroupsMax, loadGroupsAvg, loadGroupsP50, loadGroupsP95, loadGroupsTotal := summarizeDurations(loadGroupsLatencies)
	groupChangedCBMin, groupChangedCBMax, groupChangedCBAvg, groupChangedCBP50, groupChangedCBP95, groupChangedCBTotal := summarizeDurations(groupChangedCallbackLatencies)
	memberChangedCBMin, memberChangedCBMax, memberChangedCBAvg, memberChangedCBP50, memberChangedCBP95, memberChangedCBTotal := summarizeDurations(memberChangedCallbackLatencies)
	fallbackMin, fallbackMax, fallbackAvg, fallbackP50, fallbackP95, fallbackTotal := summarizeDurations(fallbackLatencies)

	t.Logf(
		"conversation group injected latency summary: iterations=%d injected[min=%s max=%s avg=%s p50=%s p95=%s total=%s] total[min=%s max=%s avg=%s p50=%s p95=%s total=%s] build_plan[min=%s max=%s avg=%s p50=%s p95=%s total=%s] load_groups[min=%s max=%s avg=%s p50=%s p95=%s total=%s] group_changed_cb[min=%s max=%s avg=%s p50=%s p95=%s total=%s] member_changed_cb[min=%s max=%s avg=%s p50=%s p95=%s total=%s] fallback[min=%s max=%s avg=%s p50=%s p95=%s total=%s]",
		iterations,
		injectedMin,
		injectedMax,
		injectedAvg,
		injectedP50,
		injectedP95,
		injectedTotal,
		totalMin,
		totalMax,
		totalAvg,
		totalP50,
		totalP95,
		totalAll,
		buildPlanMin,
		buildPlanMax,
		buildPlanAvg,
		buildPlanP50,
		buildPlanP95,
		buildPlanTotal,
		loadGroupsMin,
		loadGroupsMax,
		loadGroupsAvg,
		loadGroupsP50,
		loadGroupsP95,
		loadGroupsTotal,
		groupChangedCBMin,
		groupChangedCBMax,
		groupChangedCBAvg,
		groupChangedCBP50,
		groupChangedCBP95,
		groupChangedCBTotal,
		memberChangedCBMin,
		memberChangedCBMax,
		memberChangedCBAvg,
		memberChangedCBP50,
		memberChangedCBP95,
		memberChangedCBTotal,
		fallbackMin,
		fallbackMax,
		fallbackAvg,
		fallbackP50,
		fallbackP95,
		fallbackTotal,
	)
}
