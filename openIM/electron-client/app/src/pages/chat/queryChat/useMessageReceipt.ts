import {
  CbEvents,
  GroupMessageReceiptInfo,
  MessageItem,
  ReceiptInfo,
  SessionType,
  WSEvent,
} from "@openim/wasm-client-sdk";
import { useEffect } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { ExMessageItem, useConversationStore, useUserStore } from "@/store";

import {
  conversationMessageCache,
  getMessageList,
  updateOneMessage,
} from "./useHistoryMessageList";

export function useMessageReceipt() {
  const selfUserID = useUserStore((state) => state.selfInfo.userID);

  useEffect(() => {
    setIMListener();
    return () => {
      disposeIMListener();
    };
  }, [selfUserID]);

  const setIMListener = () => {
    IMSDK.on(CbEvents.OnRecvC2CReadReceipt, singleMessageHasReadedHander);
    IMSDK.on(CbEvents.OnRecvGroupReadReceipt, groupMessageHasReadedHander);
  };

  const disposeIMListener = () => {
    IMSDK.off(CbEvents.OnRecvC2CReadReceipt, singleMessageHasReadedHander);
    IMSDK.off(CbEvents.OnRecvGroupReadReceipt, groupMessageHasReadedHander);
  };

  const singleMessageHasReadedHander = ({ data }: WSEvent<ReceiptInfo[]>) => {
    const isCurrentSingle =
      useConversationStore.getState().currentConversation?.conversationType ===
      SessionType.Single;

    data.forEach((receipt) => {
      const msgIDs = receipt.msgIDList ?? [];
      if (msgIDs.length === 0) return;

      if (isCurrentSingle) {
        msgIDs.forEach((clientMsgID) => {
          updateOneMessage({
            clientMsgID,
            isRead: true,
          } as ExMessageItem);
        });
      }

      const pendingMsgIDs = new Set(msgIDs);
      for (const [convID, cached] of conversationMessageCache) {
        if (!cached.isComplete || pendingMsgIDs.size === 0) break;

        let convHasUpdates = false;
        for (let i = 0; i < cached.allMessages.length; i++) {
          const msg = cached.allMessages[i];
          if (pendingMsgIDs.has(msg.clientMsgID) && !msg.isRead) {
            cached.allMessages[i] = { ...msg, isRead: true };
            convHasUpdates = true;
            pendingMsgIDs.delete(msg.clientMsgID);
          }
        }

        if (convHasUpdates) {
          const convList = useConversationStore.getState().conversationList;
          const conv = convList.find((c) => c.conversationID === convID);
          if (conv?.latestMsg) {
            try {
              const latestMsgObj = JSON.parse(conv.latestMsg) as MessageItem;
              if (msgIDs.includes(latestMsgObj.clientMsgID) && !latestMsgObj.isRead) {
                latestMsgObj.isRead = true;
                useConversationStore.getState().updateConversationList([
                  { ...conv, latestMsg: JSON.stringify(latestMsgObj) },
                ]);
              }
            } catch {
              // ignore latestMsg parse error
            }
          }
        }
      }
    });
  };

  const groupMessageHasReadedHander = async ({
    data,
  }: WSEvent<GroupMessageReceiptInfo>) => {
    if (
      useConversationStore.getState().currentConversation?.conversationID !==
      data.conversationID
    )
      return;
    const historyMessageList = await getMessageList();
    data.groupMessageReadInfo.map((receipt) => {
      const hasSelfRead = receipt.readMembers?.some(
        (member) => member.userID === selfUserID,
      );
      const oldMessage = historyMessageList.find(
        (message) => message.clientMsgID === receipt.clientMsgID,
      );
      updateOneMessage({
        ...oldMessage,
        isRead: hasSelfRead ? true : oldMessage?.isRead,
        attachedInfoElem: {
          ...oldMessage?.attachedInfoElem,
          groupHasReadInfo: {
            hasReadCount: receipt.hasReadCount,
            unreadCount: receipt.unreadCount,
          },
        },
      } as ExMessageItem);
    });
  };
}
