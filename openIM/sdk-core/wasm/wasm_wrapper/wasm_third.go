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

//go:build js && wasm
// +build js,wasm

package wasm_wrapper

import (
	"syscall/js"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/wasm/event_listener"
)

// ------------------------------------third---------------------------
type WrapperThird struct {
	*WrapperCommon
}

func NewWrapperThird(wrapperCommon *WrapperCommon) *WrapperThird {
	return &WrapperThird{WrapperCommon: wrapperCommon}
}
func (w *WrapperThird) UpdateFcmToken(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdateFcmToken, callback, &args).AsyncCallWithCallback()
}
func (w *WrapperThird) UploadFile(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewUploadFileCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc).SetUuid(&args)
	return event_listener.NewCaller(UploadFile, callback, &args).AsyncCallWithCallback()
}
func (w *WrapperThird) CancelUpload(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewUploadFileCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc).SetUuid(&args)
	return event_listener.NewCaller(open_im_sdk.CancelUpload, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) CreateTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.CreateTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) UpdateTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdateTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) DeleteTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.DeleteTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) GetTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.GetTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) ListTimerTasks(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.ListTimerTasks, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) CreateMessageTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.CreateMessageTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) CreateHttpTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.CreateHttpTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) CreateRpcTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.CreateRpcTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) CreatePresetTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.CreatePresetTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) UpdateMessageTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdateMessageTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) UpdateHttpTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdateHttpTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) UpdateRpcTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdateRpcTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) UpdatePresetTimerTask(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.UpdatePresetTimerTask, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) SpeechToText(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.SpeechToText, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) SpeechToTextCapabilities(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.SpeechToTextCapabilities, callback, &args).AsyncCallWithCallback()
}

func (w *WrapperThird) SetTemporaryLevel(_ js.Value, args []js.Value) interface{} {
	callback := event_listener.NewBaseCallback(utils.FirstLower(utils.GetSelfFuncName()), w.commonFunc)
	return event_listener.NewCaller(open_im_sdk.SetTemporaryLevel, callback, &args).AsyncCallWithCallback()
}

var _ open_im_sdk_callback.Base = (*TempBase)(nil)

type TempBase struct {
	u event_listener.UploadInterface
}

func NewTempBase(u event_listener.UploadInterface) *TempBase {
	return &TempBase{u: u}
}

func (t TempBase) OnError(errCode int32, errMsg string) {
	t.u.OnError(errCode, errMsg)
}

func (t TempBase) OnSuccess(data string) {
	t.u.OnSuccess(data)
}

var _ open_im_sdk_callback.UploadFileCallback = (*TempUploadFile)(nil)

type TempUploadFile struct {
	u event_listener.UploadInterface
}

func NewTempUploadFile(u event_listener.UploadInterface) *TempUploadFile {
	return &TempUploadFile{u: u}
}

func (t TempUploadFile) Open(size int64) {
	t.u.Open(size)
}

func (t TempUploadFile) PartSize(partSize int64, num int) {
	t.u.PartSize(partSize, num)
}

func (t TempUploadFile) HashPartProgress(index int, size int64, partHash string) {
	t.u.HashPartProgress(index, size, partHash)
}

func (t TempUploadFile) HashPartComplete(partsHash string, fileHash string) {
	t.u.HashPartComplete(partsHash, fileHash)
}

func (t TempUploadFile) UploadID(uploadID string) {
	t.u.UploadID(uploadID)
}

func (t TempUploadFile) UploadPartComplete(index int, partSize int64, partHash string) {
	t.u.UploadPartComplete(index, partSize, partHash)
}

func (t TempUploadFile) UploadComplete(fileSize int64, streamSize int64, storageSize int64) {
	t.u.UploadComplete(fileSize, streamSize, storageSize)
}

func (t TempUploadFile) Complete(size int64, url string, typ int) {
	t.u.Complete(size, url, typ)
}

func UploadFile(callback event_listener.UploadInterface, operationID string, req string) {
	b := NewTempBase(callback)
	t := NewTempUploadFile(callback)
	open_im_sdk.UploadFile(b, operationID, req, t)
}
