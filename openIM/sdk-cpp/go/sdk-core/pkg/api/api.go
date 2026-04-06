package api

import (
	"github.com/openimsdk/protocol/auth"
	"github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/encryption"
	"github.com/openimsdk/protocol/group"
	"github.com/openimsdk/protocol/jssdk"
	"github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/relation"
	"github.com/openimsdk/protocol/rtc"
	"github.com/openimsdk/protocol/third"
	"github.com/openimsdk/protocol/user"
)

var (
	ParseToken = newApi[auth.ParseTokenReq, auth.ParseTokenResp]("/auth/parse_token")
)

var (
	GetUsersInfo     = newApi[user.GetDesignateUsersReq, user.GetDesignateUsersResp]("/user/get_users_info")
	UpdateUserInfo   = newApi[user.UpdateUserInfoReq, user.UpdateUserInfoResp]("/user/update_user_info")
	UpdateUserInfoEx = newApi[user.UpdateUserInfoExReq, user.UpdateUserInfoExResp]("/user/update_user_info_ex")
	UserRegister     = newApi[user.UserRegisterReq, user.UserRegisterResp]("/user/user_register")
	UnregisterUser   = newApi[user.UnregisterUserReq, user.UnregisterUserResp]("/user/unregister_user")
	UserClientConfig = newApi[user.GetUserClientConfigReq, user.GetUserClientConfigResp]("/user/get_user_client_config")
	GetSpecialUsers  = newApi[user.GetSpecialUsersReq, user.GetSpecialUsersResp]("/user/get_special_users")
)

var (
	AddFriend                    = newApi[relation.ApplyToAddFriendReq, relation.ApplyToAddFriendResp]("/friend/add_friend")
	DeleteFriend                 = newApi[relation.DeleteFriendReq, relation.DeleteFriendResp]("/friend/delete_friend")
	GetRecvFriendApplicationList = newApi[relation.GetPaginationFriendsApplyToReq, relation.GetPaginationFriendsApplyToResp]("/friend/get_friend_apply_list")
	GetSelfFriendApplicationList = newApi[relation.GetPaginationFriendsApplyFromReq, relation.GetPaginationFriendsApplyFromResp]("/friend/get_self_friend_apply_list")
	GetSelfUnhandledApplyCount   = newApi[relation.GetSelfUnhandledApplyCountReq, relation.GetSelfUnhandledApplyCountResp]("/friend/get_self_unhandled_apply_count")
	ImportFriendList             = newApi[relation.ImportFriendReq, relation.ImportFriendResp]("/friend/import_friend")
	GetDesignatedFriendsApply    = newApi[relation.GetDesignatedFriendsApplyReq, relation.GetDesignatedFriendsApplyResp]("/friend/get_designated_friend_apply")
	GetFriendList                = newApi[relation.GetPaginationFriendsReq, relation.GetPaginationFriendsResp]("/friend/get_friend_list")
	GetDesignatedFriends         = newApi[relation.GetDesignatedFriendsReq, relation.GetDesignatedFriendsResp]("/friend/get_designated_friends")
	AddFriendResponse            = newApi[relation.RespondFriendApplyReq, relation.RespondFriendApplyResp]("/friend/add_friend_response")
	UpdateFriends                = newApi[relation.UpdateFriendsReq, relation.UpdateFriendsResp]("/friend/update_friends")
	GetIncrementalFriends        = newApi[relation.GetIncrementalFriendsReq, relation.GetIncrementalFriendsResp]("/friend/get_incremental_friends")
	GetFullFriendUserIDs         = newApi[relation.GetFullFriendUserIDsReq, relation.GetFullFriendUserIDsResp]("/friend/get_full_friend_user_ids")
	AddBlack                     = newApi[relation.AddBlackReq, relation.AddBlackResp]("/friend/add_black")
	RemoveBlack                  = newApi[relation.RemoveBlackReq, relation.RemoveBlackResp]("/friend/remove_black")
	GetBlackList                 = newApi[relation.GetPaginationBlacksReq, relation.GetPaginationBlacksResp]("/friend/get_black_list")
	DeleteFriendRequestsFromUser = newApi[relation.DeleteFriendRequestsFromUserReq, relation.DeleteFriendRequestsFromUserResp]("/friend/delete_friend_requests_from_user")
	DeleteFriendRequestsToUser   = newApi[relation.DeleteFriendRequestsToUserReq, relation.DeleteFriendRequestsToUserResp]("/friend/delete_friend_requests_to_user")
)

