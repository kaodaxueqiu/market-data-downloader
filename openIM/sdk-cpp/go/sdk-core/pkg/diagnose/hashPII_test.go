package diagnose

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestHashPIIEmpty(t *testing.T) {
	if got := HashPII(""); got != "" {
		t.Fatalf("expected empty hash for empty input, got %q", got)
	}
}

func TestSetHashSaltEmptyNoChange(t *testing.T) {
	SetHashSalt([]byte("salt1"))
	t.Cleanup(func() { SetHashSalt(defaultSalt) })

	before := HashPII("user")
	SetHashSalt(nil)
	after := HashPII("user")
	if before != after {
		t.Fatalf("expected hash to remain unchanged on empty salt")
	}
}

func TestHashPIIWithSalt(t *testing.T) {
	salt := []byte("test-salt")
	SetHashSalt(salt)
	t.Cleanup(func() { SetHashSalt(defaultSalt) })

	got := HashPII("user")
	h := hmac.New(sha256.New, salt)
	h.Write([]byte("user"))
	sum := h.Sum(nil)
	want := hex.EncodeToString(sum[:8])
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
	if len(got) != 16 {
		t.Fatalf("expected 16 hex chars, got %d", len(got))
	}
}
