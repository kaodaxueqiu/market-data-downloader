package network

import (
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/network/httpclient"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/network/xtls"
	"github.com/quic-go/quic-go/http3"
)

type testHandler struct{}

func (testHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	str := fmt.Sprintf("[%s] http %s uri %s", request.RemoteAddr, request.Proto, request.RequestURI)
	log.Println(str)
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.Header().Set("Alt-Svc", "h3=\":443\"; ma=2592000")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write([]byte(str))
}

func TestHttpServer(t *testing.T) {
	t.Log("start http server")
	err := http.ListenAndServeTLS(":443", "xtls/localhost.crt", "xtls/localhost.key", testHandler{})
	t.Log(err)
}

func TestHttp3Server(t *testing.T) {
	t.Log("start http3 server")
	err := http3.ListenAndServeQUIC(":443", "xtls/localhost.crt", "xtls/localhost.key", testHandler{})
	t.Log(err)
}

func TestHttpClient(t *testing.T) {
	data, err := os.ReadFile("xtls/localhost.crt")
	if err != nil {
		t.Error(err)
		return
	}
	tlsConf, err := (&xtls.ClientConfig{
		Insecure: true,
		Certs:    []string{string(data)},
	}).TLS()
	if err != nil {
		t.Error(err)
		return
	}
	netDialer := &net.Dialer{}
	SetHttpClient(httpclient.NewHttpClient(httpclient.ConnFirst, time.Second*10, tlsConf, netDialer.DialContext))
	for {
		//DoURL(t, "https://www.google.com/")
		DoURL(t, "https://localhost/")
		time.Sleep(time.Second)
	}
}

func DoURL(t *testing.T, url string) {
	start := time.Now()
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Error(err)
		return
	}
	request.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36")
	resp, err := GetHttpClient().Get(url)
	if err != nil {
		t.Error(time.Since(start), err)
		return
	}
	defer resp.Body.Close()
	t.Log("Version:", resp.Proto)
	t.Log("Status:", resp.Status)
	for _, key := range []string{"Alt-Svc", "Content-Type"} {
		if value := resp.Header.Get(key); value != "" {
			t.Logf("Header: %s: %s", key, value)
		}
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Error(err)
		return
	}
	strBody := string(body)
	const maxLen = 300
	if len(strBody) > maxLen+3 {
		strBody = strBody[:maxLen] + "..."
	}

	t.Log("Body:", strBody)
	t.Log("Cost:", time.Since(start))
	t.Log(strings.Repeat("===", 20))
	fmt.Println()
}
