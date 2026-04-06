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

package group

import (
	"context"
	"fmt"
	"runtime/debug"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/cache"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/datafetcher"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

const (
	groupSyncLimit              = 1000
	groupMemberSyncLimit        = 1000
	NotificationFilterCacheSize = 1024
	NotificationFilterTimeout   = 10 * time.Second
)

func NewGroup(groupCh chan common.Cmd2Value, emitter event_scheduler.EventEmitter) *Group {
	g := &Group{
		groupCh: groupCh,
		emitter: emitter,
		filter:  NewNotificationFilter(NotificationFilterCacheSize, NotificationFilterTimeout),
	}
	g.groupMemberCache = cache.NewCache[string, *model_struct.LocalGroupMember]()
	g.groupInfoCache = cache.NewCache[string, *model_struct.LocalGroup]()
	g.memberSyncManager = NewMemberSyncManager(g.IncrSyncGroupAndMember)
	return g
}

type Group struct {
	listener           func() open_im_sdk_callback.OnGroupListener
	forServiceListener func() open_im_sdk_callback.OnListenerForService
	loginUserID        string
	db                 db_interface.DataBase
	groupCh            chan common.Cmd2Value
	groupSyncMutex     sync.Mutex
	listenerForService open_im_sdk_callback.OnListenerForService
	groupMemberCache   *cache.Cache[string, *model_struct.LocalGroupMember]
	groupInfoCache     *cache.Cache[string, *model_struct.LocalGroup]
	filter             *NotificationFilter
	memberSyncManager  *MemberSyncManager
	emitter            event_scheduler.EventEmitter
}

func (g *Group) Run(ctx context.Context) {
	g.memberSyncManager.Run(ctx)
	go g.eventLoop(ctx)

}

func (g *Group) eventLoop(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			diagnose.ReportPanic(ctx, r)
			err := fmt.Sprintf("panic: %+v\n%s", r, debug.Stack())
			log.ZWarn(ctx, "group eventLoop panic", nil, "panic info", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.ZInfo(ctx, "group eventLoop  done sdk logout.....")
			return
		case cmd := <-g.groupCh:
			if cmd.Cmd == constant.CmdGroupNotificationPrune {
				v, ok := cmd.Value.(*sdkws.GroupNotificationPrune)
				if !ok {
					log.ZError(cmd.Ctx, "CmdGroupNotificationPrune type assert failed", nil, "cmd", cmd)
					continue
				}
				if err := g.doGroupNotificationPrune(cmd.Ctx, v); err != nil {
					log.ZError(cmd.Ctx, "doGroupNotificationPrune failed", err, "cmd", cmd)
				}
			} else {
				v, ok := cmd.Value.(*sdkws.MsgData)
				if !ok {
					continue
				}
				if err := g.doNotification(cmd.Ctx, v); err != nil {
					log.ZError(cmd.Ctx, "DoGroupNotification failed", err, "cmd", cmd)
				}
			}

		}
	}

}

func (g *Group) SetGroupListener(listener func() open_im_sdk_callback.OnGroupListener) {
	g.listener = listener
}

func (g *Group) SetForServiceListener(listener func() open_im_sdk_callback.OnListenerForService) {
	g.forServiceListener = listener
}

func (g *Group) FetchGroupOrError(ctx context.Context, groupID string) (*model_struct.LocalGroup, error) {
	dataFetcher := datafetcher.NewDataFetcher(
		g.db,
		g.groupTableName(),
		g.loginUserID,
		func(localGroup *model_struct.LocalGroup) string {
			return localGroup.GroupID
		},
		func(ctx context.Context, values []*model_struct.LocalGroup) error {
			return g.db.BatchInsertGroup(ctx, values)
		},
		func(ctx context.Context, groupIDs []string) ([]*model_struct.LocalGroup, bool, error) {
			localGroups, err := g.db.GetGroups(ctx, groupIDs)
			return localGroups, true, err
		},
		func(ctx context.Context, groupIDs []string) ([]*model_struct.LocalGroup, error) {
			serverGroupInfo, err := g.getGroupsInfoFromServer(ctx, groupIDs)
			if err != nil {
				return nil, err
			}
			return datautil.Batch(converter.ServerGroupToLocal, serverGroupInfo), nil
		},
	)
	groups, err := dataFetcher.FetchMissingAndCombineLocal(ctx, []string{groupID})
	if err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return nil, sdkerrs.ErrGroupIDNotFound.WrapMsg("sdk and server not this group")
	}
	return groups[0], nil
}

// SetDataBase sets the DataBase field in Group struct
func (g *Group) SetDataBase(db db_interface.DataBase) {
	g.db = db
}

// SetLoginUserID sets the loginUserID field in Group struct
func (g *Group) SetLoginUserID(loginUserID string) {
	g.loginUserID = loginUserID
}

func (g *Group) Reset() {
	g.memberSyncManager.Reset()
}
