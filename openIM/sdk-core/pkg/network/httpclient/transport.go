package httpclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/simplelru"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"golang.org/x/net/http2"

	"github.com/openimsdk/tools/log"
)

type httpTransport struct {
	mode        int
	dialContext func(ctx context.Context, network, addr string) (net.Conn, error)
	tls         *tls.Config
	quicConf    *quic.Config

	h1 *http.Transport
	h2 *http2.Transport
	h3 *http3.Transport

	lock     sync.Mutex
	cache    simplelru.LRUCache[string, *hostCache]
	tempConn map[tempConnKey]*tempConn
}

func (t *httpTransport) splitH3(altSvc string) string {
	if altSvc != "" {
		for _, item := range strings.Split(altSvc, ",") {
			for _, kv := range strings.Split(strings.TrimSpace(item), ";") {
				kv = strings.TrimSpace(kv)
				var res string
				switch {
				case strings.HasPrefix(kv, "h3="):
					res = strings.TrimPrefix(kv, "h3=")
				case strings.HasPrefix(kv, "h3-29="):
					res = strings.TrimPrefix(kv, "h3-29=")
				default:
					continue
				}
				return strings.Trim(res, `"`)
			}
		}
	}
	return ""
}

func (t *httpTransport) handlerResponse(request *http.Request, response *http.Response) {
	if t.mode != TcpUpgrade {
		return
	}
	altSvc := response.Header.Get("Alt-Svc")
	if altSvc == "" {
		return
	}
	h3host := t.splitH3(altSvc)
	if h3host == "" {
		return
	}
	if !strings.HasPrefix(h3host, ":") {
		return
	}
	h3host = strings.TrimPrefix(h3host, ":")
	host, port, err := net.SplitHostPort(request.URL.Host)
	if err != nil {
		host = request.URL.Host
		if request.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	if h3host != port {
		return
	}
	t.handlerAltSvc(net.JoinHostPort(host, port))
}

func (t *httpTransport) tcpRoundTrip(roundTripper http.RoundTripper, request *http.Request) (*http.Response, error) {
	response, err := roundTripper.RoundTrip(request)
	if err != nil {
		return nil, err
	}
	t.handlerResponse(request, response)
	return response, nil
}

func (t *httpTransport) getTlsServerName(addr string) (string, error) {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return "", err
	}
	return host, nil
}

func (t *httpTransport) markFailed(ctx context.Context, addr string, tcp bool, err error) {
	log.ZDebug(ctx, "mark failed", "addr", addr, "tcp", tcp, "err", err)
	t.lock.Lock()
	cache, ok := t.cache.Get(addr)
	t.lock.Unlock()
	if !ok {
		return
	}
	markErr := func(tr *tryResult) {
		if tr.Resp != nil && tr.Resp.success {
			tr.Resp = nil
			tr.time = time.Time{}
		}
	}
	cache.lock.Lock()
	if tcp {
		markErr(cache.Tcp)
	} else {
		markErr(cache.Quic)
	}
	cache.lock.Unlock()
}

func (t *httpTransport) handlerAltSvc(host string) {
	t.lock.Lock()
	defer t.lock.Unlock()
	value, ok := t.cache.Get(host)
	if !ok {
		value = &hostCache{
			ht:   t,
			host: host,
		}
		t.cache.Add(host, value)
	}
	value.TryQuic = true
}

func (t *httpTransport) setTempConn(host string, conn any, tcp bool) {
	key := tempConnKey{
		Host: host,
		Tcp:  tcp,
	}
	t.lock.Lock()
	oldConn, ok := t.tempConn[key]
	if ok {
		close(oldConn.Done)
		delete(t.tempConn, key)
	}
	tc := &tempConn{
		Conn: conn,
		Done: make(chan struct{}),
	}
	t.tempConn[key] = tc
	t.lock.Unlock()
	if oldConn != nil {
		oldConn.Close()
	}
	go func() {
		timer := time.NewTimer(time.Second * 3)
		defer timer.Stop()
		select {
		case <-tc.Done:
			log.ZDebug(context.Background(), "conn reuse", "host", host, "tcp", tcp)
			return
		case <-timer.C:
			t.lock.Lock()
			if cc, ok := t.tempConn[key]; ok == false || cc != tc {
				t.lock.Unlock()
				log.ZDebug(context.Background(), "release unreused connections", "host", host, "tcp", tcp)
				return
			}
			delete(t.tempConn, key)
			close(tc.Done)
			t.lock.Unlock()
			tc.Close()
			log.ZDebug(context.Background(), "release unreused connections", "host", host, "tcp", tcp)
		}
	}()
}

