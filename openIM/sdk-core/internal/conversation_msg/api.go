package conversation_msg

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jinzhu/copier"

	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/ccontext"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/content_type"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdk_params_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/server_api_params"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/wrapperspb"
	pbMsg "github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

func (c *Conversation) GetAllConversationList(ctx context.Context) ([]*model_struct.LocalConversation, error) {
	return c.db.GetAllConversationListDB(ctx)
}

func (c *Conversation) GetConversationListSplit(ctx context.Context, offset, count int) ([]*model_struct.LocalConversation, error) {
	result, err := c.db.GetConversationListSplitDB(ctx, offset, count)
	if err != nil {
		return nil, err
	}

	defer func(conversationHotColdManager *ConversationHotSyncManager, ctx context.Context, conversationIDs []string) {
		err := conversationHotColdManager.EnsureSync(ctx, conversationIDs)
		if err != nil {
			log.ZWarn(ctx, "EnsureSync failed", errors.New("conversation hot sync failed"), "conversationIDs", conversationIDs)
		}
	}(c.conversationHotColdManager, ctx, datautil.Slice(result, func(e *model_struct.LocalConversation) string {
		return e.ConversationID
	}))
	return result, nil
}

func (c *Conversation) HideConversation(ctx context.Context, conversationID string) error {
	_ = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{
		"is_hidden":    true,
		"unread_count": 0,
		"draft_text":   "",
		"draft_text_time": 0,
	})
	req := &pbConversation.UpdateConversationReq{
		ConversationID: conversationID,
		UserIDs:        []string{c.loginUserID},
		IsHidden:       &wrapperspb.BoolValue{Value: true},
	}
	return api.UpdateConversation.Execute(ctx, req)
}

func (c *Conversation) UnhideConversation(ctx context.Context, conversationID string) error {
	_ = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{
		"is_hidden": false,
	})
	req := &pbConversation.UpdateConversationReq{
		ConversationID: conversationID,
		UserIDs:        []string{c.loginUserID},
		IsHidden:       &wrapperspb.BoolValue{Value: false},
	}
	return api.UpdateConversation.Execute(ctx, req)
}

func (c *Conversation) GetAtAllTag(_ context.Context) string {
	return constant.AtAllString
}

func (c *Conversation) GetOneConversation(ctx context.Context, sessionType int32, sourceID string) (*model_struct.LocalConversation, error) {
	conversationID := c.getConversationIDBySessionType(sourceID, int(sessionType))
	lc, err := c.db.GetConversation(ctx, conversationID)
	if err == nil {
		c.conversationHotColdManager.EnsureAsync(ctx, []string{conversationID})
		return lc, nil
	}
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()

	lc, err = c.db.GetConversation(ctx, conversationID)
	if err == nil {
		c.conversationHotColdManager.EnsureAsync(ctx, []string{conversationID})
		return lc, nil
	}

	var newConversation model_struct.LocalConversation
	newConversation.ConversationID = conversationID
	newConversation.ConversationType = sessionType

	switch sessionType {
	case constant.SingleChatType:
		newConversation.UserID = sourceID

		faceURL, name, err := c.getUserNameAndFaceURL(ctx, sourceID)
		if err != nil {
			return nil, err
		}
		newConversation.ShowName = name
		newConversation.FaceURL = faceURL

	case constant.WriteGroupChatType, constant.ReadGroupChatType:
		newConversation.GroupID = sourceID

		g, err := c.group.FetchGroupOrError(ctx, sourceID)
		if err != nil {
			return nil, err
		}
		newConversation.ShowName = g.GroupName
		newConversation.FaceURL = g.FaceURL

	default:
		return nil, sdkerrs.ErrArgs.WrapMsg("unsupported session type")
	}

	if err := c.db.InsertConversation(ctx, &newConversation); err != nil {
		return nil, err
	}

	c.conversationHotColdManager.EnsureAsync(ctx, []string{conversationID})

	return &newConversation, nil
}

func (c *Conversation) GetMultipleConversation(ctx context.Context, conversationIDList []string) ([]*model_struct.LocalConversation, error) {
	conversations, err := c.db.GetMultipleConversationDB(ctx, conversationIDList)
	if err != nil {
		return nil, err
	}
	return conversations, nil

}

func (c *Conversation) HideAllConversations(ctx context.Context) error {
	err := c.db.ResetAllConversation(ctx)
	if err != nil {
		return err
	}
	return nil
}

func (c *Conversation) SetConversationDraft(ctx context.Context, conversationID, draftText string) error {
	if draftText != "" {
		err := c.db.SetConversationDraftDB(ctx, conversationID, draftText)
		if err != nil {
			return err
		}
	} else {
		err := c.db.RemoveConversationDraft(ctx, conversationID, draftText)
		if err != nil {
			return err
		}
	}
	_ = c.OnConversationChanged(ctx, []string{conversationID})
	return nil
}

func (c *Conversation) SetConversation(ctx context.Context, conversationID string, req *pbConversation.ConversationReq) error {
	c.conversationSyncMutex.Lock()
	defer c.conversationSyncMutex.Unlock()

	lc, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	apiReq := &pbConversation.SetConversationsReq{Conversation: req}
	err = c.setConversation(ctx, apiReq, lc)
	if err != nil {
		return err
	}
	return c.IncrSyncConversations(ctx)
}

func (c *Conversation) GetTotalUnreadMsgCount(ctx context.Context) (totalUnreadCount int32, err error) {
	return c.db.GetTotalUnreadMsgCountDB(ctx)
}

func (c *Conversation) SetConversationListener(listener func() open_im_sdk_callback.OnConversationListener) {
	c.ConversationListener = listener
}

func (c *Conversation) SubscribeUnreadConversationGroupChange() {
	c.unreadConversationGroupSubscribed = true
}

func (c *Conversation) updateMsgStatusAndTriggerConversationByErr(ctx context.Context, clientMsgID, serverMsgID string, sendTime int64, err error, s *sdk_struct.MsgStruct,
	lc *model_struct.LocalConversation, isOnlineOnly bool) {
	var status int32
	switch {
	case err == nil:
		status = constant.MsgStatusSendSuccess
	case sdkerrs.ErrCancelUploadingFile.Is(err):
		status = constant.MsgStatusCanceled
	default:
		status = constant.MsgStatusSendFailed
	}
	c.updateMsgStatusAndTriggerConversation(ctx, clientMsgID, serverMsgID, sendTime, status, s, lc, isOnlineOnly)
}

func (c *Conversation) updateMsgStatusAndTriggerConversation(ctx context.Context, clientMsgID, serverMsgID string, sendTime int64, status int32, s *sdk_struct.MsgStruct,
	lc *model_struct.LocalConversation, isOnlineOnly bool) {
	log.ZDebug(ctx, "this is test send message ", "sendTime", sendTime, "status", status, "clientMsgID", clientMsgID, "serverMsgID", serverMsgID)
	if isOnlineOnly {
		return
	}
	s.SendTime = sendTime
	s.Status = status
	s.ServerMsgID = serverMsgID
	err := c.db.UpdateMessageTimeAndStatus(ctx, lc.ConversationID, clientMsgID, serverMsgID, sendTime, status)
	if err != nil {
		log.ZWarn(ctx, "send message update message status error", err,
			"sendTime", sendTime, "status", status, "clientMsgID", clientMsgID, "serverMsgID", serverMsgID)
	}
	err = c.db.DeleteSendingMessage(ctx, lc.ConversationID, clientMsgID)
	if err != nil {
		log.ZWarn(ctx, "send message delete sending message error", err)
	}
	lc.LatestMsg = utils.StructToJsonString(s)
	lc.LatestMsgSendTime = sendTime
	c.OnUpsertConversationLatestMessage(ctx, lc)
}

func (c *Conversation) fileName(ftype string, id string) string {
	return fmt.Sprintf("msg_%s_%s", ftype, id)
}

