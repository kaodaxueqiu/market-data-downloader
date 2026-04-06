package sdk_params_callback

type DeleteFriendRequestsReq struct {
	FriendRequests []*SimpleFriendRequest `json:"friendRequests"`
}

type SimpleFriendRequest struct {
	FromUserID string `json:"fromUserID"`
	ToUserID   string `json:"toUserID"`
}
