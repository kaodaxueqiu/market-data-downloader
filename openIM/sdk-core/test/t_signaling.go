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

package test

import (
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/tools/log"
	"golang.org/x/net/context"
)

type testSignalingListener struct {
	ctx context.Context
}

func (s *testSignalingListener) OnHangUp(hangUpCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnHangUp ", hangUpCallback)
}

func (s *testSignalingListener) OnReceiveNewInvitation(receiveNewInvitationCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnReceiveNewInvitation ", receiveNewInvitationCallback)
}

func (s *testSignalingListener) OnInviteeAccepted(inviteeAcceptedCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInviteeAccepted ", inviteeAcceptedCallback)
}

func (s *testSignalingListener) OnInviteeRejected(inviteeRejectedCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInviteeRejected ", inviteeRejectedCallback)
}

func (s *testSignalingListener) OnInvitationCancelled(invitationCancelledCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInvitationCancelled ", invitationCancelledCallback)
}

func (s *testSignalingListener) OnInvitationTimeout(invitationTimeoutCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInvitationTimeout ", invitationTimeoutCallback)
}

func (s *testSignalingListener) OnInviteeAcceptedByOtherDevice(inviteeAcceptedCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInviteeAcceptedByOtherDevice ", inviteeAcceptedCallback)
}

func (s *testSignalingListener) OnInviteeRejectedByOtherDevice(inviteeRejectedCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnInviteeRejectedByOtherDevice ", inviteeRejectedCallback)
}

func (s *testSignalingListener) OnRoomParticipantConnected(onRoomChangeCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "onRoomChangeCallback", onRoomChangeCallback)
}

func (s *testSignalingListener) OnRoomParticipantDisconnected(onRoomChangeCallback string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "onRoomChangeCallback", onRoomChangeCallback)
}

func (s *testSignalingListener) OnReceiveCustomSignal(OnReceiveCustomSignal string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnReceiveCustomSignal", OnReceiveCustomSignal)
}

func (s *testSignalingListener) OnStreamChange(OnStreamChange string) {
	log.ZInfo(s.ctx, utils.GetSelfFuncName(), "OnStreamChange", OnStreamChange)
}
