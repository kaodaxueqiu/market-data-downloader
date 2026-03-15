import { CloseOutlined, PushpinFilled } from "@ant-design/icons";
import { Button, Drawer, Empty, Spin } from "antd";
import dayjs from "dayjs";
import { FC, memo, useCallback, useEffect, useState } from "react";

import type { SessionItem } from "@/api/types/session";
import { useSessionStore } from "@/store";

const SessionHistoryPanel: FC = () => {
  const open = useSessionStore((s) => s.historyPanel);
  const setHistoryPanel = useSessionStore((s) => s.setHistoryPanel);
  const sessions = useSessionStore((s) => s.sessions);
  const switchSession = useSessionStore((s) => s.switchSession);

  const [loading, setLoading] = useState(false);

  const pinnedSessions = sessions.filter((s) => s.isPinned);
  const normalSessions = sessions.filter((s) => !s.isPinned);

  useEffect(() => {
    if (open) setLoading(false);
  }, [open]);

  const handleSelect = useCallback(
    (sessionId: string) => {
      switchSession(sessionId);
      setHistoryPanel(false);
    },
    [switchSession, setHistoryPanel],
  );

  return (
    <Drawer
      title="历史对话"
      placement="right"
      width={320}
      open={open}
      onClose={() => setHistoryPanel(false)}
      closeIcon={<CloseOutlined />}
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spin />
        </div>
      ) : sessions.length === 0 ? (
        <Empty description="暂无对话" className="mt-12" />
      ) : (
        <div className="flex h-full flex-col">
          {pinnedSessions.length > 0 && (
            <SessionGroup sessions={pinnedSessions} onSelect={handleSelect} />
          )}
          {pinnedSessions.length > 0 && normalSessions.length > 0 && (
            <div className="mx-4 border-b border-gray-100" />
          )}
          {normalSessions.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <SessionGroup sessions={normalSessions} onSelect={handleSelect} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default memo(SessionHistoryPanel);

const SessionGroup: FC<{
  sessions: SessionItem[];
  onSelect: (sessionId: string) => void;
}> = memo(({ sessions, onSelect }) => (
  <div className="py-1">
    {sessions.map((session) => (
      <SessionRow key={session.sessionId} session={session} onSelect={onSelect} />
    ))}
  </div>
));

const SessionRow: FC<{
  session: SessionItem;
  onSelect: (sessionId: string) => void;
}> = memo(({ session, onSelect }) => {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const isActive = session.sessionId === activeSessionId;

  return (
    <div
      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
        isActive ? "bg-blue-50" : ""
      }`}
      onClick={() => onSelect(session.sessionId)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1">
          {session.isPinned && (
            <PushpinFilled className="text-xs text-orange-400" />
          )}
          <span className="truncate text-sm font-medium text-gray-800">
            {session.title || "新对话"}
          </span>
        </div>
        {(session.remark || session.sessionKey) && (
          <span className="truncate text-xs text-gray-400">
            {session.remark || session.sessionKey}
          </span>
        )}
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
        {formatDate(session.createdAt)}
      </span>
    </div>
  );
});

function formatDate(ts: number): string {
  if (!ts) return "";
  return dayjs(ts).format("YYYY-MM-DD HH:mm:ss");
}
