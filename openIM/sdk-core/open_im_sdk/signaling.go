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
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
)

func SignalingInviteInGroup(callback open_im_sdk_callback.Base, operationID string, signalInviteInGroupReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingInviteInGroup, signalInviteInGroupReq)
}

func SignalingInvite(callback open_im_sdk_callback.Base, operationID string, signalInviteReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingInvite, signalInviteReq)
}

func SignalingAccept(callback open_im_sdk_callback.Base, operationID string, signalAcceptReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingAccept, signalAcceptReq)
}

func SignalingReject(callback open_im_sdk_callback.Base, operationID string, signalRejectReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingReject, signalRejectReq)
}

func SignalingCancel(callback open_im_sdk_callback.Base, operationID string, signalCancelReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingCancel, signalCancelReq)
}

func SignalingHungUp(callback open_im_sdk_callback.Base, operationID string, signalHungUpReq string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingHungUp, signalHungUpReq)
}

func SignalingGetRoomByGroupID(callback open_im_sdk_callback.Base, operationID string, groupID string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingGetRoomByGroupID, groupID)
}

func SignalingGetTokenByRoomID(callback open_im_sdk_callback.Base, operationID string, roomID string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingGetTokenByRoomID, roomID)
}

func GetSignalingInvitationInfoStartApp(callback open_im_sdk_callback.Base, operationID string) {
	call(callback, operationID, IMUserContext.Signaling().GetSignalingInvitationInfoStartApp)
}

func SignalingSendCustomSignal(callback open_im_sdk_callback.Base, operationID string, customInfo, roomID string) {
	call(callback, operationID, IMUserContext.Signaling().SignalingSendCustomSignal, customInfo, roomID)
}
