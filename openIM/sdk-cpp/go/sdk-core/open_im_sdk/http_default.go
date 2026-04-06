//go:build !(js && wasm)

package open_im_sdk

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/network"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/network/httpclient"
	"github.com/openimsdk/openim-sdk-core/v3/sdk_struct"
	"github.com/openimsdk/tools/log"
)

func SetHttpConfig(configArgs sdk_struct.IMConfig) error {
	netDialer := &net.Dialer{
		Timeout: 30 * time.Second,
	}
	d := newDialer(netDialer)
	switch configArgs.HttpClientMode {
	case httpclient.TcpUpgrade:
	case httpclient.TcpFirst:
	case httpclient.QuicFirst:
	case httpclient.ConnFirst:
	case httpclient.TcpOnly:
	case httpclient.QuicOnly:
	default:
		return fmt.Errorf("http client mode %d not supported", configArgs.HttpClientMode)
	}
	tlsConf, err := configArgs.TLS.TLS()
	if err != nil {
		return err
	}
	network.SetHttpClient(httpclient.NewHttpClient(configArgs.HttpClientMode, time.Second*10, tlsConf, d.DialContext))
	wsTlsConf := tlsConf.Clone()
	wsTlsConf.NextProtos = []string{"http/1.1"}
	websocket.DefaultDialer = &websocket.Dialer{
		HandshakeTimeout: netDialer.Timeout,
		TLSClientConfig:  wsTlsConf,
		NetDialContext:   d.DialContext,
	}
	return nil
}

func newDialer(d *net.Dialer) *cachedDNSDialer {
	return &cachedDNSDialer{
		cache: make(map[string]*dnsCacheEntry),
		locks: make(map[string]*hostLock),
		d:     d,
	}
}

type cachedDNSDialer struct {
	mu      sync.RWMutex
	cache   map[string]*dnsCacheEntry
	locks   map[string]*hostLock
	locksMu sync.Mutex
	d       *net.Dialer
}

type dnsCacheEntry struct {
	ips []string
	idx int
}

type hostLock struct {
	ch chan struct{}
}

func (d *cachedDNSDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	start := time.Now()
	log.ZDebug(ctx, "dial context", "network", network, "address", address)
	conn, err := d.dialContext(ctx, network, address)
	if err != nil {
		log.ZError(ctx, "dial context failed", err, "network", network, "address", address, "cost", time.Since(start))
		return nil, err
	}
	dur := time.Since(start)
	log.ZDebug(ctx, "dial context success", "network", network, "address", address, "local", conn.LocalAddr(), "remote", conn.RemoteAddr(), "cost", dur)
	return conn, nil
}

func (d *cachedDNSDialer) dialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return d.d.DialContext(ctx, network, address)
	}
	if net.ParseIP(host) != nil {
		return d.d.DialContext(ctx, network, address)
	}

	lock := d.hostLock(host)
	if err := lock.Lock(ctx); err != nil {
		return nil, err
	}
	defer lock.Unlock()

	entry, err := d.resolveEntry(ctx, host)
	if err != nil {
		return nil, err
	}
	return d.dialWithEntry(ctx, network, port, entry)
}

func (d *cachedDNSDialer) hostLock(host string) *hostLock {
	d.locksMu.Lock()
	defer d.locksMu.Unlock()
	if d.locks == nil {
		d.locks = make(map[string]*hostLock)
	}
	if mu, ok := d.locks[host]; ok {
		return mu
	}
	mu := &hostLock{ch: make(chan struct{}, 1)}
	d.locks[host] = mu
	return mu
}

func (d *cachedDNSDialer) resolveEntry(ctx context.Context, host string) (*dnsCacheEntry, error) {
	resolver := d.d.Resolver
	if resolver == nil {
		resolver = net.DefaultResolver
	}
	addrs, err := resolver.LookupIPAddr(ctx, host)
	if len(addrs) > 0 {
		ips := make([]string, 0, len(addrs))
		for _, addr := range addrs {
			if addr.IP == nil {
				continue
			}
			ips = append(ips, addr.IP.String())
		}
		if len(ips) > 0 {
			entry := &dnsCacheEntry{ips: ips, idx: 0}
			d.mu.Lock()
			if d.cache == nil {
				d.cache = make(map[string]*dnsCacheEntry)
			}
			d.cache[host] = entry
			d.mu.Unlock()
			return entry, nil
		}
		err = fmt.Errorf("no IPs found for host %s", host)
	} else if err == nil {
		err = fmt.Errorf("no IPs found for host %s", host)
	}

	d.mu.RLock()
	entry := d.cache[host]
	d.mu.RUnlock()
	if entry != nil {
		return entry, nil
	}
	if err == nil {
		err = fmt.Errorf("no cached IPs for host %s", host)
	}
	return nil, err
}

func (l *hostLock) Lock(ctx context.Context) error {
	select {
	case l.ch <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (l *hostLock) Unlock() {
	<-l.ch
}

func (d *cachedDNSDialer) dialWithEntry(ctx context.Context, network, port string, entry *dnsCacheEntry) (net.Conn, error) {
	var lastErr error
	if len(entry.ips) == 0 {
		return nil, fmt.Errorf("no IPs available")
	}
	start := entry.idx
	if start < 0 || start >= len(entry.ips) {
		start = 0
	}
	done := ctx.Done()
	for i := 0; i < len(entry.ips); i++ {
		idx := (start + i) % len(entry.ips)
		ip := entry.ips[idx]
		conn, err := d.d.DialContext(ctx, network, net.JoinHostPort(ip, port))
		if err == nil {
			entry.idx = idx
			return conn, nil
		}
		lastErr = err
		select {
		case <-done:
			return nil, lastErr
		default:
			log.ZWarn(ctx, "dial IP failed, try next", err, "network", network, "ip", ip, "port", port)
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("failed to dial any IP")
	}
	return nil, lastErr
}
