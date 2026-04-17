'use strict';

var electron = require('electron');
var koffi = require('koffi');
var uuid = require('uuid');
var wasmClientSdk = require('@openim/wasm-client-sdk');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var koffi__default = /*#__PURE__*/_interopDefaultLegacy(koffi);

function setupUserModule(openIMSDK) {
    return {
        getSelfUserInfo: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_self_user_info(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        setSelfInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_self_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getUsersInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_users_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        subscribeUsersStatus: (userIDList, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.subscribe_users_status(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(userIDList));
        }),
        unsubscribeUsersStatus: (userIDList, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.unsubscribe_users_status(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(userIDList));
        }),
        getSubscribeUsersStatus: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_subscribe_users_status(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        setGlobalRecvMessageOpt: (msgReceiveOptType, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_self_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({
                globalRecvMsgOpt: msgReceiveOptType,
            }));
        }),
    };
}

var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["UnknownError"] = 10005] = "UnknownError";
})(ErrorCode || (ErrorCode = {}));

var NativeEvent;
(function (NativeEvent) {
    NativeEvent[NativeEvent["CONNECTING"] = 0] = "CONNECTING";
    NativeEvent[NativeEvent["CONNECT_SUCCESS"] = 1] = "CONNECT_SUCCESS";
    NativeEvent[NativeEvent["CONNECT_FAILED"] = 2] = "CONNECT_FAILED";
    NativeEvent[NativeEvent["KICKED_OFFLINE"] = 3] = "KICKED_OFFLINE";
    NativeEvent[NativeEvent["USER_TOKEN_EXPIRED"] = 4] = "USER_TOKEN_EXPIRED";
    NativeEvent[NativeEvent["JOINED_GROUP_ADDED"] = 5] = "JOINED_GROUP_ADDED";
    NativeEvent[NativeEvent["JOINED_GROUP_DELETED"] = 6] = "JOINED_GROUP_DELETED";
    NativeEvent[NativeEvent["GROUP_MEMBER_ADDED"] = 7] = "GROUP_MEMBER_ADDED";
    NativeEvent[NativeEvent["GROUP_MEMBER_DELETED"] = 8] = "GROUP_MEMBER_DELETED";
    NativeEvent[NativeEvent["GROUP_APPLICATION_ADDED"] = 9] = "GROUP_APPLICATION_ADDED";
    NativeEvent[NativeEvent["GROUP_APPLICATION_DELETED"] = 10] = "GROUP_APPLICATION_DELETED";
    NativeEvent[NativeEvent["GROUP_INFO_CHANGED"] = 11] = "GROUP_INFO_CHANGED";
    NativeEvent[NativeEvent["GROUP_DISMISSED"] = 12] = "GROUP_DISMISSED";
    NativeEvent[NativeEvent["GROUP_MEMBER_INFO_CHANGED"] = 13] = "GROUP_MEMBER_INFO_CHANGED";
    NativeEvent[NativeEvent["GROUP_APPLICATION_ACCEPTED"] = 14] = "GROUP_APPLICATION_ACCEPTED";
    NativeEvent[NativeEvent["GROUP_APPLICATION_REJECTED"] = 15] = "GROUP_APPLICATION_REJECTED";
    NativeEvent[NativeEvent["FRIEND_APPLICATION_ADDED"] = 16] = "FRIEND_APPLICATION_ADDED";
    NativeEvent[NativeEvent["FRIEND_APPLICATION_DELETED"] = 17] = "FRIEND_APPLICATION_DELETED";
    NativeEvent[NativeEvent["FRIEND_APPLICATION_ACCEPTED"] = 18] = "FRIEND_APPLICATION_ACCEPTED";
    NativeEvent[NativeEvent["FRIEND_APPLICATION_REJECTED"] = 19] = "FRIEND_APPLICATION_REJECTED";
    NativeEvent[NativeEvent["FRIEND_ADDED"] = 20] = "FRIEND_ADDED";
    NativeEvent[NativeEvent["FRIEND_DELETED"] = 21] = "FRIEND_DELETED";
    NativeEvent[NativeEvent["FRIEND_INFO_CHANGED"] = 22] = "FRIEND_INFO_CHANGED";
    NativeEvent[NativeEvent["BLACK_ADDED"] = 23] = "BLACK_ADDED";
    NativeEvent[NativeEvent["BLACK_DELETED"] = 24] = "BLACK_DELETED";
    NativeEvent[NativeEvent["SYNC_SERVER_START"] = 25] = "SYNC_SERVER_START";
    NativeEvent[NativeEvent["SYNC_SERVER_FINISH"] = 26] = "SYNC_SERVER_FINISH";
    NativeEvent[NativeEvent["SYNC_SERVER_PROGRESS"] = 27] = "SYNC_SERVER_PROGRESS";
    NativeEvent[NativeEvent["SYNC_SERVER_FAILED"] = 28] = "SYNC_SERVER_FAILED";
    NativeEvent[NativeEvent["NEW_CONVERSATION"] = 29] = "NEW_CONVERSATION";
    NativeEvent[NativeEvent["CONVERSATION_CHANGED"] = 30] = "CONVERSATION_CHANGED";
    NativeEvent[NativeEvent["TOTAL_UNREAD_MESSAGE_COUNT_CHANGED"] = 31] = "TOTAL_UNREAD_MESSAGE_COUNT_CHANGED";
    NativeEvent[NativeEvent["RECV_NEW_MESSAGE"] = 32] = "RECV_NEW_MESSAGE";
    NativeEvent[NativeEvent["RECV_C2C_READ_RECEIPT"] = 33] = "RECV_C2C_READ_RECEIPT";
    NativeEvent[NativeEvent["RECV_GROUP_READ_RECEIPT"] = 34] = "RECV_GROUP_READ_RECEIPT";
    NativeEvent[NativeEvent["NEW_RECV_MESSAGE_REVOKED"] = 35] = "NEW_RECV_MESSAGE_REVOKED";
    NativeEvent[NativeEvent["RECV_MESSAGE_EXTENSIONS_CHANGED"] = 36] = "RECV_MESSAGE_EXTENSIONS_CHANGED";
    NativeEvent[NativeEvent["RECV_MESSAGE_EXTENSIONS_DELETED"] = 37] = "RECV_MESSAGE_EXTENSIONS_DELETED";
    NativeEvent[NativeEvent["RECV_MESSAGE_EXTENSIONS_ADDED"] = 38] = "RECV_MESSAGE_EXTENSIONS_ADDED";
    NativeEvent[NativeEvent["RECV_OFFLINE_NEW_MESSAGE"] = 39] = "RECV_OFFLINE_NEW_MESSAGE";
    NativeEvent[NativeEvent["MSG_DELETED"] = 40] = "MSG_DELETED";
    NativeEvent[NativeEvent["RECV_NEW_MESSAGES"] = 41] = "RECV_NEW_MESSAGES";
    NativeEvent[NativeEvent["RECV_OFFLINE_NEW_MESSAGES"] = 42] = "RECV_OFFLINE_NEW_MESSAGES";
    NativeEvent[NativeEvent["SELF_INFO_UPDATED"] = 43] = "SELF_INFO_UPDATED";
    NativeEvent[NativeEvent["USER_STATUS_CHANGED"] = 44] = "USER_STATUS_CHANGED";
    NativeEvent[NativeEvent["RECV_CUSTOM_BUSINESS_MESSAGE"] = 45] = "RECV_CUSTOM_BUSINESS_MESSAGE";
    NativeEvent[NativeEvent["MESSAGE_KV_INFO_CHANGED"] = 46] = "MESSAGE_KV_INFO_CHANGED";
    NativeEvent[NativeEvent["OPEN"] = 47] = "OPEN";
    NativeEvent[NativeEvent["PART_SIZE"] = 48] = "PART_SIZE";
    NativeEvent[NativeEvent["HASH_PART_PROGRESS"] = 49] = "HASH_PART_PROGRESS";
    NativeEvent[NativeEvent["HASH_PART_COMPLETE"] = 50] = "HASH_PART_COMPLETE";
    NativeEvent[NativeEvent["UPLOAD_ID"] = 51] = "UPLOAD_ID";
    NativeEvent[NativeEvent["UPLOAD_PART_COMPLETE"] = 52] = "UPLOAD_PART_COMPLETE";
    NativeEvent[NativeEvent["UPLOAD_COMPLETE"] = 53] = "UPLOAD_COMPLETE";
    NativeEvent[NativeEvent["COMPLETE"] = 54] = "COMPLETE";
    NativeEvent[NativeEvent["CONVERSATION_USER_INPUT_STATUS_CHANGED"] = 55] = "CONVERSATION_USER_INPUT_STATUS_CHANGED";
    NativeEvent[NativeEvent["RECV_ONLINE_ONLY_MESSAGE"] = 56] = "RECV_ONLINE_ONLY_MESSAGE";
    NativeEvent[NativeEvent["CHANGED_PINNED_MESSAGE"] = 57] = "CHANGED_PINNED_MESSAGE";
    NativeEvent[NativeEvent["DELETE_USER_ALL_MSGS_IN_CONV"] = 58] = "DELETE_USER_ALL_MSGS_IN_CONV";
    NativeEvent[NativeEvent["MESSAGE_MODIFIED"] = 59] = "MESSAGE_MODIFIED";
    NativeEvent[NativeEvent["USER_TOKEN_INVALID"] = 60] = "USER_TOKEN_INVALID";
    NativeEvent[NativeEvent["RECV_NEW_INVITATION"] = 61] = "RECV_NEW_INVITATION";
    NativeEvent[NativeEvent["INVITEE_ACCEPTED"] = 62] = "INVITEE_ACCEPTED";
    NativeEvent[NativeEvent["INVITEE_ACCEPTED_BY_OTHER_DEVICE"] = 63] = "INVITEE_ACCEPTED_BY_OTHER_DEVICE";
    NativeEvent[NativeEvent["INVITEE_REJECTED"] = 64] = "INVITEE_REJECTED";
    NativeEvent[NativeEvent["INVITEE_REJECTED_BY_OTHER_DEVICE"] = 65] = "INVITEE_REJECTED_BY_OTHER_DEVICE";
    NativeEvent[NativeEvent["INVITATION_CANCELLED"] = 66] = "INVITATION_CANCELLED";
    NativeEvent[NativeEvent["INVITATION_TIMEOUT"] = 67] = "INVITATION_TIMEOUT";
    NativeEvent[NativeEvent["HANG_UP"] = 68] = "HANG_UP";
    NativeEvent[NativeEvent["ROOM_PARTICIPANT_CONNECTED"] = 69] = "ROOM_PARTICIPANT_CONNECTED";
    NativeEvent[NativeEvent["ROOM_PARTICIPANT_DISCONNECTED"] = 70] = "ROOM_PARTICIPANT_DISCONNECTED";
    NativeEvent[NativeEvent["STREAM_CHANGE"] = 71] = "STREAM_CHANGE";
    NativeEvent[NativeEvent["RECEIVE_CUSTOM_SIGNAL"] = 72] = "RECEIVE_CUSTOM_SIGNAL";
    NativeEvent[NativeEvent["ON_PROGRESS"] = 73] = "ON_PROGRESS";
    NativeEvent[NativeEvent["CONVERSATION_GROUP_ADDED"] = 74] = "CONVERSATION_GROUP_ADDED";
    NativeEvent[NativeEvent["CONVERSATION_GROUP_DELETED"] = 75] = "CONVERSATION_GROUP_DELETED";
    NativeEvent[NativeEvent["CONVERSATION_GROUP_CHANGED"] = 76] = "CONVERSATION_GROUP_CHANGED";
    NativeEvent[NativeEvent["CONVERSATION_GROUP_MEMBER_ADDED"] = 77] = "CONVERSATION_GROUP_MEMBER_ADDED";
    NativeEvent[NativeEvent["CONVERSATION_GROUP_MEMBER_DELETED"] = 78] = "CONVERSATION_GROUP_MEMBER_DELETED";
})(NativeEvent || (NativeEvent = {}));
const eventMapping = {
    [NativeEvent.CONNECTING]: wasmClientSdk.CbEvents.OnConnecting,
    [NativeEvent.CONNECT_SUCCESS]: wasmClientSdk.CbEvents.OnConnectSuccess,
    [NativeEvent.CONNECT_FAILED]: wasmClientSdk.CbEvents.OnConnectFailed,
    [NativeEvent.KICKED_OFFLINE]: wasmClientSdk.CbEvents.OnKickedOffline,
    [NativeEvent.USER_TOKEN_EXPIRED]: wasmClientSdk.CbEvents.OnUserTokenExpired,
    [NativeEvent.USER_TOKEN_INVALID]: wasmClientSdk.CbEvents.OnUserTokenInvalid,
    [NativeEvent.JOINED_GROUP_ADDED]: wasmClientSdk.CbEvents.OnJoinedGroupAdded,
    [NativeEvent.JOINED_GROUP_DELETED]: wasmClientSdk.CbEvents.OnJoinedGroupDeleted,
    [NativeEvent.GROUP_MEMBER_ADDED]: wasmClientSdk.CbEvents.OnGroupMemberAdded,
    [NativeEvent.GROUP_MEMBER_DELETED]: wasmClientSdk.CbEvents.OnGroupMemberDeleted,
    [NativeEvent.GROUP_APPLICATION_ADDED]: wasmClientSdk.CbEvents.OnGroupApplicationAdded,
    [NativeEvent.GROUP_APPLICATION_DELETED]: wasmClientSdk.CbEvents.OnGroupApplicationDeleted,
    [NativeEvent.GROUP_INFO_CHANGED]: wasmClientSdk.CbEvents.OnGroupInfoChanged,
    [NativeEvent.GROUP_DISMISSED]: wasmClientSdk.CbEvents.OnGroupDismissed,
    [NativeEvent.GROUP_MEMBER_INFO_CHANGED]: wasmClientSdk.CbEvents.OnGroupMemberInfoChanged,
    [NativeEvent.GROUP_APPLICATION_ACCEPTED]: wasmClientSdk.CbEvents.OnGroupApplicationAccepted,
    [NativeEvent.GROUP_APPLICATION_REJECTED]: wasmClientSdk.CbEvents.OnGroupApplicationRejected,
    [NativeEvent.FRIEND_APPLICATION_ADDED]: wasmClientSdk.CbEvents.OnFriendApplicationAdded,
    [NativeEvent.FRIEND_APPLICATION_DELETED]: wasmClientSdk.CbEvents.OnFriendApplicationDeleted,
    [NativeEvent.FRIEND_APPLICATION_ACCEPTED]: wasmClientSdk.CbEvents.OnFriendApplicationAccepted,
    [NativeEvent.FRIEND_APPLICATION_REJECTED]: wasmClientSdk.CbEvents.OnFriendApplicationRejected,
    [NativeEvent.FRIEND_ADDED]: wasmClientSdk.CbEvents.OnFriendAdded,
    [NativeEvent.FRIEND_DELETED]: wasmClientSdk.CbEvents.OnFriendDeleted,
    [NativeEvent.FRIEND_INFO_CHANGED]: wasmClientSdk.CbEvents.OnFriendInfoChanged,
    [NativeEvent.BLACK_ADDED]: wasmClientSdk.CbEvents.OnBlackAdded,
    [NativeEvent.BLACK_DELETED]: wasmClientSdk.CbEvents.OnBlackDeleted,
    [NativeEvent.SYNC_SERVER_START]: wasmClientSdk.CbEvents.OnSyncServerStart,
    [NativeEvent.SYNC_SERVER_FINISH]: wasmClientSdk.CbEvents.OnSyncServerFinish,
    [NativeEvent.SYNC_SERVER_PROGRESS]: wasmClientSdk.CbEvents.OnSyncServerProgress,
    [NativeEvent.SYNC_SERVER_FAILED]: wasmClientSdk.CbEvents.OnSyncServerFailed,
    [NativeEvent.NEW_CONVERSATION]: wasmClientSdk.CbEvents.OnNewConversation,
    [NativeEvent.CONVERSATION_CHANGED]: wasmClientSdk.CbEvents.OnConversationChanged,
    [NativeEvent.TOTAL_UNREAD_MESSAGE_COUNT_CHANGED]: wasmClientSdk.CbEvents.OnTotalUnreadMessageCountChanged,
    [NativeEvent.RECV_NEW_MESSAGE]: wasmClientSdk.CbEvents.OnRecvNewMessage,
    [NativeEvent.RECV_C2C_READ_RECEIPT]: wasmClientSdk.CbEvents.OnRecvC2CReadReceipt,
    [NativeEvent.RECV_GROUP_READ_RECEIPT]: wasmClientSdk.CbEvents.OnRecvGroupReadReceipt,
    [NativeEvent.NEW_RECV_MESSAGE_REVOKED]: wasmClientSdk.CbEvents.OnNewRecvMessageRevoked,
    [NativeEvent.RECV_NEW_MESSAGES]: wasmClientSdk.CbEvents.OnRecvNewMessages,
    [NativeEvent.SELF_INFO_UPDATED]: wasmClientSdk.CbEvents.OnSelfInfoUpdated,
    [NativeEvent.USER_STATUS_CHANGED]: wasmClientSdk.CbEvents.OnUserStatusChanged,
    [NativeEvent.RECV_CUSTOM_BUSINESS_MESSAGE]: wasmClientSdk.CbEvents.OnRecvCustomBusinessMessage,
    [NativeEvent.UPLOAD_COMPLETE]: wasmClientSdk.CbEvents.UploadComplete,
    [NativeEvent.OPEN]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.PART_SIZE]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.HASH_PART_PROGRESS]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.HASH_PART_COMPLETE]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.UPLOAD_ID]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.UPLOAD_PART_COMPLETE]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.COMPLETE]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.RECV_MESSAGE_EXTENSIONS_CHANGED]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.RECV_MESSAGE_EXTENSIONS_DELETED]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.RECV_MESSAGE_EXTENSIONS_ADDED]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.RECV_OFFLINE_NEW_MESSAGE]: wasmClientSdk.CbEvents.OnRecvOfflineNewMessage,
    [NativeEvent.MSG_DELETED]: wasmClientSdk.CbEvents.OnMsgDeleted,
    [NativeEvent.RECV_OFFLINE_NEW_MESSAGES]: wasmClientSdk.CbEvents.OnRecvOfflineNewMessages,
    [NativeEvent.MESSAGE_KV_INFO_CHANGED]: wasmClientSdk.CbEvents.UnUsedEvent,
    [NativeEvent.CONVERSATION_USER_INPUT_STATUS_CHANGED]: wasmClientSdk.CbEvents.OnConversationUserInputStatusChanged,
    [NativeEvent.RECV_ONLINE_ONLY_MESSAGE]: wasmClientSdk.CbEvents.OnRecvOnlineOnlyMessage,
    [NativeEvent.RECV_NEW_INVITATION]: wasmClientSdk.CbEvents.OnReceiveNewInvitation,
    [NativeEvent.INVITEE_ACCEPTED]: wasmClientSdk.CbEvents.OnInviteeAccepted,
    [NativeEvent.INVITEE_ACCEPTED_BY_OTHER_DEVICE]: wasmClientSdk.CbEvents.OnInviteeAcceptedByOtherDevice,
    [NativeEvent.INVITEE_REJECTED]: wasmClientSdk.CbEvents.OnInviteeRejected,
    [NativeEvent.INVITEE_REJECTED_BY_OTHER_DEVICE]: wasmClientSdk.CbEvents.OnInviteeRejectedByOtherDevice,
    [NativeEvent.INVITATION_CANCELLED]: wasmClientSdk.CbEvents.OnInvitationCancelled,
    [NativeEvent.INVITATION_TIMEOUT]: wasmClientSdk.CbEvents.OnInvitationTimeout,
    [NativeEvent.HANG_UP]: wasmClientSdk.CbEvents.OnHangUp,
    [NativeEvent.ROOM_PARTICIPANT_CONNECTED]: wasmClientSdk.CbEvents.OnRoomParticipantConnected,
    [NativeEvent.ROOM_PARTICIPANT_DISCONNECTED]: wasmClientSdk.CbEvents.OnRoomParticipantDisconnected,
    [NativeEvent.STREAM_CHANGE]: wasmClientSdk.CbEvents.OnStreamChange,
    [NativeEvent.RECEIVE_CUSTOM_SIGNAL]: wasmClientSdk.CbEvents.OnReceiveCustomSignal,
    [NativeEvent.ON_PROGRESS]: wasmClientSdk.CbEvents.OnUploadLogsProgress,
    [NativeEvent.CHANGED_PINNED_MESSAGE]: wasmClientSdk.CbEvents.OnChangedPinnedMsg,
    [NativeEvent.DELETE_USER_ALL_MSGS_IN_CONV]: wasmClientSdk.CbEvents.OnDeleteUserAllMsgsInConv,
    [NativeEvent.MESSAGE_MODIFIED]: wasmClientSdk.CbEvents.OnMessageModified,
    [NativeEvent.CONVERSATION_GROUP_ADDED]: wasmClientSdk.CbEvents.OnConversationGroupAdded,
    [NativeEvent.CONVERSATION_GROUP_DELETED]: wasmClientSdk.CbEvents.OnConversationGroupDeleted,
    [NativeEvent.CONVERSATION_GROUP_CHANGED]: wasmClientSdk.CbEvents.OnConversationGroupChanged,
    [NativeEvent.CONVERSATION_GROUP_MEMBER_ADDED]: wasmClientSdk.CbEvents.OnConversationGroupMemberAdded,
    [NativeEvent.CONVERSATION_GROUP_MEMBER_DELETED]: wasmClientSdk.CbEvents.OnConversationGroupMemberDeleted,
};

