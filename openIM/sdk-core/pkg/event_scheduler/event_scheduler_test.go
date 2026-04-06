package event_scheduler

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	dbpkg "github.com/openimsdk/openim-sdk-core/v3/pkg/db"
)

type PatchPayload struct {
	GroupID string `json:"groupID"`
	Version int64  `json:"version"`
}

func newDB(t *testing.T) *dbpkg.DataBase {
	t.Helper()
	tmp := "./"
	db, err := dbpkg.NewDataBase(context.Background(), "u1", tmp, 0)
	if err != nil {
		t.Fatalf("NewDataBase error: %v", err)
	}
	return db
}

// Existing end-to-end example
func TestEventEndToEnd(t *testing.T) {
	ctx := context.WithValue(context.Background(), "operationID", "op-ut-1")
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	var handled int32

	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			if v.GroupID != "g1" || v.Version != 42 {
				t.Fatalf("decoded value mismatch: %+v", v)
			}
			atomic.AddInt32(&handled, 1)
			return nil
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:    string(UpdateMessageAvatarAndNickname),
		Value:  PatchPayload{GroupID: "g1", Version: 42},
		Caller: "ut",
	}, WithPartitionKey("g1"), WithDedupeKey("GroupDirty:g1"), WithMerge(true))
	if err != nil {
		t.Fatalf("EnqueueInTx error: %v", err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if atomic.LoadInt32(&handled) == 1 {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("handler not invoked")
}

//  1. Dedupe & merge: for the same dedupeKey, payload is last-writer-wins;
//     run_at/priority take the smaller value (earlier run / higher priority).
func TestEvent_DedupeMerge_MinRunAtPayloadLastWins(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	var got PatchPayload
	var calls int32
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.AddInt32(&calls, 1)
			got = *v
			return nil
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	// First enqueue: runAfter 20ms, priority=200, payload v1
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	}, WithDedupeKey("D:g1"), WithMerge(true), WithRunAfter(20*time.Millisecond), WithPriority(200)); err != nil {
		t.Fatal(err)
	}
	// Then enqueue again: runAfter 10ms (smaller), priority=50 (smaller = higher priority),
	// payload v2 (should override)
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 2},
	}, WithDedupeKey("D:g1"), WithMerge(true), WithRunAfter(10*time.Millisecond), WithPriority(50)); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if atomic.LoadInt32(&calls) >= 1 {
			if got.Version != 2 {
				t.Fatalf("payload should be last-writer-wins, got version=%d", got.Version)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("merged event not handled")
}

// 2) Priority: when run_at is equal, process higher priority first (smaller priority value).
func TestEvent_PriorityOrder(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	orderCh := make(chan string, 2)

	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			orderCh <- v.GroupID
			return nil
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	// A: priority=100
	err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "A", Version: 1},
	}, WithPriority(100))
	if err != nil {
		t.Fatal(err)
	}
	// B: priority=10 (higher)
	err = es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "B", Version: 1},
	}, WithPriority(10))
	if err != nil {
		t.Fatal(err)
	}
	t.Log("tsetsssw")
	first := <-orderCh
	second := <-orderCh
	if !(first == "B" && second == "A") {
		t.Fatalf("priority order wrong, got first=%s second=%s", first, second)
	}
}

// 3) Network gate: when requiresNetwork=true, it must NOT be claimed while EnableNetwork=false.
func TestEvent_RequiresNetworkGate(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)
	var netOK atomic.Bool
	netOK.Store(false)

	es := NewEventScheduler(
		WithWorkerID("w"),
		WithEnableNetwork(func() bool { return netOK.Load() }),
	)
	es.SetDataBase(db)
	var handled int32
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.AddInt32(&handled, 1)
			return nil
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	// Requires network
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	}, WithRequiresNetwork(true)); err != nil {
		t.Fatal(err)
	}

	// Should NOT be handled within 100ms
	time.Sleep(120 * time.Millisecond)
	if atomic.LoadInt32(&handled) != 0 {
		t.Fatalf("should not handle when network disabled")
	}

	// Enable network; should be handled afterwards
	netOK.Store(true)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if atomic.LoadInt32(&handled) == 1 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("event not handled after network enabled")
}

