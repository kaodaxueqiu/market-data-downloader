import {
  type FriendUserItem,
  type GroupItem,
  MessageItem,
  MessageType,
  type SearchMessageResultItem,
  SessionType,
} from "@openim/wasm-client-sdk";
import { useQuery } from "@tanstack/react-query";

import { IMSDK } from "@/layout/MainContentWrap";

import { getSubDepartmentAndMember } from "../services/organization";
import { type BusinessUserInfo, searchOrganizationUserInfo } from "../services/user";

export type HistoryFileMessage = MessageItem & { conversationID: string };

const normalizeKeyword = (keyword: string) => keyword.trim();

const isEnabled = (keyword: string, enabled: boolean) =>
  enabled && Boolean(normalizeKeyword(keyword));

const SEARCH_STALE_TIME = 30 * 1000;
const SEARCH_GC_TIME = 5 * 60 * 1000;

export const globalSearchKeys = {
  friends: (keyword: string) => ["globalSearch", "friends", keyword] as const,
  colleagues: (keyword: string) => ["globalSearch", "colleagues", keyword] as const,
  groups: (keyword: string) => ["globalSearch", "groups", keyword] as const,
  chatLogs: (keyword: string) => ["globalSearch", "chatLogs", keyword] as const,
  historyFiles: (keyword: string) => ["globalSearch", "historyFiles", keyword] as const,
};

export const chooseKeys = {
  orgTree: (departmentID: string, organizationID?: string) =>
    ["choose", "orgTree", organizationID ?? "", departmentID] as const,
  orgSearch: (keyword: string) => ["choose", "orgSearch", keyword] as const,
};

export const useSearchFriends = (keyword: string, enabled = true) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: globalSearchKeys.friends(trimmedKeyword),
    queryFn: async (): Promise<FriendUserItem[]> => {
      const { data } = await IMSDK.searchFriends({
        keywordList: [trimmedKeyword],
        isSearchNickname: true,
        isSearchRemark: true,
        isSearchUserID: true,
      });
      return data ?? [];
    },
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useSearchColleagues = (keyword: string, enabled = true) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: globalSearchKeys.colleagues(trimmedKeyword),
    queryFn: async (): Promise<BusinessUserInfo[]> => {
      const {
        data: { users },
      } = await searchOrganizationUserInfo(trimmedKeyword, 1, 200);
      return users ?? [];
    },
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useSearchGroups = (keyword: string, enabled = true) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: globalSearchKeys.groups(trimmedKeyword),
    queryFn: async (): Promise<GroupItem[]> => {
      const { data } = await IMSDK.searchGroups({
        keywordList: [trimmedKeyword],
        isSearchGroupID: true,
        isSearchGroupName: true,
      });
      return data ?? [];
    },
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useSearchChatLogs = (keyword: string, enabled = true) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: globalSearchKeys.chatLogs(trimmedKeyword),
    queryFn: async (): Promise<SearchMessageResultItem[]> => {
      const { data } = await IMSDK.searchLocalMessages({
        conversationID: "",
        keywordList: [trimmedKeyword],
        messageTypeList: [
          MessageType.TextMessage,
          MessageType.AtTextMessage,
          MessageType.FileMessage,
          MessageType.QuoteMessage,
          MessageType.CardMessage,
          MessageType.LocationMessage,
          MessageType.MergeMessage,
        ],
      });
      return data.searchResultItems ?? [];
    },
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useSearchHistoryFiles = (keyword: string, enabled = true) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: globalSearchKeys.historyFiles(trimmedKeyword),
    queryFn: async (): Promise<HistoryFileMessage[]> => {
      const { data } = await IMSDK.searchLocalMessages({
        conversationID: "",
        keywordList: [trimmedKeyword],
        messageTypeList: [MessageType.FileMessage],
      });
      const results = data.searchResultItems ?? [];
      return results.flatMap((result) =>
        (result.messageList ?? []).map((message) => ({
          ...message,
          senderNickname:
            result.conversationType === SessionType.WorkingGroup
              ? result.showName
              : message.senderNickname,
          conversationID: result.conversationID,
        })),
      );
    },
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useOrganizationTree = (departmentID: string, enabled: boolean, organizationID?: string) => {
  return useQuery({
    queryKey: chooseKeys.orgTree(departmentID, organizationID),
    queryFn: () => getSubDepartmentAndMember(departmentID, organizationID),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};

export const useOrganizationSearch = (keyword: string, enabled: boolean) => {
  const trimmedKeyword = normalizeKeyword(keyword);
  return useQuery({
    queryKey: chooseKeys.orgSearch(trimmedKeyword),
    queryFn: () => searchOrganizationUserInfo(trimmedKeyword, 1, 200),
    enabled: isEnabled(trimmedKeyword, enabled),
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
    retry: 0,
  });
};
