import skillsClient from "../core/skillsClient";
import type {
  CronJob,
  CronJobInput,
  CronJobListResult,
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

export const runCronJob = (agentID: string, jobId: string, mode: "force" | "due" = "force") =>
  skillsClient.post(
    `${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}/run`,
    undefined,
    { params: { mode } },
  );

export const getCronRuns = (agentID: string, jobId: string) =>
  skillsClient.get<CronRunsResult, CronRunsResult>(
    `${cronBase(agentID)}/jobs/${encodeURIComponent(jobId)}/runs`,
  );

export const getCronStatus = (agentID: string) =>
  skillsClient.get<CronStatus, CronStatus>(`${cronBase(agentID)}/status`);

// ── 心跳 HEARTBEAT.md ──

export const getHeartbeat = (agentID: string) =>
  skillsClient.get<HeartbeatContent, HeartbeatContent>(hbBase(agentID));

export const saveHeartbeat = (agentID: string, content: string, etag?: string) =>
  skillsClient.put<{ updatedAt?: string; etag?: string }, { updatedAt?: string; etag?: string }>(
    hbBase(agentID),
    { content, encoding: "utf-8", etag },
  );
