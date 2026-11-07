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
  replicas?: number; // 副本数：0 = 已下线(Stopped)，1 = 运行中
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

export interface AgentOnlineResult {
  agentID: string;
  name: string;
  onlineBy: string;
  onlineAt: string;
  replicas: number;
}

export interface AgentOfflineResult {
  agentID: string;
  name: string;
  offlineBy: string;
  offlineAt: string;
  replicas: number;
}
