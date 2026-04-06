package conversation_msg

import (
	"context"
	"errors"
	"runtime/debug"
	"slices"
	"sort"
	"strings"

	"gorm.io/gorm"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdk_params_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sort_conversation"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/protocol/wrapperspb"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

func (c *Conversation) syncConversationGroups(ctx context.Context, groups []*pbConversation.ConversationGroup, fullSync bool) error {
	localSnapShot, err := c.db.GetAllConversationGroupsDB(ctx)
	if err != nil {
		return err
	}
	localMaps := datautil.SliceToMap(localSnapShot, func(e *model_struct.LocalConversationGroup) string {
		return e.ConversationGroupID
	})
	localMemberSnapshot := make(map[string][]string, len(localSnapShot))
	serverGroups := converter.ServerConversationGroupsToLocal(groups)
	for _, group := range serverGroups {
		conversationList, _ := c.db.GetConversationIDsByGroupIdDB(ctx, group.ConversationGroupID)
		if localMaps[group.ConversationGroupID] != nil {
			localMaps[group.ConversationGroupID].ConversationIDs = conversationList
		}
		localMemberSnapshot[group.ConversationGroupID] = conversationList
	}
	//every struct in here is changes,so if no delete,just up/sert it.
	if serverGroups == nil {
		log.ZDebug(ctx, "sync conversation group is no updates")
		return nil
	}
	if fullSync {
		log.ZInfo(ctx, "full sync is triggered! Cleaning local now.", "stack", debug.Stack())
		// fullSync mode, server should contain a full snapshot, so local will be clean
		// DeleteAllConversationGroupDB will not remove conversationType=1
		err = c.db.DeleteAllConversationGroupDB(ctx)
		if err != nil {
			return err
		}
		for _, group := range localSnapShot {
			_ = c.db.DeleteConversationGroupMembersByGroupIdDB(ctx, group.ConversationGroupID)
		}
	}

	err = c.db.UpsertConversationGroupsDB(ctx, serverGroups)
	if err != nil {
		return err
	}

	for _, group := range serverGroups {
		err := c.db.DeleteConversationGroupMembersByGroupIdDB(ctx, group.ConversationGroupID)
		if err != nil {
			log.ZError(ctx, "Clean Local Data Error!", errs.Wrap(err))
		}
		for _, con := range group.ConversationIDs {
			err := c.db.AddConversationGroupMembersDB(ctx, con, []string{group.ConversationGroupID})
			if err != nil {
				return err
			}
		}
	}
	c.applyServerConversationGroupsToCache(serverGroups, fullSync)
	// calculate diff
	addedGroup, deletedGroup, updatedGroup, addedMembers, deletedMembers := c.calculateDiff(localMaps,
		localMemberSnapshot, groups, fullSync)

	c.onConversationGroupAdded(ctx, addedGroup)
	c.onConversationGroupDeleted(ctx, deletedGroup)
	c.onConversationGroupUpdated(ctx, updatedGroup)
	for id, local := range addedMembers {
		if local != nil {
			c.onConversationGroupMemberAdded(ctx, id, local)
		}
	}
	for id, local := range deletedMembers {
		if local != nil {
			c.onConversationGroupMemberDeleted(ctx, id, local)
		}
	}
	return nil
}

func (c *Conversation) calculateDiff(localSnapShot map[string]*model_struct.LocalConversationGroup,
	localMemberSnapshot map[string][]string, groups []*pbConversation.ConversationGroup, fullSync bool) ([]*model_struct.LocalConversationGroup,
	[]*model_struct.LocalConversationGroup, []*model_struct.LocalConversationGroup,
	map[string][]string, map[string][]string) {

	localMaps := localSnapShot
	newGroups := datautil.SliceToMapOkAny(groups, func(e *pbConversation.ConversationGroup) (string, *pbConversation.ConversationGroup, bool) {
		if e != nil {
			return e.ConversationGroupID, e, true
		} else {
			return "", e, false
		}
	})
	var addedGroup []*model_struct.LocalConversationGroup
	var deletedGroup []*model_struct.LocalConversationGroup
	var updatedGroup []*model_struct.LocalConversationGroup
	addedMembers := make(map[string][]string)
	deletedMembers := make(map[string][]string)

	for id, srv := range newGroups {
		if srv == nil || id == "" {
			continue
		}
		local := localMaps[id]
		serverLocal := converter.ServerConversationGroupToLocal(srv)
		if local == nil {
			addedGroup = append(addedGroup, serverLocal)
			if len(serverLocal.ConversationIDs) > 0 {
				addedMembers[serverLocal.ConversationGroupID] = serverLocal.ConversationIDs
			}
			continue
		}
		changed := local.Name != serverLocal.Name ||
			local.Serial != serverLocal.Serial ||
			local.Version != serverLocal.Version ||
			local.Ex != serverLocal.Ex ||
			local.ConversationGroupType != serverLocal.ConversationGroupType ||
			local.Hidden != serverLocal.Hidden
		if changed {
			updatedGroup = append(updatedGroup, serverLocal)
		}

		cAddedMember, cDelMember := diffStringSlices(localMemberSnapshot[serverLocal.ConversationGroupID], serverLocal.ConversationIDs)
		if len(cAddedMember) > 0 {
			addedMembers[serverLocal.ConversationGroupID] = cAddedMember
		}
		if len(cDelMember) > 0 {
			deletedMembers[serverLocal.ConversationGroupID] = cDelMember
		}
	}
	if fullSync {
		for id, local := range localMaps {
			if local == nil || id == "" {
				continue
			}
			// avoid deleting preset filter groups
			if local.ConversationGroupType == constant.ConversationGroupTypeFilter {
				continue
			}
			if _, ok := newGroups[id]; !ok {
				deletedGroup = append(deletedGroup, local)
				if len(localMemberSnapshot[id]) > 0 {
					deletedMembers[id] = localMemberSnapshot[id]
				}
			}
		}
	}
	return addedGroup, deletedGroup, updatedGroup, addedMembers, deletedMembers
}

func diffStringSlices(local, server []string) (added, deleted []string) {
	localSet := make(map[string]struct{}, len(local))
	for _, v := range local {
		if v == "" {
			continue
		}
		localSet[v] = struct{}{}
	}

	serverSet := make(map[string]struct{}, len(server))
	for _, v := range server {
		if v == "" {
			continue
		}
		serverSet[v] = struct{}{}
	}

	// server - local
	for v := range serverSet {
		if _, ok := localSet[v]; !ok {
			added = append(added, v)
		}
	}
	// local - server
	for v := range localSet {
		if _, ok := serverSet[v]; !ok {
			deleted = append(deleted, v)
		}
	}

	sort.Strings(added)
	sort.Strings(deleted)
	return
}

func (c *Conversation) syncConversationGroupMembers(ctx context.Context, members map[string][]string) error {
	if len(members) == 0 {
		return nil
	}
	for groupID, conversationIDs := range members {
		if groupID == "" {
			continue
		}
		if err := c.db.DeleteConversationGroupMembersByGroupIdDB(ctx, groupID); err != nil {
			return err
		}
		if len(conversationIDs) == 0 {
			continue
		}
		seen := make(map[string]struct{}, len(conversationIDs))
		for _, conversationID := range conversationIDs {
			if conversationID == "" {
				continue
			}
			if _, ok := seen[conversationID]; ok {
				continue
			}
			seen[conversationID] = struct{}{}
			if err := c.db.AddConversationGroupMembersDB(ctx, conversationID, []string{groupID}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *Conversation) applyConversationGroupChanges(ctx context.Context, incomingGroups []*sdkws.ConversationGroup) error {
	c.conversationGroupSyncMutex.Lock()
	defer c.conversationGroupSyncMutex.Unlock()
	localGroupSnapshot, err := c.db.GetAllConversationGroupsDB(ctx)
	if err != nil {
		return err
	}
	localGroupMemberSnapshot := make(map[string][]string, len(localGroupSnapshot))
	for _, group := range localGroupSnapshot {
		if group == nil {
			continue
		}
		if group.ConversationGroupType == constant.ConversationGroupTypeFilter {
			continue
		}
		conversationIDs, err := c.db.GetConversationIDsByGroupIdDB(ctx, group.ConversationGroupID)
		if err != nil {
			return err
		}
		localGroupMemberSnapshot[group.ConversationGroupID] = conversationIDs
	}

	groupIDs := make([]string, 0, len(incomingGroups))
	for _, group := range incomingGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		groupIDs = append(groupIDs, group.ConversationGroupID)
	}
	// avoid c.db.GetConversationGroupsDB returns all the data
	if len(groupIDs) == 0 {
		return nil
	}
	localGroups, err := c.getLocalConversationGroups(ctx, groupIDs)
	if err != nil {
		return err
	}
	localGroupsMap := datautil.SliceToMap(localGroups, func(e *model_struct.LocalConversationGroup) string {
		return e.ConversationGroupID
	})

	deletedGroupIDs := make([]string, 0)
	deletedSnapshots := make([]*model_struct.LocalConversationGroup, 0)
	changes := make([]*model_struct.LocalConversationGroup, 0)
	for _, group := range incomingGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		local := localGroupsMap[group.ConversationGroupID]
		if group.IsDeleted {
			if local != nil {
				if local.ConversationGroupType == constant.ConversationGroupTypeFilter {
					log.ZError(ctx, "trying delete of preset groups, which is not allowed.", errs.ErrInternalServer)
				}
				deletedGroupIDs = append(deletedGroupIDs, group.ConversationGroupID)
				deletedSnapshots = append(deletedSnapshots, local)
				c.onConversationGroupDeleted(ctx, []*model_struct.LocalConversationGroup{local})
			} else {
				log.ZWarn(ctx, "Trying to delete an not existed conversation group, ignored...", errs.ErrRecordNotFound)
				continue
			}
			err := c.db.DeleteConversationGroupDB(ctx, group.ConversationGroupID)
			if err != nil {
				return err
			}
		} else {
			changes = append(changes, local)
		}
	}

	if err := c.db.UpsertConversationGroupsDB(ctx, changes); err != nil {
		return err
	}
	groupMembers := make(map[string][]string)
	for _, group := range incomingGroups {
		groupMembers[group.ConversationGroupID] = group.ConversationIDs
	}

	if err := c.syncConversationGroupMembers(ctx, groupMembers); err != nil {
		return err
	}
	updatedGroups, err := c.db.GetConversationGroupsDB(ctx, groupIDs)
	if err != nil {
		return err
	}
	for _, group := range updatedGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		group.ConversationIDs = groupMembers[group.ConversationGroupID]
	}
	c.applyConversationGroupCacheChanges(updatedGroups, deletedGroupIDs)
	for _, group := range updatedGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		localData, err := c.getLocalConversationGroup(ctx, group.ConversationGroupID)
		if err != nil {
			return err
		}
		c.onConversationGroupUpdated(ctx, []*model_struct.LocalConversationGroup{localData})
	}
	memberAdds := make(map[string][]string)
	memberRemoves := make(map[string][]string)
	for groupID, conversationIDs := range groupMembers {
		if localGroupMemberSnapshot[groupID] == nil {
			continue
		}
		memberRemoves[groupID] = slices.DeleteFunc(localGroupMemberSnapshot[groupID], func(id string) bool {
			return datautil.IndexOf(id, conversationIDs...) != -1
		})
		memberAdds[groupID] = slices.DeleteFunc(conversationIDs, func(id string) bool {
			return datautil.IndexOf(id, localGroupMemberSnapshot[groupID]...) != -1
		})
	}
	c.notifyConversationGroupMemberChanges(ctx, memberAdds, memberRemoves)
	return nil
}