func (c *Conversation) checkID(ctx context.Context, s *sdk_struct.MsgStruct,
	recvID, groupID string, options map[string]bool) (*model_struct.LocalConversation, error) {
	if recvID == "" && groupID == "" {
		return nil, sdkerrs.ErrArgs
	}
	s.SendID = c.loginUserID
	s.SenderPlatformID = c.platform
	lc := &model_struct.LocalConversation{LatestMsgSendTime: s.CreateTime}
	//assemble messages and conversations based on single or group chat types
	if recvID == "" {
		g, err := c.group.FetchGroupOrError(ctx, groupID)
		if err != nil {
			return nil, err
		}
		lc.ShowName = g.GroupName
		lc.FaceURL = g.FaceURL
		switch g.GroupType {
		case constant.NormalGroup:
			s.SessionType = constant.WriteGroupChatType
			lc.ConversationType = constant.WriteGroupChatType
			lc.ConversationID = c.getConversationIDBySessionType(groupID, constant.WriteGroupChatType)
		case constant.SuperGroup, constant.WorkingGroup:
			s.SessionType = constant.ReadGroupChatType
			lc.ConversationID = c.getConversationIDBySessionType(groupID, constant.ReadGroupChatType)
			lc.ConversationType = constant.ReadGroupChatType
		}
		s.GroupID = groupID
		lc.GroupID = groupID
		gm, err := c.db.GetGroupMemberInfoByGroupIDUserID(ctx, groupID, c.loginUserID)
		if err == nil && gm != nil {
			if gm.Nickname != "" {
				s.SenderNickname = gm.Nickname
			}
		} else { //Maybe the group member information hasn't been pulled locally yet.
			gm, err := c.group.GetSpecifiedGroupMembersInfo(ctx, groupID, []string{c.loginUserID})
			if err == nil && gm != nil {
				if gm[0].Nickname != "" {
					s.SenderNickname = gm[0].Nickname
				}
			}
		}
		var attachedInfo sdk_struct.AttachedInfoElem
		attachedInfo.GroupHasReadInfo.UnreadCount = int64(g.MemberCount) - 1
		s.AttachedInfoElem = &attachedInfo
	} else {
		s.SessionType = constant.SingleChatType
		s.RecvID = recvID
		lc.ConversationID = utils.GetConversationIDByMsg(s)
		lc.UserID = recvID
		lc.ConversationType = constant.SingleChatType
		oldLc, err := c.db.GetConversation(ctx, lc.ConversationID)
		if err == nil && oldLc.IsPrivateChat {
			options[constant.IsNotPrivate] = false
			var attachedInfo sdk_struct.AttachedInfoElem
			attachedInfo.IsPrivateChat = true
			attachedInfo.BurnDuration = oldLc.BurnDuration
			s.AttachedInfoElem = &attachedInfo
		}
		if err != nil {
			t := time.Now()
			faceUrl, name, err := c.getUserNameAndFaceURL(ctx, recvID)
			log.ZDebug(ctx, "GetUserNameAndFaceURL", "cost time", time.Since(t))
			if err != nil {
				return nil, err
			}
			lc.FaceURL = faceUrl
			lc.ShowName = name
		}

	}
	return lc, nil
}
func (c *Conversation) getConversationIDBySessionType(sourceID string, sessionType int) string {
	switch sessionType {
	case constant.SingleChatType:
		l := []string{c.loginUserID, sourceID}
		sort.Strings(l)
		return "si_" + strings.Join(l, "_") // single chat
	case constant.WriteGroupChatType:
		return "g_" + sourceID // group chat
	case constant.ReadGroupChatType:
		return "sg_" + sourceID // super group chat
	case constant.NotificationChatType:
		l := []string{c.loginUserID, sourceID}
		sort.Strings(l)
		return "sn_" + strings.Join(l, "_") // server notification chat
	}
	return ""
}

func (c *Conversation) GetConversationIDBySessionType(_ context.Context, sourceID string, sessionType int) string {
	return c.getConversationIDBySessionType(sourceID, sessionType)
}

