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
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/utils/datautil"
)

func NewGroupMemberBackend(userID string, groupID string, db db_interface.DataBase, event Event[*model_struct.LocalGroupMember], groupEvent Event[*model_struct.LocalGroup], preloadData *group.GetIncrementalGroupMemberResp, emitter event_scheduler.EventEmitter) BackendWithExtra[*model_struct.LocalGroupMember, *sdkws.GroupInfo] {
	if event == nil {
		event = NopEvent[*model_struct.LocalGroupMember]{}
	}
	if groupEvent == nil {
		groupEvent = NopEvent[*model_struct.LocalGroup]{}
	}
	return &groupMemberBackend{
		userID:      userID,
		groupID:     groupID,
		tableName:   "local_group_entities_version",
		db:          db,
		event:       event,
		groupEvent:  groupEvent,
		preloadData: preloadData,
		emitter:     emitter,
	}
}

type groupMemberBackend struct {
	groupID     string
	userID      string
	tableName   string
	db          db_interface.DataBase
	event       Event[*model_struct.LocalGroupMember]
	groupEvent  Event[*model_struct.LocalGroup]
	preloadData *group.GetIncrementalGroupMemberResp
	emitter     event_scheduler.EventEmitter
}

func (b *groupMemberBackend) Equal(x, y *model_struct.LocalGroupMember) bool {
	return *x == *y
}

func (b *groupMemberBackend) GetLocalData(ctx context.Context, userIDs []string) (map[string]*model_struct.LocalGroupMember, error) {
	var (
		members []*model_struct.LocalGroupMember
		err     error
	)
	if len(userIDs) == 0 {
		members, err = b.db.GetGroupMemberListByGroupID(ctx, b.groupID)
	} else {
		members, err = b.db.GetGroupSomeMemberInfo(ctx, b.groupID, userIDs)
	}
	if err != nil {
		return nil, err
	}
	return datautil.SliceToMap(members, func(e *model_struct.LocalGroupMember) string {
		return e.UserID
	}), nil
}

func (b *groupMemberBackend) IDOf(v *model_struct.LocalGroupMember) string {
	return v.UserID
}

func (b *groupMemberBackend) UpsertLocal(ctx context.Context, vs []*model_struct.LocalGroupMember) error {
	// Check if event callbacks should be disabled for this operation.
	// Events are typically disabled during bulk synchronization to avoid triggering
	// excessive notifications or cascading updates.
	disable := isDisableEvent(ctx)
	if isReseedSync(ctx) {
		disable = true
	}
	ids := datautil.Slice(vs, b.IDOf)
	members, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}
	var (
		inserts []*model_struct.LocalGroupMember
		update  []*model_struct.LocalGroupMember
	)
	for _, v := range vs {
		if val, ok := members[v.UserID]; ok {
			if !b.Equal(v, val) {
				update = append(update, v)
			}
		} else {
			inserts = append(inserts, v)
		}
	}
	if len(inserts) > 0 {
		if !disable {
			for _, member := range inserts {
				if err := b.publishMessage(ctx, member); err != nil {
					return err
				}
			}
		}
		if err = chunkedInsert(ctx, inserts, b.db.BatchInsertGroupMember); err != nil {
			return err
		}
		// Only trigger OnInsert events if not disabled
		if !disable {
			for _, member := range inserts {
				b.event.OnInsert(ctx, member)
			}
		}
	}
	if len(update) > 0 {
		for _, member := range update {
			old := members[member.UserID]
			if !disable {
				if old.Nickname != member.Nickname || old.FaceURL != member.FaceURL {
					if err := b.publishMessage(ctx, member); err != nil {
						return err
					}
					if err := b.publishLatest(ctx, member); err != nil {
						return err
					}
				}
			}
			if err = b.db.UpdateGroupMember(ctx, member); err != nil {
				return err
			}
			// Only trigger OnUpdate events if not disabled
			if !disable {
				b.event.OnUpdate(ctx, old, member)
			}
		}
	}
	return nil
}

func (b *groupMemberBackend) DeleteLocalByID(ctx context.Context, ids []string) error {
	// Check if event callbacks should be disabled for this operation
	disable := isDisableEvent(ctx)
	if isReseedSync(ctx) {
		disable = true
	}
	if len(ids) == 0 {
		if err := b.db.DeleteGroupAllMembers(ctx, b.groupID); err != nil {
			return err
		}
		// Only trigger OnDelete events for bulk deletion if not disabled
		if !disable {
			members, err := b.db.GetGroupMemberListByGroupID(ctx, b.groupID)
			if err != nil {
				return err
			}
			for _, member := range members {
				b.event.OnDelete(ctx, member)
			}
		}
		return nil
	}
	members, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if val, ok := members[id]; ok {
			if err := b.db.DeleteGroupMember(ctx, b.groupID, id); err != nil {
				return err
			}
			// Only trigger OnDelete events for individual deletion if not disabled
			if !disable {
				b.event.OnDelete(ctx, val)
			}
		}
	}
	return nil
}

