package conversation_msg

import (
	"context"
	"sort"
	"strings"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/log"
)

func newConversationGroupCacheItem(conversation *model_struct.LocalConversation) conversationGroupChangeCacheItem {
	if conversation == nil {
		return conversationGroupChangeCacheItem{}
	}
	return conversationGroupChangeCacheItem{
		UnreadCount:      conversation.UnreadCount,
		RecvMsgOpt:       conversation.RecvMsgOpt,
		HasLatestMessage: conversation.LatestMsgSendTime > 0,
		IsMarked:         conversation.IsMarked,
		IsPinned:         conversation.IsPinned,
		GroupAtType:      conversation.GroupAtType,
		IsGroupChat:      conversation.GroupID != "",
	}
}

func conversationGroupUnreadCount(item conversationGroupChangeCacheItem) int32 {
	if item.RecvMsgOpt >= constant.ReceiveNotNotifyMessage {
		return 0
	}
	if !item.HasLatestMessage {
		return 0
	}
	return item.UnreadCount
}

func cloneConversationGroup(group *model_struct.LocalConversationGroup) *model_struct.LocalConversationGroup {
	if group == nil {
		return nil
	}
	clone := *group
	clone.ConversationIDs = append([]string(nil), group.ConversationIDs...)
	return &clone
}

func cloneConversationGroupIDs(ids []string) []string {
	return append([]string(nil), ids...)
}

func (c *Conversation) defaultFilterConversationGroup(groupID string) *model_struct.LocalConversationGroup {
	return &model_struct.LocalConversationGroup{
		ConversationGroupID:   groupID,
		Name:                  strings.TrimPrefix(groupID, "i_"),
		Serial:                int64(c.filterGroupIdx(groupID)),
		ConversationGroupType: constant.ConversationGroupTypeFilter,
		Hidden:                false,
		Ex:                    "",
	}
}

func (c *Conversation) ensureConversationGroupCachesLocked() {
	c.conversationGroupCache.ensureInitialized()
}

func (c *Conversation) ensureDefaultFilterConversationGroupsLocked() {
	for _, groupID := range c.filterConversationGroupNames {
		if _, ok := c.conversationGroupCache.groupsByID[groupID]; ok {
			continue
		}
		c.upsertConversationGroupLocked(c.defaultFilterConversationGroup(groupID))
	}
}

func (c *Conversation) upsertConversationGroupMembershipLocked(groupID string, conversationID string) {
	if groupID == "" || conversationID == "" {
		return
	}
	cache := &c.conversationGroupCache
	members := cache.memberSetByGroupID[groupID]
	if members == nil {
		members = make(map[string]struct{})
		cache.memberSetByGroupID[groupID] = members
	}
	if _, ok := members[conversationID]; ok {
		return
	}
	members[conversationID] = struct{}{}
	cache.membersByGroupID[groupID] = append(cache.membersByGroupID[groupID], conversationID)
	if cache.groupIDsByConversation[conversationID] == nil {
		cache.groupIDsByConversation[conversationID] = make(map[string]struct{})
	}
	cache.groupIDsByConversation[conversationID][groupID] = struct{}{}
}

func (c *Conversation) removeConversationGroupMembershipLocked(groupID string, conversationID string) {
	if groupID == "" || conversationID == "" {
		return
	}
	cache := &c.conversationGroupCache
	if members := cache.memberSetByGroupID[groupID]; members != nil {
		if _, ok := members[conversationID]; ok {
			delete(members, conversationID)
			cache.membersByGroupID[groupID] = removeStringValue(cache.membersByGroupID[groupID], conversationID)
		}
	}
	if groups := cache.groupIDsByConversation[conversationID]; groups != nil {
		delete(groups, groupID)
		if len(groups) == 0 {
			delete(cache.groupIDsByConversation, conversationID)
		}
	}
}

func removeStringValue(values []string, value string) []string {
	for i, current := range values {
		if current != value {
			continue
		}
		return append(values[:i], values[i+1:]...)
	}
	return values
}