func (c *Conversation) upsertConversationGroup(ctx context.Context, group *pbConversation.ConversationGroup) error {
	localGroup := converter.ServerConversationGroupToLocal(group)
	if localGroup == nil {
		return nil
	}
	if err := c.db.UpsertConversationGroupsDB(ctx, []*model_struct.LocalConversationGroup{localGroup}); err != nil {
		return err
	}
	if group.ConversationIDs != nil && len(group.ConversationIDs) > 0 {
		for _, id := range group.ConversationIDs {
			err := c.db.AddConversationGroupMembersDB(ctx, id, []string{group.ConversationGroupID})
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *Conversation) updateConversationGroupSerials(ctx context.Context, orders []*pbConversation.ConversationGroupOrder) error {
	for _, order := range orders {
		if err := c.db.UpdateConversationGroupSerialDB(ctx, order.ConversationGroupID, order.Order); err != nil {
			return err
		}
	}
	return nil
}

func (c *Conversation) batchFetchConversationGroups(ctx context.Context, groupIDs []string) error {
	if len(groupIDs) == 0 {
		return nil
	}
	_, err := c.getLocalConversationGroups(ctx, groupIDs)
	return err
}

func (c *Conversation) CreateConversationGroup(ctx context.Context, req *sdk_params_callback.CreateConversationGroupReq) (*pbConversation.ConversationGroup, error) {
	resp, err := c.createConversationGroup(ctx, req.Name, req.Order, req.ConversationGroupType, req.Ex, req.ConversationID)
	if err != nil {
		return nil, err
	}
	c.triggerConversationGroupSync(ctx)
	return resp.Group, nil
}
func (c *Conversation) UpdateConversationGroup(ctx context.Context, req *sdk_params_callback.UpdateConversationGroupReq) (*pbConversation.ConversationGroup, error) {
	if !c.checkConversationGroupExists(ctx, req.ConversationGroupID) {
		// if this group not exists in local, then create it(only in filter group will succuss).
		newGroupID, err := c.ensureFilterGroupOnServer(ctx, req.ConversationGroupID)
		if err != nil {
			return nil, err
		}
		req.ConversationGroupID = newGroupID
	}

	resp, err := c.updateConversationGroup(ctx, req.ConversationGroupID, req.Name, req.Ex, req.Hidden)
	if err != nil {
		return &pbConversation.ConversationGroup{}, err
	}
	c.triggerConversationGroupSync(ctx)
	return resp.Group, nil
}

func (c *Conversation) DeleteConversationGroup(ctx context.Context, groupID string) error {
	// to avoid filter group to be deleted, this behavior will be rewritten.Now it will set hidden == true when type=filter
	if c.isFilterConversationGroupByID(groupID) {
		if !c.checkConversationGroupExists(ctx, groupID) {
			// if this group not exists in local, then create it(only in filter group will succuss).
			newGroupID, err := c.ensureFilterGroupOnServer(ctx, groupID)
			if err != nil {
				return err
			}
			// im-server may return a different id in some time
			groupID = newGroupID
		}
		_, err := c.updateConversationGroup(ctx, groupID, nil, nil, wrapperspb.Bool(true))
		if err != nil {
			return err
		}
		c.triggerConversationGroupSync(ctx)
	} else {
		// delete
		err := c.deleteConversationGroup(ctx, groupID)
		if err != nil {
			return err
		}
		c.triggerConversationGroupSync(ctx)
	}
	return nil
}

func (c *Conversation) GetConversationGroups(ctx context.Context, conversationGroupType int64) ([]*model_struct.LocalConversationGroup, error) {
	_ = c.SyncConversationGroups(ctx)
	switch conversationGroupType {
	case constant.ConversationGroupQueryAll:
		localGroups, err := c.listAllConversationGroupsFromLocal(ctx)
		if err != nil {
			return []*model_struct.LocalConversationGroup{}, err
		}
		return c.addNotLoadedLazyLoadConversationGroups(ctx, localGroups)
	case constant.ConversationGroupQueryNormal:
		localGroups, err := c.listAllConversationGroupsFromLocal(ctx)
		if err != nil {
			return []*model_struct.LocalConversationGroup{}, err
		}
		localGroups = datautil.Filter(localGroups, func(e *model_struct.LocalConversationGroup) (*model_struct.LocalConversationGroup, bool) {
			if e.ConversationGroupType == constant.ConversationGroupTypeFilter {
				return nil, false
			}
			return e, true
		})
		return localGroups, nil
	case constant.ConversationGroupQueryFilter:
		local, err := c.listFilterConversationGroups(ctx)
		if err != nil {
			return []*model_struct.LocalConversationGroup{}, err
		}
		return c.addNotLoadedLazyLoadConversationGroups(ctx, local)
	default:
		return []*model_struct.LocalConversationGroup{}, errs.ErrArgs.WrapMsg("unknown get type")
	}

}

func (c *Conversation) listAllConversationGroupsFromLocal(ctx context.Context) (result []*model_struct.LocalConversationGroup, err error) {
	_ = c.SyncConversationGroups(ctx)
	result = c.cachedConversationGroups()
	if result == nil {
		result = make([]*model_struct.LocalConversationGroup, 0)
	}
	return c.sortConversationGroups(ctx, result), nil
}

func (c *Conversation) listConversationGroupsFromLocal(ctx context.Context, groupIDs []string) (result []*model_struct.LocalConversationGroup, err error) {
	result, _ = c.cachedConversationGroupsByIDs(groupIDs)
	if result == nil {
		result = make([]*model_struct.LocalConversationGroup, 0)
	}
	return c.sortConversationGroups(ctx, result), nil
}

func (c *Conversation) countUnreadNumber(ctx context.Context, conversationIDs []string) (count int32, err error) {
	if conversationIDs == nil {
		return 0, nil
	}
	conversationCount, err := c.db.GetConversationUnreadCountMap(ctx, conversationIDs)
	if err != nil {
		return 0, err
	}
	count = 0
	for k, v := range conversationCount {
		if v < 0 {
			log.ZWarn(ctx, "Trying get conversation unread copunt, but found negative values.", errs.ErrInternalServer,
				"unreadCount", v, "conversationID", k)
			continue
		}
		count += v
	}
	return count, nil
}

func (c *Conversation) addNotLoadedLazyLoadConversationGroups(ctx context.Context, origin []*model_struct.LocalConversationGroup) ([]*model_struct.LocalConversationGroup, error) {
	// before this operation, origin must be serialized.
	shouldLoadedGroupNames := c.filterConversationGroupNames
	var shouldAddedGroups []*model_struct.LocalConversationGroup
	var list []*model_struct.LocalConversation
	for i, shouldGroupName := range shouldLoadedGroupNames {
		if c.hasLoadedPresetFilterGroup(origin, shouldGroupName) {
			continue
		}
		// firstly, got conversation list for build the pb.
		conversationList, err := c.getFilterGroupConversation(ctx, shouldGroupName, &list)
		if err != nil {
			return []*model_struct.LocalConversationGroup{}, err
		}
		// not exists lazy loaded group, should add.
		number, err := c.countUnreadNumber(ctx, conversationList)
		if err != nil {
			return []*model_struct.LocalConversationGroup{}, err
		}
		if conversationList == nil {
			conversationList = []string{}
		}
		shouldAddedGroups = append(shouldAddedGroups, &model_struct.LocalConversationGroup{
			ConversationGroupID:   shouldGroupName,
			Name:                  presetFilterGroupName(shouldGroupName),
			Serial:                int64(i + 1),
			ConversationGroupType: constant.ConversationGroupTypeFilter,
			UnreadCount:           number,
			ConversationIDs:       conversationList,
		})
	}
	return c.sortConversationGroups(ctx, append(shouldAddedGroups, origin...)), nil
}

func (c *Conversation) sortConversationGroups(ctx context.Context, groups []*model_struct.LocalConversationGroup) []*model_struct.LocalConversationGroup {
	var sortQueueNormal []*model_struct.LocalConversationGroup
	var sortQueueFilter []*model_struct.LocalConversationGroup
	for _, group := range groups {
		if group.ConversationGroupType == constant.ConversationGroupTypeNormal {
			sortQueueNormal = append(sortQueueNormal, group)
		} else if group.ConversationGroupType == constant.ConversationGroupTypeFilter {
			sortQueueFilter = append(sortQueueFilter, group)
		} else {
			log.ZWarn(ctx, "Unknown ConversationGroup Type Found!", errs.ErrArgs)
		}
	}
	datautil.SortAny(sortQueueNormal, func(a, b *model_struct.LocalConversationGroup) bool {
		return a.Serial < b.Serial
	})
	datautil.SortAny(sortQueueFilter, func(a, b *model_struct.LocalConversationGroup) bool {
		return a.Serial < b.Serial
	})
	return append(sortQueueFilter, sortQueueNormal...)
}

func presetFilterGroupName(groupID string) string {
	return strings.TrimPrefix(groupID, "i_")
}

func (c *Conversation) hasLoadedPresetFilterGroup(origin []*model_struct.LocalConversationGroup, presetGroupID string) bool {
	presetName := presetFilterGroupName(presetGroupID)
	for _, localGroup := range origin {
		if localGroup == nil || localGroup.ConversationGroupType != constant.ConversationGroupTypeFilter {
			continue
		}
		if localGroup.ConversationGroupID == presetGroupID {
			return true
		}
		if localGroup.Name == presetName {
			return true
		}
	}
	return false
}

func (c *Conversation) avaliableFilterNames() []string {
	return []string{constant.ConversationGroupFilterNameUnread, constant.ConversationGroupFilterNameMarked, constant.ConversationGroupFilterNameMentionMe, constant.ConversationGroupFilterNameSingleChat, constant.ConversationGroupFilterNameGroupChat, constant.ConversationGroupFilterNamePinned}
}

func (c *Conversation) normalizeConversationGroupOrders(ctx context.Context, orders []*pbConversation.ConversationGroupOrder) ([]*pbConversation.ConversationGroupOrder, error) {
	if len(orders) == 0 {
		return orders, nil
	}
	normalized := make([]*pbConversation.ConversationGroupOrder, 0, len(orders))
	indexByID := make(map[string]int, len(orders))
	for _, order := range orders {
		if order == nil || order.ConversationGroupID == "" {
			continue
		}
		if idx, ok := indexByID[order.ConversationGroupID]; ok {
			normalized[idx].Order = order.Order
			continue
		}
		clone := *order
		indexByID[order.ConversationGroupID] = len(normalized)
		normalized = append(normalized, &clone)
	}
	if len(normalized) == 0 {
		return normalized, nil
	}

	localGroups, err := c.db.GetAllConversationGroupsDB(ctx)
	if err != nil {
		return nil, err
	}
	if len(localGroups) == 0 || hasDuplicateGroupSerial(localGroups) {
		if syncErr := c.SyncConversationGroups(ctx); syncErr != nil {
			log.ZWarn(ctx, "SyncConversationGroups before order normalize failed", syncErr)
		} else {
			localGroups, err = c.db.GetAllConversationGroupsDB(ctx)
			if err != nil {
				return nil, err
			}
		}
	}

	targetIDs := make(map[string]struct{}, len(normalized))
	for _, order := range normalized {
		targetIDs[order.ConversationGroupID] = struct{}{}
	}
	used := make(map[int64]struct{})
	maxOrder := int64(0)
	for _, group := range localGroups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		if group.Serial > maxOrder {
			maxOrder = group.Serial
		}
		if _, ok := targetIDs[group.ConversationGroupID]; ok {
			continue
		}
		used[group.Serial] = struct{}{}
	}
	for _, order := range normalized {
		order.Order = resolveConversationGroupOrder(order.Order, used, maxOrder)
		used[order.Order] = struct{}{}
		if order.Order > maxOrder {
			maxOrder = order.Order
		}
	}
	return normalized, nil
}

func (c *Conversation) checkConversationGroupExists(ctx context.Context, conversationGroupID string) bool {
	localGroup, _ := c.db.GetGroupInfoByGroupID(ctx, conversationGroupID)
	if localGroup == nil {
		return false
	} else if localGroup.GroupID == conversationGroupID {
		return true
	}
	return false
}

func resolveConversationGroupOrder(order int64, used map[int64]struct{}, maxOrder int64) int64 {
	if _, ok := used[order]; !ok {
		return order
	}
	next := order
	if next <= 0 && maxOrder > 0 {
		next = maxOrder
	}
	for {
		next++
		if _, ok := used[next]; !ok {
			return next
		}
	}
}

func hasDuplicateGroupSerial(groups []*model_struct.LocalConversationGroup) bool {
	seen := make(map[int64]struct{}, len(groups))
	for _, group := range groups {
		if group == nil {
			continue
		}
		if _, ok := seen[group.Serial]; ok {
			return true
		}
		seen[group.Serial] = struct{}{}
	}
	return false
}

func (c *Conversation) SetConversationGroupOrder(ctx context.Context, orders []*pbConversation.ConversationGroupOrder) error {
	for _, order := range orders {
		if order == nil || order.ConversationGroupID == "" {
			continue
		}
		newID, err := c.ensureFilterGroupOnServer(ctx, order.ConversationGroupID)
		if err != nil {
			return err
		}
		if newID != "" {
			order.ConversationGroupID = newID
		}
	}
	normalizedOrders, err := c.normalizeConversationGroupOrders(ctx, orders)
	if err != nil {
		return err
	}
	if err := c.setConversationGroupOrder(ctx, normalizedOrders); err != nil {
		return err
	}
	c.triggerConversationGroupSync(ctx)
	return nil
}

func (c *Conversation) AddConversationsToGroups(ctx context.Context, conversationIDs []string, groupIDs []string) error {
	uniqueConversationIDs := datautil.Distinct(conversationIDs)
	if len(uniqueConversationIDs) == 0 {
		return errs.New("conversationIDs is empty")
	}
	if err := c.addConversationsToGroups(ctx, groupIDs, uniqueConversationIDs); err != nil {
		return err
	}
	c.triggerConversationGroupSync(ctx)
	return nil
}

func (c *Conversation) RemoveConversationsFromGroups(ctx context.Context, conversationIDs []string, groupID []string) error {
	uniqueConversationIDs := datautil.Distinct(conversationIDs)
	if len(uniqueConversationIDs) == 0 {
		return errors.New("conversationIDs is empty")
	}
	if err := c.removeConversationsFromGroups(ctx, groupID, uniqueConversationIDs); err != nil {
		return err
	}
	c.triggerConversationGroupSync(ctx)
	return nil
}

func (c *Conversation) GetConversationGroupIDsByConversationID(ctx context.Context, conversationID string) ([]string, error) {
	groupIDs, err := c.db.GetConversationGroupIDsByConversationIdDB(ctx, conversationID)
	if err != nil {
		return []string{}, err
	}
	return groupIDs, nil
}
func (c *Conversation) GetConversationGroupByConversationID(ctx context.Context, conversationID string) ([]*model_struct.LocalConversationGroup, error) {
	groupIDs, err := c.GetConversationGroupIDsByConversationID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		return []*model_struct.LocalConversationGroup{}, nil
	}
	return c.GetMultipleConversationGroups(ctx, groupIDs)
}