func (b *groupMemberBackend) LoadLocalStamp(ctx context.Context) (*model_struct.LocalVersionSync, error) {
	return getVersionSync(ctx, b.db, b.tableName, b.groupID)
}

func (b *groupMemberBackend) HandleExtra(ctx context.Context, extra *sdkws.GroupInfo) error {
	if extra == nil {
		return nil
	}
	return handleGroupInfoChange(ctx, extra, b.db, groupInfoChangeOption{
		Event:        b.groupEvent,
		Emitter:      b.emitter,
		DisableEvent: isDisableEvent(ctx),
	})
}

func (b *groupMemberBackend) SaveLocalStamp(ctx context.Context, s *model_struct.LocalVersionSync) error {
	return b.db.SetVersionSync(ctx, s)
}

func (b *groupMemberBackend) HandleFullSync(_ context.Context) error {
	return nil
}

func (b *groupMemberBackend) ListServerIDs(ctx context.Context, ids []string) (*IDSnapshot, error) {
	req := &group.GetFullGroupMemberUserIDsReq{
		IdHash:  IdHash(ids),
		GroupID: b.groupID,
	}
	res, err := api.GetFullGroupMemberUserIDs.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toIDSnapshot(res, res.GetUserIDs()), nil
}

func (b *groupMemberBackend) getIncrementalGroupMember(ctx context.Context, versionID string, version uint64) (*group.GetIncrementalGroupMemberResp, error) {
	if b.preloadData != nil {
		return b.preloadData, nil
	}
	req := &group.GetIncrementalGroupMemberReq{
		GroupID:   b.groupID,
		VersionID: versionID,
		Version:   version,
	}
	return api.GetIncrementalGroupMember.Invoke(ctx, req)
}

func (b *groupMemberBackend) DiffSince(ctx context.Context, versionID string, version uint64) (*DeltaWithExtra[*model_struct.LocalGroupMember, *sdkws.GroupInfo], error) {
	resp, err := b.getIncrementalGroupMember(ctx, versionID, version)
	if err != nil {
		return nil, err
	}
	return toDeltaWithExtra(resp, resp.Group, converter.ServerGroupMemberToLocal), nil
}

func (b *groupMemberBackend) FetchByIDs(ctx context.Context, ids []string) ([]*model_struct.LocalGroupMember, error) {
	return fetchByIDPages(ctx, ids, defaultFetchPageSize, func(ctx context.Context, subset []string) ([]*model_struct.LocalGroupMember, error) {
		req := &group.GetGroupMembersInfoReq{
			GroupID: b.groupID,
			UserIDs: subset,
		}
		resp, err := api.GetGroupMembersInfo.Invoke(ctx, req)
		if err != nil {
			return nil, err
		}
		return datautil.Batch(converter.ServerGroupMemberToLocal, resp.GetMembers()), nil
	})
}

func (b *groupMemberBackend) publishMessage(ctx context.Context, info *model_struct.LocalGroupMember) error {
	cmd := common.Cmd2Value{
		Cmd: event_scheduler.UpdateMessageAvatarAndNickname,
		Value: common.UpdateMessageInfo{
			SessionType: constant.ReadGroupChatType,
			UserID:      info.UserID,
			FaceURL:     info.FaceURL,
			Nickname:    info.Nickname,
			GroupID:     info.GroupID,
		},
		Caller: common.GetCaller(2),
	}
	return b.emitter.Publish(ctx, cmd)
}

func (b *groupMemberBackend) publishLatest(ctx context.Context, info *model_struct.LocalGroupMember) error {
	cmd := common.Cmd2Value{
		Cmd: event_scheduler.UpdateConversationLatestMessageSenderProfile,
		Value: common.UpdateMessageInfo{
			SessionType: constant.ReadGroupChatType,
			UserID:      info.UserID,
			FaceURL:     info.FaceURL,
			Nickname:    info.Nickname,
			GroupID:     info.GroupID,
		},
		Caller: common.GetCaller(2),
	}
	return b.emitter.Publish(ctx, cmd)
}
