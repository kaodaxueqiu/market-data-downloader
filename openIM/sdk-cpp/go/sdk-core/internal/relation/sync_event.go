package relation

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/log"
)

type friendEvent struct {
	relation *Relation
}

func (e *friendEvent) OnInsert(ctx context.Context, friend *model_struct.LocalFriend) {
	if friend == nil {
		return
	}
	e.relation.friendshipListener.OnFriendAdded(*friend)
}

func (e *friendEvent) OnDelete(ctx context.Context, friend *model_struct.LocalFriend) {
	if friend == nil {
		return
	}
	log.ZDebug(ctx, "friend deleted", "friend", friend)
	e.relation.friendshipListener.OnFriendDeleted(*friend)
}

func (e *friendEvent) OnUpdate(ctx context.Context, before, after *model_struct.LocalFriend) {
	if after == nil {
		return
	}
	e.relation.user.UserCache().Delete(after.FriendUserID)
	e.relation.friendshipListener.OnFriendInfoChanged(*after)
}
