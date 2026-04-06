# Local Event Scheduler Guide

This feature provides a locally persisted, crash‑resilient event scheduler (`event_scheduler`).  
It is designed to reliably finish background work (eventual consistency) when the user is logged in and the device/network is in a good state.

Events are stored in a local database and support:
- Ordered processing by partition key
- Idempotent de‑duplication
- Leases (to avoid concurrent processing)
- Exponential backoff and retries
- Crash/kill recovery
- Optional merging of similar events

Code locations
- Model definition: `pkg/db/model_struct/local_event.go`
- Database operations: `pkg/db/local_event_model.go`
- Runtime scheduler: `pkg/event_scheduler/event_scheduler.go`
- SDK integration: `open_im_sdk/userRelated.go` (`EventScheduler` field)

LocalEvent schema (field names may differ slightly; use code as the source of truth)
- `ID string`  
  Primary key, typically a UUID.
- `Type string`  
  Event type, mapped from `event_scheduler.EventType`.
- `Payload string`  
  Event payload as JSON. The scheduler deserializes this into a concrete type in handlers.
- `State string`  
  Event state: `pending`, `processing`, `done`, or `dead`.
- `Priority int`  
  Higher values are processed first.
- `Attempts int`  
  Number of processing attempts so far.
- `MaxAttempts int`  
  Maximum attempts before the event is marked `dead`.
- `RunAt int64`  
  Scheduled execution time (Unix milliseconds). Used for delay and backoff.
- `RequiresNetwork bool`  
  Whether this event requires network; when offline such events are deferred instead of failed.
- `PartitionKey string`  
  Partition key, typically conversation ID / group ID, used to keep order within a partition.
- `DedupeKey *string`  
  De‑duplication key. Combined with merge logic to avoid inserting duplicate events.
- `IdempotencyKey string`  
  Idempotency key for business‑level idempotence.
- `LeaseOwner string`  
  Worker ID holding the processing lease to prevent concurrent processing.
- `LeaseExpireAt int64`  
  Lease expiration time (Unix milliseconds); expired leases are recovered.
- `LastError string`  
  Last processing error, for debugging.
- `CreatedAt/UpdatedAt int64`  
  Creation and update timestamps (Unix milliseconds).

Event lifecycle (how we guarantee eventual processing)
1) **Enqueue**  
   Use `EventScheduler.EnqueueInTx` to insert an event with `State=pending`.  
   Use `WithRunAt` / `WithRunAfter` to schedule it for later.
2) **Claim**  
   The scheduler selects eligible events (by state, time, and network) and acquires a lease, moving them into processing.
3) **Success**  
   On successful handling, the scheduler calls `CompleteEvent` and marks the event as `done`.
4) **Failure**  
   On failure, it increments `Attempts`, stores `LastError`, and computes the next `RunAt` using exponential backoff.  
   Once `Attempts >= MaxAttempts`, the event transitions to `dead`.
5) **Crash / process kill**  
   A periodic task calls `RecoverExpiredLeases` to recover events whose leases have expired and returns them to the pending pool.
6) **Ordering**  
   The database layer uses `PartitionKey`, `Priority`, and `RunAt` when selecting events.  
   A common pattern is to use a conversation ID as `PartitionKey` so that events within a conversation are processed in order.

Scheduler initialization and running
- Create the scheduler:
  ```go
  es := event_scheduler.NewEventScheduler(db, 
      event_scheduler.WithWorkerID("client-instance-1"),
      event_scheduler.WithWorkerMaxAttempts(10),
      event_scheduler.WithBackoffBase(500*time.Millisecond),
      event_scheduler.WithEnableNetwork(func() bool { return IsNetworkOnline() }),
  )
  ```
- Register event handlers:
  ```go
  es.Register(event_scheduler.UpdateMessageAvatarAndNickname, 
      event_scheduler.MakeJSONHandler(func(ctx context.Context, payload common.Cmd2Value, v YourPayloadStruct) error {
          // TODO: handle the event based on Cmd and v
          return nil
      }),
  )
  ```
