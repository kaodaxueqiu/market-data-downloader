import { DesktopOutlined } from "@ant-design/icons";
import { AutoComplete, Alert, Modal, Tooltip } from "antd";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { feedbackToast } from "@/utils/feedback";

const ACTIVE_STATUS = ["running", "connected", "starting"];

// 导航项下方的短标签
const navLabel = (status: string) => {
  switch (status) {
    case "connected":
      return "已连接";
    case "running":
      return "控制中";
    case "starting":
      return "连接中";
    case "disconnected":
      return "已断开";
    case "error":
      return "异常";
    default:
      return "控制本机";
  }
};

// 完整状态文案（tooltip 用）
const statusLabel = (status: string) => {
  switch (status) {
    case "connected":
      return "智能体控制本机 · 已连接";
    case "running":
      return "智能体控制本机 · 运行中";
    case "starting":
      return "正在连接…";
    case "disconnected":
      return "智能体控制本机 · 已断开";
    case "error":
      return "智能体控制本机 · 异常";
    default:
      return "允许智能体控制本机";
  }
};

const navColor = (status: string) => {
  if (ACTIVE_STATUS.includes(status)) return "#0289FA";
  if (status === "error" || status === "disconnected") return "#E6A23C";
  return "#8a8a8a";
};

const OpenclawControl = () => {
  const [status, setStatus] = useState("stopped");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const isActive = useMemo(() => ACTIVE_STATUS.includes(status), [status]);
  const starting = status === "starting";

  useEffect(() => {
    const api = window.electronAPI?.openclaw;
    if (!api) return;
    api
      .getStatus()
      .then((res) => setStatus(res?.status || "stopped"))
      .catch(() => setStatus("stopped"));
    const unsub = api.onStatusChange((data) => {
      setStatus(data?.status || "stopped");
      setMessage(data?.message || data?.error || "");
    });
    return () => unsub?.();
  }, []);

  // 非 Electron 环境（纯浏览器调试）不渲染
  if (!window.electronAPI?.openclaw) return null;

  const handleToggle = async () => {
    const oc = window.electronAPI?.openclaw;
    if (!oc) return;
    if (isActive) {
      try {
        const res = await oc.stop();
        if (res.success) {
          setStatus("stopped");
          feedbackToast({ msg: "已关闭智能体控制" });
        } else {
          feedbackToast({ error: { message: res.error || "关闭失败" } });
        }
      } catch (e) {
        feedbackToast({ error: { message: (e as Error).message || "关闭失败" } });
      }
      return;
    }
    setAgentName("");
    try {
      const config = await oc.getConfig();
      setHistory(config?.agentHistory || []);
    } catch {
      /* ignore */
    }
    setDialogOpen(true);
  };

  const confirmStart = async () => {
    const oc = window.electronAPI?.openclaw;
    if (!oc) return;
    const name = agentName.trim();
    if (!name) {
      feedbackToast({ error: { message: "请选择或输入智能体名称" } });
      return;
    }
    setStatus("starting");
    setMessage("正在启动…");
    try {
      const res = await oc.start(name);
      if (res.success) {
        setDialogOpen(false);
      } else {
        setStatus("error");
        feedbackToast({ error: { message: res.error || "启动失败" } });
      }
    } catch (e) {
      setStatus("error");
      feedbackToast({ error: { message: (e as Error).message || "启动失败" } });
    }
  };

  return (
    <>
      <Tooltip title={message || statusLabel(status)} placement="right">
        <div
          className={clsx(
            "mb-3 flex h-13 w-16 cursor-pointer flex-col items-center justify-center rounded-md hover:bg-[#e9e9eb]",
            { "bg-[#e9e9eb]": isActive },
          )}
          onClick={handleToggle}
        >
          <DesktopOutlined style={{ fontSize: 20, color: navColor(status) }} />
          <div className="mt-1 text-xs whitespace-nowrap" style={{ color: navColor(status) }}>
            {navLabel(status)}
          </div>
        </div>
      </Tooltip>

      <Modal
        title="允许智能体控制本机"
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={confirmStart}
        okText="确认开启"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: !agentName.trim(), loading: starting }}
        width={460}
        maskClosable={false}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          message="安全提示"
          description="开启后，智能体将获得操控本机电脑的权限（包括屏幕查看、键鼠操作、命令执行等）。请确认你信任该智能体，并在使用完毕后及时关闭。"
          style={{ marginBottom: 16 }}
        />
        <div className="flex items-center">
          <span className="mr-3 shrink-0">智能体名称</span>
          <AutoComplete
            className="flex-1"
            value={agentName}
            onChange={(v) => setAgentName(v)}
            options={history.map((n) => ({ value: n }))}
            placeholder="选择或输入智能体名称"
            filterOption={(input, option) =>
              (option?.value as string).toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </div>
      </Modal>
    </>
  );
};

export default OpenclawControl;
