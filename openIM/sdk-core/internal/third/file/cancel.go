package file

import (
	"context"
	"sync"
	"sync/atomic"
)

func newCancelMap() *cancelMap {
	return &cancelMap{
		data: make(map[string]map[uint64]context.CancelCauseFunc),
	}
}

type cancelMap struct {
	mu   sync.Mutex
	data map[string]map[uint64]context.CancelCauseFunc
	incr atomic.Uint64
}

func (m *cancelMap) retCancel(operationID string, value uint64, cancel context.CancelCauseFunc) context.CancelFunc {
	return func() {
		cancel(context.Canceled)
		m.mu.Lock()
		defer m.mu.Unlock()
		res, ok := m.data[operationID]
		if !ok {
			return
		}
		cc, ok := res[value]
		if !ok {
			return
		}
		delete(res, value)
		if len(res) == 0 {
			delete(m.data, operationID)
		}
		cc(context.Canceled)
	}
}

func (m *cancelMap) WithCancel(ctx context.Context, cancelID string) (context.Context, context.CancelFunc) {
	value := m.incr.Add(1)
	ctx, cancel := context.WithCancelCause(ctx)
	m.mu.Lock()
	defer m.mu.Unlock()
	res, ok := m.data[cancelID]
	if !ok {
		res = make(map[uint64]context.CancelCauseFunc)
		m.data[cancelID] = res
	}
	res[value] = cancel
	return ctx, m.retCancel(cancelID, value, cancel)
}

func (m *cancelMap) CancelID(cancelID string, err error) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	res, ok := m.data[cancelID]
	if !ok {
		return 0
	}
	n := len(res)
	for _, causeFunc := range res {
		causeFunc(err)
	}
	delete(m.data, cancelID)
	return n
}
