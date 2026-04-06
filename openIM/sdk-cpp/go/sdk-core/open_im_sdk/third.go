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
	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
)

func UpdateFcmToken(callback open_im_sdk_callback.Base, operationID, fcmToken string, expireTime int64) {
	call(callback, operationID, IMUserContext.Third().UpdateFcmToken, fcmToken, expireTime)
}

func SetAppBadge(callback open_im_sdk_callback.Base, operationID string, appUnreadCount int32) {
	call(callback, operationID, IMUserContext.Third().SetAppBadge, appUnreadCount)
}

func UploadLogs(callback open_im_sdk_callback.Base, operationID string, line int, cancelID string, ex string, progress open_im_sdk_callback.UploadLogProgress) {
	call(callback, operationID, IMUserContext.Third().UploadLogs, line, cancelID, ex, progress)
}

func Logs(callback open_im_sdk_callback.Base, operationID string, logLevel int, file string, line int, msgs string, err string, keyAndValue string) {
	if IMUserContext == nil || IMUserContext.Third() == nil {
		callback.OnError(sdkerrs.SdkInternalError, "sdk not init")
		return
	}
	call(callback, operationID, IMUserContext.Third().Log, logLevel, file, line, msgs, err, keyAndValue)
}

func UploadFile(callback open_im_sdk_callback.Base, operationID string, req string, progress open_im_sdk_callback.UploadFileCallback) {
	call(callback, operationID, IMUserContext.File().UploadFile, req, file.UploadFileCallback(progress))
}

func CancelUpload(callback open_im_sdk_callback.Base, operationID string, cancelID string) {
	call(callback, operationID, IMUserContext.File().CancelUpload, cancelID)
}

func CreateTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().CreateTimerTask, req)
}

func UpdateTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().UpdateTimerTask, req)
}

func DeleteTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().DeleteTimerTask, req)
}

func GetTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().GetTimerTask, req)
}

func ListTimerTasks(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().ListTimerTasks, req)
}

func CreateMessageTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().CreateMessageTimerTask, req)
}

func CreateHttpTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().CreateHttpTimerTask, req)
}

func CreateRpcTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().CreateRpcTimerTask, req)
}

func CreatePresetTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().CreatePresetTimerTask, req)
}

func UpdateMessageTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().UpdateMessageTimerTask, req)
}

func UpdateHttpTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().UpdateHttpTimerTask, req)
}

func UpdateRpcTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().UpdateRpcTimerTask, req)
}

func UpdatePresetTimerTask(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().UpdatePresetTimerTask, req)
}

func SpeechToText(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().SpeechToText, req)
}

func SpeechToTextCapabilities(callback open_im_sdk_callback.Base, operationID string) {
	call(callback, operationID, IMUserContext.Third().SpeechToTextCapabilities)
}

func SetTemporaryLevel(callback open_im_sdk_callback.Base, operationID string, req string) {
	call(callback, operationID, IMUserContext.Third().SetTemporaryLevel, req)
}
