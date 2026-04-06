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

package open_im_sdk

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime/debug"
	"strings"
	"sync"
	"time"
	"unsafe"

	conv "github.com/openimsdk/openim-sdk-core/v3/internal/conversation_msg"
	"github.com/openimsdk/openim-sdk-core/v3/internal/group"
	"github.com/openimsdk/openim-sdk-core/v3/internal/interaction"
	"github.com/openimsdk/openim-sdk-core/v3/internal/relation"
	"github.com/openimsdk/openim-sdk-core/v3/internal/signaling"
	"github.com/openimsdk/openim-sdk-core/v3/internal/third"
	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/internal/user"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/ccontext"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/cliconf"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/event_scheduler"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	buildversion "github.com/openimsdk/openim-sdk-core/v3/pkg/version"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	sdkversion "github.com/openimsdk/openim-sdk-core/v3/version"
	pconstant "github.com/openimsdk/protocol/constant"
	"github.com/openimsdk/protocol/push"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/jsonutil"
)

const (
	LogoutStatus = iota + 1
	Logging
	Logged
)

const (
	LogoutTips         = "js sdk socket close"
	DefaultDiagDataDir = "./diagnose"
)

var (
	// IMUserContext is the global user context instance
	IMUserContext *UserContext
	once          sync.Once
)

func init() {
	IMUserContext = NewIMUserContext()
	IMUserContext.initResources()
}

func (u *UserContext) InitResources() {
	u.initResources()
}

func (u *UserContext) initResources() {
	ctx := ccontext.WithInfo(context.Background(), u.info)
	u.ctx, u.cancel = context.WithCancel(ctx)
	u.setFGCtx()
	u.conversationEventQueue = common.NewEventQueue(1000)
	u.msgSyncerCh = make(chan common.Cmd2Value, 1000)
	u.groupCh = make(chan common.Cmd2Value, 1000)
	u.userCh = make(chan common.Cmd2Value, 1000)
	u.relationCh = make(chan common.Cmd2Value, 1000)
	u.loginMgrCh = make(chan common.Cmd2Value, 1)

	u.longConnMgr = interaction.NewLongConnMgr(u.ctx, u.userOnlineStatusChange, u.msgSyncerCh, u.loginMgrCh, u.groupCh)
	u.ctx = ccontext.WithApiErrCode(u.ctx, &apiErrCallback{
		loginMgrCh:   u.loginMgrCh,
		listener:     u.ConnListener,
		kickedTipsCh: make(chan *sdkws.ForceLogoutTips, 4),
	})
	u.setLoginStatus(LogoutStatus)
	u.user = user.NewUser(u.userCh, u)
	u.file = file.NewFile()
	u.relation = relation.NewRelation(u.relationCh, u.user, u)
	u.group = group.NewGroup(u.groupCh, u)
	u.third = third.NewThird(u.file)
	u.signaling = signaling.NewLiveSignaling(IMUserContext.LongConnMgr())
	u.msgSyncer = interaction.NewMsgSyncer(u.msgSyncerCh, u.conversationEventQueue, u.longConnMgr)
	u.conversation = conv.NewConversation(u.longConnMgr, u.msgSyncerCh, u.groupCh, u.relationCh, u.userCh, u.conversationEventQueue,
		u.relation, u.group, u.user, u.file, u.signaling)
	u.eventScheduler = event_scheduler.NewEventScheduler(event_scheduler.WithIdleSleep(30 * time.Second))
	u.RegisterEventHandler()
	u.setListener(ctx)
}

