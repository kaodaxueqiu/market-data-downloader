package diagnose

import "testing"

func TestBreadcrumbRingSnapshotOrder(t *testing.T) {
	r := &BreadcrumbRing{buf: make([]Breadcrumb, 3)}
	r.Add("info", "e1", nil)
	r.Add("info", "e2", nil)
	r.Add("info", "e3", nil)
	r.Add("info", "e4", nil)
	r.Add("info", "e5", nil)

	snap := r.Snapshot()
	if len(snap) != 3 {
		t.Fatalf("expected 3 breadcrumbs, got %d", len(snap))
	}
	if snap[0].Event != "e3" || snap[1].Event != "e4" || snap[2].Event != "e5" {
		t.Fatalf("unexpected order: %v, %v, %v", snap[0].Event, snap[1].Event, snap[2].Event)
	}
}

func TestBreadcrumbRingAddKVOdd(t *testing.T) {
	r := NewBreadcrumbRing(32)
	r.AddKV("info", "evt", "k1", "v1", "tail")
	snap := r.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("expected 1 breadcrumb, got %d", len(snap))
	}
	fields := snap[0].Fields
	if fields["k1"] != "v1" {
		t.Fatalf("expected k1=v1, got %q", fields["k1"])
	}
	if fields["_kv_error"] != "odd_kv_count" {
		t.Fatalf("expected _kv_error, got %q", fields["_kv_error"])
	}
	if fields["_kv_tail"] != "tail" {
		t.Fatalf("expected _kv_tail=tail, got %q", fields["_kv_tail"])
	}
}