func (c *Conversation) sendMessage(ctx context.Context, s *sdk_struct.MsgStruct, recvID, groupID string, p *sdkws.OfflinePushInfo, isOnlineOnly bool) (*sdk_struct.MsgStruct, error) {
	filepathExt := func(name ...string) string {
		for _, path := range name {
			if ext := filepath.Ext(path); ext != "" {
				return ext
			}
		}
		return ""
	}
	options := make(map[string]bool, 2)
	lc, err := c.checkID(ctx, s, recvID, groupID, options)
	if err != nil {
		return nil, err
	}
	callback, ok := ctx.Value(ccontext.CtxCallback).(open_im_sdk_callback.SendMsgCallBack)
	if !ok {
		return nil, sdkerrs.ErrSdkInternal.WrapMsg("context not found SendMsgCallBack")
	}
	log.ZDebug(ctx, "before insert message is", "message", *s)
	if !isOnlineOnly {
		oldMessage, err := c.db.GetMessage(ctx, lc.ConversationID, s.ClientMsgID)
		if err != nil {
			localMessage := converter.MsgStructToLocalChatLog(s)
			err := c.db.InsertMessage(ctx, lc.ConversationID, localMessage)
			if err != nil {
				return nil, err
			}
			err = c.db.InsertSendingMessage(ctx, &model_struct.LocalSendingMessages{
				ConversationID: lc.ConversationID,
				ClientMsgID:    localMessage.ClientMsgID,
			})
			if err != nil {
				return nil, err
			}
		} else {
			if !(oldMessage.Status == constant.MsgStatusSendFailed || oldMessage.Status == constant.MsgStatusCanceled) {
				return nil, sdkerrs.ErrMsgRepeated
			} else {
				s.Status = constant.MsgStatusSending
				err = c.db.InsertSendingMessage(ctx, &model_struct.LocalSendingMessages{
					ConversationID: lc.ConversationID,
					ClientMsgID:    s.ClientMsgID,
				})
				if err != nil {
					return nil, err
				}
			}
		}
		lc.LatestMsg = utils.StructToJsonString(s)
		log.ZDebug(ctx, "send message come here", "conversion", *lc)
		_ = c.OnUpsertConversationLatestMessage(ctx, lc)
	}

	var delFile []string
	//media file handle
	switch s.ContentType {
	case constant.Picture:
		if s.Status == constant.MsgStatusSendSuccess {
			s.Content = utils.StructToJsonString(s.PictureElem)
			break
		}
		var sourcePath string
		if utils.FileExist(s.PictureElem.SourcePath) {
			sourcePath = s.PictureElem.SourcePath
			delFile = append(delFile, utils.FileTmpPath(s.PictureElem.SourcePath, c.DataDir))
		} else {
			sourcePath = utils.FileTmpPath(s.PictureElem.SourcePath, c.DataDir)
			delFile = append(delFile, sourcePath)
		}
		log.ZDebug(ctx, "send picture", "path", sourcePath)

		res, err := c.file.UploadFile(ctx, &file.UploadFileReq{
			ContentType: s.PictureElem.SourcePicture.Type,
			Filepath:    sourcePath,
			Uuid:        s.PictureElem.SourcePicture.UUID,
			Name:        c.fileName("picture", s.ClientMsgID) + filepathExt(s.PictureElem.SourcePicture.UUID, sourcePath),
			Cause:       "msg-picture",
			CancelID:    s.ClientMsgID,
		}, NewUploadFileCallback(ctx, callback.OnProgress, s, lc.ConversationID, c.db))
		if err != nil {
			c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime, err, s, lc, isOnlineOnly)
			return nil, err
		}
		s.PictureElem.SourcePicture.Url = res.URL
		s.PictureElem.BigPicture = s.PictureElem.SourcePicture
		u, err := url.Parse(res.URL)
		if err == nil {
			snapshot := u.Query()
			snapshot.Set("type", "image")
			snapshot.Set("width", "640")
			snapshot.Set("height", "640")
			u.RawQuery = snapshot.Encode()
			s.PictureElem.SnapshotPicture = &sdk_struct.PictureBaseInfo{
				Width:  640,
				Height: 640,
				Url:    u.String(),
			}
		} else {
			log.ZError(ctx, "parse url failed", err, "url", res.URL, "err", err)
			s.PictureElem.SnapshotPicture = s.PictureElem.SourcePicture
		}
		s.Content = utils.StructToJsonString(s.PictureElem)
	case constant.Sound:
		if s.Status == constant.MsgStatusSendSuccess {
			s.Content = utils.StructToJsonString(s.SoundElem)
			break
		}
		var sourcePath string
		if utils.FileExist(s.SoundElem.SoundPath) {
			sourcePath = s.SoundElem.SoundPath
			delFile = append(delFile, utils.FileTmpPath(s.SoundElem.SoundPath, c.DataDir))
		} else {
			sourcePath = utils.FileTmpPath(s.SoundElem.SoundPath, c.DataDir)
			delFile = append(delFile, sourcePath)
		}
		// log.Info("", "file", sourcePath, delFile)

		res, err := c.file.UploadFile(ctx, &file.UploadFileReq{
			ContentType: s.SoundElem.SoundType,
			Filepath:    sourcePath,
			Uuid:        s.SoundElem.UUID,
			Name:        c.fileName("voice", s.ClientMsgID) + filepathExt(s.SoundElem.UUID, sourcePath),
			Cause:       "msg-voice",
			CancelID:    s.ClientMsgID,
		}, NewUploadFileCallback(ctx, callback.OnProgress, s, lc.ConversationID, c.db))
		if err != nil {
			c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime, err, s, lc, isOnlineOnly)
			return nil, err
		}
		s.SoundElem.SourceURL = res.URL
		s.Content = utils.StructToJsonString(s.SoundElem)
	case constant.Video:
		if s.Status == constant.MsgStatusSendSuccess {
			s.Content = utils.StructToJsonString(s.VideoElem)
			break
		}
		var videoPath string
		var snapPath string
		if utils.FileExist(s.VideoElem.VideoPath) {
			videoPath = s.VideoElem.VideoPath
			snapPath = s.VideoElem.SnapshotPath
			delFile = append(delFile, utils.FileTmpPath(s.VideoElem.VideoPath, c.DataDir))
			delFile = append(delFile, utils.FileTmpPath(s.VideoElem.SnapshotPath, c.DataDir))
		} else {
			videoPath = utils.FileTmpPath(s.VideoElem.VideoPath, c.DataDir)
			snapPath = utils.FileTmpPath(s.VideoElem.SnapshotPath, c.DataDir)
			delFile = append(delFile, videoPath)
			delFile = append(delFile, snapPath)
		}
		log.ZDebug(ctx, "file", "videoPath", videoPath, "snapPath", snapPath, "delFile", delFile)

		var wg sync.WaitGroup
		wg.Add(2)
		var putErrs error
		go func() {
			defer wg.Done()
			snapRes, err := c.file.UploadFile(ctx, &file.UploadFileReq{
				ContentType: s.VideoElem.SnapshotType,
				Filepath:    snapPath,
				Uuid:        s.VideoElem.SnapshotUUID,
				Name:        c.fileName("videoSnapshot", s.ClientMsgID) + filepathExt(s.VideoElem.SnapshotUUID, snapPath),
				Cause:       "msg-video-snapshot",
				CancelID:    s.ClientMsgID,
			}, nil)
			if err != nil {
				log.ZWarn(ctx, "upload video snapshot failed", err)
				return
			}
			s.VideoElem.SnapshotURL = snapRes.URL
		}()

		go func() {
			defer wg.Done()
			res, err := c.file.UploadFile(ctx, &file.UploadFileReq{
				ContentType: content_type.GetType(s.VideoElem.VideoType, filepath.Ext(s.VideoElem.VideoPath)),
				Filepath:    videoPath,
				Uuid:        s.VideoElem.VideoUUID,
				Name:        c.fileName("video", s.ClientMsgID) + filepathExt(s.VideoElem.VideoUUID, videoPath),
				Cause:       "msg-video",
				CancelID:    s.ClientMsgID,
			}, NewUploadFileCallback(ctx, callback.OnProgress, s, lc.ConversationID, c.db))
			if err != nil {
				c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime, err, s, lc, isOnlineOnly)
				putErrs = err
				return
			}
			if res != nil {
				s.VideoElem.VideoURL = res.URL
			}
		}()
		wg.Wait()
		if err := putErrs; err != nil {
			return nil, err
		}
		s.Content = utils.StructToJsonString(s.VideoElem)
	case constant.File:
		if s.Status == constant.MsgStatusSendSuccess {
			s.Content = utils.StructToJsonString(s.FileElem)
			break
		}
		name := s.FileElem.FileName

		if name == "" {
			name = s.FileElem.FilePath
		}
		if name == "" {
			name = fmt.Sprintf("msg_file_%s.unknown", s.ClientMsgID)
		}

		var sourcePath string
		if utils.FileExist(s.FileElem.FilePath) {
			sourcePath = s.FileElem.FilePath
			delFile = append(delFile, utils.FileTmpPath(s.FileElem.FilePath, c.DataDir))
		} else {
			sourcePath = utils.FileTmpPath(s.FileElem.FilePath, c.DataDir)
			delFile = append(delFile, sourcePath)
		}

		res, err := c.file.UploadFile(ctx, &file.UploadFileReq{
			ContentType: content_type.GetType(s.FileElem.FileType, filepath.Ext(s.FileElem.FilePath), filepath.Ext(s.FileElem.FileName)),
			Filepath:    sourcePath,
			Uuid:        s.FileElem.UUID,
			Name:        c.fileName("file", s.ClientMsgID) + "/" + filepath.Base(name),
			Cause:       "msg-file",
			CancelID:    s.ClientMsgID,
		}, NewUploadFileCallback(ctx, callback.OnProgress, s, lc.ConversationID, c.db))
		if err != nil {
			c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime, err, s, lc, isOnlineOnly)
			return nil, err
		}
		s.FileElem.SourceURL = res.URL
		s.Content = utils.StructToJsonString(s.FileElem)
	case constant.Text:
		s.Content = utils.StructToJsonString(s.TextElem)
	case constant.AtText:
		s.Content = utils.StructToJsonString(s.AtTextElem)
	case constant.Location:
		s.Content = utils.StructToJsonString(s.LocationElem)
	case constant.Custom:
		s.Content = utils.StructToJsonString(s.CustomElem)
	case constant.Merger:
		s.Content = utils.StructToJsonString(s.MergeElem)
	case constant.Quote:
		quoteMessage, err := c.db.GetMessage(ctx, lc.ConversationID, s.QuoteElem.QuoteMessage.ClientMsgID)
		if err != nil {
			log.ZWarn(ctx, "quote message not found", err)
		}
		s.QuoteElem.QuoteMessage.Seq = quoteMessage.Seq
		s.Content = utils.StructToJsonString(s.QuoteElem)
	case constant.Card:
		s.Content = utils.StructToJsonString(s.CardElem)
	case constant.Face:
		s.Content = utils.StructToJsonString(s.FaceElem)
	case constant.AdvancedText:
		s.Content = utils.StructToJsonString(s.AdvancedTextElem)
	case constant.MarkdownText:
		s.Content = utils.StructToJsonString(s.MarkdownTextElem)
	default:
		return nil, sdkerrs.ErrMsgContentTypeNotSupport
	}
	if utils.IsContainInt(int(s.ContentType), []int{constant.Picture, constant.Sound, constant.Video, constant.File}) {
		if !isOnlineOnly {
			localMessage := converter.MsgStructToLocalChatLog(s)
			log.ZDebug(ctx, "update message is ", "localMessage", localMessage)
			err = c.db.UpdateMessage(ctx, lc.ConversationID, localMessage)
			if err != nil {
				return nil, err
			}
		}
	}

	return c.sendMessageToServer(ctx, s, lc, callback, delFile, p, options, isOnlineOnly)
}

