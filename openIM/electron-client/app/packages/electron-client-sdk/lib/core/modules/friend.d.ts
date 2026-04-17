import OpenIMSDK from '..';
import { BaseResponse } from '../../types/entity';
import { AccessFriendApplicationParams, AddBlackParams, AddFriendParams, GetFriendApplicationListAsApplicationParams, GetFriendApplicationListAsRecipientParams, GetSelfUnhandledApplyCountParams, GetSpecifiedFriendsParams, OffsetParams, PinFriendParams, RemarkFriendParams, SearchFriendParams, SetFriendExParams, UpdateFriendsParams } from '@openim/wasm-client-sdk/lib/types/params';
import { FriendshipInfo, BlackUserItem, FriendApplicationItem, SearchedFriendsInfo, FriendUserItem } from '@openim/wasm-client-sdk/lib/types/entity';
export declare function setupFriendModule(openIMSDK: OpenIMSDK): {
    acceptFriendApplication: (params: AccessFriendApplicationParams, opid?: string) => Promise<BaseResponse<void>>;
    addBlack: (params: AddBlackParams, opid?: string) => Promise<BaseResponse<void>>;
    addFriend: (params: AddFriendParams, opid?: string) => Promise<BaseResponse<void>>;
    checkFriend: (userIDList: string[], opid?: string) => Promise<BaseResponse<FriendshipInfo[]>>;
    deleteFriend: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    setFriendsEx: (params: SetFriendExParams, opid?: string) => Promise<BaseResponse<void>>;
    getBlackList: (opid?: string) => Promise<BaseResponse<BlackUserItem[]>>;
    getFriendApplicationListAsApplicant: (params?: GetFriendApplicationListAsApplicationParams, opid?: string) => Promise<BaseResponse<FriendApplicationItem[]>>;
    getFriendApplicationListAsRecipient: (params?: GetFriendApplicationListAsRecipientParams, opid?: string) => Promise<BaseResponse<FriendApplicationItem[]>>;
    getFriendApplicationUnhandledCount: (params: GetSelfUnhandledApplyCountParams, opid?: string) => Promise<BaseResponse<number>>;
    getFriendList: (filterBlack?: boolean, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    getFriendListPage: (params: OffsetParams & {
        filterBlack?: boolean;
    }, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    updateFriends: (params: UpdateFriendsParams, opid?: string) => Promise<BaseResponse<void>>;
    getSpecifiedFriendsInfo: (params: GetSpecifiedFriendsParams, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    refuseFriendApplication: (params: AccessFriendApplicationParams, opid?: string) => Promise<BaseResponse<void>>;
    deleteFriendRequests: (params: Array<{
        fromUserID: string;
        toUserID: string;
    }>, opid?: string) => Promise<BaseResponse<void>>;
    removeBlack: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    searchFriends: (params: SearchFriendParams, opid?: string) => Promise<BaseResponse<SearchedFriendsInfo[]>>;
    setFriendRemark: (params: RemarkFriendParams, opid?: string) => Promise<BaseResponse<void>>;
    pinFriends: (params: PinFriendParams, opid?: string) => Promise<BaseResponse<void>>;
};
export interface FriendModuleApi {
    acceptFriendApplication: (params: AccessFriendApplicationParams, opid?: string) => Promise<BaseResponse<void>>;
    addBlack: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    addFriend: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    checkFriend: (userIDList: string[], opid?: string) => Promise<BaseResponse<FriendshipInfo[]>>;
    deleteFriend: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    setFriendsEx: (params: SetFriendExParams, opid?: string) => Promise<BaseResponse<void>>;
    getBlackList: (opid?: string) => Promise<BaseResponse<BlackUserItem[]>>;
    getFriendApplicationListAsApplicant: (params: GetFriendApplicationListAsApplicationParams, opid?: string) => Promise<BaseResponse<FriendApplicationItem[]>>;
    getFriendApplicationListAsRecipient: (params: GetFriendApplicationListAsRecipientParams, opid?: string) => Promise<BaseResponse<FriendApplicationItem[]>>;
    getFriendApplicationUnhandledCount: (params: GetSelfUnhandledApplyCountParams, opid?: string) => Promise<BaseResponse<number>>;
    getFriendList: (filterBlack?: boolean, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    getFriendListPage: (params: OffsetParams & {
        filterBlack?: boolean;
    }, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    updateFriends: (params: UpdateFriendsParams, opid?: string) => Promise<BaseResponse<void>>;
    getSpecifiedFriendsInfo: (params: GetSpecifiedFriendsParams, opid?: string) => Promise<BaseResponse<FriendUserItem[]>>;
    refuseFriendApplication: (params: AccessFriendApplicationParams, opid?: string) => Promise<BaseResponse<void>>;
    deleteFriendRequests: (params: Array<{
        fromUserID: string;
        toUserID: string;
    }>, opid?: string) => Promise<BaseResponse<void>>;
    removeBlack: (userID: string, opid?: string) => Promise<BaseResponse<void>>;
    searchFriends: (params: SearchFriendParams, opid?: string) => Promise<BaseResponse<SearchedFriendsInfo[]>>;
    setFriendRemark: (params: RemarkFriendParams, opid?: string) => Promise<BaseResponse<void>>;
}