class Emitter {
    constructor() {
        this.events = {};
    }
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(fn => {
                return fn(data);
            });
        }
        return this;
    }
    on(event, fn) {
        if (this.events[event]) {
            this.events[event].push(fn);
        }
        else {
            this.events[event] = [fn];
        }
        return this;
    }
    off(event, fn) {
        if (event && typeof fn === 'function' && this.events[event]) {
            const listeners = this.events[event];
            if (!listeners || listeners.length === 0) {
                return;
            }
            const index = listeners.findIndex(_fn => {
                return _fn === fn;
            });
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
        return this;
    }
}

function setupFriendModule(openIMSDK) {
    return {
        acceptFriendApplication: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.accept_friend_application(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        addBlack: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            var _a;
            openIMSDK.libOpenIMSDK.add_black(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.toUserID, (_a = params.ex) !== null && _a !== void 0 ? _a : '');
        }),
        addFriend: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.add_friend(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        checkFriend: (userIDList, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.check_friend(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(userIDList));
        }),
        deleteFriend: (userID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_friend(openIMSDK.baseCallbackWrap(resolve, reject), opid, userID);
        }),
        setFriendsEx: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.update_friends(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({
                friendUserIDs: params.toUserIDs,
                ex: params.ex,
            }));
        }),
        getBlackList: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_black_list(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        getFriendApplicationListAsApplicant: (params = {
            offset: 0,
            count: 0,
        }, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_friend_application_list_as_applicant(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getFriendApplicationListAsRecipient: (params = {
            handleResults: [],
            offset: 0,
            count: 0,
        }, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_friend_application_list_as_recipient(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getFriendApplicationUnhandledCount: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_friend_application_unhandled_count(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getFriendList: (filterBlack, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_friend_list(openIMSDK.baseCallbackWrap(resolve, reject), opid, filterBlack ? 1 : 0);
        }),
        getFriendListPage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_friend_list_page(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.offset, params.count, params.filterBlack ? 1 : 0);
        }),
        updateFriends: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.update_friends(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getSpecifiedFriendsInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_specified_friends_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params.friendUserIDList), params.filterBlack ? 1 : 0);
        }),
        refuseFriendApplication: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.refuse_friend_application(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        deleteFriendRequests: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_friend_requests(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({ friendRequests: params }));
        }),
        removeBlack: (userID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.remove_black(openIMSDK.baseCallbackWrap(resolve, reject), opid, userID);
        }),
        searchFriends: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.search_friends(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        setFriendRemark: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.update_friends(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({
                friendUserIDs: [params.toUserID],
                remark: params.remark,
            }));
        }),
        pinFriends: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.update_friends(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({
                friendUserIDs: params.toUserIDs,
                isPinned: params.isPinned,
            }));
        }),
    };
}

