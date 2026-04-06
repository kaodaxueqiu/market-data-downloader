package datasyncer

import (
	"context"
)

type disableEventContextKey struct{}

func withContextDisableEvent(ctx context.Context, disable bool) context.Context {
	return context.WithValue(ctx, disableEventContextKey{}, disable)
}

func isDisableEvent(ctx context.Context) bool {
	disable, _ := ctx.Value(disableEventContextKey{}).(bool)
	return disable
}

type reseedSyncContextKey struct{}

func withContextReseedSync(ctx context.Context, rs bool) context.Context {
	return context.WithValue(ctx, reseedSyncContextKey{}, rs)
}

func isReseedSync(ctx context.Context) bool {
	rs, _ := ctx.Value(reseedSyncContextKey{}).(bool)
	return rs
}
