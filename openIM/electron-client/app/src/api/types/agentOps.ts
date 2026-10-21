export interface ResearcherStatus {
  name: string;
  status: string;
  ready: boolean;
  image?: string;
  restarts: number;
  age?: string;
  botUserId: string;
  agentName?: string;
  cpu?: number;
  memory?: number;
}

export interface AgentOpsItem {
  agentID: string;
  name: string;
  deployed: boolean;
  researcher?: ResearcherStatus;
}

export interface MyAgentsResult {
  total: number;
  items: AgentOpsItem[];
}

export interface AgentStatusResult {
  researcher: ResearcherStatus;
}

export interface AgentLogsResult {
  agentID: string;
  name: string;
  tail: number;
  podName: string;
  logs: string;
}

export interface AgentRestartResult {
  agentID: string;
  name: string;
  restartedBy: string;
  restartedAt: string;
  cooldownSeconds: number;
}
