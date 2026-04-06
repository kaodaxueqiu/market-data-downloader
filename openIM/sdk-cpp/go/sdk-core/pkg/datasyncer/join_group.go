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
	"github.com/openimsdk/protocol/group"
	"github.com/openimsdk/tools/utils/datautil"
)

func NewJoinedGroupBackend(userID string, db db_interface.DataBase, event Event[*model_struct.LocalGroup], emitter event_scheduler.EventEmitter) Backend[*model_struct.LocalGroup] {
	if event == nil {
		event = NopEvent[*model_struct.LocalGroup]{}
	}
	return &joinedGroupBackend{
		userID:    userID,
		tableName: (model_struct.LocalGroup{}).TableName(),
		db:        db,
		event:     event,
		emitter:   emitter,
	}
}

type joinedGroupBackend struct {
	userID    string
	tableName string
	db        db_interface.DataBase
	event     Event[*model_struct.LocalGroup]
	emitter   event_scheduler.EventEmitter
}

func (b *joinedGroupBackend) IDOf(v *model_struct.LocalGroup) string {
	return v.GroupID
}

func (b *joinedGroupBackend) Equal(x, y *model_struct.LocalGroup) bool {
	return EqualGroup(x, y)
}

func (b *joinedGroupBackend) GetLocalData(ctx context.Context, ids []string) (map[string]*model_struct.LocalGroup, error) {
	var (
		local []*model_struct.LocalGroup
		err   error
	)
	if len(ids) == 0 {
		local, err = b.db.GetJoinedGroupListDB(ctx)
	} else {
		local, err = b.db.GetGroups(ctx, ids)
	}
	if err != nil {
		return nil, err
	}
	return datautil.SliceToMap(local, func(e *model_struct.LocalGroup) string {
		return e.GroupID
	}), nil
}

func (b *joinedGroupBackend) UpsertLocal(ctx context.Context, vs []*model_struct.LocalGroup) error {
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

	var (
		inserts []*model_struct.LocalGroup
		updates []*model_struct.LocalGroup
	)

	for _, v := range vs {
		if current, ok := exist[v.GroupID]; ok {
			if !b.Equal(v, current) {
				updates = append(updates, v)
			}
		} else {
			inserts = append(inserts, v)
		}
	}

	if len(inserts) > 0 {
		if !disable {
			for _, insert := range inserts {
				if err := b.publish(ctx, insert); err != nil {
					return err
				}
			}
		}
		if err = chunkedInsert(ctx, inserts, b.db.BatchInsertGroup); err != nil {
			return err
		}
		// Only trigger OnInsert events if not disabled
		if !disable {
			for _, group := range inserts {
				b.event.OnInsert(ctx, group)
			}
		}
	}

	for _, group := range updates {
		old := exist[group.GroupID]
		if !disable {
			if old.GroupName != group.GroupName || old.FaceURL != group.FaceURL {
				if err := b.publish(ctx, group); err != nil {
					return err
				}
			}
		}

		if group.Status == constant.GroupStatusDismissed {
			if err := b.db.DeleteGroupAllMembers(ctx, group.GroupID); err != nil {
				return err
			}
		}

		if err = b.db.UpdateGroup(ctx, group); err != nil {
			return err
		}
		// Only trigger OnUpdate events if not disabled
		if !disable {
			b.event.OnUpdate(ctx, old, group)
		}
	}

	return nil
}

func (b *joinedGroupBackend) clearGroup(ctx context.Context, groupID string) error {
	if err := b.db.DeleteGroupAllMembers(ctx, groupID); err != nil {
		return err
	}
	if err := b.db.DeleteVersionSync(ctx, b.tableName, groupID); err != nil {
		return err
	}
	return nil
}

func (b *joinedGroupBackend) DeleteLocalByID(ctx context.Context, ids []string) error {
	// Check if event callbacks should be disabled for this operation
	disable := isDisableEvent(ctx)
	if isReseedSync(ctx) {
		disable = true
	}
	if len(ids) == 0 {
		local, err := b.db.GetJoinedGroupListDB(ctx)
		if err != nil {
			return err
		}
		for _, localGroup := range local {
			if err := b.clearGroup(ctx, localGroup.GroupID); err != nil {
				return err
			}
		}
		if err := b.db.DeleteAllGroup(ctx); err != nil {
			return err
		}
		// Only trigger OnDelete events for bulk deletion if not disabled
		if !disable {
			for _, group := range local {
				b.event.OnDelete(ctx, group)
			}
		}
		return nil
	}
	local, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if group, ok := local[id]; ok {
			if err := b.db.DeleteGroup(ctx, id); err != nil {
				return err
			}
			// Only trigger OnDelete events for individual deletion if not disabled
			if !disable {
				b.event.OnDelete(ctx, group)
			}
		}
	}
	return nil
}