func (u *UserContext) initDiagnose(diagDir string) {
	if u.info != nil && u.info.IMConfig != nil && u.info.DataDir != "" {
		diagDir = filepath.Join(u.info.DataDir, "diagnose")
	}
	stderrErr := diagnose.InitRuntimeCapture(diagDir)
	if stderrErr != nil && diagDir != DefaultDiagDataDir {
		fallback := DefaultDiagDataDir
		if err := diagnose.InitRuntimeCapture(fallback); err == nil {
			diagDir = fallback
			stderrErr = nil
		} else {
			stderrErr = err
		}
	}

	bc := diagnose.NewBreadcrumbRing(256)
	collector := &diagnose.Collector{
		Env: diagnose.EnvInfo{
			SDKVersion: sdkversion.Version,
			SDKCommit:  buildversion.Get().GitCommit,
		},
		BC: bc,
	}
	manager := &diagnose.CrashManager{
		Collector: collector,
		Persister: &diagnose.Persister{
			Dir:      diagDir,
			MaxFiles: 20,
		},
	}
	if u.third != nil {
		manager.Uploader = u.third.CrashUploader()
	}
	diagnose.SetDefaultManager(manager)

	if stderrErr != nil {
		diagnose.Info("sdk.init.stderr_redirect_fail", "err", stderrErr.Error())
	}
	diagnose.Info("sdk.init.step1",
		"diag_dir", diagDir,
	)
}

func (u *UserContext) startDiagnoseUpload(ctx context.Context) {
	manager := diagnose.DefaultManager()
	var uploader diagnose.Uploader
	if manager != nil {
		uploader = manager.Uploader
	}
	if uploader == nil && u.third != nil {
		uploader = u.third.CrashUploader()
	}
	if manager != nil && uploader != nil {
		manager.Uploader = uploader
		manager.UploadOnStart = true
		manager.StartBackgroundUpload(ctx)
	}
}
func makeUserJSONHandler[T any](userCtx context.Context, h func(ctx context.Context, data *T) error,
) event_scheduler.EventHandler {
	return event_scheduler.MakeJSONHandler(func(ctx context.Context, data *T) error {
		operationID, _ := ctx.Value(pconstant.OperationID).(string)
		ctx = ccontext.WithOperationID(userCtx, operationID)
		return h(ctx, data)
	})
}

func (u *UserContext) RegisterEventHandler() {
	u.eventScheduler.Register(event_scheduler.UpdateMessageAvatarAndNickname, makeUserJSONHandler(u.ctx, u.conversation.OnUpdateMessageAvatarAndNickname))
	u.eventScheduler.Register(event_scheduler.UpdateConversationAvatarAndNickname, makeUserJSONHandler(u.ctx, u.conversation.OnUpdateConversationAvatarAndNickname))
	u.eventScheduler.Register(event_scheduler.UpdateConversationLatestMessageSenderProfile, makeUserJSONHandler(u.ctx, u.conversation.OnUpdateConversationLatestMessageSenderProfile))
}

// CheckResourceLoad checks the SDK is resource load status.
func CheckResourceLoad(userContext *UserContext, funcName string) error {
	if userContext.Info().IMConfig == nil {
		return sdkerrs.ErrSDKNotInit.WrapMsg(funcName)
	}

	if funcName == "" {
		return nil
	}

	parts := strings.Split(funcName, ".")
	shortFuncName := parts[len(parts)-1]
	if shortFuncName == "Login-fm" || shortFuncName == "Log-fm" {
		return nil
	}

	if userContext.getLoginStatus(context.Background()) != Logged {
		return sdkerrs.ErrSDKNotLogin.WrapMsg(funcName)
	}

	return nil
}