func (c *Conversation) sendMessageNotOss(ctx context.Context, s *sdk_struct.MsgStruct, recvID, groupID string,
	p *sdkws.OfflinePushInfo, isOnlineOnly bool) (*sdk_struct.MsgStruct, error) {
	options := make(map[string]bool, 2)
	lc, err := c.checkID(ctx, s, recvID, groupID, options)
	if err != nil {
		return nil, err
	}
	callback, ok := ctx.Value(ccontext.CtxCallback).(open_im_sdk_callback.SendMsgCallBack)
	if !ok {
		return nil, sdkerrs.ErrSdkInternal.WrapMsg("context not found SendMsgCallBack")
	}
	if !isOnlineOnly {
		oldMessage, err := c.db.GetMessage(ctx, lc.ConversationID, s.ClientMsgID)
		if err != nil {
			localMessage := converter.MsgStructToLocalChatLog(s)
			err := c.db.InsertMessage(ctx, lc.ConversationID, localMessage)
			if err != nil {
				return nil, err
			}
			err = c.db.InsertSendingMessage(ctx, &model_struct.LocalSendingMessages{
				ConversationID: lc.ConversationID,
				ClientMsgID:    localMessage.ClientMsgID,
			})
			if err != nil {
				return nil, err
			}
		} else {
			if oldMessage.Status != constant.MsgStatusSendFailed {
				return nil, sdkerrs.ErrMsgRepeated
			} else {
				s.Status = constant.MsgStatusSending
				err = c.db.InsertSendingMessage(ctx, &model_struct.LocalSendingMessages{
					ConversationID: lc.ConversationID,
					ClientMsgID:    s.ClientMsgID,
				})
				if err != nil {
					return nil, err
				}
			}
		}
	}
	lc.LatestMsg = utils.StructToJsonString(s)
	var delFile []string
	switch s.ContentType {
	case constant.Picture:
		s.Content = utils.StructToJsonString(s.PictureElem)
	case constant.Sound:
		s.Content = utils.StructToJsonString(s.SoundElem)
	case constant.Video:
		s.Content = utils.StructToJsonString(s.VideoElem)
	case constant.File:
		s.Content = utils.StructToJsonString(s.FileElem)
	case constant.Text:
		s.Content = utils.StructToJsonString(s.TextElem)
	case constant.AtText:
		s.Content = utils.StructToJsonString(s.AtTextElem)
	case constant.Location:
		s.Content = utils.StructToJsonString(s.LocationElem)
	case constant.Custom:
		s.Content = utils.StructToJsonString(s.CustomElem)
	case constant.Merger:
		s.Content = utils.StructToJsonString(s.MergeElem)
	case constant.Quote:
		s.Content = utils.StructToJsonString(s.QuoteElem)
	case constant.Card:
		s.Content = utils.StructToJsonString(s.CardElem)
	case constant.Face:
		s.Content = utils.StructToJsonString(s.FaceElem)
	case constant.AdvancedText:
		s.Content = utils.StructToJsonString(s.AdvancedTextElem)
	case constant.MarkdownText:
		s.Content = utils.StructToJsonString(s.MarkdownTextElem)
	default:
		return nil, sdkerrs.ErrMsgContentTypeNotSupport
	}
	if utils.IsContainInt(int(s.ContentType), []int{constant.Picture, constant.Sound, constant.Video, constant.File}) {
		if isOnlineOnly {
			localMessage := converter.MsgStructToLocalChatLog(s)
			err = c.db.UpdateMessage(ctx, lc.ConversationID, localMessage)
			if err != nil {
				return nil, err
			}
		}
	}
	return c.sendMessageToServer(ctx, s, lc, callback, delFile, p, options, isOnlineOnly)
}

func (c *Conversation) SendMessage(ctx context.Context, s *sdk_struct.MsgStruct, recvID, groupID string, p *sdkws.OfflinePushInfo, isOnlineOnly bool) (*sdk_struct.MsgStruct, error) {
	diagnose.Info("msg.send.enqueue",
		"opid", ccontext.Info(ctx).OperationID(),
		"client_msg_id", s.ClientMsgID,
		"recv_id", diagnose.HashPII(recvID),
		"group_id", diagnose.HashPII(groupID),
		"content_type", fmt.Sprint(s.ContentType),
		"online_only", fmt.Sprint(isOnlineOnly),
	)
	task := &sendTask{
		ctx: ctx,
		msg: s,
		exec: func(taskCtx context.Context) (*sdk_struct.MsgStruct, error) {
			return c.sendMessage(taskCtx, s, recvID, groupID, p, isOnlineOnly)
		},
	}
	if err := c.getSender().submit(task); err != nil {
		return nil, err
	}
	return nil, nil
}

func (c *Conversation) SendMessageNotOss(ctx context.Context, s *sdk_struct.MsgStruct, recvID, groupID string,
	p *sdkws.OfflinePushInfo, isOnlineOnly bool) (*sdk_struct.MsgStruct, error) {
	diagnose.Info("msg.send.enqueue",
		"opid", ccontext.Info(ctx).OperationID(),
		"client_msg_id", s.ClientMsgID,
		"recv_id", diagnose.HashPII(recvID),
		"group_id", diagnose.HashPII(groupID),
		"content_type", fmt.Sprint(s.ContentType),
		"online_only", fmt.Sprint(isOnlineOnly),
	)
	task := &sendTask{
		ctx: ctx,
		msg: s,
		exec: func(taskCtx context.Context) (*sdk_struct.MsgStruct, error) {
			return c.sendMessageNotOss(taskCtx, s, recvID, groupID, p, isOnlineOnly)
		},
	}
	if err := c.getSender().submit(task); err != nil {
		return nil, err
	}
	return nil, nil
}