func (c *Conversation) GetMultipleConversationGroups(ctx context.Context, conversationIDs []string) ([]*model_struct.LocalConversationGroup, error) {
	return c.getLocalConversationGroups(ctx, conversationIDs)
}

func (c *Conversation) GetConversationGroupInfoWithConversations(ctx context.Context,
	req *sdk_params_callback.GetConversationGroupInfoWithConversationsReq) (
	result *sdk_params_callback.GetConversationGroupInfoWithConversationsResp, err error) {
	localGroup, err := c.getLocalConversationGroup(ctx, req.ConversationGroupID)
	if err != nil {
		return nil, err
	}
	if localGroup == nil {
		return &sdk_params_callback.GetConversationGroupInfoWithConversationsResp{
			ConversationElems: []*model_struct.LocalConversation{},
		}, nil
	}
	var conversationList []*model_struct.LocalConversation
	if localGroup.ConversationIDs == nil {
		localGroup.ConversationIDs = []string{}
	} else {
		conversationList, err = c.GetMultipleConversation(ctx, localGroup.ConversationIDs)
		if err != nil {
			return nil, err
		}
	}
	datautil.SortAny(conversationList, func(a, b *model_struct.LocalConversation) bool {
		// true means desc, false means asc
		var SerialFlag = true
		if a.IsPinned && !b.IsPinned {
			return SerialFlag
		} else if !a.IsPinned && b.IsPinned {
			return !SerialFlag
		} else {
			timeA := max(a.LatestMsgSendTime, a.DraftTextTime)
			timeB := max(b.LatestMsgSendTime, b.DraftTextTime)
			if timeA > timeB {
				return SerialFlag
			} else {
				return !SerialFlag
			}
		}
	})

	result = &sdk_params_callback.GetConversationGroupInfoWithConversationsResp{
		Group:             localGroup,
		ConversationTotal: int64(len(conversationList)),
		ConversationElems: conversationList,
	}
	if result.ConversationElems == nil {
		result.ConversationElems = []*model_struct.LocalConversation{}
	}
	return result, nil
}