type UserContext struct {
	relation     *relation.Relation
	group        *group.Group
	conversation *conv.Conversation
	user         *user.User
	file         *file.File
	signaling    *signaling.LiveSignaling
	db           db_interface.DataBase
	longConnMgr  *interaction.LongConnMgr
	msgSyncer    *interaction.MsgSyncer
	third        *third.Third

	justOnceFlag bool

	w           sync.Mutex
	loginStatus int

	connListener              open_im_sdk_callback.OnConnListener
	groupListener             open_im_sdk_callback.OnGroupListener
	friendshipListener        open_im_sdk_callback.OnFriendshipListener
	conversationListener      open_im_sdk_callback.OnConversationListener
	advancedMsgListener       open_im_sdk_callback.OnAdvancedMsgListener
	batchMsgListener          open_im_sdk_callback.OnBatchMsgListener
	userListener              open_im_sdk_callback.OnUserListener
	signalingListener         open_im_sdk_callback.OnSignalingListener
	businessListener          open_im_sdk_callback.OnCustomBusinessListener
	msgKvListener             open_im_sdk_callback.OnMessageKvInfoListener
	forServiceListener        open_im_sdk_callback.OnListenerForService
	conversationGroupListener open_im_sdk_callback.OnConversationGroupListener

	//conversationCh chan common.Cmd2Value

	conversationEventQueue *common.EventQueue
	groupCh                chan common.Cmd2Value
	relationCh             chan common.Cmd2Value
	userCh                 chan common.Cmd2Value
	cmdWsCh                chan common.Cmd2Value
	msgSyncerCh            chan common.Cmd2Value
	loginMgrCh             chan common.Cmd2Value

	ctx            context.Context
	cancel         context.CancelFunc
	fgCtx          context.Context
	fgCancel       context.CancelCauseFunc
	info           *ccontext.GlobalConfig
	eventScheduler *event_scheduler.EventScheduler
}

func (u *UserContext) Info() *ccontext.GlobalConfig {
	return u.info
}

func (u *UserContext) ForServiceListener() open_im_sdk_callback.OnListenerForService {
	return u.forServiceListener
}

func (u *UserContext) ConversationGroupListener() open_im_sdk_callback.OnConversationGroupListener {
	return u.conversationGroupListener
}

func (u *UserContext) ConnListener() open_im_sdk_callback.OnConnListener {
	return u.connListener
}

func (u *UserContext) GroupListener() open_im_sdk_callback.OnGroupListener {
	return u.groupListener
}

func (u *UserContext) FriendshipListener() open_im_sdk_callback.OnFriendshipListener {
	return u.friendshipListener
}

func (u *UserContext) ConversationListener() open_im_sdk_callback.OnConversationListener {
	return u.conversationListener
}

func (u *UserContext) AdvancedMsgListener() open_im_sdk_callback.OnAdvancedMsgListener {
	return u.advancedMsgListener
}

func (u *UserContext) BatchMsgListener() open_im_sdk_callback.OnBatchMsgListener {
	return u.batchMsgListener
}

func (u *UserContext) UserListener() open_im_sdk_callback.OnUserListener {
	return u.userListener
}

func (u *UserContext) SignalingListener() open_im_sdk_callback.OnSignalingListener {
	return u.signalingListener
}

func (u *UserContext) BusinessListener() open_im_sdk_callback.OnCustomBusinessListener {
	return u.businessListener
}

func (u *UserContext) MsgKvListener() open_im_sdk_callback.OnMessageKvInfoListener {
	return u.msgKvListener
}

func (u *UserContext) Exit() {
	u.cancel()
}

func (u *UserContext) Third() *third.Third {
	return u.third
}

func (u *UserContext) ImConfig() sdk_struct.IMConfig {
	return sdk_struct.IMConfig{
		PlatformID: u.info.PlatformID,
		ApiAddr:    u.info.ApiAddr,
		WsAddr:     u.info.WsAddr,
		DataDir:    u.info.DataDir,
		LogLevel:   u.info.LogLevel,
	}
}

func (u *UserContext) Conversation() *conv.Conversation {
	return u.conversation
}

func (u *UserContext) User() *user.User {
	return u.user
}

func (u *UserContext) File() *file.File {
	return u.file
}

func (u *UserContext) Group() *group.Group {
	return u.group
}

func (u *UserContext) Relation() *relation.Relation {
	return u.relation
}

func (u *UserContext) Signaling() *signaling.LiveSignaling {
	return u.signaling
}

func (u *UserContext) SetConversationListener(conversationListener open_im_sdk_callback.OnConversationListener) {
	u.conversationListener = conversationListener
}