func (c *Conversation) sendMessageToServer(ctx context.Context, s *sdk_struct.MsgStruct, lc *model_struct.LocalConversation, callback open_im_sdk_callback.SendMsgCallBack,
	delFiles []string, offlinePushInfo *sdkws.OfflinePushInfo, options map[string]bool, isOnlineOnly bool) (*sdk_struct.MsgStruct, error) {
	if isOnlineOnly {
		utils.SetSwitchFromOptions(options, constant.IsHistory, false)
		utils.SetSwitchFromOptions(options, constant.IsPersistent, false)
		utils.SetSwitchFromOptions(options, constant.IsSenderSync, false)
		utils.SetSwitchFromOptions(options, constant.IsConversationUpdate, false)
		utils.SetSwitchFromOptions(options, constant.IsSenderConversationUpdate, false)
		utils.SetSwitchFromOptions(options, constant.IsUnreadCount, false)
		utils.SetSwitchFromOptions(options, constant.IsOfflinePush, false)
	}
	err := c.conversationHotColdManager.Promote(ctx, lc.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "Promote conversation failed", err, "conversationID", lc.ConversationID)
	}
	//Protocol conversion
	var wsMsgData sdkws.MsgData
	copier.Copy(&wsMsgData, s)
	wsMsgData.SessionId = s.SessionID
	wsMsgData.AttachedInfo = utils.StructToJsonString(s.AttachedInfoElem)
	wsMsgData.Content = []byte(s.Content)
	wsMsgData.CreateTime = s.CreateTime
	wsMsgData.SendTime = 0
	wsMsgData.Options = options
	if wsMsgData.ContentType == constant.AtText {
		wsMsgData.AtUserIDList = s.AtTextElem.AtUserList
	}
	wsMsgData.OfflinePushInfo = offlinePushInfo
	err = c.messageEncryptor.Encryption(ctx, &wsMsgData, lc.ConversationID)
	if err != nil {
		log.ZWarn(ctx, "encrypt message failed", err, "message", s)
	}
	s.Content = ""
	var sendMsgResp msg.SendMsgResp

	err = c.LongConnMgr.SendReqWaitResp(ctx, &wsMsgData, constant.SendMsg, &sendMsgResp)
	if err != nil {
		diagnose.Error("msg.send.fail", err,
			"opid", ccontext.Info(ctx).OperationID(),
			"client_msg_id", s.ClientMsgID,
			"conversation_id", diagnose.HashPII(lc.ConversationID),
		)
		//if send message network timeout need to double-check message has received by db.
		if sdkerrs.ErrNetworkTimeOut.Is(err) && !isOnlineOnly {
			oldMessage, _ := c.db.GetMessage(ctx, lc.ConversationID, s.ClientMsgID)
			if oldMessage.Status == constant.MsgStatusSendSuccess {
				sendMsgResp.SendTime = oldMessage.SendTime
				sendMsgResp.ClientMsgID = oldMessage.ClientMsgID
				sendMsgResp.ServerMsgID = oldMessage.ServerMsgID
			} else {
				log.ZError(ctx, "send msg to server failed", err, "message", s)
				c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime,
					err, s, lc, isOnlineOnly)
				return s, err
			}
		} else {
			log.ZError(ctx, "send msg to server failed", err, "message", s)
			c.updateMsgStatusAndTriggerConversationByErr(ctx, s.ClientMsgID, "", s.CreateTime,
				err, s, lc, isOnlineOnly)
			return s, err
		}
	}

	if sendMsgResp.Modify == nil {
		s.SendTime = sendMsgResp.SendTime
		s.ServerMsgID = sendMsgResp.ServerMsgID
		s.Status = constant.MsgStatusSendSuccess
	} else {
		sendMsgResp.Modify.Status = constant.MsgStatusSendSuccess
		s = converter.MsgDataToMsgStruct(sendMsgResp.Modify)
		converter.PopulateMsgStructByContentType(s)
		val := converter.MsgStructToLocalChatLog(s)
		if err := c.db.UpdateMessage(ctx, lc.ConversationID, val); err != nil {
			log.ZError(ctx, "update modify message", err, "resp", &sendMsgResp)
		}
	}

	go func() {
		//remove media cache file
		for _, file := range delFiles {
			err := os.Remove(file)
			if err != nil {
				log.ZError(ctx, "delete temp File is failed", err, "filePath", file)
			}
			// log.ZDebug(ctx, "remove temp file:", "file", file)
		}

		c.updateMsgStatusAndTriggerConversationByErr(ctx, sendMsgResp.ClientMsgID, sendMsgResp.ServerMsgID, sendMsgResp.SendTime, nil, s, lc, isOnlineOnly)
	}()
	diagnose.Info("msg.send.success",
		"opid", ccontext.Info(ctx).OperationID(),
		"client_msg_id", sendMsgResp.ClientMsgID,
		"server_msg_id", sendMsgResp.ServerMsgID,
		"conversation_id", diagnose.HashPII(lc.ConversationID),
	)
	return s, nil

}

func (c *Conversation) FindMessageList(ctx context.Context, req []*sdk_params_callback.ConversationArgs) (*sdk_params_callback.FindMessageListCallback, error) {
	var r sdk_params_callback.FindMessageListCallback
	type tempConversationAndMessageList struct {
		conversation *model_struct.LocalConversation
		msgIDList    []string
	}
	var s []*tempConversationAndMessageList
	for _, conversationsArgs := range req {
		localConversation, err := c.db.GetConversation(ctx, conversationsArgs.ConversationID)
		if err != nil {
			log.ZError(ctx, "GetConversation err", err, "conversationsArgs", conversationsArgs)
		} else {
			t := new(tempConversationAndMessageList)
			t.conversation = localConversation
			t.msgIDList = conversationsArgs.ClientMsgIDList
			s = append(s, t)
		}
	}
	for _, v := range s {
		messages, err := c.db.GetMessagesByClientMsgIDs(ctx, v.conversation.ConversationID, v.msgIDList)
		if err == nil {
			var tempMessageList []*sdk_struct.MsgStruct
			for _, message := range messages {
				temp := converter.LocalChatLogToMsgStruct(message)
				tempMessageList = append(tempMessageList, temp)
			}
			findResultItem := sdk_params_callback.SearchByConversationResult{}
			findResultItem.ConversationID = v.conversation.ConversationID
			findResultItem.FaceURL = v.conversation.FaceURL
			findResultItem.ShowName = v.conversation.ShowName
			findResultItem.ConversationType = v.conversation.ConversationType
			findResultItem.MessageList = tempMessageList
			findResultItem.MessageCount = len(findResultItem.MessageList)
			r.FindResultItems = append(r.FindResultItems, &findResultItem)
			r.TotalCount += findResultItem.MessageCount
		} else {
			log.ZError(ctx, "GetMessagesByClientMsgIDs err", err, "conversationID", v.conversation.ConversationID, "msgIDList", v.msgIDList)
		}
	}
	return &r, nil

}

func (c *Conversation) GetAdvancedHistoryMessageList(ctx context.Context, req sdk_params_callback.GetAdvancedHistoryMessageListParams) (*sdk_params_callback.GetAdvancedHistoryMessageListCallback, error) {
	result, err := c.getAdvancedHistoryMessageList(ctx, req, false)
	if err != nil {
		return nil, err
	}
	if len(result.MessageList) == 0 {
		s := make([]*sdk_struct.MsgStruct, 0)
		result.MessageList = s
	}
	return result, nil
}

func (c *Conversation) GetAdvancedHistoryMessageListReverse(ctx context.Context, req sdk_params_callback.GetAdvancedHistoryMessageListParams) (*sdk_params_callback.GetAdvancedHistoryMessageListCallback, error) {
	result, err := c.getAdvancedHistoryMessageList(ctx, req, true)
	if err != nil {
		return nil, err
	}
	if len(result.MessageList) == 0 {
		s := make([]*sdk_struct.MsgStruct, 0)
		result.MessageList = s
	}
	return result, nil
}