var (
	ClearConversationMsg             = newApi[msg.ClearConversationsMsgReq, msg.ClearConversationsMsgResp]("/msg/clear_conversation_msg")                       // Clear the message of the specified conversation
	ClearAllMsg                      = newApi[msg.UserClearAllMsgReq, msg.UserClearAllMsgResp]("/msg/user_clear_all_msg")                                       // Clear all messages of the current user
	DeleteMsgs                       = newApi[msg.DeleteMsgsReq, msg.DeleteMsgsResp]("/msg/delete_msgs")                                                        // Delete the specified message
	DeleteUserAllMessageInConv       = newApi[msg.DeleteUserAllMessagesInConvReq, msg.DeleteUserAllMessagesInConvResp]("/msg/delete_user_all_messages_in_conv") // Delete messages from a user
	RevokeMsg                        = newApi[msg.RevokeMsgReq, msg.RevokeMsgResp]("/msg/revoke_msg")
	MarkMsgsAsRead                   = newApi[msg.MarkMsgsAsReadReq, msg.MarkMsgsAsReadResp]("/msg/mark_msgs_as_read")
	GetConversationsHasReadAndMaxSeq = newApi[msg.GetConversationsHasReadAndMaxSeqReq, msg.GetConversationsHasReadAndMaxSeqResp]("/msg/get_conversations_has_read_and_max_seq")
	MarkConversationAsRead           = newApi[msg.MarkConversationAsReadReq, msg.MarkConversationAsReadResp]("/msg/mark_conversation_as_read")
	SetConversationHasReadSeq        = newApi[msg.SetConversationHasReadSeqReq, msg.SetConversationHasReadSeqResp]("/msg/set_conversation_has_read_seq")
	SendMsg                          = newApi[msg.SendMsgReq, msg.SendMsgResp]("/msg/send_msg")
	GetServerTime                    = newApi[msg.GetServerTimeReq, msg.GetServerTimeResp]("/msg/get_server_time")
	GetGroupMessageHasRead           = newApi[msg.GetGroupMessageHasReadReq, msg.GetGroupMessageHasReadResp]("/msg/get_group_message_has_read")
	GetGroupMessageReadNum           = newApi[msg.GetGroupMessageReadNumReq, msg.GetGroupMessageReadNumResp]("/msg/get_group_message_read_num")
	MarkGroupMessageRead             = newApi[msg.MarkGroupMessageReadReq, msg.MarkGroupMessageReadResp]("/msg/mark_group_message_read")
	GetStreamMsg                     = newApi[msg.GetStreamMsgReq, msg.GetStreamMsgResp]("/msg/get_stream_msg")
	ModifyMessage                    = newApi[msg.ModifyMessageReq, msg.ModifyMessageResp]("/msg/modify_message")
	ResetConversationUnread          = newApi[msg.ResetConversationUnreadReq, msg.ResetConversationUnreadResp]("/msg/reset_conversation_unread")
)

