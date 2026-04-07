import { MessageItem, MessageStatus, MessageType } from "@openim/wasm-client-sdk";
import { create } from "zustand";

import { IMSDK } from "@/layout/MainContentWrap";
import {
  clearMessageState,
} from "@/pages/chat/queryChat/useHistoryMessageList";
import { getCacheRecordSync, mergeCacheRecord } from "@/utils/cache/cacheStore";

import { useConversationStore } from "./conversation";
import { DownloadData, MessageStore } from "./type";
import { useUserStore } from "./user";

export interface ExType {
  checked?: boolean;
  isAppend?: boolean;
  gapTime?: boolean;
  jump?: boolean;
  errCode?: number;
}

export type ExMessageItem = MessageItem & ExType;

export const useMessageStore = create<MessageStore>()((set, get) => ({
  previewImgList: [],
  isCheckMode: false,
  jumpClientMsgID: undefined,
  voiceToTextLoadingIds: [],
  downloadMap: {},
  downloadCache: {},
  initDownloadCache: () => {
    const cache = getCacheRecordSync("download_cache_record");
    set(() => ({ downloadCache: cache }));
  },
  setDownloadCache: (downloadId: string, path: string) => {
    const newCache = mergeCacheRecord(
      "download_cache_record",
      { [downloadId]: path },
      get().downloadCache,
    );
    set({ downloadCache: newCache });
  },
  updateMessagePreview: (clientMsgID: string, path: string, isVideo?: boolean) => {
    const tmpPreviewList = [...get().previewImgList];
    const previewIdx = tmpPreviewList.findIndex(
      (item) => item.clientMsgID === clientMsgID,
    );
    if (previewIdx > -1) {
      const field = isVideo
        ? "videoUrl"
        : tmpPreviewList[previewIdx].videoUrl
          ? "videoUrl"
          : "url";
      tmpPreviewList[previewIdx][field] = `file://${path}`;
      set(() => ({ previewImgList: tmpPreviewList }));
    }
  },
  clearPreviewList: () => {
    set(() => ({ previewImgList: [], hasMore: false }));
  },
  updateCheckMode: (isCheckMode: boolean) => {
    if (!isCheckMode) {
      clearMessageState("checked");
    }
    set(() => ({ isCheckMode }));
  },
  updateJumpClientMsgID: (clientMsgID?: string) => {
    set(() => ({ jumpClientMsgID: clientMsgID }));
  },
  addVoiceToTextLoading: (clientMsgID: string) => {
    const { voiceToTextLoadingIds } = get();
    if (voiceToTextLoadingIds.includes(clientMsgID)) return;
    set(() => ({
      voiceToTextLoadingIds: [...voiceToTextLoadingIds, clientMsgID],
    }));
  },
  removeVoiceToTextLoading: (clientMsgID: string) => {
    const { voiceToTextLoadingIds } = get();
    if (!voiceToTextLoadingIds.includes(clientMsgID)) return;
    set(() => ({
      voiceToTextLoadingIds: voiceToTextLoadingIds.filter((id) => id !== clientMsgID),
    }));
  },
  getConversationPreviewImgList: async () => {
    const conversationID =
      useConversationStore.getState().currentConversation?.conversationID;

    if (!conversationID) return;
    const {
      data: { searchResultItems },
    } = await IMSDK.searchLocalMessages({
      conversationID,
      keywordList: [],
      keywordListMatchType: 0,
      senderUserIDList: [],
      messageTypeList: [MessageType.PictureMessage, MessageType.VideoMessage],
      searchTimePosition: 0,
      searchTimePeriod: 0,
      pageIndex: 1,
      count: 200,
    });
    if (!searchResultItems?.[0].messageCount) return;
    console.log(searchResultItems[0].messageList);
    const newPreviewImgList = searchResultItems[0].messageList.map((item) => ({
      url: getImageMessageSourceUrl(item) ?? "",
      clientMsgID: item.clientMsgID,
      videoUrl: getVideoMessageSourceUrl(item),
      thumbUrl: item.pictureElem?.snapshotPicture?.url ?? "",
    }));
    set(() => ({ previewImgList: [...newPreviewImgList] }));
  },
  tryAddPreviewImg: (mesageList: ExMessageItem[]) => {
    const previews = mesageList
      .filter((message) => MediaMessageTypes.includes(message.contentType))
      .map((message) => ({
        url: getImageMessageSourceUrl(message) ?? "",
        clientMsgID: message.clientMsgID,
        videoUrl: getVideoMessageSourceUrl(message),
        thumbUrl: message.pictureElem?.snapshotPicture.url ?? "",
      }));
    if (previews.length === 0) return;
    set((state) => ({
      previewImgList: [...previews, ...state.previewImgList],
    }));
  },
  addDownloadTask: (downloadId: string, data: DownloadData) => {
    set((state) => ({
      downloadMap: { ...state.downloadMap, [downloadId]: { ...data } },
    }));
  },
  updateDownloadTask: (downloadId: string, data: DownloadData) => {
    const tmpMap = { ...get().downloadMap };
    tmpMap[downloadId] = {
      ...tmpMap[downloadId],
      ...data,
    };
    set(() => ({ downloadMap: tmpMap }));
  },
  removeDownloadTask: (downloadId: string) => {
    const tmpMap = { ...get().downloadMap };
    if (!tmpMap[downloadId]) return;
    delete tmpMap[downloadId];
    set(() => ({ downloadMap: tmpMap }));
  },
}));

const MediaMessageTypes = [MessageType.PictureMessage, MessageType.VideoMessage];

export const getImageMessageSourceUrl = (message: ExMessageItem) => {
  const cachedPath = useMessageStore.getState().downloadCache[message.clientMsgID];
  if (cachedPath && window.electronAPI?.fileExists(cachedPath)) {
    return `file://${cachedPath}`;
  }
  if (message.contentType === MessageType.VideoMessage) {
    const snapshotPath = message.videoElem!.snapshotPath;
    if (snapshotPath && window.electronAPI?.fileExists(snapshotPath)) {
      return `file://${snapshotPath}`;
    }
    const snapshotUrl = message.videoElem!.snapshotUrl;
    const cachePath = useUserStore.getState().imageCache[snapshotUrl];
    if (cachePath && window.electronAPI?.fileExists(cachePath)) {
      return `file://${cachePath}`;
    }
    return snapshotUrl;
  }

  if (window.electronAPI?.fileExists(message.pictureElem!.sourcePath)) {
    return `file://${message.pictureElem!.sourcePath}`;
  }
  return message.pictureElem!.sourcePicture.url;
};

export const getVideoMessageSourceUrl = (message: ExMessageItem) => {
  if (message.contentType !== MessageType.VideoMessage) return undefined;
  const cachedPath = useMessageStore.getState().downloadCache[message.clientMsgID];
  if (cachedPath && window.electronAPI?.fileExists(cachedPath)) {
    return `file://${cachedPath}`;
  }
  if (window.electronAPI?.fileExists(message.videoElem!.videoPath)) {
    return `file://${message.videoElem!.videoPath}`;
  }
  return message.videoElem!.videoUrl;
};
