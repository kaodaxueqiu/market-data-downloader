//go:build windows || js || wasip1
// +build windows js wasip1

package diagnose

func redirectStderrToFile(_ string) error {
	return nil
}
