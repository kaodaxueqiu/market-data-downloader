export type CronScheduleKind = "cron" | "every" | "at";

export interface CronSchedule {
  kind: CronScheduleKind;
  expr?: string; // kind=cron
  tz?: string; // kind=cron（可选）
  everyMs?: number; // kind=every
  anchorMs?: number; // kind=every（可选起点，省略则用 createdAtMs）
  at?: string; // kind=at（ISO8601，如 2026-06-17T09:00:00+08:00）
}

export type SessionTarget = "main" | "session" | "isolated";

// payload 与 sessionTarget 强绑定：
//   main → { kind:"systemEvent", text }
//   session / isolated → { kind:"agentTurn", message, timeoutSeconds?, allowUnsafeExternalContent? }
export interface CronJobPayload {
  kind: "agentTurn" | "systemEvent";
  message?: string; // agentTurn
  text?: string; // systemEvent
  timeoutSeconds?: number; // agentTurn（可选）
  allowUnsafeExternalContent?: boolean; // agentTurn（可选）
}

export interface CronDelivery {
  mode: "none" | "announce";
  channel?: string; // openim / telegram / email / "last" ...（动态，见 /cron/channels）
  to?: string; // 收件人（OpenIM 下为数字 userID）
  bestEffort?: boolean; // 投递失败不算任务失败
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  // 多排期：>1 条时后端才返回 schedules；单条只返回 schedule（schedule === schedules[0]）。
  // 前端统一读取：const list = job.schedules ?? [job.schedule]
  schedules?: CronSchedule[];
  sessionTarget: SessionTarget;
  sessionId: string; // 铁律：三类任务均必填且非空
  wakeMode?: "now" | "next-heartbeat";
  payload: CronJobPayload;
  delivery?: CronDelivery;
  deleteAfterRun?: boolean;
  description?: string;
  state?: CronJobState;
}

export interface CronJobListResult {
  jobs: CronJob[];
}

// 新建 / 修改任务的请求体（PATCH 时只传需变更的字段；
// 改 sessionTarget 时须同时带上对应 payload 与 sessionId 以满足校验矩阵）
export interface CronJobInput {
  name?: string;
  enabled?: boolean;
  schedule?: CronSchedule;
  schedules?: CronSchedule[];
  sessionTarget?: SessionTarget;
  sessionId?: string;
  wakeMode?: "now" | "next-heartbeat";
  payload?: CronJobPayload;
  delivery?: CronDelivery;
}

export interface CronRunEntry {
  ts?: number;
  jobId?: string;
  action?: string;
  status?: "ok" | "error" | "skipped" | string;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  [k: string]: unknown;
}

export interface CronRunsResult {
  entries: CronRunEntry[];
}

export interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number;
  storePath?: string;
}

// 被拒任务（只读，GET /cron/rejected）
export interface CronRejectedEntry {
  jobId: string;
  reason: string;
  rejectedAtMs: number;
  job: Partial<CronJob>;
}

export interface CronRejectedResult {
  jobs: CronRejectedEntry[];
}

// 可用投递渠道（GET /cron/channels）
export interface CronChannelsResult {
  default: string;
  channels: string[];
}

export interface HeartbeatContent {
  agentID: string;
  name: string;
  exists: boolean;
  encoding: "utf-8";
  content: string;
  size?: number;
  updatedAt?: string;
  etag?: string;
}
