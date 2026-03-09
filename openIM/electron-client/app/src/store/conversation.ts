import {
  ConversationGroupType,
  GetConversationGroupInfoWithConversationsResp,
  MessageType,
} from "@openim/wasm-client-sdk";
import {
  ConversationGroup,
  ConversationItem,
  GroupItem,
  GroupMemberItem,
  MessageItem,
} from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { create } from "zustand";

import { ConversationGroupAllKey } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { FileWithPath } from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";
import { feedbackToast } from "@/utils/feedback";
import { conversationSort, isGroupSession } from "@/utils/imCommon";

import { useMessageStore } from "./message";
import {
  ConversationGroupPagination,
  ConversationStore,
  RevokeMessageData,
} from "./type";
import { useUserStore } from "./user";

const CONVERSATION_SPLIT_COUNT = 50;

let currentToggleConversationId = 0;

// Use a factory to avoid sharing the same object reference across state updates.
const createDefaultGroupPagination = (): ConversationGroupPagination => ({
  pageNumber: 1,
  showNumber: CONVERSATION_SPLIT_COUNT,
  total: 0,
  hasMore: true,
});

const computeGroupHasMore = (pageNumber: number, showNumber: number, total: number) =>
  pageNumber * showNumber < total;

type ActiveConversationGroup = ConversationGroup | typeof ConversationGroupAllKey;

const resolveActiveConversationGroup = (
  convGroupID: string,
  state: {
    conversationGroups: ConversationGroup[];
    customConversationGroups: ConversationGroup[];
    activeConversationGroup: ActiveConversationGroup;
  },
): ActiveConversationGroup => {
  if (convGroupID === ConversationGroupAllKey) {
    return ConversationGroupAllKey;
  }
  const group =
    state.conversationGroups.find((item) => item.conversationGroupID === convGroupID) ??
    state.customConversationGroups.find(
      (item) => item.conversationGroupID === convGroupID,
    );
  if (group) {
    return group;
  }
  return ConversationGroupAllKey;
};

const mergePushConversationList = (
  prevList: ConversationItem[],
  updates: ConversationItem[],
) => {
  if (!updates.length) {
    return prevList;
  }
  const updateIDs = new Set(updates.map((item) => item.conversationID));
  const remainingList = prevList.filter(
    (conversation) => !updateIDs.has(conversation.conversationID),
  );
  return conversationSort([...updates, ...remainingList]);
};

const mergeUpdateConversationList = (
  prevList: ConversationItem[],
  updates: ConversationItem[],
) => {
  if (!prevList.length || !updates.length) {
    return prevList;
  }
  const updatesMap = new Map(updates.map((item) => [item.conversationID, item]));
  let changed = false;
  const nextList = prevList.map((conversation) => {
    const update = updatesMap.get(conversation.conversationID);
    if (!update) {
      return conversation;
    }
    changed = true;
    return {
      ...conversation,
      ...update,
    };
  });
  return changed ? nextList : prevList;
};

const mergeConversationGroups = (
  prevGroups: ConversationGroup[],
  updates: ConversationGroup[],
) => {
  if (!updates.length) {
    return prevGroups;
  }
  const groupMap = new Map(
    prevGroups.map((group) => [group.conversationGroupID, group]),
  );
  updates.forEach((group) => {
    groupMap.set(group.conversationGroupID, group);
  });
  return Array.from(groupMap.values());
};

const splitConversationGroupsByType = (groups: ConversationGroup[]) => {
  const presetGroups: ConversationGroup[] = [];
  const customGroups: ConversationGroup[] = [];

  groups.forEach((group) => {
    if (
      group.conversationGroupType === ConversationGroupType.ConversationGroupTypeFilter
    ) {
      presetGroups.push(group);
      return;
    }
    customGroups.push(group);
  });

  return { presetGroups, customGroups };
};

const filterConversationGroups = (groups: ConversationGroup[], groupIDs: string[]) => {
  if (!groupIDs.length || !groups.length) {
    return groups;
  }
  const idSet = new Set(groupIDs);
  return groups.filter((group) => !idSet.has(group.conversationGroupID));
};

