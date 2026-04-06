//go:build !js
// +build !js

package db

import (
	"context"
	"errors"

	"gorm.io/gorm/clause"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/errs"
)

func (d *DataBase) InsertConversationGroupDB(ctx context.Context, group *model_struct.LocalConversationGroup) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	return errs.WrapMsg(d.conn.WithContext(ctx).Create(group).Error, "InsertConversationGroupDB failed")
}

func (d *DataBase) BatchInsertConversationGroupsDB(ctx context.Context, groups []*model_struct.LocalConversationGroup) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	if groups == nil {
		return errs.New("nil").Wrap()
	}
	return errs.WrapMsg(d.conn.WithContext(ctx).Create(groups).Error, "BatchInsertConversationGroupsDB failed")
}

func (d *DataBase) UpsertConversationGroupsDB(ctx context.Context, groups []*model_struct.LocalConversationGroup) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	if len(groups) == 0 {
		return nil
	}
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "conversation_group_id"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"name",
					"serial",
					"version",
					"ex",
					"conversation_group_type",
					"hidden",
				}),
			}).
			Create(groups).Error,
		"UpsertConversationGroupsDB failed",
	)
}

func (d *DataBase) UpdateConversationGroupDB(ctx context.Context, group *model_struct.LocalConversationGroup) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	t := d.conn.WithContext(ctx).Model(group).Select("*").Updates(*group)
	if t.RowsAffected == 0 {
		return errs.WrapMsg(errors.New("RowsAffected == 0"), "no update")
	}
	return errs.Wrap(t.Error)
}

func (d *DataBase) DeleteConversationGroupDB(ctx context.Context, groupID string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Where("conversation_group_id=?", groupID).
			Delete(&model_struct.LocalConversationGroup{}).Error,
		"DeleteConversationGroupDB failed",
	)
}

func (d *DataBase) DeleteAllConversationGroupDB(ctx context.Context) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Where("conversation_group_type !=1").
			Delete(&model_struct.LocalConversationGroup{}).Error,
		"DeleteAllConversationGroupDB failed")
}

func (d *DataBase) GetConversationGroupDB(ctx context.Context, groupID string) (*model_struct.LocalConversationGroup, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()
	var group model_struct.LocalConversationGroup
	return &group, errs.WrapMsg(
		d.conn.WithContext(ctx).
			Where("conversation_group_id=?", groupID).
			Take(&group).Error,
		"GetConversationGroupDB failed",
	)
}

func (d *DataBase) GetConversationGroupsDB(ctx context.Context, groupIDs []string) ([]*model_struct.LocalConversationGroup, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()
	var groups []*model_struct.LocalConversationGroup
	db := d.conn.WithContext(ctx)
	if len(groupIDs) > 0 {
		db = db.Where("conversation_group_id IN ?", groupIDs)
	}
	return groups, errs.WrapMsg(db.Order("serial ASC").Find(&groups).Error, "GetConversationGroupsDB failed")
}

func (d *DataBase) GetAllConversationGroupsDB(ctx context.Context) ([]*model_struct.LocalConversationGroup, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()
	var groups []*model_struct.LocalConversationGroup
	db := d.conn.WithContext(ctx)
	return groups, errs.WrapMsg(db.Order("serial ASC").Find(&groups).Error, "GetConversationGroupsDB failed")
}

func (d *DataBase) UpdateConversationGroupSerialDB(ctx context.Context, groupID string, serial int64) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	t := d.conn.WithContext(ctx).
		Model(&model_struct.LocalConversationGroup{}).
		Where("conversation_group_id=?", groupID).
		Updates(map[string]any{"serial": serial})
	if t.RowsAffected == 0 {
		return errs.WrapMsg(errors.New("RowsAffected == 0"), "no update")
	}
	return errs.Wrap(t.Error)
}

func (d *DataBase) AddConversationGroupMembersDB(ctx context.Context, conversationID string, groupIDs []string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	if len(groupIDs) == 0 {
		return nil
	}
	members := make([]*model_struct.LocalConversationGroupMember, 0, len(groupIDs))
	for _, groupID := range groupIDs {
		members = append(members, &model_struct.LocalConversationGroupMember{
			ConversationID:      conversationID,
			ConversationGroupID: groupID,
		})
	}
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Clauses(clause.OnConflict{DoNothing: true}).
			Create(members).Error,
		"AddConversationGroupMembersDB failed",
	)
}

func (d *DataBase) RemoveConversationGroupMembersDB(ctx context.Context, conversationID string, groupIDs []string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	if len(groupIDs) == 0 {
		return nil
	}
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Where("conversation_id=? AND conversation_group_id IN ?", conversationID, groupIDs).
			Delete(&model_struct.LocalConversationGroupMember{}).Error,
		"RemoveConversationGroupMembersDB failed",
	)
}

func (d *DataBase) GetConversationGroupIDsByConversationIdDB(ctx context.Context, conversationID string) ([]string, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()
	var groupIDs []string
	err := d.conn.WithContext(ctx).
		Model(&model_struct.LocalConversationGroupMember{}).
		Where("conversation_id=?", conversationID).
		Pluck("conversation_group_id", &groupIDs).Error
	return groupIDs, errs.WrapMsg(err, "GetConversationGroupIDsByConversationIdDB failed")
}

func (d *DataBase) GetConversationIDsByGroupIdDB(ctx context.Context, groupID string) ([]string, error) {
	d.mRWMutex.RLock()
	defer d.mRWMutex.RUnlock()
	var conversationIDs []string
	err := d.conn.WithContext(ctx).
		Model(&model_struct.LocalConversationGroupMember{}).
		Where("conversation_group_id=?", groupID).
		Pluck("conversation_id", &conversationIDs).Error
	return conversationIDs, errs.WrapMsg(err, "GetConversationIDsByGroupIdDB failed")
}

func (d *DataBase) DeleteConversationGroupMembersByGroupIdDB(ctx context.Context, groupID string) error {
	d.mRWMutex.Lock()
	defer d.mRWMutex.Unlock()
	return errs.WrapMsg(
		d.conn.WithContext(ctx).
			Where("conversation_group_id=?", groupID).
			Delete(&model_struct.LocalConversationGroupMember{}).Error,
		"DeleteConversationGroupMembersByGroupIdDB failed",
	)
}
