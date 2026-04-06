package httpclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/hashicorp/golang-lru/v2/simplelru"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"golang.org/x/net/http2"
)

func NewHttpClient(mode int, timeout time.Duration, tlsConf *tls.Config, netDialContext func(ctx context.Context, network, addr string) (net.Conn, error)) *http.Client {
	if tlsConf == nil {
		tlsConf = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}
	if len(tlsConf.NextProtos) == 0 {
		tlsConf.NextProtos = []string{"h2", "http/1.1", "h3"}
	}

	quicConf := &quic.Config{
		Allow0RTT:      true,
		MaxIdleTimeout: 30 * time.Second,
	}
	h1 := &http.Transport{
		TLSClientConfig:     tlsConf,
		DialContext:         netDialContext,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     30 * time.Second,
	}
	h3 := &http3.Transport{
		TLSClientConfig: tlsConf,
		QUICConfig:      quicConf,
	}
	switch mode {
	case TcpOnly:
		return &http.Client{
			Timeout:   timeout,
			Transport: h1, // support h2
		}
	case QuicOnly:
		return &http.Client{
			Timeout:   timeout,
			Transport: h3,
		}
	case TcpFirst, TcpUpgrade, QuicFirst, ConnFirst:
		h2 := &http2.Transport{
			TLSClientConfig: tlsConf,
			IdleConnTimeout: 30 * time.Second,
		}
		cache, _ := simplelru.NewLRU[string, *hostCache](1024, nil)
		transport := &httpTransport{
			mode:        mode,
			dialContext: netDialContext,
			tls:         tlsConf,

			h1:       h1,
			h2:       h2,
			h3:       h3,
			quicConf: quicConf,
			cache:    cache,
			tempConn: make(map[tempConnKey]*tempConn, 8),
		}
		// ALPN is no longer supported
		h1.DialTLSContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
			key := tempConnKey{
				Host: addr,
				Tcp:  true,
			}
			transport.lock.Lock()
			conn, ok := transport.tempConn[key]
			if ok {
				delete(transport.tempConn, key)
				close(conn.Done)
			}
			transport.lock.Unlock()
			if ok {
				return conn.GetTcpTlsConn(), nil
			}
			return transport.dialTcpTls(ctx, addr, nil)
		}
		h2.DialTLSContext = func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
			key := tempConnKey{
				Host: addr,
				Tcp:  true,
			}
			transport.lock.Lock()
			conn, ok := transport.tempConn[key]
			if ok {
				delete(transport.tempConn, key)
				close(conn.Done)
			}
			transport.lock.Unlock()
			if ok {
				return conn.GetTcpTlsConn(), nil
			}
			cc, err := transport.dialTcpTls(ctx, addr, cfg)
			if err != nil {
				transport.markFailed(ctx, addr, true, err)
				return nil, err
			}
			return cc, nil
		}
		h3.Dial = func(ctx context.Context, addr string, tlsCfg *tls.Config, cfg *quic.Config) (quic.EarlyConnection, error) {
			key := tempConnKey{
				Host: addr,
				Tcp:  false,
			}
			transport.lock.Lock()
			conn, ok := transport.tempConn[key]
			if ok {
				delete(transport.tempConn, key)
				close(conn.Done)
			}
			transport.lock.Unlock()
			if ok {
				return conn.GetQuicConn(), nil
			}
			cc, err := transport.dialQuic(ctx, addr, tlsCfg, cfg)
			if err != nil {
				transport.markFailed(ctx, addr, false, err)
				return nil, err
			}
			return cc, nil
		}
		return &http.Client{
			Timeout:   timeout,
			Transport: transport,
		}
	default:
		panic(fmt.Sprintf("unsupported mode %d", mode))
	}
}
