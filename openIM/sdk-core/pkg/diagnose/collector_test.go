package diagnose

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCollectorCapturePanicBasic(t *testing.T) {
	bc := NewBreadcrumbRing(32)
	bc.AddKV("info", "e1", "k", "v")
	bc.AddKV("warn", "e2")

	c := &Collector{
		Env: EnvInfo{
			SDKVersion: "v1",
			AppID:      "app",
		},
		BC: bc,
	}

	report := c.CapturePanic("boom")
	if report.Schema != 1 {
		t.Fatalf("expected schema 1, got %d", report.Schema)
	}
	if report.Env.SDKVersion != "v1" || report.Env.AppID != "app" {
		t.Fatalf("unexpected env: %+v", report.Env)
	}
	if report.Core.PanicValue != "boom" {
		t.Fatalf("expected panic value boom, got %q", report.Core.PanicValue)
	}
	if report.Core.PanicType == "" {
		t.Fatalf("expected panic type set")
	}
	if report.Core.StackCurrent == "" {
		t.Fatalf("expected stack current set")
	}
	if report.Core.Goroutines != "" {
		t.Fatalf("expected goroutines empty when disabled")
	}
	if len(report.Breadcrumbs) != 2 {
		t.Fatalf("expected 2 breadcrumbs, got %d", len(report.Breadcrumbs))
	}

	if len(report.Fingerprint) != 40 {
		t.Fatalf("expected fingerprint length 40, got %d", len(report.Fingerprint))
	}
}

func TestCollectorCapturePanicAllGoroutines(t *testing.T) {
	c := &Collector{
		Env:                   EnvInfo{},
		IncludeAllGoroutines:  true,
		MaxGoroutineDumpBytes: 1024,
	}
	report := c.CapturePanic("boom")
	if report.Core.Goroutines == "" {
		t.Fatalf("expected goroutine dump")
	}
	if !strings.Contains(report.Core.Goroutines, "goroutine") {
		t.Fatalf("expected goroutine dump to contain header")
	}
}

func TestCollectorCapturePanicFromRealPanic(t *testing.T) {
	c := &Collector{
		Env: EnvInfo{
			SDKVersion: "v1",
		},
		IncludeAllGoroutines: true,
	}
	defer func() {
		r := recover()
		if r == nil {
			t.Fatalf("expected panic")
		}
		report := c.CapturePanic(r)
		b, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			t.Fatalf("marshal report: %v", err)
		}
		t.Logf("crash report:\n%s", string(b))
	}()
	panic("real panic for test")
}
