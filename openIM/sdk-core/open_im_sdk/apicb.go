package open_im_sdk

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk_callback"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/common"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/utils"
	"github.com/openimsdk/protocol/sdkws"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/log"
)

type apiErrCallback struct {
	loginMgrCh   chan common.Cmd2Value
	listener     func() open_im_sdk_callback.OnConnListener
	once         atomic.Bool                 // single atomic for all token errors - only the first fires
	kickedTipsCh chan *sdkws.ForceLogoutTips // buffered(1): WS-kicked-with-tips delivers here during 1s wait
}

func (c *apiErrCallback) OnError(ctx context.Context, err error, attr any) {
	if err == nil {
		return
	}
	codeErr, ok := errs.Unwrap(err).(errs.CodeError)
	if !ok {
		log.ZError(ctx, "OnError callback not CodeError", err)
		return
	}
	log.ZError(ctx, "OnError callback CodeError", err, "code", codeErr.Code(), "msg", codeErr.Msg(), "detail", codeErr.Detail())
	switch codeErr.Code() {
	case errs.TokenExpiredError:
		if c.once.CompareAndSwap(false, true) {
			log.ZError(ctx, "OnUserTokenExpired callback", err)
			c.listener().OnUserTokenExpired()
			_ = common.DispatchLogout(ctx, c.loginMgrCh)
		}
	case
		errs.TokenInvalidError,
		errs.TokenMalformedError,
		errs.TokenNotValidYetError,
		errs.TokenUnknownError,
		errs.TokenNotExistError:
		if c.once.CompareAndSwap(false, true) {
			log.ZError(ctx, "OnUserTokenInvalid callback", err)
			c.listener().OnUserTokenInvalid(err.Error())
			_ = common.DispatchLogout(ctx, c.loginMgrCh)
		}
	case errs.TokenKickedError:
		var tips *sdkws.ForceLogoutTips
		if attr != nil {
			if val, ok := attr.(*sdkws.ForceLogoutTips); ok {
				tips = val
			} else {
				log.ZError(ctx, "OnKickedOffline callback attr not ForceLogoutTips", nil, "type", fmt.Sprintf("%T", attr), "attr", attr)
			}
		}
		select {
		case c.kickedTipsCh <- tips:
		default:
		}
		if c.once.CompareAndSwap(false, true) {
			last := tips
			timer := time.NewTimer(time.Second / 2)
			go func() {
				defer func() {
					timer.Stop()
					if last == nil {
						last = &sdkws.ForceLogoutTips{}
					}
					if last.KickType == "" {
						last.KickType = "token_kicked"
					}
					c.listener().OnKickedOffline(utils.StructToJsonStringDefault(last))
				}()
				for {
					if last != nil && last.KickType != "" {
						return
					}
					select {
					case <-timer.C:
						log.ZDebug(ctx, "OnKickedOffline timer expired, proceeding with logout", "lastTips", last)
						return
					case newTips := <-c.kickedTipsCh:
						last = newTips
					}
				}
			}()
		}
	}
}