func (c *Conversation) replaceConversationGroupMembersLocked(groupID string, conversationIDs []string) {
	normalized := normalizeConversationIDs(conversationIDs)
	cache := &c.conversationGroupCache
	for _, conversationID := range cache.membersByGroupID[groupID] {
		if groups := cache.groupIDsByConversation[conversationID]; groups != nil {
			delete(groups, groupID)
			if len(groups) == 0 {
				delete(cache.groupIDsByConversation, conversationID)
			}
		}
	}
	cache.membersByGroupID[groupID] = normalized
	memberSet := make(map[string]struct{}, len(normalized))
	for _, conversationID := range normalized {
		memberSet[conversationID] = struct{}{}
		if cache.groupIDsByConversation[conversationID] == nil {
			cache.groupIDsByConversation[conversationID] = make(map[string]struct{})
		}
		cache.groupIDsByConversation[conversationID][groupID] = struct{}{}
	}
	cache.memberSetByGroupID[groupID] = memberSet
}

func (c *Conversation) recomputeConversationGroupUnreadLocked(groupID string) {
	var unread int32
	cache := &c.conversationGroupCache
	for _, conversationID := range cache.membersByGroupID[groupID] {
		unread += conversationGroupUnreadCount(cache.changeItems[conversationID])
	}
	cache.unreadByGroupID[groupID] = unread
}

func (c *Conversation) recomputeFilterConversationGroupLocked(groupID string) {
	cache := &c.conversationGroupCache
	for _, conversationID := range cloneConversationGroupIDs(cache.membersByGroupID[groupID]) {
		c.removeConversationGroupMembershipLocked(groupID, conversationID)
	}
	cache.unreadByGroupID[groupID] = 0
	for conversationID, item := range cache.changeItems {
		if !matchConversationFilterGroup(item, groupID) {
			continue
		}
		c.upsertConversationGroupMembershipLocked(groupID, conversationID)
		cache.unreadByGroupID[groupID] += conversationGroupUnreadCount(item)
	}
}

func (c *Conversation) removeConversationGroupLocked(groupID string) {
	cache := &c.conversationGroupCache
	group := cache.groupsByID[groupID]
	if group == nil {
		return
	}
	if group.ConversationGroupType == constant.ConversationGroupTypeFilter && c.isFilterConversationGroupByID(groupID) {
		cache.groupsByID[groupID] = c.defaultFilterConversationGroup(groupID)
		c.recomputeFilterConversationGroupLocked(groupID)
		return
	}
	for _, conversationID := range cloneConversationGroupIDs(cache.membersByGroupID[groupID]) {
		c.removeConversationGroupMembershipLocked(groupID, conversationID)
	}
	delete(cache.groupsByID, groupID)
	delete(cache.membersByGroupID, groupID)
	delete(cache.memberSetByGroupID, groupID)
	delete(cache.unreadByGroupID, groupID)
}

func (c *Conversation) upsertConversationGroupLocked(group *model_struct.LocalConversationGroup) {
	if group == nil || group.ConversationGroupID == "" {
		return
	}
	clone := cloneConversationGroup(group)
	if clone.ConversationGroupType == constant.ConversationGroupTypeFilter && c.isFilterConversationGroupByID(clone.ConversationGroupID) {
		defaultGroup := c.defaultFilterConversationGroup(clone.ConversationGroupID)
		if clone.Name != "" {
			defaultGroup.Name = clone.Name
		}
		if clone.Serial != 0 {
			defaultGroup.Serial = clone.Serial
		}
		defaultGroup.Version = clone.Version
		defaultGroup.Ex = clone.Ex
		defaultGroup.Hidden = clone.Hidden
		clone = defaultGroup
	}
	clone.ConversationIDs = nil
	cache := &c.conversationGroupCache
	cache.groupsByID[clone.ConversationGroupID] = clone
	if _, ok := cache.membersByGroupID[clone.ConversationGroupID]; !ok {
		cache.membersByGroupID[clone.ConversationGroupID] = nil
	}
	if _, ok := cache.memberSetByGroupID[clone.ConversationGroupID]; !ok {
		cache.memberSetByGroupID[clone.ConversationGroupID] = make(map[string]struct{})
	}
	if _, ok := cache.unreadByGroupID[clone.ConversationGroupID]; !ok {
		cache.unreadByGroupID[clone.ConversationGroupID] = 0
	}
}

