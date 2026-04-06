package httpclient

import (
	"context"
	"crypto/tls"
	"time"

	"github.com/openimsdk/tools/log"
	"github.com/quic-go/quic-go"
)

func (t *httpTransport) dialQuic(ctx context.Context, addr string, tlsConf *tls.Config, quicConf *quic.Config) (quic.EarlyConnection, error) {
	host, err := t.getTlsServerName(addr)
	if err != nil {
		return nil, err
	}
	if tlsConf == nil {
		tlsConf = t.tls.Clone()
		tlsConf.ServerName = host
		tlsConf.NextProtos = []string{"h3", "h3-29"}
	}
	if quicConf == nil {
		quicConf = t.quicConf
	}
	start := time.Now()
	conn, err := quic.DialAddrEarly(ctx, addr, tlsConf, quicConf)
	if err != nil {
		log.ZWarn(ctx, "quic dial addr early failed", err, "addr", addr, "cost", time.Since(start))
		return nil, err
	}
	log.ZDebug(ctx, "quic dial addr early success", "addr", addr, "cost", time.Since(start))
	return conn, nil
}

func (t *httpTransport) dialTcpTls(ctx context.Context, addr string, tlsConf *tls.Config) (*tls.Conn, error) {
	host, err := t.getTlsServerName(addr)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	conn, err := t.dialContext(ctx, "tcp", addr)
	if err != nil {
		log.ZWarn(ctx, "tcp dial addr", err, "addr", addr, "cost", time.Since(start))
		return nil, err
	}
	if tlsConf == nil {
		tlsConf = t.tls.Clone()
		tlsConf.ServerName = host
		tlsConf.NextProtos = []string{"h2", "http/1.1"}
	}
	tlsConn := tls.Client(conn, tlsConf)
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		log.ZWarn(ctx, "tcp tls", err, "addr", addr, "cost", time.Since(start))
		_ = tlsConn.Close()
		_ = conn.Close()
		return nil, err
	}
	log.ZDebug(ctx, "tcp dial addr", "addr", addr, "cost", time.Since(start))
	return tlsConn, nil
}
