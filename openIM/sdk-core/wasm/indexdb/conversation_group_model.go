// Copyright © 2023 OpenIM SDK. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build js && wasm
// +build js,wasm

package indexdb

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/wasm/exec"
)

type LocalConversationGroups struct{}

func NewLocalConversationGroups() *LocalConversationGroups {
	return &LocalConversationGroups{}
}

func (i *LocalConversationGroups) InsertConversationGroupDB(ctx context.Context, group *model_struct.LocalConversationGroup) error {
	_, err := exec.Exec(utils.StructToJsonString(group))
	return err
}
func (i *LocalConversationGroups) DeleteAllConversationGroupDB(ctx context.Context) error {
	_, err := exec.Exec()
	return err
}

func (i *LocalConversationGroups) BatchInsertConversationGroupsDB(ctx context.Context, groups []*model_struct.LocalConversationGroup) error {
	_, err := exec.Exec(utils.StructToJsonString(groups))
	return err
}

func (i *LocalConversationGroups) UpsertConversationGroupsDB(ctx context.Context, groups []*model_struct.LocalConversationGroup) error {
	_, err := exec.Exec(utils.StructToJsonString(groups))
	return err
}

func (i *LocalConversationGroups) UpdateConversationGroupDB(ctx context.Context, group *model_struct.LocalConversationGroup) error {
	_, err := exec.Exec(group.ConversationGroupID, utils.StructToJsonString(group))
	return err
}

func (i *LocalConversationGroups) DeleteConversationGroupDB(ctx context.Context, groupID string) error {
	_, err := exec.Exec(groupID)
	return err
}

func (i *LocalConversationGroups) GetConversationGroupDB(ctx context.Context, groupID string) (*model_struct.LocalConversationGroup, error) {
	group, err := exec.Exec(groupID)
	if err != nil {
		return nil, err
	}
	if v, ok := group.(string); ok {
		result := model_struct.LocalConversationGroup{}
		err := utils.JsonStringToStruct(v, &result)
		if err != nil {
			return nil, err
		}
		return &result, err
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroups) GetConversationIDsByGroupIdDB(ctx context.Context, groupID string) ([]string, error) {
	group, err := exec.Exec(groupID)
	if err != nil {
		return nil, err
	}
	result := []string{}
	if v, ok := group.(string); ok {
		err := utils.JsonStringToStruct(v, &result)
		if err != nil {
			return nil, err
		}
		return result, err
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroups) GetConversationGroupsDB(ctx context.Context, groupIDs []string) (result []*model_struct.LocalConversationGroup, err error) {
	groupList, err := exec.Exec(utils.StructToJsonString(groupIDs))
	if err != nil {
		return nil, err
	}
	if v, ok := groupList.(string); ok {
		var temp []model_struct.LocalConversationGroup
		err := utils.JsonStringToStruct(v, &temp)
		if err != nil {
			return nil, err
		}
		for _, v := range temp {
			v1 := v
			result = append(result, &v1)
		}
		return result, err
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroups) GetAllConversationGroupsDB(ctx context.Context) (result []*model_struct.LocalConversationGroup, err error) {
	groupList, err := exec.Exec()
	if err != nil {
		return nil, err
	}
	if v, ok := groupList.(string); ok {
		var temp []model_struct.LocalConversationGroup
		err := utils.JsonStringToStruct(v, &temp)
		if err != nil {
			return nil, err
		}
		for _, v := range temp {
			v1 := v
			result = append(result, &v1)
		}
		return result, err
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroups) UpdateConversationGroupSerialDB(ctx context.Context, groupID string, serial int64) error {
	_, err := exec.Exec(groupID, serial)
	return err
}

func (i *LocalConversationGroups) RemoveConversationGroupMembersDB(ctx context.Context, conversationID string, groupIDs []string) error {
	_, err := exec.Exec(conversationID, utils.StructToJsonString(groupIDs))
	return err
}

type LocalConversationGroupMembers struct{}

func NewLocalConversationGroupMembers() *LocalConversationGroupMembers {
	return &LocalConversationGroupMembers{}
}

func (i *LocalConversationGroupMembers) GetConversationGroupIDsByConversationIdDB(ctx context.Context, conversationID string) (result []string, err error) {
	dbR, err := exec.Exec(conversationID)
	if err != nil {
		return nil, err
	}
	if v, ok := dbR.(string); ok {
		err := utils.JsonStringToStruct(v, &result)
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroupMembers) DeleteConversationGroupMembersByGroupIdDB(ctx context.Context, groupID string) error {
	_, err := exec.Exec(groupID)
	return err
}

func (i *LocalConversationGroupMembers) ReplaceConversationGroupMembers(ctx context.Context, conversationID string, groupIDs []string) error {
	if len(groupIDs) == 0 {
		_, err := exec.Exec(conversationID, utils.StructToJsonString([]string{}))
		return err
	}
	_, err := exec.Exec(conversationID, utils.StructToJsonString(groupIDs))
	return err
}

func (i *LocalConversationGroupMembers) AddConversationGroupMembersDB(ctx context.Context, conversationID string, groupIDs []string) error {
	if len(groupIDs) == 0 {
		return nil
	}
	_, err := exec.Exec(conversationID, utils.StructToJsonString(groupIDs))
	return err
}

func (i *LocalConversationGroupMembers) RemoveConversationGroupMembers(ctx context.Context, conversationID string, groupIDs []string) error {
	if len(groupIDs) == 0 {
		return nil
	}
	_, err := exec.Exec(conversationID, utils.StructToJsonString(groupIDs))
	return err
}

func (i *LocalConversationGroupMembers) GetConversationGroupIDsByConversationID(ctx context.Context, conversationID string) (result []string, err error) {
	groupIDs, err := exec.Exec(conversationID)
	if err != nil {
		return nil, err
	}
	if v, ok := groupIDs.(string); ok {
		err := utils.JsonStringToStruct(v, &result)
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroupMembers) GetConversationIDsByGroupID(ctx context.Context, groupID string) (result []string, err error) {
	conversationIDs, err := exec.Exec(groupID)
	if err != nil {
		return nil, err
	}
	if v, ok := conversationIDs.(string); ok {
		err := utils.JsonStringToStruct(v, &result)
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, exec.ErrType
}

func (i *LocalConversationGroupMembers) DeleteConversationGroupMembersByGroupID(ctx context.Context, groupID string) error {
	_, err := exec.Exec(groupID)
	return err
}