func (b *joinedGroupBackend) LoadLocalStamp(ctx context.Context) (*model_struct.LocalVersionSync, error) {
	return getVersionSync(ctx, b.db, b.tableName, b.userID)
}

func (b *joinedGroupBackend) HandleExtra(_ context.Context, _ struct{}) error {
	return nil
}

func (b *joinedGroupBackend) HandleFullSync(_ context.Context) error {
	return nil
}

func (b *joinedGroupBackend) SaveLocalStamp(ctx context.Context, s *model_struct.LocalVersionSync) error {
	return b.db.SetVersionSync(ctx, s)
}

func (b *joinedGroupBackend) ListServerIDs(ctx context.Context, ids []string) (*IDSnapshot, error) {
	req := &group.GetFullJoinGroupIDsReq{
		IdHash: IdHash(ids),
		UserID: b.userID,
	}
	resp, err := api.GetFullJoinedGroupIDs.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toIDSnapshot(resp, resp.GetGroupIDs()), nil
}

func (b *joinedGroupBackend) DiffSince(ctx context.Context, versionID string, version uint64) (*Delta[*model_struct.LocalGroup], error) {
	req := &group.GetIncrementalJoinGroupReq{
		UserID:    b.userID,
		VersionID: versionID,
		Version:   version,
	}
	resp, err := api.GetIncrementalJoinGroup.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toDelta(resp, converter.ServerGroupToLocal), nil
}

func (b *joinedGroupBackend) FetchByIDs(ctx context.Context, ids []string) ([]*model_struct.LocalGroup, error) {
	return fetchByIDPages(ctx, ids, defaultFetchPageSize, func(ctx context.Context, subset []string) ([]*model_struct.LocalGroup, error) {
		req := &group.GetGroupsInfoReq{GroupIDs: subset}
		resp, err := api.GetGroupsInfo.Invoke(ctx, req)
		if err != nil {
			return nil, err
		}
		return datautil.Batch(converter.ServerGroupToLocal, resp.GetGroupInfos()), nil
	})
}

func (b *joinedGroupBackend) publish(ctx context.Context, info *model_struct.LocalGroup) error {
	return publishGroupConversationProfile(ctx, info, b.emitter)
}

func publishGroupConversationProfile(ctx context.Context, info *model_struct.LocalGroup, emitter event_scheduler.EventEmitter) error {
	if emitter == nil {
		return nil
	}
	cmd := common.Cmd2Value{
		Cmd: event_scheduler.UpdateConversationAvatarAndNickname,
		Value: common.SourceIDAndSessionType{
			SessionType: constant.ReadGroupChatType,
			SourceID:    info.GroupID,
			FaceURL:     info.FaceURL,
			Nickname:    info.GroupName,
		},
		Caller: common.GetCaller(2),
	}
	return emitter.Publish(ctx, cmd)
}

func EqualGroup(a, b *model_struct.LocalGroup) bool {
	return a.GroupID == b.GroupID &&
		a.GroupName == b.GroupName &&
		a.Notification == b.Notification &&
		a.Introduction == b.Introduction &&
		a.FaceURL == b.FaceURL &&
		a.CreateTime == b.CreateTime &&
		a.Status == b.Status &&
		a.CreatorUserID == b.CreatorUserID &&
		a.GroupType == b.GroupType &&
		a.OwnerUserID == b.OwnerUserID &&
		a.MemberCount == b.MemberCount &&
		a.Ex == b.Ex &&
		a.AttachedInfo == b.AttachedInfo &&
		a.NeedVerification == b.NeedVerification &&
		a.LookMemberInfo == b.LookMemberInfo &&
		a.ApplyMemberFriend == b.ApplyMemberFriend &&
		a.NotificationUpdateTime == b.NotificationUpdateTime &&
		a.NotificationUserID == b.NotificationUserID &&
		a.DisplayIsRead == b.DisplayIsRead &&
		datautil.Equal(a.MuteBypassUserIDs, b.MuteBypassUserIDs)
}
