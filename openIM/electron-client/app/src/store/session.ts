import { create } from "zustand";

import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessions as apiGetSessions,
  getSessionHistory as apiGetSessionHistory,
  updateSession as apiUpdateSession,
} from "@/api/services/session";
import type {
  SessionItem,
  SessionMessage,
} from "@/api/types/session";

function sortSessions(sessions: SessionItem[]): SessionItem[] {
  return [...sessions].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

export interface SessionStore {
  agentId: string;
  sessions: SessionItem[];
  activeSessionId: string;
  tabSessionIds: string[];
  unreadCounts: Record<string, number>;
  historyPanel: boolean;

  initSessions: (agentId: string) => Promise<void>;
  createNewSession: (agentId: string) => Promise<string | undefined>;
  switchSession: (sessionId: string) => void;
  addToTabs: (sessionId: string) => void;
  removeFromTabs: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  updateRemark: (sessionId: string, remark: string) => Promise<void>;
  pinSession: (sessionId: string, isPinned: boolean) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  refreshSessionTitle: (sessionId: string, title: string) => void;
  incrementUnread: (sessionId: string) => void;
  clearUnread: (sessionId: string) => void;
  loadSessionHistory: (sessionId: string) => Promise<SessionMessage[]>;
  setHistoryPanel: (open: boolean) => void;
  clearSessionStore: () => void;
  getSessionById: (sessionId: string) => SessionItem | undefined;
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  agentId: "",
  sessions: [],
  activeSessionId: "",
  tabSessionIds: [],
  unreadCounts: {},
  historyPanel: false,

  initSessions: async (agentId: string) => {
    set({ agentId });

    try {
      const resp = await apiGetSessions(agentId);
      const data = resp.data as unknown as { sessions: SessionItem[] };
      let sessions = sortSessions(data?.sessions ?? []);

      if (!sessions.length) {
        const newResp = await apiCreateSession({ agentId, title: "新对话" });
        const created = newResp.data as unknown as SessionItem;
        const first: SessionItem = {
          sessionId: created.sessionId,
          sessionKey: created.sessionKey ?? "",
          title: created.title || "新对话",
          remark: created.remark ?? "",
          createdAt: created.createdAt,
          lastActiveAt: created.lastActiveAt ?? created.createdAt,
          isDefault: false,
          isPinned: false,
          messageCount: 0,
        };
        sessions = [first];
      }

      const latestSessionId = sessions[sessions.length - 1]?.sessionId ?? "";

      set({
        sessions,
        tabSessionIds: latestSessionId ? [latestSessionId] : [],
        activeSessionId: latestSessionId,
      });
    } catch (error) {
      console.error("[Session] 获取 session 列表失败:", error);
    }
  },

  createNewSession: async (agentId: string) => {
    try {
      const resp = await apiCreateSession({ agentId, title: "新对话" });
      const created = resp.data as unknown as SessionItem;
      const newSession: SessionItem = {
        sessionId: created.sessionId,
        sessionKey: created.sessionKey ?? "",
        title: created.title || "新对话",
        remark: created.remark ?? "",
        createdAt: created.createdAt,
        lastActiveAt: created.lastActiveAt ?? created.createdAt,
        isDefault: false,
        isPinned: false,
        messageCount: 0,
      };

      set((state) => ({
        sessions: sortSessions([...state.sessions, newSession]),
        tabSessionIds: [...state.tabSessionIds, newSession.sessionId],
        activeSessionId: newSession.sessionId,
      }));
      return created.sessionId;
    } catch (error) {
      console.error("[Session] 创建 session 失败:", error);
      return undefined;
    }
  },

  switchSession: (sessionId: string) => {
    if (sessionId === get().activeSessionId) return;

    const { tabSessionIds } = get();
    const nextTabs = tabSessionIds.includes(sessionId)
      ? tabSessionIds
      : [...tabSessionIds, sessionId];

    set({
      activeSessionId: sessionId,
      tabSessionIds: nextTabs,
      unreadCounts: { ...get().unreadCounts, [sessionId]: 0 },
    });
  },

  addToTabs: (sessionId: string) => {
    set((state) => {
      if (state.tabSessionIds.includes(sessionId)) return {};
      return { tabSessionIds: [...state.tabSessionIds, sessionId] };
    });
  },

  removeFromTabs: (sessionId: string) => {
    set((state) => {
      const nextTabs = state.tabSessionIds.filter((id) => id !== sessionId);
      const nextActive = state.activeSessionId === sessionId
        ? nextTabs[0] || ""
        : state.activeSessionId;
      return { tabSessionIds: nextTabs, activeSessionId: nextActive };
    });
  },

  renameSession: async (sessionId: string, title: string) => {
    try {
      await apiUpdateSession(get().agentId, sessionId, { title });
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.sessionId === sessionId ? { ...s, title } : s,
        ),
      }));
    } catch (error) {
      console.error("[Session] 重命名失败:", error);
    }
  },

  updateRemark: async (sessionId: string, remark: string) => {
    try {
      await apiUpdateSession(get().agentId, sessionId, { remark });
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.sessionId === sessionId ? { ...s, remark } : s,
        ),
      }));
    } catch (error) {
      console.error("[Session] 更新备注失败:", error);
    }
  },

  pinSession: async (sessionId: string, isPinned: boolean) => {
    try {
      await apiUpdateSession(get().agentId, sessionId, { isPinned });
      set((state) => ({
        sessions: sortSessions(
          state.sessions.map((s) =>
            s.sessionId === sessionId ? { ...s, isPinned } : s,
          ),
        ),
      }));
    } catch (error) {
      console.error("[Session] 置顶操作失败:", error);
    }
  },

  removeSession: async (sessionId: string) => {
    try {
      await apiDeleteSession(get().agentId, sessionId);
      set((state) => {
        const sessions = state.sessions.filter((s) => s.sessionId !== sessionId);
        const tabSessionIds = state.tabSessionIds.filter((id) => id !== sessionId);
        const nextActive =
          state.activeSessionId === sessionId
            ? tabSessionIds[0] || sessions[0]?.sessionId || ""
            : state.activeSessionId;
        const { [sessionId]: _, ...restUnread } = state.unreadCounts;
        return {
          sessions,
          tabSessionIds,
          activeSessionId: nextActive,
          unreadCounts: restUnread,
        };
      });
    } catch (error) {
      console.error("[Session] 删除 session 失败:", error);
    }
  },

  refreshSessionTitle: (sessionId: string, title: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.sessionId === sessionId ? { ...s, title } : s,
      ),
    }));
  },

  incrementUnread: (sessionId: string) => {
    if (sessionId === get().activeSessionId) return;
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [sessionId]: (state.unreadCounts[sessionId] || 0) + 1,
      },
    }));
  },

  clearUnread: (sessionId: string) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [sessionId]: 0 },
    }));
  },

  loadSessionHistory: async (sessionId: string) => {
    try {
      const resp = await apiGetSessionHistory(get().agentId, sessionId);
      const data = resp.data as unknown as { messages: SessionMessage[]; hasMore: boolean };
      return data?.messages ?? [];
    } catch (error) {
      console.error("[Session] 加载历史消息失败:", error);
      return [];
    }
  },

  setHistoryPanel: (open: boolean) => {
    set({ historyPanel: open });
  },

  clearSessionStore: () => {
    set({
      agentId: "",
      sessions: [],
      activeSessionId: "",
      tabSessionIds: [],
      unreadCounts: {},
      historyPanel: false,
    });
  },

  getSessionById: (sessionId: string) =>
    get().sessions.find((s) => s.sessionId === sessionId),
}));
