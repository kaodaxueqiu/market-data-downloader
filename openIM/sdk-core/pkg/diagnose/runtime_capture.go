package diagnose

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"sync"
	"time"
)

const (
	stderrCurrentName = "stderr.log"
	stderrPrefix      = "stderr_"
	stderrExt         = ".log"
)

var (
	runtimeCaptureMu  sync.Mutex
	runtimeCaptureDir string
)

// InitRuntimeCapture enables crash traceback output and redirects stderr to a file in dir.
// It is safe to call multiple times; subsequent calls can update the dir.
func InitRuntimeCapture(dir string) error {
	if dir == "" {
		return errors.New("diag dir empty")
	}
	runtimeCaptureMu.Lock()
	defer runtimeCaptureMu.Unlock()

	if runtimeCaptureDir == dir {
		return nil
	}
	debug.SetTraceback("crash")
	if runtimeCaptureDir != "" && runtimeCaptureDir != dir {
		_ = rotateStderrLog(runtimeCaptureDir)
	}
	if err := initStderrCapture(dir); err != nil {
		return err
	}
	runtimeCaptureDir = dir
	return nil
}

func initStderrCapture(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := rotateStderrLog(dir); err != nil {
		return err
	}
	path := filepath.Join(dir, stderrCurrentName)
	return redirectStderrToFile(path)
}

func rotateStderrLog(dir string) error {
	path := filepath.Join(dir, stderrCurrentName)
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.Size() == 0 {
		return os.Remove(path)
	}
	ts := time.Now().Format("2006-01-02_23-04-05.999")
	target := filepath.Join(dir, fmt.Sprintf("%s%s%s", stderrPrefix, ts, stderrExt))
	return os.Rename(path, target)
}
