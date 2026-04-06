// Package datasyncer contains a lightweight, ID-centric incremental sync loop.
// It only maintains the local "ID set + order" and the version stamp.
// Payloads/entities are fetched and cached on-demand elsewhere;
// full reseed never pulls all entities to avoid server pressure.
package datasyncer

import (
	"context"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	"github.com/openimsdk/tools/utils/datautil"
)

// maxRounds limits how many incremental "diff → reorder → recheck" cycles
// we attempt before falling back to a reseed of IDs.
const maxRounds = 3

// SyncOptions is a declarative bundle of sync parameters. Fields left nil fall back to defaults.
type SyncOptions struct {
	// MaxReseedFetch controls how many payloads are fetched during a full reseed.
	// Nil defaults to -1. <0: fetch all; 0: fetch none (IDs-only reseed); >0: fetch up to that many IDs.
	MaxReseedFetch *int
	// DeleteLocal toggles whether local cached payloads are deleted when the server
	// indicates an item is removed or when a reseed happens. Nil defaults to true.
	DeleteLocal *bool
	// DisableEvent whether to disable event triggering, default is false.
	DisableEvent *bool
}

// SetMaxReseedFetch configures the maximum payload count pulled during reseed.
func (s *SyncOptions) SetMaxReseedFetch(n int) *SyncOptions {
	if s == nil {
		return nil
	}
	s.MaxReseedFetch = &n
	return s
}

// SetDeleteLocal toggles whether local payloads are deleted when the server removes items or during reseed.
func (s *SyncOptions) SetDeleteLocal(enabled bool) *SyncOptions {
	if s == nil {
		return nil
	}
	s.DeleteLocal = &enabled
	return s
}

// SetDisableEvent configure whether to disable event triggering.
func (s *SyncOptions) SetDisableEvent(disable bool) *SyncOptions {
	if s == nil {
		return nil
	}
	s.DisableEvent = &disable
	return s
}

type resolvedSyncOptions struct {
	maxReseedFetch int
	deleteLocal    bool
	disableEvent   bool
}

func resolveSyncOptions(opts ...*SyncOptions) resolvedSyncOptions {
	cfg := resolvedSyncOptions{
		maxReseedFetch: -1,
		deleteLocal:    true,
		disableEvent:   false,
	}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.MaxReseedFetch != nil {
			cfg.maxReseedFetch = *opt.MaxReseedFetch
		}
		if opt.DeleteLocal != nil {
			cfg.deleteLocal = *opt.DeleteLocal
		}
		if opt.DisableEvent != nil {
			cfg.disableEvent = *opt.DisableEvent
		}
	}
	return cfg
}

// DeltaWithExtra describes one incremental difference step returned by the server,
// optionally carrying extra metadata alongside the payload changes.
type DeltaWithExtra[V any, Extra any] struct {
	// Version is the latest server version AFTER applying this delta.
	Version uint64
	// VersionID is the epoch (e.g., version table id). When it changes,
	// clients should reseed.
	VersionID string

	// RequireReseed indicates that the client must perform a full resynchronization.
	// This is returned when the server determines that incremental synchronization
	// is no longer safe or possible (e.g., the client and server states or versions
	// have diverged too much).
	RequireReseed bool

	// DeletedIDs are IDs removed on server since the client's version.
	DeletedIDs []string
	// Inserted are new/unknown items with payloads.
	Inserted []V
	// Updated are existing items with new payloads.
	Updated []V

	// ReorderAt > 0 means order of IDs has changed and client should refresh
	// the ordered ID snapshot from the server (via ListServerIDs).
	// 0 means no reorder needed.
	ReorderAt uint64

	// Extra carries optional metadata tied to this delta (e.g., group info).
	// Most deltas will leave this as the zero value.
	Extra Extra
}

// Delta keeps the prior name as a shorthand for deltas without extra metadata.
type Delta[V any] = DeltaWithExtra[V, struct{}]

// IDSnapshot is a server snapshot of ALL item IDs (ordered), plus a stamp.
// NOTE: This snapshot carries IDs ONLY (no payloads), to keep it cheap.
type IDSnapshot struct {
	Version   uint64 // server version at snapshot time
	VersionID string // epoch at snapshot time

	// SameSet means the server confirms the client's ID set equals server's,
	// though ordering may or may not match. If SameSet is true, servers may
	// skip sending IDs to reduce payload; clients may retain local order.
	SameSet bool
	// IDs is the ordered list of all IDs on server. When SameSet is true,
	// servers MAY return an empty list to signal "use your local set & order".
	IDs []string
}

