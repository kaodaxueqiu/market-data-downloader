export interface AgentProfileFile {
  // SOUL.md / IDENTITY.md / AGENTS.md / USER.md / TOOLS.md
  name: string;
  exists: boolean;
  editable: boolean;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
  etag?: string;
}

export interface AgentProfileListResult {
  agentID: string;
  name?: string;
  items: AgentProfileFile[];
}

export interface AgentProfileFileContent {
  agentID: string;
  name: string;
  encoding: "utf-8";
  content: string;
  size: number;
  updatedAt?: string;
  etag?: string;
}

export interface AgentProfileSaveResult {
  name: string;
  updatedAt?: string;
  etag?: string;
}
