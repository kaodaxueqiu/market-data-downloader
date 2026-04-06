package file

import (
	"context"
	"errors"
	"github.com/openimsdk/tools/mcontext"
	"testing"
	"time"
)

func TestName(t *testing.T) {
	ctx := mcontext.SetOperationID(context.Background(), "1234")
	m := newCancelMap()
	ctx, cancel := m.WithCancel(ctx)
	go func() {
		<-ctx.Done()
		t.Log("====>ctx done", context.Cause(ctx))
	}()

	time.Sleep(time.Second / 10)
	m.CancelOperationID("1234", errors.New("test error"))
	time.Sleep(time.Second / 10)
	cancel()
	t.Log()
	time.Sleep(time.Second / 100)
}
