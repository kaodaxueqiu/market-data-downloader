import {
  AtTextElem,
  BlackUserItem,
  ConversationGroup,
  ConversationItem,
  FriendApplicationItem,
  FriendUserItem,
  GroupApplicationItem,
  GroupItem,
  GroupMemberItem,
  MessageItem,
} from "@openim/wasm-client-sdk";

import { OrganizationInfo } from "@/api/services/organization";
import { BusinessUserInfo } from "@/api/services/user";
import type { Agent } from "@/api/types/agent";
import { ConversationGroupAllKey } from "@/constants/im";

import { ExMessageItem } from "./message";

export type IMConnectState = "success" | "loading" | "failed";

export interface UserStore {
  syncState: IMConnectState;
  progress: number;
  reinstall: boolean;
  isLogining: boolean;
  connectState: IMConnectState;
  selfInfo: BusinessUserInfo;
  appSettings: AppSettings;
  imageCache: Record<string, string>;
  workMomentsUnreadCount: number;
  organizationInfoList: OrganizationInfo[];
  updateSyncState: (syncing: IMConnectState) => void;
  updateProgressState: (progress: number) => void;
  updateReinstallState: (reinstall: boolean) => void;
  updateIsLogining: (isLogining: boolean) => void;
  updateConnectState: (connectState: IMConnectState) => void;
  updateSelfInfo: (info: Partial<BusinessUserInfo>) => void;
  getSelfInfoByReq: () => Promise<void>;
  refreshOrganizationList: () => Promise<void>;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  userLogout: (force?: boolean) => Promise<void>;
  getWorkMomentsUnreadCount: () => Promise<void>;
  updateWorkMomentsUnreadCount: (count?: number) => void;
  preloadState: "idle" | "loading" | "done";
  preloadProgress: string;
  updatePreloadState: (state: "idle" | "loading" | "done") => void;
  updatePreloadProgress: (progress: string) => void;
  initImageCache: () => void;
  addImageCache: (url: string, path: string) => void;
  clearImageCache: () => void;
}

export interface AppSettings {
  locale: LocaleString;
  closeAction: "miniSize" | "quit";
}

export type LocaleString = "zh-CN" | "en-US";

export type RevokeMessageData = {
  quoteMessage?: MessageItem;
  text: string;
  atEl?: AtTextElem;
};

export type ConversationGroupPagination = {
  pageNumber: number;
  showNumber: number;
  total: number;
  hasMore: boolean;
};

export interface ConversationStore {
  conversationIniting: boolean;
  conversationGroups: ConversationGroup[];
  customConversationGroups: ConversationGroup[];
  activeConversationGroup: ConversationGroup | typeof ConversationGroupAllKey;
  activeGroupPagination: ConversationGroupPagination;
  conversationList: ConversationItem[];
  displayConversationList: ConversationItem[];
  conversationListRefreshId: number;
  pinnedMessages: MessageItem[];
  currentConversation?: ConversationItem;
  unReadCount: number;
  currentGroupInfo?: GroupItem;
  currentMemberInGroup?: GroupMemberItem;
  quoteMessage?: MessageItem;
  revokeMap: Record<string, RevokeMessageData>;
  fileMap: Record<string, FileWithPath>;
  getConversationListByReq: (
    isOffset?: boolean,
    forceLoading?: boolean,
  ) => Promise<boolean>;
  setActiveConversationGroup: (convGroupID: string) => Promise<void>;
  updateConversationList: (list: ConversationItem[]) => void;
  pushConversationList: (list: ConversationItem[]) => void;
  pushDisplayConversationList: (list: ConversationItem[], convGroupID: string) => void;
  removeConversationFromDisplayList: (
    conversationID: string,
    convGroupID: string,
  ) => void;
  getActiveConversationGroupID: () => string;
  updateConversationGroups: (convGroups: ConversationGroup[]) => void;
  updateActiveConversationGroup: (
    group: ConversationGroup | typeof ConversationGroupAllKey,
  ) => void;
  removeConversationGroups: (convGroupIDs: string[]) => void;
  getConversationGroupsByReq: () => Promise<void>;
  delConversationByCID: (conversationID: string) => void;
  getPinnedMessages: (conversationID: string, toggleId?: number) => void;
  setPinnedMessages: (messages: MessageItem[]) => void;
  addPinnedMessage: (conversationID: string, message: MessageItem) => Promise<void>;
  removePinnedMessage: (message: MessageItem) => Promise<void>;
  clearPinnedMessages: () => void;
  // getCurrentConversationByReq: (conversationID?: string) => Promise<void>;
  updateCurrentConversation: (
    conversation?: ConversationItem,
    isJump?: boolean,
  ) => Promise<void>;
  updateCurrentConversationFields: (fields: Partial<ConversationItem>) => void;
  getUnReadCountByReq: () => Promise<number>;
  updateUnReadCount: (count: number) => void;
  getCurrentGroupInfoByReq: (groupID: string, toggleId?: number) => Promise<void>;
  updateCurrentGroupInfo: (groupInfo: GroupItem) => void;
  getCurrentMemberInGroupByReq: (groupID: string) => Promise<void>;
  setCurrentMemberInGroup: (memberInfo?: GroupMemberItem) => void;
  tryUpdateCurrentMemberInGroup: (member: GroupMemberItem) => void;
  updateQuoteMessage: (message?: MessageItem) => void;
  addRevokedMessage: (message: MessageItem, quoteMessage?: MessageItem) => void;
  clearConversationStore: () => void;
  addFile: (file: FileWithPath) => void;
  deleteFile: (uuid: string) => void;
  clearFileMap: () => void;
}

