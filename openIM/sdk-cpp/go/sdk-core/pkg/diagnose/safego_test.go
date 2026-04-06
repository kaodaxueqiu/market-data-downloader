package diagnose

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

type testHandler struct {
	called int32
}

func (h *testHandler) HandlePanic(ctx context.Context, p any) {
	atomic.AddInt32(&h.called, 1)
}

func TestSafeGoRunsFunction(t *testing.T) {
	done := make(chan struct{})
	SafeGo(context.Background(), nil, func() {
		close(done)
	})
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("timeout waiting for SafeGo")
	}
}

func TestSafeGoNoPanicNoHandlerCall(t *testing.T) {
	h := &testHandler{}
	done := make(chan struct{})
	SafeGo(context.Background(), h, func() {
		close(done)
	})
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("timeout waiting for SafeGo")
	}
	if atomic.LoadInt32(&h.called) != 0 {
		t.Fatalf("expected handler not called")
	}
}
