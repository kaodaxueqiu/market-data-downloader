package diagnose

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
)

type fakeUploader struct {
	mu    sync.Mutex
	paths []string
	err   error
}

func (f *fakeUploader) Upload(ctx context.Context, filePath string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.paths = append(f.paths, filePath)
	return f.err
}

func (f *fakeUploader) Paths() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.paths))
	copy(out, f.paths)
	return out
}

func TestCrashManagerHandlePanicWritesReport(t *testing.T) {
	dir := t.TempDir()
	m := &CrashManager{
		Collector: &Collector{Env: EnvInfo{}},
		Persister: &Persister{Dir: dir},
	}
	m.HandlePanic(context.Background(), "boom")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := strings.ToLower(e.Name())
		if strings.HasPrefix(name, "crash_") && strings.HasSuffix(name, ".json") {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected 1 crash report, got %d", count)
	}
}