func (c *Conversation) getLocalConversationGroup(ctx context.Context, groupID string) (result *model_struct.LocalConversationGroup, err error) {
	if cached, ok := c.cachedConversationGroup(groupID); ok {
		return cached, nil
	}
	result, err = c.db.GetConversationGroupDB(ctx, groupID)
	if err == nil && result != nil {
		conversationList, memberErr := c.getConversationIDsByGroupID(ctx, groupID)
		if memberErr != nil {
			return nil, memberErr
		}
		result.ConversationIDs = conversationList
		number, unreadErr := c.countUnreadNumber(ctx, conversationList)
		if unreadErr != nil {
			return nil, unreadErr
		}
		result.UnreadCount = number
		if cached, ok := c.cacheConversationGroupSnapshot(result); ok {
			return cached, nil
		}
		return result, nil
	}
	if err != nil && !isRecordNotFoundErr(err) {
		return nil, err
	}
	if cached, ok := c.ensureDefaultFilterConversationGroupCached(groupID); ok {
		return cached, nil
	}
	if err != nil {
		return nil, err
	}
	return nil, nil
}

func (c *Conversation) getLocalConversationGroups(ctx context.Context, groupIDs []string) (results []*model_struct.LocalConversationGroup, err error) {
	results, _ = c.cachedConversationGroupsByIDs(groupIDs)
	if len(results) == len(groupIDs) {
		return results, nil
	}
	results = make([]*model_struct.LocalConversationGroup, 0, len(groupIDs))
	for _, groupID := range groupIDs {
		group, err := c.getLocalConversationGroup(ctx, groupID)
		if err != nil {
			return nil, err
		}
		results = append(results, group)
	}
	return results, nil
}