// 4) Decode error: value type mismatch → goes to dead, no retry (handler should not be called).
func TestEvent_DecodeErrorGoesDead_NoRetry(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(
		WithWorkerID("w"),
		WithWorkerMaxAttempts(5),             // larger doesn't matter: decode error goes dead directly
		WithBackoffBase(50*time.Millisecond), // speed up
		WithEnableNetwork(func() bool { return true }),
	)
	es.SetDataBase(db)
	var handled int32
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.AddInt32(&handled, 1)
			return nil
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	// Intentionally put a string that cannot be decoded to struct → DecodeError
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: "NOT_A_STRUCT",
	}); err != nil {
		t.Fatal(err)
	}

	time.Sleep(300 * time.Millisecond) // enough for one decode failure + dead
	if atomic.LoadInt32(&handled) != 0 {
		t.Fatalf("handler should not be called on decode error")
	}
	// Wait a bit longer; should still not retry
	time.Sleep(300 * time.Millisecond)
	if atomic.LoadInt32(&handled) != 0 {
		t.Fatalf("decode error should not retry")
	}
}

// 5) Max attempts: handler always fails; stop retrying after MaxAttempts.
func TestEvent_MaxAttemptsBackoffStops(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(
		WithWorkerID("w"),
		WithWorkerMaxAttempts(3),             // finish ASAP
		WithBackoffBase(30*time.Millisecond), // faster backoff
		WithEnableNetwork(func() bool { return true }),
	)
	es.SetDataBase(db)
	var calls int32
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.AddInt32(&calls, 1)
			return assertErr("force failure") // any non-DecodeError will be retried
		}),
	)
	go es.Start(ctx)
	defer es.Stop()

	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	}); err != nil {
		t.Fatal(err)
	}

	// Wait longer than the total time of 3 attempts
	time.Sleep(5 * time.Second)
	got := atomic.LoadInt32(&calls)
	if got < 3 {
		t.Fatalf("expected >=3 attempts, got %d", got)
	}
	// Wait a bit more; count should not increase
	prev := got
	time.Sleep(10000 * time.Millisecond)
	got = atomic.LoadInt32(&calls)
	if got != prev {
		t.Fatalf("should stop retrying after max attempts; prev=%d now=%d", prev, got)
	}
	t.Log(got, prev)
}

// 6) DB-level lease recovery: do not go through worker; manually Claim / expire / Recover / Claim again.
func TestDB_LeaseExpiryRecover(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler()
	es.SetDataBase(db)
	// Insert one event directly into DB
	err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	})
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now().UnixMilli()
	evt, err := db.ClaimNextEvent(ctx, true, now, "worker-1", 50*time.Millisecond)
	if err != nil || evt == nil {
		t.Fatalf("claim failed: evt=%v err=%v", evt, err)
	}

	// Wait for the lease to expire
	time.Sleep(80 * time.Millisecond)

	// Recover expired leases
	if _, err := db.RecoverExpiredLeases(ctx, time.Now().UnixMilli()); err != nil {
		t.Fatalf("RecoverExpiredLeases error: %v", err)
	}

	// Another worker should be able to claim again
	evt2, err := db.ClaimNextEvent(ctx, true, time.Now().UnixMilli(), "worker-2", time.Second)
	if err != nil || evt2 == nil {
		t.Fatalf("2nd claim failed: evt=%v err=%v", evt2, err)
	}
}

// 7) Merge disabled: same dedupeKey should not merge and execute twice
func TestEvent_MergeOff_ExecutesTwice(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	var calls int32
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.AddInt32(&calls, 1)
			return nil
		},
	))
	go es.Start(ctx)
	defer es.Stop()

	// Enqueue twice with same dedupeKey but without Merge(true)
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	}, WithDedupeKey("X:g1")); err != nil {
		t.Fatal(err)
	}
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 2},
	}, WithDedupeKey("X:g1")); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if atomic.LoadInt32(&calls) >= 2 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected two executions, got %d", atomic.LoadInt32(&calls))
}