func (u *UserContext) SetAdvancedMsgListener(advancedMsgListener open_im_sdk_callback.OnAdvancedMsgListener) {
	u.advancedMsgListener = advancedMsgListener
}

func (u *UserContext) SetMessageKvInfoListener(messageKvInfoListener open_im_sdk_callback.OnMessageKvInfoListener) {
	u.msgKvListener = messageKvInfoListener
}

func (u *UserContext) SetFriendshipListener(friendshipListener open_im_sdk_callback.OnFriendshipListener) {
	u.friendshipListener = friendshipListener
}

func (u *UserContext) SetGroupListener(groupListener open_im_sdk_callback.OnGroupListener) {
	u.groupListener = groupListener
}

func (u *UserContext) SetUserListener(userListener open_im_sdk_callback.OnUserListener) {
	u.userListener = userListener
}

func (u *UserContext) SetCustomBusinessListener(listener open_im_sdk_callback.OnCustomBusinessListener) {
	u.businessListener = listener
}

func (u *UserContext) SetSignalingListener(listener open_im_sdk_callback.OnSignalingListener) {
	u.signalingListener = listener
}

func (u *UserContext) SetForServiceListener(forServiceListener open_im_sdk_callback.OnListenerForService) {
	u.forServiceListener = forServiceListener
}
func (u *UserContext) SetConversationGroupListener(conversationGroupListener open_im_sdk_callback.OnConversationGroupListener) {
	u.conversation.SubscribeUnreadConversationGroupChange()
	u.conversationGroupListener = conversationGroupListener
}

type ConversationGroupInjectedTiming = conv.ConversationGroupInjectedTiming

func (u *UserContext) setForServiceListenerToModule(setterFunc func() open_im_sdk_callback.OnListenerForService) {
	u.relation.SetForServiceListener(setterFunc)
	u.group.SetForServiceListener(setterFunc)
	u.signaling.SetForServiceListener(setterFunc)
}

func (u *UserContext) SetConversationGroupInjectedTimingObserver(observer func(ConversationGroupInjectedTiming)) {
	if u.conversation == nil {
		return
	}
	u.conversation.SetConversationGroupInjectedTimingObserver(observer)
}

func (u *UserContext) GetLoginUserID() string {
	if u.info != nil {
		return u.info.UserID
	}
	return ""
}

func (u *UserContext) logoutListener(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			diagnose.ReportPanic(ctx, r)
			err := fmt.Sprintf("panic: %+v\n%s", r, debug.Stack())

			log.ZWarn(ctx, "logoutListener panic", nil, "panic info", err)
		}
	}()

	for {
		select {
		case <-u.loginMgrCh:
			log.ZDebug(ctx, "logoutListener exit")
			err := u.logout(ctx, true)
			if err != nil {
				log.ZError(ctx, "logout error", err)
			}
		case <-ctx.Done():
			log.ZInfo(ctx, "logoutListener done sdk logout.....")
			return
		}
	}

}

func NewIMUserContext() *UserContext {
	once.Do(func() {
		IMUserContext = &UserContext{
			info: &ccontext.GlobalConfig{},
		}
	})
	return IMUserContext
}

func NewLoginMgr() *UserContext {
	return &UserContext{
		info: &ccontext.GlobalConfig{},
	}
}
func (u *UserContext) getLoginStatus(_ context.Context) int {
	u.w.Lock()
	defer u.w.Unlock()
	return u.loginStatus
}
func (u *UserContext) setLoginStatus(status int) {
	u.w.Lock()
	defer u.w.Unlock()
	u.loginStatus = status
}