function setupGroupModule(openIMSDK) {
    return {
        createGroup: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.create_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        joinGroup: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            var _a;
            openIMSDK.libOpenIMSDK.join_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.reqMsg, params.joinSource, (_a = params.ex) !== null && _a !== void 0 ? _a : '');
        }),
        inviteUserToGroup: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.invite_user_to_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.reason, JSON.stringify(params.userIDList));
        }),
        getJoinedGroupList: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_joined_group_list(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        getJoinedGroupListPage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_joined_group_list_page(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.offset, params.count);
        }),
        searchGroups: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.search_groups(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getSpecifiedGroupsInfo: (groupIDList, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_specified_groups_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(groupIDList));
        }),
        setGroupInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_group_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getGroupApplicationListAsRecipient: (params = {
            groupID: [],
            handleResults: [],
            offset: 0,
            count: 0,
        }, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_application_list_as_recipient(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getGroupApplicationListAsApplicant: (params = {
            groupID: [],
            handleResults: [],
            offset: 0,
            count: 0,
        }, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_application_list_as_applicant(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getGroupApplicationUnhandledCount: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_application_unhandled_count(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        acceptGroupApplication: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.accept_group_application(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.fromUserID, params.handleMsg);
        }),
        refuseGroupApplication: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.refuse_group_application(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.fromUserID, params.handleMsg);
        }),
        deleteGroupRequests: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_group_requests(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify({
                groupRequests: params,
            }));
        }),
        getGroupMemberList: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_member_list(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.filter, params.offset, params.count);
        }),
        getSpecifiedGroupMembersInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_specified_group_members_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, JSON.stringify(params.userIDList));
        }),
        searchGroupMembers: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.search_group_members(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        setGroupMemberInfo: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_group_member_info(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getGroupMemberListByJoinTimeFilter: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_member_list_by_join_time_filter(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.offset, params.count, params.joinTimeBegin, params.joinTimeEnd, JSON.stringify(params.filterUserIDList));
        }),
        kickGroupMember: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.kick_group_member(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.reason, JSON.stringify(params.userIDList));
        }),
        changeGroupMemberMute: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.change_group_member_mute(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.userID, params.mutedSeconds);
        }),
        changeGroupMute: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            var _a;
            openIMSDK.libOpenIMSDK.change_group_mute(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.isMute ? 1 : 0, JSON.stringify((_a = params.muteBypassUserIDs) !== null && _a !== void 0 ? _a : []));
        }),
        transferGroupOwner: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.transfer_group_owner(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, params.newOwnerUserID);
        }),
        dismissGroup: (groupID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.dismiss_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, groupID);
        }),
        quitGroup: (groupID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.quit_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, groupID);
        }),
        isJoinGroup: (groupID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.is_join_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, groupID);
        }),
        getUsersInGroup: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_users_in_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.groupID, JSON.stringify(params.userIDList));
        }),
    };
}

