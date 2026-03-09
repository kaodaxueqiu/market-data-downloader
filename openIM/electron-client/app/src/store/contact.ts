import { ApplicationHandleResult } from "@openim/wasm-client-sdk";
import {
  BlackUserItem,
  FriendApplicationItem,
  FriendUserItem,
  GroupApplicationItem,
  GroupItem,
} from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { create } from "zustand";

import { getAgentListPage, getUserAgentBindings } from "@/api/services/agent";
import type { Agent } from "@/api/types/agent";
import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/feedback";

import { ContactStore } from "./type";
import { useUserStore } from "./user";

export const useContactStore = create<ContactStore>()((set, get) => ({
  friendList: [],
  blackList: [],
  groupList: [],
  agents: [],
  recvFriendApplicationList: [],
  sendFriendApplicationList: [],
  recvGroupApplicationList: [],
  sendGroupApplicationList: [],
  unHandleFriendApplicationCount: 0,
  unHandleGroupApplicationCount: 0,
  getFriendListByReq: async () => {
    try {
      let offset = 0;
      let tmpList = [] as FriendUserItem[];
      let initialFetch = true;

      while (true) {
        const count = initialFetch ? 10000 : 1000;
        const { data } = await IMSDK.getFriendListPage({
          offset,
          count,
          filterBlack: true,
        });
        tmpList = [...tmpList, ...data];
        offset += count;
        if (data.length < count) break;
        initialFetch = false;
      }
      set(() => ({
        friendList: [...tmpList],
      }));
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getFriendListFailed") });
    }
  },
  setFriendList: (list: FriendUserItem[]) => {
    set(() => ({ friendList: list }));
  },
  updateFriend: (friend: FriendUserItem, remove?: boolean) => {
    const tmpList = [...get().friendList];
    const idx = tmpList.findIndex((f) => f.userID === friend.userID);
    if (idx < 0) {
      return;
    }
    if (remove) {
      tmpList.splice(idx, 1);
    } else {
      tmpList[idx] = { ...friend };
    }
    set(() => ({ friendList: tmpList }));
  },
  pushNewFriend: (friend: FriendUserItem) => {
    set((state) => ({ friendList: [...state.friendList, friend] }));
  },
  getBlackListByReq: async () => {
    try {
      const { data } = await IMSDK.getBlackList();
      set(() => ({ blackList: data }));
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getBlackListFailed") });
    }
  },
  updateBlack: (black: BlackUserItem, remove?: boolean) => {
    const tmpList = [...get().blackList];
    const idx = tmpList.findIndex((b) => b.userID === black.userID);
    if (idx < 0) {
      return;
    }
    if (remove) {
      tmpList.splice(idx, 1);
    } else {
      tmpList[idx] = { ...black };
    }
    set(() => ({ blackList: tmpList }));
  },
  pushNewBlack: (black: BlackUserItem) => {
    const isFriend = get().friendList.find((f) => f.userID === black.userID);
    set((state) => ({
      blackList: [...state.blackList, black],
      friendList: !isFriend
        ? state.friendList
        : state.friendList.filter((f) => f.userID !== black.userID),
    }));
  },
  getGroupListByReq: async () => {
    try {
      let offset = 0;
      let tmpList = [] as GroupItem[];

      while (true) {
        const { data } = await IMSDK.getJoinedGroupListPage({ offset, count: 1000 });
        tmpList = [...tmpList, ...data];
        offset += 1000;
        if (data.length < 1000) break;
      }

      // const { data } = await IMSDK.getJoinedGroupList();
      set(() => ({ groupList: tmpList }));
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getGroupListFailed") });
    }
  },
  setGroupList: (list: GroupItem[]) => {
    set(() => ({ groupList: list }));
  },
  updateGroup: (group: GroupItem, remove?: boolean) => {
    const tmpList = [...get().groupList];
    const idx = tmpList.findIndex((g) => g.groupID === group.groupID);
    if (idx < 0) {
      return;
    }
    if (remove) {
      tmpList.splice(idx, 1);
    } else {
      tmpList[idx] = { ...group };
    }
    set(() => ({ groupList: tmpList }));
  },
  pushNewGroup: (group: GroupItem) => {
    set((state) => ({ groupList: [...state.groupList, group] }));
  },
  getAgentsListByReq: async () => {
    try {
      console.log("[Agents] 开始获取用户绑定关系...");
      const bindingsResp = await getUserAgentBindings();
      console.log("[Agents] user_bindings 返回:", JSON.stringify(bindingsResp));
      const bindings = bindingsResp.data?.bindings || [];
      const boundAgentIDs = new Set(bindings.map((b) => b.agentID));
      console.log("[Agents] 绑定的 agentIDs:", [...boundAgentIDs]);

      if (boundAgentIDs.size === 0) {
        console.log("[Agents] 无绑定，列表清空");
        set(() => ({ agents: [] }));
        return;
      }

      let page = 1;
      let tmpList = [] as Agent[];

      while (true) {
        const {
          data: { total, agents },
        } = await getAgentListPage(page, 50);
        console.log("[Agents] /agent/page 返回:", agents?.length, "个, total:", total);
        if (agents && agents.length > 0) {
          tmpList = [...tmpList, ...agents];
        }
        if (!agents || total < 50) break;
        page += 1;
      }

      const filteredList = tmpList.filter((a) => boundAgentIDs.has(a.userID));
      console.log("[Agents] 过滤后:", filteredList.length, "个智能体");
      set(() => ({ agents: filteredList }));
    } catch (error) {
      console.error("[Agents] 加载失败:", error);
    }
  },
  getRecvFriendApplicationListByReq: async () => {
    try {
      const { data } = await IMSDK.getFriendApplicationListAsRecipient();
      set(() => ({ recvFriendApplicationList: data }));
    } catch (error) {
      console.error(error);
    }
  },
  updateRecvFriendApplication: (application: FriendApplicationItem) => {
    let tmpList = [...get().recvFriendApplicationList];
    let unHandleFriendApplicationCount = get().unHandleFriendApplicationCount;
    const idx = tmpList.findIndex((a) => a.fromUserID === application.fromUserID);
    if (idx < 0) {
      tmpList = [...tmpList, application];
      unHandleFriendApplicationCount += 1;
    } else {
      tmpList[idx] = { ...application };
      if (
        application.handleResult !== ApplicationHandleResult.Unprocessed &&
        unHandleFriendApplicationCount > 0
      ) {
        unHandleFriendApplicationCount -= 1;
      }
    }
    set(() => ({ recvFriendApplicationList: tmpList, unHandleFriendApplicationCount }));
  },
  getSendFriendApplicationListByReq: async () => {
    try {
      const { data } = await IMSDK.getFriendApplicationListAsApplicant();
      set(() => ({ sendFriendApplicationList: data }));
    } catch (error) {
      console.error(error);
    }
  },
  updateSendFriendApplication: (application: FriendApplicationItem) => {
    let tmpList = [...get().sendFriendApplicationList];
    const idx = tmpList.findIndex((a) => a.toUserID === application.toUserID);
    if (idx < 0) {
      tmpList = [...tmpList, application];
    } else {
      tmpList[idx] = { ...application };
    }
    set(() => ({ sendFriendApplicationList: tmpList }));
  },
  deleteFriendApplication: async (application: FriendApplicationItem) => {
    const isRecv = application.toUserID === useUserStore.getState().selfInfo.userID;
    await IMSDK.deleteFriendRequests([
      {
        fromUserID: application.fromUserID,
        toUserID: application.toUserID,
      },
    ]);
    if (isRecv) {
      const tmpList = [...get().recvFriendApplicationList];
      const idx = tmpList.findIndex((a) => a.fromUserID === application.fromUserID);
      if (idx < 0) {
        return;
      }
      tmpList.splice(idx, 1);
      set(() => ({ recvFriendApplicationList: tmpList }));
    } else {
      const tmpList = [...get().sendFriendApplicationList];
      const idx = tmpList.findIndex((a) => a.toUserID === application.toUserID);
      if (idx < 0) {
        return;
      }
      tmpList.splice(idx, 1);
      set(() => ({ sendFriendApplicationList: tmpList }));
    }
  },
  getRecvGroupApplicationListByReq: async () => {
    try {
      const { data } = await IMSDK.getGroupApplicationListAsRecipient();
      set(() => ({ recvGroupApplicationList: data }));
    } catch (error) {
      console.error(error);
    }
  },
  updateRecvGroupApplication: (application: GroupApplicationItem) => {
    let tmpList = [...get().recvGroupApplicationList];
    let unHandleGroupApplicationCount = get().unHandleGroupApplicationCount;
    const idx = tmpList.findIndex((a) => a.userID === application.userID);
    if (idx < 0) {
      tmpList = [...tmpList, application];
      unHandleGroupApplicationCount += 1;
    } else {
      tmpList[idx] = { ...application };
      if (
        application.handleResult !== ApplicationHandleResult.Unprocessed &&
        unHandleGroupApplicationCount > 0
      ) {
        unHandleGroupApplicationCount -= 1;
      }
    }
    set(() => ({ recvGroupApplicationList: tmpList, unHandleGroupApplicationCount }));
  },
  getSendGroupApplicationListByReq: async () => {
    try {
      const { data } = await IMSDK.getGroupApplicationListAsApplicant();
      set(() => ({ sendGroupApplicationList: data }));
    } catch (error) {
      console.error(error);
    }
  },
  updateSendGroupApplication: (application: GroupApplicationItem) => {
    let tmpList = [...get().sendGroupApplicationList];
    const idx = tmpList.findIndex((a) => a.groupID === application.groupID);
    if (idx < 0) {
      tmpList = [...tmpList, application];
    } else {
      tmpList[idx] = { ...application };
    }
    set(() => ({ sendGroupApplicationList: tmpList }));
  },
  deleteGroupApplication: async (application: GroupApplicationItem) => {
    const isRecv = application.userID !== useUserStore.getState().selfInfo.userID;

    await IMSDK.deleteGroupRequests([
      {
        fromUserID: application.userID,
        groupID: application.groupID,
      },
    ]);
    if (isRecv) {
      const tmpList = [...get().recvGroupApplicationList];
      const idx = tmpList.findIndex((a) => a.userID === application.userID);
      if (idx < 0) {
        return;
      }
      tmpList.splice(idx, 1);
      set(() => ({ recvGroupApplicationList: tmpList }));
    } else {
      const tmpList = [...get().sendGroupApplicationList];
      const idx = tmpList.findIndex((a) => a.groupID === application.groupID);
      if (idx < 0) {
        return;
      }
      tmpList.splice(idx, 1);
      set(() => ({ sendGroupApplicationList: tmpList }));
    }
  },
  updateUnHandleFriendApplicationCount: (num: number) => {
    set(() => ({ unHandleFriendApplicationCount: num }));
  },
  updateUnHandleGroupApplicationCount: (num: number) => {
    set(() => ({ unHandleGroupApplicationCount: num }));
  },
  clearContactStore: () => {
    set(() => ({
      friendList: [],
      blackList: [],
      groupList: [],
      recvFriendApplicationList: [],
      sendFriendApplicationList: [],
      recvGroupApplicationList: [],
      sendGroupApplicationList: [],
      unHandleFriendApplicationCount: 0,
      unHandleGroupApplicationCount: 0,
    }));
  },
}));
