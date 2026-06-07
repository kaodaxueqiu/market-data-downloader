export type CronScheduleKind = "cron" | "every" | "at";

export interface CronSchedule {
  kind: CronScheduleKind;
  expr?: string; // kind=cron
  tz?: string;
  everyMs?: number; // kind=every
  atMs?: number; // kind=at
}

export interface CronJobPayload {
  kind: "agentTurn" | "systemEvent";
  message?: string;
  timeoutSeconds?: number;
  model?: string;
}

export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error";
  lastDurationMs?: number;
  consecutiveErrors?: number;
  lastError?: string;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  // 多排期：一个任务多个执行时间（任一到点即执行）。与 schedule 二选一
  schedules?: CronSchedule[];
  sessionTarget: "isolated" | "main" | "session";
  // sessionTarget="session" 时绑定的会话 id（需后端 cron 支持，详见需求文档）
  sessionId?: string;
  wakeMode?: string;
  payload: CronJobPayload;
  delivery?: Record<string, unknown>;
  state?: CronJobState;
}

export interface CronJobListResult {
  jobs: CronJob[];
}

export interface CronRunEntry {
  ts?: number;
  status?: string;
  summary?: string;
  durationMs?: number;
  error?: string;
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

// 新建 / 修改任务的请求体（部分字段）
export interface CronJobInput {
  name?: string;
  enabled?: boolean;
  schedule?: CronSchedule;
  schedules?: CronSchedule[];
  sessionTarget?: "isolated" | "main" | "session";
  sessionId?: string;
  payload?: CronJobPayload;
  delivery?: Record<string, unknown>;
}
