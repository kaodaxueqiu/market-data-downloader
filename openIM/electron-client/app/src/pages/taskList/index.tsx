import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";

import { modal } from "@/AntdGlobalComp";
import {
  createCronJob,
  deleteCronJob,
  getAgentSessions,
  getCronRuns,
  getHeartbeat,
  listCronJobs,
  patchCronJob,
  runCronJob,
  saveHeartbeat,
} from "@/api/services/taskList";
import type {
  CronJob,
  CronJobInput,
  CronRunEntry,
  CronSchedule,
  HeartbeatContent,
} from "@/api/types/cron";
import type { AgentOwnerSession } from "@/api/types/agentSession";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

interface ApiError {
  code?: string;
  message?: string;
}
const errMsg = (error: unknown, fallback: string) =>
  (error as ApiError)?.message || fallback;

const fmtTime = (ms?: number) => {
  if (!ms) return "-";
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const dowName = (n: number) => WEEK[n % 7];

const weekdayDesc = (dow: string): string | null => {
  if (dow === "1-5") return "工作日";
  if (["0,6", "6,0", "6,7", "0,7"].includes(dow)) return "周末";
  const range = dow.match(/^(\d)-(\d)$/);
  if (range) return `${dowName(+range[1])}至${dowName(+range[2])}`;
  if (/^\d(,\d)+$/.test(dow)) return dow.split(",").map((d) => dowName(+d)).join("、");
  if (/^\d$/.test(dow)) return `每${dowName(+dow)}`;
  return null;
};

// 把常见 cron 表达式翻译成中文；无法识别返回 null（回退原始表达式）
const humanizeCron = (expr?: string): string | null => {
  if (!expr) return null;
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const isInt = (s: string) => /^\d+$/.test(s);
  if (!isInt(min) || !isInt(hour)) return null;
  if (mon !== "*") return null;
  const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  let freq = "每天";
  if (dow !== "*") {
    const w = weekdayDesc(dow);
    if (!w) return null;
    freq = w;
  } else if (dom !== "*") {
    if (!/^\d+(,\d+)*$/.test(dom)) return null;
    const days = dom.split(",").map(Number).sort((a, b) => a - b).join("、");
    freq = `每月 ${days} 号`;
  }
  return `${freq} ${time}`;
};

const humanizeOneSchedule = (s?: CronSchedule) => {
  if (!s) return "-";
  if (s.kind === "cron") {
    return humanizeCron(s.expr) || `cron: ${s.expr}${s.tz ? ` (${s.tz})` : ""}`;
  }
  if (s.kind === "every") {
    const min = s.everyMs ? Math.round(s.everyMs / 60000) : undefined;
    return min ? `每 ${min} 分钟` : "固定间隔";
  }
  if (s.kind === "at") return `一次性 @ ${fmtTime(s.atMs)}`;
  return "-";
};

const scheduleSummary = (job: CronJob) => {
  const list = job.schedules?.length ? job.schedules : job.schedule ? [job.schedule] : [];
  if (!list.length) return "-";
  if (list.length === 1) return humanizeOneSchedule(list[0]);

  // 多排期：若都是同一「日/星期」模式的 cron，合并成「模式 T1、T2…」
  const parsed = list.map((s) => (s.kind === "cron" ? parseCronExpr(s.expr) : null));
  if (
    parsed.every(Boolean) &&
    parsed.every((p) => p!.dom === parsed[0]!.dom && p!.dow === parsed[0]!.dow)
  ) {
    const first = parsed[0]!;
    let freq = "每天";
    if (first.dow !== "*") {
      freq = weekdayDesc(first.dow) || freq;
    } else if (first.dom !== "*") {
      freq = `每月 ${first.dom.split(",").map(Number).sort((a, b) => a - b).join("、")} 号`;
    }
    const times = parsed
      .map((p) => `${String(p!.h).padStart(2, "0")}:${String(p!.m).padStart(2, "0")}`)
      .sort();
    return `${freq} ${times.join("、")}`;
  }
  // 模式不一致 → 各自列出
  return list.map(humanizeOneSchedule).join(" / ");
};

const scheduleRaw = (job: CronJob) => {
  const list = job.schedules?.length ? job.schedules : job.schedule ? [job.schedule] : [];
  return list
    .filter((s) => s.kind === "cron")
    .map((s) => `${s.expr}${s.tz ? `  (${s.tz})` : ""}`)
    .join("\n");
};

// 友好的重复方式（其中 daily/weekly/monthly 底层都生成 cron 表达式）
type RepeatMode = "daily" | "weekly" | "monthly" | "every" | "at" | "cron";

// 把 dow 字段展开成数字数组（1-5 / 1,3,5 / 5）；无法解析返回 null
const expandDow = (dow: string): number[] | null => {
  const range = dow.match(/^(\d)-(\d)$/);
  if (range) {
    const a = +range[1];
    const b = +range[2];
    if (a > b) return null;
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  if (/^\d(,\d)*$/.test(dow)) return dow.split(",").map(Number);
  if (/^\d$/.test(dow)) return [+dow];
  return null;
};

// 把 cron 表达式反解析回友好表单（仅识别 daily/weekly/monthly），否则返回 null（高级 cron）
// 解析单条 cron 表达式 → {m,h,dom,dow}（month 必须为 *，分/时必须为整数）
const parseCronExpr = (
  expr?: string,
): { m: number; h: number; dom: string; dow: string } | null => {
  if (!expr) return null;
  const p = expr.trim().split(/\s+/);
  if (p.length < 5) return null;
  const [min, hour, dom, mon, dow] = p;
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hour) || mon !== "*") return null;
  return { m: +min, h: +hour, dom, dow };
};

