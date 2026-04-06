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

package test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdk_params_callback"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/protocol/wrapperspb"
)

const conversationGroupExportOperationIDPrefix = "conversation-group-export"

type conversationGroupExportParams struct {
	Pagination *sdkws.RequestPagination
}

var conversationGroupExportConfig = conversationGroupExportParams{
	Pagination: &sdkws.RequestPagination{
		PageNumber: 1,
		ShowNumber: 50,
	},
}

type baseCallback struct {
	successCh chan<- string
	errCh     chan<- error
}

func (b *baseCallback) OnSuccess(data string) {
	if b == nil || b.successCh == nil {
		return
	}
	b.successCh <- data
}

func (b *baseCallback) OnError(code int32, msg string) {
	if b == nil || b.errCh == nil {
		return
	}
	b.errCh <- fmt.Errorf("code=%d msg=%s", code, msg)
}

// Export path: open_im_sdk.CreateConversationGroup
func Test_ExportCreateConversationGroup(t *testing.T) {
	tempGroupName := "replace-me-group-name"
	tempOrder := int64(1)
	tempGroupEx := ""
	tempConversationID := "replace-me-conversation-id"
	tempGroupType := pbConversation.ConversationGroupType_ConversationGroupTypeNormal

	req := &sdk_params_callback.CreateConversationGroupReq{
		Name:                  tempGroupName,
		Order:                 tempOrder,
		Ex:                    stringPtr(tempGroupEx),
		ConversationGroupType: tempGroupType,
		ConversationID:        stringPtr(tempConversationID),
	}
	callExportAPI(t, "create", req, func(callback *baseCallback, opID string) {
		open_im_sdk.CreateConversationGroup(callback, opID, mustJSON(t, req))
	})
}

// Export path: open_im_sdk.UpdateConversationGroup
func Test_ExportUpdateConversationGroup(t *testing.T) {
	tempGroupID := "i_Marked"
	tempGroupName := "Marked"
	tempGroupEx := "112233"
	tempHidden := false

	req := &sdk_params_callback.UpdateConversationGroupReq{
		ConversationGroupID: tempGroupID,
		Name:                wrapperspb.String(tempGroupName),
		Ex:                  wrapperspb.String(tempGroupEx),
		Hidden:              wrapperspb.Bool(tempHidden),
	}
	callExportAPI(t, "update", req, func(callback *baseCallback, opID string) {
		open_im_sdk.UpdateConversationGroup(callback, opID, mustJSON(t, req))
	})
}

// Export path: open_im_sdk.DeleteConversationGroup
func Test_ExportDeleteConversationGroup(t *testing.T) {
	tempGroupID := "replace-me-group-id"
	input := struct {
		ConversationGroupID string `json:"conversationGroupID"`
	}{
		ConversationGroupID: tempGroupID,
	}
	callExportAPI(t, "delete", input, func(callback *baseCallback, opID string) {
		open_im_sdk.DeleteConversationGroup(callback, opID, tempGroupID)
	})
}

// Export path: open_im_sdk.GetConversationGroups
func Test_ExportGetConversationGroups(t *testing.T) {
	tempConversationGroupType := int64(constant.ConversationGroupTypeFilter)
	input := struct {
		ConversationGroupType int64 `json:"conversationGroupType"`
	}{
		ConversationGroupType: tempConversationGroupType,
	}
	callExportAPI(t, "get-groups", input, func(callback *baseCallback, opID string) {
		open_im_sdk.GetConversationGroups(callback, opID, tempConversationGroupType)
	})
}

// Export path: open_im_sdk.SetConversationGroupOrder
func Test_ExportSetConversationGroupOrder(t *testing.T) {
	tempGroupID := "replace-me-group-id"
	tempOrder := int64(1)
	orders := []*pbConversation.ConversationGroupOrder{
		{ConversationGroupID: tempGroupID, Order: tempOrder},
	}
	callExportAPI(t, "set-order", orders, func(callback *baseCallback, opID string) {
		open_im_sdk.SetConversationGroupOrder(callback, opID, mustJSON(t, orders))
	})
}

