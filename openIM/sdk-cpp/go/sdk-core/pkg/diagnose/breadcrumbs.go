package diagnose

import (
	"sync"
	"time"
)

type BreadcrumbRing struct {
	mu   sync.Mutex
	buf  []Breadcrumb
	next int
	full bool
}

func NewBreadcrumbRing(capacity int) *BreadcrumbRing {
	if capacity < 32 {
		capacity = 32
	}
	return &BreadcrumbRing{buf: make([]Breadcrumb, capacity)}
}

func (r *BreadcrumbRing) Add(level, event string, fields map[string]string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.buf[r.next] = Breadcrumb{
		FormattedTs: time.Now().Format("2006-01-02 15:04:05.999"),
		Level:       level,
		Event:       event,
		Fields:      fields,
	}
	r.next++
	if r.next >= len(r.buf) {
		r.next = 0
		r.full = true
	}
}

func (r *BreadcrumbRing) AddKV(level, event string, kv ...string) {
	fields := make(map[string]string)
	for i := 0; i+1 < len(kv); i += 2 {
		fields[kv[i]] = kv[i+1]
	}
	if len(kv)%2 == 1 {
		fields["_kv_error"] = "odd_kv_count"
		fields["_kv_tail"] = kv[len(kv)-1]
	}
	r.Add(level, event, fields)
}

func (r *BreadcrumbRing) Snapshot() []Breadcrumb {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.full {
		out := make([]Breadcrumb, r.next)
		copy(out, r.buf[:r.next])
		return out
	}

	// Return in chronological order when the ring has wrapped.
	out := make([]Breadcrumb, 0, len(r.buf))
	out = append(out, r.buf[r.next:]...)
	out = append(out, r.buf[:r.next]...)
	return out
}
