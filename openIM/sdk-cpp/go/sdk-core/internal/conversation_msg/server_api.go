package conversation_msg

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/cliconf"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/jssdk"
	pbMsg "github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/wrapperspb"
)

func (c *Conversation) markMsgAsRead2Server(ctx context.Context, conversationID string, seqs []int64) error {
	req := &pbMsg.MarkMsgsAsReadReq{UserID: c.loginUserID, ConversationID: conversationID, Seqs: seqs}
	return api.MarkMsgsAsRead.Execute(ctx, req)
}

func (c *Conversation) markConversationAsReadServer(ctx context.Context, conversationID string, hasReadSeq int64, seqs []int64) error {
	req := &pbMsg.MarkConversationAsReadReq{UserID: c.loginUserID, ConversationID: conversationID, HasReadSeq: hasReadSeq, Seqs: seqs}
	return api.MarkConversationAsRead.Execute(ctx, req)
}

func (c *Conversation) setConversationHasReadSeq(ctx context.Context, conversationID string, hasReadSeq int64) error {
	req := &pbMsg.SetConversationHasReadSeqReq{UserID: c.loginUserID, ConversationID: conversationID, HasReadSeq: hasReadSeq}
	return api.SetConversationHasReadSeq.Execute(ctx, req)
}

// To delete session information, delete the server first, and then invoke the interface.
// The client receives a callback to delete all local information.
func (c *Conversation) clearConversationMsgFromServer(ctx context.Context, conversationID string) error {
	req := &pbMsg.ClearConversationsMsgReq{UserID: c.loginUserID, ConversationIDs: []string{conversationID}}
	return api.ClearConversationMsg.Execute(ctx, req)
}

// Delete all server messages
func (c *Conversation) deleteAllMessageFromServer(ctx context.Context) error {
	req := &pbMsg.UserClearAllMsgReq{UserID: c.loginUserID}
	return api.ClearAllMsg.Execute(ctx, req)
}

// The user deletes part of the message from the server
func (c *Conversation) deleteMessagesFromServer(ctx context.Context, conversationID string, seqs, otherSeqs []int64, opt *pbMsg.DeleteSyncOpt) error {
	req := &pbMsg.DeleteMsgsReq{
		UserID:         c.loginUserID,
		Seqs:           seqs,
		ConversationID: conversationID,
		DeleteSyncOpt:  opt,
		OtherSeqs:      otherSeqs,
	}
	return api.DeleteMsgs.Execute(ctx, req)
}

// The user deletes messages from a user from the server
func (c *Conversation) deleteUserAllMessageInConvFromServer(ctx context.Context, conversationID string, userID string) error {
	req := &pbMsg.DeleteUserAllMessagesInConvReq{
		ConversationID: conversationID,
		UserID:         userID,
	}
	return api.DeleteUserAllMessageInConv.Execute(ctx, req)
}

func (c *Conversation) revokeMessageFromServer(ctx context.Context, conversationID string, seq int64) error {
	req := &pbMsg.RevokeMsgReq{UserID: c.loginUserID, ConversationID: conversationID, Seq: seq}
	return api.RevokeMsg.Execute(ctx, req)
}

func (c *Conversation) getHasReadAndMaxSeqsFromServer(ctx context.Context, conversationIDs ...string) (*pbMsg.GetConversationsHasReadAndMaxSeqResp, error) {
	req := pbMsg.GetConversationsHasReadAndMaxSeqReq{UserID: c.loginUserID, ConversationIDs: conversationIDs}
	return api.GetConversationsHasReadAndMaxSeq.Invoke(ctx, &req)
}

func (c *Conversation) getConversationsByIDsFromServer(ctx context.Context, conversations []string) (*pbConversation.GetConversationsResp, error) {
	req := &pbConversation.GetConversationsReq{OwnerUserID: c.loginUserID, ConversationIDs: conversations}
	return api.GetConversations.Invoke(ctx, req)
}

func (c *Conversation) getAllConversationListFromServer(ctx context.Context) (*pbConversation.GetAllConversationsResp, error) {
	req := &pbConversation.GetAllConversationsReq{OwnerUserID: c.loginUserID}
	return api.GetAllConversations.Invoke(ctx, req)
}

func (c *Conversation) getAllConversationIDsFromServer(ctx context.Context) (*pbConversation.GetFullOwnerConversationIDsResp, error) {
	req := &pbConversation.GetFullOwnerConversationIDsReq{UserID: c.loginUserID}
	return api.GetFullConversationIDs.Invoke(ctx, req)
}

func (c *Conversation) getIncrementalConversationFromServer(ctx context.Context, version uint64, versionID string) (*pbConversation.GetIncrementalConversationResp, error) {
	req := &pbConversation.GetIncrementalConversationReq{UserID: c.loginUserID, Version: version, VersionID: versionID}
	return api.GetIncrementalConversation.Invoke(ctx, req)
}

