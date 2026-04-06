package conversation_msg

import (
	"context"
	"runtime/debug"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/log"
)

type conversationEvent struct {
	conversation *Conversation
}

func (e *conversationEvent) OnInsert(ctx context.Context, conv *model_struct.LocalConversation) {
	if conv == nil {
		return
	}
	err := e.conversation.OnConversationChanged(ctx, []string{conv.ConversationID})
	if err != nil {
		log.ZError(ctx, "conversationEvent OnInsert Error", err, "stack", string(debug.Stack()))
	}
}

func (e *conversationEvent) OnDelete(ctx context.Context, conv *model_struct.LocalConversation) {
	if conv == nil {
		return
	}
	// Optionally trigger UI refresh for deleted conversation.
	//e.conversation.notifyConversationChanged(conv)
}

func (e *conversationEvent) OnUpdate(ctx context.Context, before, after *model_struct.LocalConversation) {
	if after == nil {
		return
	}
	err := e.conversation.OnConversationChanged(ctx, []string{after.ConversationID})
	if err != nil {
		log.ZError(ctx, "conversationEvent OnUpdate Error", err, "stack", string(debug.Stack()))
	}
}
