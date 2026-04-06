package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetCaller(t *testing.T) {
	type args struct {
		skip int
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "test skip 0",
			args: args{skip: 1},
			want: "trigger_channel_test.go",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, GetCaller(tt.args.skip), "GetCaller(%v)", tt.args.skip)
		})
	}
}
