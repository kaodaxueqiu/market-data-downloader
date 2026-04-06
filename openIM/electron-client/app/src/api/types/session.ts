export const LEGACY_SESSION_ID = "__legacy__";
export const LEGACY_SESSION_TITLE = "未分组对话";

export interface SessionItem {
  sessionId: string;
  sessionKey: string;
  title: string;
  remark: string;
  createdAt: number;
  lastActiveAt: number;
  isDefault: boolean;
  isPinned: boolean;
  isOpen: boolean;
  messageCount: number;
}

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface CreateSessionParams {
  agentId: string;
  title: string;
}

export interface CreateSessionResp {
  sessionId: string;
  title: string;
  createdAt: number;
}

export interface UpdateSessionParams {
  title?: string;
  remark?: string;
  isPinned?: boolean;
  isOpen?: boolean;
}

export interface SessionHistoryResp {
  messages: SessionMessage[];
  hasMore: boolean;
  cursor: string;
}