func (t *httpTransport) getCache(ctx context.Context, host string) (*protocolResult, error) {
	t.lock.Lock()
	defer t.lock.Unlock()
	res, ok := t.cache.Get(host)
	if !ok {
		res = &hostCache{
			host: host,
			ht:   t,
			Tcp:  &tryResult{},
			Quic: &tryResult{},
		}
		t.cache.Add(host, res)
	}
	res.Start(ctx, t.mode)
	return &protocolResult{TryQuic: res.TryQuic, Tcp: res.Tcp.Resp, Quic: res.Quic.Resp}, nil
}

func (t *httpTransport) getRoundTripTcpType(request *http.Request) (string, error) {
	ctx := request.Context()
	host := request.URL.Host
	if strings.IndexByte(host, ':') < 0 {
		host = net.JoinHostPort(host, "443")
	}
	res, err := t.getCache(ctx, host)
	if err != nil {
		return "", err
	}
	switch t.mode {
	case TcpFirst:
		if np, ok := res.Tcp.NegotiatedProtocol(); ok {
			return np, nil
		}
		return res.NegotiatedProtocol(ctx)
	case TcpUpgrade:
		tcpRes, ok := res.Tcp.GetResult()
		if ok {
			quicRes, ok := res.Quic.GetResult()
			if !ok {
				return tcpRes.negotiatedProtocol, nil
			}
			//if quicRes.cost > tcpRes.cost && quicRes.cost-tcpRes.cost > time.Millisecond*20 {
			if quicRes.cost > tcpRes.cost {
				return tcpRes.negotiatedProtocol, nil
			}
			return quicRes.negotiatedProtocol, nil
		} else {
			if quicRes, ok := res.Quic.GetResult(); ok {
				return quicRes.negotiatedProtocol, nil
			}
		}
		return res.NegotiatedProtocol(ctx)
	case QuicFirst:
		if np, ok := res.Quic.NegotiatedProtocol(); ok {
			return np, nil
		}
		return res.NegotiatedProtocol(ctx)
	default:
		values := make([]*resultResponse, 0, 2)
		errs := make([]error, 0, 2)
		putResp := func(res *resultResponse) {
			if res == nil {
				return
			}
			select {
			case <-res.Done:
				if res.Err == nil {
					values = append(values, res)
				} else {
					errs = append(errs, res.Err)
				}
			default:
			}
		}
		putResp(res.Tcp)
		putResp(res.Quic)
		switch len(values) {
		case 0:
			return res.NegotiatedProtocol(ctx)
		case 1:
			return values[0].Value.negotiatedProtocol, nil
		case 2:
			if values[0].Value.cost >= values[1].Value.cost {
				return values[1].Value.negotiatedProtocol, nil
			}
			return values[0].Value.negotiatedProtocol, nil
		default:
			panic("code not reachable")
		}
	}
}

func (t *httpTransport) roundTrip(request *http.Request, version *int) (*http.Response, error) {
	switch request.URL.Scheme {
	case "http":
		*version = 1
		return t.h1.RoundTrip(request)
	case "https":
		negotiatedProtocol, err := t.getRoundTripTcpType(request)
		if err != nil {
			return nil, err
		}
		if negotiatedProtocol == "" {
			negotiatedProtocol = "http/1.1" // default to http/1.1 if no protocol negotiated
		}
		switch negotiatedProtocol {
		case "http/1.0", "http/1.1":
			*version = 1
			return t.tcpRoundTrip(t.h1, request)
		case "h2":
			*version = 2
			return t.tcpRoundTrip(t.h2, request)
		case "h3", "h3-29":
			*version = 3
			return t.h3.RoundTrip(request)
		default:
			return nil, fmt.Errorf("unsupported protocol scheme %s", negotiatedProtocol)
		}
	default:
		return nil, fmt.Errorf("unsupported scheme %s", request.URL.Scheme)
	}
}

func (t *httpTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	var version int
	resp, err := t.roundTrip(request, &version)
	if err != nil && version > 0 {
		host := request.URL.Host
		if strings.IndexByte(host, ':') < 0 {
			host = net.JoinHostPort(host, "443")
		}
		t.markFailed(request.Context(), host, version != 3, err)
	}
	return resp, err
}
