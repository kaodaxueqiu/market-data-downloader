package conversation_msg

import (
	"context"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/hotcold"
	"github.com/openimsdk/tools/log"
)

// ColdConversationHandler is invoked for conversations that are considered "cold".
// The handler should perform any necessary server-side sync or reconciliation for
// the provided conversationIDs (e.g., hash-based diff, metadata refresh).
type ColdConversationHandler func(ctx context.Context, conversationIDs []string) error

type ConversationHotSyncManager struct {
	hot     *hotcold.HotColdManager
	handler ColdConversationHandler

	mu         sync.Mutex
	inQueue    map[string]struct{}
	lastSynced map[string]int64

	queue          chan []string
	workers        int
	chunkSize      int
	cooldown       time.Duration
	maxTaskTimeout time.Duration
}

type ConversationHotSyncOption func(*ConversationHotSyncManager)

func WithConversationHotSyncWorkers(n int) ConversationHotSyncOption {
	return func(m *ConversationHotSyncManager) {
		if n > 0 {
			m.workers = n
		}
	}
}

func WithConversationHotSyncQueueSize(n int) ConversationHotSyncOption {
	return func(m *ConversationHotSyncManager) {
		if n > 0 {
			m.queue = make(chan []string, n)
		}
	}
}

func WithConversationHotSyncChunkSize(n int) ConversationHotSyncOption {
	return func(m *ConversationHotSyncManager) {
		if n > 0 {
			m.chunkSize = n
		}
	}
}

func WithConversationHotSyncCooldown(d time.Duration) ConversationHotSyncOption {
	return func(m *ConversationHotSyncManager) {
		if d > 0 {
			m.cooldown = d
		}
	}
}

func WithConversationHotSyncTaskTimeout(d time.Duration) ConversationHotSyncOption {
	return func(m *ConversationHotSyncManager) {
		if d > 0 {
			m.maxTaskTimeout = d
		}
	}
}

func NewConversationHotSyncManager(
	hot *hotcold.HotColdManager,
	handler ColdConversationHandler,
	opts ...ConversationHotSyncOption,
) *ConversationHotSyncManager {
	m := &ConversationHotSyncManager{
		hot:            hot,
		handler:        handler,
		inQueue:        make(map[string]struct{}),
		lastSynced:     make(map[string]int64),
		queue:          make(chan []string, 32),
		workers:        2,
		chunkSize:      50,
		cooldown:       30 * time.Second,
		maxTaskTimeout: 10 * time.Second,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

// Run starts background workers and blocks until ctx is canceled.
// Should be called once per user-login lifecycle.
func (m *ConversationHotSyncManager) Run(ctx context.Context) {
	for i := 0; i < m.workers; i++ {
		go m.worker(ctx)
	}
}

func (m *ConversationHotSyncManager) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			log.ZInfo(ctx, "ConversationHotSyncManager worker exiting, sdk logout.....")
			return
		case first := <-m.queue:
			m.ensureBatchNow(ctx, first)
		}
	}
}

// Promote marks a single conversation as hot.
func (m *ConversationHotSyncManager) Promote(ctx context.Context, conversationID string) error {
	return m.hot.Promote(ctx, conversationID)
}

// PromoteMany marks multiple conversations as hot in a single critical section.
func (m *ConversationHotSyncManager) PromoteMany(ctx context.Context, conversationIDs []string) error {
	return m.hot.PromoteMany(ctx, conversationIDs)
}

// Load initializes hot conversations from persistent storage.
func (m *ConversationHotSyncManager) Load(ctx context.Context) error {
	return m.hot.Load(ctx)
}

// Clear resets all hot conversations and clears persisted hot_keys for the namespace.
func (m *ConversationHotSyncManager) Clear(ctx context.Context) error {
	m.mu.Lock()
	m.inQueue = make(map[string]struct{})
	m.lastSynced = make(map[string]int64)
	m.mu.Unlock()
	return m.hot.Clear(ctx)
}

