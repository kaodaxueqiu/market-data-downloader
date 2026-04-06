package datasyncer

import (
	"context"
	"crypto/md5"
	"encoding/binary"
	"encoding/json"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/converter"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

type ConversationSyncHelper interface {
	BatchAddFaceURLAndName(ctx context.Context, val []*model_struct.LocalConversation) error
	HotKeys() []string
	ClearHotKeys(ctx context.Context) error
}

func NewConversationBackend(userID string, db db_interface.DataBase, event Event[*model_struct.LocalConversation], helper ConversationSyncHelper) *ConversationBackend {
	if event == nil {
		event = NopEvent[*model_struct.LocalConversation]{}
	}
	return &ConversationBackend{
		userID:    userID,
		tableName: (model_struct.LocalConversation{}).TableName(),
		db:        db,
		event:     event,
		helper:    helper,
	}
}

type ConversationBackend struct {
	userID    string
	tableName string
	db        db_interface.DataBase
	event     Event[*model_struct.LocalConversation]
	helper    ConversationSyncHelper
}

func (b *ConversationBackend) IDOf(v *model_struct.LocalConversation) string {
	return v.ConversationID
}

func (b *ConversationBackend) Equal(x, y *model_struct.LocalConversation) bool {
	return x.RecvMsgOpt == y.RecvMsgOpt &&
		x.IsPinned == y.IsPinned &&
		x.IsPrivateChat == y.IsPrivateChat &&
		x.BurnDuration == y.BurnDuration &&
		x.IsNotInGroup == y.IsNotInGroup &&
		x.GroupAtType == y.GroupAtType &&
		x.UpdateUnreadCountTime == y.UpdateUnreadCountTime &&
		x.AttachedInfo == y.AttachedInfo &&
		x.Ex == y.Ex &&
		x.MaxSeq == y.MaxSeq &&
		x.MinSeq == y.MinSeq &&
		x.MsgDestructTime == y.MsgDestructTime &&
		x.IsMsgDestruct == y.IsMsgDestruct &&
		x.IsMarked == y.IsMarked &&
		x.Remark == y.Remark
}

func (b *ConversationBackend) GetLocalData(ctx context.Context, ids []string) (map[string]*model_struct.LocalConversation, error) {
	var (
		local []*model_struct.LocalConversation
		err   error
	)
	if len(ids) == 0 {
		local, err = b.db.GetAllConversationListDB(ctx)
	} else {
		local, err = b.db.GetMultipleConversationDB(ctx, ids)
	}
	if err != nil {
		return nil, err
	}
	return datautil.SliceToMap(local, func(e *model_struct.LocalConversation) string {
		return e.ConversationID
	}), nil
}

func (b *ConversationBackend) UpsertLocal(ctx context.Context, vs []*model_struct.LocalConversation) error {
	// Check if event callbacks should be disabled for this operation.
	// Events are typically disabled during bulk synchronization to avoid triggering
	// excessive notifications or cascading updates.
	disable := isDisableEvent(ctx)
	ids := datautil.Slice(vs, b.IDOf)
	exist, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}

	if err := b.helper.BatchAddFaceURLAndName(ctx, vs); err != nil {
		return err
	}

	var inserts []*model_struct.LocalConversation
	var updates []*model_struct.LocalConversation

	for _, v := range vs {
		if current, ok := exist[v.ConversationID]; ok {
			if !b.Equal(v, current) {
				updates = append(updates, v)
			}
			continue
		}
		inserts = append(inserts, v)
	}

	if len(inserts) > 0 {
		if err = chunkedInsert(ctx, inserts, b.db.BatchInsertConversationList); err != nil {
			return err
		}
		// Only trigger OnInsert events if not disabled
		if !disable {
			for _, conversation := range inserts {
				b.event.OnInsert(ctx, conversation)
			}
		}
	}

	if len(updates) > 0 {
		for _, conversation := range updates {
			old := exist[conversation.ConversationID]
			conversation.LatestMsg = old.LatestMsg
			conversation.LatestMsgSendTime = old.LatestMsgSendTime
			if err = b.db.UpdateColumnsConversation(ctx, conversation.ConversationID,
				map[string]interface{}{
					"recv_msg_opt":             conversation.RecvMsgOpt,
					"is_pinned":                conversation.IsPinned,
					"is_private_chat":          conversation.IsPrivateChat,
					"burn_duration":            conversation.BurnDuration,
					"is_not_in_group":          conversation.IsNotInGroup,
					"group_at_type":            conversation.GroupAtType,
					"update_unread_count_time": conversation.UpdateUnreadCountTime,
					"attached_info":            conversation.AttachedInfo,
					"ex":                       conversation.Ex,
					"msg_destruct_time":        conversation.MsgDestructTime,
					"is_msg_destruct":          conversation.IsMsgDestruct,
					"max_seq":                  conversation.MaxSeq,
					"is_marked":                conversation.IsMarked,
					"remark":                   conversation.Remark,
					"min_seq":                  conversation.MinSeq}); err != nil {
				return err
			}
			// Only trigger OnUpdate events if not disabled
			if !disable {
				b.event.OnUpdate(ctx, old, conversation)
			}
		}
	}

	return nil
}

