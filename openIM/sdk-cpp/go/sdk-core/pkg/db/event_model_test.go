package db

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/gorm"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func newID() string { return fmt.Sprintf("id-%d", time.Now().UnixNano()) }

func newTestDBWithName(t *testing.T, name string) *DataBase {
	t.Helper()
	ctx := context.Background()
	db, err := NewDataBase(ctx, name, "./", 6)
	if err != nil {
		t.Fatalf("NewDataBase error: %v", err)
	}
	// Ensure tables exist
	if err := db.conn.AutoMigrate(&model_struct.LocalEvent{}, &model_struct.LocalEventIdempotency{}); err != nil {
		t.Fatalf("AutoMigrate error: %v", err)
	}
	return db
}

func newTestDB(t *testing.T) *DataBase {
	return newTestDBWithName(t, "u1")
}

func mustInsert(t *testing.T, d *DataBase, ev *model_struct.LocalEvent) {
	t.Helper()
	if err := d.InsertEvent(context.Background(), ev); err != nil {
		t.Fatalf("InsertEvent: %v", err)
	}
}

func mustClaim(t *testing.T, d *DataBase, netOK bool, nowMS int64, worker string, ttl time.Duration) *model_struct.LocalEvent {
	t.Helper()
	ev, err := d.ClaimNextEvent(context.Background(), netOK, nowMS, worker, ttl)
	if err != nil {
		t.Fatalf("ClaimNextEvent: %v", err)
	}
	return ev
}

