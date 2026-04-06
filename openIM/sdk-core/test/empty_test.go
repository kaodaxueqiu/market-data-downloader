package test

import (
	"runtime"
	"testing"
	"time"

	"github.com/openimsdk/openim-sdk-core/v3/open_im_sdk"
	"github.com/openimsdk/openim-sdk-core/v3/pkg/network"
	pbConversation "github.com/openimsdk/protocol/conversation"
	"github.com/openimsdk/protocol/msg"
	"github.com/openimsdk/protocol/wrapperspb"
)

func TestLogout(t *testing.T) {
	time.Sleep(time.Second * 3)
	t.Log("logout start", runtime.NumGoroutine())
	//log.ZDebug(ctx, "start logout")
	err := open_im_sdk.IMUserContext.Logout(ctx)
	t.Log("logout ok", err, runtime.NumGoroutine())
	network.GetHttpClient().CloseIdleConnections()
	t.Log("logout close http", err, runtime.NumGoroutine())
	runtime.GC()
	t.Log("logout close gc", err, runtime.NumGoroutine())
	const count = 60000
	for i := 0; i < count; i++ {
		time.Sleep(time.Second * 1)
		t.Logf("logout wait [%d/%d] %d", i+1, count, runtime.NumGoroutine())
	}
}

func TestResetUnread(t *testing.T) {
	c := open_im_sdk.IMUserContext.Conversation()
	conversationID := "sg_1798631681"
	req := &msg.ResetConversationUnreadReq{
		ConversationIDs: []string{conversationID},
		Num:             1,
	}
	err := c.ResetConversationUnread(ctx, req)
	if err != nil {
		t.Error(err)
		return
	}
	for i := 0; ; i++ {
		res, err := c.GetAllConversationList(ctx)
		if err != nil {
			t.Error(err)
			return
		}
		for _, v := range res {
			if v.ConversationID != conversationID {
				continue
			}
			t.Logf("%d -> %s -> %d", i, v.ConversationID, v.UnreadCount)
		}
		time.Sleep(time.Second)
	}
}

func TestName2(t *testing.T) {
	c := open_im_sdk.IMUserContext.Conversation()
	conversationID := "sg_1798631681"
	remark := time.Now().Format(time.TimeOnly)
	req := &pbConversation.ConversationReq{ConversationID: conversationID, Remark: wrapperspb.String(remark)}
	err := c.SetConversation(ctx, conversationID, req)
	t.Log(err)
	//time.Sleep(time.Second * 5)
	res, err := c.GetAllConversationList(ctx)
	if err != nil {
		t.Error(err)
		return
	}
	for _, v := range res {
		if v.ConversationID != conversationID {
			continue
		}
		t.Log(v.ConversationID, v.Remark, v.Remark == remark)
	}
	t.Log(remark)

}

func TestName3(t *testing.T) {
	g := open_im_sdk.IMUserContext.Group()
	for i := 1; ; i++ {
		res, err := g.GetSpecifiedGroupsInfo(ctx, []string{"3349744641"})
		if err != nil {
			t.Error(i, err)
			time.Sleep(time.Second)
			continue
		}
		if len(res) == 0 {
			t.Error(i, "res is empty")
			time.Sleep(time.Second)
			continue
		}
		t.Log(i, "-->", res[0].MemberCount)
		time.Sleep(time.Second)
		continue
	}
}

func TestName4(t *testing.T) {
	g := open_im_sdk.IMUserContext.Group()
	if err := g.ChangeGroupMute(ctx, "3349744641", false, []string{"1225225659", "2328144857", "4125858142"}); err != nil {
		t.Error(err)
		return
	}
	for i := 1; ; i++ {
		res, err := g.GetSpecifiedGroupsInfo(ctx, []string{"3349744641"})
		if err != nil {
			t.Error(i, err)
			time.Sleep(time.Second)
			continue
		}
		if len(res) == 0 {
			t.Error(i, "res is empty")
			time.Sleep(time.Second)
			continue
		}
		t.Logf("--> %d %+v", i, res[0].MuteBypassUserIDs)
		time.Sleep(time.Second)
		continue
	}
}