var (
	CreateGroup                       = newApi[group.CreateGroupReq, group.CreateGroupResp]("/group/create_group")
	SetGroupInfoEx                    = newApi[group.SetGroupInfoExReq, group.SetGroupInfoExResp]("/group/set_group_info_ex")
	JoinGroup                         = newApi[group.JoinGroupReq, group.JoinGroupResp]("/group/join_group")
	QuitGroup                         = newApi[group.QuitGroupReq, group.QuitGroupResp]("/group/quit_group")
	GetGroupsInfo                     = newApi[group.GetGroupsInfoReq, group.GetGroupsInfoResp]("/group/get_groups_info")
	GetGroupMemberList                = newApi[group.GetGroupMemberListReq, group.GetGroupMemberListResp]("/group/get_group_member_list")
	GetGroupMembersInfo               = newApi[group.GetGroupMembersInfoReq, group.GetGroupMembersInfoResp]("/group/get_group_members_info")
	InviteUserToGroup                 = newApi[group.InviteUserToGroupReq, group.InviteUserToGroupResp]("/group/invite_user_to_group")
	GetJoinedGroupList                = newApi[group.GetJoinedGroupListReq, group.GetJoinedGroupListResp]("/group/get_joined_group_list")
	KickGroupMember                   = newApi[group.KickGroupMemberReq, group.KickGroupMemberResp]("/group/kick_group")
	TransferGroup                     = newApi[group.TransferGroupOwnerReq, group.TransferGroupOwnerResp]("/group/transfer_group")
	GetRecvGroupApplicationList       = newApi[group.GetGroupApplicationListReq, group.GetGroupApplicationListResp]("/group/get_recv_group_applicationList")
	GetSendGroupApplicationList       = newApi[group.GetUserReqApplicationListReq, group.GetUserReqApplicationListResp]("/group/get_user_req_group_applicationList")
	GetGroupApplicationUnhandledCount = newApi[group.GetGroupApplicationUnhandledCountReq, group.GetGroupApplicationUnhandledCountResp]("/group/get_group_application_unhandled_count")
	AcceptGroupApplication            = newApi[group.GroupApplicationResponseReq, group.GroupApplicationResponseResp]("/group/group_application_response")
	DismissGroup                      = newApi[group.DismissGroupReq, group.DismissGroupResp]("/group/dismiss_group")
	MuteGroupMember                   = newApi[group.MuteGroupMemberReq, group.MuteGroupMemberResp]("/group/mute_group_member")
	CancelMuteGroupMember             = newApi[group.CancelMuteGroupMemberReq, group.CancelMuteGroupMemberResp]("/group/cancel_mute_group_member")
	MuteGroup                         = newApi[group.MuteGroupReq, group.MuteGroupResp]("/group/mute_group")
	CancelMuteGroup                   = newApi[group.CancelMuteGroupReq, group.CancelMuteGroupResp]("/group/cancel_mute_group")
	SetGroupMemberInfo                = newApi[group.SetGroupMemberInfoReq, group.SetGroupMemberInfoResp]("/group/set_group_member_info")
	GetIncrementalJoinGroup           = newApi[group.GetIncrementalJoinGroupReq, group.GetIncrementalJoinGroupResp]("/group/get_incremental_join_groups")
	GetIncrementalGroupMember         = newApi[group.GetIncrementalGroupMemberReq, group.GetIncrementalGroupMemberResp]("/group/get_incremental_group_members")
	GetIncrementalGroupMemberBatch    = newApi[group.BatchGetIncrementalGroupMemberReq, group.BatchGetIncrementalGroupMemberResp]("/group/get_incremental_group_members_batch")
	GetFullJoinedGroupIDs             = newApi[group.GetFullJoinGroupIDsReq, group.GetFullJoinGroupIDsResp]("/group/get_full_join_group_ids")
	GetFullGroupMemberUserIDs         = newApi[group.GetFullGroupMemberUserIDsReq, group.GetFullGroupMemberUserIDsResp]("/group/get_full_group_member_user_ids")
	DeleteGroupRequestsFromUser       = newApi[group.DeleteGroupRequestsFromUserReq, group.DeleteGroupRequestsFromUserResp]("/group/delete_group_requests_from_user")
	DeleteGroupRequestsToGroup        = newApi[group.DeleteGroupRequestsToGroupReq, group.DeleteGroupRequestsToGroupResp]("/group/delete_group_requests_to_group")
)

var (
	UpdateConversation           = newApi[conversation.UpdateConversationReq, conversation.UpdateConversationResp]("/conversation/update_conversation")
	GetConversations             = newApi[conversation.GetConversationsReq, conversation.GetConversationsResp]("/conversation/get_conversations")
	GetAllConversations          = newApi[conversation.GetAllConversationsReq, conversation.GetAllConversationsResp]("/conversation/get_all_conversations")
	SetConversations             = newApi[conversation.SetConversationsReq, conversation.SetConversationsResp]("/conversation/set_conversations")
	GetIncrementalConversation   = newApi[conversation.GetIncrementalConversationReq, conversation.GetIncrementalConversationResp]("/conversation/get_incremental_conversations")
	GetFullConversationIDs       = newApi[conversation.GetFullOwnerConversationIDsReq, conversation.GetFullOwnerConversationIDsResp]("/conversation/get_full_conversation_ids")
	GetOwnerConversation         = newApi[conversation.GetOwnerConversationReq, conversation.GetOwnerConversationResp]("/conversation/get_owner_conversation")
	GetActiveConversation        = newApi[jssdk.GetActiveConversationsReq, jssdk.GetActiveConversationsResp]("/jssdk/get_active_conversations")
	GetConversationPinnedMsg     = newApi[conversation.GetConversationPinnedMsgReq, conversation.GetConversationPinnedMsgResp]("/conversation/get_conversation_pinned_msg")
	SetConversationPinnedMsg     = newApi[conversation.SetConversationPinnedMsgReq, conversation.SetConversationPinnedMsgResp]("/conversation/set_conversation_pinned_msg")
	CreateConversationGroup      = newApi[conversation.CreateConversationGroupReq, conversation.CreateConversationGroupResp]("/conversation/create_conversation_group")
	UpdateConversationGroup      = newApi[conversation.UpdateConversationGroupReq, conversation.UpdateConversationGroupResp]("/conversation/update_conversation_group")
	DeleteConversationGroup      = newApi[conversation.DeleteConversationGroupReq, conversation.DeleteConversationGroupResp]("/conversation/delete_conversation_group")
	GetConversationGroups        = newApi[conversation.GetConversationGroupsReq, conversation.GetConversationGroupsResp]("/conversation/get_conversation_groups")
	SetConversationGroupOrder    = newApi[conversation.SetConversationGroupOrderReq, conversation.SetConversationGroupOrderResp]("/conversation/set_conversation_group_order")
	AddConversationsToGroup      = newApi[conversation.AddConversationsToGroupsReq, conversation.AddConversationsToGroupsResp]("/conversation/add_conversations_to_groups")
	RemoveConversationsFromGroup = newApi[conversation.RemoveConversationsFromGroupsReq, conversation.RemoveConversationsFromGroupsResp]("/conversation/remove_conversations_from_groups")
)

