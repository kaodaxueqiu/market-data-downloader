package indexdb

import (
	"context"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/wasm/exec"
)

func NewEvent(loginUserID string) *Event {
	return &Event{loginUserID: loginUserID}
}

type Event struct {
	loginUserID string
}

func (d *Event) InsertEvent(ctx context.Context, ev *model_struct.LocalEvent) error {
	_, err := exec.Exec(utils.StructToJsonString(ev))
	return err
}

func (d *Event) UpsertEventByDedupe(ctx context.Context, ev *model_struct.LocalEvent) error {
	_, err := exec.Exec(utils.StructToJsonString(ev))
	return err
}

func (d *Event) ClaimNextEvent(ctx context.Context, netOK bool, nowMS int64, workerID string, leaseTTL time.Duration) (*model_struct.LocalEvent, error) {
	c, err := exec.Exec(netOK, nowMS, workerID, int64(leaseTTL), d.loginUserID)
	if err != nil {
		return nil, err
	} else {
		if v, ok := c.(string); ok {
			result := model_struct.LocalEvent{}
			err := utils.JsonStringToStruct(v, &result)
			if err != nil {
				return nil, err
			}
			return &result, err
		} else {
			return nil, exec.ErrType
		}
	}
}

func (d *Event) CompleteEvent(ctx context.Context, id string) error {
	_, err := exec.Exec(id, d.loginUserID)
	return err
}

func (d *Event) FailEvent(ctx context.Context, id string, attempts int, lastError string, nextRunMS int64, state string) error {
	_, err := exec.Exec(id, attempts, lastError, nextRunMS, state, d.loginUserID)
	return err
}

func (d *Event) RecoverExpiredLeases(ctx context.Context, nowMS int64) (int64, error) {
	count, err := exec.Exec(nowMS, d.loginUserID)
	if err != nil {
		return 0, err
	}
	if v, ok := count.(float64); ok {
		return int64(v), nil
	}
	return 0, exec.ErrType
}

func (d *Event) PurgeCompletedEvents(ctx context.Context, beforeMS int64) (int64, error) {
	count, err := exec.Exec(beforeMS, d.loginUserID)
	if err != nil {
		return 0, err
	}
	if v, ok := count.(float64); ok {
		return int64(v), nil
	}
	return 0, exec.ErrType
}
