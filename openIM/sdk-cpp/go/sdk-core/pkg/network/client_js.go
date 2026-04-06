//go:build js && wasm

package network

import (
	"net/http"
	"time"
)

var httpClient = &http.Client{
	Timeout: time.Second * 10,
}

func GetHttpClient() *http.Client {
	return httpClient
}

func SetHttpClient(client *http.Client) {

}

// CloseIdleHttpConnections force-closes all idle keep-alive connections.
// Call this on:
//   - network change
//   - wake from sleep
//   - downstream restart detected
func CloseIdleHttpConnections() {
}
