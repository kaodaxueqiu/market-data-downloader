import skillsClient from "../core/skillsClient";
import type {
  WorkspaceApiError,
  WorkspaceFileContent,
  WorkspaceFileItem,
  WorkspaceFileListResult,
  WorkspaceFileType,
  WorkspaceSaveResult,
  WorkspaceStorageInfo,
} from "../types/agentWorkspace";

const base = (agentID: string) =>
  `/agents/${encodeURIComponent(agentID)}/workspace`;

// 查询空间状态
export const getWorkspaceStorage = (agentID: string) =>
  skillsClient.get<WorkspaceStorageInfo, WorkspaceStorageInfo>(
    `${base(agentID)}`,
  );

// 初始化空间目录
export const initWorkspaceStorage = (agentID: string) =>
  skillsClient.post<
    { agentID: string; initialized: boolean },
    { agentID: string; initialized: boolean }
  >(`${base(agentID)}/init`);

// 列目录
export const listWorkspaceFiles = (agentID: string, path: string) =>
  skillsClient.get<WorkspaceFileListResult, WorkspaceFileListResult>(
    `${base(agentID)}/files`,
    { params: { path } },
  );

// 读取文本文件内容
export const readWorkspaceFile = (agentID: string, path: string) =>
  skillsClient.get<WorkspaceFileContent, WorkspaceFileContent>(
    `${base(agentID)}/files/content`,
    { params: { path } },
  );

// 保存文本文件（etag 乐观锁）
export const saveWorkspaceFile = (
  agentID: string,
  path: string,
  content: string,
  etag?: string,
) =>
  skillsClient.put<WorkspaceSaveResult, WorkspaceSaveResult>(
    `${base(agentID)}/files/content`,
    { path, content, encoding: "utf-8", etag },
  );

// 新建文件 / 文件夹
export const createWorkspaceEntry = (
  agentID: string,
  parentPath: string,
  name: string,
  type: WorkspaceFileType,
) =>
  skillsClient.post<WorkspaceFileItem, WorkspaceFileItem>(
    `${base(agentID)}/files`,
    { parentPath, name, type },
  );

// 删除（文件夹需 recursive）
export const deleteWorkspaceEntry = (
  agentID: string,
  path: string,
  recursive = false,
) =>
  skillsClient.delete(`${base(agentID)}/files`, {
    data: { path, recursive },
  });

// 重命名 / 移动
export const moveWorkspaceEntry = (
  agentID: string,
  fromPath: string,
  toPath: string,
) =>
  skillsClient.patch(`${base(agentID)}/files/move`, { fromPath, toPath });

// 上传文件
export const uploadWorkspaceFile = (
  agentID: string,
  parentPath: string,
  file: File,
  overwrite = false,
) => {
  const fd = new FormData();
  fd.append("parentPath", parentPath);
  fd.append("overwrite", String(overwrite));
  fd.append("file", file);
  return skillsClient.post<WorkspaceFileItem, WorkspaceFileItem>(
    `${base(agentID)}/files/upload`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
};

// 下载文件（返回 Blob）
export const downloadWorkspaceFile = (agentID: string, path: string) =>
  skillsClient.get<Blob, Blob>(`${base(agentID)}/files/download`, {
    params: { path },
    responseType: "blob",
  });

export type { WorkspaceApiError };
