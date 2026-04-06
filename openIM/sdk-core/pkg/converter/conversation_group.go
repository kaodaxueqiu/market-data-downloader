package converter

import (
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	pbConversation "github.com/openimsdk/protocol/conversation"
)

func ServerConversationGroupToLocal(info *pbConversation.ConversationGroup) *model_struct.LocalConversationGroup {
	if info == nil {
		return nil
	}
	return &model_struct.LocalConversationGroup{
		ConversationGroupID:   info.ConversationGroupID,
		Name:                  info.Name,
		Serial:                info.Order,
		Version:               info.Version,
		Ex:                    info.Ex.GetValue(),
		ConversationGroupType: int32(info.ConversationGroupType),
		Hidden:                info.Hidden,
		ConversationIDs:       info.ConversationIDs,
	}
}

func ServerConversationGroupsToLocal(info []*pbConversation.ConversationGroup) []*model_struct.LocalConversationGroup {
	locals := make([]*model_struct.LocalConversationGroup, 0, len(info))
	for _, info := range info {
		if info == nil {
			continue
		}
		locals = append(locals, ServerConversationGroupToLocal(info))
	}
	return locals
}
