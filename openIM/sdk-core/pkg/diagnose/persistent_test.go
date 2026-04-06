package diagnose

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newCrashReport(fp string) CrashReport {
	return CrashReport{
		Schema: 1,
		Env: EnvInfo{
			SDKVersion: "v1",
		},
		Core: CrashCore{
			WhenUnixMsStr: "1",
			PanicValue:    "boom",
			PanicType:     "string",
			StackCurrent:  "stack",
		},
		Runtime:     RuntimeSnapshot{},
		Fingerprint: fp,
	}
}

func countCrashFiles(t *testing.T, dir string) int {
	t.Helper()
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
	return count
}

func TestPersisterSaveAndPrune(t *testing.T) {
	dir := t.TempDir()
	p := &Persister{Dir: dir, MaxFiles: 2}

	sessionFileName := "session.json"

	if err := os.WriteFile(filepath.Join(dir, sessionFileName), []byte(`{"schema":1,"running":true}`), 0o600); err != nil {
		t.Fatalf("write session: %v", err)
	}

	for _, fp := range []string{"aaaaaaaa", "bbbbbbbb", "cccccccc"} {
		if _, err := p.Save(newCrashReport(fp)); err != nil {
			t.Fatalf("save: %v", err)
		}
	}

	if got := countCrashFiles(t, dir); got != 2 {
		t.Fatalf("expected 2 crash files after prune, got %d", got)
	}

	if _, err := os.Stat(filepath.Join(dir, sessionFileName)); err != nil {
		t.Fatalf("expected session file to exist: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	for _, e := range entries {
		if !strings.HasPrefix(strings.ToLower(e.Name()), "crash_") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read crash file: %v", err)
		}
		var report CrashReport
		if err := json.Unmarshal(data, &report); err != nil {
			t.Fatalf("unmarshal crash report: %v", err)
		}
		if report.Fingerprint == "" {
			t.Fatalf("expected fingerprint to be set")
		}
		break
	}
}

func TestPersisterSaveDirEmpty(t *testing.T) {
	p := &Persister{}
	if _, err := p.Save(newCrashReport("aaaaaaaa")); err == nil {
		t.Fatalf("expected error for empty dir")
	}
}
