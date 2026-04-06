package diagnose

import (
	"context"
	"os"
	"path/filepath"
	"strings"
)

type Uploader interface {
	Upload(ctx context.Context, filePath string) error
}

type CrashManager struct {
	Collector *Collector
	Persister *Persister
	Uploader  Uploader

	UploadOnStart bool
}

func (m *CrashManager) HandlePanic(ctx context.Context, p any) {
	if m == nil || m.Collector == nil || m.Persister == nil {
		return
	}

	report := m.Collector.CapturePanic(p)

	_, _ = m.Persister.Save(report)
}

func (m *CrashManager) StartBackgroundUpload(ctx context.Context) {
	if m.Uploader == nil || m.Persister == nil {
		return
	}

	// Best-effort upload of existing crash reports at startup.
	if m.UploadOnStart {
		_ = m.uploadOnce(ctx)
	}
}

func (m *CrashManager) uploadOnce(ctx context.Context) error {
	dir := m.Persister.Dir
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	maxBatch := 3
	count := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		nameLower := strings.ToLower(name)
		if !isUploadCandidate(nameLower) {
			continue
		}
		if count >= maxBatch {
			break
		}

		path := filepath.Join(dir, name)
		if err := m.Uploader.Upload(ctx, path); err != nil {
			continue
		}
		// Delete only after successful upload.
		_ = os.Remove(path)
		count++
	}
	return nil
}

func isUploadCandidate(nameLower string) bool {
	if strings.HasPrefix(nameLower, "crash_") && strings.HasSuffix(nameLower, ".json") {
		return true
	}
	if strings.HasPrefix(nameLower, stderrPrefix) && strings.HasSuffix(nameLower, stderrExt) {
		return true
	}
	return false
}
