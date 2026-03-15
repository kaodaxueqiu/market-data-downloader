import { MessageStatus, SendMsgParams, WsResponse } from "@openim/wasm-client-sdk";
import { useCallback } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import {
  ExMessageItem,
  useConversationStore,
  useMessageStore,
  useSessionStore,
} from "@/store";
import { useContactStore } from "@/store/contact";

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

      const isAgentConversation = useContactStore
        .getState()
        .agents.some((a) => a.userID === currentConversation?.userID);
      if (isAgentConversation) {
        const sessionId = useSessionStore.getState().activeSessionId;
        if (sessionId) {
          let existingEx: Record<string, unknown> = {};
          if (message.ex) {
            try {
              existingEx = JSON.parse(message.ex);
            } catch {
              /* keep empty */
            }
          }
          message.ex = JSON.stringify({ ...existingEx, sessionId });
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
        updateOneMessage(successMessage as ExMessageItem);
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