var (
	GetAdminToken = newApi[auth.GetAdminTokenReq, auth.GetAdminTokenResp]("/auth/get_admin_token")
	GetUsersToken = newApi[auth.GetUserTokenReq, auth.GetUserTokenResp]("/auth/get_user_token")
)

var (
	FcmUpdateToken         = newApi[third.FcmUpdateTokenReq, third.FcmUpdateTokenResp]("/third/fcm_update_token")
	SetAppBadge            = newApi[third.SetAppBadgeReq, third.SetAppBadgeResp]("/third/set_app_badge")
	UploadLogs             = newApi[third.UploadLogsReq, third.UploadLogsResp]("/third/logs/upload")
	GetASRCapabilities     = newApi[third.GetASRCapabilitiesReq, third.GetASRCapabilitiesResp]("/third/get_asr_capabilities")
	GetASRTranscriptionURL = newApi[third.GetASRTranscriptionURLReq, third.GetASRTranscriptionURLResp]("/third/get_asr_transcription_url")
	GetASRRecognitionURL   = newApi[third.GetASRRecognitionURLReq, third.GetASRRecognitionURLResp]("/third/get_asr_recognition_url")
)

var (
	CreateTimerTask = newApi[third.CreateTimerTaskReq, third.CreateTimerTaskResp]("/timer/create_timer_task")
	UpdateTimerTask = newApi[third.UpdateTimerTaskReq, third.UpdateTimerTaskResp]("/timer/update_timer_task")
	DeleteTimerTask = newApi[third.DeleteTimerTaskReq, third.DeleteTimerTaskResp]("/timer/delete_timer_task")
	GetTimerTask    = newApi[third.GetTimerTaskReq, third.GetTimerTaskResp]("/timer/get_timer_task")
	ListTimerTasks  = newApi[third.ListTimerTasksReq, third.ListTimerTasksResp]("/timer/list_timer_task")
)

var (
	ObjectPartLimit               = newApi[third.PartLimitReq, third.PartLimitResp]("/object/part_limit")
	ObjectInitiateMultipartUpload = newApi[third.InitiateMultipartUploadReq, third.InitiateMultipartUploadResp]("/object/initiate_multipart_upload")
	ObjectAuthSign                = newApi[third.AuthSignReq, third.AuthSignResp]("/object/auth_sign")
	ObjectCompleteMultipartUpload = newApi[third.CompleteMultipartUploadReq, third.CompleteMultipartUploadResp]("/object/complete_multipart_upload")
	ObjectAccessURL               = newApi[third.AccessURLReq, third.AccessURLResp]("/object/access_url")
)

var (
	SignalGetRoomByGroupID          = newApi[rtc.SignalGetRoomByGroupIDReq, rtc.SignalGetRoomByGroupIDResp]("/rtc-meeting/signal_get_room_by_group_id")
	SignalGetTokenByRoomID          = newApi[rtc.SignalGetTokenByRoomIDReq, rtc.SignalGetTokenByRoomIDResp]("/rtc-meeting/signal_get_token_by_room_id")
	SignalGetRooms                  = newApi[rtc.SignalGetRoomsReq, rtc.SignalGetRoomsResp]("/rtc-meeting/signal_get_rooms")
	GetSignalInvitationInfo         = newApi[rtc.GetSignalInvitationInfoReq, rtc.GetSignalInvitationInfoResp]("/rtc-meeting/get_signal_invitation_info")
	GetSignalInvitationInfoStartApp = newApi[rtc.GetSignalInvitationInfoStartAppReq, rtc.GetSignalInvitationInfoStartAppResp]("/rtc-meeting/get_signal_invitation_info_start_app")
	SignalSendCustomSignal          = newApi[rtc.SignalSendCustomSignalReq, rtc.SignalSendCustomSignalResp]("/rtc-meeting/signal_send_custom_signal")
)

var (
	GetEncryptionKey = newApi[encryption.GetEncryptionKeyReq, encryption.GetEncryptionKeyResp]("/encryption/get_encryption_key")
)
