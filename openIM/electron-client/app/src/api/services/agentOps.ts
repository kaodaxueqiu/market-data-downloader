import adminClient from "../core/adminClient";
import type {
  AgentLogsResult,
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
