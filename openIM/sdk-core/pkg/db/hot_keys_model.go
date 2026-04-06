//go:build !js
// +build !js

package db

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/errs"
)

func (d *DataBase) LoadHotKeys(ctx context.Context, namespace string) (map[string]int64, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()

	var records []model_struct.HotKey
	if err := d.conn.WithContext(ctx).Where("namespace = ?", namespace).Find(&records).Error; err != nil {
		return nil, errs.WrapMsg(err, "LoadHotKeys failed")
	}

	result := make(map[string]int64, len(records))
	for _, hk := range records {
		result[hk.Key] = hk.LastTouch
	}
	return result, nil
}

func (d *DataBase) SaveHotKeys(ctx context.Context, namespace string, data map[string]int64) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()

	tx := d.conn.WithContext(ctx).Begin()
	if tx.Error != nil {
		return errs.WrapMsg(tx.Error, "SaveHotKeys begin tx failed")
	}

	if err := tx.Where("namespace = ?", namespace).Delete(&model_struct.HotKey{}).Error; err != nil {
		tx.Rollback()
		return errs.WrapMsg(err, "SaveHotKeys delete failed")
	}

	if len(data) > 0 {
		records := make([]*model_struct.HotKey, 0, len(data))
		for k, ts := range data {
			records = append(records, &model_struct.HotKey{
				Namespace: namespace,
				Key:       k,
				LastTouch: ts,
			})
		}
		if err := tx.Create(&records).Error; err != nil {
			tx.Rollback()
			return errs.WrapMsg(err, "SaveHotKeys insert failed")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return errs.WrapMsg(err, "SaveHotKeys commit failed")
	}
	return nil
}

func (d *DataBase) ClearHotKeys(ctx context.Context, namespace string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()

	if err := d.conn.WithContext(ctx).Where("namespace = ?", namespace).Delete(&model_struct.HotKey{}).Error; err != nil {
		return errs.WrapMsg(err, "ClearHotKeys failed")
	}
	return nil
}
