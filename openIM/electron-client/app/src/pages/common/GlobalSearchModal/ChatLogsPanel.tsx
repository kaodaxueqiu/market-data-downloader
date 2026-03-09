import { MessageItem, SessionType } from "@openim/wasm-client-sdk";
import { Empty, Spin } from "antd";
import clsx from "clsx";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Virtuoso } from "react-virtuoso";

import JumpToMessageWrap from "@/components/JumpToMessageWrap";
import OIMAvatar from "@/components/OIMAvatar";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";

import { ChatLogsItem } from ".";
import { EmptyPlaceholder } from "./EmptyPlaceholder";
import styles from "./index.module.scss";
import { useKeyPage } from "./useKeyPage";

export type ChatLogsResult = Partial<ChatLogsItem & MessageItem>;

const renderHighlight = (text: string, keyword: string) => {
  if (!keyword.trim()) return text;
  const regex = new RegExp(keyword, "gi");
  const matches = text.match(regex);
  if (!matches) return text;
  const parts = text.split(regex);
  const highlightNodes: React.ReactNode[] = [];
  parts.forEach((part, idx) => {
    if (part) {
      highlightNodes.push(<span key={`normal-${idx}-${part}`}>{part}</span>);
    }
    if (matches[idx]) {
      highlightNodes.push(
        <span
          key={`highlight-${idx}-${matches[idx]}`}
          className={styles["keyword-highlight"]}
        >
          {matches[idx]}
        </span>,
      );
    }
  });
  return highlightNodes.length > 0 ? highlightNodes : text;
};

export const ChatLogsRender = memo(
  ({
    id,
    isActive,
    result,
    conversationID,
    keyword,
    onClick,
    closeOverlay,
  }: {
    id?: string;
    isActive?: boolean;
    result: ChatLogsResult;
    conversationID?: string;
    keyword?: string;
    onClick?: (result: ChatLogsResult) => void;
    closeOverlay?: () => void;
  }) => {
    const jumpWrapRef = useRef<{ jumpToHistory: () => Promise<void> }>(null);
    const isConversation = Boolean(result.conversationID);
    const description =
      result.description ||
      getConversationContent({ ...result, groupID: "" } as MessageItem);

    return (
      <JumpToMessageWrap
        ref={jumpWrapRef}
        message={result as MessageItem}
        isChildWindow
        conversationID={conversationID!}
        disabled={isConversation}
        afterJump={closeOverlay}
      >
        <div
          id={id}
          className={clsx(
            "flex rounded px-3 py-2 hover:bg-(--primary-active)",
            { "bg-(--primary-active)": isActive },
            { "cursor-pointer": isConversation },
          )}
          onClick={() => onClick?.(result)}
          // onDoubleClick={() => jumpWrapRef.current?.jumpToHistory()}
        >
          <div className="relative min-w-9.5">
            <OIMAvatar
              src={result.faceURL}
              text={result.senderNickname || result.showName}
              isgroup={result.conversationType === SessionType.WorkingGroup}
            />
          </div>
          <div className="ml-3 flex-1 overflow-hidden">
            <div className="flex items-center">
              <div className="flex-1 truncate">
                {result.senderNickname || result.showName}
              </div>
              {!isConversation && (
                <div className="ml-3 text-xs text-(--sub-text)">
                  {formatConversionTime(result.sendTime ?? 0)}
                </div>
              )}
            </div>
            <div className="mt-1 text-xs text-(--sub-text) select-text">
              {renderHighlight(description ?? "", keyword ?? "")}
            </div>
          </div>
        </div>
      </JumpToMessageWrap>
    );
  },
);

const ChatLogsPanel: ForwardRefRenderFunction<
  {
    updateIdx: (idx: number) => void;
  },
  {
    data: ChatLogsItem[];
    loading: boolean;
    isActive: boolean;
    keyword: string;
    closeOverlay: () => void;
  }
> = ({ data, loading, isActive, keyword, closeOverlay }, ref) => {
  const { activeIdx, updateIdx } = useKeyPage({
    isActive,
    maxIndex: data.length,
    elPrefix: `#conversation-item-`,
  });

  useEffect(() => {
    if (loading || data.length === 0) {
      updateIdx(-1);
      return;
    }
    if (activeIdx >= data.length) {
      updateIdx(0);
    }
  }, [activeIdx, data.length, loading, updateIdx]);

  useImperativeHandle(ref, () => ({ updateIdx }), []);

  return (
    <div className="flex h-full px-1.5">
      <Spin wrapperClassName="h-full flex-1" spinning={loading}>
        <Virtuoso
          className={styles["virtuoso-side-wrapper"]}
          data={data}
          components={{
            EmptyPlaceholder: () => (loading ? null : <EmptyPlaceholder />),
          }}
          computeItemKey={(_, item) => item.conversationID}
          itemContent={(idx, result) => (
            <ChatLogsRender
              isActive={activeIdx === idx}
              id={`conversation-item-${idx}`}
              result={result}
              keyword={keyword}
              onClick={() => updateIdx(idx)}
            />
          )}
        />
      </Spin>
      <div className="h-full shrink-0 border-r border-(--gap-text) pl-1" />
      <Virtuoso
        className={styles["virtuoso-side-wrapper"]}
        data={data[activeIdx]?.messageList ?? []}
        computeItemKey={(_, item) => item.clientMsgID}
        itemContent={(_, message) => (
          <ChatLogsRender
            result={message}
            conversationID={data[activeIdx]?.conversationID}
            keyword={keyword}
            closeOverlay={closeOverlay}
          />
        )}
      />
    </div>
  );
};

export default forwardRef(ChatLogsPanel);
