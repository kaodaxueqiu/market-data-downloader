import { MessageItem } from "@openim/wasm-client-sdk";
import { useEffect, useMemo, useRef, useState } from "react";

import { useConversationStore } from "@/store";

/**
 * 控制 AgentStatusPanel 的轮询时机（V2）
 *
 * 适配说明：项目中消息列表是 useHistoryMessageList 的局部状态，
 * 不在全局 store 中，因此改用 currentConversation.latestMsg 监听。
 *
 * - 用户发消息 → active = true（开始轮询）
 * - Bot 回复后 → 延迟 2s + 确认 idle 才停止（防多轮 tool call 闪烁）
 * - 切换会话 → 自动重置
 */
export function useAgentPolling(agentUserID?: string): boolean {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );

  const lastMsg = useMemo(() => {
    if (!currentConversation?.latestMsg) return null;
    try {
      return JSON.parse(currentConversation.latestMsg) as MessageItem;
    } catch {
      return null;
    }
  }, [currentConversation?.latestMsg]);

  const lastMsgId = lastMsg?.clientMsgID ?? "";

  useEffect(() => {
    setActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [currentConversation?.conversationID]);

  useEffect(() => {
    if (!agentUserID || !lastMsg || !lastMsgId) return;

    if (lastMsg.sendID === agentUserID) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(false), 2000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setActive(true);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastMsgId, agentUserID]);

  return active;
}