// BackendWithExtra abstracts storage (local) and network (remote) behaviors needed by the sync loop.
// The sync loop is ID-centric; payloads/entities are applied only via UpsertLocal on INSERT/UPDATE.
// Full reseed only resets local cache and updates the local version stamp and ID list.
type BackendWithExtra[V any, Extra any] interface {
	// IDOf extracts the unique ID of a payload/entity V.
	IDOf(v V) string

	// UpsertLocal inserts or updates local cache for the given payloads/entities.
	// MUST be idempotent.
	UpsertLocal(ctx context.Context, vs []V) error

	// DeleteLocalByID deletes local cache by IDs.
	// Contract: len(ids) == 0 means "delete ALL"; non-empty slices delete the provided IDs.
	DeleteLocalByID(ctx context.Context, ids []string) error

	// LoadLocalStamp loads the local version stamp. Must return an "empty" stamp
	// (VersionID == "" or Version == 0) if none is stored locally.
	LoadLocalStamp(ctx context.Context) (*model_struct.LocalVersionSync, error)

	// SaveLocalStamp persists the local version stamp atomically with any local
	// ID set changes performed earlier in the same sync step.
	SaveLocalStamp(ctx context.Context, s *model_struct.LocalVersionSync) error

	// ListServerIDs returns a server snapshot of ALL IDs plus the server stamp.
	// Implementations MAY use the "known" list to detect SameSet cheaply.
	ListServerIDs(ctx context.Context, known []string) (*IDSnapshot, error)

	// FetchByIDs returns all payloads/entities for the given IDs. The ids slice
	// contains the complete set of IDs that should exist locally after sync.
	FetchByIDs(ctx context.Context, ids []string) ([]V, error)

	// DiffSince returns the incremental difference since (epoch, version).
	// When RequireReseed is true, clients should reseed IDs.
	DiffSince(ctx context.Context, epoch string, version uint64) (*DeltaWithExtra[V, Extra], error)

	// HandleExtra applies optional metadata attached to a delta.
	// Implementations that don't use Extra can return nil.
	HandleExtra(ctx context.Context, extra Extra) error

	// HandleFullSync is invoked during a full reseed after the local cache has been reset.
	// Implementations can perform additional full-sync-specific side effects.
	// Implementations that do not need special handling may return nil.
	HandleFullSync(ctx context.Context) error
}

// Backend keeps the prior name as a shorthand for backends without extra metadata.
type Backend[V any] = BackendWithExtra[V, struct{}]

