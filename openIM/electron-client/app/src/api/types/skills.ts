export type SkillFileType = "file" | "directory";

export interface SkillStorageInfo {
  agentID: string;
  agentName?: string;
  name?: string;
  rootName?: string;
  // available=true 即应渲染（私有建没建不影响显示，公共 _shared 始终在）
  available: boolean;
  readonly: boolean;
  initialized: boolean;
  // 私有空间是否存在 / 公共空间是否存在
  privateAvailable?: boolean;
  sharedAvailable?: boolean;
  updatedAt?: string;
}

export interface SkillFileItem {
  name: string;
  path: string;
  type: SkillFileType;
  size: number;
  updatedAt?: string;
  mimeType?: string;
  editable?: boolean;
  // 共享/只读项（如 _shared 目录及其内容）由后端标记 readonly=true
  readonly?: boolean;
}

export interface SkillFileListResult {
  path: string;
  items: SkillFileItem[];
}

export interface SkillFileContent {
  agentID?: string;
  path: string;
  name: string;
  encoding: string;
  content: string;
  size: number;
  updatedAt?: string;
  etag?: string;
}

export interface SkillsApiError {
  code: string;
  message: string;
}
