package signaling

import (
	"context"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/protocol/rtc"
)

func (s *LiveSignaling) getSignalInvitationInfoStartApp(ctx context.Context, req *rtc.GetSignalInvitationInfoStartAppReq) (*rtc.GetSignalInvitationInfoStartAppResp, error) {
	return api.GetSignalInvitationInfoStartApp.Invoke(ctx, req)
}

func (s *LiveSignaling) signalGetRoomByGroupID(ctx context.Context, req *rtc.SignalGetRoomByGroupIDReq) (*rtc.SignalGetRoomByGroupIDResp, error) {
	return api.SignalGetRoomByGroupID.Invoke(ctx, req)
}

func (s *LiveSignaling) signalSendCustomSignal(ctx context.Context, req *rtc.SignalSendCustomSignalReq) error {
	return api.SignalSendCustomSignal.Execute(ctx, req)
}
