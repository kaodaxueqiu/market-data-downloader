package conversation_msg

import "github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"

type conversationGroupCacheState struct {
	changeItems            map[string]conversationGroupChangeCacheItem
	groupsByID             map[string]*model_struct.LocalConversationGroup
	membersByGroupID       map[string][]string
	memberSetByGroupID     map[string]map[string]struct{}
	groupIDsByConversation map[string]map[string]struct{}
	unreadByGroupID        map[string]int32
}

func (c *conversationGroupCacheState) ensureInitialized() {
	if c.changeItems == nil {
		c.changeItems = make(map[string]conversationGroupChangeCacheItem)
	}
	if c.groupsByID == nil {
		c.groupsByID = make(map[string]*model_struct.LocalConversationGroup)
	}
	if c.membersByGroupID == nil {
		c.membersByGroupID = make(map[string][]string)
	}
	if c.memberSetByGroupID == nil {
		c.memberSetByGroupID = make(map[string]map[string]struct{})
	}
	if c.groupIDsByConversation == nil {
		c.groupIDsByConversation = make(map[string]map[string]struct{})
	}
	if c.unreadByGroupID == nil {
		c.unreadByGroupID = make(map[string]int32)
	}
}
