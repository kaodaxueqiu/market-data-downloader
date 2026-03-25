import { MessageType, SessionType, ViewType } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { useLatest } from "ahooks";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { LEGACY_SESSION_ID } from "@/api/types/session";
import { SystemMessageTypes } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import {
  ExMessageItem,
  useConversationStore,
  useMessageStore,
  useSessionStore,
  useUserStore,
} from "@/store";
import { useContactStore } from "@/store/contact";
import emitter, {
  emit,
  GetMessageContextParams,
  UpdateMessaggeBaseInfoParams,
} from "@/utils/window/events";

const START_INDEX = 10000;
const SPLIT_COUNT = 20;
const MAX_FETCH_ROUNDS = 10;

function getMessageSessionId(msg: ExMessageItem): string | null {
  if (!msg.ex) return null;
  try {
    const exData = JSON.parse(msg.ex);
    return exData.sessionId ?? null;
  } catch {
    return null;
  }
}

function isCurrentConversationAgent(): boolean {
  const currentConv = useConversationStore.getState().currentConversation;
  if (!currentConv?.userID) return false;
  return useContactStore.getState().agents.some((a) => a.userID === currentConv.userID);
}

function filterBySession(messages: ExMessageItem[]): ExMessageItem[] {
  if (!isCurrentConversationAgent()) return messages;

  const activeSessionId = useSessionStore.getState().activeSessionId;
  if (!activeSessionId) return messages;

  return messages.filter((msg) => {
    const effectiveId = getMessageSessionId(msg) ?? LEGACY_SESSION_ID;
    return effectiveId === activeSessionId;
  });
}