// SyncIncremental performs the incremental sync loop.
//
// Contract & behavior:
//   - The function manages ONLY the local ID set (stamp.UIDList) and the local
//     version stamp (VersionID + Version). It does NOT fetch all payloads.
//   - On INSERT/UPDATE deltas, payloads/entities are "upserted" locally via UpsertLocal.
//   - On full reseed, this function clears the local cache and refreshes the ID set
//     and stamp ONLY (no payload pull). Payloads are expected to be fetched on-demand.
//   - If the server advances the version without any actual diff, we still update
//     local Version/VersionID to keep stamps aligned (avoid drift).
func SyncIncremental[V any, Extra any](ctx context.Context, b BackendWithExtra[V, Extra], opts ...*SyncOptions) error {
	cfg := resolveSyncOptions(opts...)

	ctx = withContextDisableEvent(ctx, cfg.disableEvent)

	stamp, err := b.LoadLocalStamp(ctx)
	if err != nil {
		return err
	}
	// First-time or empty stamp → reseed IDs (cheap, IDs-only).
	if stamp.VersionID == "" || stamp.Version == 0 {
		return reseedIDs[V, Extra](ctx, b, stamp, nil, cfg)
	}

	for round := 0; ; round++ {
		delta, err := b.DiffSince(ctx, stamp.VersionID, stamp.Version)
		if err != nil {
			return err
		}
		// Process optional metadata before deciding whether to reseed or apply the delta.
		if err := b.HandleExtra(ctx, delta.Extra); err != nil {
			return err
		}
		if delta.RequireReseed {
			return reseedIDs[V, Extra](ctx, b, stamp, nil, cfg)
		}

		// No changes AND no reorder request → align stamp if needed and return.
		noChange := len(delta.DeletedIDs) == 0 &&
			len(delta.Inserted) == 0 &&
			len(delta.Updated) == 0 &&
			delta.ReorderAt == 0

		if noChange {
			if stamp.Version != delta.Version || stamp.VersionID != delta.VersionID {
				stamp.Version = delta.Version
				stamp.VersionID = delta.VersionID
				return b.SaveLocalStamp(ctx, stamp)
			}
			return nil
		}

		// Apply deletions locally and keep UIDList consistent.
		if len(delta.DeletedIDs) > 0 {
			delIDs := delta.DeletedIDs
			if cfg.deleteLocal {
				if err := b.DeleteLocalByID(ctx, delIDs); err != nil {
					return err
				}
			}
			stamp.UIDList = datautil.DeleteElems(stamp.UIDList, delIDs...)
		}

		// Apply upserts (Inserted + Updated) in one shot.
		if len(delta.Inserted) > 0 || len(delta.Updated) > 0 {
			// Merge and coalesce by ID — later entries override earlier ones.
			upserts := make([]V, 0, len(delta.Inserted)+len(delta.Updated))
			upserts = append(upserts, delta.Inserted...)
			upserts = append(upserts, delta.Updated...)

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

		// No reorder needed: advance stamp and done.
		if delta.ReorderAt == 0 {
			stamp.Version = delta.Version
			stamp.VersionID = delta.VersionID
			return b.SaveLocalStamp(ctx, stamp)
		}

		// Reorder requested: refresh ordered IDs and server stamp.
		snap, err := b.ListServerIDs(ctx, stamp.UIDList)
		if err != nil {
			return err
		}

		// If SameSet is true, servers may omit IDs. In that case, keep local set & order.
		// If you want to ALWAYS follow server order when reorder is requested,
		// then prefer snap.IDs when len(snap.IDs) > 0.
		if !snap.SameSet && len(snap.IDs) > 0 {
			stamp.UIDList = snap.IDs
		}
		stamp.VersionID = snap.VersionID
		stamp.Version = snap.Version

		// Guard rails for epoch/version relations.
		switch {
		case snap.VersionID != delta.VersionID:
			// Epoch switched during this round → reseed.
			return reseedIDs[V, Extra](ctx, b, stamp, snap, cfg)

		case snap.Version < delta.Version:
			// Server went backward (shouldn't happen) → reseed to recover.
			return reseedIDs[V, Extra](ctx, b, stamp, snap, cfg)

		case snap.Version == delta.Version:
			// Reached desired version.
			return b.SaveLocalStamp(ctx, stamp)

		default: // snap.Version > delta.Version
			// Server progressed even further; iterate a few more rounds, then reseed as fallback.
			if round+1 >= maxRounds {
				return reseedIDs[V, Extra](ctx, b, stamp, snap, cfg)
			}
			// Continue loop.
		}
	}
}

// reseedIDs performs a cheap full reseed of IDs and stamp ONLY.
// It resets local cache (DeleteLocalByID(nil)), refreshes local UIDList (IDs-only),
// and aligns Version/VersionID. It does NOT pull all payloads; payloads should be
// fetched on-demand elsewhere.
func reseedIDs[V any, Extra any](ctx context.Context, b BackendWithExtra[V, Extra], stamp *model_struct.LocalVersionSync, snap *IDSnapshot, cfg resolvedSyncOptions) error {
	ctx = withContextReseedSync(ctx, true)
	var err error
	if snap == nil {
		// Pass nil (or an empty slice) so server returns its current IDs + stamp.
		snap, err = b.ListServerIDs(ctx, stamp.UIDList)
		if err != nil {
			return err
		}
	}

	// Reset local cache entirely.
	if cfg.deleteLocal {
		if err := b.DeleteLocalByID(ctx, nil); err != nil {
			return err
		}
	}

	if err := b.HandleFullSync(ctx); err != nil {
		return err
	}

	// Update local UIDList if server says sets differ; otherwise keep the current set.
	if !snap.SameSet {
		stamp.UIDList = snap.IDs
	}

	if cfg.maxReseedFetch != 0 && len(stamp.UIDList) > 0 {
		ids := stamp.UIDList
		if cfg.maxReseedFetch > 0 && cfg.maxReseedFetch < len(ids) {
			ids = ids[:cfg.maxReseedFetch]
		}

		fetched, err := b.FetchByIDs(ctx, ids)
		if err != nil {
			return err
		}
		if len(fetched) > 0 {
			if err := b.UpsertLocal(ctx, fetched); err != nil {
				return err
			}
		}
	}

	// Align local stamp to server.
	stamp.Version = snap.Version
	stamp.VersionID = snap.VersionID
	return b.SaveLocalStamp(ctx, stamp)
}
