package diagnose

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"sync/atomic"
)

var defaultSalt = []byte("openim-sdk-diagnostic-v1")

var saltValue atomic.Value // stores []byte

func init() {

	saltValue.Store(defaultSalt)
}

// SetHashSalt allows host application to override the default diagnostic hash salt.
// It should be called once during SDK initialization.
// If not set, a built-in default salt will be used.
func SetHashSalt(salt []byte) {
	if len(salt) == 0 {
		return
	}
	cp := make([]byte, len(salt))
	copy(cp, salt)
	saltValue.Store(cp)
}

func HashPII(s string) string {
	if s == "" {
		return ""
	}
	salt := saltValue.Load().([]byte)

	h := hmac.New(sha256.New, salt)
	h.Write([]byte(s))
	sum := h.Sum(nil)
	return hex.EncodeToString(sum[:8])
}