func (b *ConversationBackend) DeleteLocalByID(ctx context.Context, ids []string) error {
	// Check if event callbacks should be disabled for this operation
	disable := isDisableEvent(ctx)
	if len(ids) == 0 {
		local, err := b.db.GetAllConversationListDB(ctx)
		if err != nil {
			return err
		}
		if err := b.db.DeleteAllConversation(ctx); err != nil {
			return err
		}
		// Only trigger OnDelete events for bulk deletion if not disabled
		if !disable {
			for _, conv := range local {
				b.event.OnDelete(ctx, conv)
			}
		}
		return nil
	}
	local, err := b.GetLocalData(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if conv := local[id]; conv != nil {
			if err := b.db.DeleteConversation(ctx, id); err != nil {
				return err
			}
			// Only trigger OnDelete events for individual deletion if not disabled
			if !disable {
				b.event.OnDelete(ctx, conv)
			}
		}
	}
	return nil
}

func (b *ConversationBackend) LoadLocalStamp(ctx context.Context) (*model_struct.LocalVersionSync, error) {
	return getVersionSync(ctx, b.db, b.tableName, b.userID)
}

func (b *ConversationBackend) HandleExtra(_ context.Context, _ struct{}) error {
	return nil
}

func (b *ConversationBackend) HandleFullSync(ctx context.Context) error {
	conversationIDs := b.helper.HotKeys()
	if len(conversationIDs) == 0 {
		return nil
	}
	err := b.SyncConversationsByIDsWithHash(ctx, conversationIDs)
	if err != nil {
		return err
	}
	return b.helper.ClearHotKeys(ctx)
}

func (b *ConversationBackend) SyncConversationsByIDsWithHash(ctx context.Context, conversationIDs []string) error {
	if len(conversationIDs) == 0 {
		return nil
	}
	hash, err := b.hotConversationsHash(ctx, conversationIDs)
	if err != nil {
		return err
	}
	req := &pbConversation.GetConversationsReq{OwnerUserID: b.userID, ConversationIDs: conversationIDs, Hash: &hash}
	resp, err := api.GetConversations.Invoke(ctx, req)
	if err != nil {
		return err
	}
	if len(resp.Conversations) == 0 {
		return nil
	}
	server := datautil.Slice(resp.Conversations, converter.ServerConversationToLocal)
	log.ZDebug(ctx, "sync conversations by hash changed", "hash", hash, "conversationIDs", conversationIDs, "server", len(server))
	return b.UpsertLocal(ctx, server)
}

func (b *ConversationBackend) SaveLocalStamp(ctx context.Context, s *model_struct.LocalVersionSync) error {
	return b.db.SetVersionSync(ctx, s)
}