- Start the scheduler loop (typically after login succeeds):
  ```go
  go es.Start(ctx) // exits when ctx is canceled or es.Stop() is called
  ```

Enqueue API (EnqueueInTx and options)
- Core signature:
  ```go
  func (es *EventScheduler) EnqueueInTx(
      ctx context.Context,
      eventType event_scheduler.EventType,
      payload common.Cmd2Value,
      opt ...event_scheduler.Opt,
  ) error
  ```
- Common options (Opt):
  - `WithPartitionKey(k string)`  
    Partition key (e.g., conversation ID). Ensures ordered processing within the same key.
  - `WithDedupeKey(k string)`  
    De‑duplication key. Used together with `WithMerge(true)` to upsert instead of insert.
  - `WithIdempotencyKey(k string)`  
    Business‑level idempotency key.
  - `WithPriority(p int)`  
    Event priority; higher values are processed earlier.
  - `WithRequiresNetwork(true)`  
    Mark event as requiring network. When offline, it is deferred instead of failed.
  - `WithRunAt(t time.Time)` / `WithRunAfter(d time.Duration)`  
    Schedule the event at an absolute or relative time.
  - `WithMaxAttempts(n int)`  
    Per‑event maximum retry attempts.
  - `WithMerge(true)`  
    Allow `UpsertEventByDedupe` to merge with existing events sharing the same `DedupeKey`.

Envelope format (event payload wrapping)
- When enqueuing, `payload common.Cmd2Value` is wrapped into:
  ```go
  type envelope struct {
      Cmd         string          `json:"cmd"`
      Value       json.RawMessage `json:"value"`
      Caller      string          `json:"caller,omitempty"`
      OperationID string          `json:"operationID,omitempty"`
  }
  ```
- The scheduler uses `MakeJSONHandler` to unpack `envelope` and rebuild a `Cmd2Value`:
  ```go
  payload := common.Cmd2Value{
      Cmd:    env.Cmd,
      Value:  any(v),
      Caller: env.Caller,
      Ctx:    ccontext.WithOperationID(context.Background(), env.OperationID),
  }
  ```
  This `payload` is passed to your business handler, and `cmd` / `caller` / `value` are logged for debugging.

Example: update message avatars and nicknames in a conversation
```go
// 1) Define payload
type UpdateMessageAvatarAndNicknamePayload struct {
    ConversationID string `json:"conversationID"`
    UserID         string `json:"userID"`
}

// 2) Register handler
es.Register(event_scheduler.UpdateMessageAvatarAndNickname,
    event_scheduler.MakeJSONHandler(func(ctx context.Context, payload common.Cmd2Value, v UpdateMessageAvatarAndNicknamePayload) error {
        // TODO: scan local messages for this conversation+user,
        //       update avatar & nickname, and refresh conversation.
        return nil
    }),
)

// 3) Enqueue when needed
_ = es.EnqueueInTx(ctx, event_scheduler.UpdateMessageAvatarAndNickname,
    common.Cmd2Value{Cmd: "update_avatar_nickname", Value: UpdateMessageAvatarAndNicknamePayload{
        ConversationID: conversationID,
        UserID:         userID,
    }},
    event_scheduler.WithPartitionKey(conversationID),
    event_scheduler.WithPriority(100),
    event_scheduler.WithRequiresNetwork(false),
)
```

Practical tips
- Start `EventScheduler.Start` only after login succeeds; stop it via `ctx` cancelation or `Stop()` when logging out or closing the app.
- Handlers must be idempotent: repeated execution should not break business logic. Use version fields or processed flags when necessary.
- Use conversation/group IDs as `PartitionKey` to naturally preserve ordering within a conversation.
- When debugging, inspect `State`, `Attempts`, and `LastError` in the local event table to quickly find failing events.

