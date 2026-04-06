package datasyncer

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/protocol/relation"
	"github.com/openimsdk/tools/utils/datautil"
)

func NewFriendBackend(userID string, db db_interface.DataBase, event Event[*model_struct.LocalFriend], emitter event_scheduler.EventEmitter) Backend[*model_struct.LocalFriend] {
	if event == nil {
		event = NopEvent[*model_struct.LocalFriend]{}
	}
	return &friendBackend{
		userID:    userID,
		tableName: (model_struct.LocalFriend{}).TableName(),
		db:        db,
		event:     event,
		emitter:   emitter,
	}
}

type friendBackend struct {
	userID    string
	tableName string
	db        db_interface.DataBase
	event     Event[*model_struct.LocalFriend]
	emitter   event_scheduler.EventEmitter
}

func (b *friendBackend) IDOf(v *model_struct.LocalFriend) string {
	return v.FriendUserID
}

func (b *friendBackend) Equal(x, y *model_struct.LocalFriend) bool {
	return *x == *y
}

func (b *friendBackend) GetLocalData(ctx context.Context, ids []string) (map[string]*model_struct.LocalFriend, error) {
	var (
		local []*model_struct.LocalFriend
		err   error
	)
	if len(ids) == 0 {
		local, err = b.db.GetAllFriendList(ctx)
	} else {
		local, err = b.db.GetFriendInfoList(ctx, ids)
	}
	if err != nil {
		return nil, err
	}
	return datautil.SliceToMap(local, func(e *model_struct.LocalFriend) string {
		return e.FriendUserID
	}), nil
}

func (b *friendBackend) UpsertLocal(ctx context.Context, vs []*model_struct.LocalFriend) error {
	// Check if event callbacks should be disabled for this operation.
	// Events are typically disabled during bulk synchronization to avoid triggering
	// excessive notifications or cascading updates.
	disable := isDisableEvent(ctx)
	if isReseedSync(ctx) {
		disable = true
	}
	ids := datautil.Slice(vs, b.IDOf)
	exist, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}

	var inserts []*model_struct.LocalFriend
	var updates []*model_struct.LocalFriend

	for _, v := range vs {
		if current, ok := exist[v.FriendUserID]; ok {
			if !b.Equal(v, current) {
				updates = append(updates, v)
			}
			continue
		}
		inserts = append(inserts, v)
	}

	if len(inserts) > 0 {
		if !disable {
			for _, v := range inserts {
				if err := b.publish(ctx, v); err != nil {
					return err
				}
			}
		}
		if err = chunkedInsert(ctx, inserts, b.db.BatchInsertFriend); err != nil {
			return err
		}
		// Only trigger OnInsert events if not disabled
		if !disable {
			for _, friend := range inserts {
				b.event.OnInsert(ctx, friend)
			}
		}
	}

	for _, friend := range updates {
		old := exist[friend.FriendUserID]
		if !disable {
			if old.Nickname != friend.Nickname || old.FaceURL != friend.FaceURL || old.Remark != friend.Remark {
				if err := b.publish(ctx, friend); err != nil {
					return err
				}
			}
		}
		if err = b.db.UpdateFriend(ctx, friend); err != nil {
			return err
		}
		// Only trigger OnUpdate events if not disabled
		if !disable {
			b.event.OnUpdate(ctx, old, friend)
		}
	}

	return nil
}

func (b *friendBackend) DeleteLocalByID(ctx context.Context, ids []string) error {
	// Check if event callbacks should be disabled for this operation
	disable := isDisableEvent(ctx)
	if isReseedSync(ctx) {
		disable = true
	}
	if len(ids) == 0 {
		if err := b.db.DeleteAllFriend(ctx); err != nil {
			return err
		}
		// Only trigger OnDelete events for bulk deletion if not disabled
		if !disable {
			local, err := b.db.GetAllFriendList(ctx)
			if err != nil {
				return err
			}
			for _, friend := range local {
				b.event.OnDelete(ctx, friend)
			}
		}
		return nil
	}
	local, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if friend := local[id]; friend != nil {
			if err := b.db.DeleteFriendDB(ctx, id); err != nil {
				return err
			}
			// Only trigger OnDelete events for individual deletion if not disabled
			if !disable {
				b.event.OnDelete(ctx, friend)
			}
		}
	}
	return nil
}

func (b *friendBackend) LoadLocalStamp(ctx context.Context) (*model_struct.LocalVersionSync, error) {
	return getVersionSync(ctx, b.db, b.tableName, b.userID)
}

func (b *friendBackend) HandleExtra(_ context.Context, _ struct{}) error {
	return nil
}

func (b *friendBackend) HandleFullSync(_ context.Context) error {
	return nil
}

func (b *friendBackend) SaveLocalStamp(ctx context.Context, s *model_struct.LocalVersionSync) error {
	return b.db.SetVersionSync(ctx, s)
}

func (b *friendBackend) ListServerIDs(ctx context.Context, ids []string) (*IDSnapshot, error) {
	req := &relation.GetFullFriendUserIDsReq{
		IdHash: IdHash(ids),
		UserID: b.userID,
	}
	resp, err := api.GetFullFriendUserIDs.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toIDSnapshot(resp, resp.GetUserIDs()), nil
}

func (b *friendBackend) DiffSince(ctx context.Context, versionID string, version uint64) (*Delta[*model_struct.LocalFriend], error) {
	req := &relation.GetIncrementalFriendsReq{
		UserID:    b.userID,
		VersionID: versionID,
		Version:   version,
	}
	resp, err := api.GetIncrementalFriends.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toDelta(resp, converter.ServerFriendToLocal), nil
}

func (b *friendBackend) FetchByIDs(ctx context.Context, ids []string) ([]*model_struct.LocalFriend, error) {
	return fetchByIDPages(ctx, ids, defaultFetchPageSize, func(ctx context.Context, subset []string) ([]*model_struct.LocalFriend, error) {
		req := &relation.GetDesignatedFriendsReq{
			OwnerUserID:   b.userID,
			FriendUserIDs: subset,
		}
		resp, err := api.GetDesignatedFriends.Invoke(ctx, req)
		if err != nil {
			return nil, err
		}
		return datautil.Batch(converter.ServerFriendToLocal, resp.GetFriendsInfo()), nil
	})
}

func (b *friendBackend) publish(ctx context.Context, info *model_struct.LocalFriend) error {
	displayName := info.Nickname
	if info.Remark != "" {
		displayName = info.Remark
	}

	messageValue := common.UpdateMessageInfo{
		SessionType: constant.SingleChatType,
		UserID:      info.FriendUserID,
		FaceURL:     info.FaceURL,
		Nickname:    displayName,
	}

	conversationValue := common.SourceIDAndSessionType{
		SessionType: constant.SingleChatType,
		SourceID:    info.FriendUserID,
		FaceURL:     info.FaceURL,
		Nickname:    displayName,
	}

	if err := b.emitter.Publish(ctx, common.Cmd2Value{Cmd: event_scheduler.UpdateMessageAvatarAndNickname, Value: messageValue}); err != nil {
		return err
	}

	if err := b.emitter.Publish(ctx, common.Cmd2Value{Cmd: event_scheduler.UpdateConversationAvatarAndNickname, Value: conversationValue}); err != nil {
		return err
	}
	return nil
}
