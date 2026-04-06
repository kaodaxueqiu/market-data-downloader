// Copyright © 2023 OpenIM SDK. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package test

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
)

func TestUploadFile(t *testing.T) {

	fp := `/Users/chao/Downloads/goland-2024.3.6-aarch64.dmg`

	done := make(chan struct{})
	go func() {
		defer close(done)
		time.Sleep(time.Second * 10)
		num := open_im_sdk.IMUserContext.File().CancelUpload(ctx, "123456")
		t.Log("cancel", num)
	}()

	resp, err := open_im_sdk.IMUserContext.File().UploadFile(ctx, &file.UploadFileReq{
		Filepath: fp,
		Name:     filepath.Base(fp),
		Cause:    "test",
		CancelID: "123456",
	}, &simpleProgress{t: t})
	if err != nil {
		t.Fatal(err)
		return
	}
	t.Log(resp)
	<-done
}

type simpleProgress struct {
	progress string
	t        *testing.T
}

func (p *simpleProgress) Open(size int64) {}

func (p *simpleProgress) PartSize(partSize int64, num int) {}

func (p *simpleProgress) HashPartProgress(index int, size int64, partHash string) {}

func (p *simpleProgress) HashPartComplete(partsHash string, fileHash string) {}

func (p *simpleProgress) UploadID(uploadID string) {}

func (p *simpleProgress) UploadPartComplete(index int, partSize int64, partHash string) {}

func (p *simpleProgress) UploadComplete(fileSize int64, streamSize int64, storageSize int64) {
	progress := fmt.Sprintf("%.2f", float64(streamSize)/float64(fileSize)*100)
	if p.progress != progress {
		p.progress = progress
		p.t.Logf("progress: %s%%", progress)
	}
}

func (p *simpleProgress) Complete(size int64, url string, typ int) {}
