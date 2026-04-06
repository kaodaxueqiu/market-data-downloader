package relation

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/tools/utils/datautil"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func (r *Relation) syncBlackList(ctx context.Context, withEvent bool) error {
	serverData, err := r.getBlackList(ctx)
	if err != nil {
		return err
	}
	localData, err := r.db.GetBlackListDB(ctx)
	if err != nil {
		return err
	}
	localMap := datautil.SliceToMap(localData, func(item *model_struct.LocalBlack) string {
		return item.BlockUserID
	})
	for _, datum := range serverData {
		sv := converter.ServerBlackToLocal(datum)
		if lv, ok := localMap[datum.BlackUserInfo.UserID]; ok {
			delete(localMap, datum.BlackUserInfo.UserID)
			if *lv == *sv {
				continue
			}
			if err := r.db.UpdateBlack(ctx, sv); err != nil {
				return err
			}
		} else {
			if err := r.db.InsertBlack(ctx, sv); err != nil {
				return err
			}
			if withEvent {
				r.friendshipListener.OnBlackAdded(*sv)
			}
		}
	}
	for _, black := range localMap {
		if err := r.db.DeleteBlack(ctx, black.BlockUserID); err != nil {
			return err
		}
		if withEvent {
			r.friendshipListener.OnBlackDeleted(*black)
		}
	}
	return nil
}

func (r *Relation) SyncAllBlackList(ctx context.Context) error {
	return r.syncBlackList(ctx, true)
}

func (r *Relation) SyncAllBlackListWithoutNotice(ctx context.Context) error {
	return r.syncBlackList(ctx, false)
}
