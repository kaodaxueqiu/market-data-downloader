import OpenIMSDK from '..';
import { BaseResponse } from '../../types/entity';
import { CustomSignalParams, RtcActionParams, SignalingInviteParams } from '@openim/wasm-client-sdk/lib/types/params';
import { RtcInviteResults, CallingRoomData } from '@openim/wasm-client-sdk/lib/types/entity';
export declare function setupSignalingModule(openIMSDK: OpenIMSDK): {
    signalingInviteInGroup: (params: SignalingInviteParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingInvite: (params: SignalingInviteParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingCancel: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingAccept: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingReject: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingHungUp: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingGetRoomByGroupID: (groupID: string, opid?: string) => Promise<BaseResponse<CallingRoomData>>;
    signalingGetTokenByRoomID: (roomID: string, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    getSignalingInvitationInfoStartApp: (opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingSendCustomSignal: (params: CustomSignalParams, opid?: string) => Promise<BaseResponse<void>>;
};
export interface SignalingModuleApi {
    signalingInviteInGroup: (params: SignalingInviteParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingInvite: (params: SignalingInviteParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingCancel: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingAccept: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingReject: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingHungUp: (params: RtcActionParams, opid?: string) => Promise<BaseResponse<void>>;
    signalingGetRoomByGroupID: (groupID: string, opid?: string) => Promise<BaseResponse<CallingRoomData>>;
    signalingGetTokenByRoomID: (roomID: string, opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    getSignalingInvitationInfoStartApp: (opid?: string) => Promise<BaseResponse<RtcInviteResults>>;
    signalingSendCustomSignal: (params: CustomSignalParams, opid?: string) => Promise<BaseResponse<void>>;
}
