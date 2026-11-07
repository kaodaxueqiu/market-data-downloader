import adminClient from "../core/adminClient";
import type {
  AgentLogsResult,
  AgentOfflineResult,
  AgentOnlineResult,
  AgentRestartResult,
  AgentStatusResult,
  MyAgentsResult,
} from "../types/agentOps";

export const getMyAgents = () =>
  adminClient.get<MyAgentsResult, MyAgentsResult>("/my-agents");

export const getAgentStatus = (agentID: string) =>
  adminClient.get<AgentStatusResult, AgentStatusResult>(
    `/agents/${encodeURIComponent(agentID)}/status`,
  );

export const getAgentLogs = (agentID: string, tail = 200) =>
  adminClient.get<AgentLogsResult, AgentLogsResult>(
    `/agents/${encodeURIComponent(agentID)}/logs`,
    { params: { tail } },
  );

export const restartAgent = (agentID: string) =>
  adminClient.post<AgentRestartResult, AgentRestartResult>(
    `/agents/${encodeURIComponent(agentID)}/restart`,
    { confirm: true },
  );

export const onlineAgent = (agentID: string) =>
  adminClient.post<AgentOnlineResult, AgentOnlineResult>(
    `/agents/${encodeURIComponent(agentID)}/online`,
    { confirm: true },
  );

export const offlineAgent = (agentID: string) =>
  adminClient.post<AgentOfflineResult, AgentOfflineResult>(
    `/agents/${encodeURIComponent(agentID)}/offline`,
    { confirm: true },
  );
