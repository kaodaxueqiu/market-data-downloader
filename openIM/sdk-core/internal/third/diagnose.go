package third

import (
	"context"
	"os"
	"path/filepath"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/diagnose"
	"github.com/openimsdk/tools/errs"
)

type crashUploader struct {
	t *Third
}

func (c *Third) CrashUploader() diagnose.Uploader {
	return crashUploader{t: c}
}

func (u crashUploader) Upload(ctx context.Context, filePath string) error {
	if u.t == nil || u.t.fileUploader == nil {
		return errs.New("crash uploader not initialized").Wrap()
	}
	if filePath == "" {
		return errs.New("crash file path is empty").Wrap()
	}
	if _, err := os.Stat(filePath); err != nil {
		return err
	}

	return u.t.uploadZipAndReport(ctx, filepath.Dir(filePath), []string{filePath}, "sdk_crash", "sdk_crash", "diagnose", "", nil)
}
