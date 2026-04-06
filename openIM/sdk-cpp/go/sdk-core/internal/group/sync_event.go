package group

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/tools/log"
)

type groupEvent struct {
	group *Group
}

func (e *groupEvent) OnInsert(ctx context.Context, v *model_struct.LocalGroup) {
	// when a user kicked to the group and invited to the group again, group info maybe updated,
	// so conversation info need to be updated
	e.group.groupInfoCache.Store(v.GroupID, v)
	e.group.listener().OnJoinedGroupAdded(utils.StructToJsonString(v))
}

func (e *groupEvent) OnDelete(ctx context.Context, v *model_struct.LocalGroup) {
	v.MemberCount = 0
	e.group.groupInfoCache.Delete(v.GroupID)
	e.group.listener().OnJoinedGroupDeleted(utils.StructToJsonString(v))
}

func (e *groupEvent) OnUpdate(ctx context.Context, lv, sv *model_struct.LocalGroup) {
	log.ZInfo(ctx, "groupSyncer trigger update", "groupID",
		sv.GroupID, "data", sv, "isDismissed", sv.Status == constant.GroupStatusDismissed)
	e.group.groupInfoCache.Store(sv.GroupID, sv)
	if sv.Status == constant.GroupStatusDismissed {
		if err := e.group.db.DeleteGroupAllMembers(ctx, sv.GroupID); err != nil {
			log.ZError(ctx, "delete group all members failed", err)
		}
		e.group.listener().OnGroupDismissed(utils.StructToJsonString(sv))
	} else {
		e.group.listener().OnGroupInfoChanged(utils.StructToJsonString(sv))
	}
}

type groupMemberEvent struct {
	group *Group
}

func (e *groupMemberEvent) OnInsert(ctx context.Context, v *model_struct.LocalGroupMember) {
	e.group.listener().OnGroupMemberAdded(utils.StructToJsonString(v))
}

func (e *groupMemberEvent) OnDelete(ctx context.Context, v *model_struct.LocalGroupMember) {
	e.group.listener().OnGroupMemberDeleted(utils.StructToJsonString(v))
}

func (e *groupMemberEvent) OnUpdate(ctx context.Context, lv, sv *model_struct.LocalGroupMember) {
	e.group.groupMemberCache.Delete(e.group.BuildGroupMemberKey(lv.GroupID, lv.UserID))
	e.group.listener().OnGroupMemberInfoChanged(utils.StructToJsonString(sv))
}
