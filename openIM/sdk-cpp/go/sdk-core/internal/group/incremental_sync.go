package group

import (
	"context"
	"sync"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/datasyncer"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	constantpb "github.com/openimsdk/protocol/constant"
	"github.com/openimsdk/protocol/group"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

func (g *Group) groupAndMemberVersionTableName() string {
	return "local_group_entities_version"
}

func (g *Group) groupTableName() string {
	return model_struct.LocalGroup{}.TableName()
}

func (g *Group) SyncAllJoinedGroupsWithLock(ctx context.Context) error {
	g.groupSyncMutex.Lock()
	defer g.groupSyncMutex.Unlock()
	return g.IncrSyncJoinGroup(ctx)
}

func (g *Group) IncrSyncGroupAndMember(ctx context.Context, groupIDs ...string) error {
	if len(groupIDs) == 0 {
		return nil
	}
	var wg sync.WaitGroup
	const maxSyncNum = constantpb.MaxSyncPullNumber
	groupIDSet := datautil.SliceSet(groupIDs)
	var groups []*group.GetIncrementalGroupMemberReq
	if len(groupIDs) > maxSyncNum {
		groups = make([]*group.GetIncrementalGroupMemberReq, 0, maxSyncNum)
	} else {
		groups = make([]*group.GetIncrementalGroupMemberReq, 0, len(groupIDs))
	}
	for {
		if len(groupIDSet) == 0 {
			return nil
		}
		for groupID := range groupIDSet {
			if len(groups) == cap(groups) {
				break
			}
			req := group.GetIncrementalGroupMemberReq{
				GroupID: groupID,
			}

			lvs, err := g.db.GetVersionSync(ctx, g.groupAndMemberVersionTableName(), groupID)
			if err == nil {
				req.VersionID = lvs.VersionID
				req.Version = lvs.Version
			} else if !errs.ErrRecordNotFound.Is(err) {
				return err
			}
			groups = append(groups, &req)
		}
		groupVersion, err := g.getIncrementalGroupMemberBatch(ctx, groups)
		if err != nil {
			return err
		}
		if len(groupVersion) == 0 {
			for _, req := range groups {
				delete(groupIDSet, req.GroupID)
			}
			continue
		}
		groups = groups[:0]
		for groupID, resp := range groupVersion {
			tempResp := resp
			tempGroupID := groupID
			wg.Add(1)
			go func() error {
				defer wg.Done()
				if err := g.syncGroupAndMember(ctx, tempGroupID, tempResp); err != nil {
					log.ZError(ctx, "sync Group And Member error", errs.Wrap(err))
					return errs.Wrap(err)
				}
				return nil
			}()
			delete(groupIDSet, tempGroupID)
		}
		wg.Wait()
	}
}

func (g *Group) syncGroupIncremental(ctx context.Context, groupID string, resp *group.GetIncrementalGroupMemberResp) error {
	backend := datasyncer.NewGroupMemberBackend(g.loginUserID, groupID, g.db, &groupMemberEvent{group: g}, &groupEvent{group: g}, resp, g.emitter)
	return datasyncer.SyncIncremental(ctx, backend, new(datasyncer.SyncOptions).SetMaxReseedFetch(groupMemberSyncLimit))
}

func (g *Group) syncGroupAndMember(ctx context.Context, groupID string, resp *group.GetIncrementalGroupMemberResp) error {
	return g.syncGroupIncremental(ctx, groupID, resp)
}

func (g *Group) onlineSyncGroupAndMember(ctx context.Context, groupID string, deleteGroupMembers, updateGroupMembers, insertGroupMembers []*sdkws.GroupMemberFullInfo,
	updateGroup *sdkws.GroupInfo, sortVersion uint64, version uint64, versionID string) error {
	// Create Delta notification from the push notification data
	notification := &datasyncer.DeltaWithExtra[*model_struct.LocalGroupMember, *sdkws.GroupInfo]{
		Version:       version,
		VersionID:     versionID,
		RequireReseed: false,
		DeletedIDs:    datautil.Slice(deleteGroupMembers, func(m *sdkws.GroupMemberFullInfo) string { return m.UserID }),
		Inserted:      datautil.Batch(converter.ServerGroupMemberToLocal, insertGroupMembers),
		Updated:       datautil.Batch(converter.ServerGroupMemberToLocal, updateGroupMembers),
		ReorderAt:     sortVersion,
		Extra:         updateGroup,
	}

	// Create backend for this group
	backend := datasyncer.NewGroupMemberBackend(g.loginUserID, groupID, g.db, &groupMemberEvent{group: g}, &groupEvent{group: g}, nil, g.emitter)

	// Use HandleIncrementalNotification to process the push notification
	return datasyncer.HandleIncrementalNotification(ctx, backend, notification, new(datasyncer.SyncOptions).SetMaxReseedFetch(0))
}

func (g *Group) IncrSyncJoinGroup(ctx context.Context) error {
	return g.incrSyncJoinGroup(ctx, false)
}

func (g *Group) IncrSyncJoinGroupWithoutEvent(ctx context.Context) error {
	return g.incrSyncJoinGroup(ctx, true)
}

func (g *Group) incrSyncJoinGroup(ctx context.Context, disableEvent bool) error {
	return datasyncer.SyncIncremental(ctx, datasyncer.NewJoinedGroupBackend(g.loginUserID, g.db, &groupEvent{g}, g.emitter), new(datasyncer.SyncOptions).SetDisableEvent(disableEvent))
}
