package hotcold

import (
	"context"
	"testing"
	"time"
)

type fakeHotKeyDB struct {
	data   map[string]map[string]int64
	saveN  int
	clearN int
}

func newFakeHotKeyDB() *fakeHotKeyDB {
	return &fakeHotKeyDB{
		data: make(map[string]map[string]int64),
	}
}

func (f *fakeHotKeyDB) LoadHotKeys(_ context.Context, namespace string) (map[string]int64, error) {
	src := f.data[namespace]
	dst := make(map[string]int64, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst, nil
}

func (f *fakeHotKeyDB) SaveHotKeys(_ context.Context, namespace string, data map[string]int64) error {
	dst := make(map[string]int64, len(data))
	for k, v := range data {
		dst[k] = v
	}
	f.data[namespace] = dst
	f.saveN++
	return nil
}

func (f *fakeHotKeyDB) ClearHotKeys(_ context.Context, namespace string) error {
	delete(f.data, namespace)
	f.clearN++
	return nil
}

func TestHotColdManager_PromoteAndFlush(t *testing.T) {
	ctx := context.Background()
	db := newFakeHotKeyDB()
	m := New(db, NamespaceConversation, 10)
	// Disable auto flush to make behavior deterministic.
	m.flushInterval = 0
	m.maxDirty = 0

	if err := m.Promote(ctx, "k1"); err != nil {
		t.Fatalf("Promote k1 failed: %v", err)
	}
	if err := m.Promote(ctx, "k2"); err != nil {
		t.Fatalf("Promote k2 failed: %v", err)
	}

	if err := m.Flush(ctx); err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	ns := string(NamespaceConversation)
	data, ok := db.data[ns]
	if !ok {
		t.Fatalf("no data persisted for namespace %q", ns)
	}
	if len(data) != 2 {
		t.Fatalf("expected 2 hot keys, got %d", len(data))
	}
	if _, ok := data["k1"]; !ok {
		t.Fatalf("expected key k1 to be persisted")
	}
	if _, ok := data["k2"]; !ok {
		t.Fatalf("expected key k2 to be persisted")
	}
	if db.saveN == 0 {
		t.Fatalf("expected at least one SaveHotKeys call")
	}
}

func TestHotColdManager_LoadRestoresState(t *testing.T) {
	ctx := context.Background()
	db := newFakeHotKeyDB()
	ns := string(NamespaceConversation)
	now := time.Now().UnixMilli()
	db.data[ns] = map[string]int64{
		"a": now - 1000,
		"b": now - 500,
	}

	m := New(db, NamespaceConversation, 10)
	m.flushInterval = 0
	m.maxDirty = 0

	if err := m.Load(ctx); err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if !m.IsHot("a") {
		t.Fatalf("expected key a to be hot after Load")
	}
	if !m.IsHot("b") {
		t.Fatalf("expected key b to be hot after Load")
	}

	keys := m.HotKeys()
	if len(keys) != 2 {
		t.Fatalf("expected 2 hot keys, got %d", len(keys))
	}
}

func TestHotColdManager_PromoteManyAndEvict(t *testing.T) {
	ctx := context.Background()
	db := newFakeHotKeyDB()
	m := New(db, NamespaceConversation, 2)
	m.flushInterval = 0
	m.maxDirty = 0

	if err := m.PromoteMany(ctx, []string{"k1", "k2"}); err != nil {
		t.Fatalf("PromoteMany failed: %v", err)
	}
	if err := m.Flush(ctx); err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	// Add another key to trigger eviction of the oldest one.
	if err := m.Promote(ctx, "k3"); err != nil {
		t.Fatalf("Promote k3 failed: %v", err)
	}
	if err := m.Flush(ctx); err != nil {
		t.Fatalf("Flush failed after k3: %v", err)
	}

	ns := string(NamespaceConversation)
	data := db.data[ns]
	if len(data) != 2 {
		t.Fatalf("expected 2 keys after eviction, got %d", len(data))
	}
	if _, ok := data["k3"]; !ok {
		t.Fatalf("expected k3 to remain hot after eviction")
	}
}

func TestHotColdManager_DemoteMany(t *testing.T) {
	ctx := context.Background()
	db := newFakeHotKeyDB()
	m := New(db, NamespaceConversation, 10)
	m.flushInterval = 0
	m.maxDirty = 0

	if err := m.PromoteMany(ctx, []string{"k1", "k2", "k3"}); err != nil {
		t.Fatalf("PromoteMany failed: %v", err)
	}
	if err := m.Flush(ctx); err != nil {
		t.Fatalf("Flush failed: %v", err)
	}

	if err := m.DemoteMany(ctx, []string{"k1", "k3"}); err != nil {
		t.Fatalf("DemoteMany failed: %v", err)
	}
	if err := m.Flush(ctx); err != nil {
		t.Fatalf("Flush after DemoteMany failed: %v", err)
	}

	ns := string(NamespaceConversation)
	data := db.data[ns]
	if len(data) != 1 {
		t.Fatalf("expected 1 key after demote, got %d", len(data))
	}
	if _, ok := data["k2"]; !ok {
		t.Fatalf("expected k2 to remain after demote")
	}
	if _, ok := data["k1"]; ok {
		t.Fatalf("expected k1 to be removed after demote")
	}
	if _, ok := data["k3"]; ok {
		t.Fatalf("expected k3 to be removed after demote")
	}
}
