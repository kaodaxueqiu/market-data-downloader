package httpclient

import "context"

type protocolResult struct {
	TryQuic bool
	Tcp     *resultResponse
	Quic    *resultResponse
}

func (t *protocolResult) NegotiatedProtocol(ctx context.Context) (string, error) {
	res, err := t.Result(ctx)
	if err != nil {
		return "", err
	}
	return res.Value.negotiatedProtocol, nil
}

func (t *protocolResult) Result(ctx context.Context) (*resultResponse, error) {
	tcpDone := t.Tcp.GetDone()
	quicDone := t.Quic.GetDone()
	for {
		if tcpDone == nil && quicDone == nil {
			return nil, errTryConn
		}
		select {
		case <-ctx.Done():
			return nil, context.Cause(ctx)
		case <-tcpDone:
			if t.Tcp.Err == nil {
				return t.Tcp, nil
			}
			tcpDone = nil
		case <-quicDone:
			if t.Quic.Err == nil {
				return t.Quic, nil
			}
			quicDone = nil
		}
	}
}
