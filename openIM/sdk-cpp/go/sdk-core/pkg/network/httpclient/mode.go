package httpclient

const (
	TcpUpgrade = 0 // Prefer HTTP/1 or HTTP/2; attempt to upgrade to HTTP/3 based on response headers. Will fall back to HTTP/3 if HTTP/1 or HTTP/2 fail.
	TcpFirst   = 1 // Prefer HTTP/1 or HTTP/2; fall back to HTTP/3 only if the TCP connection fails. No upgrade based on response headers.
	QuicFirst  = 2 // Prefer HTTP/3; fall back to HTTP/1 or HTTP/2 if the QUIC connection fails.
	ConnFirst  = 3 // Try HTTP/1, HTTP/2, and HTTP/3 concurrently; establish both TCP and QUIC connections and use the fastest one.
	TcpOnly    = 4 // Use only HTTP/1 or HTTP/2 over TCP.
	QuicOnly   = 5 // Use only HTTP/3 over QUIC.
)
