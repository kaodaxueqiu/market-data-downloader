import { BaseResponse } from '../../types/entity';
import OpenIMSDK from '..';
import { MessageReceiveOptType } from '@openim/wasm-client-sdk';
import { SelfUserInfo, UserOnlineState, PublicUserItem } from '@openim/wasm-client-sdk/lib/types/entity';
import { PartialUserItem } from '@openim/wasm-client-sdk/lib/types/params';
export declare function setupUserModule(openIMSDK: OpenIMSDK): {
    getSelfUserInfo: (opid?: string) => Promise<BaseResponse<SelfUserInfo>>;
    setSelfInfo: (params: PartialUserItem, opid?: string) => Promise<BaseResponse<void>>;
    getUsersInfo: (params: string[], opid?: string) => Promise<BaseResponse<PublicUserItem[]>>;
    subscribeUsersStatus: (userIDList: string[], opid?: string) => Promise<BaseResponse<UserOnlineState>>;
    unsubscribeUsersStatus: (userIDList: string[], opid?: string) => Promise<BaseResponse<void>>;
    getSubscribeUsersStatus: (opid?: string) => Promise<BaseResponse<UserOnlineState[]>>;
    setGlobalRecvMessageOpt: (msgReceiveOptType: MessageReceiveOptType, opid?: string) => Promise<BaseResponse<void>>;
};
export interface UserModuleApi {
    getSelfUserInfo: (opid?: string) => Promise<BaseResponse<SelfUserInfo>>;
    setSelfInfo: (params: PartialUserItem, opid?: string) => Promise<BaseResponse<void>>;
    getUsersInfo: (params: string[], opid?: string) => Promise<BaseResponse<PublicUserItem[]>>;
    subscribeUsersStatus: (userIDList: string[], opid?: string) => Promise<BaseResponse<UserOnlineState>>;
    unsubscribeUsersStatus: (userIDList: string[], opid?: string) => Promise<BaseResponse<void>>;
    getSubscribeUsersStatus: (opid?: string) => Promise<BaseResponse<UserOnlineState[]>>;
    setGlobalRecvMessageOpt: (msgReceiveOptType: MessageReceiveOptType, opid?: string) => Promise<BaseResponse<void>>;
}
