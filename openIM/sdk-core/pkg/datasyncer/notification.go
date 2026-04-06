package datasyncer

import (
	"context"

	"github.com/openimsdk/tools/log"
	"github.com/openimsdk/tools/utils/datautil"
)

// HandleIncrementalNotification processes an incoming incremental notification (push notification)
// from the server. It checks if the notification is the next expected version and applies it directly,
// or triggers a full incremental sync if the notification is out of order.
//
// Contract & behavior:
//   - If notification.Version == current.Version + 1 AND notification.VersionID == current.VersionID:
//     Apply the delta directly (delete, insert, update) and update the version stamp.
//   - If notification.Version != current.Version + 1 OR notification.VersionID != current.VersionID:
//     Trigger SyncIncremental to resync from the current version.
//   - This function assumes the notification Delta is well-formed and follows the same structure
//     as returned by Backend.DiffSince.
//
// Thread safety: This function is NOT thread-safe with respect to SyncIncremental. Callers should
// ensure proper synchronization if both methods can be called concurrently on the same backend.
func HandleIncrementalNotification[V any, Extra any](ctx context.Context, b BackendWithExtra[V, Extra], notification *DeltaWithExtra[V, Extra], opts ...*SyncOptions) error {
	cfg := resolveSyncOptions(opts...)

	// Load current local version stamp
	stamp, err := b.LoadLocalStamp(ctx)
	if err != nil {
		return err
	}
	// Always process extra metadata before any version comparison or sync decision.
	if err := b.HandleExtra(ctx, notification.Extra); err != nil {
		return err
	}

	// Check if this notification is from a different epoch
	if stamp.VersionID != "" && notification.VersionID != stamp.VersionID {
		// Epoch mismatch → trigger full resync
		return SyncIncremental(ctx, b, opts...)
	}

	// Check if the notification requires a full reseed
	if notification.RequireReseed {
		// Server requests reseed → trigger full resync
		return SyncIncremental(ctx, b, opts...)
	}

	// Check if local version is ahead of or equal to the notification version
	// In this case, ignore the notification as it's stale
	if stamp.Version >= notification.Version {
		log.ZWarn(ctx, "ignoring stale notification local version >= notification version",
			nil,
			"localVersion", stamp.Version,
			"notificationVersion", notification.Version,
			"versionID", stamp.VersionID)
		return nil
	}

	// Check if this is the next version in sequence
	if notification.Version != stamp.Version+1 {
		// Version gap detected → trigger incremental sync to catch up
		log.ZWarn(ctx, "version gap detected, triggering full incremental sync",
			nil,
			"localVersion", stamp.Version,
			"notificationVersion", notification.Version,
			"versionID", stamp.VersionID)
		return SyncIncremental(ctx, b, opts...)
	}

	// Apply deletions locally and keep UIDList consistent
	if len(notification.DeletedIDs) > 0 {
		delIDs := notification.DeletedIDs
		if cfg.deleteLocal {
			if err := b.DeleteLocalByID(ctx, delIDs); err != nil {
				return err
			}
		}
		stamp.UIDList = datautil.DeleteElems(stamp.UIDList, delIDs...)
	}

	// Apply upserts (Inserted + Updated) in one shot
	if len(notification.Inserted) > 0 || len(notification.Updated) > 0 {
		// Merge and coalesce by ID — later entries override earlier ones
		upserts := make([]V, 0, len(notification.Inserted)+len(notification.Updated))
		upserts = append(upserts, notification.Inserted...)
		upserts = append(upserts, notification.Updated...)

		seen := datautil.SliceSet(stamp.UIDList)

		for _, upsert := range upserts {
			id := b.IDOf(upsert)
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			stamp.UIDList = append(stamp.UIDList, id)
		}

		if err := b.UpsertLocal(ctx, upserts); err != nil {
			return err
		}
	}

	// Update version stamp to the notification's version
	stamp.Version = notification.Version
	stamp.VersionID = notification.VersionID

	return b.SaveLocalStamp(ctx, stamp)
}
