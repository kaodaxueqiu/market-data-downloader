import skillsClient from "../core/skillsClient";
import type {
  CronChannelsResult,
  CronJob,
  CronJobInput,
  CronJobListResult,
  CronRejectedResult,
  CronRunsResult,
  CronStatus,
  HeartbeatContent,
} from "../types/cron";
import type { AgentSessionsResult } from "../types/agentSession";

// 按「智能体主人」返回会话列表（用于定时任务绑定会话）
export const getAgentSessions = (agentID: string) =>
  skillsClient.get<AgentSessionsResult, AgentSessionsResult>(
    `/agents/${encodeURIComponent(agentID)}/sessions`,
  );

const cronBase = (agentID: string) => `/agents/${encodeURIComponent(agentID)}/cron`;
const hbBase = (agentID: string) => `/agents/${encodeURIComponent(agentID)}/heartbeat`;

// ── cron 定时任务 ──

export const listCronJobs = (agentID: string, includeDisabled = true) =>
  skillsClient.get<CronJobListResult, CronJobListResult>(`${cronBase(agentID)}/jobs`, {
    params: { includeDisabled },
  });

export const createCronJob = (agentID: string, body: CronJobInput) =>
  skillsClient.post<CronJob, CronJob>(`${cronBase(agentID)}/jobs`, body);

export const patchCronJob = (agentID: string, jobId: string, patch: CronJobInput) =>
  skillsClient.patch<CronJob, CronJob>(
    `${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}`,
    patch,
  );

export const deleteCronJob = (agentID: string, jobId: string) =>
  skillsClient.delete(`${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}`);

// 立即运行：runMode = force（默认强制立即跑）/ due（仅到期才跑）
export const runCronJob = (
  agentID: string,
  jobId: string,
  runMode: "force" | "due" = "force",
) =>
  skillsClient.post(
    `${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}/run`,
    undefined,
    { params: { runMode } },
  );

// 运行历史：limit 可选，范围 1..5000（越界由后端用默认值）
export const getCronRuns = (agentID: string, jobId: string, limit?: number) =>
  skillsClient.get<CronRunsResult, CronRunsResult>(
    `${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}/runs`,
    limit ? { params: { limit } } : undefined,
  );

export const getCronStatus = (agentID: string) =>
  skillsClient.get<CronStatus, CronStatus>(`${cronBase(agentID)}/status`);

// 被拒任务（只读）：加载期被校验拒绝、留底的任务
export const getRejectedJobs = (agentID: string) =>
  skillsClient.get<CronRejectedResult, CronRejectedResult>(`${cronBase(agentID)}/rejected`);

// 可用投递渠道（动态）：下拉用 channels 渲染、default 作默认选中
export const getCronChannels = (agentID: string) =>
  skillsClient.get<CronChannelsResult, CronChannelsResult>(`${cronBase(agentID)}/channels`);

// ── 心跳 HEARTBEAT.md ──

export const getHeartbeat = (agentID: string) =>
  skillsClient.get<HeartbeatContent, HeartbeatContent>(hbBase(agentID));

export const saveHeartbeat = (agentID: string, content: string, etag?: string) =>
  skillsClient.put<{ updatedAt?: string; etag?: string }, { updatedAt?: string; etag?: string }>(
    hbBase(agentID),
    { content, encoding: "utf-8", etag },
  );
