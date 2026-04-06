package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/internal/third"
	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
)

type SProgress struct{}

func (s SProgress) OnProgress(current int64, size int64) {

}

func Test_UploadLog(t *testing.T) {
	tm := time.Now()
	err := open_im_sdk.IMUserContext.Third().UploadLogs(ctx, 2000, "", "it is ex", SProgress{})
	if err != nil {
		t.Error(err)
	}
	fmt.Println(time.Since(tm).String())

}
func Test_SDKLogs(t *testing.T) {
	open_im_sdk.IMUserContext.Third().Log(ctx, 4, "cmd/abc.go", 666, "This is a test message", "", []any{"key", "value"})
}

func Test_TextCapabilities(t *testing.T) {
	//res1, err := open_im_sdk.IMUserContext.Third().SpeechToTextCapabilities(ctx)
	//if err != nil {
	//	t.Error(err)
	//	return
	//}
	//t.Log(res1)
	//res2, err := open_im_sdk.IMUserContext.Third().SpeechToTextCapabilities(ctx)
	//if err != nil {
	//	t.Error(err)
	//	return
	//}
	//t.Log(res2)
	var filename string
	filename = "/Users/x/Downloads/nls-sample-16k.wav"
	//filename = "/Users/x/Downloads/1769655367534.wav"

	res3, err := open_im_sdk.IMUserContext.Third().SpeechToText(ctx, &third.SpeechToTextReq{Filename: filename})
	if err != nil {
		t.Error(err)
		return
	}
	t.Log(res3)
}

func Test_SDKUploadFile(t *testing.T) {
	tt, err := open_im_sdk.IMUserContext.File().UploadFile(ctx, &file.UploadFileReq{
		Filepath: "/Users/openim/GolandProjects/open-im-sdk-core-enterprise/test/init.go",
		Name:     "111",
	}, nil)
	if err != nil {
		t.Error(err)
	}
	t.Log(tt)
}
