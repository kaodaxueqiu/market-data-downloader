// Copyright © 2023 OpenIM SDK. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package user

import (
	"context"
	"fmt"
	"runtime/debug"
	"sync"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/log"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/cache"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/utils/datautil"
)

// NewUser creates a new User object.
func NewUser(userCh chan common.Cmd2Value, emitter event_scheduler.EventEmitter) *User {
	user := &User{
		userCh:  userCh,
		emitter: emitter,
	}
	return user
}

// User is a struct that represents a user in the system.
type User struct {
	db_interface.DataBase
	loginUserID string
	listener    func() open_im_sdk_callback.OnUserListener
	userCh      chan common.Cmd2Value
	userCache   *cache.UserCache[string, *model_struct.LocalUser]
	once        sync.Once
	emitter     event_scheduler.EventEmitter
}

func (u *User) UserCache() *cache.UserCache[string, *model_struct.LocalUser] {
	u.once.Do(func() {
		u.userCache = cache.NewUserCache[string, *model_struct.LocalUser](
			func(value *model_struct.LocalUser) string { return value.UserID },
			nil,
			u.GetLoginUser,
			u.GetUsersInfoFromServer,
		)
	})
	return u.userCache
}

// SetDataBase sets the DataBase field in User struct
func (u *User) SetDataBase(db db_interface.DataBase) {
	u.DataBase = db
}

// SetLoginUserID sets the loginUserID field in User struct
func (u *User) SetLoginUserID(loginUserID string) {
	u.loginUserID = loginUserID
}

// SetListener sets the user's listener.
func (u *User) SetListener(listener func() open_im_sdk_callback.OnUserListener) {
	u.listener = listener
}

func (u *User) Run(ctx context.Context) {
	go u.eventLoop(ctx)

}

func (u *User) eventLoop(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			diagnose.ReportPanic(ctx, r)
			err := fmt.Sprintf("panic: %+v\n%s", r, debug.Stack())
			log.ZWarn(ctx, "user eventLoop panic", nil, "panic info", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.ZInfo(ctx, "user eventLoop  done sdk logout.....")
			return
		case cmd := <-u.userCh:
			if _, ok := cmd.Value.(*sdkws.MsgData); !ok {
				continue
			}
			if err := u.doNotification(cmd.Ctx, cmd.Value.(*sdkws.MsgData)); err != nil {
				log.ZError(ctx, "DoGroupNotification failed", err)
			}

		}
	}

}

func (u *User) GetUserInfoWithCache(ctx context.Context, cacheKey string) (*model_struct.LocalUser, error) {
	return u.UserCache().Fetch(ctx, cacheKey)
}

func (u *User) GetUsersInfoWithCache(ctx context.Context, cacheKeys []string) ([]*model_struct.LocalUser, error) {
	m, err := u.UserCache().BatchFetch(ctx, cacheKeys)
	if err != nil {
		return nil, err
	}
	return datautil.Values(m), nil
}

// GetSingleUserFromServer retrieves user information from the server.
func (u *User) GetSingleUserFromServer(ctx context.Context, userID string) (*model_struct.LocalUser, error) {
	users, err := u.getUsersInfo(ctx, []string{userID})
	if err != nil {
		return nil, err
	}
	if len(users) > 0 {
		return converter.ServerUserToLocal(users[0]), nil
	}
	return nil, sdkerrs.ErrUserIDNotFound.WrapMsg(fmt.Sprintf("getSelfUserInfo failed, userID: %s not exist", userID))
}

// GetUsersInfoFromServer retrieves user information from the server.
func (u *User) GetUsersInfoFromServer(ctx context.Context, userIDs []string) ([]*model_struct.LocalUser, error) {
	var err error

	serverUsersInfo, err := u.getUsersInfo(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	if len(serverUsersInfo) == 0 {
		log.ZError(ctx, "serverUsersInfo is empty", err, "userIDs", userIDs)
		return nil, err
	}
	log.ZDebug(ctx, "GetUsersInfoFromServer", "serverUsersInfo", serverUsersInfo)

	return datautil.Batch(converter.ServerUserToLocal, serverUsersInfo), nil
}

func (u *User) GetFileTransfer(ctx context.Context) (*model_struct.LocalUser, error) {
	users, err := u.getFileTransfer(ctx)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, sdkerrs.ErrUserIDNotFound.WrapMsg("file transfer user not found")
	}
	return converter.ServerUserToLocal(users[0]), nil
}
