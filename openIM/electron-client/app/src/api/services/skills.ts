import skillsClient from "../core/skillsClient";
import type {
  SkillFileContent,
  SkillFileItem,
  SkillFileListResult,
  SkillFileType,
  SkillStorageInfo,
} from "../types/skills";

const base = (agentID: string) => `/agents/${encodeURIComponent(agentID)}/skills`;

// 查询 skills 空间状态
export const getSkillStorage = (agentID: string) =>
  skillsClient.get<SkillStorageInfo, SkillStorageInfo>(`${base(agentID)}/storage`);

// 初始化（创建）skills 目录
export const initSkillStorage = (agentID: string) =>
  skillsClient.post<{ agentID: string; initialized: boolean }, { agentID: string; initialized: boolean }>(
    `${base(agentID)}/storage/init`,
  );

// 列目录
export const listSkillFiles = (agentID: string, path: string) =>
  skillsClient.get<SkillFileListResult, SkillFileListResult>(`${base(agentID)}/files`, {
    params: { path },
  });

// 读取文本文件内容
export const readSkillFile = (agentID: string, path: string) =>
  skillsClient.get<SkillFileContent, SkillFileContent>(`${base(agentID)}/files/content`, {
    params: { path },
  });

// 保存文本文件（etag 乐观锁）
export const saveSkillFile = (
  agentID: string,
  path: string,
  content: string,
  etag?: string,
) =>
  skillsClient.put<{ path: string; updatedAt?: string; etag?: string }, { path: string; updatedAt?: string; etag?: string }>(
    `${base(agentID)}/files/content`,
    { path, content, encoding: "utf-8", etag },
  );

// 新建文件 / 文件夹
export const createSkillEntry = (
  agentID: string,
  parentPath: string,
  name: string,
  type: SkillFileType,
) =>
  skillsClient.post<SkillFileItem, SkillFileItem>(`${base(agentID)}/files`, {
    parentPath,
    name,
    type,
  });

// 删除（文件夹需 recursive）
export const deleteSkillEntry = (agentID: string, path: string, recursive = false) =>
  skillsClient.delete(`${base(agentID)}/files`, { data: { path, recursive } });

// 重命名 / 移动
export const moveSkillEntry = (agentID: string, fromPath: string, toPath: string) =>
  skillsClient.patch(`${base(agentID)}/files/move`, { fromPath, toPath });

// 上传文件
export const uploadSkillFile = (
  agentID: string,
  parentPath: string,
  file: File,
  overwrite = false,
) => {
  const fd = new FormData();
  fd.append("parentPath", parentPath);
  fd.append("overwrite", String(overwrite));
  fd.append("file", file);
  return skillsClient.post<SkillFileItem, SkillFileItem>(`${base(agentID)}/files/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// 下载文件（返回 Blob）
export const downloadSkillFile = (agentID: string, path: string) =>
  skillsClient.get<Blob, Blob>(`${base(agentID)}/files/download`, {
    params: { path },
    responseType: "blob",
  });