func TestInsertClaimCompletePurge(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	now := time.Now().UnixMilli()
	ev := &model_struct.LocalEvent{
		ID:              newID(),
		Type:            "t.complete",
		Payload:         `{"x":1}`,
		State:           "pending",
		Priority:        50,
		Attempts:        0,
		MaxAttempts:     3,
		RunAt:           now,
		RequiresNetwork: false,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	mustInsert(t, db, ev)

	got := mustClaim(t, db, true, now, "w1", 2*time.Second)
	if got == nil {
		t.Fatalf("expected claimable event, got nil")
	}
	if got.State != "processing" || got.LeaseOwner != "w1" || got.LeaseExpiresAt == nil {
		t.Fatalf("unexpected claimed fields: %#v", got)
	}

	if err := db.CompleteEvent(ctx, got.ID); err != nil {
		t.Fatalf("CompleteEvent: %v", err)
	}

	// Once completed, it must not be claimable again
	again, err := db.ClaimNextEvent(ctx, true, now, "w2", time.Second)
	if err != nil {
		t.Fatalf("ClaimNextEvent again: %v", err)
	}
	if again != nil {
		t.Fatalf("completed event should not be claimable")
	}

	// Purge completed events
	before := time.Now().Add(1 * time.Second).UnixMilli()
	n, err := db.PurgeCompletedEvents(ctx, before)
	if err != nil {
		t.Fatalf("PurgeCompletedEvents: %v", err)
	}
	if n == 0 {
		t.Fatalf("expected at least 1 row purged")
	}
}

func TestFailRetryToDead_NotClaimableAfterMax(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	now := time.Now().UnixMilli()
	id := newID()
	ev := &model_struct.LocalEvent{
		ID:          id,
		Type:        "t.retry",
		Payload:     `{}`,
		State:       "pending",
		Priority:    10,
		MaxAttempts: 2,
		RunAt:       now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	mustInsert(t, db, ev)

	// First attempt -> fail (back to pending)
	got := mustClaim(t, db, true, now, "w", time.Second)
	if got == nil {
		t.Fatalf("expected claimable")
	}
	next1 := now + 50
	if err := db.FailEvent(ctx, id, got.Attempts+1, "err1", next1, "pending"); err != nil {
		t.Fatalf("FailEvent #1: %v", err)
	}
	var after1 model_struct.LocalEvent
	_ = db.conn.WithContext(ctx).Where("id = ?", id).Take(&after1)
	if after1.Attempts != 1 || after1.State != "pending" || after1.RunAt != next1 || after1.LeaseOwner != "" {
		t.Fatalf("unexpected after #1: %#v", after1)
	}

	// Second attempt -> fail and mark dead
	got2 := mustClaim(t, db, true, next1, "w", time.Second)
	if got2 == nil {
		t.Fatalf("expected second claim")
	}
	next2 := next1 + 50
	if err := db.FailEvent(ctx, id, got2.Attempts+1, "err2", next2, "dead"); err != nil {
		t.Fatalf("FailEvent #2: %v", err)
	}

	// Dead event must not be claimable
	ev3, err := db.ClaimNextEvent(ctx, true, next2, "w", time.Second)
	if err != nil {
		t.Fatalf("ClaimNextEvent after dead: %v", err)
	}
	if ev3 != nil {
		t.Fatalf("dead event should not be claimable")
	}
}

func TestRecoverExpiredLeases(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	now := time.Now().UnixMilli()
	id := newID()

	mustInsert(t, db, &model_struct.LocalEvent{
		ID:        id,
		Type:      "t.recover",
		Payload:   `{}`,
		State:     "pending",
		Priority:  99,
		RunAt:     now,
		CreatedAt: now,
		UpdatedAt: now,
	})

	// Claim and let the lease expire
	got := mustClaim(t, db, true, now, "w", 100*time.Millisecond)
	if got == nil {
		t.Fatalf("expected claimable")
	}
	time.Sleep(150 * time.Millisecond)

	// Recover expired leases
	n, err := db.RecoverExpiredLeases(ctx, time.Now().UnixMilli())
	if err != nil {
		t.Fatalf("RecoverExpiredLeases: %v", err)
	}
	if n == 0 {
		t.Fatalf("expected at least 1 recovered")
	}

	// It should be claimable again
	ev, err := db.ClaimNextEvent(ctx, true, time.Now().UnixMilli(), "w2", time.Second)
	if err != nil || ev == nil {
		t.Fatalf("re-claim failed: %v ev=%v", err, ev)
	}
}

func TestPriorityAndRunAtOrder(t *testing.T) {
	db := newTestDB(t)
	now := time.Now().UnixMilli()

	eA := &model_struct.LocalEvent{
		ID: newID() + "A", Type: "t.order", Payload: `{"who":"A"}`,
		State: "pending", Priority: 100, MaxAttempts: 3, RunAt: now,
		CreatedAt: now, UpdatedAt: now,
	}
	eB := &model_struct.LocalEvent{
		ID: newID() + "B", Type: "t.order", Payload: `{"who":"B"}`,
		State: "pending", Priority: 10, MaxAttempts: 3, RunAt: now,
		CreatedAt: now, UpdatedAt: now,
	}
	mustInsert(t, db, eA)
	mustInsert(t, db, eB)

	// First claim: should be B (higher priority)
	one := mustClaim(t, db, true, now, "w", time.Second)
	if one == nil || one.ID != eB.ID {
		t.Fatalf("expected B first by priority, got %#v", one)
	}

	// IMPORTANT: push B's next run to the future so it won't be picked immediately again
	next := now + 5_000 // any future time works; simulate backoff
	if err := db.FailEvent(context.Background(), one.ID, one.Attempts+1, "x", next, "pending"); err != nil {
		t.Fatalf("fail claimed: %v", err)
	}

	// Second claim at 'now': B is not due; A should be picked
	two := mustClaim(t, db, true, now, "w", time.Second)
	if two == nil || two.ID != eA.ID {
		t.Fatalf("expected A second, got %#v", two)
	}
}

func TestRequiresNetworkFilter(t *testing.T) {
	db := newTestDB(t)
	now := time.Now().UnixMilli()

	ev := &model_struct.LocalEvent{
		ID:              newID(),
		Type:            "t.net",
		Payload:         `{}`,
		State:           "pending",
		Priority:        1,
		RunAt:           now,
		RequiresNetwork: true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	mustInsert(t, db, ev)

	// When network is not OK, it should not be claimable
	ev1, err := db.ClaimNextEvent(context.Background(), false, now, "w", time.Second)
	if err != nil {
		t.Fatalf("ClaimNextEvent net=false: %v", err)
	}
	if ev1 != nil {
		t.Fatalf("should not claim when netOK=false and requires_network=true")
	}

	// When network is OK, it should be claimable
	ev2 := mustClaim(t, db, true, now, "w", time.Second)
	if ev2 == nil {
		t.Fatalf("should claim when netOK=true")
	}
}

func TestUpsertEventByDedupe_MergeMinimize(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	now := time.Now().UnixMilli()

	key := "dedupe-" + newID()

	first := &model_struct.LocalEvent{
		ID:          newID(),
		Type:        "t.dedupe",
		Payload:     `{"n":1}`,
		State:       "pending",
		Priority:    50,
		MaxAttempts: 3,
		RunAt:       now + 10_000,
		DedupeKey:   &key,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := db.UpsertEventByDedupe(ctx, first); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	second := &model_struct.LocalEvent{
		ID:        newID(),
		Type:      "t.dedupe",
		Payload:   `{"n":2}`,
		State:     "pending",
		Priority:  10,  // smaller is higher priority
		RunAt:     now, // earlier
		DedupeKey: &key,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := db.UpsertEventByDedupe(ctx, second); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	var row model_struct.LocalEvent
	if err := db.conn.WithContext(ctx).
		Where("dedupe_key = ?", key).
		Take(&row).Error; err != nil {
		t.Fatalf("query merged row: %v", err)
	}
	// Payload: last-writer-wins; run_at/priority: minimized (earlier run_at, higher priority)
	if row.Payload != second.Payload || row.RunAt != second.RunAt || row.Priority != second.Priority {
		t.Fatalf("unexpected merged fields: %#v", row)
	}
}

func TestClaim_NoCandidateReturnsNil(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	now := time.Now().UnixMilli()

	// Empty table
	ev, err := db.ClaimNextEvent(ctx, true, now, "w", time.Second)
	if err != nil {
		t.Fatalf("claim empty: %v", err)
	}
	if ev != nil {
		t.Fatalf("expect nil on empty table")
	}

	// Insert a future event
	future := now + 10_000
	mustInsert(t, db, &model_struct.LocalEvent{
		ID:        newID(),
		Type:      "t.future",
		Payload:   `{}`,
		State:     "pending",
		Priority:  1,
		RunAt:     future,
		CreatedAt: now,
		UpdatedAt: now,
	})
	ev2, err := db.ClaimNextEvent(ctx, true, now, "w", time.Second)
	if err != nil {
		t.Fatalf("claim future: %v", err)
	}
	if ev2 != nil {
		t.Fatalf("should not claim future event")
	}
}

func TestPurgeCompletedEvents(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()
	now := time.Now().UnixMilli()

	// Insert done/dead (old) and a pending (young)
	for i := 0; i < 2; i++ {
		mustInsert(t, db, &model_struct.LocalEvent{
			ID:        newID(),
			Type:      "t.purge",
			Payload:   `{}`,
			State:     "done",
			Priority:  1,
			RunAt:     now,
			CreatedAt: now - 60_000,
			UpdatedAt: now - 60_000,
		})
	}
	mustInsert(t, db, &model_struct.LocalEvent{
		ID:        newID(),
		Type:      "t.purge",
		Payload:   `{}`,
		State:     "dead",
		Priority:  1,
		RunAt:     now,
		CreatedAt: now - 60_000,
		UpdatedAt: now - 60_000,
	})
	mustInsert(t, db, &model_struct.LocalEvent{
		ID:        newID(),
		Type:      "t.purge",
		Payload:   `{}`,
		State:     "pending",
		Priority:  1,
		RunAt:     now,
		CreatedAt: now,
		UpdatedAt: now,
	})

	n, err := db.PurgeCompletedEvents(ctx, now-1)
	if err != nil {
		t.Fatalf("PurgeCompletedEvents: %v", err)
	}
	if n < 3 {
		t.Fatalf("expected >=3 rows purged, got %d", n)
	}

	var cnt int64
	if err := db.conn.WithContext(ctx).
		Model(&model_struct.LocalEvent{}).
		Where("state IN ?", []string{"done", "dead"}).
		Count(&cnt).Error; err != nil {
		t.Fatalf("count after purge: %v", err)
	}
	if cnt != 0 {
		t.Fatalf("done/dead should be purged, remain=%d", cnt)
	}
}

func TestConcurrentClaim_OnlyOneWins(t *testing.T) {
	// Two DB handles pointing to the same underlying DB simulate concurrent claimers
	name := "concurrent_" + newID()
	db1 := newTestDBWithName(t, name)
	db2 := newTestDBWithName(t, name)

	now := time.Now().UnixMilli()
	id := newID()
	mustInsert(t, db1, &model_struct.LocalEvent{
		ID:        id,
		Type:      "t.concurrent",
		Payload:   `{}`,
		State:     "pending",
		Priority:  1,
		RunAt:     now,
		CreatedAt: now,
		UpdatedAt: now,
	})

	var won int32
	wg := sync.WaitGroup{}
	try := func(d *DataBase, who string) {
		defer wg.Done()
		ev, err := d.ClaimNextEvent(context.Background(), true, now, who, time.Second)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			t.Errorf("claim err (%s): %v", who, err)
			return
		}
		if ev != nil {
			atomic.AddInt32(&won, 1)
		}
	}

	wg.Add(2)
	go try(db1, "w1")
	go try(db2, "w2")
	wg.Wait()

	if atomic.LoadInt32(&won) != 1 {
		t.Fatalf("exactly one winner expected, got %d", won)
	}
}