func (c *Conversation) rebuildConversationGroupCaches(ctx context.Context) error {
	if c.db == nil {
		return nil
	}
	conversations, err := c.db.GetAllConversationListDB(ctx)
	if err != nil {
		log.ZWarn(ctx, "rebuildConversationGroupCaches load conversations failed", err)
		return err
	}
	localGroups, err := c.db.GetAllConversationGroupsDB(ctx)
	if err != nil {
		log.ZWarn(ctx, "rebuildConversationGroupCaches load groups failed", err)
		return err
	}

	stateCache := make(map[string]conversationGroupChangeCacheItem, len(conversations))
	groupByID := make(map[string]*model_struct.LocalConversationGroup)
	groupMembers := make(map[string][]string)
	groupMemberSet := make(map[string]map[string]struct{})
	groupIDsByConv := make(map[string]map[string]struct{})
	groupUnread := make(map[string]int32)

	for _, groupID := range c.filterConversationGroupNames {
		groupByID[groupID] = c.defaultFilterConversationGroup(groupID)
		groupMembers[groupID] = nil
		groupMemberSet[groupID] = make(map[string]struct{})
		groupUnread[groupID] = 0
	}

	for _, group := range localGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		clone := cloneConversationGroup(group)
		if clone.ConversationGroupType == constant.ConversationGroupTypeFilter && c.isFilterConversationGroupByID(clone.ConversationGroupID) {
			defaultGroup := c.defaultFilterConversationGroup(clone.ConversationGroupID)
			if clone.Name != "" {
				defaultGroup.Name = clone.Name
			}
			if clone.Serial != 0 {
				defaultGroup.Serial = clone.Serial
			}
			defaultGroup.Version = clone.Version
			defaultGroup.Ex = clone.Ex
			defaultGroup.Hidden = clone.Hidden
			clone = defaultGroup
		}
		clone.ConversationIDs = nil
		groupByID[clone.ConversationGroupID] = clone
		groupMembers[clone.ConversationGroupID] = nil
		groupMemberSet[clone.ConversationGroupID] = make(map[string]struct{})
		groupUnread[clone.ConversationGroupID] = 0
	}

	for _, conversation := range conversations {
		if conversation == nil || conversation.ConversationID == "" {
			continue
		}
		stateCache[conversation.ConversationID] = newConversationGroupCacheItem(conversation)
		for _, groupID := range c.filterConversationGroupNames {
			if !matchConversationFilterGroup(stateCache[conversation.ConversationID], groupID) {
				continue
			}
			if _, ok := groupMemberSet[groupID][conversation.ConversationID]; ok {
				continue
			}
			groupMemberSet[groupID][conversation.ConversationID] = struct{}{}
			groupMembers[groupID] = append(groupMembers[groupID], conversation.ConversationID)
			groupUnread[groupID] += conversationGroupUnreadCount(stateCache[conversation.ConversationID])
			if groupIDsByConv[conversation.ConversationID] == nil {
				groupIDsByConv[conversation.ConversationID] = make(map[string]struct{})
			}
			groupIDsByConv[conversation.ConversationID][groupID] = struct{}{}
		}
	}

	for groupID, group := range groupByID {
		if group == nil || group.ConversationGroupType != constant.ConversationGroupTypeNormal {
			continue
		}
		memberIDs, err := c.db.GetConversationIDsByGroupIdDB(ctx, groupID)
		if err != nil {
			log.ZWarn(ctx, "rebuildConversationGroupCaches load members failed", err, "groupID", groupID)
			return err
		}
		memberIDs = normalizeConversationIDs(memberIDs)
		groupMembers[groupID] = memberIDs
		memberSet := make(map[string]struct{}, len(memberIDs))
		var unread int32
		for _, conversationID := range memberIDs {
			memberSet[conversationID] = struct{}{}
			unread += conversationGroupUnreadCount(stateCache[conversationID])
			if groupIDsByConv[conversationID] == nil {
				groupIDsByConv[conversationID] = make(map[string]struct{})
			}
			groupIDsByConv[conversationID][groupID] = struct{}{}
		}
		groupMemberSet[groupID] = memberSet
		groupUnread[groupID] = unread
	}

	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.conversationGroupCache.changeItems = stateCache
	c.conversationGroupCache.groupsByID = groupByID
	c.conversationGroupCache.membersByGroupID = groupMembers
	c.conversationGroupCache.memberSetByGroupID = groupMemberSet
	c.conversationGroupCache.groupIDsByConversation = groupIDsByConv
	c.conversationGroupCache.unreadByGroupID = groupUnread
	return nil
}