func calculateConversationGroupMemberDiff(localSnapshot map[string][]string, groups []*model_struct.LocalConversationGroup) (map[string][]string, map[string][]string) {
	addedMembers := make(map[string][]string)
	deletedMembers := make(map[string][]string)
	for _, group := range groups {
		if group == nil || group.ConversationGroupID == "" {
			continue
		}
		added, deleted := diffStringSlices(localSnapshot[group.ConversationGroupID], group.ConversationIDs)
		if len(added) > 0 {
			addedMembers[group.ConversationGroupID] = added
		}
		if len(deleted) > 0 {
			deletedMembers[group.ConversationGroupID] = deleted
		}
	}
	return addedMembers, deletedMembers
}

func (c *Conversation) sortConversationListByGroup(ctx context.Context, resp *sdk_params_callback.GetConversationListByGroupResp) {
	if resp == nil || len(resp.ConversationElems) == 0 {
		return
	}

	ids := make([]string, 0, len(resp.ConversationElems))
	elemByID := make(map[string]*pbConversation.ConversationElem, len(resp.ConversationElems))
	extras := make([]*pbConversation.ConversationElem, 0)
	for _, elem := range resp.ConversationElems {
		if elem == nil || elem.ConversationID == "" {
			extras = append(extras, elem)
			continue
		}
		if _, exists := elemByID[elem.ConversationID]; exists {
			extras = append(extras, elem)
			continue
		}
		elemByID[elem.ConversationID] = elem
		ids = append(ids, elem.ConversationID)
	}
	if len(ids) == 0 {
		return
	}

	localMap := make(map[string]*model_struct.LocalConversation, 0)
	localConversations, err := c.db.GetMultipleConversationDB(ctx, ids)
	if err != nil {
		log.ZWarn(ctx, "GetMultipleConversationDB for conversation group sort failed", err)
	} else {
		localMap = make(map[string]*model_struct.LocalConversation, len(localConversations))
		for _, conv := range localConversations {
			if conv == nil {
				continue
			}
			localMap[conv.ConversationID] = conv
		}
	}

	list := make([]*sort_conversation.ConversationMetaData, 0, len(ids))
	pinnedIDs := make([]string, 0)
	pinnedSet := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		elem := elemByID[id]
		if elem == nil {
			continue
		}
		meta := &sort_conversation.ConversationMetaData{
			ConversationID: id,
		}
		if elem.MsgInfo != nil {
			meta.LatestMsgSendTime = elem.MsgInfo.LatestMsgRecvTime
		}
		if elem.IsPinned {
			meta.IsPinned = true
			if _, ok := pinnedSet[id]; !ok {
				pinnedSet[id] = struct{}{}
				pinnedIDs = append(pinnedIDs, id)
			}
		}
		if local, ok := localMap[id]; ok && local != nil {
			if local.LatestMsgSendTime > 0 {
				meta.LatestMsgSendTime = local.LatestMsgSendTime
			}
			if local.DraftTextTime > 0 {
				meta.DraftTextTime = local.DraftTextTime
			}
			if local.IsPinned {
				meta.IsPinned = true
				if _, ok := pinnedSet[id]; !ok {
					pinnedSet[id] = struct{}{}
					pinnedIDs = append(pinnedIDs, id)
				}
			}
		}
		list = append(list, meta)
	}

	sortList := sort_conversation.NewSortConversationList(list, pinnedIDs)
	sorted := make([]*pbConversation.ConversationElem, 0, len(resp.ConversationElems))
	for _, meta := range sortList.All() {
		elem := elemByID[meta.ConversationID]
		if elem == nil {
			continue
		}
		if meta.IsPinned && !elem.IsPinned {
			elem.IsPinned = true
		}
		sorted = append(sorted, elem)
	}
	if len(extras) > 0 {
		sorted = append(sorted, extras...)
	}
	resp.ConversationElems = sorted
}

