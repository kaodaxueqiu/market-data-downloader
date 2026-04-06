package cache

import (
	"context"
	"sync"
	"time"
)

// SingleCache caches a single key with single-flight loading.
type SingleCache[V any] struct {
	mu          sync.Mutex
	value       V
	hasValue    bool
	expiresAt   time.Time
	inflight    chan struct{}
	inflightGen uint64
	lastErr     error
	lastErrGen  uint64
}

func NewSingleCache[V any]() *SingleCache[V] {
	return &SingleCache[V]{}
}

func (c *SingleCache[V]) Get(ctx context.Context, loader func(context.Context) (V, time.Duration, error)) (V, error) {
	var zero V
	for {
		now := time.Now()
		c.mu.Lock()
		if c.hasValue && now.Before(c.expiresAt) {
			val := c.value
			c.mu.Unlock()
			return val, nil
		}
		if c.inflight != nil {
			ch := c.inflight
			gen := c.inflightGen
			c.mu.Unlock()
			select {
			case <-ch:
			case <-ctx.Done():
				return zero, ctx.Err()
			}
			c.mu.Lock()
			if c.hasValue && time.Now().Before(c.expiresAt) {
				val := c.value
				c.mu.Unlock()
				return val, nil
			}
			if c.lastErr != nil && c.lastErrGen == gen {
				err := c.lastErr
				c.mu.Unlock()
				return zero, err
			}
			c.mu.Unlock()
			continue
		}

		c.inflight = make(chan struct{})
		c.inflightGen++
		gen := c.inflightGen
		c.lastErr = nil
		c.lastErrGen = 0
		c.mu.Unlock()

		val, ttl, err := loader(ctx)

		c.mu.Lock()
		ch := c.inflight
		c.inflight = nil
		if err == nil && ttl > 0 {
			c.value = val
			c.hasValue = true
			c.expiresAt = time.Now().Add(ttl)
		} else {
			c.hasValue = false
			c.expiresAt = time.Time{}
		}
		if err != nil {
			c.lastErr = err
			c.lastErrGen = gen
		}
		c.mu.Unlock()
		close(ch)

		if err != nil {
			return zero, err
		}
		return val, nil
	}
}