func (c *Conversation) GetActiveConversations(ctx context.Context) ([]*jssdk.ConversationMsg, error) {
	conf, err := cliconf.GetClientConfig(ctx)
	if err != nil {
		return nil, err
	}
	req := &jssdk.GetActiveConversationsReq{OwnerUserID: c.loginUserID, Count: int64(conf.ConversationActiveNum)}
	return api.ExtractField(ctx, api.GetActiveConversation.Invoke, req, (*jssdk.GetActiveConversationsResp).GetConversations)
}

func (c *Conversation) getStreamMsg(ctx context.Context, req *pbMsg.GetStreamMsgReq) (*pbMsg.GetStreamMsgResp, error) {
	return api.GetStreamMsg.Invoke(ctx, req)
}

func (c *Conversation) modifyMessageFromServer(ctx context.Context, conversationID string, seq int64, newContent, oldContent string) (*pbMsg.ModifyMessageResp, error) {
	req := &pbMsg.ModifyMessageReq{ConversationID: conversationID, Seq: seq, NewContent: newContent, OldContent: oldContent}
	return api.ModifyMessage.Invoke(ctx, req)
}

func (c *Conversation) getConversationPinnedMsg(ctx context.Context, req *pbConversation.GetConversationPinnedMsgReq) (*pbConversation.GetConversationPinnedMsgResp, error) {
	return api.GetConversationPinnedMsg.Invoke(ctx, req)
}

func (c *Conversation) setConversationPinnedMsg(ctx context.Context, req *pbConversation.SetConversationPinnedMsgReq) (*pbConversation.SetConversationPinnedMsgResp, error) {
	return api.SetConversationPinnedMsg.Invoke(ctx, req)
}

func (c *Conversation) resetConversationUnread(ctx context.Context, req *pbMsg.ResetConversationUnreadReq) error {
	req.UserID = c.loginUserID
	return api.ResetConversationUnread.Execute(ctx, req)
}

func (c *Conversation) createConversationGroup(ctx context.Context, name string, order int64,
	cGroupType pbConversation.ConversationGroupType, ex, cID *string) (*pbConversation.CreateConversationGroupResp, error) {
	req := &pbConversation.CreateConversationGroupReq{
		OwnerUserID:           c.loginUserID,
		Name:                  name,
		Order:                 order,
		Ex:                    ex,
		ConversationID:        cID,
		ConversationGroupType: cGroupType,
	}
	return api.CreateConversationGroup.Invoke(ctx, req)
}

func (c *Conversation) updateConversationGroup(ctx context.Context, cgID string, name, ex *wrapperspb.StringValue,
	hidden *wrapperspb.BoolValue) (*pbConversation.UpdateConversationGroupResp, error) {
	req := &pbConversation.UpdateConversationGroupReq{
		ConversationGroupID: cgID,
		OwnerUserID:         c.loginUserID,
		Name:                name,
		Ex:                  ex,
		Hidden:              hidden,
	}
	return api.UpdateConversationGroup.Invoke(ctx, req)
}

func (c *Conversation) deleteConversationGroup(ctx context.Context, ConversationGroupID string) error {
	req := &pbConversation.DeleteConversationGroupReq{
		ConversationGroupID: ConversationGroupID,
		OwnerUserID:         c.loginUserID,
	}
	return api.DeleteConversationGroup.Execute(ctx, req)
}

func (c *Conversation) getConversationGroups(ctx context.Context, maxVersion *int64) (*pbConversation.GetConversationGroupsResp, error) {
	req := &pbConversation.GetConversationGroupsReq{
		OwnerUserID: c.loginUserID,
		MaxVersion:  wrapperspb.Int64Ptr(maxVersion),
	}
	return api.GetConversationGroups.Invoke(ctx, req)
}

func (c *Conversation) setConversationGroupOrder(ctx context.Context, order []*pbConversation.ConversationGroupOrder) error {
	req := &pbConversation.SetConversationGroupOrderReq{
		OwnerUserID: c.loginUserID,
		Orders:      order,
	}
	return api.SetConversationGroupOrder.Execute(ctx, req)
}

func (c *Conversation) addConversationsToGroups(ctx context.Context, cgID []string, cIDs []string) error {
	req := &pbConversation.AddConversationsToGroupsReq{
		OwnerUserID:          c.loginUserID,
		ConversationIDs:      cIDs,
		ConversationGroupIDs: cgID,
	}
	return api.AddConversationsToGroup.Execute(ctx, req)
}

func (c *Conversation) removeConversationsFromGroups(ctx context.Context, cgID []string, cIDs []string) error {
	req := &pbConversation.RemoveConversationsFromGroupsReq{
		OwnerUserID:          c.loginUserID,
		ConversationIDs:      cIDs,
		ConversationGroupIDs: cgID,
	}
	return api.RemoveConversationsFromGroup.Execute(ctx, req)
}
