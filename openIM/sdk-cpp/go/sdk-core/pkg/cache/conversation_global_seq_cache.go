package cache

// ConversationSeqInfo stores per-conversation max seq and has-read seq.
// This cache is used as a global conversation-level seq cache, independent
// of view-type based caches used for message pulling.
type ConversationSeqInfo struct {
	MaxSeq     int64
	HasReadSeq int64
}

// ConversationSeqCache is a cache for ConversationSeqInfo keyed by conversationID.
type ConversationSeqCache struct {
	*Cache[string, ConversationSeqInfo]
}

func NewConversationSeqCache() *ConversationSeqCache {
	return &ConversationSeqCache{Cache: NewCache[string, ConversationSeqInfo]()}
}

func (c ConversationSeqCache) GetMaxSeq(conversationID string) int64 {
	if c.Cache == nil {
		return 0
	}
	info, ok := c.Load(conversationID)
	if !ok {
		return 0
	}
	return info.MaxSeq
}

func (c ConversationSeqCache) GetHasReadSeq(conversationID string) int64 {
	if c.Cache == nil {
		return 0
	}
	info, ok := c.Load(conversationID)
	if !ok {
		return 0
	}
	return info.HasReadSeq
}

func (c ConversationSeqCache) SetSeq(conversationID string, maxSeq, hasReadSeq int64) {
	if c.Cache == nil {
		return
	}
	info, _ := c.Load(conversationID)
	info.MaxSeq = maxSeq
	info.HasReadSeq = hasReadSeq
	c.Store(conversationID, info)
}

func (c ConversationSeqCache) SetHasReadSeq(conversationID string, hasReadSeq int64) {
	if c.Cache == nil {
		return
	}
	info, _ := c.Load(conversationID)
	info.HasReadSeq = hasReadSeq
	c.Store(conversationID, info)
}

func (c ConversationSeqCache) IncrMaxSeq(conversationID string, num int64) {
	if c.Cache == nil {
		return
	}
	info, _ := c.Load(conversationID)
	info.MaxSeq += num
	c.Store(conversationID, info)
}

func (c ConversationSeqCache) IsNewMsg(conversationID string, seq int64) bool {
	if c.Cache == nil {
		return true
	}
	info, _ := c.Load(conversationID)
	return seq > info.MaxSeq
}
