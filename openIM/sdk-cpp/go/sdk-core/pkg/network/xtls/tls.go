package xtls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
)

type ClientConfig struct {
	Insecure bool     `json:"insecure"`
	Certs    []string `json:"certs"`
}

func (c *ClientConfig) TLS() (*tls.Config, error) {
	conf := tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: c.Insecure,
	}
	if len(c.Certs) > 0 {
		conf.ClientCAs = x509.NewCertPool()
		for i, ca := range c.Certs {
			if ok := conf.ClientCAs.AppendCertsFromPEM([]byte(ca)); !ok {
				return nil, fmt.Errorf("failed append %d to append certs from PEM", i)
			}
		}
	}
	return &conf, nil
}