func (c *Conversation) isFilterConversationGroupByID(groupID string) bool {
	return datautil.IndexOf(groupID, c.filterConversationGroupNames...) != -1
}

func (c *Conversation) filterGroupIdx(groupID string) int {
	return datautil.IndexOf(groupID, c.filterConversationGroupNames...) + 1
}

// if this group id is not loaded,create it in server.
func (c *Conversation) ensureFilterGroupOnServer(ctx context.Context, groupID string) (string, error) {
	if groupID == "" {
		return "", nil
	}
	c.filterGroupCreateMutex.Lock()
	defer c.filterGroupCreateMutex.Unlock()
	if c.isFilterConversationGroupByID(groupID) && !c.checkConversationGroupExists(ctx, groupID) {
		// according to this groupID ,this must be in local. Should lazy load first.
		resp, err := c.createConversationGroup(ctx, strings.TrimPrefix(groupID, "i_"), int64(c.filterGroupIdx(groupID)),
			pbConversation.ConversationGroupType_ConversationGroupTypeFilter, nil, nil)

		if err != nil {
			return "", err
		}
		err = c.SyncConversationGroups(ctx)
		if err != nil {
			return "", err
		}
		return resp.Group.ConversationGroupID, nil
	} else {
		// no creation needed.
		return groupID, nil
	}

}

func (c *Conversation) listFilterConversationGroups(ctx context.Context) ([]*model_struct.LocalConversationGroup, error) {
	localGroups := c.cachedConversationGroups()
	filtered := make([]*model_struct.LocalConversationGroup, 0)
	for _, group := range localGroups {
		if group == nil || group.ConversationGroupID == "" || group.Hidden {
			continue
		}
		if group.ConversationGroupType != constant.ConversationGroupTypeFilter {
			continue
		}
		filtered = append(filtered, group)
	}
	return filtered, nil
}

func (c *Conversation) SyncConversationGroups(ctx context.Context) error {
	c.conversationGroupSyncMutex.Lock()
	defer c.conversationGroupSyncMutex.Unlock()
	maxVersion, err := c.loadConversationGroupMaxVersion(ctx)
	if err != nil {
		log.ZError(ctx, "Load Local Version Failed", errs.ErrInternalServer.WrapMsg("db failed"))
		return err
	}
	maxV := int64(maxVersion)
	// TODO IM-Server not return this field yet, now reserve it.
	//delVersion, err := c.loadConversationGroupMaxVersion(ctx)
	//if err != nil {
	//	return err
	//}
	resp, err := c.getConversationGroups(ctx, &maxV)
	if err != nil {
		log.ZError(ctx, "Call db getConversationGroups failed!", errs.ErrInternalServer.WrapMsg("getConversationGroups"))
		return err
	}
	fullSync := resp.Full
	if fullSync {
		log.ZInfo(ctx, "Full Sync Is called by server")
	}
	if err := c.syncConversationGroups(ctx, resp.Groups, fullSync); err != nil {
		log.ZError(ctx, "sync failed", errs.Wrap(err))
		return err
	}
	// no matter how, override it.
	return c.saveConversationGroupMaxVersion(ctx, resp.GetMaxVersion())
}

