//go:build !js
// +build !js

package db

import (
	"reflect"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestBuildMigrationPath(t *testing.T) {
	tests := []struct {
		name         string
		currentVer   string
		targetVer    string
		wantPath     []string
		wantError    bool
		errorMessage string
	}{
		// Normal upgrade paths
		{
			name:       "upgrade from v3.5.0 to v3.8.0",
			currentVer: "v3.5.0",
			targetVer:  "v3.8.0",
			wantPath:   []string{"v3.6.0", "v3.7.0", "v3.8.0"},
		},
		{
			name:       "upgrade from v3.7.0 to v3.8.4",
			currentVer: "v3.7.0",
			targetVer:  "v3.8.4",
			wantPath:   []string{"v3.8.0", "v3.8.4"},
		},

		// Commercial version handling
		{
			name:       "commercial version upgrade",
			currentVer: "v3.6.0-e-v1.2.3",
			targetVer:  "v3.8.4-e-v2.0.0",
			wantPath:   []string{"v3.7.0", "v3.8.0", "v3.8.4"},
		},

		// Edge cases
		{
			name:       "already at target version",
			currentVer: "v3.8.4",
			targetVer:  "v3.8.4",
			wantPath:   nil,
		},
		{
			name:       "initial installation (v0.0.0)",
			currentVer: "",
			targetVer:  "v3.8.4",
			wantPath:   []string{"v3.5.0", "v3.6.0", "v3.7.0", "v3.8.0", "v3.8.4"},
		},
		{
			name:       "multi-version skip",
			currentVer: "v3.5.0",
			targetVer:  "v4.0.0",
			wantPath:   []string{"v3.6.0", "v3.7.0", "v3.8.0", "v3.8.4"},
		},

		{
			name:       "invalid current version",
			currentVer: "235343",
			targetVer:  "",
			wantPath:   []string{"v3.5.0", "v3.6.0", "v3.7.0", "v3.8.0", "v3.8.4"},
		},
		{
			name:       "invalid target version",
			currentVer: "v3.8.0",
			targetVer:  "invalid-version",
			wantPath:   []string{"v3.8.4"},
		},
		{
			name:       "version downgrade attempt",
			currentVer: "v3.8.0",
			targetVer:  "v3.6.0",
			wantPath:   nil,
		},
		{
			name:       "version downgrade attempt",
			currentVer: "v3.8.3-patch",
			targetVer:  "v3.8.4-alpha.4",
			wantPath:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Execute the function under test
			got := buildMigrationPath(NormalizeVersion(tt.currentVer), NormalizeVersion(tt.targetVer))

			// Validate migration path
			if !reflect.DeepEqual(got, tt.wantPath) {
				t.Errorf("Migration path mismatch:\nGot:  %v\nWant: %v", got, tt.wantPath)
			}
		})
	}
}

func TestName(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"))
	if err != nil {
		panic(err)
	}
	if err := db.AutoMigrate(&TestUser{}); err != nil {
		panic(err)
	}
	db = db.Debug()

	setUser := func(v *TestUser) {
		res := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},         // 或者 {{Name: "email"}}
			DoUpdates: clause.AssignmentColumns([]string{"name"}), // 要更新的列
		}).Create(v)
		if res.Error != nil {
			panic(res.Error)
		}
	}
	setUser(&TestUser{UserID: "100", Name: "test1"})
	setUser(&TestUser{UserID: "100", Name: "test1"})
	setUser(&TestUser{UserID: "100", Name: "test1"})

	if err := db.Model(&TestUser{}).Where("user_id = ?", "100").Updates(map[string]any{"name": "test1"}).Error; err != nil {
		panic(err)
	}

}

type TestUser struct {
	UserID string `gorm:"primaryKey"`
	Name   string
}
