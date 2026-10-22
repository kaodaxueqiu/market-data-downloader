import { CopyOutlined, FileTextOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Checkbox, Drawer, Empty, Input, Modal, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAgentLogs,
  getAgentStatus,
  getMyAgents,
  restartAgent,
} from "@/api/services/agentOps";
import type { AgentOpsItem, ResearcherStatus } from "@/api/types/agentOps";
import { feedbackToast } from "@/utils/feedback";

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 3 * 60 * 1000;

interface ApiError {
  code?: string;
  message?: string;
}

const errMsg = (error: unknown, fallback: string) => (error as ApiError)?.message || fallback;

const fmtCpu = (milliCores?: number) =>
  milliCores === undefined ? "-" : `${(milliCores / 1000).toFixed(2)} 核`;

const fmtMem = (bytes?: number) => {
  if (bytes === undefined) return "-";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
};

// 滚动重启期间旧 Pod 可能仍是 ready，用 Pod 年龄判断是否已经换成新 Pod
const isFreshPod = (age?: string) => !!age && (/^\d+s$/.test(age) || /^[0-2]m(\d+s)?$/.test(age));

// Chromium 系统日志形如 [87:119:1019/093012.345:ERROR:...]
const CHROMIUM_LINE = /^\[\d+(:\d+)+\/\d+\.\d+:/;

const StatusTag = ({ researcher }: { researcher: ResearcherStatus }) => {
  if (researcher.ready) return <Tag color="success">运行中</Tag>;
  if (researcher.status === "Running") return <Tag color="warning">启动中</Tag>;
  return <Tag color="error">{researcher.status || "异常"}</Tag>;
};

export const MyAgents = () => {
  const [items, setItems] = useState<AgentOpsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [restartingIDs, setRestartingIDs] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, number>>(new Map());

  const [logAgent, setLogAgent] = useState<AgentOpsItem | null>(null);
  const [logTail, setLogTail] = useState(200);
  const [logs, setLogs] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [hideNoise, setHideNoise] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAgents();
      setItems(data.items ?? []);
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "获取智能体列表失败") } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const map = timers.current;
    return () => {
      map.forEach((id) => window.clearInterval(id));
      map.clear();
    };
  }, [load]);

  const setRestarting = (agentID: string, on: boolean) =>
    setRestartingIDs((prev) => {
      const next = new Set(prev);
      if (on) next.add(agentID);
      else next.delete(agentID);
      return next;
    });

  const stopPolling = (agentID: string) => {
    const id = timers.current.get(agentID);
    if (id !== undefined) window.clearInterval(id);
    timers.current.delete(agentID);
    setRestarting(agentID, false);
  };

  const startPolling = (agent: AgentOpsItem) => {
    const startedAt = Date.now();
    let seenNotReady = false;
    const id = window.setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT) {
        stopPolling(agent.agentID);
        feedbackToast({
          error: { message: `${agent.name} 超过 3 分钟仍未恢复，请查看日志` },
        });
        return;
      }
      try {
        const { researcher } = await getAgentStatus(agent.agentID);
        setItems((prev) =>
          prev.map((it) => (it.agentID === agent.agentID ? { ...it, researcher } : it)),
        );
        if (!researcher.ready) seenNotReady = true;
        if (researcher.ready && (seenNotReady || isFreshPod(researcher.age))) {
          stopPolling(agent.agentID);
          feedbackToast({ msg: `${agent.name} 已恢复运行` });
        }
      } catch {
        // 重启过程中状态接口可能短暂失败，继续轮询
      }
    }, POLL_INTERVAL);
    timers.current.set(agent.agentID, id);
  };

  const handleRestart = (agent: AgentOpsItem) => {
    Modal.confirm({
      title: "重启智能体",
      content: `确定要重启「${agent.name}」吗？重启期间智能体暂时无法响应。`,
      okText: "重启",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        setRestarting(agent.agentID, true);
        try {
          await restartAgent(agent.agentID);
          feedbackToast({ msg: "已提交重启，正在等待智能体恢复…" });
          startPolling(agent);
        } catch (error) {
          setRestarting(agent.agentID, false);
          const e = error as ApiError;
          feedbackToast({
            error: {
              message:
                e?.code === "RESTART_TOO_FREQUENT"
                  ? "重启过于频繁，请稍后再试"
                  : errMsg(error, "重启失败，请稍后重试"),
            },
          });
        }
      },
    });
  };

  const loadLogs = useCallback(async (agentID: string, tail: number) => {
    setLogLoading(true);
    try {
      const data = await getAgentLogs(agentID, tail);
      setLogs(data.logs ?? "");
    } catch (error) {
      setLogs("");
      feedbackToast({ error: { message: errMsg(error, "获取日志失败") } });
    } finally {
      setLogLoading(false);
    }
  }, []);

  const openLogs = (agent: AgentOpsItem) => {
    setLogAgent(agent);
    setLogs("");
    loadLogs(agent.agentID, logTail);
  };

  const shownLogs = useMemo(
    () =>
      hideNoise
        ? logs
            .split("\n")
            .filter((line) => !CHROMIUM_LINE.test(line))
            .join("\n")
        : logs,
    [logs, hideNoise],
  );

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(shownLogs);
      feedbackToast({ msg: "已复制" });
    } catch {
      feedbackToast({ error: { message: "复制失败" } });
    }
  };

  const filteredItems = useMemo(() => {
    if (!keyword.trim()) return items;
    const kw = keyword.toLowerCase();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(kw) ||
        it.agentID.toLowerCase().includes(kw) ||
        it.researcher?.agentName?.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  const renderCard = (agent: AgentOpsItem) => {
    const r = agent.researcher;
    const restarting = restartingIDs.has(agent.agentID);
    return (
      <div
        key={agent.agentID}
        className={`group flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
          agent.deployed ? "border-(--gap-text)" : "border-dashed opacity-60"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-(--primary-text)" title={agent.name}>
              {r?.agentName || agent.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-(--sub-text)">{agent.agentID}</div>
          </div>
          <div className="flex-shrink-0">
            {restarting ? (
              <Tag color="processing">重启中</Tag>
            ) : r ? (
              <StatusTag researcher={r} />
            ) : (
              <Tag color="default">未部署</Tag>
            )}
          </div>
        </div>

        {r && (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="flex items-center text-(--sub-text)">
              <span className="mr-1.5 font-medium">CPU</span>
              <span className="text-(--primary-text)">{fmtCpu(r.cpu)}</span>
            </div>
            <div className="flex items-center text-(--sub-text)">
              <span className="mr-1.5 font-medium">内存</span>
              <span className="text-(--primary-text)">{fmtMem(r.memory)}</span>
            </div>
            <div className="flex items-center text-(--sub-text)">
              <span className="mr-1.5 font-medium">运行</span>
              <span className="text-(--primary-text)">{r.age || "-"}</span>
            </div>
            <div className="flex items-center text-(--sub-text)">
              <span className="mr-1.5 font-medium">重启</span>
              <span className="text-(--primary-text)">{r.restarts} 次</span>
            </div>
          </div>
        )}

        {agent.deployed && (
          <div className="mt-5 flex gap-2 border-t border-(--gap-text) pt-3">
            <Button
              size="small"
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => openLogs(agent)}
              className="flex-1"
            >
              日志
            </Button>
            <Button
              size="small"
              danger
              type="text"
              icon={<ReloadOutlined />}
              loading={restarting}
              onClick={() => handleRestart(agent)}
              className="flex-1"
            >
              重启
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex h-12 items-center justify-between gap-3 border-b border-(--gap-text) px-4">
        <span className="flex-shrink-0 text-sm">
          我的智能体
          <span className="ml-1 text-(--sub-text)">
            （共 {items.length} 个
            {keyword && filteredItems.length < items.length && `，搜到 ${filteredItems.length} 个`}）
          </span>
        </span>
        <div className="flex items-center gap-2">
          <Input
            allowClear
            size="small"
            placeholder="搜索名称或 ID"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Spin spinning={loading && items.length === 0}>
          {items.length === 0 && !loading ? (
            <Empty className="mt-20" description="暂无绑定的智能体" />
          ) : filteredItems.length === 0 ? (
            <Empty className="mt-20" description="未找到匹配的智能体" />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {filteredItems.map(renderCard)}
            </div>
          )}
        </Spin>
      </div>

      <Drawer
        title={logAgent ? `日志 - ${logAgent.researcher?.agentName || logAgent.name}` : "日志"}
        width={760}
        open={!!logAgent}
        onClose={() => setLogAgent(null)}
        extra={
          <div className="flex items-center gap-2">
            <Checkbox checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)}>
              隐藏 Chromium 系统日志
            </Checkbox>
            <Select
              size="small"
              value={logTail}
              style={{ width: 110 }}
              options={[200, 500, 1000].map((n) => ({ value: n, label: `最近 ${n} 行` }))}
              onChange={(v) => {
                setLogTail(v);
                if (logAgent) loadLogs(logAgent.agentID, v);
              }}
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={logLoading}
              onClick={() => logAgent && loadLogs(logAgent.agentID, logTail)}
            />
            <Button size="small" icon={<CopyOutlined />} onClick={copyLogs} />
          </div>
        }
      >
        <Spin spinning={logLoading}>
          <pre className="m-0 min-h-[200px] whitespace-pre-wrap break-all rounded bg-[#1e1e1e] p-3 font-mono text-xs leading-5 text-[#d4d4d4]">
            {shownLogs || (logLoading ? "" : "暂无日志")}
          </pre>
        </Spin>
      </Drawer>
    </div>
  );
};
