package meeting

import "errors"

func (x *GetUserMeetingHistoriesReq) Check() error {
	if x.Pagination == nil {
		return errors.New("pagination is nil")
	}
	return nil
}

func (x *GetUserHostedMeetingsReq) Check() error {
	if x.Pagination == nil {
		return errors.New("pagination is nil")
	}
	return nil
}

func (x *InviteMeetingInviteesReq) Check() error {
	if x == nil {
		return errors.New("req is nil")
	}
	if x.MeetingID == "" {
		return errors.New("meetingID is empty")
	}
	if x.InviterUserID == "" {
		return errors.New("inviter user id is empty")
	}
	if len(x.InviteeUserIDs) == 0 {
		return errors.New("invitee user id list is empty")
	}
	return nil
}
