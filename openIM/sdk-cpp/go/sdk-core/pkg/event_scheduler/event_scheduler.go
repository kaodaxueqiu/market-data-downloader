package event_scheduler

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/openimsdk/openim-sdk-core/v3/pkg/ccontext"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/db_interface"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/db/model_struct"
	pconstant "github.com/openimsdk/protocol/constant"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
)

const (
	UpdateMessageAvatarAndNickname               = "UpdateMessageAvatarAndNickname"
	UpdateConversationAvatarAndNickname          = "UpdateConversationAvatarAndNickname"
	UpdateConversationLatestMessageSenderProfile = "UpdateConversationLatestMessageSenderProfile"
)

// EventEmitter defines the minimal event-publish capability Group depends on.
type EventEmitter interface {
	Publish(ctx context.Context, payload common.Cmd2Value, opts ...Opt) error
}

type envelope struct {
	Cmd         string          `json:"cmd"`
	Value       json.RawMessage `json:"value"`
	Caller      string          `json:"caller,omitempty"`
	OperationID string          `json:"operationID,omitempty"`
}

type Opt func(*eventOpts)

type eventOpts struct {
	partitionKey    string
	dedupeKey       string
	idempotencyKey  string
	priority        int
	requiresNetwork bool
	runAtMS         int64
	maxAttempts     int
	merge           bool // Allow merging based on dedupeKey
}

func WithPartitionKey(k string) Opt   { return func(o *eventOpts) { o.partitionKey = k } }
func WithDedupeKey(k string) Opt      { return func(o *eventOpts) { o.dedupeKey = k } }
func WithIdempotencyKey(k string) Opt { return func(o *eventOpts) { o.idempotencyKey = k } }
func WithPriority(p int) Opt          { return func(o *eventOpts) { o.priority = p } }
func WithRequiresNetwork(b bool) Opt  { return func(o *eventOpts) { o.requiresNetwork = b } }
func WithRunAt(t time.Time) Opt       { return func(o *eventOpts) { o.runAtMS = t.UnixMilli() } }
func WithRunAfter(d time.Duration) Opt {
	return func(o *eventOpts) { o.runAtMS = time.Now().Add(d).UnixMilli() }
}
func WithMaxAttempts(n int) Opt { return func(o *eventOpts) { o.maxAttempts = n } }
func WithMerge(b bool) Opt      { return func(o *eventOpts) { o.merge = b } }

type EventHandler func(ctx context.Context, raw json.RawMessage) error

type EventWorkerOptions struct {
	WorkerID       string        // Process/instance ID
	LeaseTTL       time.Duration // Lease TTL; default 30s
	idleSleep      time.Duration // Default 250ms
	minActiveSleep time.Duration // Default 8ms

	completedPurgeRetention time.Duration // Retention window to purge done/dead at construction; 0 disables

	maxIdleSleep  time.Duration // Default 2 min
	MaxAttempts   int           // Default 3
	BackoffBase   time.Duration // Exponential backoff base; default 500ms
	EnableNetwork func() bool   // Returns whether network is available (nil treated as available)
}

// WorkerOpt is a functional option for configuring EventWorkerOptions.
type WorkerOpt func(*EventWorkerOptions)

// WithWorkerID sets a fixed worker ID.
func WithWorkerID(id string) WorkerOpt { return func(o *EventWorkerOptions) { o.WorkerID = id } }

// WithLeaseTTL sets the lease TTL for claimed events.
func WithLeaseTTL(ttl time.Duration) WorkerOpt {
	return func(o *EventWorkerOptions) { o.LeaseTTL = ttl }
}

// WithWorkerMaxAttempts sets the max attempts for events (default 10).
func WithWorkerMaxAttempts(n int) WorkerOpt { return func(o *EventWorkerOptions) { o.MaxAttempts = n } }

// WithBackoffBase sets the base duration for backoff (default 500ms).
func WithBackoffBase(d time.Duration) WorkerOpt {
	return func(o *EventWorkerOptions) { o.BackoffBase = d }
}

