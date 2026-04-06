package datasyncer

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/protocol/sdkws"
)

// groupInfoChangeOption controls the behavior when handling group info updates.
type groupInfoChangeOption struct {
	Event        Event[*model_struct.LocalGroup]
	Emitter      event_scheduler.EventEmitter
	DisableEvent bool
}

// handleGroupInfoChange checks whether the incoming group info differs from local data and applies updates.
// Optional conversation publishing and event callbacks honor the DisableEvent flag.
func handleGroupInfoChange(ctx context.Context, serverGroup *sdkws.GroupInfo, db db_interface.DataBase, opt groupInfoChangeOption) error {
	if serverGroup == nil {
		return nil
	}
	if opt.Event == nil {
		opt.Event = NopEvent[*model_struct.LocalGroup]{}
	}
	local := converter.ServerGroupToLocal(serverGroup)
	info, err := db.GetGroupInfoByGroupID(ctx, serverGroup.GroupID)
	if err == nil {
		if localGroupsEqual(info, local) {
			return nil
		}
		if !opt.DisableEvent && (info.GroupName != local.GroupName || info.FaceURL != local.FaceURL) {
			if err := publishGroupConversationProfile(ctx, local, opt.Emitter); err != nil {
				return err
			}
		}
		if err := db.UpdateGroup(ctx, local); err != nil {
			return err
		}
		if !opt.DisableEvent {
			opt.Event.OnUpdate(ctx, info, local)
		}
		return nil
	}
	if !opt.DisableEvent {
		if err := publishGroupConversationProfile(ctx, local, opt.Emitter); err != nil {
			return err
		}
	}
	if err := db.InsertGroup(ctx, local); err != nil {
		return err
	}
	if !opt.DisableEvent {
		opt.Event.OnInsert(ctx, local)
	}
	return nil
}

func localGroupsEqual(a, b *model_struct.LocalGroup) bool {
	if a == nil || b == nil {
		return a == b
	}
	if a.GroupID != b.GroupID ||
		a.GroupName != b.GroupName ||
		a.Notification != b.Notification ||
		a.Introduction != b.Introduction ||
		a.FaceURL != b.FaceURL ||
		a.CreateTime != b.CreateTime ||
		a.Status != b.Status ||
		a.CreatorUserID != b.CreatorUserID ||
		a.GroupType != b.GroupType ||
		a.OwnerUserID != b.OwnerUserID ||
		a.MemberCount != b.MemberCount ||
		a.Ex != b.Ex ||
		a.AttachedInfo != b.AttachedInfo ||
		a.NeedVerification != b.NeedVerification ||
		a.LookMemberInfo != b.LookMemberInfo ||
		a.ApplyMemberFriend != b.ApplyMemberFriend ||
		a.NotificationUpdateTime != b.NotificationUpdateTime ||
		a.NotificationUserID != b.NotificationUserID ||
		a.DisplayIsRead != b.DisplayIsRead ||
		!stringArrayEqual(a.MuteBypassUserIDs, b.MuteBypassUserIDs) {
		return false
	}
	return true
}

func stringArrayEqual(a, b model_struct.StringArray) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
