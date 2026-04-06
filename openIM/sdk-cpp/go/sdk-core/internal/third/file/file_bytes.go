package file

import (
	"bytes"
)

func newFileBytes(data []byte) *fileBytes {
	fb := &fileBytes{
		data: data,
		raw:  bytes.NewReader(data),
	}
	return fb
}

type fileBytes struct {
	data []byte
	raw  *bytes.Reader
}

func (f *fileBytes) Read(p []byte) (int, error) {
	return f.raw.Read(p)
}

func (f *fileBytes) Close() error {
	return nil
}

func (f *fileBytes) Size() int64 {
	return int64(len(f.data))
}

func (f *fileBytes) StartSeek(whence int) error {
	f.raw = bytes.NewReader(f.data[whence:])
	return nil
}
