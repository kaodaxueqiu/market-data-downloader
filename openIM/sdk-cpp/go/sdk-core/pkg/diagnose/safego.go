package diagnose

import "context"

type CrashHandler interface {
	HandlePanic(ctx context.Context, p any)
}

func SafeGo(ctx context.Context, h CrashHandler, fn func()) {
	goWithRecover(ctx, h, fn, false)
}

func SafeGoDefault(ctx context.Context, fn func()) {
	SafeGo(ctx, nil, fn)
}

func CrashGo(ctx context.Context, h CrashHandler, fn func()) {
	goWithRecover(ctx, h, fn, true)
}

func CrashGoDefault(ctx context.Context, fn func()) {
	CrashGo(ctx, nil, fn)
}

func goWithRecover(ctx context.Context, h CrashHandler, fn func(), repanic bool) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				if h != nil {
					h.HandlePanic(ctx, r)
				} else {
					ReportPanic(ctx, r)
				}
				if repanic {
					panic(r)
				}
			}
		}()
		fn()
	}()
}
