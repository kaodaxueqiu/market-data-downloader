import {
  ArrowUpOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  GlobalOutlined,
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
  Segmented,
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
  createSkillEntry,
  deleteSkillEntry,
  downloadSkillFile,
  getSkillStorage,
  listSkillFiles,
  moveSkillEntry,
  readSkillFile,
  saveSkillFile,
  uploadSkillFile,
} from "@/api/services/skills";
import type {
  SkillFileContent,
  SkillFileItem,
  SkillsApiError,
  SkillStorageInfo,
} from "@/api/types/skills";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

const EDITABLE_EXT = [
  ".md", ".txt", ".json", ".yaml", ".yml",
  ".py", ".ts", ".tsx", ".js", ".jsx", ".sh", ".ps1",
];

const isEditableItem = (item: SkillFileItem) => {
  if (item.type !== "file") return false;
  if (typeof item.editable === "boolean") return item.editable;
  const lower = item.name.toLowerCase();
  return EDITABLE_EXT.some((ext) => lower.endsWith(ext));
};

const isSharedPath = (path: string) =>
  path === "/_shared" || path.startsWith("/_shared/");

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
  (error as SkillsApiError)?.message || fallback;

export const Skills = () => {
  const agents = useContactStore((state) => state.agents);
  const getAgentsListByReq = useContactStore((state) => state.getAgentsListByReq);

  const [agentKeyword, setAgentKeyword] = useState("");
  const [currentAgentID, setCurrentAgentID] = useState<string>("");

  const [storage, setStorage] = useState<SkillStorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [notProvisioned, setNotProvisioned] = useState(false);

  // 空间分区：private=私有技能，shared=公共技能
  const [spaceTab, setSpaceTab] = useState<"private" | "shared">("private");
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<SkillFileItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [activeFile, setActiveFile] = useState<SkillFileItem | null>(null);
  const [fileContent, setFileContent] = useState<SkillFileContent | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新建 / 重命名 / 移动 弹窗
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    mode: "create-file" | "create-dir" | "rename" | "move";
    value: string;
    target?: SkillFileItem;
  }>({ open: false, mode: "create-file", value: "" });
  const [entrySubmitting, setEntrySubmitting] = useState(false);

  const uploadingRef = useRef(false);

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

  // 公共技能区整体只读；私有区按 storage.readonly
  const currentDirReadonly = useMemo(
    () => spaceTab === "shared" || Boolean(storage?.readonly) || isSharedPath(currentPath),
    [storage, currentPath, spaceTab],
  );

  // 私有区隐藏 _shared 入口（它在「公共技能」Tab 里）
  const displayItems = useMemo(
    () =>
      spaceTab === "private"
        ? items.filter((i) => i.path !== "/_shared")
        : items,
    [items, spaceTab],
  );

  // 各 Tab 的根路径
  const tabRoot = spaceTab === "shared" ? "/_shared" : "/";

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
        const res = await listSkillFiles(agentID, path);
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
      setSpaceTab("private");
      resetFilePane();
      setStorageLoading(true);
      try {
        const info = await getSkillStorage(agentID);
        setStorage(info);
        // available=true 即渲染（私有建没建不影响显示，公共 _shared 始终在）
        if (info.available) {
          await loadDir(agentID, "/");
        }
      } catch (error) {
        const code = (error as SkillsApiError)?.code;
        if (code === "AGENT_STORAGE_NOT_PROVISIONED") {
          setNotProvisioned(true);
        } else {
          feedbackToast({ error: { message: errMsg(error, "获取技能空间状态失败") } });
        }
      } finally {
        setStorageLoading(false);
      }
    },
    [currentAgentID, loadDir],
  );

  const switchSpaceTab = (tab: "private" | "shared") => {
    if (tab === spaceTab) return;
    setSpaceTab(tab);
    resetFilePane();
    loadDir(currentAgentID, tab === "shared" ? "/_shared" : "/");
  };

  const openItem = async (item: SkillFileItem) => {
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
      const content = await readSkillFile(currentAgentID, item.path);
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
      const res = await saveSkillFile(
        currentAgentID,
        activeFile.path,
        editorValue,
        fileContent.etag,
      );
      setFileContent({ ...fileContent, etag: res?.etag, updatedAt: res?.updatedAt });
      setDirty(false);
      feedbackToast({ msg: "已保存" });
    } catch (error) {
      const code = (error as SkillsApiError)?.code;
      if (code === "FILE_CONFLICT") {
        feedbackToast({ error: { message: "文件已被其他操作更新，请刷新后重试" } });
      } else {
        feedbackToast({ error: { message: errMsg(error, "保存失败") } });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (item: SkillFileItem) => {
    try {
      const blob = (await downloadSkillFile(currentAgentID, item.path)) as Blob;
      const api = window.electronAPI as
        | {
            showSaveDialog?: (o: { defaultPath?: string }) => Promise<{
              canceled: boolean;
              filePath?: string;
            }>;
            saveFileToPath?: (p: { file: File; filePath: string }) => Promise<string>;
          }
        | undefined;

      // Electron：弹出系统“保存位置”对话框，写入用户选择的路径
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

      // 浏览器回退：直接触发下载
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

  const handleDelete = (item: SkillFileItem) => {
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
          await deleteSkillEntry(currentAgentID, item.path, item.type === "directory");
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
    target?: SkillFileItem,
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
        await createSkillEntry(
          currentAgentID,
          currentPath,
          trimmed,
          mode === "create-file" ? "file" : "directory",
        );
        feedbackToast({ msg: "已创建" });
      } else if (mode === "rename" && target) {
        const toPath = joinPath(parentOf(target.path), trimmed);
        await moveSkillEntry(currentAgentID, target.path, toPath);
        feedbackToast({ msg: "已重命名" });
      } else if (mode === "move" && target) {
        const toPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
        await moveSkillEntry(currentAgentID, target.path, toPath);
        feedbackToast({ msg: "已移动" });
      }
      setEntryModal((s) => ({ ...s, open: false }));
      if (activeFile && target && activeFile.path === target.path) resetFilePane();
      await loadDir(currentAgentID, currentPath);
    } catch (error) {
      const code = (error as SkillsApiError)?.code;
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
      await uploadSkillFile(currentAgentID, currentPath, options.file as File, false);
      feedbackToast({ msg: "上传成功" });
      await loadDir(currentAgentID, currentPath);
    } catch (error) {
      const code = (error as SkillsApiError)?.code;
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

  const breadcrumbItems = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);
    const crumbs: { title: string; path: string }[] = [];
    if (spaceTab === "shared") {
      crumbs.push({ title: "公共技能", path: "/_shared" });
      let acc = "/_shared";
      // segments[0] === "_shared"，从第二段开始
      for (let i = 1; i < segments.length; i++) {
        acc += `/${segments[i]}`;
        crumbs.push({ title: segments[i], path: acc });
      }
    } else {
      crumbs.push({ title: "私有技能", path: "/" });
      let acc = "";
      for (const seg of segments) {
        acc += `/${seg}`;
        crumbs.push({ title: seg, path: acc });
      }
    }
    return crumbs.map((c) => ({
      title:
        c.path === currentPath ? (
          <span>{c.title}</span>
        ) : (
          <a onClick={() => loadDir(currentAgentID, c.path)}>{c.title}</a>
        ),
    }));
  }, [currentPath, currentAgentID, loadDir, spaceTab]);

  const columns: ColumnsType<SkillFileItem> = [
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
          {spaceTab !== "shared" && (item.readonly || isSharedPath(item.path)) && (
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
      render: (_, item) => {
        const readonly = Boolean(item.readonly) || isSharedPath(item.path) || Boolean(storage?.readonly);
        return (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                item.type === "file"
                  ? { key: "download", icon: <DownloadOutlined />, label: "下载" }
                  : null,
                readonly ? null : { key: "rename", icon: <EditOutlined />, label: "重命名" },
                readonly ? null : { key: "move", icon: <SwapOutlined />, label: "移动" },
                readonly
                  ? null
                  : { key: "delete", icon: <DeleteOutlined />, label: "删除", danger: true },
              ].filter(Boolean) as { key: string }[],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "download") handleDownload(item);
                if (key === "rename") openEntryModal("rename", item);
                if (key === "move") openEntryModal("move", item);
                if (key === "delete") handleDelete(item);
              },
            }}
          >
            <Button type="text" size="small" onClick={(e) => e.stopPropagation()}>
              •••
            </Button>
          </Dropdown>
        );
      },
    },
  ];

  const renderMainArea = () => {
    if (!currentAgentID) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="请选择左侧的智能体，查看其技能文件" />
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
          <Empty description="该智能体尚未开通技能存储空间" />
        </div>
      );
    }
    // 仅当整体不可用（既无私有也无公共）时才挡住；available=true 一律进入文件浏览
    if (storage && !storage.available) {
      return (
        <div className="flex flex-1 items-center justify-center text-(--sub-text)">
          <Empty description="该智能体暂无技能空间" />
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
        >
          {/* 私有 / 公共 分区切换 */}
          <div className="border-b border-(--gap-text) px-3 py-2.5">
            <Segmented
              block
              value={spaceTab}
              onChange={(v) => switchSpaceTab(v as "private" | "shared")}
              options={[
                {
                  label: (
                    <span className="flex items-center justify-center gap-1.5 py-0.5">
                      <LockOutlined />
                      私有技能
                    </span>
                  ),
                  value: "private",
                },
                {
                  label: (
                    <span className="flex items-center justify-center gap-1.5 py-0.5">
                      <GlobalOutlined />
                      公共技能
                    </span>
                  ),
                  value: "shared",
                },
              ]}
            />
          </div>
          <div className="flex items-center justify-between border-b border-(--gap-text) px-3 py-2">
            <Breadcrumb items={breadcrumbItems} />
            <div className="flex items-center gap-1">
              {currentPath !== tabRoot && (
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
              {spaceTab === "shared"
                ? "公共技能库为只读，仅可查看 / 下载"
                : "当前目录为只读，不可修改"}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <Table
              rowKey="path"
              size="middle"
              loading={listLoading}
              columns={columns}
              dataSource={displayItems}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={spaceTab === "shared" ? "公共技能库为空" : "暂无私有技能文件"}
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
                    isSharedPath(activeFile.path) ||
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
                      isSharedPath(activeFile.path) ||
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
        <div className="p-3 font-semibold">技能</div>
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
                当前空间：<span className="text-(--primary-text)">{currentAgent.nickname}</span> / skills
              </>
            ) : (
              "技能空间"
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
              ? "输入目标相对路径，如 /tools/skill.py"
              : "输入名称"
          }
          value={entryModal.value}
          onChange={(e) => setEntryModal((s) => ({ ...s, value: e.target.value }))}
          onPressEnter={submitEntryModal}
        />
      </Modal>
    </div>
  );
};