func (u *UserContext) tryStartLogin() error {
	u.w.Lock()
	defer u.w.Unlock()
	if u.loginStatus == Logged || u.loginStatus == Logging {
		return sdkerrs.ErrLoginRepeat
	}
	u.loginStatus = Logging
	return nil
}
func (u *UserContext) checkSendingMessage(ctx context.Context) {
	sendingMessages, err := u.db.GetAllSendingMessages(ctx)
	if err != nil {
		log.ZError(ctx, "GetAllSendingMessages failed", err)
	}
	for _, message := range sendingMessages {
		if err := u.handlerSendingMsg(ctx, message); err != nil {
			log.ZError(ctx, "handlerSendingMsg failed", err, "message", message)
		}
		if err := u.db.DeleteSendingMessage(ctx, message.ConversationID, message.ClientMsgID); err != nil {
			log.ZError(ctx, "DeleteSendingMessage failed", err, "conversationID", message.ConversationID, "clientMsgID", message.ClientMsgID)
		}
	}
}

func (u *UserContext) handlerSendingMsg(ctx context.Context, sendingMsg *model_struct.LocalSendingMessages) error {
	tableMessage, err := u.db.GetMessage(ctx, sendingMsg.ConversationID, sendingMsg.ClientMsgID)
	if err != nil {
		return err
	}
	if tableMessage.Status != constant.MsgStatusSending {
		return nil
	}
	err = u.db.UpdateMessage(ctx, sendingMsg.ConversationID, &model_struct.LocalChatLog{ClientMsgID: sendingMsg.ClientMsgID, Status: constant.MsgStatusSendFailed})
	if err != nil {
		return err
	}
	conversation, err := u.db.GetConversation(ctx, sendingMsg.ConversationID)
	if err != nil {
		return err
	}
	latestMsg := &sdk_struct.MsgStruct{}
	if err := json.Unmarshal([]byte(conversation.LatestMsg), &latestMsg); err != nil {
		return err
	}
	if latestMsg.ClientMsgID == sendingMsg.ClientMsgID {
		latestMsg.Status = constant.MsgStatusSendFailed
		conversation.LatestMsg = jsonutil.StructToJsonString(latestMsg)
		return u.db.UpdateConversation(ctx, conversation)
	}
	return nil
}

func (u *UserContext) login(ctx context.Context, userID, token string) (err error) {
	if err = u.tryStartLogin(); err != nil {
		return err
	}
	started := true
	defer func() {
		if started && err != nil {
			diagnose.Error("login.fail", err,
				"user_id", diagnose.HashPII(userID),
				"opid", ccontext.Info(ctx).OperationID(),
			)
			u.setLoginStatus(LogoutStatus)
		}
	}()
	diagnose.Info("login.start",
		"user_id", diagnose.HashPII(userID),
		"opid", ccontext.Info(ctx).OperationID(),
	)
	log.ZDebug(ctx, "login start... ", "userID", userID, "token", token)
	t1 := time.Now()

	u.info.UserID = userID
	u.info.Token = token

	if err = u.initialize(ctx, userID); err != nil {
		return err
	}

	u.run(ctx)
	u.setLoginStatus(Logged)
	log.ZDebug(ctx, "login success...", "login cost time: ", time.Since(t1))
	diagnose.Info("login.success",
		"user_id", diagnose.HashPII(userID),
		"opid", ccontext.Info(ctx).OperationID(),
	)
	return nil
}

func (u *UserContext) initialize(ctx context.Context, userID string) error {
	var err error
	u.db, err = db.NewDataBase(ctx, userID, u.info.DataDir, int(u.info.LogLevel))
	if err != nil {
		return sdkerrs.ErrSdkInternal.WrapMsg("init database " + err.Error())
	}
	u.checkSendingMessage(ctx)
	cliconf.SetLoginUserID(userID)
	u.longConnMgr.SetLoginUserID(userID)
	u.user.SetLoginUserID(userID)
	u.user.SetDataBase(u.db)
	u.file.SetLoginUserID(userID)
	u.file.SetDataBase(u.db)
	u.relation.SetDataBase(u.db)
	u.relation.SetLoginUserID(userID)
	u.group.SetDataBase(u.db)
	u.group.SetLoginUserID(userID)
	u.third.SetPlatform(u.info.PlatformID)
	u.third.SetLoginUserID(userID)
	u.third.SetAppFramework(u.info.SystemType)
	u.third.SetLogFilePath(u.info.LogFilePath)
	u.msgSyncer.SetLoginUserID(userID)
	u.msgSyncer.SetDataBase(u.db)
	u.conversation.SetLoginUserID(userID)
	u.conversation.SetDataBase(u.db)
	u.conversation.SetPlatform(u.info.PlatformID)
	u.conversation.SetDataDir(u.info.DataDir)
	u.eventScheduler.SetDataBase(u.db)

	u.signaling.SetDatabase(u.db)
	u.signaling.SetPlatform(u.info.PlatformID)
	u.signaling.SetLoginUserID(userID)
	err = u.msgSyncer.LoadSeq(ctx)
	if err != nil {
		return err
	}
	err = u.conversation.Load(ctx)
	if err != nil {
		return err
	}
	return nil
}