// WithEnableNetwork sets a function to determine current network availability.
func WithEnableNetwork(f func() bool) WorkerOpt {
	return func(o *EventWorkerOptions) { o.EnableNetwork = f }
}

// WithIdleSleep sets the initial idle sleep duration.
func WithIdleSleep(d time.Duration) WorkerOpt { return func(o *EventWorkerOptions) { o.idleSleep = d } }

// WithMinActiveSleep sets the minimum active sleep duration.
func WithMinActiveSleep(d time.Duration) WorkerOpt {
	return func(o *EventWorkerOptions) { o.minActiveSleep = d }
}

// WithMaxIdleSleep sets the maximum idle sleep duration.
func WithMaxIdleSleep(d time.Duration) WorkerOpt {
	return func(o *EventWorkerOptions) { o.maxIdleSleep = d }
}

// WithCompletedPurgeRetention purges old done/dead events during construction; pass 0 to disable
// Example: WithCompletedPurgeRetention(90*24*time.Hour)
func WithCompletedPurgeRetention(d time.Duration) WorkerOpt {
	return func(o *EventWorkerOptions) { o.completedPurgeRetention = d }
}

type EventScheduler struct {
	db       db_interface.DataBase
	registry map[string]EventHandler
	regMu    sync.RWMutex
	wakeCh   chan struct{} // Wake signal (debounced)

	opts EventWorkerOptions

	stopCh chan struct{}
	wg     sync.WaitGroup
}

func (es *EventScheduler) SetDataBase(db db_interface.DataBase) {
	es.db = db
}

func NewEventScheduler(optFns ...WorkerOpt) *EventScheduler {
	// defaults
	opts := EventWorkerOptions{
		WorkerID:       uuid.NewString(),
		LeaseTTL:       30 * time.Second,
		idleSleep:      250 * time.Millisecond,
		minActiveSleep: 8 * time.Millisecond,
		maxIdleSleep:   2 * time.Minute,
		MaxAttempts:    3,
		BackoffBase:    500 * time.Millisecond,
		EnableNetwork:  func() bool { return true },
	}
	// apply user options
	for _, fn := range optFns {
		if fn != nil {
			fn(&opts)
		}
	}
	// normalize required values
	if opts.WorkerID == "" {
		opts.WorkerID = uuid.NewString()
	}
	if opts.LeaseTTL <= 0 {
		opts.LeaseTTL = 30 * time.Second
	}
	if opts.MaxAttempts <= 0 {
		opts.MaxAttempts = 3
	}
	if opts.BackoffBase <= 0 {
		opts.BackoffBase = 500 * time.Millisecond
	}
	if opts.idleSleep <= 0 {
		opts.idleSleep = 250 * time.Millisecond
	}
	if opts.minActiveSleep <= 0 {
		opts.minActiveSleep = 8 * time.Millisecond
	}
	if opts.maxIdleSleep <= 0 {
		opts.maxIdleSleep = 2 * time.Minute
	}
	if opts.EnableNetwork == nil {
		opts.EnableNetwork = func() bool { return true }
	}

	es := &EventScheduler{
		registry: make(map[string]EventHandler),
		opts:     opts,
		wakeCh:   make(chan struct{}, 1),
		stopCh:   make(chan struct{}),
	}

	return es
}

func (es *EventScheduler) purgeCompletedEventsOnInit() {
	if es.opts.completedPurgeRetention <= 0 {
		return
	}
	cutoff := time.Now().Add(-es.opts.completedPurgeRetention).UnixMilli()
	if n, err := es.db.PurgeCompletedEvents(context.Background(), cutoff); err != nil {
		log.ZWarn(context.Background(), "PurgeCompletedEvents failed", err)
	} else if n > 0 {
		log.ZInfo(context.Background(), "purged completed events", "rows", n, "cutoff", cutoff)
	}
}

