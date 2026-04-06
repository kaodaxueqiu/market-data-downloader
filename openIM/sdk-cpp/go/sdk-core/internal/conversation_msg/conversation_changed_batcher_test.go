package conversation_msg

import (
	"context"
	"reflect"
	"testing"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/ccontext"
	"github.com/openimsdk/tools/mcontext"
)

func TestConversationChangedBatcherDeduplicatesAndMergesOperationIDs(t *testing.T) {
	type batch struct {
		ctx context.Context
		ids []string
	}

	got := make(chan batch, 1)
	batcher := NewConversationChangedBatcher(func(ctx context.Context, conversationIDs []string) error {
		got <- batch{
			ctx: ctx,
			ids: append([]string(nil), conversationIDs...),
		}
		return nil
	})

	ctx1 := ccontext.WithOperationID(context.Background(), "op-1")
	ctx2 := ccontext.WithOperationID(context.Background(), "op-2")

	seed := make([]string, 0, conversationLowLoadLimit)
	for i := 0; i < conversationLowLoadLimit; i++ {
		seed = append(seed, string(rune('a'+i)))
	}

	if err := batcher.Enqueue(ctx1, seed); err != nil {
		t.Fatalf("first enqueue failed: %v", err)
	}
	if err := batcher.Enqueue(ctx2, []string{"b", "z"}); err != nil {
		t.Fatalf("second enqueue failed: %v", err)
	}

	batcher.Close()

	select {
	case batch := <-got:
		if !reflect.DeepEqual(batch.ids, append(seed, "z")) {
			t.Fatalf("conversationIDs mismatch: got %v", batch.ids)
		}
		if opID := mcontext.GetOperationID(batch.ctx); opID != "Batch_op-1$op-2" {
			t.Fatalf("operationID mismatch: got %q", opID)
		}
	default:
		t.Fatal("expected a flushed batch")
	}
}