func (c *Conversation) SyncConversationGroupsWithOutEvent(ctx context.Context) error {
	c.conversationGroupSyncMutex.Lock()
	defer c.conversationGroupSyncMutex.Unlock()
	maxVersion, err := c.loadConversationGroupMaxVersion(ctx)
	if err != nil {
		log.ZError(ctx, "Load Local Version Failed", errs.ErrInternalServer.WrapMsg("db failed"))
		return err
	}
	maxV := int64(maxVersion)
	// TODO IM-Server not return this field yet, now reserve it.
	//delVersion, err := c.loadConversationGroupMaxVersion(ctx)
	//if err != nil {
	//	return err
	//}
	resp, err := c.getConversationGroups(ctx, &maxV)
	if err != nil {
		log.ZError(ctx, "Call db getConversationGroups failed!", errs.ErrInternalServer.WrapMsg("getConversationGroups"))
		return err
	}
	fullSync := resp.Full
	localSnapShot, err := c.db.GetAllConversationGroupsDB(ctx)
	if err != nil {
		return err
	}
	if fullSync {
		log.ZInfo(ctx, "full sync is triggered! Cleaning local now.", "stack", debug.Stack())
		// fullSync mode, server should contain a full snapshot, so local will be clean
		// DeleteAllConversationGroupDB will not remove conversationType=1
		err = c.db.DeleteAllConversationGroupDB(ctx)
		if err != nil {
			return err
		}
		for _, group := range localSnapShot {
			_ = c.db.DeleteConversationGroupMembersByGroupIdDB(ctx, group.ConversationGroupID)
		}
	}

	//every struct in here is changes,so if no delete,just up/sert it.
	groups := resp.Groups
	serverGroups := converter.ServerConversationGroupsToLocal(groups)
	if serverGroups == nil {
		log.ZDebug(ctx, "sync conversation group is no updates")
		return nil
	}
	err = c.db.UpsertConversationGroupsDB(ctx, serverGroups)
	if err != nil {
		return err
	}
	for _, group := range serverGroups {
		for _, con := range group.ConversationIDs {
			err := c.db.AddConversationGroupMembersDB(ctx, con, []string{group.ConversationGroupID})
			if err != nil {
				return err
			}
		}
	}
	c.applyServerConversationGroupsToCache(serverGroups, fullSync)
	return c.saveConversationGroupMaxVersion(ctx, resp.GetMaxVersion())
}