func (c *Conversation) GetAllHistoryMessages(ctx context.Context, req sdk_params_callback.GetAllHistoryMessagesParams,
	onProgress func(pulled, total int)) (*sdk_params_callback.GetAllHistoryMessagesCallback, error) {
	const batchSize int64 = 200

	var maxSeqResp sdkws.GetMaxSeqResp
	if err := c.SendReqWaitResp(ctx, &sdkws.GetMaxSeqReq{UserID: c.loginUserID}, constant.GetNewestSeq, &maxSeqResp); err != nil {
		log.ZError(ctx, "GetAllHistoryMessages GetNewestSeq failed", err, "conversationID", req.ConversationID)
		return nil, err
	}
	log.ZDebug(ctx, "GetAllHistoryMessages MaxSeqs", "allMaxSeqs", maxSeqResp.MaxSeqs, "conversationID", req.ConversationID)
	maxSeq := maxSeqResp.MaxSeqs[req.ConversationID]
	if maxSeq == 0 {
		log.ZWarn(ctx, "GetAllHistoryMessages maxSeq is 0, returning empty", nil, "conversationID", req.ConversationID)
		return &sdk_params_callback.GetAllHistoryMessagesCallback{
			MessageList: make([]*sdk_struct.MsgStruct, 0),
		}, nil
	}

	log.ZDebug(ctx, "GetAllHistoryMessages start pulling", "conversationID", req.ConversationID, "maxSeq", maxSeq)
	totalEstimate := int(maxSeq)
	var allMessages []*model_struct.LocalChatLog

	for begin := int64(1); begin <= maxSeq; begin += batchSize {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		end := begin + batchSize - 1
		if end > maxSeq {
			end = maxSeq
		}

		pullReq := sdkws.PullMessageBySeqsReq{UserID: c.loginUserID}
		pullReq.SeqRanges = append(pullReq.SeqRanges, &sdkws.SeqRange{
			ConversationID: req.ConversationID,
			Begin:          begin,
			End:            end,
			Num:            batchSize,
		})
		var pullResp sdkws.PullMessageBySeqsResp
		if err := c.SendReqWaitResp(ctx, &pullReq, constant.PullMsgByRange, &pullResp); err != nil {
			log.ZError(ctx, "GetAllHistoryMessages pull batch failed", err,
				"conversationID", req.ConversationID, "begin", begin, "end", end)
			continue
		}

		convMsgs, ok := pullResp.Msgs[req.ConversationID]
		if !ok || convMsgs == nil {
			log.ZDebug(ctx, "GetAllHistoryMessages batch empty", "conversationID", req.ConversationID, "begin", begin, "end", end)
			continue
		}

		if err := c.messageEncryptor.Decryption(ctx, convMsgs.Msgs, req.ConversationID); err != nil {
			log.ZWarn(ctx, "GetAllHistoryMessages decryption failed", err, "conversationID", req.ConversationID)
		}

		batchValid := 0
		var selfMsgs, otherMsgs []*model_struct.LocalChatLog
		for _, msgData := range convMsgs.Msgs {
			if msgData == nil || msgData.Status == constant.MsgStatusHasDeleted {
				continue
			}
			localMsg := converter.MsgDataToLocalChatLog(msgData)
			if msgData.SendID == c.loginUserID {
				selfMsgs = append(selfMsgs, localMsg)
			} else {
				otherMsgs = append(otherMsgs, localMsg)
			}
			batchValid++
		}
		filled := c.faceURLAndNicknameHandle(ctx, selfMsgs, otherMsgs, req.ConversationID)
		allMessages = append(allMessages, filled...)

		log.ZDebug(ctx, "GetAllHistoryMessages batch done", "conversationID", req.ConversationID,
			"begin", begin, "end", end, "batchValid", batchValid, "totalSoFar", len(allMessages))

		if onProgress != nil {
			onProgress(len(allMessages), totalEstimate)
		}
	}

	log.ZDebug(ctx, "GetAllHistoryMessages pull complete, writing to DB",
		"conversationID", req.ConversationID, "totalMessages", len(allMessages))

	if err := c.db.DeleteConversationAllMessages(ctx, req.ConversationID); err != nil {
		log.ZError(ctx, "GetAllHistoryMessages delete old messages failed", err, "conversationID", req.ConversationID)
		return nil, err
	}

	if len(allMessages) > 0 {
		const dbBatchSize = 40
		for i := 0; i < len(allMessages); i += dbBatchSize {
			end := i + dbBatchSize
			if end > len(allMessages) {
				end = len(allMessages)
			}
			chunk := allMessages[i:end]
			insertMap := make(map[string][]*model_struct.LocalChatLog)
			insertMap[req.ConversationID] = chunk
			if err := c.batchInsertMessageList(ctx, insertMap); err != nil {
				log.ZError(ctx, "GetAllHistoryMessages batch insert failed", err,
					"conversationID", req.ConversationID, "chunk", i, "chunkSize", len(chunk))
				return nil, err
			}
		}
	}

	log.ZDebug(ctx, "GetAllHistoryMessages DB write done, reading back from DB",
		"conversationID", req.ConversationID)

	dbMessages, err := c.db.GetMessageList(ctx, req.ConversationID, int(maxSeq), 0, 0, "", false)
	if err != nil {
		log.ZError(ctx, "GetAllHistoryMessages read back from DB failed", err, "conversationID", req.ConversationID)
		return nil, err
	}

	var messageList sdk_struct.NewMsgList = c.LocalChatLog2MsgStruct(dbMessages)
	sort.Sort(messageList)

	return &sdk_params_callback.GetAllHistoryMessagesCallback{
		MessageList: messageList,
		TotalCount:  len(messageList),
	}, nil
}

func (c *Conversation) RevokeMessage(ctx context.Context, conversationID, clientMsgID string) error {
	return c.revokeOneMessage(ctx, conversationID, clientMsgID)
}

func (c *Conversation) TypingStatusUpdate(ctx context.Context, recvID, msgTip string) error {
	return c.typingStatusUpdate(ctx, recvID, msgTip)
}

func (c *Conversation) MarkConversationMessageAsRead(ctx context.Context, conversationID string) error {
	return c.markConversationMessageAsRead(ctx, conversationID)
}

func (c *Conversation) MarkAllConversationMessageAsRead(ctx context.Context) error {
	conversationIDs, err := c.db.FindAllUnreadConversationConversationID(ctx)
	if err != nil {
		return err
	}
	for _, conversationID := range conversationIDs {
		if err = c.markConversationMessageAsRead(ctx, conversationID); err != nil {
			return err
		}
	}
	return nil
}

// deprecated
func (c *Conversation) MarkMessagesAsReadByMsgID(ctx context.Context, conversationID string, clientMsgIDs []string) error {
	return c.markMessagesAsReadByMsgID(ctx, conversationID, clientMsgIDs)
}
func (c *Conversation) SendGroupMessageReadReceipt(ctx context.Context, conversationID string, clientMsgIDs []string) error {
	return c.sendGroupMessageReadReceipt(ctx, conversationID, clientMsgIDs)
}
func (c *Conversation) GetGroupMessageReaderList(ctx context.Context, conversationID string, clientMsgID string,
	filter, offset, count int32) ([]*model_struct.LocalGroupMember, error) {
	return c.getGroupMessageReaderList(ctx, conversationID, clientMsgID, filter, offset, count)
}

func (c *Conversation) DeleteMessageFromLocalStorage(ctx context.Context, conversationID string, clientMsgID string) error {
	return c.deleteMessageFromLocal(ctx, conversationID, clientMsgID)
}

// deprecated
func (c *Conversation) DeleteMessage(ctx context.Context, conversationID string, clientMsgID string) error {
	return c.deleteMessage(ctx, conversationID, clientMsgID, nil)
}

func (c *Conversation) DeleteMessages(ctx context.Context, req *sdk_params_callback.DeleteMessagesReq) error {
	return c.deleteMessages(ctx, req.ConversationID, req.ClientMsgIDs, req.IsSync)
}

func (c *Conversation) DeleteUserAllMessagesInConv(ctx context.Context, conversationID string, userID string) error {
	return c.deleteUserAllMessagesInConv(ctx, conversationID, userID)
}

func (c *Conversation) DeleteAllMsgFromLocalAndServer(ctx context.Context) error {
	return c.deleteAllMsgFromLocalAndServer(ctx)
}

func (c *Conversation) DeleteAllMessageFromLocalStorage(ctx context.Context) error {
	return c.deleteAllMsgFromLocal(ctx, true)
}

func (c *Conversation) ClearConversationAndDeleteAllMsg(ctx context.Context, conversationID string) error {
	return c.clearConversationFromLocalAndServer(ctx, conversationID, c.db.ClearConversation)
}

func (c *Conversation) DeleteConversationAndDeleteAllMsg(ctx context.Context, conversationID string) error {
	return c.clearConversationFromLocalAndServer(ctx, conversationID, c.db.ResetConversation)
}

