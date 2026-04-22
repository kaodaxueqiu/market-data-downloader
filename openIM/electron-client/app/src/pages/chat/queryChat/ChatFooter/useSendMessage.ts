import { MessageStatus, SendMsgParams, WsResponse } from "@openim/wasm-client-sdk";
import { useCallback } from "react";

import { LEGACY_SESSION_ID } from "@/api/types/session";
import { IMSDK } from "@/layout/MainContentWrap";
import {
  ExMessageItem,
  useConversationStore,
  useMessageStore,
  useSessionStore,
} from "@/store";
import { isBot } from "@/store/botMap";

import {
  deleteAndPushOneMessage,
  pushNewMessage,
  updateOneMessage,
} from "../useHistoryMessageList";

export type SendMessageParams = Partial<Omit<SendMsgParams, "message">> & {
  message: ExMessageItem;
  needPush?: boolean;
  isResend?: boolean;
};

export function useSendMessage() {
  const tryAddPreviewImg = useMessageStore((state) => state.tryAddPreviewImg);

  const sendMessage = useCallback(
    async ({ recvID, groupID, message, needPush, isResend }: SendMessageParams) => {
      const currentConversation = useConversationStore.getState().currentConversation;
      const sourceID = recvID || groupID;
      const inCurrentConversation =
        currentConversation?.userID === sourceID ||
        currentConversation?.groupID === sourceID ||
        !sourceID;
      needPush = needPush ?? inCurrentConversation;

      if (isBot(currentConversation?.userID)) {
        const sessionId = useSessionStore.getState().activeSessionId;
        if (sessionId && sessionId !== LEGACY_SESSION_ID) {
          (message as any).sessionId = sessionId;
        }
      }

      if (needPush) {
        pushNewMessage(message);
      }

      const options = {
        recvID: recvID ?? currentConversation?.userID ?? "",
        groupID: groupID ?? currentConversation?.groupID ?? "",
        message,
      };

      try {
        const { data: successMessage } = await IMSDK.sendMessage(options);
        if (isResend) {
          deleteAndPushOneMessage(successMessage as ExMessageItem);
          return;
        }
        updateOneMessage({ ...successMessage, isRead: true } as ExMessageItem);
        tryAddPreviewImg([successMessage as ExMessageItem]);
      } catch (error) {
        updateOneMessage({
          ...message,
          status: MessageStatus.Failed,
          errCode: (error as WsResponse).errCode,
        } as ExMessageItem);
        IMSDK.setMessageLocalEx({
          conversationID: currentConversation?.conversationID ?? "",
          clientMsgID: message.clientMsgID,
          localEx: String((error as WsResponse).errCode),
        });
      }
    },
    [],
  );

  return {
    sendMessage,
  };
}
