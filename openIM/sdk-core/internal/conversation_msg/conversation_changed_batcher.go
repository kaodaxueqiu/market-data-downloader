package conversation_msg

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/openimsdk/tools/mcontext"
)

const (
	maxBatchConversationChanges     = 400
	minConversationAggregationDelay = 50 * time.Millisecond
	maxConversationAggregationDelay = time.Second
	conversationLowLoadWindow       = 10 * time.Second
	conversationLowLoadLimit        = 2
	conversationHighLoadLimit       = 200
)

type conversationChangeArrival struct {
	ts    time.Time
	count int
}

type ConversationChangedBatcher struct {
	mutex         sync.Mutex
	buffer        map[string]struct{}
	order         []string
	contexts      []context.Context
	handler       func(context.Context, []string) error
	flushTimer    *time.Timer
	nextFlushAt   time.Time
	arrivals      []conversationChangeArrival
	recentTotal   int
	firstBuffered time.Time
}

func NewConversationChangedBatcher(handler func(context.Context, []string) error) *ConversationChangedBatcher {
	return &ConversationChangedBatcher{handler: handler}
}

func (b *ConversationChangedBatcher) Close() {
	var (
		pending []string
		ctx     context.Context
		handler func(context.Context, []string) error
	)
	b.mutex.Lock()
	pending, ctx = b.consumeLocked()
	b.cancelTimerLocked()
	handler = b.handler
	b.handler = nil
	b.mutex.Unlock()
	dispatchConversationChanges(handler, ctx, pending)
}

func (b *ConversationChangedBatcher) dispatch(ctx context.Context, conversationIDs []string) error {
	return dispatchConversationChanges(b.handler, ctx, conversationIDs)
}

func dispatchConversationChanges(handler func(context.Context, []string) error, ctx context.Context, conversationIDs []string) error {
	if handler == nil || len(conversationIDs) == 0 {
		return nil
	}
	return handler(ctx, conversationIDs)
}

func (b *ConversationChangedBatcher) mergeLocked(conversationIDs []string) int {
	if len(conversationIDs) == 0 {
		return 0
	}
	if b.buffer == nil {
		b.buffer = make(map[string]struct{}, len(conversationIDs))
	}
	added := 0
	for _, conversationID := range conversationIDs {
		if conversationID == "" {
			continue
		}
		if _, ok := b.buffer[conversationID]; ok {
			continue
		}
		b.buffer[conversationID] = struct{}{}
		b.order = append(b.order, conversationID)
		added++
	}
	return added
}

func (b *ConversationChangedBatcher) consumeLocked() ([]string, context.Context) {
	if len(b.order) == 0 {
		return nil, nil
	}
	pending := append([]string(nil), b.order...)
	ctx := mergeOperationIDContexts(b.contexts)
	b.buffer = nil
	b.order = nil
	b.contexts = nil
	b.firstBuffered = time.Time{}
	return pending, ctx
}

func (b *ConversationChangedBatcher) pendingCountLocked() int {
	return len(b.order)
}

func (b *ConversationChangedBatcher) ensureTimerLocked(target time.Time) {
	delay := time.Until(target)
	if delay <= 0 {
		delay = time.Millisecond
		target = time.Now().Add(delay)
	}
	if b.flushTimer == nil {
		b.nextFlushAt = target
		b.flushTimer = time.AfterFunc(delay, b.onTimer)
		return
	}
	if target.Equal(b.nextFlushAt) {
		return
	}
	b.flushTimer.Stop()
	b.nextFlushAt = target
	b.flushTimer = time.AfterFunc(delay, b.onTimer)
}

func (b *ConversationChangedBatcher) cancelTimerLocked() {
	if b.flushTimer == nil {
		return
	}
	b.flushTimer.Stop()
	b.flushTimer = nil
	b.nextFlushAt = time.Time{}
}

func (b *ConversationChangedBatcher) onTimer() {
	b.mutex.Lock()
	pending, ctx := b.consumeLocked()
	b.flushTimer = nil
	b.nextFlushAt = time.Time{}
	b.mutex.Unlock()
	_ = b.dispatch(ctx, pending)
}

