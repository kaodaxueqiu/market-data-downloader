package httpclient

import (
	"context"
	"time"
)

func newResultResponse() *resultResponse {
	return &resultResponse{
		Done: make(chan struct{}),
	}
}

type resultResponse struct {
	success bool
	Value   *cacheMate
	Err     error
	Done    chan struct{}
}

func (r *resultResponse) GetDone() <-chan struct{} {
	if r == nil {
		return nil
	}
	return r.Done
}

func (r *resultResponse) Result(ctx context.Context, host string) (*cacheMate, error) {
	select {
	case <-ctx.Done():
		return nil, context.Cause(ctx)
	case <-r.Done:
		if r.Err != nil {
			return nil, r.Err
		}
		return r.Value, nil
	}
}

func (r *resultResponse) GetResult() (*cacheMate, bool) {
	if r == nil {
		return nil, false
	}
	select {
	case <-r.Done:
		if r.Err == nil {
			return r.Value, true
		}
	default:
	}
	return nil, false
}

func (r *resultResponse) NegotiatedProtocol() (string, bool) {
	select {
	case <-r.Done:
		if r.Err == nil {
			return r.Value.negotiatedProtocol, true
		}
	default:
	}
	return "", false
}

func (r *resultResponse) SetResult(value *cacheMate, err error) {
	r.Value = value
	r.Err = err
	close(r.Done)
}

type cacheMate struct {
	cost               time.Duration
	negotiatedProtocol string
}

func newTryResult() *tryResult {
	return &tryResult{
		Resp: newResultResponse(),
	}
}

type tryResult struct {
	time time.Time
	Resp *resultResponse
}

func (r *tryResult) IsFailed() bool {
	return r.Resp == nil || r.Resp.success == false
}
