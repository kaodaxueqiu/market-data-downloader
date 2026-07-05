// 智能体空间（workspace）类型定义，结构与 skills 对齐

export type WorkspaceFileType = "file" | "directory";

export interface WorkspaceStorageInfo {
  agentID: string;
  agentName?: string;
  name?: string;
  rootName?: string;
  available: boolean;
  readonly: boolean;
  initialized: boolean;
  updatedAt?: string;
}

export interface WorkspaceFileItem {
  name: string;
  path: string;
  type: WorkspaceFileType;
  size: number;
  updatedAt?: string;
  mimeType?: string;
  editable?: boolean;
  readonly?: boolean;
}

export interface WorkspaceFileListResult {
  path: string;
  items: WorkspaceFileItem[];
}

export interface WorkspaceFileContent {
  agentID?: string;
  path: string;
  name: string;
  encoding: string;
  content: string;
  size: number;
  updatedAt?: string;
  etag?: string;
}

export interface WorkspaceSaveResult {
  path: string;
  updatedAt?: string;
  etag?: string;
}

export interface WorkspaceApiError {
  code: string;
  message: string;
}
