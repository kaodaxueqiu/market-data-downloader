// 「按智能体主人返回的会话」——用于定时任务绑定会话
export interface AgentOwnerSession {
  sessionId: string;
  title?: string;
  isOpen?: boolean;
  isPinned?: boolean;
  messageCount?: number;
  userId?: string;
  ownerName?: string;
  lastActiveAt?: number | string;
  createdAt?: number | string;
}

export interface AgentSessionsResult {
  agentID: string;
  name?: string;
  ownerUserID?: string;
  ownerName?: string;
  owners?: { userID: string; nickname: string }[];
  sessions: AgentOwnerSession[];
}