// Export path: open_im_sdk.AddConversationsToGroups
func Test_ExportAddConversationsToGroup(t *testing.T) {
	tempGroupIDs := []string{"replace-me-group-id"}
	tempConversationIDs := []string{
		"replace-me-conversation-id-1",
		"replace-me-conversation-id-2",
	}
	input := struct {
		ConversationIDs      []string `json:"conversationIDs"`
		ConversationGroupIDs []string `json:"conversationGroupIDs"`
	}{
		ConversationIDs:      tempConversationIDs,
		ConversationGroupIDs: tempGroupIDs,
	}
	callExportAPI(t, "add-members", input, func(callback *baseCallback, opID string) {
		open_im_sdk.AddConversationsToGroups(callback, opID, mustJSON(t, tempConversationIDs), mustJSON(t, tempGroupIDs))
	})
}

// Export path: open_im_sdk.RemoveConversationsFromGroups
func Test_ExportRemoveConversationsFromGroup(t *testing.T) {
	tempGroupIDs := []string{"replace-me-group-id"}
	tempConversationIDs := []string{"replace-me-conversation-id"}
	input := struct {
		ConversationIDs      []string `json:"conversationIDs"`
		ConversationGroupIDs []string `json:"conversationGroupIDs"`
	}{
		ConversationIDs:      tempConversationIDs,
		ConversationGroupIDs: tempGroupIDs,
	}
	callExportAPI(t, "remove-members", input, func(callback *baseCallback, opID string) {
		open_im_sdk.RemoveConversationsFromGroups(callback, opID, mustJSON(t, tempConversationIDs), mustJSON(t, tempGroupIDs))
	})
}

// Export path: open_im_sdk.GetConversationGroupByConversationID
func Test_ExportGetConversationGroupIDsByConversationID(t *testing.T) {
	tempConversationID := "replace-me-conversation-id"
	input := struct {
		ConversationID string `json:"conversationID"`
	}{
		ConversationID: tempConversationID,
	}
	callExportAPI(t, "get-group-ids", input, func(callback *baseCallback, opID string) {
		open_im_sdk.GetConversationGroupByConversationID(callback, opID, tempConversationID)
	})
}

// Export path: open_im_sdk.GetConversationGroupInfoWithConversations
func Test_ExportGetConversationGroupInfoWithConversations(t *testing.T) {
	tempGroupID := "replace-me-group-id"
	tempPagination := &sdkws.RequestPagination{
		PageNumber: 1,
		ShowNumber: 50,
	}
	req := &sdk_params_callback.GetConversationGroupInfoWithConversationsReq{
		ConversationGroupID: tempGroupID,
		Pagination:          tempPagination,
	}
	callExportAPI(t, "group-info", req, func(callback *baseCallback, opID string) {
		open_im_sdk.GetConversationGroupInfoWithConversations(callback, opID, mustJSON(t, req))
	})
}

func callExportAPI(t *testing.T, name string, input any, fn func(callback *baseCallback, opID string)) {
	t.Helper()
	successCh := make(chan string, 1)
	errCh := make(chan error, 1)
	callback := &baseCallback{successCh: successCh, errCh: errCh}
	opID := fmt.Sprintf("%s-%s-%d", conversationGroupExportOperationIDPrefix, name, time.Now().UnixNano())
	t.Logf("%s operationID: %s", name, opID)
	t.Logf("%s request: %s", name, prettyJSON(t, input))
	fn(callback, opID)
	select {
	case data := <-successCh:
		t.Logf("%s response: %s", name, prettyJSONString(data))
	case err := <-errCh:
		t.Logf("%s error: %v", name, err)
		t.Fatal(err)
	case <-time.After(120 * time.Second):
		t.Fatalf("timeout waiting for %s callback", name)
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	return string(data)
}

func prettyJSON(t *testing.T, v any) string {
	t.Helper()
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		t.Fatalf("marshal pretty request: %v", err)
	}
	return string(data)
}

func prettyJSONString(value string) string {
	if value == "" {
		return value
	}
	var parsed any
	if err := json.Unmarshal([]byte(value), &parsed); err != nil {
		return value
	}
	data, err := json.MarshalIndent(parsed, "", "  ")
	if err != nil {
		return value
	}
	return string(data)
}

func stringPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
