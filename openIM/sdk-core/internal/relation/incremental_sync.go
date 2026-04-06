package relation

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/datasyncer"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
)

func (r *Relation) IncrSyncFriends(ctx context.Context) error {
	return r.incrSyncFriends(ctx, false)
}

func (r *Relation) IncrSyncFriendsWithoutEvent(ctx context.Context) error {
	return r.incrSyncFriends(ctx, true)
}

func (r *Relation) incrSyncFriends(ctx context.Context, disableEvent bool) error {
	return datasyncer.SyncIncremental(ctx, datasyncer.NewFriendBackend(r.loginUserID, r.db, &friendEvent{relation: r}, r.emitter), new(datasyncer.SyncOptions).SetDisableEvent(disableEvent))
}

func (r *Relation) IncrSyncFriendsWithLock(ctx context.Context) error {
	r.relationSyncMutex.Lock()
	defer r.relationSyncMutex.Unlock()
	return r.IncrSyncFriends(ctx)
}

func (r *Relation) friendListTableName() string {
	return model_struct.LocalFriend{}.TableName()
}
