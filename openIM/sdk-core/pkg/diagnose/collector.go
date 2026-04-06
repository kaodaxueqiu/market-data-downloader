package diagnose

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

type Collector struct {
	Env EnvInfo
	BC  *BreadcrumbRing

	IncludeAllGoroutines  bool
	MaxGoroutineDumpBytes int
}

func (c *Collector) CapturePanic(p any) CrashReport {
	when := time.Now().Format("2006-01-02 15:04:05.999")

	// Stack of the panicking goroutine only.
	stackCur := debug.Stack()

	var all string
	if c.IncludeAllGoroutines {
		// Optional full goroutine dump, size-limited to avoid huge reports.
		bufSize := 1 << 20 // 1MB
		if c.MaxGoroutineDumpBytes > 0 {
			bufSize = c.MaxGoroutineDumpBytes
		}
		b := make([]byte, bufSize)
		n := runtime.Stack(b, true)
		all = string(b[:n])
	}

	// Capture a small runtime snapshot for quick triage.
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	rs := RuntimeSnapshot{
		NumGoroutine: runtime.NumGoroutine(),
		MemAlloc:     ms.Alloc,
		MemSys:       ms.Sys,
		HeapAlloc:    ms.HeapAlloc,
		HeapInuse:    ms.HeapInuse,
		HeapObjects:  ms.HeapObjects,
		NumGC:        ms.NumGC,
	}
	if ms.NumGC > 0 {
		rs.LastGCPauseNs = ms.PauseNs[(ms.NumGC-1)%uint32(len(ms.PauseNs))]
	}

	panicType := fmt.Sprintf("%T", p)
	panicValue := fmt.Sprint(p)

	// Stable fingerprint derived from the current stack for deduplication.
	fp := fingerprintFromStack(stackCur)

	report := CrashReport{
		Schema: 1,
		Env: EnvInfo{
			SDKVersion:   c.Env.SDKVersion,
			SDKCommit:    c.Env.SDKCommit,
			GoVersion:    runtime.Version(),
			Platform:     runtime.GOOS,
			Arch:         runtime.GOARCH,
			AppID:        c.Env.AppID,
			AppVersion:   c.Env.AppVersion,
			DeviceIDHash: c.Env.DeviceIDHash,
			OSVersion:    c.Env.OSVersion,
			Extras:       c.Env.Extras,
		},
		Core: CrashCore{
			WhenUnixMsStr: when,
			PanicType:     panicType,
			PanicValue:    panicValue,
			StackCurrent:  string(stackCur),
			Goroutines:    all,
		},
		Runtime:     rs,
		Breadcrumbs: nil,
		Fingerprint: fp,
	}

	if c.BC != nil {
		// Snapshot breadcrumbs to provide the recent event trail.
		report.Breadcrumbs = c.BC.Snapshot()
	}
	return report
}

func fingerprintFromStack(stack []byte) string {

	lines := strings.Split(string(stack), "\n")
	var keep []string
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		// Skip raw addresses to make the fingerprint stable across builds.
		if strings.HasPrefix(ln, "0x") {
			continue
		}
		keep = append(keep, ln)
		if len(keep) >= 40 {
			// Cap input size to keep hash stable and cheap.
			break
		}
	}
	h := sha1.Sum([]byte(strings.Join(keep, "\n")))
	return hex.EncodeToString(h[:])
}
