//go:build js && wasm
// +build js,wasm

package indexdb

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/openim-sdk-core/v3/wasm/exec"
)

type HotKeys struct{}

func NewHotKeys() *HotKeys {
	return &HotKeys{}
}

func (i *HotKeys) LoadHotKeys(ctx context.Context, namespace string) (map[string]int64, error) {
	res, err := exec.Exec(namespace)
	if err != nil {
		return nil, err
	}
	if v, ok := res.(string); ok {
		result := make(map[string]int64)
		if v == "" {
			return result, nil
		}
		if err := utils.JsonStringToStruct(v, &result); err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, exec.ErrType
}

func (i *HotKeys) SaveHotKeys(ctx context.Context, namespace string, data map[string]int64) error {
	_, err := exec.Exec(namespace, utils.StructToJsonString(data))
	return err
}

func (i *HotKeys) ClearHotKeys(ctx context.Context, namespace string) error {
	_, err := exec.Exec(namespace)
	return err
}
