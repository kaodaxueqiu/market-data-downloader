package conversation_msg

import (
	"context"
	"testing"

	dbpkg "github.com/openimsdk/openim-sdk-core/v3/pkg/db"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdk_params_callback"
	pbConversation "github.com/openimsdk/protocol/conversation"
)

func Test_SortConversationListByGroup(t *testing.T) {
	ctx := context.Background()
	dbDir := t.TempDir()
	db, err := dbpkg.NewDataBase(ctx, "sort-user", dbDir, 0)
	if err != nil {
		t.Fatalf("NewDataBase failed: %v", err)
	}
	defer func() {
		_ = db.Close(ctx)
	}()

	conv := &Conversation{db: db}
	localConversations := []*model_struct.LocalConversation{
		{ConversationID: "c1", LatestMsgSendTime: 100},
		{ConversationID: "c2", LatestMsgSendTime: 200, IsPinned: true},
		{ConversationID: "c3", LatestMsgSendTime: 150, DraftTextTime: 300},
		{ConversationID: "c4", LatestMsgSendTime: 250},
		{ConversationID: "c5", LatestMsgSendTime: 50},
	}
	if err := db.BatchInsertConversationList(ctx, localConversations); err != nil {
		t.Fatalf("BatchInsertConversationList failed: %v", err)
	}

	resp := &sdk_params_callback.GetConversationListByGroupResp{
		ConversationElems: []*pbConversation.ConversationElem{
			{ConversationID: "c3", MsgInfo: &pbConversation.MsgInfo{LatestMsgRecvTime: 120}},
			{ConversationID: "c1", MsgInfo: &pbConversation.MsgInfo{LatestMsgRecvTime: 90}},
			{ConversationID: "c5", IsPinned: true, MsgInfo: &pbConversation.MsgInfo{LatestMsgRecvTime: 70}},
			{ConversationID: "c4", MsgInfo: &pbConversation.MsgInfo{LatestMsgRecvTime: 260}},
			{ConversationID: "c2", MsgInfo: &pbConversation.MsgInfo{LatestMsgRecvTime: 210}},
		},
	}

	conv.sortConversationListByGroup(ctx, resp)

	wantOrder := []string{"c2", "c5", "c3", "c4", "c1"}
	if len(resp.ConversationElems) != len(wantOrder) {
		t.Fatalf("unexpected sorted length: %d", len(resp.ConversationElems))
	}
	for i, id := range wantOrder {
		if resp.ConversationElems[i].ConversationID != id {
			t.Fatalf("unexpected order at %d: %s", i, resp.ConversationElems[i].ConversationID)
		}
	}
	if !resp.ConversationElems[0].IsPinned {
		t.Fatalf("expected local pinned conversation to be marked pinned")
	}
}