func (c *Conversation) InsertSingleMessageToLocalStorage(ctx context.Context, s *sdk_struct.MsgStruct, recvID, sendID string) (*sdk_struct.MsgStruct, error) {
	if recvID == "" || sendID == "" {
		return nil, sdkerrs.ErrArgs
	}
	var conversation model_struct.LocalConversation
	if sendID != c.loginUserID {
		faceUrl, name, err := c.getUserNameAndFaceURL(ctx, sendID)
		if err != nil {
			//log.Error(operationID, "GetUserNameAndFaceURL err", err.Error(), sendID)
		}
		s.SenderFaceURL = faceUrl
		s.SenderNickname = name
		conversation.FaceURL = faceUrl
		conversation.ShowName = name
		conversation.UserID = sendID
		conversation.ConversationID = c.getConversationIDBySessionType(sendID, constant.SingleChatType)

	} else {
		conversation.UserID = recvID
		conversation.ConversationID = c.getConversationIDBySessionType(recvID, constant.SingleChatType)
		_, err := c.db.GetConversation(ctx, conversation.ConversationID)
		if err != nil {
			faceUrl, name, err := c.getUserNameAndFaceURL(ctx, recvID)
			if err != nil {
				return nil, err
			}
			conversation.FaceURL = faceUrl
			conversation.ShowName = name
		}
	}

	s.SendID = sendID
	s.RecvID = recvID
	s.ClientMsgID = utils.GetMsgID(s.SendID)
	s.SendTime = utils.GetCurrentTimestampByMill()
	s.SessionType = constant.SingleChatType
	s.Status = constant.MsgStatusSendSuccess
	localMessage := converter.MsgStructToLocalChatLog(s)
	conversation.LatestMsg = utils.StructToJsonString(s)
	conversation.ConversationType = constant.SingleChatType
	conversation.LatestMsgSendTime = s.SendTime
	err := c.insertMessageToLocalStorage(ctx, conversation.ConversationID, localMessage)
	if err != nil {
		return nil, err
	}
	_ = c.OnUpsertConversationLatestMessage(ctx, &conversation)
	return s, nil

}

func (c *Conversation) InsertGroupMessageToLocalStorage(ctx context.Context, s *sdk_struct.MsgStruct, groupID, sendID string) (*sdk_struct.MsgStruct, error) {
	if groupID == "" || sendID == "" {
		return nil, sdkerrs.ErrArgs
	}
	var conversation model_struct.LocalConversation
	var err error
	_, conversation.ConversationType, err = c.getConversationTypeByGroupID(ctx, groupID)
	if err != nil {
		return nil, err
	}

	conversation.ConversationID = c.getConversationIDBySessionType(groupID, int(conversation.ConversationType))
	if sendID != c.loginUserID {
		faceUrl, name, err := c.getUserNameAndFaceURL(ctx, sendID)
		if err != nil {
			log.ZWarn(ctx, "getUserNameAndFaceUrlByUid err", err, "sendID", sendID)
		}
		s.SenderFaceURL = faceUrl
		s.SenderNickname = name
	}
	s.SendID = sendID
	s.GroupID = groupID
	s.ClientMsgID = utils.GetMsgID(s.SendID)
	s.SendTime = utils.GetCurrentTimestampByMill()
	s.SessionType = conversation.ConversationType
	s.Status = constant.MsgStatusSendSuccess
	localMessage := converter.MsgStructToLocalChatLog(s)
	conversation.LatestMsg = utils.StructToJsonString(s)
	conversation.LatestMsgSendTime = s.SendTime
	conversation.FaceURL = s.SenderFaceURL
	conversation.ShowName = s.SenderNickname
	err = c.insertMessageToLocalStorage(ctx, conversation.ConversationID, localMessage)
	if err != nil {
		return nil, err
	}
	_ = c.OnUpsertConversationLatestMessage(ctx, &conversation)
	return s, nil

}

func (c *Conversation) SearchLocalMessages(ctx context.Context, searchParam *sdk_params_callback.SearchLocalMessagesParams) (*sdk_params_callback.SearchLocalMessagesCallback, error) {
	searchParam.KeywordList = utils.TrimStringList(searchParam.KeywordList)
	return c.searchLocalMessages(ctx, searchParam)

}
func (c *Conversation) SetMessageLocalEx(ctx context.Context, conversationID string, clientMsgID string, localEx string) error {
	err := c.db.UpdateColumnsMessage(ctx, conversationID, clientMsgID, map[string]interface{}{"local_ex": localEx})
	if err != nil {
		return err
	}
	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	var latestMsg sdk_struct.MsgStruct
	utils.JsonStringToStruct(conversation.LatestMsg, &latestMsg)
	if latestMsg.ClientMsgID == clientMsgID {
		log.ZDebug(ctx, "latestMsg local ex changed", "seq", latestMsg.Seq, "clientMsgID", latestMsg.ClientMsgID)
		latestMsg.LocalEx = localEx
		latestMsgStr := utils.StructToJsonString(latestMsg)
		if err = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]interface{}{"latest_msg": latestMsgStr, "latest_msg_send_time": latestMsg.SendTime}); err != nil {
			return err
		}
		_ = c.OnConversationChanged(ctx, []string{conversationID})

	}
	return nil
}

func (c *Conversation) SetMessageLocalContent(ctx context.Context, conversationID string, message *sdk_struct.MsgStruct) error {
	tmpDB := converter.MsgStructToLocalChatLog(message)
	localMessage, err := c.db.GetMessage(ctx, conversationID, message.ClientMsgID)
	if err != nil {
		return err
	}
	localMessage.Content = tmpDB.Content
	if err = c.db.UpdateMessage(ctx, conversationID, localMessage); err != nil {
		return err
	}
	msgData := utils.StructToJsonString(converter.LocalChatLogToMsgStruct(localMessage))
	c.msgListener().OnMessageModified(msgData)
	conversation, err := c.db.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}
	var latestMsg sdk_struct.MsgStruct
	utils.JsonStringToStruct(conversation.LatestMsg, &latestMsg)
	if latestMsg.ClientMsgID == message.ClientMsgID {
		log.ZDebug(ctx, "latestMsg content changed", "seq", latestMsg.Seq, "clientMsgID", latestMsg.ClientMsgID)
		if err = c.db.UpdateColumnsConversation(ctx, conversationID, map[string]any{"latest_msg": msgData, "latest_msg_send_time": latestMsg.SendTime}); err != nil {
			return err
		}
		_ = c.OnConversationChanged(ctx, []string{conversationID})
	}
	return nil
}

func (c *Conversation) initBasicInfo(ctx context.Context, message *sdk_struct.MsgStruct, msgFrom, contentType int32) error {
	message.CreateTime = utils.GetCurrentTimestampByMill()
	message.SendTime = message.CreateTime
	message.IsRead = false
	message.Status = constant.MsgStatusSending
	message.SendID = c.loginUserID
	userInfo, err := c.user.GetUserInfoWithCache(ctx, c.loginUserID)
	if err != nil {
		return err
	}
	message.SenderFaceURL = userInfo.FaceURL
	message.SenderNickname = userInfo.Nickname
	ClientMsgID := utils.GetMsgID(message.SendID)
	message.ClientMsgID = ClientMsgID
	message.MsgFrom = msgFrom
	message.ContentType = contentType
	message.SenderPlatformID = c.platform
	return nil
}

func (c *Conversation) getConversationTypeByGroupID(ctx context.Context, groupID string) (conversationID string, conversationType int32, err error) {
	g, err := c.group.FetchGroupOrError(ctx, groupID)
	if err != nil {
		return "", 0, errs.WrapMsg(err, "get group info error")
	}
	switch g.GroupType {
	case constant.NormalGroup:
		return c.getConversationIDBySessionType(groupID, constant.WriteGroupChatType), constant.WriteGroupChatType, nil
	case constant.SuperGroup, constant.WorkingGroup:
		return c.getConversationIDBySessionType(groupID, constant.ReadGroupChatType), constant.ReadGroupChatType, nil
	default:
		return "", 0, sdkerrs.ErrGroupType
	}
}