func (b *ConversationChangedBatcher) Enqueue(ctx context.Context, conversationIDs []string) error {
	conversationIDs = uniqueConversationIDs(conversationIDs)
	if len(conversationIDs) == 0 {
		return nil
	}

	var (
		toFlush  []string
		flushCtx context.Context
	)

	b.mutex.Lock()
	now := time.Now()
	recent := b.recordArrivalLocked(now, len(conversationIDs))

	if recent < conversationLowLoadLimit {
		toFlush, flushCtx = b.consumeLocked()
		b.cancelTimerLocked()
		b.mutex.Unlock()
		if err := b.dispatch(flushCtx, toFlush); err != nil {
			return err
		}
		return b.dispatch(ctx, conversationIDs)
	}

	b.contexts = append(b.contexts, ctx)
	b.mergeLocked(conversationIDs)
	if b.firstBuffered.IsZero() {
		b.firstBuffered = now
	}

	pendingCount := b.pendingCountLocked()
	if pendingCount >= maxBatchConversationChanges && recent < conversationHighLoadLimit {
		toFlush, flushCtx = b.consumeLocked()
		b.cancelTimerLocked()
	} else {
		elapsed := now.Sub(b.firstBuffered)
		totalDelay := b.computeDelayLocked(recent)
		targetFlush := b.firstBuffered.Add(totalDelay)
		if elapsed >= maxConversationAggregationDelay || elapsed >= totalDelay {
			toFlush, flushCtx = b.consumeLocked()
			b.cancelTimerLocked()
		} else if now.After(targetFlush) {
			toFlush, flushCtx = b.consumeLocked()
			b.cancelTimerLocked()
		} else {
			b.ensureTimerLocked(targetFlush)
		}
	}
	b.mutex.Unlock()

	return b.dispatch(flushCtx, toFlush)
}

func (b *ConversationChangedBatcher) recordArrivalLocked(now time.Time, count int) int {
	if count <= 0 {
		return b.recentTotal
	}
	cutoff := now.Add(-conversationLowLoadWindow)
	idx := 0
	for idx < len(b.arrivals) && b.arrivals[idx].ts.Before(cutoff) {
		b.recentTotal -= b.arrivals[idx].count
		idx++
	}
	if idx > 0 {
		copy(b.arrivals, b.arrivals[idx:])
		b.arrivals = b.arrivals[:len(b.arrivals)-idx]
	}
	b.arrivals = append(b.arrivals, conversationChangeArrival{ts: now, count: count})
	b.recentTotal += count
	return b.recentTotal
}

func (b *ConversationChangedBatcher) computeDelayLocked(recent int) time.Duration {
	if recent >= conversationHighLoadLimit {
		return maxConversationAggregationDelay
	}
	if recent <= conversationLowLoadLimit {
		return minConversationAggregationDelay
	}
	ratio := float64(recent-conversationLowLoadLimit) / float64(conversationHighLoadLimit-conversationLowLoadLimit)
	return minConversationAggregationDelay + time.Duration(ratio*float64(maxConversationAggregationDelay-minConversationAggregationDelay))
}

func mergeOperationIDContexts(ctxs []context.Context) context.Context {
	switch len(ctxs) {
	case 0:
		return context.Background()
	case 1:
		return ctxs[0]
	default:
		const prefix = "Batch_"
		var buf bytes.Buffer
		buf.WriteString(prefix)
		for _, ctx := range ctxs {
			operationID := mcontext.GetOperationID(ctx)
			if operationID != "" {
				buf.WriteString(operationID)
				buf.WriteString("$")
			}
		}
		data := buf.Bytes()
		if len(data) > len(prefix) {
			data = data[:len(data)-1]
		}
		return mcontext.SetOperationID(ctxs[0], string(data))
	}
}

func uniqueConversationIDs(conversationIDs []string) []string {
	if len(conversationIDs) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(conversationIDs))
	result := make([]string, 0, len(conversationIDs))
	for _, conversationID := range conversationIDs {
		if conversationID == "" {
			continue
		}
		if _, ok := seen[conversationID]; ok {
			continue
		}
		seen[conversationID] = struct{}{}
		result = append(result, conversationID)
	}
	return result
}