func (c *Conversation) applyServerConversationGroupsToCache(groups []*model_struct.LocalConversationGroup, fullSync bool) {
	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.ensureConversationGroupCachesLocked()
	c.ensureDefaultFilterConversationGroupsLocked()

	if fullSync {
		incoming := make(map[string]struct{}, len(groups))
		for _, group := range groups {
			if group == nil || group.ConversationGroupID == "" {
				continue
			}
			incoming[group.ConversationGroupID] = struct{}{}
		}
		for groupID, group := range c.conversationGroupCache.groupsByID {
			if group == nil || group.ConversationGroupType == constant.ConversationGroupTypeFilter {
				continue
			}
			if _, ok := incoming[groupID]; ok {
				continue
			}
			c.removeConversationGroupLocked(groupID)
		}
	}

	for _, group := range groups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		c.upsertConversationGroupLocked(group)
		if group.ConversationGroupType == constant.ConversationGroupTypeFilter {
			c.recomputeFilterConversationGroupLocked(group.ConversationGroupID)
			continue
		}
		c.replaceConversationGroupMembersLocked(group.ConversationGroupID, group.ConversationIDs)
		c.recomputeConversationGroupUnreadLocked(group.ConversationGroupID)
	}
}

func (c *Conversation) applyConversationGroupCacheChanges(groups []*model_struct.LocalConversationGroup, deletedGroupIDs []string) {
	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.ensureConversationGroupCachesLocked()
	c.ensureDefaultFilterConversationGroupsLocked()

	for _, groupID := range deletedGroupIDs {
		if groupID == "" {
			continue
		}
		c.removeConversationGroupLocked(groupID)
	}

	for _, group := range groups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		c.upsertConversationGroupLocked(group)
		if group.ConversationGroupType == constant.ConversationGroupTypeFilter {
			c.recomputeFilterConversationGroupLocked(group.ConversationGroupID)
			continue
		}
		c.replaceConversationGroupMembersLocked(group.ConversationGroupID, group.ConversationIDs)
		c.recomputeConversationGroupUnreadLocked(group.ConversationGroupID)
	}
}

func (c *Conversation) cachedConversationGroupIDsByConversationID(conversationID string, includeFilter bool) ([]string, bool) {
	if conversationID == "" {
		return nil, false
	}
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	groupIDs, ok := c.conversationGroupCache.groupIDsByConversation[conversationID]
	if !ok {
		return nil, false
	}
	result := make([]string, 0, len(groupIDs))
	for groupID := range groupIDs {
		if !includeFilter && c.isFilterConversationGroupByID(groupID) {
			continue
		}
		result = append(result, groupID)
	}
	sort.Strings(result)
	return result, true
}

func (c *Conversation) cachedConversationGroupMembers(groupID string) ([]string, bool) {
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	members, ok := c.conversationGroupCache.membersByGroupID[groupID]
	if !ok {
		return nil, false
	}
	return cloneConversationGroupIDs(members), true
}