export function useHistoryMessageList({
  scrollToIndex,
  scrollToBottom,
  isAtBottomRef,
}: {
  scrollToIndex: (index: number) => void;
  scrollToBottom: () => void;
  isAtBottomRef: { current: boolean };
}) {
  const { conversationID } = useParams();
  const [loadState, setLoadState] = useState({
    initLoading: true,
    hasMoreOld: true,
    hasMoreNew: true,
    messageList: [] as ExMessageItem[],
    firstItemIndex: START_INDEX,
  });
  const pendingClientMsgIDs = useRef([] as string[]);
  const latestLoadState = useLatest(loadState);
  const latestConversationID = useLatest(conversationID ?? "");
  const messageReqIdRef = useRef(0);
  const getConversationPreviewImgList = useMessageStore(
    (state) => state.getConversationPreviewImgList,
  );
  const updateCheckMode = useMessageStore((state) => state.updateCheckMode);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const clearPreviewList = useMessageStore((state) => state.clearPreviewList);
  const updateQuoteMessage = useConversationStore((state) => state.updateQuoteMessage);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  const isActiveConversation = (requestConversationID: string) =>
    requestConversationID !== "" &&
    requestConversationID === latestConversationID.current;

  useEffect(() => {
    messageReqIdRef.current += 1;
    pendingClientMsgIDs.current = [];
    if (!useMessageStore.getState().jumpClientMsgID) {
      loadHistoryMessages();
    }
    return () => {
      updateCheckMode(false);
      updateQuoteMessage();
      clearPreviewList();
      setLoadState(() => ({
        initLoading: true,
        hasMoreOld: true,
        hasMoreNew: true,
        messageList: [] as ExMessageItem[],
        firstItemIndex: START_INDEX,
      }));
    };
  }, [conversationID]);

  useEffect(() => {
    if (!activeSessionId || !isCurrentConversationAgent()) return;
    useSessionStore.getState().clearUnread(activeSessionId);
    setLoadState({
      initLoading: true,
      hasMoreOld: true,
      hasMoreNew: true,
      messageList: [],
      firstItemIndex: START_INDEX,
    });
    messageReqIdRef.current += 1;
    pendingClientMsgIDs.current = [];
    loadHistoryMessages().then(() => {
      setTimeout(scrollToBottom, 100);
    });
  }, [activeSessionId]);

  useEffect(() => {
    const pushNewMessage = (message: ExMessageItem) => {
      const isSearchMode = Boolean(useMessageStore.getState().jumpClientMsgID);
      const isRepeated = latestLoadState.current.messageList.some(
        (item) => item.clientMsgID === message.clientMsgID,
      );
      if ((isSearchMode && latestLoadState.current.hasMoreNew) || isRepeated) {
        if (message.isAppend) {
          pendingClientMsgIDs.current.push(message.clientMsgID);
        }
        return;
      }
      const shouldAppend =
        message.sendID !== selfUserID ||
        SystemMessageTypes.includes(message.contentType);
      if (!isSearchMode && !document.hidden && !isAtBottomRef.current && shouldAppend) {
        message.isAppend = true;
        emit("UPDATE_IS_HAS_NEW_MESSAGES", true);
      }
      setLoadState((preState) => {
        message.gapTime =
          message.sendTime -
            (preState.messageList[preState.messageList.length - 1]?.sendTime ?? 0) >
          300000;
        return {
          ...preState,
          messageList: removeRepeatedMessages([...preState.messageList, message]),
        };
      });
      if (!isSearchMode && message.sendID === selfUserID) {
        scrollToBottom();
      }
    };
    const updateOneMessage = (message: ExMessageItem) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex((msg) => msg.clientMsgID === message.clientMsgID);
        if (idx < 0) {
          return preState;
        }

        tmpList[idx] = { ...tmpList[idx], ...message };
        if (message.contentType === MessageType.RevokeMessage) {
          updateQuotedMessages(tmpList, message.clientMsgID);
        }
        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    const updateMessageNicknameAndFaceUrl = ({
      sendID,
      senderNickname,
      senderFaceUrl,
    }: UpdateMessaggeBaseInfoParams) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList].map((message) => {
          if (message.sendID === sendID) {
            message.senderFaceUrl = senderFaceUrl;
            message.senderNickname = senderNickname;
          }
          return message;
        });
        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    const deleteOnewMessage = (clientMsgID: string) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex((msg) => msg.clientMsgID === clientMsgID);
        if (idx < 0) {
          return preState;
        }
        tmpList.splice(idx, 1);

        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    const deleteMessagesByUser = (userID: string) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList].filter(
          (message) => message.sendID !== userID,
        );
        return {
          ...preState,
          messageList: tmpList,
        };
      });
    };
    const deleteOnewMessageAndPush = (message: ExMessageItem) => {
      setLoadState((preState) => {
        const tmpList = [...preState.messageList];
        const idx = tmpList.findIndex((msg) => msg.clientMsgID === message.clientMsgID);
        if (idx < 0) {
          return preState;
        }
        tmpList.splice(idx, 1);
        return {
          ...preState,
          messageList: [...tmpList, message],
        };
      });
    };
    const clearMessages = () => {
      setLoadState(() => ({
        initLoading: false,
        hasMoreOld: true,
        hasMoreNew: true,
        messageList: [] as ExMessageItem[],
        firstItemIndex: START_INDEX,
      }));
    };
    const clearMessageState = (key: keyof ExMessageItem) => {
      setLoadState((preState) => ({
        ...preState,
        messageList: preState.messageList.map((message) => ({
          ...message,
          [key]: false,
        })),
      }));
    };
    const getMessageContextHandler = ({ message, viewType }: GetMessageContextParams) =>
      getMessageContext(message, viewType);
    const getMessageList = (callback: (messages: ExMessageItem[]) => void) =>
      setTimeout(() => {
        callback(latestLoadState.current.messageList);
      });

    const refresh = () => {
      loadHistoryMessages();
    };
    emitter.on("PUSH_NEW_MSG", pushNewMessage);
    emitter.on("UPDATE_ONE_MSG", updateOneMessage);
    emitter.on("UPDATE_MSG_NICK_AND_FACEURL", updateMessageNicknameAndFaceUrl);
    emitter.on("DELETE_ONE_MSG", deleteOnewMessage);
    emitter.on("DELETE_MSG_BY_USER", deleteMessagesByUser);
    emitter.on("DELETE_AND_PUSH_ONE_MSG", deleteOnewMessageAndPush);
    emitter.on("CLEAR_MSGS", clearMessages);
    emitter.on("CLEAR_MSG_STATE", clearMessageState);
    emitter.on("LOAD_HISTORY_MSGS", loadHistoryMessages);
    emitter.on("GET_MSG_CONTEXT", getMessageContextHandler);
    emitter.on("GET_MSG_LIST", getMessageList);
    emitter.on("SYNC_NEW_MSGS", refresh);
    return () => {
      emitter.off("PUSH_NEW_MSG", pushNewMessage);
      emitter.off("UPDATE_ONE_MSG", updateOneMessage);
      emitter.off("UPDATE_MSG_NICK_AND_FACEURL", updateMessageNicknameAndFaceUrl);
      emitter.off("DELETE_ONE_MSG", deleteOnewMessage);
      emitter.off("DELETE_MSG_BY_USER", deleteMessagesByUser);
      emitter.off("DELETE_AND_PUSH_ONE_MSG", deleteOnewMessageAndPush);
      emitter.off("CLEAR_MSGS", clearMessages);
      emitter.off("CLEAR_MSG_STATE", clearMessageState);
      emitter.off("LOAD_HISTORY_MSGS", loadHistoryMessages);
      emitter.off("GET_MSG_CONTEXT", getMessageContextHandler);
      emitter.off("GET_MSG_LIST", getMessageList);
      emitter.off("SYNC_NEW_MSGS", refresh);
    };
  }, []);

  const loadHistoryMessages = () =>
    getMoreOldMessages(false).then(() => getConversationPreviewImgList());

  const isAgent = isCurrentConversationAgent();
  const FETCH_BATCH = isAgent ? 50 : SPLIT_COUNT;

  const { isPending: moreOldLoading, mutateAsync: getMoreOldMessagesMutation } =
    useMutation<void, unknown, boolean>({
      mutationFn: async (loadMore: boolean = true) => {
        const requestConversationID = conversationID ?? "";
        const requestId = ++messageReqIdRef.current;

        try {
          let allFiltered: ExMessageItem[] = [];
          let startMsgID = loadMore
            ? latestLoadState.current.messageList[0]?.clientMsgID ?? ""
            : "";
          let isEnd = false;
          let fetchRound = 0;
          let consecutiveEmpty = 0;

          while (allFiltered.length < SPLIT_COUNT && !isEnd && fetchRound < MAX_FETCH_ROUNDS) {
            fetchRound++;
            const { data } = await IMSDK.getAdvancedHistoryMessageList({
              count: FETCH_BATCH,
              startClientMsgID: startMsgID,
              conversationID: conversationID ?? "",
              viewType: useMessageStore.getState().jumpClientMsgID
                ? ViewType.Search
                : ViewType.History,
            });

            if (requestId !== messageReqIdRef.current) return;
            if (!isActiveConversation(requestConversationID)) return;

            isEnd = data.isEnd;
            const batch = filterBySession(data.messageList as ExMessageItem[]);
            allFiltered = [...batch, ...allFiltered];

            if (data.messageList.length > 0) {
              startMsgID = data.messageList[0].clientMsgID;
            }

            if (!isAgent) break;
          }

          allFiltered.forEach((message, idx) => {
            if (!idx) {
              message.gapTime = true;
              return;
            }
            const prevTime = allFiltered[idx - 1]?.sendTime ?? 0;
            if (message.sessionType === SessionType.Notification) {
              (allFiltered[idx - 1] as ExMessageItem).gapTime =
                message.sendTime - prevTime > 300000;
            } else {
              message.gapTime = message.sendTime - prevTime > 300000;
            }
          });

          setTimeout(() => {
            if (!isActiveConversation(requestConversationID)) return;
            setLoadState((preState) => ({
              ...preState,
              initLoading: false,
              hasMoreOld: !isEnd,
              messageList: removeRepeatedMessages([
                ...allFiltered,
                ...(loadMore ? preState.messageList : []),
              ]),
              firstItemIndex: preState.firstItemIndex - allFiltered.length,
            }));
          });
        } catch (error) {
          console.error("[HistoryMessage] Failed to load messages:", error);
          setLoadState((preState) => ({ ...preState, initLoading: false }));
        }
      },
    });

  const getMoreOldMessages = (loadMore = true) => getMoreOldMessagesMutation(loadMore);

  const { isPending: moreNewLoading, mutateAsync: getMoreNewMessages } = useMutation({
    mutationFn: async () => {
      const requestConversationID = conversationID ?? "";
      const lastMessage = latestLoadState.current.messageList.findLast((message) =>
        Boolean(message.seq),
      );
      const { data } = await IMSDK.getAdvancedHistoryMessageListReverse({
        count: SPLIT_COUNT,
        startClientMsgID: lastMessage?.clientMsgID ?? "",
        conversationID: conversationID ?? "",
        viewType: useMessageStore.getState().jumpClientMsgID
          ? ViewType.Search
          : ViewType.History,
      });
      if (!isActiveConversation(requestConversationID)) {
        return;
      }
      const filteredNew = filterBySession(data.messageList as ExMessageItem[]);
      filteredNew.map((message, idx) => {
        if (pendingClientMsgIDs.current.includes(message.clientMsgID)) {
          message.isAppend = true;
        }
        if (!idx) {
          message.gapTime = true;
          return;
        }
        const prevTime = filteredNew[idx - 1]?.sendTime ?? 0;
        if (message.sessionType === SessionType.Notification) {
          (filteredNew[idx - 1] as ExMessageItem).gapTime =
            message.sendTime - prevTime > 300000;
        } else {
          message.gapTime = message.sendTime - prevTime > 300000;
        }
      });
      setLoadState((preState) => ({
        ...preState,
        hasMoreNew: !data.isEnd,
        messageList: removeRepeatedMessages([
          ...preState.messageList,
          ...filteredNew,
        ]),
      }));
    },
  });

  const {
    isPending: getMessageContextLoading,
    mutateAsync: getMessageContextMutation,
  } = useMutation({
    mutationFn: async ({ message, viewType }: GetMessageContextParams) => {
      const requestConversationID =
        (message as { conversationID?: string }).conversationID ?? conversationID ?? "";
      const {
        data: { messageList },
      } = await IMSDK.fetchSurroundingMessages({
        startMessage: message,
        viewType,
        before: SPLIT_COUNT,
        after: SPLIT_COUNT,
      });
      if (!isActiveConversation(requestConversationID)) {
        return;
      }
      messageList.map((message, idx) => {
        if (pendingClientMsgIDs.current.includes(message.clientMsgID)) {
          (message as ExMessageItem).isAppend = true;
        }
        if (!idx) return;
        const prevTime = messageList[idx - 1]?.sendTime ?? 0;
        (messageList[idx - 1] as ExMessageItem).gapTime =
          message.sendTime - prevTime > 300000;
      });
      const startMessageIdx = messageList.findIndex(
        (m) => m.clientMsgID === message.clientMsgID,
      );
      setLoadState((preState) => ({
        ...preState,
        initLoading: false,
        hasMoreOld: startMessageIdx === SPLIT_COUNT,
        hasMoreNew: messageList.length - startMessageIdx === SPLIT_COUNT + 1,
        messageList: messageList,
        firstItemIndex: START_INDEX - startMessageIdx,
      }));
      scrollToIndex(startMessageIdx);
    },
  });

  const getMessageContext = (message: ExMessageItem, viewType: ViewType) =>
    getMessageContextMutation({ message, viewType });

  return {
    SPLIT_COUNT,
    loadState,
    latestLoadState,
    conversationID,
    moreOldLoading,
    moreNewLoading,
    getMessageContextLoading,
    getMoreOldMessages,
    getMoreNewMessages,
    getMessageContext,
  };
}

