package sdk_params_callback

import (
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/protocol/wrapperspb"
)

type CreateConversationGroupReq struct {
	Name                  string                               `json:"name"`
	Order                 int64                                `json:"order"`
	Ex                    *string                              `json:"ex"`
	ConversationID        *string                              `json:"conversationID"`
	ConversationGroupType pbConversation.ConversationGroupType `json:"conversationGroupType"`
}

type UpdateConversationGroupReq struct {
	ConversationGroupID string                  `json:"conversationGroupID"`
	Name                *wrapperspb.StringValue `json:"name"`
	Ex                  *wrapperspb.StringValue `json:"ex"`
	Hidden              *wrapperspb.BoolValue   `json:"hidden"`
}

type GetConversationListByGroupReq struct {
	GroupID    string                   `json:"groupID"`
	Pagination *sdkws.RequestPagination `json:"pagination"`
}

type GetConversationListByGroupResp struct {
	ConversationTotal int64                              `json:"conversationtotal"`
	UnreadTotal       int64                              `json:"unreadTotal"`
	ConversationElems []*pbConversation.ConversationElem `json:"conversationElems"`
}

type GetConversationGroupInfoWithConversationsReq struct {
	ConversationGroupID string                   `json:"conversationGroupID"`
	Pagination          *sdkws.RequestPagination `json:"pagination"`
}

type GetConversationGroupInfoWithConversationsResp struct {
	Group             *model_struct.LocalConversationGroup `json:"group"`
	ConversationTotal int64                                `json:"conversationTotal"`
	ConversationElems []*model_struct.LocalConversation    `json:"conversationElems"`
}

type ConversationGroupChangedCallback struct {
	Group *model_struct.LocalConversationGroup `json:"group"`
}

type ConversationGroupMemberChangedCallback struct {
	Group           *model_struct.LocalConversationGroup `json:"group"`
	ConversationIDs []string                             `json:"conversationIDs"`
	Conversations   []*model_struct.LocalConversation    `json:"conversations"`
}