func (c *Conversation) cachedConversationGroupUnread(groupID string) (int32, bool) {
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	unread, ok := c.conversationGroupCache.unreadByGroupID[groupID]
	return unread, ok
}

func cloneCachedConversationGroupLocked(groupID string, group *model_struct.LocalConversationGroup, members map[string][]string, unread map[string]int32) *model_struct.LocalConversationGroup {
	if group == nil {
		return nil
	}
	clone := cloneConversationGroup(group)
	clone.ConversationIDs = cloneConversationGroupIDs(members[groupID])
	clone.UnreadCount = unread[groupID]
	return clone
}

func (c *Conversation) cachedConversationGroup(groupID string) (*model_struct.LocalConversationGroup, bool) {
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	group, ok := c.conversationGroupCache.groupsByID[groupID]
	if !ok || group == nil {
		return nil, false
	}
	return cloneCachedConversationGroupLocked(groupID, group, c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID), true
}

func (c *Conversation) cachedConversationGroups() []*model_struct.LocalConversationGroup {
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	result := make([]*model_struct.LocalConversationGroup, 0, len(c.conversationGroupCache.groupsByID))
	for groupID, group := range c.conversationGroupCache.groupsByID {
		if group == nil {
			continue
		}
		result = append(result, cloneCachedConversationGroupLocked(groupID, group, c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID))
	}
	return result
}

func (c *Conversation) cachedConversationGroupsByIDs(groupIDs []string) ([]*model_struct.LocalConversationGroup, bool) {
	c.conversationGroupCacheLock.RLock()
	defer c.conversationGroupCacheLock.RUnlock()
	if c.conversationGroupCache.groupsByID == nil {
		return nil, false
	}
	result := make([]*model_struct.LocalConversationGroup, 0, len(groupIDs))
	for _, groupID := range groupIDs {
		group, ok := c.conversationGroupCache.groupsByID[groupID]
		if !ok || group == nil {
			continue
		}
		result = append(result, cloneCachedConversationGroupLocked(groupID, group, c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID))
	}
	return result, true
}

func (c *Conversation) cacheConversationGroupSnapshot(group *model_struct.LocalConversationGroup) (*model_struct.LocalConversationGroup, bool) {
	if group == nil || group.ConversationGroupID == "" {
		return nil, false
	}
	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.ensureConversationGroupCachesLocked()
	c.upsertConversationGroupLocked(group)
	if group.ConversationGroupType == constant.ConversationGroupTypeFilter && c.isFilterConversationGroupByID(group.ConversationGroupID) {
		c.recomputeFilterConversationGroupLocked(group.ConversationGroupID)
	} else {
		c.replaceConversationGroupMembersLocked(group.ConversationGroupID, group.ConversationIDs)
		c.conversationGroupCache.unreadByGroupID[group.ConversationGroupID] = group.UnreadCount
	}
	return cloneCachedConversationGroupLocked(group.ConversationGroupID, c.conversationGroupCache.groupsByID[group.ConversationGroupID], c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID), true
}

func (c *Conversation) ensureDefaultFilterConversationGroupCached(groupID string) (*model_struct.LocalConversationGroup, bool) {
	if !c.isFilterConversationGroupByID(groupID) {
		return nil, false
	}
	c.conversationGroupCacheLock.Lock()
	defer c.conversationGroupCacheLock.Unlock()
	c.ensureConversationGroupCachesLocked()
	if group, ok := c.conversationGroupCache.groupsByID[groupID]; ok && group != nil {
		return cloneCachedConversationGroupLocked(groupID, group, c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID), true
	}
	c.upsertConversationGroupLocked(c.defaultFilterConversationGroup(groupID))
	c.recomputeFilterConversationGroupLocked(groupID)
	return cloneCachedConversationGroupLocked(groupID, c.conversationGroupCache.groupsByID[groupID], c.conversationGroupCache.membersByGroupID, c.conversationGroupCache.unreadByGroupID), true
}
