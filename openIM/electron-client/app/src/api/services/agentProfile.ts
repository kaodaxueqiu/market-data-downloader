import skillsClient from "../core/skillsClient";
import type {
  AgentProfileFileContent,
  AgentProfileListResult,
  AgentProfileSaveResult,
} from "../types/agentProfile";

const base = (agentID: string) => `/agents/${encodeURIComponent(agentID)}/profile`;

// 列出人设/配置文件（白名单，含 exists 标识）
export const listProfileFiles = (agentID: string) =>
  skillsClient.get<AgentProfileListResult, AgentProfileListResult>(
    `${base(agentID)}/files`,
  );

// 读取单个文件内容
export const readProfileFile = (agentID: string, name: string) =>
  skillsClient.get<AgentProfileFileContent, AgentProfileFileContent>(
    `${base(agentID)}/files/content`,
    { params: { name } },
  );

// 新增 / 修改文件（etag 乐观锁；新增可不传 etag）
export const saveProfileFile = (
  agentID: string,
  name: string,
  content: string,
  etag?: string,
) =>
  skillsClient.put<AgentProfileSaveResult, AgentProfileSaveResult>(
    `${base(agentID)}/files/content`,
    { name, content, encoding: "utf-8", etag },
  );