const updateQuotedMessages = (messages: ExMessageItem[], clientMsgID: string) => {
  // update messages that quote this message
  messages.map((message, idx) => {
    const quoteMessage =
      message.quoteElem?.quoteMessage || message.atTextElem?.quoteMessage;
    if (quoteMessage?.clientMsgID === clientMsgID) {
      if (message.quoteElem?.quoteMessage) {
        messages[idx] = {
          ...message,
          quoteElem: {
            ...message.quoteElem,
            quoteMessage: {
              ...message.quoteElem.quoteMessage,
              contentType: MessageType.RevokeMessage,
            },
          },
        };
      } else {
        messages[idx] = {
          ...message,
          atTextElem: {
            ...message.atTextElem!,
            quoteMessage: {
              ...message.atTextElem!.quoteMessage!,
              contentType: MessageType.RevokeMessage,
            },
          },
        };
      }
    }
  });
};

const removeRepeatedMessages = (messages: ExMessageItem[]) => {
  const seen = new Set();
  return messages.filter((message) => {
    if (seen.has(message.clientMsgID)) {
      console.warn("remove repeated message:", message.clientMsgID);
      return false;
    }
    seen.add(message.clientMsgID);
    return true;
  });
};

export const pushNewMessage = (message: ExMessageItem) => emit("PUSH_NEW_MSG", message);
export const updateOneMessage = (message: ExMessageItem) =>
  emit("UPDATE_ONE_MSG", message);
export const updateMessageNicknameAndFaceUrl = (params: UpdateMessaggeBaseInfoParams) =>
  emit("UPDATE_MSG_NICK_AND_FACEURL", params);
export const deleteOneMessage = (clientMsgID: string) =>
  emit("DELETE_ONE_MSG", clientMsgID);
export const deleteMessagesByUser = (userID: string) =>
  emit("DELETE_MSG_BY_USER", userID);
export const deleteAndPushOneMessage = (message: ExMessageItem) =>
  emit("DELETE_AND_PUSH_ONE_MSG", message);
export const clearMessages = () => emit("CLEAR_MSGS");
export const clearMessageState = (key: keyof ExMessageItem) =>
  emit("CLEAR_MSG_STATE", key);
export const loadHistoryMessages = () => emit("LOAD_HISTORY_MSGS");
export const getMessageContext = (param: GetMessageContextParams) =>
  emit("GET_MSG_CONTEXT", param);
export const getMessageList = () =>
  new Promise<ExMessageItem[]>((resolve) => {
    emit("GET_MSG_LIST", (messages: ExMessageItem[]) => resolve(messages));
  });
export const syncNewMessages = () => emit("SYNC_NEW_MSGS");
