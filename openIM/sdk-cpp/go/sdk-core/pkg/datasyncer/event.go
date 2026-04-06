package datasyncer

import "context"

type Event[V any] interface {
	// OnInsert triggers an insert operation
	OnInsert(ctx context.Context, v V)
	// OnDelete triggers a delete operation
	OnDelete(ctx context.Context, v V)
	// OnUpdate triggers an update operation, where lv is local data and sv is server-side data
	OnUpdate(ctx context.Context, lv, sv V)
}

type NopEvent[V any] struct{}

func (NopEvent[V]) OnInsert(ctx context.Context, v V) {}

func (NopEvent[V]) OnDelete(ctx context.Context, v V) {}

func (NopEvent[V]) OnUpdate(ctx context.Context, lv, sv V) {}