func (u *UserContext) setListener(ctx context.Context) {
	setListener(ctx, &u.connListener, u.ConnListener, u.longConnMgr.SetListener, nil)
	setListener(ctx, &u.userListener, u.UserListener, u.user.SetListener, newEmptyUserListener)
	setListener(ctx, &u.friendshipListener, u.FriendshipListener, u.relation.SetListener, newEmptyFriendshipListener)
	setListener(ctx, &u.groupListener, u.GroupListener, u.group.SetGroupListener, newEmptyGroupListener)
	setListener(ctx, &u.conversationListener, u.ConversationListener, u.conversation.SetConversationListener, newEmptyConversationListener)
	setListener(ctx, &u.advancedMsgListener, u.AdvancedMsgListener, u.conversation.SetMsgListener, newEmptyAdvancedMsgListener)
	setListener(ctx, &u.batchMsgListener, u.BatchMsgListener, u.conversation.SetBatchMsgListener, nil)
	setListener(ctx, &u.businessListener, u.BusinessListener, u.conversation.SetBusinessListener, newEmptyCustomBusinessListener)
	setListener(ctx, &u.signalingListener, u.SignalingListener, u.signaling.SetListener, newEmptySignalingListener)
	setListener(ctx, &u.forServiceListener, u.ForServiceListener, u.setForServiceListenerToModule, newEmptyForServiceListener)
	setListener(ctx, &u.conversationGroupListener, u.ConversationGroupListener, u.conversation.SetConversationGroupListener, newEmptyConversationGroupListener)
}

func setListener[T any](ctx context.Context, listener *T, getter func() T, setFunc func(listener func() T), newFunc func(context.Context) T) {
	if *(*unsafe.Pointer)(unsafe.Pointer(listener)) == nil && newFunc != nil {
		*listener = newFunc(ctx)
	}
	setFunc(getter)
}

func (u *UserContext) run(ctx context.Context) {
	go u.eventScheduler.Start(ctx)
	u.longConnMgr.Run(ctx, u.fgCtx)
	u.group.Run(ctx)
	u.relation.Run(ctx)
	u.user.Run(ctx)
	go u.msgSyncer.DoListener(ctx)
	go u.conversation.ConsumeConversationEventLoop(ctx)
	go u.logoutListener(ctx)
	diagnose.SafeGoDefault(ctx, func() { u.startDiagnoseUpload(ctx) })
}

func (u *UserContext) setFGCtx() {
	u.fgCtx, u.fgCancel = context.WithCancelCause(context.Background())
}

func (u *UserContext) InitSDK(config *sdk_struct.IMConfig, listener open_im_sdk_callback.OnConnListener) bool {
	if listener == nil {
		return false
	}
	if config == nil {
		return false
	}
	if config.DiagnoseHashSalt != "" {
		diagnose.SetHashSalt([]byte(config.DiagnoseHashSalt))
	}
	u.info.IMConfig = config
	u.connListener = listener
	u.initDiagnose(config.DataDir)
	return true
}

func (u *UserContext) Context() context.Context {
	return u.ctx
}

