package third

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/api"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/sdkerrs"
	"github.com/openimsdk/protocol/constant"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/protocol/third"
)

type TimerTaskSuccessCondition struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type MessagePayload struct {
	RecvIDs  []string       `json:"recvIDs"`
	GroupIDs []string       `json:"groupIDs"`
	Msg      *sdkws.MsgData `json:"msg"`
}

func (m MessagePayload) Validate() error {
	if len(m.RecvIDs) == 0 && len(m.GroupIDs) == 0 {
		return errors.New("at least one recvID or groupID is required")
	}
	return nil
}

type HttpPayload struct {
	Addr             string                     `json:"addr"`
	Header           map[string]string          `json:"header"`
	Method           string                     `json:"method"`
	Binary           bool                       `json:"binary"`
	Body             string                     `json:"body"`
	SuccessCondition *TimerTaskSuccessCondition `json:"successCondition,omitempty"`
}

func (h HttpPayload) Validate() error {
	if h.Addr == "" {
		return errors.New("addr is required")
	}
	if h.Method == "" {
		return errors.New("method is required")
	}
	return nil
}

type RpcPayload struct {
	TypeUrl string `json:"typeUrl"`
	Value   []byte `json:"value"`
	Service string `json:"service"`
	Method  string `json:"method"`
}

func (r RpcPayload) Validate() error {
	if r.TypeUrl == "" {
		return errors.New("typeUrl is required")
	}
	if r.Service == "" {
		return errors.New("service is required")
	}
	if r.Method == "" {
		return errors.New("method is required")
	}
	return nil
}

type PresetPayload struct {
	PresetKey string            `json:"presetKey"`
	Body      PresetPayloadBody `json:"body,omitempty"`
}

func (p *PresetPayload) UnmarshalJSON(data []byte) error {
	type rawPresetPayload struct {
		PresetKey string          `json:"presetKey"`
		Body      json.RawMessage `json:"body"`
	}
	var raw rawPresetPayload
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	p.PresetKey = raw.PresetKey
	if len(raw.Body) == 0 || string(raw.Body) == "null" {
		p.Body = nil
		return nil
	}
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw.Body, &probe); err != nil {
		return err
	}
	if _, ok := probe["value"]; ok {
		var body PresetPayloadBodyRpc
		if err := json.Unmarshal(raw.Body, &body); err != nil {
			return err
		}
		p.Body = &body
		return nil
	}
	var body PresetPayloadBodyHttp
	if err := json.Unmarshal(raw.Body, &body); err != nil {
		return err
	}
	p.Body = &body
	return nil
}

type PresetPayloadBody interface {
	isPresetPayloadBody()
}

type PresetPayloadBodyHttp struct {
	Body             string                     `json:"body"`
	SuccessCondition *TimerTaskSuccessCondition `json:"successCondition,omitempty"`
}

func (p *PresetPayloadBodyHttp) isPresetPayloadBody() {}

type PresetPayloadBodyRpc struct {
	Value []byte `json:"value"`
}

func (p *PresetPayloadBodyRpc) isPresetPayloadBody() {}

func (p PresetPayload) Validate() error {
	if p.PresetKey == "" {
		return errors.New("presetKey is required")
	}
	if p.Body == nil {
		return errors.New("presetBody is required")
	}
	return nil
}

type CreateTimerTaskBase struct {
	TaskName      string `json:"taskName"`
	TaskCategory  string `json:"taskCategory"`
	ExecuteAt     int64  `json:"executeAt"`
	ExecuteBefore int64  `json:"executeBefore"`
	MaxRetry      int64  `json:"maxRetry"`
	DedupKey      string `json:"dedupKey"`
	UserID        string `json:"userID"`
}

type CreateMessageTimerTaskReq struct {
	CreateTimerTaskBase
	Payload *MessagePayload `json:"payload"`
}

type CreateHttpTimerTaskReq struct {
	CreateTimerTaskBase
	Payload *HttpPayload `json:"payload"`
}

type CreateRpcTimerTaskReq struct {
	CreateTimerTaskBase
	Payload *RpcPayload `json:"payload"`
}

type CreatePresetTimerTaskReq struct {
	CreateTimerTaskBase
	Payload *PresetPayload `json:"payload"`
}

type UpdateTimerTaskBase struct {
	TaskID        string  `json:"taskID"`
	TaskName      *string `json:"taskName,omitempty"`
	TaskCategory  *string `json:"taskCategory,omitempty"`
	ExecuteAt     *int64  `json:"executeAt,omitempty"`
	ExecuteBefore *int64  `json:"executeBefore,omitempty"`
	MaxRetry      *int64  `json:"maxRetry,omitempty"`
	UserID        string  `json:"userID"`
}

