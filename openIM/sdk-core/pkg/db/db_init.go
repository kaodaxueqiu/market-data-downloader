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

//go:build !js
// +build !js

package db

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/constant"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/openim-sdk-core/v3/version"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
)

type TableChecker struct {
	tableCache map[string]bool
	mu         sync.RWMutex
}

func NewTableChecker(tables []string) *TableChecker {
	tc := &TableChecker{
		tableCache: make(map[string]bool),
	}
	tc.InitTableCache(tables)
	return tc
}

func (tc *TableChecker) InitTableCache(tables []string) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	for _, table := range tables {
		tc.tableCache[table] = true
	}
}

func (tc *TableChecker) HasTable(tableName string) bool {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	return tc.tableCache[tableName]
}
func (tc *TableChecker) UpdateTable(tableName string) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.tableCache[tableName] = true
}

type DataBase struct {
	loginUserID  string
	dbDir        string
	conn         *gorm.DB
	tableChecker *TableChecker
	mRWMutex     sync.RWMutex
}

func (d *DataBase) InitDB(ctx context.Context, userID string, dataDir string) error {
	panic("implement me")
}

func (d *DataBase) Close(ctx context.Context) error {
	dbConn, err := d.conn.WithContext(ctx).DB()
	if err != nil {
		return err
	} else {
		if dbConn != nil {
			err := dbConn.Close()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func NewDataBase(ctx context.Context, loginUserID string, dbDir string, logLevel int) (*DataBase, error) {
	dataBase := &DataBase{loginUserID: loginUserID, dbDir: dbDir}
	err := dataBase.initDB(ctx, logLevel)
	if err != nil {
		return dataBase, errs.WrapMsg(err, "initDB failed "+dbDir)
	}
	tables, err := dataBase.GetExistTables(ctx)
	if err != nil {
		return dataBase, errs.Wrap(err)
	}
	dataBase.tableChecker = NewTableChecker(tables)

	return dataBase, nil
}

func (d *DataBase) initDB(ctx context.Context, logLevel int) error {
	var zLogLevel logger.LogLevel
	if d.loginUserID == "" {
		return errors.New("no uid")
	}

	path := d.dbDir + "/OpenIM_" + constant.BigVersion + "_" + d.loginUserID + ".db"
	dbFileName, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	log.ZInfo(ctx, "sqlite", "path", dbFileName)
	if logLevel > 5 {
		zLogLevel = logger.Info
	} else {
		zLogLevel = logger.Silent
	}
	var (
		db *gorm.DB
	)
	db, err = gorm.Open(sqlite.Open(dbFileName), &gorm.Config{Logger: log.NewSqlLogger(zLogLevel, false, time.Millisecond*200)})
	if err != nil {
		return errs.WrapMsg(err, "open db failed "+dbFileName)
	}

	log.ZDebug(ctx, "open db success", "dbFileName", dbFileName)
	sqlDB, err := db.DB()
	if err != nil {
		return errs.WrapMsg(err, "get sql db failed")
	}

	sqlDB.SetConnMaxLifetime(time.Hour * 1)
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxIdleTime(time.Minute * 10)
	d.conn = db

	// base
	if err = db.AutoMigrate(
		&model_struct.LocalAppSDKVersion{},
		&model_struct.LocalEvent{},
		&model_struct.HotKey{},
	); err != nil {
		return err
	}

	if err = d.versionDataMigrate(ctx); err != nil {
		return err
	}

	return nil
}

func (d *DataBase) versionDataMigrate(ctx context.Context) error {
	currentVerModel, err := d.GetAppSDKVersion(ctx)
	if errs.Unwrap(err) == errs.ErrRecordNotFound {
		return d.initialMigration(ctx)
	}
	if err != nil {
		return err
	}

	normalizedCurrentVer := NormalizeVersion(currentVerModel.Version)
	normalizedTargetVer := NormalizeVersion(version.Version)

	if normalizedCurrentVer == normalizedTargetVer {
		return nil
	}

	migrationPath := buildMigrationPath(normalizedCurrentVer, normalizedTargetVer)
	for _, targetVer := range migrationPath {
		if err := d.executeVersionMigration(ctx, targetVer); err != nil {
			return err
		}
	}

	return nil
}

func NormalizeVersion(ver string) string {
	parts := strings.Split(ver, "-e-")
	return parts[0] // return main version like "v3.8.4"
}

func (d *DataBase) initialMigration(ctx context.Context) error {
	if err := d.conn.AutoMigrate(
		&model_struct.LocalAppSDKVersion{},
		&model_struct.LocalFriend{},
		&model_struct.LocalGroup{},
		&model_struct.LocalGroupMember{},
		&model_struct.LocalUser{},
		&model_struct.LocalBlack{},
		&model_struct.LocalConversation{},
		&model_struct.LocalConversationGroup{},
		&model_struct.LocalConversationGroupMember{},
		&model_struct.NotificationSeqs{},
		&model_struct.LocalChatLog{},
		&model_struct.LocalUpload{},
		&model_struct.LocalSendingMessages{},
		&model_struct.LocalVersionSync{},
		&model_struct.LocalEvent{},
		&model_struct.HotKey{},
	); err != nil {
		return err
	}
	return d.SetAppSDKVersion(ctx, &model_struct.LocalAppSDKVersion{
		Version: version.Version,
	})
}

func buildMigrationPath(currentVer, targetVer string) []string {
	// Defines the ordered sequence of all supported versions
	// New versions should be appended to the end
	allVersions := []string{
		"v3.5.0",
		"v3.6.0",
		"v3.7.0",
		"v3.8.0",
		"v3.8.4",
		"v3.8.5",
		// Future versions should be added here
	}

	// Find the closest migration versions
	currentMigrationVer := findClosestMigrationVersion(currentVer, allVersions)
	targetMigrationVer := findClosestMigrationVersion(targetVer, allVersions)

	// Find index positions in version sequence
	currentIdx := -1
	targetIdx := -1
	for i, v := range allVersions {
		if v == currentMigrationVer {
			currentIdx = i
		}
		if v == targetMigrationVer {
			targetIdx = i
		}
	}

	// Handle case where current version isn't found (e.g., fresh install)
	if currentIdx == -1 {
		if targetIdx == -1 {
			// Neither version found - migrate through all versions
			return allVersions
		}
		// Current version unknown but target exists - migrate from beginning
		return allVersions[:targetIdx+1]
	}

	// Handle case where target version isn't found
	if targetIdx == -1 {
		// Target version beyond known versions - migrate all remaining
		return allVersions[currentIdx+1:]
	}

	// Normal case: both versions exist in sequence
	if targetIdx > currentIdx {
		return allVersions[currentIdx+1 : targetIdx+1]
	}

	// For downgrades or same version, return nil (no migration)
	return nil
}

// Helper function to find the closest migration version
func findClosestMigrationVersion(ver string, migrationVersions []string) string {
	// Implementation that finds the nearest lower or equal version
	// that requires migration
	for i := len(migrationVersions) - 1; i >= 0; i-- {
		if migrationVersions[i] <= ver {
			return migrationVersions[i]
		}
	}
	return ""
}

func (d *DataBase) executeVersionMigration(ctx context.Context, targetVer string) error {
	switch targetVer {
	case "v3.8.0":

	case "v3.8.4":
		// v3.8.4 Added new fields migration (common for both open source and commercial versions)
		if err := d.conn.AutoMigrate(
			&model_struct.LocalUser{},
			&model_struct.LocalEvent{},
		); err != nil {
			return err
		}

		//todo add DstUserIDs for target group message to migrate data when chat log database refactor

		//// handle all conversation chat logs tables migration dst_user_ids for target group message
		//conversationIDs, err := d.GetAllConversationIDList(ctx)
		//if err != nil {
		//	return err
		//}
		//
		//for _, id := range conversationIDs {
		//	tbl := utils.GetTableName(id)
		//	dbt := d.conn.WithContext(ctx).Table(tbl)
		//	if !dbt.Migrator().HasColumn(&model_struct.LocalChatLog{}, "DstUserIDs") {
		//		if err := dbt.Migrator().AddColumn(&model_struct.LocalChatLog{}, "DstUserIDs"); err != nil {
		//			log.ZWarn(ctx, "AddColumn err", err, "tableName", tbl)
		//		}
		//	}
		//}
	case "v3.8.5":
		if err := d.conn.AutoMigrate(
			&model_struct.LocalConversationGroup{},
			&model_struct.LocalConversationGroupMember{},
			&model_struct.LocalConversation{},
			&model_struct.LocalGroup{},
		); err != nil {
			return err
		}

	// database migration logic for future versions
	default:
		log.ZInfo(ctx, "No specific migration for version", "version", targetVer)
	}

	// update the version record with the original version string
	return d.SetAppSDKVersion(ctx, &model_struct.LocalAppSDKVersion{
		Version: version.Version, // store original version like "v3.8.4-e-v1.1.1"
	})
}
