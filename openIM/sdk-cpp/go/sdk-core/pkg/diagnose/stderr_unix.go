//go:build !windows && !js && !wasip1
// +build !windows,!js,!wasip1

package diagnose

import (
	"os"

	"golang.org/x/sys/unix"
)

func redirectStderrToFile(path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	return unix.Dup2(int(f.Fd()), int(os.Stderr.Fd()))
}
