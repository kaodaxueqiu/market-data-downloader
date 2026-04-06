package third

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/internal/third/file"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/network"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/protocol/third"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/mcontext"
)

type SpeechToTextReq struct {
	Filename string `json:"filename"`
	Data     []byte `json:"data"`
}

type SpeechToTextResp struct {
	Text string `json:"text"`
}

func (t *Third) SpeechToTextCapabilities(ctx context.Context) (*third.GetASRCapabilitiesResp, error) {
	return t.asrCapCache.Get(ctx, func(ctx context.Context) (*third.GetASRCapabilitiesResp, time.Duration, error) {
		resp, err := api.GetASRCapabilities.Invoke(ctx, &third.GetASRCapabilitiesReq{})
		if err != nil {
			return nil, 0, err
		}
		return resp, time.Minute * 3, nil
	})
}

func (t *Third) SpeechToText(ctx context.Context, req *SpeechToTextReq) (*SpeechToTextResp, error) {
	var data []byte
	if req.Filename == "" {
		data = req.Data
	} else {
		reader, err := file.Open(&file.UploadFileReq{Filepath: req.Filename, Uuid: req.Filename})
		if err != nil {
			return nil, err
		}
		defer reader.Close()
		data, err = io.ReadAll(reader)
		if err != nil {
			return nil, err
		}
	}
	if len(data) == 0 {
		return nil, errs.ErrArgs.WrapMsg("the audio file is empty")
	}
	res, err := t.SpeechToTextCapabilities(ctx)
	if err != nil {
		return nil, err
	}
	if res.RequestType != "body" {
		return t.compatibilitySpeechToText(ctx, data)
	}
	if (!res.CrossDomain) && (runtime.GOOS == "js" || runtime.GOARCH == "wasm") {
		return t.compatibilitySpeechToText(ctx, data)
	}
	return t.speechToText(ctx, data)
}

func (t *Third) speechToText(ctx context.Context, data []byte) (*SpeechToTextResp, error) {
	resp, err := t.getASRTranscriptionURL(ctx)
	if err != nil {
		return nil, err
	}
	if resp.RequestType != "body" {
		return t.compatibilitySpeechToText(ctx, data)
	}
	request, err := http.NewRequestWithContext(ctx, resp.Method, resp.Url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	request.ContentLength = int64(len(data))
	for k, v := range resp.Header {
		request.Header.Set(k, v)
	}
	httpResp, err := network.GetHttpClient().Do(request)
	if err != nil {
		return nil, err
	}
	defer httpResp.Body.Close()
	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		log.ZWarn(ctx, "read asr response body failed", err, "url", resp.Url, "status", httpResp.StatusCode, "header", httpResp.Header)
		return nil, err
	}
	log.ZDebug(ctx, "asr response", "url", resp.Url, "status", httpResp.StatusCode, "header", httpResp.Header, "body", string(body))
	var respJson map[string]json.RawMessage
	if err := json.Unmarshal(body, &respJson); err != nil {
		log.ZWarn(ctx, "unmarshal asr response body failed", err, "url", resp.Url, "status", httpResp.StatusCode, "header", httpResp.Header, "body", string(body))
		return nil, err
	}
	if string(respJson[resp.ResponseStatusField]) != resp.ResponseSuccessValue {
		return nil, sdkerrs.ErrNetwork.WrapMsg("asr response failed", body, string(body))
	}
	text := strings.Trim(string(respJson[resp.ResponseResultField]), `"`)
	return &SpeechToTextResp{
		Text: text,
	}, nil
}

func (t *Third) getASRTranscriptionURL(ctx context.Context) (*third.GetASRTranscriptionURLResp, error) {
	if t.asrTranscriptionURLCache == nil {
		return api.GetASRTranscriptionURL.Invoke(ctx, &third.GetASRTranscriptionURLReq{})
	}
	return t.asrTranscriptionURLCache.Get(ctx, func(ctx context.Context) (*third.GetASRTranscriptionURLResp, time.Duration, error) {
		resp, err := api.GetASRTranscriptionURL.Invoke(ctx, &third.GetASRTranscriptionURLReq{})
		if err != nil {
			return nil, 0, err
		}
		const maxTTL = time.Minute * 10
		var ttl time.Duration
		if resp.ExpireTime > 0 {
			expireAt := time.UnixMilli(resp.ExpireTime)
			if expireAt.After(time.Now()) {
				ttl = time.Until(expireAt)
				if ttl > maxTTL {
					ttl = maxTTL
				}
			}
		}
		return resp, ttl, nil
	})
}

func (t *Third) compatibilitySpeechToText(ctx context.Context, data []byte) (*SpeechToTextResp, error) {
	uploadReq := &file.UploadFileReq{
		Data:     data,
		CancelID: mcontext.GetOperationID(ctx),
		Name:     fmt.Sprintf("asr_temp_%x.wav", md5.Sum(data)),
		Cause:    "asr-temp",
	}
	uploadResp, err := t.fileUploader.UploadFile(ctx, uploadReq, nil)
	if err != nil {
		log.ZWarn(ctx, "upload asr file failed", err)
		return nil, err
	}
	asrResp, err := api.GetASRRecognitionURL.Invoke(ctx, &third.GetASRRecognitionURLReq{Url: uploadResp.URL})
	if err != nil {
		return nil, err
	}
	return &SpeechToTextResp{Text: asrResp.Text}, nil
}