func (u *UserContext) userOnlineStatusChange(users map[string][]int32) {
	u.User().UserOnlineStatusChange(users)
}

func (u *UserContext) UnInitSDK() {
	if u.getLoginStatus(context.Background()) == Logged {
		fmt.Println("sdk not logout, please logout first")
		return
	}
	u.Info().IMConfig = nil
	u.setLoginStatus(0)
}

// token error recycle recourse, kicked not recycle
func (u *UserContext) logout(ctx context.Context, isTokenValid bool) error {
	if ccontext.Info(ctx).OperationID() == LogoutTips {
		isTokenValid = true
	}
	diagnose.Info("logout.start",
		"user_id", diagnose.HashPII(u.info.UserID),
		"opid", ccontext.Info(ctx).OperationID(),
		"token_valid", fmt.Sprint(isTokenValid),
	)
	if !isTokenValid {
		ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		err := u.longConnMgr.SendReqWaitResp(ctx, &push.DelUserPushTokenReq{UserID: u.info.UserID, PlatformID: u.info.PlatformID}, constant.LogoutMsg, &push.DelUserPushTokenResp{})
		if err != nil {
			log.ZWarn(ctx, "TriggerCmdLogout server recycle resources failed...", err)
		} else {
			log.ZDebug(ctx, "TriggerCmdLogout server recycle resources success...")
		}
	}
	u.Exit()
	u.eventScheduler.Stop()
	u.conversationEventQueue.Stop()
	err := u.db.Close(u.ctx)
	if err != nil {
		log.ZWarn(ctx, "TriggerCmdLogout db recycle resources failed...", err)
	}
	// user object must be rest  when user logout
	u.initResources()
	log.ZDebug(ctx, "TriggerCmdLogout client success...",
		"isTokenValid", isTokenValid)
	diagnose.Info("logout.done",
		"user_id", diagnose.HashPII(u.info.UserID),
		"opid", ccontext.Info(ctx).OperationID(),
	)
	return nil
}

func (u *UserContext) setAppBackgroundStatus(ctx context.Context, isBackground bool) error {
	diagnose.Info("app.background",
		"user_id", diagnose.HashPII(u.info.UserID),
		"opid", ccontext.Info(ctx).OperationID(),
		"is_background", fmt.Sprint(isBackground),
	)

	u.longConnMgr.SetBackground(isBackground)

	if !isBackground {
		if u.info.StopGoroutineOnBackground {
			u.setFGCtx()
			u.longConnMgr.ResumeForegroundTasks(u.ctx, u.fgCtx)
		}
	} else {
		if u.info.StopGoroutineOnBackground {
			u.fgCancel(errs.Wrap(fmt.Errorf("app in background")))
			u.longConnMgr.Close(ctx)
		}
	}
	var resp sdkws.SetAppBackgroundStatusResp
	err := u.longConnMgr.SendReqWaitResp(ctx, &sdkws.SetAppBackgroundStatusReq{UserID: u.info.UserID, IsBackground: isBackground}, constant.SetBackgroundStatus, &resp)
	if err != nil {
		return err
	} else {
		if !isBackground {
			_ = common.DispatchWakeUp(ctx, u.msgSyncerCh)
		}
		return nil
	}
}

func (u *UserContext) LongConnMgr() *interaction.LongConnMgr {
	return u.longConnMgr
}

func (u *UserContext) Publish(ctx context.Context, payload common.Cmd2Value, opts ...event_scheduler.Opt) error {
	var err error
	defer func() {
		if err != nil {
			log.ZWarn(ctx, "eventScheduler.EnqueueInTx err", err, "payload", payload)
		} else {
			log.ZDebug(ctx, "eventScheduler.EnqueueInTx success", "payload", payload)
		}
	}()
	if payload.Ctx == nil {
		payload.Ctx = ctx
	}
	if payload.Caller == "" {
		payload.Caller = common.GetCaller(3)
	}
	err = u.eventScheduler.EnqueueInTx(ctx, payload, opts...)
	return err
}
