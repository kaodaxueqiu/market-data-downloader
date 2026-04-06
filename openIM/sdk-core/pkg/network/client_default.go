//go:build !(js && wasm)

package network

import (
	"net/http"
	"sync/atomic"
	"time"
)

var httpClient atomic.Pointer[http.Client]

func init() {
	httpClient.Store(&http.Client{
		Timeout: time.Second * 10,
	})
}

func GetHttpClient() *http.Client {
	return httpClient.Load()
}

func SetHttpClient(client *http.Client) {
	httpClient.Store(client)
}

// CloseIdleHttpConnections force-closes all idle keep-alive connections.
// Call this on:
//   - network change
//   - wake from sleep
//   - downstream restart detected
func CloseIdleHttpConnections() {
	if tr := httpClient.Load(); tr != nil {
		tr.CloseIdleConnections()
	}
}