// HotKeys returns all currently hot conversationIDs.
func (m *ConversationHotSyncManager) HotKeys() []string {
	return m.hot.HotKeys()
}

// IsHot reports whether the given conversation is currently hot.
func (m *ConversationHotSyncManager) IsHot(conversationID string) bool {
	return m.hot.IsHot(conversationID)
}

// IsHotBatch returns a map keyed by conversationID indicating hot status.
func (m *ConversationHotSyncManager) IsHotBatch(conversationIDs []string) map[string]bool {
	result := make(map[string]bool, len(conversationIDs))
	for _, id := range conversationIDs {
		if id == "" {
			continue
		}
		result[id] = m.hot.IsHot(id)
	}
	return result
}

// EnsureAsync evaluates a batch of conversationIDs, promotes them as hot in memory,
// and schedules cold conversations for background sync via handler.
func (m *ConversationHotSyncManager) EnsureAsync(ctx context.Context, conversationIDs []string) {
	if len(conversationIDs) == 0 {
		return
	}

	now := time.Now().UnixMilli()

	cold := make([]string, 0, len(conversationIDs))
	m.mu.Lock()
	for _, id := range conversationIDs {
		if id == "" {
			continue
		}

		// Hot conversations do not need background sync.
		if m.hot.IsHot(id) {
			continue
		}

		// Respect cooldown for cold conversations.
		if last, ok := m.lastSynced[id]; ok && m.cooldown > 0 {
			if now-last < m.cooldown.Milliseconds() {
				continue
			}
		}

		// Avoid enqueuing the same conversation concurrently.
		if _, ok := m.inQueue[id]; ok {
			continue
		}

		m.inQueue[id] = struct{}{}
		cold = append(cold, id)
	}
	m.mu.Unlock()

	if len(cold) == 0 {
		return
	}

	chunkSize := m.chunkSize
	if chunkSize <= 0 {
		chunkSize = len(cold)
	}

	for start := 0; start < len(cold); start += chunkSize {
		end := start + chunkSize
		if end > len(cold) {
			end = len(cold)
		}
		chunk := cold[start:end]
		if len(chunk) == 0 {
			continue
		}

		select {
		case m.queue <- chunk:
		default:
			// Queue is full; fall back to a best-effort fire-and-forget attempt.
			go m.ensureBatchNow(context.Background(), chunk)
		}
	}
}

// EnsureSync forces a foreground sync for the provided conversations.
// Use sparingly when the caller must guarantee up-to-date state.
func (m *ConversationHotSyncManager) EnsureSync(ctx context.Context, conversationIDs []string) error {
	if len(conversationIDs) == 0 || m.handler == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, m.maxTaskTimeout)
	defer cancel()
	if err := m.handler(ctx, conversationIDs); err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	m.mu.Lock()
	for _, id := range conversationIDs {
		if id == "" {
			continue
		}
		m.lastSynced[id] = now
	}
	m.mu.Unlock()
	return nil
}

func (m *ConversationHotSyncManager) ensureBatchNow(ctx context.Context, conversationIDs []string) {
	if len(conversationIDs) == 0 || m.handler == nil {
		return
	}

	// Prevent outer cancellation from abruptly terminating the sync,
	// but still enforce a per-task timeout.
	ctx = context.WithoutCancel(ctx)
	ctx, cancel := context.WithTimeout(ctx, m.maxTaskTimeout)
	defer cancel()

	err := m.handler(ctx, conversationIDs)

	now := time.Now().UnixMilli()

	m.mu.Lock()
	if err != nil {
		log.ZWarn(ctx, "ConversationHotSyncManager ensure failed", err, "conversationIDs", conversationIDs)
	} else {
		for _, id := range conversationIDs {
			if id == "" {
				continue
			}
			m.lastSynced[id] = now
		}
	}
	for _, id := range conversationIDs {
		delete(m.inQueue, id)
	}
	m.mu.Unlock()
}
