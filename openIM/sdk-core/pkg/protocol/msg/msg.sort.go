package msg

type ActiveConversationWithUnreadCountsSort []*ActiveConversationWithUnreadCount

func (s ActiveConversationWithUnreadCountsSort) Len() int {
	return len(s)
}

func (s ActiveConversationWithUnreadCountsSort) getMaxTime(v *ActiveConversationWithUnreadCount) int64 {
	if v.MaxMsgTime > v.MaxNotificationTime {
		return v.MaxMsgTime
	}
	return v.MaxNotificationTime
}

func (s ActiveConversationWithUnreadCountsSort) Less(i, j int) bool {
	iv := s[i]
	it := s.getMaxTime(iv)

	jv := s[j]
	jt := s.getMaxTime(jv)

	if it == jt {
		return iv.ConversationID > jv.ConversationID
	} else {
		return it > jt
	}
}

func (s ActiveConversationWithUnreadCountsSort) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
