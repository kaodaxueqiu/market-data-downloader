import { PlusOutlined } from "@ant-design/icons";
import { Dropdown, Input, type MenuProps, Modal } from "antd";
import clsx from "clsx";
import {
  FC,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { SessionItem } from "@/api/types/session";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useSessionStore } from "@/store";

import styles from "./session-tab-bar.module.scss";

function getMessageSessionId(msg: { sessionId?: string }): string | null {
  return msg.sessionId || null;
}

interface SessionTabBarProps {
  agentId: string;
}

const SessionTabBar: FC<SessionTabBarProps> = ({ agentId }) => {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const tabSessionIds = useSessionStore((s) => s.tabSessionIds);
  const unreadCounts = useSessionStore((s) => s.unreadCounts);
  const initSessions = useSessionStore((s) => s.initSessions);
  const createNewSession = useSessionStore((s) => s.createNewSession);
  const switchSession = useSessionStore((s) => s.switchSession);
  const setHistoryPanel = useSessionStore((s) => s.setHistoryPanel);

  useEffect(() => {
    const init = async () => {
      // 1. 从最后一条消息找目标 sessionId
      let targetSessionId = "";
      try {
        const convID = useConversationStore.getState().currentConversation?.conversationID;
        if (convID) {
          const { data } = await IMSDK.getAdvancedHistoryMessageList({
            conversationID: convID,
            count: 1,
            startClientMsgID: "",
          });
          const msg = data.messageList?.[0];
          if (msg) {
            targetSessionId = getMessageSessionId(msg) ?? "";
          }
        }
      } catch (e) {
        console.error("[Session] get latest message error:", e);
      }
      console.log("[Session] target sessionId from latest message:", targetSessionId);

      // 2. 用目标 sessionId 初始化
      await initSessions(agentId, targetSessionId || undefined);
    };
    init();
  }, [agentId]);

  const tabSessions = sessions.filter((s) =>
    tabSessionIds.includes(s.sessionId),
  );

  const handleCreate = useCallback(async () => {
    await createNewSession(agentId);
  }, [agentId, createNewSession]);

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabList}>
        {tabSessions.map((session) => (
          <TabItem
            key={session.sessionId}
            session={session}
            isActive={session.sessionId === activeSessionId}
            unread={unreadCounts[session.sessionId] || 0}
            onClick={() => switchSession(session.sessionId)}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <div
          className={styles.actionBtn}
          onClick={handleCreate}
          title="新建对话"
        >
          <PlusOutlined />
        </div>
        <div
          className={styles.actionBtn}
          onClick={() => setHistoryPanel(true)}
          title="历史对话"
        >
          🕐
        </div>
      </div>
    </div>
  );
};

export default memo(SessionTabBar);

const TabItem: FC<{
  session: SessionItem;
  isActive: boolean;
  unread: number;
  onClick: () => void;
}> = memo(({ session, isActive, unread, onClick }) => {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const renameSession = useSessionStore((s) => s.renameSession);
  const pinSession = useSessionStore((s) => s.pinSession);
  const removeFromTabs = useSessionStore((s) => s.removeFromTabs);

  const startRename = useCallback(() => {
    setRenameValue(session.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select());
  }, [session.title]);

  const confirmRename = useCallback(async () => {
    if (!renaming) return;
    setRenaming(false);
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.title) {
      try {
        await renameSession(session.sessionId, trimmed);
      } catch (e) {
        console.error("rename failed", e);
      }
    }
  }, [renaming, renameValue, session.sessionId, session.title, renameSession]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") confirmRename();
      if (e.key === "Escape") setRenaming(false);
    },
    [confirmRename],
  );

  const handleRemark = useCallback(() => {
    let value = session.remark || "";
    Modal.confirm({
      title: "编辑备注",
      icon: null,
      content: (
        <Input.TextArea
          defaultValue={value}
          rows={3}
          placeholder="输入备注内容"
          onChange={(e) => { value = e.target.value; }}
        />
      ),
      okText: "保存",
      cancelText: "取消",
      onOk: () => {
        const { updateRemark } = useSessionStore.getState();
        updateRemark(session.sessionId, value.trim());
      },
    });
  }, [session.sessionId, session.remark]);

  const handleShowInfo = useCallback(() => {
    Modal.info({
      title: "会话基本信息",
      icon: null,
      content: (
        <div style={{ wordBreak: "break-all" }}>
          <p><b>标题：</b>{session.title || "新对话"}</p>
          <p><b>Session ID：</b>{session.sessionId}</p>
          {session.sessionKey && <p><b>Session Key：</b>{session.sessionKey}</p>}
          {session.remark && <p><b>备注：</b>{session.remark}</p>}
        </div>
      ),
      okText: "关闭",
    });
  }, [session]);

  const menuItems: MenuProps["items"] = [
    { key: "rename", label: "重命名", onClick: startRename },
    { key: "remark", label: "备注", onClick: handleRemark },
    {
      key: "pin",
      label: session.isPinned ? "取消置顶" : "置顶",
      onClick: () => pinSession(session.sessionId, !session.isPinned),
    },
    { type: "divider" },
    { key: "info", label: "基本信息", onClick: handleShowInfo },
    {
      key: "close",
      label: "关闭标签",
      onClick: () => removeFromTabs(session.sessionId),
    },
  ];

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeFromTabs(session.sessionId);
    },
    [session.sessionId, removeFromTabs],
  );

  return (
    <Dropdown menu={{ items: menuItems }} trigger={["contextMenu"]}>
      <div
        className={clsx(styles.tab, isActive && styles.tabActive)}
        onClick={onClick}
      >
        {session.isPinned && <span style={{ fontSize: 11 }}>📌</span>}
        {renaming ? (
          <input
            ref={inputRef}
            className={styles.renameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={confirmRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.tabTitle}>{session.title || "新对话"}</span>
        )}
        {!isActive && unread > 0 && (
          <span className={styles.badge}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <span className={styles.closeBtn} onClick={handleClose}>×</span>
      </div>
    </Dropdown>
  );
});
