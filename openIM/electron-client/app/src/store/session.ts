import { create } from "zustand";

import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessions as apiGetSessions,
  getSessionHistory as apiGetSessionHistory,
  updateSession as apiUpdateSession,
} from "@/api/services/session";
import {
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
  reopenSession: (sessionId: string) => Promise<void>;
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

    try {
      const resp = await apiGetSessions(agentId);
      const data = resp.data as unknown as { sessions: SessionItem[] };
      const sessions = sortSessions(data?.sessions ?? []);

      let restoredTabs = sessions
        .filter((s) => s.isOpen)
        .map((s) => s.sessionId);

      let targetId = "";
      if (activeId && restoredTabs.includes(activeId)) {
        targetId = activeId;
      } else if (activeId && sessions.some((s) => s.sessionId === activeId)) {
        // 最新一条消息所在的 session 即使被叉掉(isOpen=false)，进入会话时也强制拉回标签栏，
        // 覆盖「定时任务/他人消息到达时用户不在该会话」导致的隐藏 session 收不到提示问题
        restoredTabs = [...restoredTabs, activeId];
        targetId = activeId;
        apiUpdateSession(agentId, activeId, { isOpen: true }).catch(console.error);
      } else if (restoredTabs.length > 0) {
        targetId = restoredTabs[0];
      }

      // 无任何已打开标签时,默认选中第一个真实会话;一个会话都没有则保持未选中
      // (未选中时聊天底部输入框会被禁用,防止产生无 sessionId 的消息)。
      if (restoredTabs.length === 0 && sessions.length > 0) {
        targetId = sessions[0].sessionId;
        restoredTabs = [targetId];
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

    if (isNew) {
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
      apiUpdateSession(state.agentId, sessionId, { isOpen: true }).catch(console.error);
      return { tabSessionIds: [...state.tabSessionIds, sessionId] };
    });
  },

  reopenSession: async (sessionId: string) => {
    if (!sessionId) return;
    const state = get();
    const alreadyOpen = state.tabSessionIds.includes(sessionId);
    const existsLocally = state.sessions.some((s) => s.sessionId === sessionId);

    // 本地没有这个 session（可能是后端/定时任务新建的），先刷新列表
    if (!existsLocally && state.agentId) {
      try {
        const resp = await apiGetSessions(state.agentId);
        const data = resp.data as unknown as { sessions: SessionItem[] };
        const sessions = sortSessions(data?.sessions ?? []);
        set({ sessions });
      } catch (error) {
        console.error("[Session] reopenSession 刷新列表失败:", error);
      }
    }

    if (alreadyOpen) return;

    apiUpdateSession(get().agentId, sessionId, { isOpen: true }).catch(console.error);

    set((s) => ({
      tabSessionIds: s.tabSessionIds.includes(sessionId)
        ? s.tabSessionIds
        : [...s.tabSessionIds, sessionId],
    }));
  },

  removeFromTabs: (sessionId: string) => {
    set((state) => {
      const nextTabs = state.tabSessionIds.filter((id) => id !== sessionId);
      const nextActive = state.activeSessionId === sessionId
        ? nextTabs[0] || ""
        : state.activeSessionId;
      apiUpdateSession(state.agentId, sessionId, { isOpen: false }).catch(console.error);
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

  setHistoryPanel: async (open: boolean) => {
    set({ historyPanel: open });
    if (open) {
      const { agentId } = get();
      if (!agentId) return;
      try {
        const resp = await apiGetSessions(agentId);
        const data = resp.data as unknown as { sessions: SessionItem[] };
        const sessions = sortSessions(data?.sessions ?? []);
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