function setupConversationModule(openIMSDK) {
    return {
        getAllConversationList: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_all_conversation_list(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        getConversationListSplit: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_conversation_list_split(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.offset, params.count);
        }),
        getOneConversation: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_one_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.sessionType, params.sourceID);
        }),
        setConversationEx: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                ex: params.ex,
            }));
        }),
        getMultipleConversation: (conversationIDList, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_multiple_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationIDList);
        }),
        getConversationIDBySessionType: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.get_conversation_id_by_session_type(opid, params.sourceID, params.sessionType)),
        getTotalUnreadMsgCount: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_total_unread_msg_count(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        markConversationMessageAsRead: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.mark_conversation_message_as_read(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        setConversationDraft: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation_draft(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.draftText);
        }),
        setConversation: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify(params));
        }),
        pinConversation: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                isPinned: params.isPinned,
            }));
        }),
        setConversationRecvMessageOpt: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                recvMsgOpt: params.opt,
            }));
        }),
        setConversationPrivateChat: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                isPrivateChat: params.isPrivate,
            }));
        }),
        setConversationBurnDuration: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                burnDuration: params.burnDuration,
            }));
        }),
        resetConversationGroupAtType: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID, JSON.stringify({
                groupAtType: wasmClientSdk.GroupAtType.AtNormal,
            }));
        }),
        hideConversation: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.hide_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        unhideConversation: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.unhide_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        hideAllConversation: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.hide_all_conversations(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        clearConversationAndDeleteAllMsg: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.clear_conversation_and_delete_all_msg(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        deleteConversationAndDeleteAllMsg: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_conversation_and_delete_all_msg(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        setConversationMsgDestructTime: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({
                msgDestructTime: params.msgDestructTime,
            }));
        }),
        setConversationIsMsgDestruct: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify({ isMsgDestruct: params.isMsgDestruct }));
        }),
        changeInputStates: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.change_input_states(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.focus ? 1 : 0);
        }),
        getInputStates: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_input_states(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.userID);
        }),
        createConversationGroup: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.create_conversation_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data));
        }),
        updateConversationGroup: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.update_conversation_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data));
        }),
        deleteConversationGroup: (groupID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_conversation_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, groupID);
        }),
        getConversationGroups: (conversationGroupType, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_conversation_groups(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationGroupType);
        }),
        setConversationGroupOrder: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation_group_order(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data));
        }),
        addConversationsToGroups: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.add_conversations_to_groups(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data.conversationIDs), JSON.stringify(data.conversationGroupIDs));
        }),
        removeConversationsFromGroups: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.remove_conversations_from_groups(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data.conversationIDs), JSON.stringify(data.conversationGroupIDs));
        }),
        getConversationGroupIDsByConversationID: (conversationID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_conversation_group_by_conversation_id(openIMSDK.baseCallbackWrap(resolve, reject), opid, conversationID);
        }),
        getConversationGroupInfoWithConversations: (data, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_conversation_group_info_with_conversations(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(data));
        }),
    };
}

