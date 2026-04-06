package httpclient

import (
	"context"
	"sync"
	"time"
)

const tryInterval = time.Minute

type hostCache struct {
	lock    sync.Mutex
	ht      *httpTransport
	host    string
	TryQuic bool
	Tcp     *tryResult
	Quic    *tryResult
}

func (c *hostCache) getOther(tr *tryResult) *tryResult {
	if tr == c.Tcp {
		return c.Quic
	}
	return c.Tcp
}

func (c *hostCache) startTryTtl(ctx context.Context, tr *tryResult, ttl int) {
	if ttl <= 0 {
		return
	}
	if tr.Resp != nil {
		return
	}
	now := time.Now()
	if now.Sub(tr.time) < tryInterval {
		if c.getOther(tr).Resp != nil {
			return
		}
	}
	tr.time = now
	tr.Resp = newResultResponse()
	tcp := tr == c.Tcp
	go func() {
		setErr := func(err error) {
			c.lock.Lock()
			tr.Resp.success = false
			tr.Resp.Err = err
			close(tr.Resp.Done)
			tr.Resp = nil
			if tcp {
				c.startTryTtl(ctx, c.Quic, ttl-1)
			} else {
				c.startTryTtl(ctx, c.Tcp, ttl-1)
			}
			c.lock.Unlock()
		}
		setSuc := func(cost time.Duration, negotiatedProtocol string, conn any, tcp bool) {
			c.lock.Lock()
			tr.Resp.success = true
			tr.Resp.Err = nil
			tr.Resp.Value = &cacheMate{
				cost:               cost,
				negotiatedProtocol: negotiatedProtocol,
			}
			c.ht.setTempConn(c.host, conn, tcp)
			close(tr.Resp.Done)
			c.lock.Unlock()
		}

		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second*10)
		defer cancel()
		start := time.Now()
		if tcp {
			conn, err := c.ht.dialTcpTls(ctx, c.host, nil)
			if err != nil {
				setErr(err)
				return
			}
			setSuc(time.Since(start), conn.ConnectionState().NegotiatedProtocol, conn, true)
			return
		} else {
			conn, err := c.ht.dialQuic(ctx, c.host, nil, nil)
			if err != nil {
				setErr(err)
				return
			}
			setSuc(time.Since(start), conn.ConnectionState().TLS.NegotiatedProtocol, conn, false)
			return
		}
	}()
}

func (c *hostCache) Start(ctx context.Context, mode int) {
	c.lock.Lock()
	defer c.lock.Unlock()
	switch mode {
	case TcpFirst:
		c.startTryTtl(ctx, c.Tcp, 2)
	case TcpUpgrade:
		c.startTryTtl(ctx, c.Tcp, 2)
		if c.TryQuic {
			c.startTryTtl(ctx, c.Quic, 1)
		}
	case QuicFirst:
		c.startTryTtl(ctx, c.Quic, 2)
	default:
		c.startTryTtl(ctx, c.Tcp, 1)
		c.startTryTtl(ctx, c.Quic, 1)
	}
}
