package diagnose

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type Persister struct {
	Dir             string
	MaxFiles        int
	MaxBytesPerFile int64
}

func (p *Persister) EnsureDir() error {
	if p.Dir == "" {
		return errors.New("diag dir empty")
	}
	return os.MkdirAll(p.Dir, 0o755)
}

func (p *Persister) Save(report CrashReport) (string, error) {
	if err := p.EnsureDir(); err != nil {
		return "", err
	}

	ts := time.Now().UTC().Format("2006-01-02_15-04-05")
	name := fmt.Sprintf("crash_%s_%s.json", ts, report.Fingerprint[:8])
	tmp := filepath.Join(p.Dir, name+".tmp")
	final := filepath.Join(p.Dir, name)

	// Write to a temp file and atomically rename to avoid partial files.
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var w = f

	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	if err := enc.Encode(&report); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}

	_ = f.Sync()
	_ = f.Close()

	if err := os.Rename(tmp, final); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}

	// Prune old crash files to cap on-disk size.
	_ = p.prune()

	return final, nil
}

func (p *Persister) prune() error {
	if p.MaxFiles <= 0 {
		p.MaxFiles = 20
	}
	entries, err := os.ReadDir(p.Dir)
	if err != nil {
		return err
	}

	type item struct {
		path string
		mod  time.Time
	}
	var items []item
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if filepath.Ext(e.Name()) == ".tmp" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		items = append(items, item{path: filepath.Join(p.Dir, e.Name()), mod: info.ModTime()})
	}

	if len(items) <= p.MaxFiles {
		return nil
	}

	for len(items) > p.MaxFiles {
		// Remove the oldest file until under the cap.
		oldest := 0
		for i := 1; i < len(items); i++ {
			if items[i].mod.Before(items[oldest].mod) {
				oldest = i
			}
		}
		_ = os.Remove(items[oldest].path)
		items = append(items[:oldest], items[oldest+1:]...)
	}
	return nil
}
