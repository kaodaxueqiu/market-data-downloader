package relation

import (
	"context"
	"fmt"
	"runtime/debug"
	"sync"

	"github.com/openimsdk/openim-sdk-core/v3/internal/user"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/log"
)

const (
	friendSyncLimit int64 = 10000
)

func NewRelation(relationCh chan common.Cmd2Value, user *user.User, emitter event_scheduler.EventEmitter) *Relation {
	r := &Relation{
		relationCh: relationCh,
		user:       user,
		emitter:    emitter,
	}
	return r
}

type Relation struct {
	friendshipListener open_im_sdk_callback.OnFriendshipListenerSdk
	forServiceListener func() open_im_sdk_callback.OnListenerForService
	loginUserID        string
	db                 db_interface.DataBase
	user               *user.User
	relationCh         chan common.Cmd2Value
	listenerForService open_im_sdk_callback.OnListenerForService
	relationSyncMutex  sync.Mutex
	emitter            event_scheduler.EventEmitter
}

func (r *Relation) Run(ctx context.Context) {
	go r.eventLoop(ctx)

}

func (r *Relation) eventLoop(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			diagnose.ReportPanic(ctx, r)
			err := fmt.Sprintf("panic: %+v\n%s", r, debug.Stack())
			log.ZWarn(ctx, "relation eventLoop panic", nil, "panic info", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.ZInfo(ctx, "relation eventLoop  done sdk logout.....")
			return
		case cmd := <-r.relationCh:
			if _, ok := cmd.Value.(*sdkws.MsgData); !ok {
				continue
			}
			if err := r.doNotification(cmd.Ctx, cmd.Value.(*sdkws.MsgData)); err != nil {
				log.ZError(ctx, "doNotification failed", err)
			}

		}
	}

}

func (r *Relation) Db() db_interface.DataBase {
	return r.db
}

func (r *Relation) SetListener(listener func() open_im_sdk_callback.OnFriendshipListener) {
	r.friendshipListener = open_im_sdk_callback.NewOnFriendshipListenerSdk(listener)
}

func (r *Relation) SetListenerForService(listener open_im_sdk_callback.OnListenerForService) {
	r.listenerForService = listener
}

// SetDataBase sets the DataBase field in Relation struct
func (r *Relation) SetDataBase(db db_interface.DataBase) {
	r.db = db
}

// SetLoginUserID sets the loginUserID field in Relation struct
func (r *Relation) SetLoginUserID(loginUserID string) {
	r.loginUserID = loginUserID
}

func (r *Relation) SetForServiceListener(listener func() open_im_sdk_callback.OnListenerForService) {
	r.forServiceListener = listener
}
