import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { FC, useMemo } from "react";

import type { Agent } from "@/api/types/agent";
import { getAgentUrl } from "@/config";
import { getChatToken } from "@/utils/storage";

type AgentState =
  | "idle"
  | "thinking"
  | "reading"
  | "searching"
  | "coding"
  | "writing"
  | "browsing"
  | "tool_calling"
  | "generating"
  | "offline";

interface AgentStatus {
  state: AgentState;
  currentTool?: string;
  toolDetail?: string;
  elapsedMs?: number;
  lastActivity: number;
}

interface StateDisplay {
  icon: string;
  text: string;
  color: string;
}

const STATE_DISPLAY: Record<AgentState, StateDisplay> = {
  idle: { icon: "😴", text: "就绪", color: "#9CA3AF" },
  thinking: { icon: "🤔", text: "思考中…", color: "#F59E0B" },
  reading: { icon: "📖", text: "读取中…", color: "#3B82F6" },
  searching: { icon: "🔍", text: "搜索中…", color: "#8B5CF6" },
  coding: { icon: "⚡", text: "执行中…", color: "#10B981" },
  writing: { icon: "✏️", text: "写入中…", color: "#6366F1" },
  browsing: { icon: "🌐", text: "浏览中…", color: "#06B6D4" },
  tool_calling: { icon: "🔧", text: "工具调用中…", color: "#F97316" },
  generating: { icon: "💬", text: "生成回复中…", color: "#EC4899" },
  offline: { icon: "🔴", text: "离线", color: "#EF4444" },
};

export const AgentStatusPanel: FC<{
  agent: Agent;
  userID: string;
  active: boolean;
}> = ({ agent, userID, active }) => {
  const { data: status, isError } = useQuery<AgentStatus>({
    queryKey: ["agent-status", agent.userID, userID],
    queryFn: async () => {
      const token = await getChatToken();
      const resp = await axios.get(`${getAgentUrl()}/bot/agent/status`, {
        params: { agentID: agent.userID, userID },
        headers: { token: token ?? "" },
      });
      const body = resp.data;
      if (body?.data) return body.data;
      return body;
    },
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (active || (state && state !== "idle" && state !== "offline")) return 1000;
      return 15000;
    },
    enabled: true,
    retry: false,
  });

  const display = useMemo(
    () =>
      isError
        ? STATE_DISPLAY.offline
        : (STATE_DISPLAY[status?.state ?? "idle"] ?? STATE_DISPLAY.idle),
    [status?.state, isError],
  );

  const elapsed = useMemo(() => {
    if (!status?.elapsedMs || status.elapsedMs <= 0 || status.state === "idle") return "";
    const sec = status.elapsedMs / 1000;
    return sec >= 60
      ? `${Math.floor(sec / 60)}m${Math.round(sec % 60)}s`
      : `${sec.toFixed(1)}s`;
  }, [status?.elapsedMs, status?.state]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderLeft: `3px solid ${display.color}`,
        backgroundColor: `${display.color}10`,
        fontSize: "13px",
        transition: "all 0.3s ease",
      }}
    >
      <span>{display.icon}</span>
      <span style={{ color: display.color, fontWeight: 500 }}>{display.text}</span>

      {status?.currentTool && (
        <span style={{ color: "#6B7280", fontSize: "12px" }}>
          {status.currentTool}
          {status.toolDetail && (
            <span style={{ marginLeft: "4px", opacity: 0.7 }}>
              ({status.toolDetail})
            </span>
          )}
        </span>
      )}

      {elapsed && (
        <span style={{ color: "#9CA3AF", fontSize: "12px", marginLeft: "auto" }}>
          {elapsed}
        </span>
      )}
    </div>
  );
};

export default AgentStatusPanel;
