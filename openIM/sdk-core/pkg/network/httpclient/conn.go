package httpclient

import (
	"crypto/tls"
	"fmt"

	"github.com/quic-go/quic-go"
)

type tempConn struct {
	Done chan struct{}
	Conn any
}

func (c *tempConn) GetTcpTlsConn() *tls.Conn {
	return c.Conn.(*tls.Conn)
}

func (c *tempConn) GetQuicConn() quic.EarlyConnection {
	return c.Conn.(quic.EarlyConnection)
}

func (c *tempConn) Close() {
	if c == nil || c.Conn == nil {
		return
	}
	switch conn := c.Conn.(type) {
	case *tls.Conn:
		_ = conn.Close()
	case quic.EarlyConnection:
		_ = conn.CloseWithError(0, "")
	default:
		panic(fmt.Sprintf("unknown connection type %T", c.Conn))
	}
}

type tempConnKey struct {
	Host string
	Tcp  bool
}