export const useConversationStore = create<ConversationStore>()((set, get) => ({
  conversationIniting: true,
  conversationGroups: [],
  customConversationGroups: [],
  activeConversationGroup: ConversationGroupAllKey,
  activeGroupPagination: createDefaultGroupPagination(),
  conversationList: [],
  displayConversationList: [],
  conversationListRefreshId: 0,
  pinnedMessages: [],
  currentConversation: undefined,
  unReadCount: 0,
  currentGroupInfo: undefined,
  currentMemberInGroup: undefined,
  quoteMessage: undefined,
  revokeMap: {} as Record<string, RevokeMessageData>,
  fileMap: {} as Record<string, FileWithPath>,
  getActiveConversationGroupID: () => {
    const activeGroup = get().activeConversationGroup;
    return activeGroup === ConversationGroupAllKey
      ? ConversationGroupAllKey
      : activeGroup.conversationGroupID;
  },
  getConversationListByReq: async (isOffset?: boolean, forceLoading?: boolean) => {
    const activeConvGroupID = get().getActiveConversationGroupID();
    const isAllGroup = activeConvGroupID === ConversationGroupAllKey;
    const shouldRefreshDisplay = !isOffset;

    if (shouldRefreshDisplay) {
      set((state) => ({
        conversationListRefreshId: state.conversationListRefreshId + 1,
      }));
    }
    if (!forceLoading && shouldRefreshDisplay) {
      set(() => ({ conversationIniting: true }));
    }
    if (isAllGroup) {
      let tmpConversationList = [] as ConversationItem[];
      try {
        const { data } = await IMSDK.getConversationListSplit({
          offset: isOffset ? get().conversationList.length : 0,
          count: CONVERSATION_SPLIT_COUNT,
        });
        tmpConversationList = data;
      } catch (error) {
        feedbackToast({ error, msg: t("system.toast.getConversationFailed") });
        if (!isOffset) set(() => ({ conversationIniting: false }));
        return true;
      }

      set((state) => {
        const nextAllList = [
          ...(isOffset ? state.conversationList : []),
          ...tmpConversationList,
        ];
        const nextActiveGroupID =
          state.activeConversationGroup === ConversationGroupAllKey
            ? ConversationGroupAllKey
            : state.activeConversationGroup.conversationGroupID;
        return {
          conversationList: nextAllList,
          displayConversationList:
            nextActiveGroupID === ConversationGroupAllKey
              ? nextAllList
              : state.displayConversationList,
          activeConversationGroup:
            nextActiveGroupID === ConversationGroupAllKey
              ? ConversationGroupAllKey
              : state.activeConversationGroup,
        };
      });
      if (!forceLoading && !isOffset) set(() => ({ conversationIniting: false }));
      return tmpConversationList.length === CONVERSATION_SPLIT_COUNT;
    }

    const { pageNumber, showNumber } = get().activeGroupPagination;
    const nextPageNumber = isOffset ? pageNumber + 1 : 1;
    let data: GetConversationGroupInfoWithConversationsResp;
    try {
      const res = await IMSDK.getConversationGroupInfoWithConversations({
        conversationGroupID: activeConvGroupID,
        pagination: {
          pageNumber: nextPageNumber,
          showNumber,
        },
      });
      data = res.data;
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getConversationFailed") });
      if (shouldRefreshDisplay) set(() => ({ conversationIniting: false }));
      return true;
    }

    const nextDisplayList = isOffset
      ? [...get().displayConversationList, ...data.conversationElems]
      : [...data.conversationElems];
    const nextHasMore = computeGroupHasMore(
      nextPageNumber,
      showNumber,
      data.conversationTotal,
    );
    const nextAllList = mergePushConversationList(
      get().conversationList,
      data.conversationElems,
    );

    set(() => ({
      conversationList: nextAllList,
      displayConversationList: nextDisplayList,
      activeConversationGroup: data.group,
      activeGroupPagination: {
        pageNumber: nextPageNumber,
        showNumber,
        total: data.conversationTotal,
        hasMore: nextHasMore,
      },
    }));

    if (!forceLoading && shouldRefreshDisplay) {
      set(() => ({ conversationIniting: false }));
    }
    return nextHasMore;
  },
  setActiveConversationGroup: async (convGroupID) => {
    if (convGroupID === get().getActiveConversationGroupID()) {
      return;
    }

    const hasAllConversationList = get().conversationList.length > 0;
    const nextDisplayList =
      convGroupID === ConversationGroupAllKey ? get().conversationList : [];

    set((state) => ({
      activeConversationGroup: resolveActiveConversationGroup(convGroupID, {
        conversationGroups: state.conversationGroups,
        customConversationGroups: state.customConversationGroups,
        activeConversationGroup: state.activeConversationGroup,
      }),
      activeGroupPagination: createDefaultGroupPagination(),
      displayConversationList: nextDisplayList,
      conversationIniting:
        convGroupID === ConversationGroupAllKey ? !hasAllConversationList : true,
      conversationListRefreshId: state.conversationListRefreshId + 1,
    }));

    if (convGroupID === ConversationGroupAllKey) {
      await get().getUnReadCountByReq();
      if (!hasAllConversationList) {
        await get().getConversationListByReq(false);
      }
      return;
    }

    await get().getConversationListByReq(false);
  },
  updateConversationList: (list: ConversationItem[]) => {
    // Sync both conversationList and displayConversationList when conversations update.
    if (!list.length) {
      return;
    }
    const currentConversationID = get().currentConversation?.conversationID ?? "";
    if (currentConversationID) {
      const idx = list.findIndex((c) => c.conversationID === currentConversationID);
      if (idx > -1) get().updateCurrentConversation(list[idx]);
    }

    set((state) => {
      const existingIDsInAll = new Set(
        state.conversationList.map((conversation) => conversation.conversationID),
      );
      const existingUpdatesInAll = list.filter((item) =>
        existingIDsInAll.has(item.conversationID),
      );
      const missingUpdatesInAll = list.filter(
        (item) => !existingIDsInAll.has(item.conversationID),
      );

      const updatedAllList = mergeUpdateConversationList(
        state.conversationList,
        existingUpdatesInAll,
      );
      const nextAllList = missingUpdatesInAll.length
        ? mergePushConversationList(updatedAllList, missingUpdatesInAll)
        : conversationSort(updatedAllList, state.conversationList);

      let nextDisplayList: ConversationItem[] = nextAllList;
      if (state.activeConversationGroup !== ConversationGroupAllKey) {
        const activeGroupConvIDs = new Set(
          state.activeConversationGroup.conversationIDs,
        );
        const displayConvIDs = new Set(
          state.displayConversationList.map(
            (conversation) => conversation.conversationID,
          ),
        );
        const updatedActiveList = list.filter((item) =>
          activeGroupConvIDs.has(item.conversationID),
        );
        const existingUpdatesInActive = updatedActiveList.filter((item) =>
          displayConvIDs.has(item.conversationID),
        );
        const missingUpdatesInActive = updatedActiveList.filter(
          (item) => !displayConvIDs.has(item.conversationID),
        );

        const updatedDisplayList = mergeUpdateConversationList(
          state.displayConversationList,
          existingUpdatesInActive,
        );
        nextDisplayList = missingUpdatesInActive.length
          ? mergePushConversationList(updatedDisplayList, missingUpdatesInActive)
          : conversationSort(updatedDisplayList, state.displayConversationList);
      }

      return {
        conversationList: nextAllList,
        displayConversationList: nextDisplayList,
      };
    });
  },
  pushConversationList: (list: ConversationItem[]) => {
    if (!list.length) {
      return;
    }
    set((state) => {
      const nextAllList = mergePushConversationList(state.conversationList, list);
      const nextDisplayList =
        state.activeConversationGroup === ConversationGroupAllKey
          ? nextAllList
          : state.displayConversationList;
      return {
        conversationList: nextAllList,
        displayConversationList: nextDisplayList,
      };
    });
  },
  pushDisplayConversationList: (list: ConversationItem[], convGroupID: string) => {
    if (!list.length) {
      return;
    }
    if (get().getActiveConversationGroupID() !== convGroupID) {
      return;
    }
    set((state) => ({
      displayConversationList: conversationSort(
        [...list, ...state.displayConversationList],
        state.displayConversationList,
      ),
    }));
  },
  removeConversationFromDisplayList: (conversationID: string, convGroupID: string) => {
    // Removing from a group does not imply removing from "All", so keep this scoped.
    // Full list updates go through updateConversationList or delConversationByCID.
    set((state) => {
      const activeConvGroupID =
        state.activeConversationGroup === ConversationGroupAllKey
          ? ConversationGroupAllKey
          : state.activeConversationGroup.conversationGroupID;
      if (activeConvGroupID !== convGroupID) {
        return {};
      }
      return {
        displayConversationList: state.displayConversationList.filter(
          (conversation) => conversation.conversationID !== conversationID,
        ),
      };
    });
  },
  updateConversationGroups: (convGroups: ConversationGroup[]) => {
    if (!convGroups.length) {
      return;
    }

    const { presetGroups, customGroups } = splitConversationGroupsByType(convGroups);
    if (!presetGroups.length && !customGroups.length) {
      return;
    }

    const state = get();
    const nextPresetGroups = presetGroups.length
      ? mergeConversationGroups(state.conversationGroups, presetGroups)
      : state.conversationGroups;
    const nextCustomGroups = customGroups.length
      ? mergeConversationGroups(state.customConversationGroups, customGroups)
      : state.customConversationGroups;

    const activeConvGroupID = get().getActiveConversationGroupID();
    const nextActiveConversationGroup = resolveActiveConversationGroup(
      activeConvGroupID,
      {
        conversationGroups: nextPresetGroups,
        customConversationGroups: nextCustomGroups,
        activeConversationGroup: state.activeConversationGroup,
      },
    );

    set({
      conversationGroups: nextPresetGroups,
      customConversationGroups: nextCustomGroups,
      activeConversationGroup: nextActiveConversationGroup,
    });
  },
  updateActiveConversationGroup: (group) => {
    set(() => ({ activeConversationGroup: group }));
  },
  removeConversationGroups: (convGroupIDs: string[]) => {
    if (!convGroupIDs.length) {
      return;
    }

    const state = get();
    const nextPresetGroups = filterConversationGroups(
      state.conversationGroups,
      convGroupIDs,
    );
    const nextCustomGroups = filterConversationGroups(
      state.customConversationGroups,
      convGroupIDs,
    );
    const activeConvGroupID = get().getActiveConversationGroupID();
    const nextActiveConversationGroup = resolveActiveConversationGroup(
      activeConvGroupID,
      {
        conversationGroups: nextPresetGroups,
        customConversationGroups: nextCustomGroups,
        activeConversationGroup: state.activeConversationGroup,
      },
    );

    set({
      conversationGroups: nextPresetGroups,
      customConversationGroups: nextCustomGroups,
      activeConversationGroup: nextActiveConversationGroup,
    });

    if (
      activeConvGroupID !== ConversationGroupAllKey &&
      convGroupIDs.includes(activeConvGroupID)
    ) {
      set((prev) => ({
        activeConversationGroup: ConversationGroupAllKey,
        activeGroupPagination: createDefaultGroupPagination(),
        displayConversationList: prev.conversationList,
        conversationListRefreshId: prev.conversationListRefreshId + 1,
      }));
    }
  },
  getConversationGroupsByReq: async () => {
    const [presetGroupsResult, customGroupsResult] = await Promise.allSettled([
      IMSDK.getConversationGroups(ConversationGroupType.ConversationGroupTypeFilter),
      IMSDK.getConversationGroups(ConversationGroupType.ConversationGroupTypeNormal),
    ]);

    const nextPresetGroups =
      presetGroupsResult.status === "fulfilled"
        ? presetGroupsResult.value.data
        : get().conversationGroups;
    const nextCustomGroups =
      customGroupsResult.status === "fulfilled"
        ? customGroupsResult.value.data
        : get().customConversationGroups;

    const rejectedResult =
      presetGroupsResult.status === "rejected"
        ? presetGroupsResult
        : customGroupsResult.status === "rejected"
          ? customGroupsResult
          : undefined;

    if (rejectedResult) {
      feedbackToast({
        error: rejectedResult.reason,
        msg: t("system.toast.getConversationGroupsFailed"),
      });
    }

    const activeConvGroupID = get().getActiveConversationGroupID();
    const nextActiveConversationGroup = resolveActiveConversationGroup(
      activeConvGroupID,
      {
        conversationGroups: nextPresetGroups,
        customConversationGroups: nextCustomGroups,
        activeConversationGroup: get().activeConversationGroup,
      },
    );

    set({
      conversationGroups: nextPresetGroups,
      customConversationGroups: nextCustomGroups,
      activeConversationGroup: nextActiveConversationGroup,
    });

    // If the active group no longer exists (e.g. deleted tag), fall back to "All"
    // and reset the display list so the UI does not stay on an invalid group.
    const allGroups = [...nextPresetGroups, ...nextCustomGroups];
    if (
      activeConvGroupID !== ConversationGroupAllKey &&
      !allGroups.some((group) => group.conversationGroupID === activeConvGroupID)
    ) {
      set((state) => ({
        activeConversationGroup: ConversationGroupAllKey,
        activeGroupPagination: createDefaultGroupPagination(),
        displayConversationList: state.conversationList,
        conversationListRefreshId: state.conversationListRefreshId + 1,
      }));
    }
  },
  delConversationByCID: (conversationID: string) => {
    set((state) => {
      const nextAllList = state.conversationList.filter(
        (conversation) => conversation.conversationID !== conversationID,
      );
      const nextDisplayList = state.displayConversationList.filter(
        (conversation) => conversation.conversationID !== conversationID,
      );
      return {
        conversationList: nextAllList,
        displayConversationList: nextDisplayList,
      };
    });
  },
  getPinnedMessages: (conversationID: string, toggleId?: number) => {
    IMSDK.getConversationPinnedMsg(conversationID)
      .then(({ data }) => {
        if (toggleId && toggleId !== currentToggleConversationId) {
          console.warn("getPinnedMessages: toggleId mismatch, ignoring response");
          return;
        }
        set(() => ({ pinnedMessages: data }));
      })
      .catch((error) => {
        console.error("get pinned message failed", error);
      });
  },
  setPinnedMessages: (messages: MessageItem[]) => {
    set(() => ({ pinnedMessages: messages }));
  },
  addPinnedMessage: async (conversationID: string, message: MessageItem) => {
    if (
      get().pinnedMessages.some(
        (pinnedMessage) => pinnedMessage.clientMsgID === message.clientMsgID,
      )
    ) {
      return;
    }
    await IMSDK.setConversationPinnedMsg({
      conversationID,
      clientMsgID: message.clientMsgID,
      pinned: true,
    });
    set((state) => ({
      pinnedMessages: [message, ...state.pinnedMessages],
    }));
  },
  removePinnedMessage: async (message: MessageItem) => {
    await IMSDK.setConversationPinnedMsg({
      // eslint-disable-next-line
      conversationID: get().currentConversation?.conversationID!,
      clientMsgID: message.clientMsgID,
      pinned: false,
    });
    set((state) => ({
      pinnedMessages: state.pinnedMessages.filter(
        (pinnedMessage) => pinnedMessage.clientMsgID !== message.clientMsgID,
      ),
    }));
  },
  clearPinnedMessages: () => {
    set(() => ({ pinnedMessages: [] }));
  },
  updateCurrentConversation: async (
    conversation?: ConversationItem,
    isJump?: boolean,
  ) => {
    if (!conversation) {
      set(() => ({
        currentConversation: undefined,
        quoteMessage: undefined,
        currentGroupInfo: undefined,
        currentMemberInGroup: undefined,
      }));
      return;
    }
    const prevConversation = get().currentConversation;

    const toggleNewConversation =
      conversation.conversationID !== prevConversation?.conversationID;
    if (toggleNewConversation) {
      const toggleId = ++currentToggleConversationId;
      get().clearPinnedMessages();
      if (isGroupSession(conversation.conversationType)) {
        get().getPinnedMessages(conversation.conversationID, toggleId);
        get().getCurrentGroupInfoByReq(conversation.groupID, toggleId);
        await get().getCurrentMemberInGroupByReq(conversation.groupID);
      }
      if (!isJump) {
        useMessageStore.getState().updateJumpClientMsgID();
      }
    }
    set(() => ({ currentConversation: { ...conversation } }));
  },
  updateCurrentConversationFields: (fields: Partial<ConversationItem>) => {
    set((state) => ({
      currentConversation: {
        ...state.currentConversation!,
        ...fields,
      },
    }));
  },
  getUnReadCountByReq: async () => {
    try {
      const { data } = await IMSDK.getTotalUnreadMsgCount();
      get().updateUnReadCount(data);
      return data;
    } catch (error) {
      console.error(error);
      return 0;
    }
  },
  updateUnReadCount: (count: number) => {
    set(() => ({ unReadCount: count }));
  },
  getCurrentGroupInfoByReq: async (groupID: string, toggleId?: number) => {
    let groupInfo: GroupItem;
    try {
      const { data } = await IMSDK.getSpecifiedGroupsInfo([groupID]);
      groupInfo = data[0];
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getGroupInfoFailed") });
      return;
    }
    if (toggleId && toggleId !== currentToggleConversationId) {
      console.warn("getCurrentGroupInfoByReq: toggleId mismatch, ignoring response");
      return;
    }
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  updateCurrentGroupInfo: (groupInfo: GroupItem) => {
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  getCurrentMemberInGroupByReq: async (groupID: string) => {
    let memberInfo: GroupMemberItem;
    const selfID = useUserStore.getState().selfInfo.userID;
    try {
      const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
        groupID,
        userIDList: [selfID],
      });
      memberInfo = data[0];
    } catch (error) {
      set(() => ({ currentMemberInGroup: undefined }));
      feedbackToast({ error, msg: t("system.toast.getGroupMemberFailed") });
      return;
    }
    set(() => ({ currentMemberInGroup: memberInfo ? { ...memberInfo } : undefined }));
  },
  setCurrentMemberInGroup: (memberInfo?: GroupMemberItem) => {
    set(() => ({ currentMemberInGroup: memberInfo }));
  },
  tryUpdateCurrentMemberInGroup: (member: GroupMemberItem) => {
    const currentMemberInGroup = get().currentMemberInGroup;
    if (
      member.groupID === currentMemberInGroup?.groupID &&
      member.userID === currentMemberInGroup?.userID
    ) {
      set(() => ({ currentMemberInGroup: { ...member } }));
    }
  },
  updateQuoteMessage: (message?: MessageItem) => {
    set(() => ({ quoteMessage: message }));
  },
  addRevokedMessage: (message: MessageItem, quoteMessage?: MessageItem) => {
    set((state) => ({
      revokeMap: {
        ...state.revokeMap,
        [message.clientMsgID]: {
          text: getMessageText(message),
          atEl: message.atTextElem,
          quoteMessage,
        },
      },
    }));
  },
  clearConversationStore: () => {
    set(() => ({
      conversationGroups: [],
      customConversationGroups: [],
      activeConversationGroup: ConversationGroupAllKey,
      activeGroupPagination: createDefaultGroupPagination(),
      conversationList: [],
      displayConversationList: [],
      currentConversation: undefined,
      unReadCount: 0,
      currentGroupInfo: undefined,
      currentMemberInGroup: undefined,
      quoteMessage: undefined,
    }));
  },
  addFile: (file: FileWithPath) => {
    if (file.uuid) {
      set((state) => ({ fileMap: { ...state.fileMap, [file.uuid!]: file } }));
    }
    if (file.path) {
      set((state) => ({ fileMap: { ...state.fileMap, [file.path]: null } }));
    }
  },
  deleteFile: (uuid: string) => {
    set((state) => {
      const fileMap = { ...state.fileMap };
      delete fileMap[uuid];
      return { fileMap };
    });
  },
  clearFileMap: () => {
    set(() => ({ fileMap: {} }));
  },
}));

export const useActiveConversationGroupID = () =>
  useConversationStore((state) =>
    state.activeConversationGroup === ConversationGroupAllKey
      ? ConversationGroupAllKey
      : state.activeConversationGroup.conversationGroupID,
  );

const getMessageText = (message: MessageItem) => {
  if (message.contentType === MessageType.AtTextMessage) {
    return message.atTextElem!.text;
  }
  if (message.contentType === MessageType.QuoteMessage) {
    return message.quoteElem!.text;
  }
  return message.textElem!.content;
};
