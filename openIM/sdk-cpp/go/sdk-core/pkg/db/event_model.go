//go:build !js
// +build !js

package db

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/errs"
)

// InsertEvent insert a pending event
func (d *DataBase) InsertEvent(ctx context.Context, ev *model_struct.LocalEvent) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	return errs.WrapMsg(d.conn.WithContext(ctx).Create(ev).Error, "InsertEvent failed")
}

// UpsertEventByDedupe merge by dedupe_key (payload last-writer-wins / earlier run_at / higher priority)
// Avoid raw SQL; use GORM OnConflict
func (d *DataBase) UpsertEventByDedupe(ctx context.Context, ev *model_struct.LocalEvent) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()

	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "dedupe_key"}},
				DoUpdates: clause.Assignments(map[string]any{
					"payload":    ev.Payload,
					"run_at":     gorm.Expr("MIN(run_at, ?)", ev.RunAt),
					"priority":   gorm.Expr("MIN(priority, ?)", ev.Priority),
					"updated_at": ev.UpdatedAt,
				}),
			}).
			Create(ev).Error,
		"UpsertEventByDedupe failed",
	)
}

// ClaimNextEvent select a pending and due event by priority, acquire lease, return
// Note: avoid raw SQL; use two-step conditional update to ensure claiming; if rows affected=0, it was claimed elsewhere
func (d *DataBase) ClaimNextEvent(ctx context.Context, netOK bool, nowMS int64, workerID string, leaseTTL time.Duration) (*model_struct.LocalEvent, error) {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()

	// 1) Query candidate ID (order by priority/run_at/created_at)
	q := d.conn.WithContext(ctx).
		Model(&model_struct.LocalEvent{}).
		Where("state = ? AND run_at <= ?", "pending", nowMS)
	if !netOK {
		q = q.Where("requires_network = ?", false)
	}
	var candidate model_struct.LocalEvent
	if err := q.Order("priority ASC").
		Order("run_at ASC").
		Order("created_at ASC").
		Limit(1).
		Take(&candidate).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, errs.WrapMsg(err, "ClaimNextEvent query candidate failed")
	}

	// 2) Conditional update to processing (atomic claim)
	leaseExp := time.Now().Add(leaseTTL).UnixMilli()
	up := d.conn.WithContext(ctx).
		Model(&model_struct.LocalEvent{}).
		Where("id = ? AND state = ?", candidate.ID, "pending").
		Updates(map[string]any{
			"state":            "processing",
			"lease_owner":      workerID,
			"lease_expires_at": leaseExp,
			"updated_at":       nowMS,
		})
	if up.Error != nil {
		return nil, errs.WrapMsg(up.Error, "ClaimNextEvent update failed")
	}
	if up.RowsAffected == 0 {
		// Claimed by another worker
		return nil, nil
	}

	// 3) Populate updated fields and return candidate (or re-query)
	candidate.State = "processing"
	candidate.LeaseOwner = workerID
	candidate.LeaseExpiresAt = &leaseExp
	candidate.UpdatedAt = nowMS
	return &candidate, nil
}

func (d *DataBase) CompleteEvent(ctx context.Context, id string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	now := time.Now().UnixMilli()
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Model(&model_struct.LocalEvent{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"state":      "done",
				"updated_at": now,
			}).Error,
		"CompleteEvent failed",
	)
}

func (d *DataBase) FailEvent(ctx context.Context, id string, attempts int, lastError string, nextRunMS int64, state string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	now := time.Now().UnixMilli()
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Model(&model_struct.LocalEvent{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"state":            state,
				"attempts":         attempts,
				"last_error":       lastError,
				"run_at":           nextRunMS,
				"lease_owner":      nil,
				"lease_expires_at": nil,
				"updated_at":       now,
			}).Error,
		"FailEvent failed",
	)
}

func (d *DataBase) RecoverExpiredLeases(ctx context.Context, nowMS int64) (int64, error) {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	up := d.conn.WithContext(ctx).
		Model(&model_struct.LocalEvent{}).
		Where("state = ? AND lease_expires_at IS NOT NULL AND lease_expires_at < ?", "processing", nowMS).
		Updates(map[string]any{
			"state":            "pending",
			"lease_owner":      nil,
			"lease_expires_at": nil,
			"updated_at":       nowMS,
		})
	return up.RowsAffected, errs.WrapMsg(up.Error, "RecoverExpiredLeases failed")
}

// PurgeCompletedEvents deletes done/dead events with updated_at earlier than beforeMS
func (d *DataBase) PurgeCompletedEvents(ctx context.Context, beforeMS int64) (int64, error) {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	del := d.conn.WithContext(ctx).
		Where("state IN ? AND updated_at < ?", []string{"done", "dead"}, beforeMS).
		Delete(&model_struct.LocalEvent{})
	return del.RowsAffected, errs.WrapMsg(del.Error, "PurgeCompletedEvents failed")
}