export type PreviewGroupItem = {
  url: string;
  thumbUrl?: string;
  videoUrl?: string;
  clientMsgID: string;
};

export type DownloadState =
  | "downloading"
  | "pause"
  | "resume"
  | "common.text.cancel"
  | "finish";

export type SaveType = "avatar" | "image" | "video" | "file" | "voice" | "sentFile";

export type DownloadData = {
  clientMsgID?: string;
  workMomentID?: string;
  conversationID?: string;
  downloadState?: DownloadState;
  progress?: number;
  originUrl?: string;
  downloadUrl?: string;
  isMediaMessage?: boolean;
  cacheKey?: string;
  showError?: boolean;
  saveType?: SaveType;
  randomName?: boolean;
};

export interface GetMessageReverseParams {
  message: ExMessageItem;
  conversationID: string;
}

export type FallBackState = "normal" | "scrollToEnd" | "jumpToEnd";

export interface MessageStore {
  previewImgList: PreviewGroupItem[];
  jumpClientMsgID?: string;
  isCheckMode: boolean;
  voiceToTextLoadingIds: string[];
  downloadMap: Record<string, DownloadData>;
  downloadCache: Record<string, string>;
  initDownloadCache: () => void;
  setDownloadCache: (downloadId: string, path: string) => void;
  updateMessagePreview: (clientMsgID: string, path: string, isVideo?: boolean) => void;
  clearPreviewList: () => void;
  updateCheckMode: (isCheckMode: boolean) => void;
  updateJumpClientMsgID: (clientMsgID?: string) => void;
  getConversationPreviewImgList: () => Promise<void>;
  tryAddPreviewImg: (messageList: ExMessageItem[]) => void;
  addDownloadTask: (downloadId: string, data: DownloadData) => void;
  updateDownloadTask: (downloadId: string, data: DownloadData) => void;
  removeDownloadTask: (downloadId: string) => void;
  addVoiceToTextLoading: (clientMsgID: string) => void;
  removeVoiceToTextLoading: (clientMsgID: string) => void;
}

export interface ContactStore {
  friendList: FriendUserItem[];
  blackList: BlackUserItem[];
  groupList: GroupItem[];
  agents: Agent[];
  recvFriendApplicationList: FriendApplicationItem[];
  sendFriendApplicationList: FriendApplicationItem[];
  recvGroupApplicationList: GroupApplicationItem[];
  sendGroupApplicationList: GroupApplicationItem[];
  unHandleFriendApplicationCount: number;
  unHandleGroupApplicationCount: number;
  getFriendListByReq: () => Promise<void>;
  setFriendList: (list: FriendUserItem[]) => void;
  updateFriend: (friend: FriendUserItem, remove?: boolean) => void;
  pushNewFriend: (friend: FriendUserItem) => void;
  getBlackListByReq: () => Promise<void>;
  updateBlack: (black: BlackUserItem, remove?: boolean) => void;
  pushNewBlack: (black: BlackUserItem) => void;
  getGroupListByReq: () => Promise<void>;
  setGroupList: (list: GroupItem[]) => void;
  updateGroup: (group: GroupItem, remove?: boolean) => void;
  pushNewGroup: (group: GroupItem) => void;
  getAgentsListByReq: () => Promise<void>;
  getRecvFriendApplicationListByReq: () => Promise<void>;
  updateRecvFriendApplication: (application: FriendApplicationItem) => void;
  getSendFriendApplicationListByReq: () => Promise<void>;
  updateSendFriendApplication: (application: FriendApplicationItem) => void;
  deleteFriendApplication: (application: FriendApplicationItem) => Promise<void>;
  getRecvGroupApplicationListByReq: () => Promise<void>;
  updateRecvGroupApplication: (application: GroupApplicationItem) => void;
  getSendGroupApplicationListByReq: () => Promise<void>;
  updateSendGroupApplication: (application: GroupApplicationItem) => void;
  deleteGroupApplication: (application: GroupApplicationItem) => Promise<void>;
  updateUnHandleFriendApplicationCount: (num: number) => void;
  updateUnHandleGroupApplicationCount: (num: number) => void;
  clearContactStore: () => void;
}
