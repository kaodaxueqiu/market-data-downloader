package diagnose

import (
	"context"
	"sync"
)

var (
	defaultManagerMu sync.RWMutex
	defaultManager   *CrashManager
)

func SetDefaultManager(m *CrashManager) {
	defaultManagerMu.Lock()
	defaultManager = m
	defaultManagerMu.Unlock()
}

func DefaultManager() *CrashManager {
	defaultManagerMu.RLock()
	m := defaultManager
	defaultManagerMu.RUnlock()
	return m
}

func ReportPanic(ctx context.Context, p any) {
	m := DefaultManager()
	if m == nil {
		return
	}
	m.HandlePanic(ctx, p)
}

func Info(event string, kv ...string) {
	addBreadcrumb("info", event, kv...)
}

func Warn(event string, err error, kv ...string) {
	addBreadcrumbWithErr("warn", event, err, kv...)
}

func Error(event string, err error, kv ...string) {
	addBreadcrumbWithErr("error", event, err, kv...)
}

func addBreadcrumb(level, event string, kv ...string) {
	m := DefaultManager()
	if m == nil || m.Collector == nil || m.Collector.BC == nil {
		return
	}
	m.Collector.BC.AddKV(level, event, kv...)
}

func addBreadcrumbWithErr(level, event string, err error, kv ...string) {
	if err != nil {
		kv = append(kv, "err", err.Error())
	}
	addBreadcrumb(level, event, kv...)
}