// 把一组排期反解析回友好表单（支持多时间）。无法识别返回 null（落到高级 cron）
const parseSchedulesToForm = (
  list: { kind: string; expr?: string; tz?: string; everyMs?: number; atMs?: number }[],
):
  | {
      mode: RepeatMode;
      timeValues?: Dayjs[];
      weekdays?: number[];
      monthDays?: number[];
      everyMinutes?: number;
      atValue?: Dayjs;
      tz?: string;
    }
  | null => {
  if (!list.length) return null;
  if (list.length === 1 && list[0].kind === "every") {
    return { mode: "every", everyMinutes: list[0].everyMs ? Math.round(list[0].everyMs / 60000) : 10 };
  }
  if (list.length === 1 && list[0].kind === "at") {
    return { mode: "at", atValue: list[0].atMs ? dayjs(list[0].atMs) : undefined };
  }
  // 全部是 cron
  if (!list.every((s) => s.kind === "cron")) return null;
  const parsed = list.map((s) => parseCronExpr(s.expr));
  if (parsed.some((x) => !x)) return null;
  const first = parsed[0]!;
  // 所有排期必须是同一个「日/星期」模式，只是时分不同
  if (!parsed.every((x) => x!.dom === first.dom && x!.dow === first.dow)) return null;
  const timeValues = parsed.map((x) => dayjs().hour(x!.h).minute(x!.m).second(0));
  const tz = list[0].tz;
  if (first.dom === "*" && first.dow === "*") return { mode: "daily", timeValues, tz };
  if (first.dom === "*" && first.dow !== "*") {
    const wd = expandDow(first.dow);
    if (!wd) return null;
    return { mode: "weekly", timeValues, weekdays: wd, tz };
  }
  if (first.dow === "*" && /^\d+(,\d+)*$/.test(first.dom)) {
    return { mode: "monthly", timeValues, monthDays: first.dom.split(",").map(Number), tz };
  }
  return null;
};

const WEEKDAY_OPTIONS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 0 },
];

const MONTHDAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 1} 号`,
  value: i + 1,
}));

interface JobFormState {
  name: string;
  enabled: boolean;
  mode: RepeatMode;
  timeValues: Dayjs[]; // daily/weekly/monthly 的时分（支持多个时间）
  weekdays: number[]; // weekly
  monthDays: number[]; // monthly（支持多选几号）
  expr: string; // cron 高级
  tz: string;
  everyMinutes: number;
  atValue: Dayjs | null;
  sessionTarget: "isolated" | "main" | "session";
  sessionId: string;
  message: string;
  timeoutSeconds: number;
  deliveryMode: "none" | "announce";
  deliveryChannel: string;
  deliveryTo: string;
}

const defaultJobForm = (): JobFormState => ({
  name: "",
  enabled: true,
  mode: "daily",
  timeValues: [dayjs().hour(9).minute(0).second(0)],
  weekdays: [1, 2, 3, 4, 5],
  monthDays: [1],
  expr: "0 9 * * 1-5",
  tz: "Asia/Shanghai",
  everyMinutes: 10,
  atValue: null,
  sessionTarget: "session",
  sessionId: "",
  message: "",
  timeoutSeconds: 300,
  deliveryMode: "none",
  deliveryChannel: "openim",
  deliveryTo: "",
});

export const TaskList = () => {
  const agents = useContactStore((state) => state.agents);
  const getAgentsListByReq = useContactStore((state) => state.getAgentsListByReq);
  const friendList = useContactStore((state) => state.friendList);
  const selfInfo = useUserStore((state) => state.selfInfo);

  const [agentKeyword, setAgentKeyword] = useState("");
  const [currentAgentID, setCurrentAgentID] = useState("");
  const [spaceTab, setSpaceTab] = useState<"cron" | "heartbeat">("cron");

  // 该智能体「主人」的会话列表（用于「运行的会话」）
  const [sessions, setSessions] = useState<AgentOwnerSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // cron
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [notProvisioned, setNotProvisioned] = useState(false);

  // job 表单
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobFormState>(defaultJobForm());
  const [submitting, setSubmitting] = useState(false);

  // 运行历史
  const [runsOpen, setRunsOpen] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsTitle, setRunsTitle] = useState("");

  // 心跳
  const [hb, setHb] = useState<HeartbeatContent | null>(null);
  const [hbValue, setHbValue] = useState("");
  const [hbDirty, setHbDirty] = useState(false);
  const [hbLoading, setHbLoading] = useState(false);
  const [hbSaving, setHbSaving] = useState(false);

  useEffect(() => {
    getAgentsListByReq();
  }, []);

  const filteredAgents = useMemo(() => {
    const kw = agentKeyword.trim().toLowerCase();
    if (!kw) return agents;
    return agents.filter(
      (a) =>
        a.nickname?.toLowerCase().includes(kw) ||
        a.userID?.toLowerCase().includes(kw),
    );
  }, [agents, agentKeyword]);

  const currentAgent = useMemo(
    () => agents.find((a) => a.userID === currentAgentID),
    [agents, currentAgentID],
  );

  // 结果投递「接收方」候选：当前用户 + 好友 + 智能体
  const deliveryOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    if (selfInfo?.userID) {
      list.push({ value: selfInfo.userID, label: `我（${selfInfo.nickname || selfInfo.userID}）` });
    }
    (friendList || []).forEach((f) =>
      list.push({ value: f.userID, label: `${f.nickname || f.userID}（${f.userID}）` }),
    );
    agents.forEach((a) =>
      list.push({ value: a.userID, label: `${a.nickname || a.userID}（${a.userID}）` }),
    );
    const seen = new Set<string>();
    return list.filter((o) => o.value && !seen.has(o.value) && seen.add(o.value));
  }, [selfInfo, friendList, agents]);

  const loadJobs = useCallback(async (agentID: string) => {
    setJobsLoading(true);
    try {
      const res = await listCronJobs(agentID, true);
      setJobs(res.jobs || []);
    } catch (error) {
      const code = (error as ApiError)?.code;
      if (code === "AGENT_STORAGE_NOT_PROVISIONED") {
        setNotProvisioned(true);
      } else {
        feedbackToast({ error: { message: errMsg(error, "加载定时任务失败") } });
      }
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadHeartbeat = useCallback(async (agentID: string) => {
    setHbLoading(true);
    try {
      const res = await getHeartbeat(agentID);
      setHb(res);
      setHbValue(res.content ?? "");
      setHbDirty(false);
    } catch (error) {
      const code = (error as ApiError)?.code;
      if (code === "AGENT_STORAGE_NOT_PROVISIONED") {
        setNotProvisioned(true);
      } else {
        feedbackToast({ error: { message: errMsg(error, "加载心跳失败") } });
      }
      setHb(null);
      setHbValue("");
    } finally {
      setHbLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (agentID: string) => {
    setSessionsLoading(true);
    try {
      const res = await getAgentSessions(agentID);
      setSessions(res?.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const selectAgent = async (agentID: string) => {
    if (agentID === currentAgentID) return;
    setCurrentAgentID(agentID);
    setNotProvisioned(false);
    setSpaceTab("cron");
    setJobs([]);
    setHb(null);
    setSessions([]);
    loadSessions(agentID);
    await loadJobs(agentID);
  };

  const switchTab = (tab: "cron" | "heartbeat") => {
    if (tab === spaceTab) return;
    setSpaceTab(tab);
    if (!currentAgentID) return;
    if (tab === "cron") loadJobs(currentAgentID);
    else loadHeartbeat(currentAgentID);
  };

  // ── job 表单 ──
  const openCreate = () => {
    setEditingId(null);
    setJobForm(defaultJobForm());
    if (currentAgentID) loadSessions(currentAgentID);
    setFormOpen(true);
  };

  const openEdit = (job: CronJob) => {
    setEditingId(job.id);
    const f = defaultJobForm();
    f.name = job.name || "";
    f.enabled = job.enabled;
    f.sessionTarget = "session";
    f.sessionId = job.sessionId || "";
    f.message = job.payload?.message || "";
    f.timeoutSeconds = job.payload?.timeoutSeconds || 300;
    f.deliveryMode = (job.delivery?.mode as string) === "announce" ? "announce" : "none";
    f.deliveryChannel = (job.delivery?.channel as string) || "openim";
    f.deliveryTo = (job.delivery?.to as string) || "";

    // 兼容单 schedule 与多 schedules
    const sList = job.schedules && job.schedules.length ? job.schedules : job.schedule ? [job.schedule] : [];
    const parsed = parseSchedulesToForm(sList);
    if (parsed) {
      f.mode = parsed.mode;
      if (parsed.timeValues && parsed.timeValues.length) f.timeValues = parsed.timeValues;
      if (parsed.weekdays) f.weekdays = parsed.weekdays;
      if (parsed.monthDays) f.monthDays = parsed.monthDays;
      if (parsed.everyMinutes) f.everyMinutes = parsed.everyMinutes;
      if (parsed.atValue) f.atValue = parsed.atValue;
      if (parsed.tz) f.tz = parsed.tz;
    } else if (sList[0]?.kind === "cron") {
      f.mode = "cron";
      f.expr = sList[0].expr || "0 9 * * 1-5";
      f.tz = sList[0].tz || "Asia/Shanghai";
    }
    setJobForm(f);
    if (currentAgentID) loadSessions(currentAgentID);
    setFormOpen(true);
  };

  const buildJobInput = (): CronJobInput | null => {
    const f = jobForm;
    if (!f.name.trim()) {
      feedbackToast({ error: { message: "请输入任务名称" } });
      return null;
    }
    const tz = f.tz.trim() || "Asia/Shanghai";
    let schedule: CronJobInput["schedule"];
    let schedules: CronJobInput["schedules"];

    if (f.mode === "daily" || f.mode === "weekly" || f.mode === "monthly") {
      const times = f.timeValues.filter(Boolean);
      if (!times.length) {
        feedbackToast({ error: { message: "请选择时间" } });
        return null;
      }
      let dom = "*";
      let dow = "*";
      if (f.mode === "weekly") {
        if (!f.weekdays.length) {
          feedbackToast({ error: { message: "请选择星期" } });
          return null;
        }
        dow = [...f.weekdays].sort((a, b) => a - b).join(",");
      } else if (f.mode === "monthly") {
        if (!f.monthDays.length) {
          feedbackToast({ error: { message: "请选择每月几号" } });
          return null;
        }
        dom = [...f.monthDays].sort((a, b) => a - b).join(",");
      }
      // 每个时间一条 cron 表达式（模式相同、时分不同）
      const exprs = times.map((t) => `${t.minute()} ${t.hour()} ${dom} * ${dow}`);
      if (exprs.length === 1) {
        schedule = { kind: "cron", expr: exprs[0], tz };
      } else {
        schedules = exprs.map((expr) => ({ kind: "cron", expr, tz }));
      }
    } else if (f.mode === "cron") {
      if (!f.expr.trim()) {
        feedbackToast({ error: { message: "请输入 cron 表达式" } });
        return null;
      }
      schedule = { kind: "cron", expr: f.expr.trim(), tz };
    } else if (f.mode === "every") {
      schedule = { kind: "every", everyMs: Math.max(1, f.everyMinutes) * 60000 };
    } else {
      if (!f.atValue) {
        feedbackToast({ error: { message: "请选择执行时间" } });
        return null;
      }
      schedule = { kind: "at", atMs: f.atValue.valueOf() };
    }

    // 定时任务必须投递（不投递没有意义）：接收方 + 投递会话 均必填
    if (!f.deliveryTo.trim()) {
      feedbackToast({ error: { message: "请选择接收方" } });
      return null;
    }
    if (!f.sessionId) {
      feedbackToast({ error: { message: "请选择要投递到的会话" } });
      return null;
    }

    const input: CronJobInput = {
      name: f.name.trim(),
      enabled: f.enabled,
      sessionTarget: "session",
      sessionId: f.sessionId,
      payload: {
        kind: "agentTurn",
        message: f.message,
        timeoutSeconds: f.timeoutSeconds,
      },
      delivery: {
        mode: "announce",
        channel: f.deliveryChannel.trim() || "openim",
        to: f.deliveryTo.trim(),
      },
    };
    if (schedules) input.schedules = schedules;
    else input.schedule = schedule;
    return input;
  };

  const submitJob = async () => {
    const input = buildJobInput();
    if (!input) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await patchCronJob(currentAgentID, editingId, input);
        feedbackToast({ msg: "已保存" });
      } else {
        await createCronJob(currentAgentID, input);
        feedbackToast({ msg: "任务已创建" });
      }
      setFormOpen(false);
      await loadJobs(currentAgentID);
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "保存失败") } });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (job: CronJob, enabled: boolean) => {
    try {
      await patchCronJob(currentAgentID, job.id, { enabled });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, enabled } : j)),
      );
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "操作失败") } });
    }
  };

  const handleRun = async (job: CronJob) => {
    try {
      await runCronJob(currentAgentID, job.id, "force");
      feedbackToast({ msg: "已触发立即运行" });
      setTimeout(() => loadJobs(currentAgentID), 1500);
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "运行失败") } });
    }
  };

  const handleDelete = (job: CronJob) => {
    modal.confirm({
      title: "删除任务",
      content: `确定删除任务「${job.name}」吗？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteCronJob(currentAgentID, job.id);
          feedbackToast({ msg: "已删除" });
          await loadJobs(currentAgentID);
        } catch (error) {
          feedbackToast({ error: { message: errMsg(error, "删除失败") } });
        }
      },
    });
  };

  const openRuns = async (job: CronJob) => {
    setRunsTitle(job.name);
    setRunsOpen(true);
    setRunsLoading(true);
    try {
      const res = await getCronRuns(currentAgentID, job.id);
      // 倒序：最新的在最上面
      const entries = [...(res.entries || [])].sort(
        (a, b) => (b.ts ?? 0) - (a.ts ?? 0),
      );
      setRuns(entries);
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "加载运行历史失败") } });
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const handleHbSave = async () => {
    setHbSaving(true);
    try {
      const res = await saveHeartbeat(currentAgentID, hbValue, hb?.etag);
      setHb({
        agentID: currentAgentID,
        name: "HEARTBEAT.md",
        exists: true,
        encoding: "utf-8",
        content: hbValue,
        size: hbValue.length,
        updatedAt: res?.updatedAt,
        etag: res?.etag,
      });
      setHbDirty(false);
      feedbackToast({ msg: "已保存" });
    } catch (error) {
      const code = (error as ApiError)?.code;
      if (code === "FILE_CONFLICT") {
        feedbackToast({ error: { message: "心跳已被更新，请刷新后重试" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "保存失败") } });
      }
    } finally {
      setHbSaving(false);
    }
  };

  const columns: ColumnsType<CronJob> = [
    {
      title: "名称",
      dataIndex: "name",
      render: (_, job) => (
        <div className="flex items-center">
          <span className="truncate">{job.name}</span>
          {job.state?.lastStatus === "error" && (
            <Tag className="ml-2" color="error">
              异常
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "排期",
      render: (_, job) => (
        <Tooltip title={scheduleRaw(job) || undefined}>
          <span className="text-xs whitespace-nowrap">{scheduleSummary(job)}</span>
        </Tooltip>
      ),
    },
    {
      title: "下次运行",
      width: 170,
      render: (_, job) => <span className="text-xs">{fmtTime(job.state?.nextRunAtMs)}</span>,
    },
    {
      title: "上次",
      width: 90,
      render: (_, job) => {
        const st = job.state?.lastStatus;
        if (!st) return <span className="text-xs text-(--sub-text)">-</span>;
        return (
          <Tooltip title={`${fmtTime(job.state?.lastRunAtMs)}${job.state?.lastError ? ` · ${job.state.lastError}` : ""}`}>
            <Tag color={st === "ok" ? "success" : "error"}>{st === "ok" ? "成功" : "失败"}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "启用",
      width: 70,
      render: (_, job) => (
        <Switch
          size="small"
          checked={job.enabled}
          onChange={(v) => toggleEnabled(job, v)}
        />
      ),
    },
    {
      title: "操作",
      width: 70,
      render: (_, job) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "run", icon: <PlayCircleOutlined />, label: "立即运行" },
              { key: "runs", icon: <HistoryOutlined />, label: "运行历史" },
              { key: "edit", icon: <EditOutlined />, label: "编辑" },
              { key: "delete", icon: <DeleteOutlined />, label: "删除", danger: true },
            ],
            onClick: ({ key }) => {
              if (key === "run") handleRun(job);
              if (key === "runs") openRuns(job);
              if (key === "edit") openEdit(job);
              if (key === "delete") handleDelete(job);
            },
          }}
        >
          <Button type="text" size="small">
            •••
          </Button>
        </Dropdown>
      ),
    },
  ];

  const renderCron = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--gap-text) px-3 py-2">
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
          新建任务
        </Button>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => loadJobs(currentAgentID)}
        >
          刷新
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <Table
          rowKey="id"
          size="small"
          tableLayout="auto"
          loading={jobsLoading}
          columns={columns}
          dataSource={jobs}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无定时任务" /> }}
        />
      </div>
    </div>
  );

  const renderHeartbeat = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-(--gap-text) px-3 py-2">
        <span className="text-sm font-medium">
          HEARTBEAT.md
          {hb && !hb.exists && (
            <Tag className="ml-2" color="warning">
              未创建
            </Tag>
          )}
          {hbDirty && <span className="ml-2 text-xs text-[#ad8b00]">未保存</span>}
        </span>
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          loading={hbSaving}
          disabled={!hbDirty}
          onClick={handleHbSave}
        >
          保存
        </Button>
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <Spin spinning={hbLoading} wrapperClassName="h-full">
          <Input.TextArea
            className="h-full! resize-none font-mono"
            value={hbValue}
            placeholder="心跳清单（HEARTBEAT.md）。留空表示无定时心跳任务。"
            onChange={(e) => {
              setHbValue(e.target.value);
              setHbDirty(true);
            }}
          />
        </Spin>
      </div>
    </div>
  );

  const renderMain = () => {
    if (!currentAgentID) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="请选择左侧的智能体，管理其任务清单" />
        </div>
      );
    }
    if (notProvisioned) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="该智能体尚未开通存储空间" />
        </div>
      );
    }
    return spaceTab === "cron" ? renderCron() : renderHeartbeat();
  };

  const runsColumns: ColumnsType<CronRunEntry> = [
    { title: "时间", width: 170, render: (_, r) => <span className="text-xs">{fmtTime(r.ts)}</span> },
    {
      title: "状态",
      width: 80,
      render: (_, r) => (
        <Tag color={r.status === "ok" ? "success" : r.status === "error" ? "error" : "default"}>
          {r.status || "-"}
        </Tag>
      ),
    },
    {
      title: "耗时",
      width: 90,
      render: (_, r) => (
        <span className="text-xs">{r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : "-"}</span>
      ),
    },
    {
      title: "摘要 / 错误",
      ellipsis: true,
      render: (_, r) => (
        <span className="text-xs">{r.summary || r.error || "-"}</span>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full bg-white">
      {/* 智能体列表 */}
      <div className="flex w-64 flex-col border-r border-(--gap-text)">
        <div className="p-3 font-semibold">任务清单</div>
        <div className="px-3 pb-2">
          <Input
            allowClear
            placeholder="搜索智能体"
            value={agentKeyword}
            onChange={(e) => setAgentKeyword(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-auto px-2">
          {!filteredAgents.length ? (
            <Empty
              className="mt-[40%]"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无智能体"
            />
          ) : (
            filteredAgents.map((agent) => (
              <div
                key={agent.userID}
                className={`flex cursor-pointer items-center rounded-md px-2.5 py-2 transition-colors hover:bg-(--primary-active) ${
                  agent.userID === currentAgentID ? "bg-(--primary-active)" : ""
                }`}
                onClick={() => selectAgent(agent.userID)}
              >
                <OIMAvatar src={agent.faceURL} text={agent.nickname} size={32} />
                <div className="ml-2.5 truncate text-sm">{agent.nickname}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧主区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center justify-between border-b border-(--gap-text) px-4">
          <span className="text-sm text-(--sub-text)">
            {currentAgent ? (
              <>
                当前智能体：
                <span className="text-(--primary-text)">{currentAgent.nickname}</span>
              </>
            ) : (
              "任务清单"
            )}
          </span>
          {currentAgentID && !notProvisioned && (
            <Segmented
              value={spaceTab}
              onChange={(v) => switchTab(v as "cron" | "heartbeat")}
              options={[
                { label: "定时任务", value: "cron" },
                { label: "心跳任务", value: "heartbeat" },
              ]}
            />
          )}
        </div>
        {renderMain()}
      </div>

      {/* 任务表单 */}
      <Modal
        title={editingId ? "编辑任务" : "新建任务"}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={submitJob}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <div className="flex flex-col gap-3 pt-2">
          <LabeledRow label="任务名称">
            <Input
              value={jobForm.name}
              onChange={(e) => setJobForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="如：每日宏观早报"
            />
          </LabeledRow>

          <LabeledRow label="重复方式">
            <Select
              className="w-full"
              value={jobForm.mode}
              onChange={(v) => setJobForm((s) => ({ ...s, mode: v }))}
              options={[
                { label: "每天", value: "daily" },
                { label: "每周", value: "weekly" },
                { label: "每月", value: "monthly" },
                { label: "固定间隔", value: "every" },
                { label: "一次性", value: "at" },
                { label: "高级（Cron 表达式）", value: "cron" },
              ]}
            />
          </LabeledRow>

          {(jobForm.mode === "daily" ||
            jobForm.mode === "weekly" ||
            jobForm.mode === "monthly") && (
            <LabeledRow label="时间">
              <div className="flex flex-col gap-2">
                {jobForm.timeValues.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <TimePicker
                      className="flex-1"
                      format="HH:mm"
                      allowClear={false}
                      value={t}
                      onChange={(v) =>
                        setJobForm((s) => {
                          const arr = [...s.timeValues];
                          if (v) arr[idx] = v;
                          return { ...s, timeValues: arr };
                        })
                      }
                    />
                    {jobForm.timeValues.length > 1 && (
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() =>
                          setJobForm((s) => ({
                            ...s,
                            timeValues: s.timeValues.filter((_, i) => i !== idx),
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setJobForm((s) => ({
                      ...s,
                      timeValues: [...s.timeValues, dayjs().hour(9).minute(0).second(0)],
                    }))
                  }
                >
                  添加时间
                </Button>
              </div>
            </LabeledRow>
          )}
          {jobForm.mode === "weekly" && (
            <LabeledRow label="星期">
              <Checkbox.Group
                options={WEEKDAY_OPTIONS}
                value={jobForm.weekdays}
                onChange={(v) => setJobForm((s) => ({ ...s, weekdays: v as number[] }))}
              />
            </LabeledRow>
          )}
          {jobForm.mode === "monthly" && (
            <LabeledRow label="每月几号">
              <Select
                className="w-full"
                mode="multiple"
                allowClear
                placeholder="选择每月的日期（可多选）"
                value={jobForm.monthDays}
                onChange={(v) => setJobForm((s) => ({ ...s, monthDays: v as number[] }))}
                options={MONTHDAY_OPTIONS}
              />
            </LabeledRow>
          )}
          {jobForm.mode === "every" && (
            <LabeledRow label="间隔(分钟)">
              <InputNumber
                className="w-full"
                min={1}
                value={jobForm.everyMinutes}
                onChange={(v) => setJobForm((s) => ({ ...s, everyMinutes: Number(v) || 1 }))}
              />
            </LabeledRow>
          )}
          {jobForm.mode === "at" && (
            <LabeledRow label="执行时间">
              <DatePicker
                className="w-full"
                showTime
                value={jobForm.atValue}
                onChange={(v) => setJobForm((s) => ({ ...s, atValue: v }))}
              />
            </LabeledRow>
          )}
          {jobForm.mode === "cron" && (
            <>
              <LabeledRow label="Cron 表达式">
                <Input
                  value={jobForm.expr}
                  onChange={(e) => setJobForm((s) => ({ ...s, expr: e.target.value }))}
                  placeholder="0 9 * * 1-5"
                />
              </LabeledRow>
              <LabeledRow label="时区">
                <Input
                  value={jobForm.tz}
                  onChange={(e) => setJobForm((s) => ({ ...s, tz: e.target.value }))}
                  placeholder="Asia/Shanghai"
                />
              </LabeledRow>
            </>
          )}

          <LabeledRow label="任务内容">
            <Input.TextArea
              rows={3}
              value={jobForm.message}
              onChange={(e) => setJobForm((s) => ({ ...s, message: e.target.value }))}
              placeholder="给智能体的自然语言任务，如：请生成今日宏观早报…"
            />
          </LabeledRow>

          <LabeledRow label="超时(秒)">
            <InputNumber
              className="w-full"
              min={1}
              value={jobForm.timeoutSeconds}
              onChange={(v) => setJobForm((s) => ({ ...s, timeoutSeconds: Number(v) || 300 }))}
            />
          </LabeledRow>

          <LabeledRow label="接收方">
            <AutoComplete
              className="w-full"
              value={jobForm.deliveryTo}
              onChange={(v) => setJobForm((s) => ({ ...s, deliveryTo: v }))}
              options={deliveryOptions}
              placeholder="选择联系人/智能体，或输入用户 ID"
              filterOption={(input, opt) =>
                String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </LabeledRow>
          <LabeledRow label="投递会话">
            <Select
              className="w-full"
              showSearch
              loading={sessionsLoading}
              optionFilterProp="label"
              value={jobForm.sessionId || undefined}
              placeholder={
                sessionsLoading
                  ? "加载会话中…"
                  : sessions.length
                    ? "选择要投递到的会话"
                    : "该智能体暂无会话"
              }
              notFoundContent={sessionsLoading ? "加载中…" : "该智能体暂无会话"}
              onChange={(v) => setJobForm((s) => ({ ...s, sessionId: v }))}
              options={sessions.map((se) => {
                const ts = se.createdAt ?? se.lastActiveAt;
                const timeStr = ts ? dayjs(ts).format("YYYY-MM-DD HH:mm") : "";
                return {
                  label: `${se.title || "未命名会话"}${
                    timeStr ? `（${timeStr}）` : ""
                  } · #${se.sessionId.slice(-6)}`,
                  value: se.sessionId,
                };
              })}
            />
          </LabeledRow>

          {editingId && (
            <LabeledRow label="启用">
              <Switch
                checked={jobForm.enabled}
                onChange={(v) => setJobForm((s) => ({ ...s, enabled: v }))}
              />
            </LabeledRow>
          )}
        </div>
      </Modal>

      {/* 运行历史 */}
      <Modal
        title={`运行历史 · ${runsTitle}`}
        open={runsOpen}
        onCancel={() => setRunsOpen(false)}
        footer={null}
        width="80%"
        style={{ maxWidth: 980, top: 40 }}
        styles={{ body: { paddingTop: 8 } }}
        destroyOnClose
      >
        <Table
          rowKey={(r) => String(r.ts ?? Math.random())}
          size="small"
          loading={runsLoading}
          columns={runsColumns}
          dataSource={runs}
          scroll={{ y: 460 }}
          pagination={{ pageSize: 20, hideOnSinglePage: true, size: "small" }}
          locale={{ emptyText: <Empty description="暂无运行记录" /> }}
          expandable={{
            expandedRowRender: (r) => (
              <div className="max-h-72 cursor-text overflow-auto rounded bg-[#f7f8fa] p-3 text-xs leading-relaxed break-words whitespace-pre-wrap select-text">
                {r.summary || r.error || "无详情"}
              </div>
            ),
            rowExpandable: (r) => Boolean(r.summary || r.error),
          }}
        />
      </Modal>
    </div>
  );
};

const LabeledRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start">
    <span className="mt-1 w-20 shrink-0 text-sm text-(--sub-text)">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);
