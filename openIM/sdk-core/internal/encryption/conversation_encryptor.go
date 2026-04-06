package encryption

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/internal/interaction"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/protocol/encryption"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/log"
)

type ConversationEncryptor struct {
	*interaction.LongConnMgr
	LoginUserID func() string
	m           sync.Map
	a           Encryptor
}

func NewConversationEncryptor(loginUserIDFunc func() string, longConn *interaction.LongConnMgr) MessageEncryptor {
	return &ConversationEncryptor{LoginUserID: loginUserIDFunc, a: NewAESEncryptor(), LongConnMgr: longConn}
}

func (c *ConversationEncryptor) Encryption(ctx context.Context, message *sdkws.MsgData, conversationID string) error {
	if !c.LongConnMgr.IsEncryption {
		return nil
	}
	key, err := c.GetMaxVersionKey(ctx, conversationID)
	if err != nil {
		return err
	}
	encryptedData, err := c.a.Encryption(message.Content, []byte(key.Key))
	if err != nil {
		return err
	}
	log.ZDebug(ctx, "encryption success", "message", message, "key", key)
	message.KeyVersion = key.Version
	message.Content = encryptedData
	return nil
}

func (c *ConversationEncryptor) Decryption(ctx context.Context, messageList []*sdkws.MsgData, conversationID string) error {
	for _, message := range messageList {
		log.ZDebug(ctx, "decryption", "message", message, "conversation_id", conversationID)
		if message.KeyVersion != 0 {
			if message.SessionType == constant.SingleChatType || message.SessionType == constant.NotificationChatType {
				if message.RecvID != c.LoginUserID() && message.SendID != c.LoginUserID() {
					log.ZWarn(ctx, "maybe message come from app manager", errors.New("manager message"), "message", message)
					continue
				}
			}
			if message.ContentType == constant.RevokeNotification || message.Status == constant.MsgStatusHasDeleted {
				log.ZDebug(ctx, "message is revoke notification or has deleted", "message", message)
				continue
			}
			key, err := c.GetKeyByMessageVersion(ctx, conversationID, message.KeyVersion)
			if err != nil {
				log.ZWarn(ctx, "get key by message version failed", err, "message", message, "conversation_id", conversationID)
				continue
			}
			decryptedData, err := c.a.Decryption(message.Content, []byte(key.Key))
			if err != nil {
				log.ZWarn(ctx, "decryption failed", err, "message", message, "conversation_id", conversationID)
				continue
			}
			log.ZDebug(ctx, "decryption success", "message", message, "key", key)
			message.Content = decryptedData
		}
	}
	return nil
}
func (c *ConversationEncryptor) GetKeyByMessageVersion(ctx context.Context, conversationID string, version int32) (*encryption.VersionKey, error) {
	key, ok := c.m.Load(c.genConversationIDVersionKey(conversationID, version))
	if ok {
		return key.(*encryption.VersionKey), nil
	} else {
		versionKeyList, _, err := c.getEncryptionKeyFromSvr(ctx, conversationID, version)
		if err != nil {
			return nil, err
		}
		if len(versionKeyList) == 0 {
			return nil, sdkerrs.ErrMsgEncryptionKeyNotFound
		}
		return versionKeyList[0], nil
	}
}

func (c *ConversationEncryptor) GetMaxVersionKey(ctx context.Context, conversationID string) (*encryption.VersionKey, error) {
	key, ok := c.m.Load(c.genConversationIDMaxVersionKey(conversationID))
	if ok {
		return key.(*encryption.VersionKey), nil
	} else {
		_, maxKeyVersion, err := c.getEncryptionKeyFromSvr(ctx, conversationID, 0)
		if err != nil {
			return nil, err
		}
		return maxKeyVersion, nil
	}
}
func (c *ConversationEncryptor) getEncryptionKeyFromSvr(ctx context.Context, conversationID string, keyVersion int32) ([]*encryption.VersionKey, *encryption.VersionKey, error) {
	req := encryption.GetEncryptionKeyReq{ConversationID: conversationID, KeyVersion: keyVersion}
	var resp *encryption.GetEncryptionKeyResp
	var err error
	for i := 0; i < 10; i++ {
		resp, err = c.getEncryptionKey(ctx, &req)
		if err != nil {
			log.ZError(ctx, "getEncryptionKeyFromSvr failed", err, "conversation_id", conversationID, "key_version", keyVersion)
			time.Sleep(1 * time.Second)
			continue
		} else {
			break
		}
	}
	if err != nil {
		return nil, nil, err
	}
	var tempVersion encryption.VersionKey
	for _, v := range resp.VersionKeyList {
		if v.Version > tempVersion.Version {
			tempVersion = *v
		}
		c.m.Store(c.genConversationIDVersionKey(conversationID, v.Version), v)
	}
	c.m.Store(c.genConversationIDMaxVersionKey(conversationID), &tempVersion)
	return resp.VersionKeyList, &tempVersion, nil
}

func (c *ConversationEncryptor) genConversationIDVersionKey(conversationID string, version int32) string {
	return conversationID + "v" + strconv.Itoa(int(version))
}

func (c *ConversationEncryptor) genConversationIDMaxVersionKey(conversationID string) string {
	return conversationID + "v" + "max"
}
