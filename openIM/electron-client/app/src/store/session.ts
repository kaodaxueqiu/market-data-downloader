import { create } from "zustand";

import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessions as apiGetSessions,
  getSessionHistory as apiGetSessionHistory,
  updateSession as apiUpdateSession,
} from "@/api/services/session";
import {
  LEGACY_SESSION_ID,
  LEGACY_SESSION_TITLE,
  type SessionItem,
  type SessionMessage,
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

  initSessions: (agentId: string, activeId?: string) => Promise<void>;
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
  setHistoryPanel: (open: boolean) => Promise<void>;
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

  initSessions: async (agentId: string, activeId?: string) => {
    set({
      agentId,
      activeSessionId: "",
      sessions: [],
    });

    const legacySession: SessionItem = {
      sessionId: LEGACY_SESSION_ID,
      sessionKey: "",
      title: LEGACY_SESSION_TITLE,
      remark: "包含未分组的早期消息",
      createdAt: 0,
      lastActiveAt: 0,
      isDefault: false,
      isPinned: true,
      isOpen: false,
      messageCount: 0,
    };

    try {
      const resp = await apiGetSessions(agentId);
      const data = resp.data as unknown as { sessions: SessionItem[] };
      let sessions = sortSessions(data?.sessions ?? []);

      sessions = [legacySession, ...sessions.filter((s) => s.sessionId !== LEGACY_SESSION_ID)];

      let restoredTabs = sessions
        .filter((s) => s.isOpen)
        .map((s) => s.sessionId);

      let targetId = "";
      if (activeId && restoredTabs.includes(activeId)) {
        targetId = activeId;
      } else if (restoredTabs.length > 0) {
        targetId = restoredTabs[0];
      }

      if (restoredTabs.length === 0) {
        const fallbackId = activeId || LEGACY_SESSION_ID;
        if (sessions.some((s) => s.sessionId === fallbackId)) {
          restoredTabs = [fallbackId];
          targetId = fallbackId;
        }
      }

      set({
        sessions,
        tabSessionIds: restoredTabs,
        activeSessionId: targetId,
      });
    } catch (error) {
      console.error("[Session] 获取 session 列表失败:", error);
      set({
        activeSessionId: activeId ?? "",
        sessions: [],
        tabSessionIds: [],
      });
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
        isOpen: true,
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

    const { tabSessionIds, agentId } = get();
    const isNew = !tabSessionIds.includes(sessionId);
    const nextTabs = isNew ? [...tabSessionIds, sessionId] : tabSessionIds;

    if (isNew && sessionId !== LEGACY_SESSION_ID) {
      apiUpdateSession(agentId, sessionId, { isOpen: true }).catch(console.error);
    }

    set({
      activeSessionId: sessionId,
      tabSessionIds: nextTabs,
      unreadCounts: { ...get().unreadCounts, [sessionId]: 0 },
    });
  },

  addToTabs: (sessionId: string) => {
    set((state) => {
      if (state.tabSessionIds.includes(sessionId)) return {};
      if (sessionId !== LEGACY_SESSION_ID) {
        apiUpdateSession(state.agentId, sessionId, { isOpen: true }).catch(console.error);
      }
      return { tabSessionIds: [...state.tabSessionIds, sessionId] };
    });
  },

  removeFromTabs: (sessionId: string) => {
    set((state) => {
      const nextTabs = state.tabSessionIds.filter((id) => id !== sessionId);
      const nextActive = state.activeSessionId === sessionId
        ? nextTabs[0] || ""
        : state.activeSessionId;
      if (sessionId !== LEGACY_SESSION_ID) {
        apiUpdateSession(state.agentId, sessionId, { isOpen: false }).catch(console.error);
      }
      return { tabSessionIds: nextTabs, activeSessionId: nextActive };
    });
  },

  renameSession: async (sessionId: string, title: string) => {
    if (sessionId === LEGACY_SESSION_ID) return;
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
    if (sessionId === LEGACY_SESSION_ID) return;
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
    if (sessionId === LEGACY_SESSION_ID) return;
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
    if (sessionId === LEGACY_SESSION_ID) return [];
    try {
      const resp = await apiGetSessionHistory(get().agentId, sessionId);
      const data = resp.data as unknown as { messages: SessionMessage[]; hasMore: boolean };
      return data?.messages ?? [];
    } catch (error) {
      console.error("[Session] 加载历史消息失败:", error);
      return [];
    }
  },

  setHistoryPanel: async (open: boolean) => {
    set({ historyPanel: open });
    if (open) {
      const { agentId } = get();
      if (!agentId) return;
      try {
        const resp = await apiGetSessions(agentId);
        const data = resp.data as unknown as { sessions: SessionItem[] };
        const legacySession: SessionItem = {
          sessionId: LEGACY_SESSION_ID,
          sessionKey: "",
          title: LEGACY_SESSION_TITLE,
          remark: "包含未分组的早期消息",
          createdAt: 0,
          lastActiveAt: 0,
          isDefault: false,
          isPinned: true,
          isOpen: false,
          messageCount: 0,
        };
        let sessions = sortSessions(data?.sessions ?? []);
        sessions = [legacySession, ...sessions.filter((s) => s.sessionId !== LEGACY_SESSION_ID)];
        set({ sessions });
      } catch (error) {
        console.error("[Session] 刷新 session 列表失败:", error);
      }
    }
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