func (b *ConversationBackend) ListServerIDs(ctx context.Context, ids []string) (*IDSnapshot, error) {
	req := &pbConversation.GetFullOwnerConversationIDsReq{
		IdHash: IdHash(ids),
		UserID: b.userID,
	}
	resp, err := api.GetFullConversationIDs.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toIDSnapshot(resp, resp.GetConversationIDs()), nil
}

func (b *ConversationBackend) DiffSince(ctx context.Context, versionID string, version uint64) (*Delta[*model_struct.LocalConversation], error) {
	req := &pbConversation.GetIncrementalConversationReq{
		UserID:    b.userID,
		VersionID: versionID,
		Version:   version,
	}
	resp, err := api.GetIncrementalConversation.Invoke(ctx, req)
	if err != nil {
		return nil, err
	}
	return toDelta(resp, converter.ServerConversationToLocal), nil
}

func (b *ConversationBackend) FetchByIDs(ctx context.Context, ids []string) ([]*model_struct.LocalConversation, error) {
	return fetchByIDPages(ctx, ids, defaultFetchPageSize, func(ctx context.Context, subset []string) ([]*model_struct.LocalConversation, error) {
		req := &pbConversation.GetConversationsReq{
			OwnerUserID:     b.userID,
			ConversationIDs: subset,
		}
		resp, err := api.GetConversations.Invoke(ctx, req)
		if err != nil {
			return nil, err
		}
		return datautil.Batch(converter.ServerConversationToLocal, resp.GetConversations()), nil
	})
}

// hotConversationsHash computes a hash for the given conversationIDs based on
// selected LocalConversation fields. It fetches conversations from DB and
// respects the order of IDs in the input slice.
func (b *ConversationBackend) hotConversationsHash(ctx context.Context, ids []string) (uint64, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	convs, err := b.db.GetMultipleConversationDB(ctx, ids)
	if err != nil {
		return 0, err
	}

	// Build map keyed by ConversationID for lookup.
	m := datautil.SliceToMap(convs, func(c *model_struct.LocalConversation) string {
		return c.ConversationID
	})

	// Signature struct capturing fields that participate in ServerConversationToLocal.
	type sig struct {
		ConversationID   string `json:"conversationID"`
		ConversationType int32  `json:"conversationType"`
		UserID           string `json:"userID"`
		GroupID          string `json:"groupID"`
		RecvMsgOpt       int32  `json:"recvMsgOpt"`
		GroupAtType      int32  `json:"groupAtType"`
		IsPinned         bool   `json:"isPinned"`
		BurnDuration     int32  `json:"burnDuration"`
		IsPrivateChat    bool   `json:"isPrivateChat"`
		AttachedInfo     string `json:"attachedInfo"`
		IsMarked         bool   `json:"is_marked"`
		Ex               string `json:"ex"`
		MsgDestructTime  int64  `json:"msgDestructTime"`
		IsMsgDestruct    bool   `json:"isMsgDestruct"`
		Remark           string `json:"remark"`
	}

	sigs := make([]sig, 0, len(ids))
	for _, id := range ids {
		c, ok := m[id]
		if !ok || c == nil {
			continue
		}
		sigs = append(sigs, sig{
			ConversationID:   c.ConversationID,
			ConversationType: c.ConversationType,
			UserID:           c.UserID,
			GroupID:          c.GroupID,
			RecvMsgOpt:       c.RecvMsgOpt,
			GroupAtType:      c.GroupAtType,
			IsPinned:         c.IsPinned,
			BurnDuration:     c.BurnDuration,
			IsPrivateChat:    c.IsPrivateChat,
			AttachedInfo:     c.AttachedInfo,
			IsMarked:         c.IsMarked,
			Ex:               c.Ex,
			MsgDestructTime:  c.MsgDestructTime,
			IsMsgDestruct:    c.IsMsgDestruct,
			Remark:           c.Remark,
		})
	}

	if len(sigs) == 0 {
		return 0, nil
	}

	data, _ := json.Marshal(sigs)
	sum := md5.Sum(data)
	return binary.BigEndian.Uint64(sum[:]), nil
}
