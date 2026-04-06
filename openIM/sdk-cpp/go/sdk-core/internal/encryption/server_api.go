package encryption

import (
	"context"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/protocol/encryption"
)

func (c *ConversationEncryptor) getEncryptionKey(ctx context.Context, req *encryption.GetEncryptionKeyReq) (*encryption.GetEncryptionKeyResp, error) {
	return api.GetEncryptionKey.Invoke(ctx, req)
}