func (c *Conversation) SearchConversation(ctx context.Context, searchParam string) ([]*server_api_params.Conversation, error) {
	// Check if search parameter is empty
	if searchParam == "" {
		return nil, sdkerrs.ErrArgs.WrapMsg("search parameter cannot be empty")
	}

	// Perform the search in your database or data source
	// This is a placeholder for the actual database call
	conversations, err := c.db.SearchConversations(ctx, searchParam)
	if err != nil {
		// Handle any errors that occurred during the search
		return nil, err
	}
	apiConversations := make([]*server_api_params.Conversation, len(conversations))
	for i, localConv := range conversations {
		// Create new server_api_params.Conversation and map fields from localConv
		apiConv := &server_api_params.Conversation{
			ConversationID:        localConv.ConversationID,
			ConversationType:      localConv.ConversationType,
			UserID:                localConv.UserID,
			GroupID:               localConv.GroupID,
			RecvMsgOpt:            localConv.RecvMsgOpt,
			UnreadCount:           localConv.UnreadCount,
			DraftTextTime:         localConv.DraftTextTime,
			IsPinned:              localConv.IsPinned,
			IsPrivateChat:         localConv.IsPrivateChat,
			BurnDuration:          localConv.BurnDuration,
			GroupAtType:           localConv.GroupAtType,
			IsNotInGroup:          localConv.IsNotInGroup,
			UpdateUnreadCountTime: localConv.UpdateUnreadCountTime,
			AttachedInfo:          localConv.AttachedInfo,
			Ex:                    localConv.Ex,
		}
		apiConversations[i] = apiConv
	}
	// Return the list of conversations
	return apiConversations, nil
}
func (c *Conversation) GetInputStates(ctx context.Context, conversationID string, userID string) ([]int32, error) {
	return c.typing.GetInputStates(conversationID, userID), nil
}

func (c *Conversation) ChangeInputStates(ctx context.Context, conversationID string, focus bool) error {
	return c.typing.ChangeInputStates(ctx, conversationID, focus)
}

func (c *Conversation) FetchSurroundingMessages(ctx context.Context, req *sdk_params_callback.FetchSurroundingMessagesReq) (*sdk_params_callback.FetchSurroundingMessagesResp, error) {
	conversationID := utils.GetConversationIDByMsg(req.StartMessage)
	var message *model_struct.LocalChatLog
	message, err := c.db.GetMessage(ctx, conversationID, req.StartMessage.ClientMsgID)
	if err == nil {
		if message.Status >= constant.MsgStatusHasDeleted {
			return nil, sdkerrs.ErrMsgHasDeleted
		}
	} else {
		if req.StartMessage.Seq == 0 {
			return nil, sdkerrs.ErrMsgHasDeleted
		}
		var messages []*model_struct.LocalChatLog
		c.fetchAndMergeMissingMessages(ctx, conversationID, []int64{req.StartMessage.Seq}, false,
			1, 0, &messages, &sdk_params_callback.GetAdvancedHistoryMessageListCallback{})
		if len(messages) < 1 {
			return nil, sdkerrs.ErrMsgHasDeleted
		}
		message = messages[0]
	}
	c.messagePullForwardEndSeqMap.Delete(conversationID, req.ViewType)
	c.messagePullReverseEndSeqMap.Delete(conversationID, req.ViewType)

	result := make([]*sdk_struct.MsgStruct, 0, req.Before+req.After+1)
	if req.Before > 0 {
		req := sdk_params_callback.GetAdvancedHistoryMessageListParams{
			ConversationID:   conversationID,
			Count:            req.Before,
			StartClientMsgID: req.StartMessage.ClientMsgID,
			ViewType:         req.ViewType,
		}
		val, err := c.getAdvancedHistoryMessageList(ctx, req, false)
		if err != nil {
			return nil, err
		}
		result = append(result, val.MessageList...)
	}
	result = append(result, converter.LocalChatLogToMsgStruct(message))
	if req.After > 0 {
		req := sdk_params_callback.GetAdvancedHistoryMessageListParams{
			ConversationID:   conversationID,
			Count:            req.After,
			StartClientMsgID: req.StartMessage.ClientMsgID,
			ViewType:         req.ViewType,
		}
		val, err := c.getAdvancedHistoryMessageList(ctx, req, true)
		if err != nil {
			return nil, err
		}
		result = append(result, val.MessageList...)
	}
	return &sdk_params_callback.FetchSurroundingMessagesResp{MessageList: result}, nil
}
func (c *Conversation) ModifyMessage(ctx context.Context, req *sdk_params_callback.ModifyMessageReq) (*sdk_params_callback.ModifyMessageResp, error) {
	tmpDB := converter.MsgStructToLocalChatLog(req.Message)
	conversation, err := c.db.GetConversation(ctx, req.ConversationID)
	if err != nil {
		return nil, err
	}
	message, err := c.waitForMessageSyncSeq(ctx, req.ConversationID, req.Message.ClientMsgID)
	if err != nil {
		return nil, err
	}
	if message.Status != constant.MsgStatusSendSuccess {
		return nil, errors.New("only send success message can be modified")
	}
	switch conversation.ConversationType {
	case constant.SingleChatType:
		if message.SendID != c.loginUserID {
			return nil, errors.New("only send by yourself message can be modified")
		}
	case constant.ReadGroupChatType:
		if message.SendID != c.loginUserID {
			groupAdmins, err := c.db.GetGroupMemberOwnerAndAdminDB(ctx, conversation.GroupID)
			if err != nil {
				return nil, err
			}
			var isAdmin bool
			for _, member := range groupAdmins {
				if member.UserID == c.loginUserID {
					isAdmin = true
					break
				}
			}
			if !isAdmin {
				return nil, errors.New("only group admin can modify other's message")
			}
		}
	}
	resp, err := c.modifyMessageFromServer(ctx, req.ConversationID, message.Seq, tmpDB.Content, message.Content)
	if err != nil {
		return nil, err
	}
	var oldModifiedCount int64
	var attachedInfo sdk_struct.AttachedInfoElem
	err = utils.JsonStringToStruct(message.AttachedInfo, &attachedInfo)
	if err != nil {
		log.ZWarn(context.Background(), "JsonStringToStruct error", err, "localMessage.AttachedInfo", message.AttachedInfo)
		return nil, err
	}
	if attachedInfo.LastModified != nil {
		oldModifiedCount = attachedInfo.LastModified.ModifiedCount
	} else {
		attachedInfo.LastModified = &sdk_struct.LastModified{}
	}
	if resp.ModifiedCount >= oldModifiedCount {
		attachedInfo.LastModified.UserID = c.loginUserID
		attachedInfo.LastModified.ModifiedTime = resp.ModifiedTime
		attachedInfo.LastModified.ModifiedCount = resp.ModifiedCount
		message.AttachedInfo = utils.StructToJsonString(attachedInfo)
		message.Content = tmpDB.Content

		if err = c.db.UpdateMessage(ctx, req.ConversationID, message); err != nil {
			log.ZWarn(ctx, "UpdateMessage err", err, "conversationID", req.ConversationID, "message", message)
			return nil, err
		}
		_ = c.OnUpdateConversationLatestMessageContent(ctx, &common.ModifyMessageInfo{
			ConversationID: req.ConversationID,
			ClientMsgID:    message.ClientMsgID,
			NewMessage:     converter.LocalChatLogToMsgStruct(message),
		})
	} else {
		log.ZDebug(ctx, "Expired  doModifyMessage", "tips.ModifiedTime", resp.ModifiedTime, "oldModifiedCount", oldModifiedCount)
	}
	return &sdk_params_callback.ModifyMessageResp{Message: converter.LocalChatLogToMsgStruct(message)}, nil
}

func (c *Conversation) ResetConversationUnread(ctx context.Context, req *pbMsg.ResetConversationUnreadReq) error {
	return c.resetConversationUnread(ctx, req)
}