function setupMessageModule(openIMSDK) {
    return {
        createTextMessage: (content, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_text_message(opid, content)),
        createTextAtMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_text_at_message(opid, params.text, JSON.stringify(params.atUserIDList), JSON.stringify(params.atUsersInfo), JSON.stringify(params.message))),
        createLocationMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_location_message(opid, params.description, params.longitude, params.latitude)),
        createCustomMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_custom_message(opid, params.data, params.extension, params.description)),
        createQuoteMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_quote_message(opid, params.text, params.message)),
        createCardMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_card_message(opid, JSON.stringify(params))),
        createMergerMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_merger_message(opid, JSON.stringify(params.messageList), params.title, JSON.stringify(params.summaryList))),
        createFaceMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_face_message(opid, params.index, params.data)),
        createForwardMessage: (message, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_forward_message(opid, JSON.stringify(message))),
        createImageMessage: (imagePath, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_image_message(opid, imagePath)),
        createImageMessageFromFullPath: (imagePath, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_image_message_from_full_path(opid, imagePath)),
        createImageMessageByURL: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_image_message_by_url(opid, params.sourcePath, JSON.stringify(params.sourcePicture), JSON.stringify(params.bigPicture), JSON.stringify(params.snapshotPicture))),
        createVideoMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_video_message(opid, params.videoPath, params.videoType, params.duration, params.snapshotPath)),
        createVideoMessageFromFullPath: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_video_message_from_full_path(opid, params.videoPath, params.videoType, params.duration, params.snapshotPath)),
        createVideoMessageByURL: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_video_message_by_url(opid, JSON.stringify(params))),
        createSoundMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_sound_message(opid, params.soundPath, params.duration)),
        createSoundMessageFromFullPath: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_sound_message_from_full_path(opid, params.soundPath, params.duration)),
        createSoundMessageByURL: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_sound_message_by_url(opid, JSON.stringify(params))),
        createFileMessage: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_file_message(opid, params.filePath, params.fileName)),
        createFileMessageFromFullPath: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_file_message_from_full_path(opid, params.filePath, params.fileName)),
        createFileMessageByURL: (params, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_file_message_by_url(opid, JSON.stringify(params))),
        sendMessage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            var _a;
            const offlinePushInfo = (_a = params.offlinePushInfo) !== null && _a !== void 0 ? _a : {
                title: 'You has a new message.',
                desc: 'You has a new message.',
                ex: '',
                iOSPushSound: '+1',
                iOSBadgeCount: true,
            };
            openIMSDK.libOpenIMSDK.send_message(openIMSDK.sendMessageCallbackWrap(params.message.clientMsgID, resolve, reject), opid, JSON.stringify(params.message), params.recvID, params.groupID, JSON.stringify(offlinePushInfo), Number(!!params.isOnlineOnly));
        }),
        sendMessageNotOss: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            var _a;
            const offlinePushInfo = (_a = params.offlinePushInfo) !== null && _a !== void 0 ? _a : {
                title: 'You has a new message.',
                desc: 'You has a new message.',
                ex: '',
                iOSPushSound: '+1',
                iOSBadgeCount: true,
            };
            openIMSDK.libOpenIMSDK.send_message_not_oss(openIMSDK.sendMessageCallbackWrap(params.message.clientMsgID, resolve, reject), opid, JSON.stringify(params.message), params.recvID, params.groupID, JSON.stringify(offlinePushInfo), Number(!!params.isOnlineOnly));
        }),
        typingStatusUpdate: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.typing_status_update(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.recvID, params.msgTip);
        }),
        revokeMessage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.revoke_message(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID);
        }),
        deleteMessage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_message(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID);
        }),
        deleteMessageFromLocalStorage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_message_from_local_storage(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID);
        }),
        deleteAllMsgFromLocal: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_all_msg_from_local(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        deleteAllMsgFromLocalAndSvr: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_all_msg_from_local_and_svr(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        searchLocalMessages: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.search_local_messages(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getAdvancedHistoryMessageList: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_advanced_history_message_list(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getAdvancedHistoryMessageListReverse: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_advanced_history_message_list_reverse(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        getAllHistoryMessages: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_all_history_messages(openIMSDK.sendMessageCallbackWrap('', resolve, reject), opid, JSON.stringify(params));
        }),
        fetchSurroundingMessages: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.fetch_surrounding_messages(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        findMessageList: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.find_message_list(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        insertGroupMessageToLocalStorage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.insert_group_message_to_local_storage(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params.message), params.groupID, params.sendID);
        }),
        insertSingleMessageToLocalStorage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.insert_single_message_to_local_storage(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params.message), params.recvID, params.sendID);
        }),
        setMessageLocalEx: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_message_local_ex(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID, params.localEx);
        }),
        sendGroupMessageReadReceipt: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.send_group_message_read_receipt(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify(params.clientMsgIDList));
        }),
        getGroupMessageReaderList: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_group_message_reader_list(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID, params.filter, params.offset, params.count);
        }),
        modifyMessage: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.modify_message(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        deleteMessages: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_messages(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        deleteUserAllMessagesInConv: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.delete_user_all_messages_in_conv(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.userID);
        }),
        setConversationPinnedMsg: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_conversation_pinned_msg(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, params.clientMsgID, params.pinned ? 1 : 0);
        }),
        getConversationPinnedMsg: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_conversation_pinned_msg(openIMSDK.baseCallbackWrap(resolve, reject), opid, params);
        }),
        createMarkdownMessage: (content, opid = uuid.v4()) => openIMSDK.asyncRetunWrap(opid, openIMSDK.libOpenIMSDK.create_markdown_message(opid, content)),
        speechToText: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.speech_to_text(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        speechToTextCapabilities: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.speech_to_text_capabilities(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        setMessageLocalContent: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.set_message_local_content(openIMSDK.baseCallbackWrap(resolve, reject), opid, params.conversationID, JSON.stringify(params.message));
        }),
    };
}

function setupSignalingModule(openIMSDK) {
    return {
        signalingInviteInGroup: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_invite_in_group(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingInvite: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_invite(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingCancel: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_cancel(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingAccept: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_accept(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingReject: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_reject(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingHungUp: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_hung_up(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params));
        }),
        signalingGetRoomByGroupID: (groupID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_get_room_by_group_id(openIMSDK.baseCallbackWrap(resolve, reject), opid, groupID);
        }),
        signalingGetTokenByRoomID: (roomID, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_get_token_by_room_id(openIMSDK.baseCallbackWrap(resolve, reject), opid, roomID);
        }),
        getSignalingInvitationInfoStartApp: (opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.get_signaling_invitation_info_start_app(openIMSDK.baseCallbackWrap(resolve, reject), opid);
        }),
        signalingSendCustomSignal: (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            openIMSDK.libOpenIMSDK.signaling_send_custom_signal(openIMSDK.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params.customInfo), params.roomID);
        }),
    };
}

function isObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
const forceGetDataEvents = [
    wasmClientSdk.CbEvents.OnSyncServerStart,
    wasmClientSdk.CbEvents.OnSyncServerFinish,
    wasmClientSdk.CbEvents.OnSyncServerFailed,
    wasmClientSdk.CbEvents.OnSyncServerProgress,
];
class OpenIMSDK extends Emitter {
    constructor(libPath, emitProxy, enterprise = false, basertc = false) {
        super();
        this.libOpenIMSDK = {};
        this.registerFunc = () => {
            this.libOpenIMSDK.set_group_listener = this.lib.func('__stdcall', 'set_group_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.set_conversation_listener = this.lib.func('__stdcall', 'set_conversation_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.set_advanced_msg_listener = this.lib.func('__stdcall', 'set_advanced_msg_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.set_user_listener = this.lib.func('__stdcall', 'set_user_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.set_friend_listener = this.lib.func('__stdcall', 'set_friend_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.set_custom_business_listener = this.lib.func('__stdcall', 'set_custom_business_listener', 'void', ['listenerCallback *']);
            this.libOpenIMSDK.init_sdk = this.lib.func('__stdcall', 'init_sdk', 'uint8', ['listenerCallback *', 'str', 'str']);
            this.libOpenIMSDK.un_init_sdk = this.lib.func('__stdcall', 'un_init_sdk', 'void', ['str']);
            this.libOpenIMSDK.login = this.lib.func('__stdcall', 'login', 'void', [
                'baseCallback *',
                'str',
                'str',
                'str',
            ]);
            this.libOpenIMSDK.logout = this.lib.func('__stdcall', 'logout', 'void', [
                'baseCallback *',
                'str',
            ]);
            this.libOpenIMSDK.set_app_background_status = this.lib.func('__stdcall', 'set_app_background_status', 'void', ['baseCallback *', 'str', 'int']);
            this.libOpenIMSDK.network_status_changed = this.lib.func('__stdcall', 'network_status_changed', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.get_login_status = this.lib.func('__stdcall', 'get_login_status', 'int', ['str']);
            this.libOpenIMSDK.get_login_user = this.lib.func('__stdcall', 'get_login_user', 'str', []);
            this.libOpenIMSDK.create_text_message = this.lib.func('__stdcall', 'create_text_message', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_advanced_text_message = this.lib.func('__stdcall', 'create_advanced_text_message', 'str', ['str', 'str', 'str']);
            this.libOpenIMSDK.create_text_at_message = this.lib.func('__stdcall', 'create_text_at_message', 'str', ['str', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.create_location_message = this.lib.func('__stdcall', 'create_location_message', 'str', ['str', 'str', 'double', 'double']);
            this.libOpenIMSDK.create_custom_message = this.lib.func('__stdcall', 'create_custom_message', 'str', ['str', 'str', 'str', 'str']);
            this.libOpenIMSDK.create_quote_message = this.lib.func('__stdcall', 'create_quote_message', 'str', ['str', 'str', 'str']);
            this.libOpenIMSDK.create_advanced_quote_message = this.lib.func('__stdcall', 'create_advanced_quote_message', 'str', ['str', 'str', 'str', 'str']);
            this.libOpenIMSDK.create_card_message = this.lib.func('__stdcall', 'create_card_message', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_video_message_from_full_path = this.lib.func('__stdcall', 'create_video_message_from_full_path', 'str', ['str', 'str', 'str', 'long long', 'str']);
            this.libOpenIMSDK.create_image_message_from_full_path = this.lib.func('__stdcall', 'create_image_message_from_full_path', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_sound_message_from_full_path = this.lib.func('__stdcall', 'create_sound_message_from_full_path', 'str', ['str', 'str', 'long long']);
            this.libOpenIMSDK.create_file_message_from_full_path = this.lib.func('__stdcall', 'create_file_message_from_full_path', 'str', ['str', 'str', 'str']);
            this.libOpenIMSDK.create_image_message = this.lib.func('__stdcall', 'create_image_message', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_image_message_by_url = this.lib.func('__stdcall', 'create_image_message_by_url', 'str', ['str', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.create_sound_message_by_url = this.lib.func('__stdcall', 'create_sound_message_by_url', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_sound_message = this.lib.func('__stdcall', 'create_sound_message', 'str', ['str', 'str', 'long long']);
            this.libOpenIMSDK.create_video_message_by_url = this.lib.func('__stdcall', 'create_video_message_by_url', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_video_message = this.lib.func('__stdcall', 'create_video_message', 'str', ['str', 'str', 'str', 'long long', 'str']);
            this.libOpenIMSDK.create_file_message_by_url = this.lib.func('__stdcall', 'create_file_message_by_url', 'str', ['str', 'str']);
            this.libOpenIMSDK.create_file_message = this.lib.func('__stdcall', 'create_file_message', 'str', ['str', 'str', 'str']);
            this.libOpenIMSDK.create_merger_message = this.lib.func('__stdcall', 'create_merger_message', 'str', ['str', 'str', 'str', 'str']);
            this.libOpenIMSDK.create_face_message = this.lib.func('__stdcall', 'create_face_message', 'str', ['str', 'int', 'str']);
            this.libOpenIMSDK.create_forward_message = this.lib.func('__stdcall', 'create_forward_message', 'str', ['str', 'str']);
            this.libOpenIMSDK.get_all_conversation_list = this.lib.func('__stdcall', 'get_all_conversation_list', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.get_conversation_list_split = this.lib.func('__stdcall', 'get_conversation_list_split', 'void', ['baseCallback *', 'str', 'int', 'int']);
            this.libOpenIMSDK.get_one_conversation = this.lib.func('__stdcall', 'get_one_conversation', 'void', ['baseCallback *', 'str', 'int', 'str']);
            this.libOpenIMSDK.get_multiple_conversation = this.lib.func('__stdcall', 'get_multiple_conversation', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.hide_conversation = this.lib.func('__stdcall', 'hide_conversation', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.unhide_conversation = this.lib.func('__stdcall', 'unhide_conversation', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.set_conversation_draft = this.lib.func('__stdcall', 'set_conversation_draft', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.set_conversation = this.lib.func('__stdcall', 'set_conversation', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.get_total_unread_msg_count = this.lib.func('__stdcall', 'get_total_unread_msg_count', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.get_at_all_tag = this.lib.func('__stdcall', 'get_at_all_tag', 'str', ['str']);
            this.libOpenIMSDK.get_conversation_id_by_session_type = this.lib.func('__stdcall', 'get_conversation_id_by_session_type', 'str', ['str', 'str', 'int']);
            this.libOpenIMSDK.send_message = this.lib.func('__stdcall', 'send_message', 'void', ['sendMessageCallback *', 'str', 'str', 'str', 'str', 'str', 'int']);
            this.libOpenIMSDK.send_message_not_oss = this.lib.func('__stdcall', 'send_message_not_oss', 'void', ['sendMessageCallback *', 'str', 'str', 'str', 'str', 'str', 'int']);
            this.libOpenIMSDK.find_message_list = this.lib.func('__stdcall', 'find_message_list', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_advanced_history_message_list = this.lib.func('__stdcall', 'get_advanced_history_message_list', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_advanced_history_message_list_reverse = this.lib.func('__stdcall', 'get_advanced_history_message_list_reverse', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_all_history_messages = this.lib.func('__stdcall', 'get_all_history_messages', 'void', ['sendMessageCallback *', 'str', 'str']);
            this.libOpenIMSDK.revoke_message = this.lib.func('__stdcall', 'revoke_message', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.typing_status_update = this.lib.func('__stdcall', 'typing_status_update', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.mark_conversation_message_as_read = this.lib.func('__stdcall', 'mark_conversation_message_as_read', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.delete_message_from_local_storage = this.lib.func('__stdcall', 'delete_message_from_local_storage', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.delete_message = this.lib.func('__stdcall', 'delete_message', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.change_input_states = this.lib.func('__stdcall', 'change_input_states', 'void', ['baseCallback *', 'str', 'str', 'int']);
            this.libOpenIMSDK.get_input_states = this.lib.func('__stdcall', 'get_input_states', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.hide_all_conversations = this.lib.func('__stdcall', 'hide_all_conversations', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.delete_all_msg_from_local_and_svr = this.lib.func('__stdcall', 'delete_all_msg_from_local_and_svr', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.delete_all_msg_from_local = this.lib.func('__stdcall', 'delete_all_msg_from_local', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.clear_conversation_and_delete_all_msg = this.lib.func('__stdcall', 'clear_conversation_and_delete_all_msg', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.delete_conversation_and_delete_all_msg = this.lib.func('__stdcall', 'delete_conversation_and_delete_all_msg', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.insert_single_message_to_local_storage = this.lib.func('__stdcall', 'insert_single_message_to_local_storage', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.insert_group_message_to_local_storage = this.lib.func('__stdcall', 'insert_group_message_to_local_storage', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.search_local_messages = this.lib.func('__stdcall', 'search_local_messages', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.set_message_local_ex = this.lib.func('__stdcall', 'set_message_local_ex', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.get_users_info = this.lib.func('__stdcall', 'get_users_info', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.set_self_info = this.lib.func('__stdcall', 'set_self_info', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_self_user_info = this.lib.func('__stdcall', 'get_self_user_info', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.subscribe_users_status = this.lib.func('__stdcall', 'subscribe_users_status', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.unsubscribe_users_status = this.lib.func('__stdcall', 'unsubscribe_users_status', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_subscribe_users_status = this.lib.func('__stdcall', 'get_subscribe_users_status', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.get_user_status = this.lib.func('__stdcall', 'get_user_status', 'void', ['baseCallback *', 'str', 'str']);
            // Friend functions
            this.libOpenIMSDK.update_friends = this.lib.func('__stdcall', 'update_friends', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_specified_friends_info = this.lib.func('__stdcall', 'get_specified_friends_info', 'void', ['baseCallback *', 'str', 'str', 'int']);
            this.libOpenIMSDK.get_friend_list = this.lib.func('__stdcall', 'get_friend_list', 'void', ['baseCallback *', 'str', 'int']);
            this.libOpenIMSDK.get_friend_list_page = this.lib.func('__stdcall', 'get_friend_list_page', 'void', ['baseCallback *', 'str', 'int', 'int', 'int']);
            this.libOpenIMSDK.search_friends = this.lib.func('__stdcall', 'search_friends', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.check_friend = this.lib.func('__stdcall', 'check_friend', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.add_friend = this.lib.func('__stdcall', 'add_friend', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.delete_friend = this.lib.func('__stdcall', 'delete_friend', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_friend_application_list_as_recipient = this.lib.func('__stdcall', 'get_friend_application_list_as_recipient', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_friend_application_list_as_applicant = this.lib.func('__stdcall', 'get_friend_application_list_as_applicant', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_friend_application_unhandled_count = this.lib.func('__stdcall', 'get_friend_application_unhandled_count', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.accept_friend_application = this.lib.func('__stdcall', 'accept_friend_application', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.refuse_friend_application = this.lib.func('__stdcall', 'refuse_friend_application', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.delete_friend_requests = this.lib.func('__stdcall', 'delete_friend_requests', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.add_black = this.lib.func('__stdcall', 'add_black', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.get_black_list = this.lib.func('__stdcall', 'get_black_list', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.remove_black = this.lib.func('__stdcall', 'remove_black', 'void', ['baseCallback *', 'str', 'str']);
            // Group functions
            this.libOpenIMSDK.create_group = this.lib.func('__stdcall', 'create_group', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.join_group = this.lib.func('__stdcall', 'join_group', 'void', ['baseCallback *', 'str', 'str', 'str', 'int', 'str']);
            this.libOpenIMSDK.quit_group = this.lib.func('__stdcall', 'quit_group', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.dismiss_group = this.lib.func('__stdcall', 'dismiss_group', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.change_group_mute = this.lib.func('__stdcall', 'change_group_mute', 'void', ['baseCallback *', 'str', 'str', 'int', 'str']);
            this.libOpenIMSDK.change_group_member_mute = this.lib.func('__stdcall', 'change_group_member_mute', 'void', ['baseCallback *', 'str', 'str', 'str', 'int']);
            this.libOpenIMSDK.set_group_member_info = this.lib.func('__stdcall', 'set_group_member_info', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_joined_group_list = this.lib.func('__stdcall', 'get_joined_group_list', 'void', ['baseCallback *', 'str']);
            this.libOpenIMSDK.get_joined_group_list_page = this.lib.func('__stdcall', 'get_joined_group_list_page', 'void', ['baseCallback *', 'str', 'int', 'int']);
            this.libOpenIMSDK.get_specified_groups_info = this.lib.func('__stdcall', 'get_specified_groups_info', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.search_groups = this.lib.func('__stdcall', 'search_groups', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.set_group_info = this.lib.func('__stdcall', 'set_group_info', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_group_member_list = this.lib.func('__stdcall', 'get_group_member_list', 'void', ['baseCallback *', 'str', 'str', 'int', 'int', 'int']);
            this.libOpenIMSDK.get_group_member_list_by_join_time_filter = this.lib.func('__stdcall', 'get_group_member_list_by_join_time_filter', 'void', [
                'baseCallback *',
                'str',
                'str',
                'int',
                'int',
                'long long',
                'long long',
                'str',
            ]);
            this.libOpenIMSDK.get_specified_group_members_info = this.lib.func('__stdcall', 'get_specified_group_members_info', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.kick_group_member = this.lib.func('__stdcall', 'kick_group_member', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.transfer_group_owner = this.lib.func('__stdcall', 'transfer_group_owner', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.invite_user_to_group = this.lib.func('__stdcall', 'invite_user_to_group', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.get_group_application_list_as_recipient = this.lib.func('__stdcall', 'get_group_application_list_as_recipient', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_group_application_list_as_applicant = this.lib.func('__stdcall', 'get_group_application_list_as_applicant', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_group_application_unhandled_count = this.lib.func('__stdcall', 'get_group_application_unhandled_count', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.accept_group_application = this.lib.func('__stdcall', 'accept_group_application', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.refuse_group_application = this.lib.func('__stdcall', 'refuse_group_application', 'void', ['baseCallback *', 'str', 'str', 'str', 'str']);
            this.libOpenIMSDK.delete_group_requests = this.lib.func('__stdcall', 'delete_group_requests', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.search_group_members = this.lib.func('__stdcall', 'search_group_members', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.is_join_group = this.lib.func('__stdcall', 'is_join_group', 'void', ['baseCallback *', 'str', 'str']);
            this.libOpenIMSDK.get_users_in_group = this.lib.func('__stdcall', 'get_users_in_group', 'void', ['baseCallback *', 'str', 'str', 'str']);
            this.libOpenIMSDK.upload_file = this.lib.func('__stdcall', 'upload_file', 'void', ['baseCallback *', 'str', 'str', 'listenerCallback *']);
            this.libOpenIMSDK.upload_logs = this.lib.func('__stdcall', 'upload_logs', 'void', ['baseCallback *', 'str', 'int', 'str', 'str', 'listenerCallback *']);
            this.libOpenIMSDK.logs = this.lib.func('__stdcall', 'logs', 'void', [
                'baseCallback *',
                'str',
                'int',
                'str',
                'int',
                'str',
                'str',
                'str',
            ]);
            // advance
            if (this.basertc || this.enterprise) {
                this.libOpenIMSDK.set_signaling_listener = this.lib.func('__stdcall', 'set_signaling_listener', 'void', ['listenerCallback *']);
                this.libOpenIMSDK.signaling_invite_in_group = this.lib.func('__stdcall', 'signaling_invite_in_group', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_invite = this.lib.func('__stdcall', 'signaling_invite', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_accept = this.lib.func('__stdcall', 'signaling_accept', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_reject = this.lib.func('__stdcall', 'signaling_reject', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_cancel = this.lib.func('__stdcall', 'signaling_cancel', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_hung_up = this.lib.func('__stdcall', 'signaling_hung_up', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_get_room_by_group_id = this.lib.func('__stdcall', 'signaling_get_room_by_group_id', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.signaling_get_token_by_room_id = this.lib.func('__stdcall', 'signaling_get_token_by_room_id', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.get_signaling_invitation_info_start_app = this.lib.func('__stdcall', 'get_signaling_invitation_info_start_app', 'void', ['baseCallback *', 'str']);
                this.libOpenIMSDK.signaling_send_custom_signal = this.lib.func('__stdcall', 'signaling_send_custom_signal', 'void', ['baseCallback *', 'str', 'str', 'str']);
            }
            if (this.enterprise) {
                this.libOpenIMSDK.send_group_message_read_receipt = this.lib.func('__stdcall', 'send_group_message_read_receipt', 'void', ['baseCallback *', 'str', 'str', 'str']);
                this.libOpenIMSDK.get_group_message_reader_list = this.lib.func('__stdcall', 'get_group_message_reader_list', 'void', ['baseCallback *', 'str', 'str', 'str', 'int', 'int', 'int']);
                this.libOpenIMSDK.fetch_surrounding_messages = this.lib.func('__stdcall', 'fetch_surrounding_messages', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.modify_message = this.lib.func('__stdcall', 'modify_message', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.delete_messages = this.lib.func('__stdcall', 'delete_messages', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.delete_user_all_messages_in_conv = this.lib.func('__stdcall', 'delete_user_all_messages_in_conv', 'void', ['baseCallback *', 'str', 'str', 'str']);
                this.libOpenIMSDK.set_conversation_pinned_msg = this.lib.func('__stdcall', 'set_conversation_pinned_msg', 'void', ['baseCallback *', 'str', 'str', 'str', 'int']);
                this.libOpenIMSDK.get_conversation_pinned_msg = this.lib.func('__stdcall', 'get_conversation_pinned_msg', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.create_markdown_message = this.lib.func('__stdcall', 'create_markdown_message', 'str', ['str', 'str']);
                this.libOpenIMSDK.set_conversation_group_listener = this.lib.func('__stdcall', 'set_conversation_group_listener', 'void', ['listenerCallback *']);
                this.libOpenIMSDK.create_conversation_group = this.lib.func('__stdcall', 'create_conversation_group', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.update_conversation_group = this.lib.func('__stdcall', 'update_conversation_group', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.delete_conversation_group = this.lib.func('__stdcall', 'delete_conversation_group', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.get_conversation_groups = this.lib.func('__stdcall', 'get_conversation_groups', 'void', ['baseCallback *', 'str', 'int']);
                this.libOpenIMSDK.set_conversation_group_order = this.lib.func('__stdcall', 'set_conversation_group_order', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.add_conversations_to_groups = this.lib.func('__stdcall', 'add_conversations_to_groups', 'void', ['baseCallback *', 'str', 'str', 'str']);
                this.libOpenIMSDK.remove_conversations_from_groups = this.lib.func('__stdcall', 'remove_conversations_from_groups', 'void', ['baseCallback *', 'str', 'str', 'str']);
                this.libOpenIMSDK.get_conversation_group_by_conversation_id =
                    this.lib.func('__stdcall', 'get_conversation_group_by_conversation_id', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.get_conversation_group_info_with_conversations =
                    this.lib.func('__stdcall', 'get_conversation_group_info_with_conversations', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.speech_to_text = this.lib.func('__stdcall', 'speech_to_text', 'void', ['baseCallback *', 'str', 'str']);
                this.libOpenIMSDK.speech_to_text_capabilities = this.lib.func('__stdcall', 'speech_to_text_capabilities', 'void', ['baseCallback *', 'str']);
                this.libOpenIMSDK.set_message_local_content = this.lib.func('__stdcall', 'set_message_local_content', 'void', ['baseCallback *', 'str', 'str', 'str']);
            }
        };
        this.generateEventResponse = (data, operationID = '', forceGetData = false) => {
            let errCode = 0;
            let errMsg = '';
            try {
                data = JSON.parse(data);
            }
            catch (error) {
                // do nothing
            }
            // @ts-ignore
            if (isObject(data) && data.errCode !== undefined) {
                // @ts-ignore
                errCode = data.errCode;
                // @ts-ignore
                errMsg = data.errMsg;
                // @ts-ignore
                data = data.data;
            }
            if (forceGetData) {
                // @ts-ignore
                const values = Object.values(data);
                data = values[0];
            }
            return {
                errCode,
                errMsg,
                data,
                operationID,
            };
        };
        this.baseCallbackWrap = (resolve, reject) => {
            const registerBaseCallback = koffi__default["default"].register((operationID, errCode, errMsg, data) => {
                let realData;
                try {
                    realData = JSON.parse(data);
                }
                catch (error) {
                    realData = data;
                }
                const response = {
                    errCode,
                    errMsg,
                    data: realData,
                    operationID,
                };
                if (errCode === 0) {
                    resolve(response);
                }
                else {
                    reject(response);
                }
                koffi__default["default"].unregister(registerBaseCallback);
            }, koffi__default["default"].pointer(this.baseCallbackProto));
            return registerBaseCallback;
        };
        this.sendMessageCallbackWrap = (clientMsgID, resolve, reject) => {
            const registerSendMessageCallback = koffi__default["default"].register((operationID, errCode, errMsg, data, progress) => {
                let realData;
                try {
                    realData = JSON.parse(data);
                }
                catch (error) {
                    realData = data;
                }
                const response = {
                    errCode,
                    errMsg,
                    data: realData,
                    operationID,
                };
                if (!errCode && !errMsg && !data) {
                    // eslint-disable-next-line
                    this.emit(wasmClientSdk.CbEvents.OnProgress, this.generateEventResponse({
                        clientMsgID,
                        progress,
                    }, operationID));
                    return;
                }
                if (errCode === 0) {
                    resolve(response);
                }
                else {
                    reject(response);
                }
                koffi__default["default"].unregister(registerSendMessageCallback);
            }, koffi__default["default"].pointer(this.sendMessageCallbackProto));
            return registerSendMessageCallback;
        };
        this.asyncRetunWrap = (operationID, data) => new Promise((resolve, reject) => {
            const hasError = !data && !operationID.includes('unInitSDK');
            if (data && typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                }
                catch (error) {
                    // do nothing
                }
            }
            const response = {
                errCode: hasError ? ErrorCode.UnknownError : 0,
                errMsg: '',
                data: data,
                operationID,
            };
            if (response.errCode === 0) {
                resolve(response);
            }
            else {
                reject(response);
            }
        });
        this.setListener = () => {
            this.libOpenIMSDK.set_user_listener(this.listenerCallback);
            this.libOpenIMSDK.set_friend_listener(this.listenerCallback);
            this.libOpenIMSDK.set_group_listener(this.listenerCallback);
            this.libOpenIMSDK.set_conversation_listener(this.listenerCallback);
            this.libOpenIMSDK.set_advanced_msg_listener(this.listenerCallback);
            this.libOpenIMSDK.set_custom_business_listener(this.listenerCallback);
            if (this.enterprise || this.basertc) {
                this.libOpenIMSDK.set_signaling_listener(this.listenerCallback);
            }
            if (this.enterprise) {
                this.libOpenIMSDK.set_conversation_group_listener(this.listenerCallback);
            }
        };
        this.initSDK = (param, opid = uuid.v4()) => new Promise((resolve, reject) => {
            const flag = this.libOpenIMSDK.init_sdk(this.listenerCallback, opid, JSON.stringify(param));
            if (!flag) {
                reject(!!flag);
                return;
            }
            this.setListener();
            resolve(!!flag);
        });
        this.login = (param, opid = uuid.v4()) => new Promise((resolve, reject) => {
            const loginCallback = this.baseCallbackWrap(resolve, reject);
            this.libOpenIMSDK.login(loginCallback, opid, param.userID, param.token);
        });
        this.getLoginStatus = (opid = uuid.v4()) => this.asyncRetunWrap(opid, this.libOpenIMSDK.get_login_status(opid));
        this.getLoginUser = (opid = uuid.v4()) => this.asyncRetunWrap(opid, this.libOpenIMSDK.get_login_user());
        this.logout = (opid = uuid.v4()) => new Promise((resolve, reject) => {
            const logoutCallback = this.baseCallbackWrap(resolve, reject);
            this.libOpenIMSDK.logout(logoutCallback, opid);
        });
        this.unInitSDK = (opid = uuid.v4()) => this.asyncRetunWrap(`unInitSDK-${opid}`, this.libOpenIMSDK.un_init_sdk(`unInitSDK-${opid}`));
        this.setAppBackgroundStatus = (isInBackground, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.set_app_background_status(this.baseCallbackWrap(resolve, reject), opid, isInBackground ? 1 : 0);
        });
        this.networkStatusChanged = (opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.network_status_changed(this.baseCallbackWrap(resolve, reject), opid);
        });
        this.uploadFile = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.upload_file(this.baseCallbackWrap(resolve, reject), opid, JSON.stringify(params), this.listenerCallback);
        });
        this.uploadLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.upload_logs(this.baseCallbackWrap(resolve, reject), opid, params.line, params.cancelID || opid, params.ex || '', this.listenerCallback);
        });
        this.verboseLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Verbose, '', 0, params.msgs, '', JSON.stringify(params.keyAndValue));
        });
        this.debugLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Debug, '', 0, params.msgs, '', JSON.stringify(params.keyAndValue));
        });
        this.infoLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Info, '', 0, params.msgs, '', JSON.stringify(params.keyAndValue));
        });
        this.warnLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Warn, '', 0, params.msgs, params.err, JSON.stringify([]));
        });
        this.errorLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Error, '', 0, params.msgs, params.err, JSON.stringify([]));
        });
        this.fatalLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Fatal, '', 0, params.msgs, params.err, JSON.stringify([]));
        });
        this.panicLogs = (params, opid = uuid.v4()) => new Promise((resolve, reject) => {
            this.libOpenIMSDK.logs(this.baseCallbackWrap(resolve, reject), opid, wasmClientSdk.LogLevel.Panic, '', 0, params.msgs, params.err, JSON.stringify([]));
        });
        this.basertc = basertc;
        this.enterprise = enterprise;
        this.lib = koffi__default["default"].load(libPath);
        this.baseCallbackProto = koffi__default["default"].proto('__stdcall', 'baseCallback', 'void', [
            'str',
            'int',
            'str',
            'str',
        ]);
        this.sendMessageCallbackProto = koffi__default["default"].proto('__stdcall', 'sendMessageCallback', 'void', ['str', 'int', 'str', 'str', 'int']);
        const listenerCallbackProto = koffi__default["default"].proto('__stdcall', 'listenerCallback', 'void', ['int', 'str']);
        this.listenerCallback = koffi__default["default"].register((event, data) => {
            const cbEvent = eventMapping[event];
            if (!cbEvent)
                return;
            const forceGetData = forceGetDataEvents.includes(cbEvent);
            this.emit(cbEvent, this.generateEventResponse(data, '', forceGetData));
        }, koffi__default["default"].pointer(listenerCallbackProto));
        if (emitProxy) {
            // @ts-ignore eslint-disable-next-line
            this.emit = emitProxy;
        }
        this.registerFunc();
        Object.assign(this, setupUserModule(this));
        Object.assign(this, setupFriendModule(this));
        Object.assign(this, setupGroupModule(this));
        Object.assign(this, setupConversationModule(this));
        Object.assign(this, setupMessageModule(this));
        Object.assign(this, setupSignalingModule(this));
    }
}

class OpenIMSDKMain {
    constructor(path, webContent, enterprise = false, basertc = false) {
        this.webContents = [];
        this.systemStateHandler = () => {
            electron.powerMonitor.on('suspend', () => {
                this.sdk.setAppBackgroundStatus(true);
            });
            electron.powerMonitor.on('resume', () => {
                this.sdk.setAppBackgroundStatus(false);
            });
        };
        this.initMethodsHandler = () => {
            electron.ipcMain.handle('openim-sdk-ipc-methods', async (_, method, ...args) => {
                try {
                    // @ts-ignore
                    // eslint-disable-next-line
                    return await this.sdk[method](...args);
                }
                catch (error) {
                    return error;
                }
            });
        };
        this.emitProxy = (event, data) => {
            this.webContents.forEach(webContent => {
                if (!webContent.isDestroyed()) {
                    webContent.send('openim-sdk-ipc-event', event, data);
                }
            });
        };
        this.sdk = new OpenIMSDK(path, this.emitProxy, enterprise, basertc);
        if (webContent) {
            this.webContents = [webContent];
        }
        this.systemStateHandler();
        this.initMethodsHandler();
    }
    addWebContent(webContent) {
        this.webContents.push(webContent);
    }
}

module.exports = OpenIMSDKMain;