func (c *Conversation) loadConversationGroupMaxVersion(ctx context.Context) (uint64, error) {
	sync, err := c.db.GetVersionSync(ctx, c.conversationGroupVersionTableName(), c.loginUserID)
	if err != nil {
		if errs.ErrRecordNotFound.Is(err) || errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return sync.Version, nil
}

// reserved for im-server someday returns del Version field
func (c *Conversation) loadConversationGroupDelVersion(ctx context.Context) (uint64, error) {
	sync, err := c.db.GetVersionSync(ctx, c.conversationGroupDeletedVersionTableName(), c.loginUserID)
	if err != nil {
		if errs.ErrRecordNotFound.Is(err) || errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return sync.Version, nil
}

func (c *Conversation) saveConversationGroupMaxVersion(ctx context.Context, maxVersion int64) error {
	if maxVersion <= 0 {
		return c.db.DeleteVersionSync(ctx, c.conversationGroupVersionTableName(), c.loginUserID)
	}
	return c.db.SetVersionSync(ctx, &model_struct.LocalVersionSync{
		Table:    c.conversationGroupVersionTableName(),
		EntityID: c.loginUserID,
		Version:  uint64(maxVersion),
	})
}

func (c *Conversation) conversationGroupVersionTableName() string {
	return model_struct.LocalConversationGroup{}.TableName()
}

func (c *Conversation) conversationGroupDeletedVersionTableName() string {
	return model_struct.LocalConversationGroup{}.TableName() + "_deleted"
}

func (c *Conversation) triggerConversationGroupSync(ctx context.Context) {
	if err := c.SyncConversationGroups(ctx); err != nil {
		log.ZWarn(ctx, "SyncConversationGroups after local change err", err)
	}
}

func (c *Conversation) onConversationGroupAdded(ctx context.Context, group []*model_struct.LocalConversationGroup) {
	if group == nil {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	groupListener.OnConversationGroupAdded(utils.StructToJsonStringDefault(group))
}

func (c *Conversation) onConversationGroupUpdated(ctx context.Context, group []*model_struct.LocalConversationGroup) {
	if group == nil {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	groupListener.OnConversationGroupChanged(utils.StructToJsonStringDefault(group))
}

func (c *Conversation) onConversationGroupDeleted(ctx context.Context, group []*model_struct.LocalConversationGroup) {
	if group == nil {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	groupListener.OnConversationGroupDeleted(utils.StructToJsonStringDefault(group))
}

func (c *Conversation) onConversationGroupMemberAdded(ctx context.Context, groupID string, conversationIDs []string) {
	if groupID == "" {
		return
	}
	normalized := normalizeConversationIDs(conversationIDs)
	if len(normalized) == 0 {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	snapshot := c.snapshotConversationGroup(ctx, groupID, &model_struct.LocalConversationGroup{
		ConversationGroupID: groupID,
		ConversationIDs:     append([]string(nil), normalized...),
	})
	if snapshot == nil {
		snapshot = &model_struct.LocalConversationGroup{
			ConversationGroupID: groupID,
			ConversationIDs:     append([]string(nil), normalized...),
		}
	}
	conversations, err := c.getConversationDetails(ctx, normalized)
	if err != nil {
		log.ZWarn(ctx, "getConversationDetails for group member add failed", err, "groupID", groupID)
	}
	payload := &sdk_params_callback.ConversationGroupMemberChangedCallback{
		Group:           snapshot,
		ConversationIDs: normalized,
		Conversations:   conversations,
	}
	groupListener.OnConversationGroupMemberAdded(utils.StructToJsonStringDefault(payload))
}

func (c *Conversation) onConversationGroupMemberDeleted(ctx context.Context, groupID string, conversationIDs []string) {
	if groupID == "" {
		return
	}
	normalized := normalizeConversationIDs(conversationIDs)
	if len(normalized) == 0 {
		return
	}
	groupListener := c.conversationGroupListenerVar()
	snapshot := c.snapshotConversationGroup(ctx, groupID, &model_struct.LocalConversationGroup{
		ConversationGroupID: groupID,
		ConversationIDs:     append([]string(nil), normalized...),
	})
	if snapshot == nil {
		snapshot = &model_struct.LocalConversationGroup{
			ConversationGroupID: groupID,
			ConversationIDs:     append([]string(nil), normalized...),
		}
	}
	conversations, err := c.getConversationDetails(ctx, normalized)
	if err != nil {
		log.ZWarn(ctx, "getConversationDetails for group member delete failed", err, "groupID", groupID)
	}
	payload := &sdk_params_callback.ConversationGroupMemberChangedCallback{
		Group:           snapshot,
		ConversationIDs: normalized,
		Conversations:   conversations,
	}
	groupListener.OnConversationGroupMemberDeleted(utils.StructToJsonStringDefault(payload))
}

func (c *Conversation) onConversationGroupOrderUpdated(ctx context.Context, orders []*pbConversation.ConversationGroupOrder) {
	if len(orders) == 0 {
		return
	}
	for _, order := range orders {
		if order == nil || order.ConversationGroupID == "" {
			continue
		}
		snapshot := c.snapshotConversationGroup(ctx, order.ConversationGroupID, nil)
		if snapshot == nil {
			continue
		}
		c.onConversationGroupUpdated(ctx, []*model_struct.LocalConversationGroup{snapshot})
	}
}

func (c *Conversation) notifyConversationGroupMemberChanges(ctx context.Context, added, removed map[string][]string) {
	for groupID, ids := range added {
		if ids != nil && len(ids) > 0 {
			c.onConversationGroupMemberAdded(ctx, groupID, ids)
		}
	}
	for groupID, ids := range removed {
		if ids != nil && len(ids) > 0 {
			c.onConversationGroupMemberDeleted(ctx, groupID, ids)
		}
	}
}

func (c *Conversation) getFilterGroupConversation(ctx context.Context, groupName string, list *[]*model_struct.LocalConversation) (result []string, err error) {
	if cached, ok := c.getCachedFilterGroupConversation(groupName); ok {
		return cached, nil
	}
	if list == nil || *list == nil {
		val, err := c.db.GetAllConversationListDB(ctx)
		if err != nil {
			return nil, err
		}
		if list == nil {
			list = &val
		} else {
			*list = val
		}
	}
	for _, conversation := range *list {
		switch groupName {
		case constant.ConversationGroupFilterNameUnread:
			if conversation.UnreadCount != 0 {
				result = append(result, conversation.ConversationID)
			}
		case constant.ConversationGroupFilterNameSingleChat:
			if conversation.GroupID == "" {
				result = append(result, conversation.ConversationID)
			}
		case constant.ConversationGroupFilterNameMentionMe:
			if conversation.GroupAtType != constant.AtNormal {
				result = append(result, conversation.ConversationID)
			}
		case constant.ConversationGroupFilterNameMarked:
			if conversation.IsMarked == true {
				result = append(result, conversation.ConversationID)
			}
		case constant.ConversationGroupFilterNameGroupChat:
			if conversation.GroupID != "" {
				result = append(result, conversation.ConversationID)
			}
		case constant.ConversationGroupFilterNamePinned:
			if conversation.IsPinned {
				result = append(result, conversation.ConversationID)
			}
		}
	}
	return
}

func (c *Conversation) isFilterConversationGroupByDB(ctx context.Context, groupID string) (bool, error) {
	localDB, err := c.db.GetConversationGroupDB(ctx, groupID)
	if err != nil {
		return false, err
	}
	if localDB != nil && localDB.ConversationGroupType == constant.ConversationGroupTypeFilter {
		return true, nil
	}
	return false, nil

}
func (c *Conversation) getConversationIDsByGroupID(ctx context.Context, groupID string) ([]string, error) {
	if cached, ok := c.cachedConversationGroupMembers(groupID); ok {
		return cached, nil
	}
	if c.isFilterConversationGroupByID(groupID) {
		if snapshot, ok := c.ensureDefaultFilterConversationGroupCached(groupID); ok {
			return append([]string(nil), snapshot.ConversationIDs...), nil
		}
		return []string{}, nil
	}
	isFilter, err := c.isFilterConversationGroupByDB(ctx, groupID)
	if err != nil {
		return nil, err
	}
	if isFilter {
		return c.getFilterGroupConversation(ctx, groupID, nil)
	}
	conversationIDs, err := c.db.GetConversationIDsByGroupIdDB(ctx, groupID)
	if err != nil {
		if errs.ErrRecordNotFound.Is(err) || errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return conversationIDs, nil
}

func normalizeConversationIDs(conversationIDs []string) []string {
	if conversationIDs == nil {
		return nil
	}
	seen := make(map[string]struct{}, len(conversationIDs))
	normalized := make([]string, 0, len(conversationIDs))
	for _, conversationID := range conversationIDs {
		if conversationID == "" {
			continue
		}
		if _, ok := seen[conversationID]; ok {
			continue
		}
		seen[conversationID] = struct{}{}
		normalized = append(normalized, conversationID)
	}
	return normalized
}

func (c *Conversation) snapshotConversationGroup(ctx context.Context, groupID string, fallback *model_struct.LocalConversationGroup) *model_struct.LocalConversationGroup {
	if groupID == "" && fallback != nil {
		groupID = fallback.ConversationGroupID
	}
	if groupID != "" {
		local, err := c.getLocalConversationGroup(ctx, groupID)
		if err == nil && local != nil {
			return local
		}
		if err != nil && !isRecordNotFoundErr(err) {
			log.ZWarn(ctx, "getLocalConversationGroup for snapshot failed", err, "groupID", groupID)
		}
	}
	if fallback == nil {
		return nil
	}
	clone := *fallback
	return &clone
}

func (c *Conversation) getConversationDetails(ctx context.Context, conversationIDs []string) ([]*model_struct.LocalConversation, error) {
	normalized := normalizeConversationIDs(conversationIDs)
	if len(normalized) == 0 {
		return nil, nil
	}
	conversations, err := c.db.GetMultipleConversationDB(ctx, normalized)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]*model_struct.LocalConversation, len(conversations))
	for _, conversation := range conversations {
		if conversation == nil || conversation.ConversationID == "" {
			continue
		}
		byID[conversation.ConversationID] = conversation
	}
	result := make([]*model_struct.LocalConversation, 0, len(normalized))
	for _, id := range normalized {
		if conversation, ok := byID[id]; ok {
			result = append(result, conversation)
		}
	}
	return result, nil
}

func isRecordNotFoundErr(err error) bool {
	if err == nil {
		return false
	}
	var codeErr errs.CodeError
	if errors.As(err, &codeErr) && codeErr.Code() == errs.RecordNotFoundError {
		return true
	}
	return false
}
