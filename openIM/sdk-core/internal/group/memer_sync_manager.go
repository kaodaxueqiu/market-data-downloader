package group

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/openimsdk/tools/log"
)

type MemberHandler func(ctx context.Context, groupID ...string) error

const (
	defaultWorkers     = 2
	defaultQueueSize   = 10
	defaultTaskTimeout = 10 * time.Second
)

type MemberSyncManager struct {
	handler MemberHandler

	// seen marks groups that have been verified/synced in the current network lifecycle.
	// key: groupID, val: any (version or struct{}).
	seen map[string]struct{}
	// inQueue prevents enqueuing the same groupID multiple times concurrently.
	// key: groupID, val: struct{}{}
	inQueue map[string]struct{}
	// pending captures enqueue attempts happening while a sync is in-flight.
	// key: groupID, val: struct{}{}
	pending map[string]struct{}
	// mu protects seen, inQueue, and pending maps.
	mu sync.RWMutex
	// queue carries groupIDs to workers; keeps producer/consumer decoupled and rate-limited.
	queue   chan string
	workers int
	sf      singleflight.Group
	// Per-task timeout for background ensures.
	maxTaskTimeout time.Duration
}

type Option func(*MemberSyncManager)

// WithWorkers sets worker count (client SDKs: 1 for mobile, 2 for desktop).
func WithWorkers(n int) Option {
	return func(s *MemberSyncManager) {
		if n > 0 {
			s.workers = n
		}
	}
}

// WithQueueSize sets channel buffer for groupIDs.
func WithQueueSize(n int) Option {
	return func(s *MemberSyncManager) {
		if n > 0 {
			s.queue = make(chan string, n)
		}
	}
}

// WithTaskTimeout sets per-task timeout for background ensures.
func WithTaskTimeout(d time.Duration) Option {
	return func(s *MemberSyncManager) {
		if d > 0 {
			s.maxTaskTimeout = d
		}
	}
}

// NewMemberSyncManager workers: 1–2 is typical for client SDKs (1 for mobile, 2 for desktop).
func NewMemberSyncManager(handler MemberHandler, opts ...Option) *MemberSyncManager {
	m := &MemberSyncManager{
		handler:        handler,
		workers:        defaultWorkers,
		queue:          make(chan string, defaultQueueSize),
		seen:           make(map[string]struct{}),
		inQueue:        make(map[string]struct{}),
		pending:        make(map[string]struct{}),
		maxTaskTimeout: defaultTaskTimeout,
	}
	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Run starts worker goroutines and blocks until ctx is canceled.
// Call this once per lifecycle (e.g., after login or reconnect).
func (m *MemberSyncManager) Run(ctx context.Context) {
	for i := 0; i < m.workers; i++ {
		go func() {
			m.worker(ctx)
		}()
	}
}

// Reset clears lifecycle-scoped caches (call on reconnect / re-login).
func (m *MemberSyncManager) Reset() {
	m.mu.Lock()
	m.seen = make(map[string]struct{})
	m.inQueue = make(map[string]struct{})
	m.pending = make(map[string]struct{})
	m.mu.Unlock()
}

func (m *MemberSyncManager) ensureAsync(ctx context.Context, groupID string, force bool) {
	if groupID == "" {
		return
	}

	m.mu.Lock()
	if force {
		delete(m.seen, groupID)
	} else if _, ok := m.seen[groupID]; ok {
		m.mu.Unlock()
		return // have seen in current lifecycle
	}
	if _, exists := m.inQueue[groupID]; exists {
		m.pending[groupID] = struct{}{}
		m.mu.Unlock()
		return
	}
	m.inQueue[groupID] = struct{}{}
	m.mu.Unlock()
	select {
	case m.queue <- groupID:
	default:
		// Queue is full: fall back to a fire-and-forget attempt.
		// It will still coalesce via singleflight at execution stage.
		go m.ensureNow(context.WithoutCancel(ctx), groupID)
	}
}

// EnsureAsync enqueues a best-effort background ensure for groupID.
// If the group is already seen, it's a no-op.
func (m *MemberSyncManager) EnsureAsync(ctx context.Context, groupID string) {
	m.ensureAsync(ctx, groupID, false)
}

// ForceEnsureAsync clears cached success state and schedules an asynchronous ensure.
func (m *MemberSyncManager) ForceEnsureAsync(ctx context.Context, groupID string) {
	m.ensureAsync(ctx, groupID, true)
}

// EnsureSync performs a foreground ensure (blocking the caller) with caller-provided ctx.
// Use sparingly when you MUST guarantee the group is synced before proceeding.
func (m *MemberSyncManager) EnsureSync(ctx context.Context, groupID string) error {
	m.mu.RLock()
	_, ok := m.seen[groupID]
	m.mu.RUnlock()
	if ok {
		return nil
	}
	return m.doSingleflight(ctx, groupID)
}

func (m *MemberSyncManager) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			log.ZInfo(ctx, "MemberSyncManager worker exiting, sdk logout.....")
			return
		case gid := <-m.queue:
			m.ensureNow(ctx, gid)
		}
	}
}

func (m *MemberSyncManager) ensureNow(ctx context.Context, groupID string) {
	ctx = context.WithoutCancel(ctx)
	ctx, cancel := context.WithTimeout(ctx, m.maxTaskTimeout)
	defer cancel()
	_ = m.doSingleflight(ctx, groupID)
}

// doSingleflight guarantees only one active "ensure" per groupID at a time.
func (m *MemberSyncManager) doSingleflight(ctx context.Context, groupID string) error {
	var executed bool
	_, err, _ := m.sf.Do(groupID, func() (any, error) {
		m.mu.RLock()
		_, ok := m.seen[groupID]
		m.mu.RUnlock()
		if ok {
			return nil, nil
		}

		if err := m.handler(ctx, groupID); err != nil {
			log.ZWarn(ctx, "MemberSyncManager ensure failed", err, "groupID", groupID)
			return nil, err
		}
		executed = true
		return nil, nil
	})

	var hasPending bool
	m.mu.Lock()
	if _, ok := m.pending[groupID]; ok {
		delete(m.pending, groupID)
		hasPending = true
	}
	if err != nil {
		delete(m.seen, groupID)
	} else if executed && !hasPending {
		m.seen[groupID] = struct{}{}
	}
	delete(m.inQueue, groupID)
	m.mu.Unlock()

	if executed && hasPending {
		log.ZInfo(ctx, "MemberSyncManager processing pending ensure", "groupID", groupID)
		m.ForceEnsureAsync(ctx, groupID)
	}
	return err
}
