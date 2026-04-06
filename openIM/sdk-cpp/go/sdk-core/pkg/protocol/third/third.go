// Copyright © 2023 OpenIM. All rights reserved.
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

package third

import (
	"errors"

	"github.com/openimsdk/protocol/constant"
)

func (x *FcmUpdateTokenReq) Check() error {
	if x.PlatformID > constant.HarmonyOSPlatformID || x.PlatformID < constant.IOSPlatformID {
		return errors.New("platformID is invalidate")
	}
	if x.FcmToken == "" {
		return errors.New("FcmToken is empty")
	}
	if x.Account == "" {
		return errors.New("account is empty")
	}
	return nil
}

func (x *SetAppBadgeReq) Check() error {
	if x.UserID == "" {
		return errors.New("UserID is empty")
	}
	return nil
}

func (x *InitiateMultipartUploadReq) Check() error {
	if x.UrlPrefix == "" {
		return errors.New("UrlPrefix is empty")
	}
	return nil
}

func (x *CompleteMultipartUploadReq) Check() error {
	if x.UrlPrefix == "" {
		return errors.New("UrlPrefix is empty")
	}
	return nil
}

func (x *CompleteFormDataReq) Check() error {
	if x.UrlPrefix == "" {
		return errors.New("UrlPrefix is empty")
	}
	return nil
}

func (x *DeleteOutdatedDataReq) Check() error {
	if x.Limit <= 0 {
		return errors.New("limit must be greater than 0")
	}
	if len(x.ObjectGroup) == 0 {
		return errors.New("ObjectGroup is empty")
	}
	return nil
}

func (x *CreateTimerTaskReq) Check() error {
	if x.UserID == "" {
		return errors.New("userID is empty")
	}
	if x.CallbackConfig == nil {
		return errors.New("callback config is nil")
	}
	if !CheckIfTimerTaskCallbackMethod(x.CallbackConfig.CallbackMethod) {
		return errors.New("callback method is invalidate")
	}
	if x.CallbackConfig.CallbackPayload == "" {
		return errors.New("callback payload is empty")
	}
	return nil
}

func (x *UpdateTimerTaskReq) Check() error {
	if x.UserID == "" {
		return errors.New("userID is empty")
	}
	if x.CallbackConfig == nil {
		return nil
	}
	if !CheckIfTimerTaskCallbackMethod(x.CallbackConfig.CallbackMethod) {
		return errors.New("callback method is invalidate")
	}
	if x.CallbackConfig.CallbackPayload == "" {
		return errors.New("callback payload is empty")
	}
	return nil
}

func (x *DeleteTimerTaskReq) Check() error {
	if x.UserID == "" {
		return errors.New("userID is empty")
	}
	return nil
}

func (x *GetTimerTaskReq) Check() error {
	if x.UserID == "" {
		return errors.New("userID is empty")
	}
	return nil
}

func (x *ListTimerTasksReq) Check() error {
	if x.UserID == "" {
		return errors.New("userID is empty")
	}
	return nil
}

// ------------AFTER IS TOOL FUNC---------------

func CheckIfTimerTaskCallbackMethod(val string) bool {
	switch val {
	case
		constant.TimerTaskCallbackMethodPreset,
		constant.TimerTaskCallbackMethodRpc,
		constant.TimerTaskCallbackMethodMessage,
		constant.TimerTaskCallbackMethodHttp:
		return true
	default:
		return false
	}
}
