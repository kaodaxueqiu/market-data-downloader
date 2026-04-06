import { useEffect } from "react";

import { getMessageContext } from "@/pages/chat/queryChat/useHistoryMessageList";
import { useConversationStore, useMessageStore, useUserStore } from "@/store";
import emitter, {
  CallStoreFunctionParams,
  ReadyJumpToHistoryParams,
} from "@/utils/window/events";

import {
  ToSpecifiedConversationParams,
  useConversationToggle,
} from "../useConversationToggle";

export const useWindowEventHandler = () => {
  const { toSpecifiedConversation } = useConversationToggle();

  const { userLogout } = useUserStore.getState();
  const { updateJumpClientMsgID } = useMessageStore.getState();
  useEffect(() => {
    const onUserLogout = () => {
      userLogout();
    };

    const toConversation = ({
      sourceID,
      sessionType,
      isJump,
    }: ToSpecifiedConversationParams) => {
      window.electronAPI?.showMainWindow();
      const conv = useConversationStore.getState().conversationList.find(
        (c) => c.userID === sourceID || c.groupID === sourceID,
      );
      if (conv?.isHidden) {
        const unhidden = { ...conv, isHidden: false };
        useConversationStore.getState().pushConversationList([unhidden]);
      }
      toSpecifiedConversation({ sourceID, sessionType, isJump, isChildWindow: false });
    };

    const readyJumpToHistory = ({ message, viewType }: ReadyJumpToHistoryParams) => {
      setTimeout(() => {
        getMessageContext({
          message,
          viewType,
        });
      }, 50);
      updateJumpClientMsgID(message.clientMsgID);
    };

    const callStoreFunction = ({
      store,
      functionName,
      args,
    }: CallStoreFunctionParams) => {
      if (store === "contact") {
        const contactStore = useUserStore.getState();
        // @ts-ignore
        contactStore[functionName](...args);
      } else if (store === "conversation") {
        const conversationStore = useConversationStore.getState();
        // @ts-ignore
        conversationStore[functionName](...args);
      } else if (store === "message") {
        const messageStore = useMessageStore.getState();
        // @ts-ignore
        messageStore[functionName](...args);
      } else if (store === "user") {
        const userStore = useUserStore.getState();
        // @ts-ignore
        userStore[functionName](...args);
      }
    };

    emitter.on("USER_LOGOUT", onUserLogout);
    emitter.on("REPEAT_JUMP_TO_HISTORY", readyJumpToHistory);
    emitter.on("JUMP_TO_SPECIFIED_CONVERSATION", toConversation);
    emitter.on("CALL_STORE_FUNCTION", callStoreFunction);
    return () => {
      emitter.off("USER_LOGOUT", onUserLogout);
      emitter.off("REPEAT_JUMP_TO_HISTORY", readyJumpToHistory);
      emitter.off("JUMP_TO_SPECIFIED_CONVERSATION", toConversation);
      emitter.off("CALL_STORE_FUNCTION", callStoreFunction);
    };
  }, []);
};
