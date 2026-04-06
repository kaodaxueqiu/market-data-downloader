package diagnose

// EnvInfo describes the runtime and environment metadata of the SDK.
type EnvInfo struct {
	SDKVersion   string            `json:"sdk_version"`
	SDKCommit    string            `json:"sdk_commit,omitempty"`
	GoVersion    string            `json:"go_version"`
	Platform     string            `json:"platform"`
	Arch         string            `json:"arch"`
	AppID        string            `json:"app_id,omitempty"`
	AppVersion   string            `json:"app_version,omitempty"`
	DeviceIDHash string            `json:"device_id_hash,omitempty"` // Hashed device identifier provided by host app
	OSVersion    string            `json:"os_version,omitempty"`     // OS version provided by host app
	Extras       map[string]string `json:"extras,omitempty"`         // Feature flags or extra environment metadata
}

// RuntimeSnapshot captures Go runtime statistics at crash time.
type RuntimeSnapshot struct {
	NumGoroutine  int    `json:"num_goroutine"`
	MemAlloc      uint64 `json:"mem_alloc"`
	MemSys        uint64 `json:"mem_sys"`
	HeapAlloc     uint64 `json:"heap_alloc"`
	HeapInuse     uint64 `json:"heap_inuse"`
	HeapObjects   uint64 `json:"heap_objects"`
	NumGC         uint32 `json:"num_gc"`
	LastGCPauseNs uint64 `json:"last_gc_pause_ns"`
}

// Breadcrumb represents a recent diagnostic event before the crash.
type Breadcrumb struct {
	FormattedTs string            `json:"formatted_ts"`
	Level       string            `json:"level"`            // info / warn / error
	Event       string            `json:"event"`            // e.g. "SendMessage"
	Fields      map[string]string `json:"fields,omitempty"` // Key fields with sensitive data masked or hashed
}

// CrashCore contains the core crash information.
type CrashCore struct {
	WhenUnixMsStr string `json:"when_unix_ms_str"`
	PanicValue    string `json:"panic_value"`
	PanicType     string `json:"panic_type,omitempty"`
	StackCurrent  string `json:"stack_current"`        // Stack trace of the panicking goroutine
	Goroutines    string `json:"goroutines,omitempty"` // Optional full goroutine dump
}

// CrashReport is the complete diagnostic report generated on SDK crash.
type CrashReport struct {
	Schema      int             `json:"schema"` // Schema version for forward compatibility
	Env         EnvInfo         `json:"env"`
	Core        CrashCore       `json:"core"`
	Runtime     RuntimeSnapshot `json:"runtime"`
	Breadcrumbs []Breadcrumb    `json:"breadcrumbs,omitempty"`

	// Fingerprint is a stable hash derived from the stack trace,
	// used for crash deduplication and aggregation.
	Fingerprint string `json:"fingerprint"`
}
