import { MessageItem, ViewType } from "@openim/wasm-client-sdk";
import { Popover } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import { useConversationToggle } from "@/hooks/useConversationToggle";
import { getMessageContext } from "@/pages/chat/queryChat/useHistoryMessageList";
import { useMessageStore, useUserStore } from "@/store";
import { resolveMessageLocalPath } from "@/utils/download";
import { broadcastRepeatJumpToHistory } from "@/utils/window/broadcast";

interface IJumpToMessageWrap {
  message: MessageItem;
  isChildWindow: boolean;
  conversationID: string;
  viewType?: ViewType;
  disabled?: boolean;
  viewInFinder?: boolean | (() => void);
  children: React.ReactNode;
  afterJump?: () => void;
}

const JumpToMessageWrap: ForwardRefRenderFunction<
  { jumpToHistory: () => void },
  IJumpToMessageWrap
> = (
  {
    message,
    isChildWindow,
    viewType = ViewType.Search,
    children,
    disabled,
    viewInFinder,
    afterJump,
  },
  ref,
) => {
  const [showMenu, setShowMenu] = useState(false);

  const { toSpecifiedConversation } = useConversationToggle();
  const updateJumpClientMsgID = useMessageStore.getState().updateJumpClientMsgID;

  const jumpToHistory = async () => {
    const sourceID =
      message.groupID ||
      (message.sendID === useUserStore.getState().selfInfo.userID
        ? message.recvID
        : message.sendID);
    await toSpecifiedConversation({
      sourceID,
      sessionType: message.sessionType,
      isJump: true,
      isChildWindow,
    });
    if (window.electronAPI?.enableCLib) {
      broadcastRepeatJumpToHistory({
        message,
        viewType,
      });
    } else {
      updateJumpClientMsgID(message.clientMsgID);
      getMessageContext({ message, viewType });
    }
    setShowMenu(false);
    afterJump?.();
  };

  useImperativeHandle(ref, () => ({ jumpToHistory }), [jumpToHistory]);

  const menuItems = useMemo(() => {
    const items: { key: string; label: string; onClick: () => void }[] = [
      {
        key: "jump",
        label: t("common.text.jumpToMessage"),
        onClick: jumpToHistory,
      },
    ];

    if (viewInFinder && window.electronAPI) {
      if (typeof viewInFinder === "boolean") {
        const path = resolveMessageLocalPath(message);
        if (path) {
          items.push({
            key: "finder",
            label: t("common.text.finder"),
            onClick: () => {
              window.electronAPI?.showInFinder(path);
              setShowMenu(false);
            },
          });
        }
      } else if (typeof viewInFinder === "function") {
        items.push({
          key: "finder",
          label: t("common.text.finder"),
          onClick: () => {
            viewInFinder();
            setShowMenu(false);
          },
        });
      }
    }

    return items;
  }, [jumpToHistory, message, viewInFinder, t]);

  return (
    <Popover
      content={
        <div className="flex flex-col gap-1 p-1">
          {menuItems.map((item) => (
            <div
              key={item.key}
              className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-(--primary-active)"
              onClick={item.onClick}
            >
              {item.label}
            </div>
          ))}
        </div>
      }
      title={null}
      trigger="contextMenu"
      placement="bottom"
      open={disabled ? false : showMenu}
      onOpenChange={(visible) => setShowMenu(visible)}
    >
      {children}
    </Popover>
  );
};

export default memo(forwardRef(JumpToMessageWrap));