func (es *EventScheduler) defaultOpts() eventOpts {
	return eventOpts{
		priority:    100,
		maxAttempts: es.opts.MaxAttempts,
	}
}
func ifZero(v, d int) int {
	if v == 0 {
		return d
	}
	return v
}
func ifZero64(v, d int64) int64 {
	if v == 0 {
		return d
	}
	return v
}

func (es *EventScheduler) EnqueueInTx(ctx context.Context, payload common.Cmd2Value, opt ...Opt) error {
	o := es.defaultOpts()
	for _, f := range opt {
		f(&o)
	}

	raw := json.RawMessage(`{}`)
	if payload.Value != nil {
		b, err := json.Marshal(payload.Value)
		if err != nil {
			return errs.Wrap(err)
		}
		raw = b
	}
	operationID, _ := ctx.Value(pconstant.OperationID).(string)
	env := envelope{Cmd: payload.Cmd, Value: raw, Caller: payload.Caller, OperationID: operationID}
	b, err := json.Marshal(&env)
	if err != nil {
		return errs.Wrap(err)
	}
	var dk *string
	if o.dedupeKey != "" {
		dk = &o.dedupeKey
	}
	now := time.Now().UnixMilli()
	ev := &model_struct.LocalEvent{
		ID:              uuid.NewString(),
		Type:            payload.Cmd,
		Payload:         string(b),
		State:           "pending",
		Priority:        o.priority,
		Attempts:        0,
		MaxAttempts:     ifZero(o.maxAttempts, es.opts.MaxAttempts),
		RunAt:           ifZero64(o.runAtMS, now),
		RequiresNetwork: o.requiresNetwork,
		PartitionKey:    o.partitionKey,
		DedupeKey:       dk,
		IdempotencyKey:  o.idempotencyKey,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if o.merge && ev.DedupeKey != nil {
		err = es.db.UpsertEventByDedupe(ctx, ev)
	} else {
		err = es.db.InsertEvent(ctx, ev)
	}
	if err == nil {
		es.Notify()
	}
	return err
}
func MakeJSONHandler[T any](
	h func(ctx context.Context, data *T) error,
) EventHandler {
	return func(ctx context.Context, raw json.RawMessage) error {
		var env envelope
		if err := json.Unmarshal(raw, &env); err != nil {
			return errs.Wrap(err)
		}
		var v T
		if len(env.Value) > 0 && string(env.Value) != "{}" {
			if err := json.Unmarshal(env.Value, &v); err != nil {
				return errs.Wrap(err)
			}
		}
		payload := common.Cmd2Value{Cmd: env.Cmd, Value: any(v), Caller: env.Caller, Ctx: ccontext.WithOperationID(context.Background(), env.OperationID)}
		log.ZInfo(payload.Ctx, "handling event start", "cmd", payload.Cmd, "caller", payload.Caller, "value", payload.Value)
		err := h(payload.Ctx, &v)
		if err != nil {
			log.ZWarn(payload.Ctx, "handling event failed", err, "cmd", payload.Cmd, "caller", payload.Caller, "value", payload.Value)
			return err
		}
		log.ZInfo(payload.Ctx, "handling event success", "cmd", payload.Cmd, "caller", payload.Caller, "value", payload.Value)
		return nil
	}
}

func (es *EventScheduler) Register(t string, h EventHandler) {
	es.regMu.Lock()
	defer es.regMu.Unlock()
	es.registry[t] = h
}

// Exponential backoff with small jitter
func (es *EventScheduler) calcBackoff(attempts int) time.Duration {
	base := es.opts.BackoffBase
	// base * 2^(attempts-1), with small random jitter
	n := 1 << (attempts - 1)
	d := time.Duration(n) * base
	if d > 30*time.Second {
		d = 30 * time.Second
	}
	// 10% jitter
	jitter := time.Duration(int64(d) / 10)
	return d + time.Duration(time.Now().UnixNano()%int64(jitter+1))
}

func (es *EventScheduler) Notify() {
	select {
	case es.wakeCh <- struct{}{}:
	default:
	}
}

// Start worker (blocks until ctx canceled or Stop is called)
func (es *EventScheduler) Start(ctx context.Context) {
	go es.purgeCompletedEventsOnInit()
	es.wg.Add(1)
	defer es.wg.Done()
	leaseTicker := time.NewTicker(2 * time.Minute)
	defer leaseTicker.Stop()

	idleTimer := time.NewTimer(0)
	if !idleTimer.Stop() {
		select {
		case <-idleTimer.C:
		default:
		}
	}
	hotBudget := 0
	defaultIdleSleep := es.opts.idleSleep
	for {
		now := time.Now().UnixMilli()
		evt, err := es.db.ClaimNextEvent(ctx, es.opts.EnableNetwork(), now, es.opts.WorkerID, es.opts.LeaseTTL)
		if err == nil && evt != nil {
			hotBudget = 1
			es.opts.idleSleep = es.opts.minActiveSleep
			es.processOne(ctx, evt)
			continue
		}

		if hotBudget > 0 {
			hotBudget--
		} else {
			es.opts.idleSleep = defaultIdleSleep
		}

		if !idleTimer.Stop() {
			select {
			case <-idleTimer.C:
			default:
			}
		}
		idleTimer.Reset(es.opts.idleSleep)
		select {
		case <-ctx.Done():
			if !idleTimer.Stop() {
				select {
				case <-idleTimer.C:
				default:
				}
			}
			log.ZInfo(ctx, "EventScheduler stopped by context,sdk logout.....")
			return

		case <-es.wakeCh:
			if hotBudget == 0 {
				hotBudget = 1
			}
			es.opts.idleSleep = es.opts.minActiveSleep
			if !idleTimer.Stop() {
				select {
				case <-idleTimer.C:
				default:
				}
			}
			continue
		case <-es.stopCh:
			log.ZInfo(ctx, "EventScheduler stopped by Stop(),sdk logout.....")
			return
		case <-leaseTicker.C:
			now := time.Now().UnixMilli()
			_, err := es.db.RecoverExpiredLeases(ctx, now)
			if err != nil {
				log.ZWarn(ctx, "recoverExpiredLeases failed", err)
			}
			es.sleepIdle()

		case <-idleTimer.C:
			es.sleepIdle()

		}
	}
}

func (es *EventScheduler) sleepIdle() {
	if es.opts.idleSleep < es.opts.maxIdleSleep {
		es.opts.idleSleep *= 2
		if es.opts.idleSleep > es.opts.maxIdleSleep {
			es.opts.idleSleep = es.opts.maxIdleSleep
		}
	}
}

func (es *EventScheduler) handleOne(ctx context.Context, evt *model_struct.LocalEvent) error {
	h := es.registry[evt.Type]
	if h == nil {
		return errs.WrapMsg(errors.New("no handler registered for type: "+evt.Type), "no handler")
	}

	if err := h(ctx, json.RawMessage(evt.Payload)); err != nil {
		return err
	}
	return nil
}

func (es *EventScheduler) processOne(ctx context.Context, evt *model_struct.LocalEvent) {
	err := es.handleOne(ctx, evt)
	if err != nil {
		log.ZWarn(ctx, "processOne failed", err, "event", evt)
		state := "pending"
		if evt.Attempts+1 >= evt.MaxAttempts {
			state = "dead"
		}
		nextAt := time.Now().Add(es.calcBackoff(evt.Attempts + 1)).UnixMilli()
		newErr := es.db.FailEvent(ctx, evt.ID, evt.Attempts+1, err.Error(), nextAt, state)
		if newErr != nil {
			log.ZWarn(ctx, "FailEvent failed", newErr, "eventID", evt.ID)
		}
		return
	}
	err = es.db.CompleteEvent(ctx, evt.ID)
	if err != nil {
		log.ZWarn(ctx, "CompleteEvent failed", err, "eventID", evt.ID)
	}
}

func (es *EventScheduler) Stop() {
	close(es.stopCh)
	es.wg.Wait()
}