// 8) RunAfter should delay execution until the scheduled time
func TestEvent_RunAfterRespected(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	var handledAt int64
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			atomic.StoreInt64(&handledAt, time.Now().UnixMilli())
			return nil
		},
	))
	go es.Start(ctx)
	defer es.Stop()

	start := time.Now().UnixMilli()
	delay := 500 * time.Millisecond
	if err := es.EnqueueInTx(ctx, common.Cmd2Value{
		Cmd:   UpdateMessageAvatarAndNickname,
		Value: PatchPayload{GroupID: "g1", Version: 1},
	}, WithRunAfter(delay)); err != nil {
		t.Fatal(err)
	}

	// Before delay, it should not run
	time.Sleep(300 * time.Millisecond)
	if atomic.LoadInt64(&handledAt) != 0 {
		t.Fatalf("handler should not run before delay")
	}

	// After delay, it should have run
	deadline := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadline) {
		if ts := atomic.LoadInt64(&handledAt); ts != 0 {
			if ts < start+delay.Milliseconds() {
				t.Fatalf("handler ran too early: got %d want >= %d", ts, start+delay.Milliseconds())
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("handler did not run after delay")
}

// 9) calcBackoff honors base and growth (with jitter tolerance)
func TestBackoff_CalcBounds(t *testing.T) {
	db := newDB(t)
	base := 50 * time.Millisecond
	es := NewEventScheduler(WithWorkerID("w"), WithBackoffBase(base))
	es.SetDataBase(db)

	// attempt=1 => base..base*1.1
	d1 := es.calcBackoff(1)
	if d1 < base || d1 > base+base/10 {
		t.Fatalf("backoff attempt1 out of range: %v", d1)
	}
	// attempt=2 => 2*base .. 2*base*1.1
	d2 := es.calcBackoff(2)
	if d2 < 2*base || d2 > 2*base+(2*base)/10 {
		t.Fatalf("backoff attempt2 out of range: %v", d2)
	}
}

// 10) Priority tie-breaker: same priority, order by run_at then created_at
func TestEvent_PriorityTiebreaker(t *testing.T) {
	ctx := context.Background()
	db := newDB(t)

	es := NewEventScheduler(WithWorkerID("w"), WithEnableNetwork(func() bool { return true }))
	es.SetDataBase(db)
	orderCh := make(chan string, 2)

	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			orderCh <- v.GroupID
			return nil
		},
	))
	go es.Start(ctx)
	defer es.Stop()

	// Same priority; different runAt: expect gB (run earlier) then gA
	tA := time.Now().Add(200 * time.Millisecond)
	tB := time.Now().Add(50 * time.Millisecond)
	must := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	must(es.EnqueueInTx(ctx, common.Cmd2Value{Cmd: UpdateMessageAvatarAndNickname, Value: PatchPayload{GroupID: "gA", Version: 1}}, WithPriority(100), WithRunAt(tA)))
	must(es.EnqueueInTx(ctx, common.Cmd2Value{Cmd: UpdateMessageAvatarAndNickname, Value: PatchPayload{GroupID: "gB", Version: 1}}, WithPriority(100), WithRunAt(tB)))

	got1 := <-orderCh
	got2 := <-orderCh
	if !(got1 == "gB" && got2 == "gA") {
		t.Fatalf("unexpected order by runAt: %v, %v", got1, got2)
	}

	// Same priority and same runAt; creation order should decide
	orderCh = make(chan string, 2)
	es.Register(UpdateMessageAvatarAndNickname, MakeJSONHandler[PatchPayload](
		func(ctx context.Context, v *PatchPayload) error {
			orderCh <- v.GroupID
			return nil
		},
	))
	tX := time.Now().Add(100 * time.Millisecond)
	must(es.EnqueueInTx(ctx, common.Cmd2Value{Cmd: UpdateMessageAvatarAndNickname, Value: PatchPayload{GroupID: "g1", Version: 1}}, WithPriority(100), WithRunAt(tX)))
	// slight delay to ensure created_at differs
	time.Sleep(10 * time.Millisecond)
	must(es.EnqueueInTx(ctx, common.Cmd2Value{Cmd: UpdateMessageAvatarAndNickname, Value: PatchPayload{GroupID: "g2", Version: 1}}, WithPriority(100), WithRunAt(tX)))

	gotX := <-orderCh
	gotY := <-orderCh
	if !(gotX == "g1" && gotY == "g2") {
		t.Fatalf("unexpected order by createdAt: %v, %v", gotX, gotY)
	}
}

type assertErr string

func (e assertErr) Error() string { return string(e) }