type UpdateMessageTimerTaskReq struct {
	UpdateTimerTaskBase
	Payload *MessagePayload `json:"payload"`
}

type UpdateHttpTimerTaskReq struct {
	UpdateTimerTaskBase
	Payload *HttpPayload `json:"payload"`
}

type UpdateRpcTimerTaskReq struct {
	UpdateTimerTaskBase
	Payload *RpcPayload `json:"payload"`
}

type UpdatePresetTimerTaskReq struct {
	UpdateTimerTaskBase
	Payload *PresetPayload `json:"payload"`
}

type timerPayloadValidator interface {
	Validate() error
}

func marshalTimerPayload(payload timerPayloadValidator) (string, error) {
	if payload == nil {
		return "", sdkerrs.ErrArgs.WrapMsg("payload is nil")
	}
	if err := payload.Validate(); err != nil {
		return "", sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", sdkerrs.ErrSdkInternal.WrapMsg("marshal payload failed: " + err.Error())
	}
	return string(data), nil
}

func (c *Third) CreateTimerTask(ctx context.Context, req *third.CreateTimerTaskReq) (*third.CreateTimerTaskResp, error) {
	if req == nil {
		return nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	if req.UserID == "" {
		req.UserID = c.loginUserID
	}
	if err := req.Check(); err != nil {
		return nil, sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.CreateTimerTask.Invoke(ctx, req)
}

func (c *Third) UpdateTimerTask(ctx context.Context, req *third.UpdateTimerTaskReq) error {
	if req == nil {
		return sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	if req.UserID == "" {
		req.UserID = c.loginUserID
	}
	if err := req.Check(); err != nil {
		return sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.UpdateTimerTask.Execute(ctx, req)
}

func (c *Third) GetTimerTask(ctx context.Context, req *third.GetTimerTaskReq) (*third.GetTimerTaskResp, error) {
	if req == nil {
		return nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	if req.TaskID == "" {
		return nil, sdkerrs.ErrArgs.WrapMsg("taskID is empty")
	}
	if req.UserID == "" {
		req.UserID = c.loginUserID
	}
	if err := req.Check(); err != nil {
		return nil, sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.GetTimerTask.Invoke(ctx, req)
}

func (c *Third) DeleteTimerTask(ctx context.Context, req *third.DeleteTimerTaskReq) error {
	if req == nil {
		return sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	if req.TaskID == "" {
		return sdkerrs.ErrArgs.WrapMsg("taskID is empty")
	}
	if req.UserID == "" {
		req.UserID = c.loginUserID
	}
	if err := req.Check(); err != nil {
		return sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.DeleteTimerTask.Execute(ctx, req)
}

func (c *Third) ListTimerTasks(ctx context.Context, req *third.ListTimerTasksReq) (*third.ListTimerTasksResp, error) {
	if req == nil {
		return nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	if req.UserID == "" {
		req.UserID = c.loginUserID
	}
	if err := req.Check(); err != nil {
		return nil, sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.ListTimerTasks.Invoke(ctx, req)
}

func (c *Third) CreateMessageTimerTask(ctx context.Context, req *CreateMessageTimerTaskReq) (*third.CreateTimerTaskResp, error) {
	return c.createTimerTask(ctx, req, constant.TimerTaskCallbackMethodMessage)
}

func (c *Third) CreateHttpTimerTask(ctx context.Context, req *CreateHttpTimerTaskReq) (*third.CreateTimerTaskResp, error) {
	return c.createTimerTask(ctx, req, constant.TimerTaskCallbackMethodHttp)
}

func (c *Third) CreateRpcTimerTask(ctx context.Context, req *CreateRpcTimerTaskReq) (*third.CreateTimerTaskResp, error) {
	return c.createTimerTask(ctx, req, constant.TimerTaskCallbackMethodRpc)
}

func (c *Third) CreatePresetTimerTask(ctx context.Context, req *CreatePresetTimerTaskReq) (*third.CreateTimerTaskResp, error) {
	return c.createTimerTask(ctx, req, constant.TimerTaskCallbackMethodPreset)
}

func (c *Third) UpdateMessageTimerTask(ctx context.Context, req *UpdateMessageTimerTaskReq) error {
	return c.updateTimerTask(ctx, req, constant.TimerTaskCallbackMethodMessage)
}

func (c *Third) UpdateHttpTimerTask(ctx context.Context, req *UpdateHttpTimerTaskReq) error {
	return c.updateTimerTask(ctx, req, constant.TimerTaskCallbackMethodHttp)
}

func (c *Third) UpdateRpcTimerTask(ctx context.Context, req *UpdateRpcTimerTaskReq) error {
	return c.updateTimerTask(ctx, req, constant.TimerTaskCallbackMethodRpc)
}

func (c *Third) UpdatePresetTimerTask(ctx context.Context, req *UpdatePresetTimerTaskReq) error {
	return c.updateTimerTask(ctx, req, constant.TimerTaskCallbackMethodPreset)
}

func (c *Third) createTimerTask(ctx context.Context, req interface{}, callbackMethod string) (*third.CreateTimerTaskResp, error) {
	if req == nil {
		return nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	base, payload, err := extractCreateReq(req)
	if err != nil {
		return nil, err
	}
	callbackPayload, err := marshalTimerPayload(payload)
	if err != nil {
		return nil, err
	}

	userID := base.UserID
	if userID == "" {
		userID = c.loginUserID
	}
	createReq := &third.CreateTimerTaskReq{
		TaskName:      base.TaskName,
		TaskCategory:  base.TaskCategory,
		ExecuteAt:     base.ExecuteAt,
		ExecuteBefore: base.ExecuteBefore,
		MaxRetry:      base.MaxRetry,
		CallbackConfig: &third.TimerTaskCallbackConfig{
			CallbackMethod:  callbackMethod,
			CallbackPayload: callbackPayload,
		},
		UserID:   userID,
		DedupKey: base.DedupKey,
	}
	if err := createReq.Check(); err != nil {
		return nil, sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.CreateTimerTask.Invoke(ctx, createReq)
}

func (c *Third) updateTimerTask(ctx context.Context, req interface{}, callbackMethod string) error {
	if req == nil {
		return sdkerrs.ErrArgs.WrapMsg("request is nil")
	}
	base, payload, err := extractUpdateReq(req)
	if err != nil {
		return err
	}
	callbackPayload, err := marshalTimerPayload(payload)
	if err != nil {
		return err
	}

	if base.TaskID == "" {
		return sdkerrs.ErrArgs.WrapMsg("taskID is empty")
	}
	userID := base.UserID
	if userID == "" {
		userID = c.loginUserID
	}
	updateReq := &third.UpdateTimerTaskReq{
		TaskID:        base.TaskID,
		TaskName:      base.TaskName,
		TaskCategory:  base.TaskCategory,
		ExecuteAt:     base.ExecuteAt,
		ExecuteBefore: base.ExecuteBefore,
		MaxRetry:      base.MaxRetry,
		CallbackConfig: &third.TimerTaskCallbackConfig{
			CallbackMethod:  callbackMethod,
			CallbackPayload: callbackPayload,
		},
		UserID: userID,
	}
	if err := updateReq.Check(); err != nil {
		return sdkerrs.ErrArgs.WrapMsg(err.Error())
	}
	return api.UpdateTimerTask.Execute(ctx, updateReq)
}

func extractCreateReq(req interface{}) (*CreateTimerTaskBase, timerPayloadValidator, error) {
	switch typed := req.(type) {
	case *CreateMessageTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.CreateTimerTaskBase, typed.Payload, nil
	case *CreateHttpTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.CreateTimerTaskBase, typed.Payload, nil
	case *CreateRpcTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.CreateTimerTaskBase, typed.Payload, nil
	case *CreatePresetTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.CreateTimerTaskBase, typed.Payload, nil
	default:
		return nil, nil, sdkerrs.ErrArgs.WrapMsg("unsupported create timer task request")
	}
}

func extractUpdateReq(req interface{}) (*UpdateTimerTaskBase, timerPayloadValidator, error) {
	switch typed := req.(type) {
	case *UpdateMessageTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.UpdateTimerTaskBase, typed.Payload, nil
	case *UpdateHttpTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.UpdateTimerTaskBase, typed.Payload, nil
	case *UpdateRpcTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.UpdateTimerTaskBase, typed.Payload, nil
	case *UpdatePresetTimerTaskReq:
		if typed == nil {
			return nil, nil, sdkerrs.ErrArgs.WrapMsg("request is nil")
		}
		return &typed.UpdateTimerTaskBase, typed.Payload, nil
	default:
		return nil, nil, sdkerrs.ErrArgs.WrapMsg("unsupported update timer task request")
	}
}
