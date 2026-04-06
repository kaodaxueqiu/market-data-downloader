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
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/openimsdk/protocol/constant"
)

var (
	APIADDR     string
	WSADDR      string
	UserID      string
	PlatformID  int32
	Secret      string
	AdminUserID string
)

func init() {
	// OPENIM_APIADDR=http://127.0.0.1:10002;OPENIM_WSADDR=ws://127.0.0.1:10001;OPENIM_USER_ID=8311379651;OPENIM_SECRET=openIM123;OPENIM_ADMIN_USER_ID=imAdmin;OPENIM_PLATFORM_ID=7
	loadDotEnv()
	APIADDR = envString("OPENIM_APIADDR", "https://api.example.com/api")
	WSADDR = envString("OPENIM_WSADDR", "wss://ws.example.com/msg_gateway")
	UserID = envString("OPENIM_USER_ID", "1234567890")
	PlatformID = envInt32("OPENIM_PLATFORM_ID", constant.LinuxPlatformID)
	Secret = envString("OPENIM_SECRET", "replace_with_secret")
	AdminUserID = envString("OPENIM_ADMIN_USER_ID", "replace_with_admin")
}

func envString(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt32(key string, fallback int32) int32 {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return int32(i)
		}
	}
	return fallback
}

func loadDotEnv() {
	path, ok := findDotEnv()
	if !ok {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

func findDotEnv() (string, bool) {
	dir, err := os.Getwd()
	if err != nil {
		return "", false
	}
	for {
		path := filepath.Join(dir, ".env")
		if _, err := os.Stat(path); err == nil {
			return path, true
		}
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return "", false
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}
