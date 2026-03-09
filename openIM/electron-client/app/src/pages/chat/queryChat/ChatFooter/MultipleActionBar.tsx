import { MessageItem, MessageStatus } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Spin } from "antd";
import { t } from "i18next";
import { useEffect } from "react";

import cancel from "@/assets/images/chatFooter/cancel.png";
import forward from "@/assets/images/chatFooter/forward.png";
import remove from "@/assets/images/chatFooter/remove.png";
import { useCheckConfirmModal } from "@/hooks/useCheckConfirmModal";
import { IMSDK } from "@/layout/MainContentWrap";
import {
  useContactStore,
  useConversationStore,
  useMessageStore,
  useUserStore,
} from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { formatMessageByType, isGroupSession } from "@/utils/imCommon";
import { emit } from "@/utils/window/events";

import { deleteOneMessage, getMessageList } from "../useHistoryMessageList";

const multipleActionList = [
  {
    title: t("chat.action.mergeForward"),
    icon: forward,
  },
  {
    title: t("chat.action.delete"),
    icon: remove,
  },
  {
    title: t("system.text.close"),
    icon: cancel,
  },
];

const MultipleActionBar = () => {
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const updateCheckMode = useMessageStore((state) => state.updateCheckMode);

  const { showCheckConfirmModal } = useCheckConfirmModal();

  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        updateCheckMode(false);
      }
    };
    document.addEventListener("keydown", keyDownHandler);
    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, []);

  const actionClick = async (idx: number) => {
    switch (idx) {
      case 0:
        emit("OPEN_CHOOSE_MODAL", {
          type: "FORWARD_MESSAGE",
          extraData: { kind: "merger", params: await getMergeMessageOptions() },
        });
        break;
      case 1: {
        const messageList = await getCheckedMessageList();
        const allSelfMessages = messageList.every(
          (message) => message.sendID === useUserStore.getState().selfInfo.userID,
        );
        showCheckConfirmModal({
          title: t("chat.toast.deleteMessage"),
          confirmTip: t(
            allSelfMessages
              ? "common.toast.mutualDelete"
              : "common.toast.deleteConfirm",
          ),
          description: allSelfMessages ? t("chat.toast.deleteDescription") : undefined,
          showCheckbox: allSelfMessages,
          onOk: (mutual) => batchDeleteMessage(mutual, messageList),
        });
        break;
      }
      default:
        break;
    }
    updateCheckMode(false);
  };

  const deleteMessagesMutation = useMutation({
    mutationFn: async ({
      mutual,
      messageList,
    }: {
      mutual: boolean;
      messageList: MessageItem[];
    }) => {
      const successMessageIDs = messageList
        .filter((message) => message.status === MessageStatus.Succeed)
        .map((message) => message.clientMsgID);
      const failedMessageIDs = messageList
        .filter((message) => message.status === MessageStatus.Failed)
        .map((message) => message.clientMsgID);
      if (successMessageIDs.length) {
        await IMSDK.deleteMessages({
          clientMsgIDs: messageList.map((message) => message.clientMsgID),
          conversationID: currentConversation!.conversationID,
          isSync: mutual,
        });
      }
      await Promise.all(
        failedMessageIDs.map((clientMsgID) =>
          IMSDK.deleteMessageFromLocalStorage({
            conversationID: currentConversation!.conversationID,
            clientMsgID,
          }),
        ),
      );
      messageList.forEach((message) => deleteOneMessage(message.clientMsgID));
    },
    onError: () => {
      feedbackToast({ error: t("chat.toast.messagesDeleteFailed") });
    },
  });

  const batchDeleteMessage = async (mutual: boolean, messageList: MessageItem[]) => {
    await deleteMessagesMutation.mutateAsync({ mutual, messageList });
  };

  const getMergeMessageOptions = async () => {
    const messageList = await getCheckedMessageList();
    const summaryList = messageList
      .slice(0, 4)
      .map(
        (message) =>
          `${message.senderNickname}：${formatMessageByType(message as MessageItem)}`,
      );
    const friendNickname =
      useContactStore
        .getState()
        .friendList.find((friend) => friend.userID === currentConversation?.userID)
        ?.nickname ?? currentConversation?.showName;
    return {
      messageList,
      summaryList,
      title: t("chat.message.whosMessageHistory", {
        who: isGroupSession(currentConversation?.conversationType)
          ? t("chat.group.group")
          : t("chat.text.and", {
              someone: useUserStore.getState().selfInfo.nickname,
              otherone: friendNickname,
            }),
      }),
    };
  };

  const getCheckedMessageList = async () =>
    (await getMessageList()).filter((message) => message.checked);

  return (
    <Spin spinning={deleteMessagesMutation.isPending}>
      <div className="flex border-t border-(--gap-text) bg-(--chat-bubble) px-16 py-4">
        {multipleActionList.map((action, idx) => (
          <div
            className="mr-8 flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md bg-white last:mr-0"
            key={action.title}
            onClick={() => actionClick(idx)}
          >
            <img width={24} src={action.icon} className="mt-2 mb-1.5" alt="" />
            <span className="text-center text-xs text-(--sub-text)">
              {action.title}
            </span>
          </div>
        ))}
      </div>
    </Spin>
  );
};

export default MultipleActionBar;
