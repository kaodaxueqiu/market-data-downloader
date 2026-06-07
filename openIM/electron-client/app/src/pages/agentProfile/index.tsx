import { FileTextOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listProfileFiles,
  readProfileFile,
  saveProfileFile,
} from "@/api/services/agentProfile";
import type {
  AgentProfileFile,
  AgentProfileFileContent,
} from "@/api/types/agentProfile";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

interface ProfileApiError {
  code?: string;
  message?: string;
}

const errMsg = (error: unknown, fallback: string) =>
  (error as ProfileApiError)?.message || fallback;

const formatTime = (time?: string) => {
  if (!time) return "";
  const d = new Date(time);
  return Number.isNaN(d.getTime()) ? time : d.toLocaleString();
};

export const AgentProfile = () => {
  const agents = useContactStore((state) => state.agents);
  const getAgentsListByReq = useContactStore((state) => state.getAgentsListByReq);

  const [agentKeyword, setAgentKeyword] = useState("");
  const [currentAgentID, setCurrentAgentID] = useState("");

  const [files, setFiles] = useState<AgentProfileFile[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [notProvisioned, setNotProvisioned] = useState(false);

  const [activeName, setActiveName] = useState("");
  const [fileContent, setFileContent] = useState<AgentProfileFileContent | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const activeFile = useMemo(
    () => files.find((f) => f.name === activeName) || null,
    [files, activeName],
  );

  const resetEditor = () => {
    setActiveName("");
    setFileContent(null);
    setEditorValue("");
    setDirty(false);
  };

  const loadFiles = useCallback(async (agentID: string) => {
    setListLoading(true);
    try {
      const res = await listProfileFiles(agentID);
      setFiles(res.items || []);
    } catch (error) {
      const code = (error as ProfileApiError)?.code;
      if (code === "AGENT_STORAGE_NOT_PROVISIONED") {
        setNotProvisioned(true);
      } else {
        feedbackToast({ error: { message: errMsg(error, "加载配置文件失败") } });
      }
      setFiles([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const selectAgent = async (agentID: string) => {
    if (agentID === currentAgentID) return;
    setCurrentAgentID(agentID);
    setNotProvisioned(false);
    setFiles([]);
    resetEditor();
    await loadFiles(agentID);
  };

  const openFile = async (file: AgentProfileFile) => {
    setActiveName(file.name);
    setDirty(false);
    if (!file.exists) {
      // 未创建：直接进入空编辑器，保存即新增
      setFileContent(null);
      setEditorValue("");
      return;
    }
    setFileLoading(true);
    try {
      const content = await readProfileFile(currentAgentID, file.name);
      setFileContent(content);
      setEditorValue(content.content ?? "");
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "读取文件失败") } });
      resetEditor();
    } finally {
      setFileLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeName) return;
    setSaving(true);
    try {
      const res = await saveProfileFile(
        currentAgentID,
        activeName,
        editorValue,
        fileContent?.etag,
      );
      // 用最新 etag/updatedAt 更新本地缓存
      setFileContent({
        agentID: currentAgentID,
        name: activeName,
        encoding: "utf-8",
        content: editorValue,
        size: editorValue.length,
        updatedAt: res?.updatedAt,
        etag: res?.etag,
      });
      setDirty(false);
      feedbackToast({ msg: "已保存" });
      // 刷新列表（exists/updatedAt 变化）
      loadFiles(currentAgentID);
    } catch (error) {
      const code = (error as ProfileApiError)?.code;
      if (code === "FILE_CONFLICT") {
        feedbackToast({ error: { message: "文件已被其他操作更新，请刷新后重试" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "保存失败") } });
      }
    } finally {
      setSaving(false);
    }
  };

  const renderMain = () => {
    if (!currentAgentID) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="请选择左侧的智能体，查看其人设 / 配置" />
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
    return (
      <div className="flex flex-1 overflow-hidden">
        {/* 文件列表 */}
        <div className="flex w-72 flex-col border-r border-(--gap-text)">
          <div className="px-3 py-2.5 text-sm font-semibold">人设 / 配置文件</div>
          <Spin spinning={listLoading} wrapperClassName="flex-1 overflow-auto">
            {files.map((f) => (
              <div
                key={f.name}
                className={`flex cursor-pointer items-center justify-between px-3 py-2.5 hover:bg-(--primary-active) ${
                  activeName === f.name ? "bg-(--primary-active)" : ""
                }`}
                onClick={() => openFile(f)}
              >
                <div className="flex items-center overflow-hidden">
                  <FileTextOutlined className="mr-2 text-gray-400" />
                  <span className="truncate text-sm">{f.name}</span>
                </div>
                {f.exists ? (
                  <span className="ml-2 shrink-0 text-xs text-(--sub-text)">
                    {formatTime(f.updatedAt)}
                  </span>
                ) : (
                  <Tag className="ml-2 shrink-0" color="default">
                    未创建
                  </Tag>
                )}
              </div>
            ))}
          </Spin>
        </div>

        {/* 编辑区 */}
        <div className="flex flex-1 flex-col">
          {!activeName ? (
            <div className="flex flex-1 items-center justify-center text-(--sub-text)">
              <Empty description="选择左侧文件进行查看 / 编辑" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-(--gap-text) px-3 py-2">
                <div className="truncate">
                  <span className="font-medium">{activeName}</span>
                  {activeFile && !activeFile.exists && (
                    <Tag className="ml-2" color="warning">
                      未创建
                    </Tag>
                  )}
                  {dirty && <span className="ml-2 text-xs text-[#ad8b00]">未保存</span>}
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={!dirty}
                  onClick={handleSave}
                >
                  保存
                </Button>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <Spin spinning={fileLoading} wrapperClassName="h-full">
                  <Input.TextArea
                    className="h-full! resize-none font-mono"
                    value={editorValue}
                    placeholder={
                      activeFile && !activeFile.exists
                        ? "该文件尚未创建，输入内容后点击保存即可新增"
                        : ""
                    }
                    onChange={(e) => {
                      setEditorValue(e.target.value);
                      setDirty(true);
                    }}
                  />
                </Spin>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-white">
      {/* 智能体列表 */}
      <div className="flex w-64 flex-col border-r border-(--gap-text)">
        <div className="p-3 font-semibold">智能体配置</div>
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
        <div className="flex h-12 items-center border-b border-(--gap-text) px-4">
          <span className="text-sm text-(--sub-text)">
            {currentAgent ? (
              <>
                当前智能体：
                <span className="text-(--primary-text)">{currentAgent.nickname}</span>
              </>
            ) : (
              "智能体人设 / 配置"
            )}
          </span>
        </div>
        {renderMain()}
      </div>
    </div>
  );
};
