package hotcold

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
)

type Namespace string

const (
	NamespaceConversation Namespace = "conversation"
)

type entry struct {
	lastTouch int64
}

// HotColdManager keeps track of "hot" keys in memory with an LRU-like policy
// and periodically persists their last-touch timestamps to the underlying DB
// using a namespaced hot_keys table. It is designed to be used on read-heavy
// paths (such as conversation lists) with batched and rate-limited DB writes.
type HotColdManager struct {
	mu sync.Mutex

	hot           map[string]*entry
	limit         int
	db            db_interface.HotKeyModel
	namespace     Namespace
	clock         func() int64
	flushInterval time.Duration
	maxDirty      int
	lastFlushMS   int64
	dirtyCount    int
}

func New(
	db db_interface.HotKeyModel,
	namespace Namespace,
	limit int,
) *HotColdManager {
	return &HotColdManager{
		hot:       make(map[string]*entry),
		limit:     limit,
		db:        db,
		namespace: namespace,
		clock: func() int64 {
			return time.Now().UnixMilli()
		},
		flushInterval: 10 * time.Second,
		maxDirty:      100,
	}
}
func (m *HotColdManager) Load(ctx context.Context) error {
	if m.db == nil {
		return nil
	}

	data, err := m.db.LoadHotKeys(ctx, string(m.namespace))
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.hot = make(map[string]*entry, len(data))
	for k, ts := range data {
		m.hot[k] = &entry{lastTouch: ts}
	}
	return nil
}

func (m *HotColdManager) Promote(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.clock()

	if e, ok := m.hot[key]; ok {
		e.lastTouch = now
	} else {
		m.hot[key] = &entry{lastTouch: now}
	}

	m.evictIfNeededLocked()
	m.markDirtyLocked(1)
	return m.maybeFlushLocked(ctx)
}
func (m *HotColdManager) Demote(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.hot, key)
	m.markDirtyLocked(1)
	return m.maybeFlushLocked(ctx)
}

func (m *HotColdManager) PromoteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.clock()

	for _, key := range keys {
		if key == "" {
			continue
		}
		if e, ok := m.hot[key]; ok {
			e.lastTouch = now
		} else {
			m.hot[key] = &entry{lastTouch: now}
		}
	}

	m.evictIfNeededLocked()
	m.markDirtyLocked(len(keys))
	return m.maybeFlushLocked(ctx)
}

func (m *HotColdManager) DemoteMany(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, key := range keys {
		if key == "" {
			continue
		}
		delete(m.hot, key)
	}

	m.markDirtyLocked(len(keys))
	return m.maybeFlushLocked(ctx)
}

func (m *HotColdManager) Clear(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.hot = make(map[string]*entry)
	m.dirtyCount = 0
	if m.db != nil {
		if err := m.db.ClearHotKeys(ctx, string(m.namespace)); err != nil {
			return err
		}
		m.lastFlushMS = m.clock()
	}
	return nil
}

func (m *HotColdManager) IsHot(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	e, ok := m.hot[key]
	if ok {
		// touch but do not persist (avoid thrashing)
		e.lastTouch = m.clock()
	}
	return ok
}

func (m *HotColdManager) HotKeys() []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	keys := make([]string, 0, len(m.hot))
	for k := range m.hot {
		keys = append(keys, k)
	}
	return keys
}

func (m *HotColdManager) evictIfNeededLocked() {
	if m.limit <= 0 || len(m.hot) <= m.limit {
		return
	}

	type kv struct {
		key string
		ts  int64
	}

	items := make([]kv, 0, len(m.hot))
	for k, v := range m.hot {
		items = append(items, kv{k, v.lastTouch})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ts < items[j].ts
	})

	// evict oldest items
	for i := 0; i < len(items)-m.limit; i++ {
		delete(m.hot, items[i].key)
	}
}

func (m *HotColdManager) markDirtyLocked(delta int) {
	if delta <= 0 {
		return
	}
	m.dirtyCount += delta
}

func (m *HotColdManager) maybeFlushLocked(ctx context.Context) error {
	if m.db == nil {
		return nil
	}

	now := m.clock()
	if m.lastFlushMS == 0 {
		m.lastFlushMS = now
	}

	intervalExceeded := m.flushInterval > 0 && now-m.lastFlushMS >= m.flushInterval.Milliseconds()
	thresholdExceeded := m.maxDirty > 0 && m.dirtyCount >= m.maxDirty

	if !intervalExceeded && !thresholdExceeded {
		return nil
	}

	if err := m.persistLocked(ctx); err != nil {
		return err
	}
	m.lastFlushMS = now
	m.dirtyCount = 0
	return nil
}

func (m *HotColdManager) Flush(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.db == nil {
		return nil
	}

	if err := m.persistLocked(ctx); err != nil {
		return err
	}
	m.lastFlushMS = m.clock()
	m.dirtyCount = 0
	return nil
}

func (m *HotColdManager) persistLocked(ctx context.Context) error {
	if m.db == nil {
		return nil
	}

	data := make(map[string]int64, len(m.hot))
	for k, v := range m.hot {
		data[k] = v.lastTouch
	}
	return m.db.SaveHotKeys(ctx, string(m.namespace), data)
}
