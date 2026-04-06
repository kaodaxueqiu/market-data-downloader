package user

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
)

func (u *User) SyncLoginUserInfo(ctx context.Context) error {
	return u.syncLoginUserInfo(ctx, true)
}

func (u *User) SyncLoginUserInfoWithoutNotice(ctx context.Context) error {
	return u.syncLoginUserInfo(ctx, false)
}

func (u *User) syncLoginUserInfo(ctx context.Context, withNotice bool) error {
	remoteUser, err := u.GetSingleUserFromServer(ctx, u.loginUserID)
	if err != nil {
		return err
	}
	localUser, err := u.GetLoginUser(ctx, u.loginUserID)
	if err == nil {
		if *remoteUser == *localUser {
			return nil
		}
		if err := u.UpdateLoginUser(ctx, remoteUser); err != nil {
			return err
		}
		u.UserCache().Delete(localUser.UserID)
		if withNotice {
			u.listener().OnSelfInfoUpdated(utils.StructToJsonString(remoteUser))
			if remoteUser.Nickname != localUser.Nickname || remoteUser.FaceURL != localUser.FaceURL {
				u.emitter.Publish(ctx, common.Cmd2Value{
					Cmd:   event_scheduler.UpdateConversationAvatarAndNickname,
					Value: common.SourceIDAndSessionType{SourceID: remoteUser.UserID, SessionType: constant.SingleChatType, FaceURL: remoteUser.FaceURL, Nickname: remoteUser.Nickname},
					Ctx:   ctx,
				})
				u.emitter.Publish(ctx, common.Cmd2Value{
					Cmd:   event_scheduler.UpdateMessageAvatarAndNickname,
					Value: common.UpdateMessageInfo{SessionType: constant.SingleChatType, UserID: remoteUser.UserID, FaceURL: remoteUser.FaceURL, Nickname: remoteUser.Nickname},
					Ctx:   ctx,
				})
			}
		}
	} else {
		if err := u.InsertLoginUser(ctx, remoteUser); err != nil {
			return err
		}
		if withNotice {
			u.listener().OnSelfInfoUpdated(utils.StructToJsonString(remoteUser))
		}
	}
	return nil
}
