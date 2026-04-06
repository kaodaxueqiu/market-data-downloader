package datasyncer

import (
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/json"
	"errors"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/utils/datautil"
	"gorm.io/gorm"
)

func getVersionSync(ctx context.Context, db db_interface.VersionSyncModel, table string, entityID string) (*model_struct.LocalVersionSync, error) {
	vl, err := db.GetVersionSync(ctx, table, entityID)
	if err != nil {
		if errs.ErrRecordNotFound.Is(err) || errors.Is(err, gorm.ErrRecordNotFound) {
			return &model_struct.LocalVersionSync{
				Table:    table,
				EntityID: entityID,
			}, nil
		}
		return nil, err
	}
	return vl, nil
}

func IdHash(ids []string) uint64 {
	if len(ids) == 0 {
		return 0
	}
	data, _ := json.Marshal(ids)
	sum := md5.Sum(data)
	return binary.BigEndian.Uint64(sum[:])
}

type toIDSnapshotIf interface {
	GetVersion() uint64
	GetVersionID() string
	GetEqual() bool
}

func toIDSnapshot(val toIDSnapshotIf, ids []string) *IDSnapshot {
	return &IDSnapshot{
		Version:   val.GetVersion(),
		VersionID: val.GetVersionID(),
		SameSet:   val.GetEqual(),
		IDs:       ids,
	}
}

type toDeltaIf[A any] interface {
	GetVersion() uint64
	GetVersionID() string
	GetFull() bool
	GetDelete() []string
	GetInsert() []A
	GetUpdate() []A
}

func toDelta[A, B any](val toDeltaIf[A], fn func(A) B) *Delta[B] {
	return toDeltaWithExtra(val, struct{}{}, fn)
}

func toDeltaWithExtra[A, B, Extra any](val toDeltaIf[A], extra Extra, fn func(A) B) *DeltaWithExtra[B, Extra] {
	return &DeltaWithExtra[B, Extra]{
		Version:       val.GetVersion(),
		VersionID:     val.GetVersionID(),
		RequireReseed: val.GetFull(),
		DeletedIDs:    val.GetDelete(),
		Inserted:      datautil.Slice(val.GetInsert(), fn),
		Updated:       datautil.Slice(val.GetUpdate(), fn),
		Extra:         extra,
	}
}

const defaultFetchPageSize = 500

func fetchByIDPages[V any](ctx context.Context, ids []string, pageSize int, fetch func(context.Context, []string) ([]V, error)) ([]V, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if pageSize <= 0 {
		pageSize = defaultFetchPageSize
	}
	result := make([]V, 0, len(ids))
	for start := 0; start < len(ids); start += pageSize {
		end := start + pageSize
		if end > len(ids) {
			end = len(ids)
		}
		chunk := ids[start:end]
		if len(chunk) == 0 {
			break
		}
		items, err := fetch(ctx, chunk)
		if err != nil {
			return nil, err
		}
		result = append(result, items...)
	}
	return result, nil
}

const chunkSize = 200

func chunkedInsert[V any](ctx context.Context, vs []V, fn func(ctx context.Context, vs []V) error) error {
	if len(vs) == 0 {
		return nil
	}
	for start := 0; start < len(vs); start += chunkSize {
		end := start + chunkSize
		if end > len(vs) {
			end = len(vs)
		}
		chunk := vs[start:end]
		if len(chunk) == 0 {
			break
		}
		if err := fn(ctx, chunk); err != nil {
			return err
		}
	}
	return nil

}
