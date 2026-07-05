import {
  ArrowUpOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SwapOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Spin,
  Table,
  Tag,
  Tooltip,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { modal } from "@/AntdGlobalComp";
import {
  createWorkspaceEntry,
  deleteWorkspaceEntry,
  downloadWorkspaceFile,
  getWorkspaceStorage,
  listWorkspaceFiles,
  moveWorkspaceEntry,
  readWorkspaceFile,
  saveWorkspaceFile,
  uploadWorkspaceFile,
} from "@/api/services/agentWorkspace";
import type {
  WorkspaceApiError,
  WorkspaceFileContent,
  WorkspaceFileItem,
  WorkspaceStorageInfo,
} from "@/api/types/agentWorkspace";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

const EDITABLE_EXT = [
  ".md", ".txt", ".json", ".yaml", ".yml",
  ".py", ".ts", ".tsx", ".js", ".jsx", ".sh", ".ps1",
];

const isEditableItem = (item: WorkspaceFileItem) => {
  if (item.type !== "file") return false;
  if (typeof item.editable === "boolean") return item.editable;
  const lower = item.name.toLowerCase();
  return EDITABLE_EXT.some((ext) => lower.endsWith(ext));
};

const joinPath = (parent: string, name: string) =>
  parent === "/" ? `/${name}` : `${parent}/${name}`;

const parentOf = (path: string) => {
  if (path === "/" || !path.includes("/")) return "/";
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
};

const formatSize = (size?: number) => {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatTime = (time?: string) => {
  if (!time) return "-";
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return time;
  return d.toLocaleString();
};

const errMsg = (error: unknown, fallback: string) =>
  (error as WorkspaceApiError)?.message || fallback;

export const AgentWorkspace = () => {
  const agents = useContactStore((state) => state.agents);
  const getAgentsListByReq = useContactStore((state) => state.getAgentsListByReq);

  const [agentKeyword, setAgentKeyword] = useState("");
  const [currentAgentID, setCurrentAgentID] = useState<string>("");

  const [storage, setStorage] = useState<WorkspaceStorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [notProvisioned, setNotProvisioned] = useState(false);

  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<WorkspaceFileItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [activeFile, setActiveFile] = useState<WorkspaceFileItem | null>(null);
  const [fileContent, setFileContent] = useState<WorkspaceFileContent | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新建 / 重命名 / 移动 弹窗
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    mode: "create-file" | "create-dir" | "rename" | "move";
    value: string;
    target?: WorkspaceFileItem;
  }>({ open: false, mode: "create-file", value: "" });
  const [entrySubmitting, setEntrySubmitting] = useState(false);

  const uploadingRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: WorkspaceFileItem;
  } | null>(null);

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

  const currentDirReadonly = useMemo(
    () => Boolean(storage?.readonly),
    [storage],
  );

  const resetFilePane = () => {
    setActiveFile(null);
    setFileContent(null);
    setEditorValue("");
    setDirty(false);
  };

  const loadDir = useCallback(
    async (agentID: string, path: string) => {
      setListLoading(true);
      try {
        const res = await listWorkspaceFiles(agentID, path);
        setItems(res.items || []);
        setCurrentPath(res.path || path);
      } catch (error) {
        feedbackToast({ error: { message: errMsg(error, "加载目录失败") } });
        setItems([]);
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const selectAgent = useCallback(
    async (agentID: string) => {
      if (agentID === currentAgentID) return;
      setCurrentAgentID(agentID);
      setStorage(null);
      setNotProvisioned(false);
      setItems([]);
      setCurrentPath("/");
      resetFilePane();
      setStorageLoading(true);
      try {
        const info = await getWorkspaceStorage(agentID);
        setStorage(info);
        if (info.available) {
          await loadDir(agentID, "/");
        }
      } catch (error) {
        const code = (error as WorkspaceApiError)?.code;
        if (code === "AGENT_STORAGE_NOT_PROVISIONED") {
          setNotProvisioned(true);
        } else {
          feedbackToast({ error: { message: errMsg(error, "获取空间状态失败") } });
        }
      } finally {
        setStorageLoading(false);
      }
    },
    [currentAgentID, loadDir],
  );

  const openItem = async (item: WorkspaceFileItem) => {
    if (item.type === "directory") {
      resetFilePane();
      await loadDir(currentAgentID, item.path);
      return;
    }
    if (!isEditableItem(item)) {
      modal.confirm({
        title: "无法在线预览",
        content: `「${item.name}」不是可在线编辑的文本文件，是否下载？`,
        okText: "下载",
        cancelText: "取消",
        onOk: () => handleDownload(item),
      });
      return;
    }
    setActiveFile(item);
    setFileLoading(true);
    setDirty(false);
    try {
      const content = await readWorkspaceFile(currentAgentID, item.path);
      setFileContent(content);
      setEditorValue(content.content ?? "");
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "读取文件失败") } });
      resetFilePane();
    } finally {
      setFileLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeFile || !fileContent) return;
    setSaving(true);
    try {
      const res = await saveWorkspaceFile(
        currentAgentID,
        activeFile.path,
        editorValue,
        fileContent.etag,
      );
      setFileContent({ ...fileContent, etag: res?.etag, updatedAt: res?.updatedAt });
      setDirty(false);
      feedbackToast({ msg: "已保存" });
    } catch (error) {
      const code = (error as WorkspaceApiError)?.code;
      if (code === "FILE_CONFLICT") {
        feedbackToast({ error: { message: "文件已被其他操作更新，请刷新后重试" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "保存失败") } });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (item: WorkspaceFileItem) => {
    try {
      const blob = (await downloadWorkspaceFile(currentAgentID, item.path)) as Blob;
      const api = window.electronAPI as
        | {
            showSaveDialog?: (o: { defaultPath?: string }) => Promise<{
              canceled: boolean;
              filePath?: string;
            }>;
            saveFileToPath?: (p: { file: File; filePath: string }) => Promise<string>;
          }
        | undefined;

      if (api?.showSaveDialog && api?.saveFileToPath) {
        const { canceled, filePath } = await api.showSaveDialog({
          defaultPath: item.name,
        });
        if (canceled || !filePath) return;
        const file = new File([blob], item.name);
        await api.saveFileToPath({ file, filePath });
        feedbackToast({ msg: "已保存到本地" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      feedbackToast({ error: { message: errMsg(error, "下载失败") } });
    }
  };

  const handleDelete = (item: WorkspaceFileItem) => {
    modal.confirm({
      title: `删除${item.type === "directory" ? "文件夹" : "文件"}`,
      content: `确定删除「${item.name}」吗？${
        item.type === "directory" ? "该文件夹及其内容将被一并删除，" : ""
      }此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteWorkspaceEntry(currentAgentID, item.path, item.type === "directory");
          if (activeFile?.path === item.path) resetFilePane();
          await loadDir(currentAgentID, currentPath);
          feedbackToast({ msg: "已删除" });
        } catch (error) {
          feedbackToast({ error: { message: errMsg(error, "删除失败") } });
        }
      },
    });
  };

  const openEntryModal = (
    mode: "create-file" | "create-dir" | "rename" | "move",
    target?: WorkspaceFileItem,
  ) => {
    setEntryModal({
      open: true,
      mode,
      target,
      value:
        mode === "rename"
          ? target?.name ?? ""
          : mode === "move"
            ? target?.path ?? ""
            : "",
    });
  };

  const submitEntryModal = async () => {
    const { mode, value, target } = entryModal;
    const trimmed = value.trim();
    if (!trimmed) {
      feedbackToast({ error: { message: "请输入内容" } });
      return;
    }
    setEntrySubmitting(true);
    try {
      if (mode === "create-file" || mode === "create-dir") {
        await createWorkspaceEntry(
          currentAgentID,
          currentPath,
          trimmed,
          mode === "create-file" ? "file" : "directory",
        );
        feedbackToast({ msg: "已创建" });
      } else if (mode === "rename" && target) {
        const toPath = joinPath(parentOf(target.path), trimmed);
        await moveWorkspaceEntry(currentAgentID, target.path, toPath);
        feedbackToast({ msg: "已重命名" });
      } else if (mode === "move" && target) {
        const toPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
        await moveWorkspaceEntry(currentAgentID, target.path, toPath);
        feedbackToast({ msg: "已移动" });
      }
      setEntryModal((s) => ({ ...s, open: false }));
      if (activeFile && target && activeFile.path === target.path) resetFilePane();
      await loadDir(currentAgentID, currentPath);
    } catch (error) {
      const code = (error as WorkspaceApiError)?.code;
      if (code === "FILE_EXISTS") {
        feedbackToast({ error: { message: "目标已存在，请换个名字" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "操作失败") } });
      }
    } finally {
      setEntrySubmitting(false);
    }
  };

  const customUpload = async (options: { file: string | Blob }) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    try {
      await uploadWorkspaceFile(currentAgentID, currentPath, options.file as File, false);
      feedbackToast({ msg: "上传成功" });
      await loadDir(currentAgentID, currentPath);
    } catch (error) {
      const code = (error as WorkspaceApiError)?.code;
      if (code === "FILE_EXISTS") {
        feedbackToast({ error: { message: "同名文件已存在" } });
      } else if (code === "FILE_TOO_LARGE") {
        feedbackToast({ error: { message: "文件超过大小限制" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "上传失败") } });
      }
    } finally {
      uploadingRef.current = false;
    }
  };

  // 拖拽上传：批量处理
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!currentAgentID || currentDirReadonly) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    if (uploadingRef.current) {
      feedbackToast({ error: { message: "正在上传中，请稍候" } });
      return;
    }
    uploadingRef.current = true;
    let success = 0;
    let failed = 0;
    for (const f of files) {
      try {
        await uploadWorkspaceFile(currentAgentID, currentPath, f, false);
        success++;
      } catch (error) {
        failed++;
        const code = (error as WorkspaceApiError)?.code;
        if (code === "FILE_EXISTS") {
          // 同名跳过，计入失败
        } else if (code === "FILE_TOO_LARGE") {
          feedbackToast({ error: { message: `${f.name} 超过大小限制` } });
          break;
        } else {
          // 其他错误继续尝试下一个
        }
      }
    }
    uploadingRef.current = false;
    if (success > 0) {
      feedbackToast({ msg: `已上传 ${success} 个文件${failed ? `，${failed} 个失败` : ""}` });
      await loadDir(currentAgentID, currentPath);
    } else if (failed > 0) {
      feedbackToast({ error: { message: "上传失败" } });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentDirReadonly && !dragOver) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有离开容器本身才置 false（避免经过子元素反复闪烁）
    if (e.currentTarget === e.target) setDragOver(false);
  };

  const breadcrumbItems = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);
    const crumbs: { title: string; path: string }[] = [
      { title: "智能体空间", path: "/" },
    ];
    let acc = "";
    for (const seg of segments) {
      acc += `/${seg}`;
      crumbs.push({ title: seg, path: acc });
    }
    return crumbs.map((c) => ({
      title:
        c.path === currentPath ? (
          <span>{c.title}</span>
        ) : (
          <a onClick={() => loadDir(currentAgentID, c.path)}>{c.title}</a>
        ),
    }));
  }, [currentPath, currentAgentID, loadDir]);

  const columns: ColumnsType<WorkspaceFileItem> = [
    {
      title: "名称",
      dataIndex: "name",
      render: (_, item) => (
        <div
          className="flex cursor-pointer items-center"
          onClick={() => openItem(item)}
        >
          {item.type === "directory" ? (
            <FolderOutlined className="mr-2 text-[#f7ba2a]" />
          ) : (
            <FileOutlined className="mr-2 text-gray-400" />
          )}
          <span className="truncate">{item.name}</span>
          {item.readonly && (
            <Tag className="ml-2" color="default">
              只读
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "大小",
      dataIndex: "size",
      width: 110,
      render: (_, item) => (item.type === "directory" ? "-" : formatSize(item.size)),
    },
    {
      title: "修改时间",
      dataIndex: "updatedAt",
      width: 180,
      render: (v) => formatTime(v),
    },
    {
      title: "操作",
      width: 80,
      render: (_, item) => (
        <Dropdown
          trigger={["click"]}
          menu={{ items: buildMenuItems(item), onClick: (info) => handleMenuClick(info.key, item) }}
        >
          <Button type="text" size="small" onClick={(e) => e.stopPropagation()}>
            •••
          </Button>
        </Dropdown>
      ),
    },
  ];

  // 构造右键菜单 / "•••" 菜单的 items
  const buildMenuItems = (item: WorkspaceFileItem) => {
    const readonly = Boolean(item.readonly) || Boolean(storage?.readonly);
    return [
      { key: "open", icon: <FolderOutlined />, label: item.type === "directory" ? "进入" : "打开" },
      item.type === "file"
        ? { key: "download", icon: <DownloadOutlined />, label: "下载" }
        : null,
      readonly ? null : { key: "rename", icon: <EditOutlined />, label: "重命名" },
      readonly ? null : { key: "move", icon: <SwapOutlined />, label: "移动" },
      readonly
        ? null
        : { type: "divider" as const },
      readonly
        ? null
        : { key: "delete", icon: <DeleteOutlined />, label: "删除", danger: true },
    ].filter(Boolean) as { key: string; type?: "divider" }[];
  };

  const handleMenuClick = (key: string, item: WorkspaceFileItem) => {
    if (key === "open") openItem(item);
    else if (key === "download") handleDownload(item);
    else if (key === "rename") openEntryModal("rename", item);
    else if (key === "move") openEntryModal("move", item);
    else if (key === "delete") handleDelete(item);
  };

  // 右键菜单
  const handleRowContextMenu = (e: React.MouseEvent, item: WorkspaceFileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // 点击任意位置关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const renderMainArea = () => {
    if (!currentAgentID) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="请选择左侧的智能体，查看其工作空间" />
        </div>
      );
    }
    if (storageLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Spin />
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
    if (storage && !storage.available) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="该智能体暂无工作空间" />
        </div>
      );
    }

    return (
      <div className="flex flex-1 overflow-hidden">
        {/* 文件列表 */}
        <div
          className={
            activeFile
              ? "flex w-2/5 min-w-[420px] flex-col border-r border-(--gap-text)"
              : "flex flex-1 flex-col"
          }
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{ position: "relative" }}
        >
          {dragOver && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#e6f4ff]/80"
              style={{ border: "2px dashed #1677ff" }}
            >
              <div className="text-[#1677ff]">
                <UploadOutlined style={{ fontSize: 32 }} />
                <div className="mt-2 text-sm">松开鼠标上传到当前目录</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-(--gap-text) px-3 py-2">
            <Breadcrumb items={breadcrumbItems} />
            <div className="flex items-center gap-1">
              {currentPath !== "/" && (
                <Tooltip title="上一级">
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowUpOutlined />}
                    onClick={() => {
                      resetFilePane();
                      loadDir(currentAgentID, parentOf(currentPath));
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title="刷新">
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => loadDir(currentAgentID, currentPath)}
                />
              </Tooltip>
            </div>
          </div>

          {!currentDirReadonly && (
            <div className="flex items-center gap-2 border-b border-(--gap-text) px-3 py-2">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openEntryModal("create-file")}
              >
                新建文件
              </Button>
              <Button
                size="small"
                icon={<FolderAddOutlined />}
                onClick={() => openEntryModal("create-dir")}
              >
                新建文件夹
              </Button>
              <Upload showUploadList={false} customRequest={customUpload as never}>
                <Button size="small" icon={<UploadOutlined />}>
                  上传
                </Button>
              </Upload>
            </div>
          )}
          {currentDirReadonly && (
            <div className="border-b border-(--gap-text) bg-[#fffbe6] px-3 py-2 text-xs text-[#ad8b00]">
              <LockOutlined className="mr-1" />
              当前空间为只读，仅可查看 / 下载
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <Table
              rowKey="path"
              size="middle"
              loading={listLoading}
              columns={columns}
              dataSource={items}
              pagination={false}
              onRow={(record) => ({
                onContextMenu: (e) => handleRowContextMenu(e, record),
              })}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="空间为空"
                  />
                ),
              }}
            />
          </div>
        </div>

        {/* 文件编辑区（选中文件后才出现） */}
        {activeFile && (
          <div className="flex flex-1 flex-col">
            <>
              <div className="flex items-center justify-between border-b border-(--gap-text) px-3 py-2">
                <div className="truncate">
                  <span className="font-medium">{activeFile.name}</span>
                  {dirty && <span className="ml-2 text-xs text-[#ad8b00]">未保存</span>}
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={
                    !dirty ||
                    Boolean(activeFile.readonly) ||
                    Boolean(storage?.readonly)
                  }
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
                    readOnly={
                      Boolean(activeFile.readonly) ||
                      Boolean(storage?.readonly)
                    }
                    onChange={(e) => {
                      setEditorValue(e.target.value);
                      setDirty(true);
                    }}
                  />
                </Spin>
              </div>
            </>
          </div>
        )}
      </div>
    );
  };

  const entryModalTitle = {
    "create-file": "新建文件",
    "create-dir": "新建文件夹",
    rename: "重命名",
    move: "移动到",
  }[entryModal.mode];

  return (
    <div className="flex h-full w-full bg-white">
      {/* 智能体列表 */}
      <div className="flex w-64 flex-col border-r border-(--gap-text)">
        <div className="p-3 font-semibold">智能体空间</div>
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

      {/* 右侧主区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center border-b border-(--gap-text) px-4">
          <span className="text-sm text-(--sub-text)">
            {currentAgent ? (
              <>
                当前空间：<span className="text-(--primary-text)">{currentAgent.nickname}</span> / workspace
              </>
            ) : (
              "智能体空间"
            )}
          </span>
        </div>
        {renderMainArea()}
      </div>

      <Modal
        title={entryModalTitle}
        open={entryModal.open}
        confirmLoading={entrySubmitting}
        onOk={submitEntryModal}
        onCancel={() => setEntryModal((s) => ({ ...s, open: false }))}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          autoFocus
          placeholder={
            entryModal.mode === "move"
              ? "输入目标相对路径，如 /memory/notes.md"
              : "输入名称"
          }
          value={entryModal.value}
          onChange={(e) => setEntryModal((s) => ({ ...s, value: e.target.value }))}
          onPressEnter={submitEntryModal}
        />
      </Modal>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenuItem
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          storageReadonly={Boolean(storage?.readonly)}
          onAction={(key) => {
            handleMenuClick(key, contextMenu.item);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};

// 右键菜单浮层
const ContextMenuItem = ({
  x,
  y,
  item,
  storageReadonly,
  onAction,
}: {
  x: number;
  y: number;
  item: WorkspaceFileItem;
  storageReadonly: boolean;
  onAction: (key: string) => void;
}) => {
  const readonly = Boolean(item.readonly) || storageReadonly;
  const entries: {
    key: string;
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
    divider?: boolean;
  }[] = [
    {
      key: "open",
      label: item.type === "directory" ? "进入" : "打开",
      icon: item.type === "directory" ? <FolderOutlined /> : <FileOutlined />,
    },
  ];
  if (item.type === "file") {
    entries.push({ key: "download", label: "下载", icon: <DownloadOutlined /> });
  }
  if (!readonly) {
    entries.push({ key: "rename", label: "重命名", icon: <EditOutlined /> });
    entries.push({ key: "move", label: "移动", icon: <SwapOutlined /> });
    entries.push({ key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true, divider: true });
  }

  return (
    <div
      style={{
        position: "fixed",
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 240),
        zIndex: 1050,
        background: "#fff",
        boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
        borderRadius: 6,
        padding: 4,
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {entries.map((e, idx) =>
        e.divider ? (
          <div key={`d-${idx}`} className="my-1 border-t border-gray-200" />
        ) : (
          <div
            key={e.key}
            className={`flex cursor-pointer items-center rounded px-3 py-1.5 text-sm hover:bg-(--primary-active) ${
              e.danger ? "text-[#ff4d4f]" : ""
            }`}
            onClick={() => onAction(e.key)}
          >
            <span className="mr-2 text-xs">{e.icon}</span>
            {e.label}
          </div>
        ),
      )}
    </div>
  );
};
