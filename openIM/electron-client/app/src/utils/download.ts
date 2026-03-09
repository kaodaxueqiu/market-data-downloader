import { MessageType } from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { v4 as uuidv4 } from "uuid";

import { message } from "@/AntdGlobalComp";
import { ExMessageItem, useMessageStore } from "@/store";
import { DownloadData, SaveType } from "@/store/type";
import { broadcastMessageStore } from "@/utils/window/broadcast";

export const downloadFile = async (originUrl: string, data: DownloadData) => {
  if (window.electronAPI) {
    try {
      const downloadId = data.clientMsgID ?? data.workMomentID ?? originUrl;
      const existingTask = useMessageStore.getState().downloadMap[downloadId];
      const activeStates = new Set(["downloading", "resume", "pause"]);
      if (existingTask && activeStates.has(existingTask.downloadState ?? "")) {
        console.debug("[downloadFile] skip active task", {
          downloadId,
          originUrl,
          state: existingTask.downloadState,
        });
        return;
      }

      window.electronAPI.startDownload({
        url: originUrl,
        downloadId,
        saveType: (data.saveType ?? "file") as SaveType,
        randomPrefix: data.randomName ? uuidv4() : undefined,
      });
      useMessageStore.getState().addDownloadTask(downloadId, {
        ...data,
        originUrl,
        downloadUrl: downloadId,
        downloadState: "downloading",
      });
      if (window.electronAPI?.enableCLib) {
        broadcastMessageStore("addDownloadTask", [
          downloadId,
          {
            ...data,
            originUrl,
            downloadUrl: downloadId,
            downloadState: "downloading",
          },
        ]);
      }
    } catch (error) {
      if (data.showError) message.error(t("system.toast.downloadFailed"));
    }
    return;
  }
  const linkNode = document.createElement("a");
  linkNode.style.display = "none";
  const idx = originUrl.lastIndexOf("/");
  linkNode.download = originUrl.slice(idx + 1);
  linkNode.href = originUrl;
  document.body.appendChild(linkNode);
  linkNode.click();
  document.body.removeChild(linkNode);
};

export const getDownloadTask = ({
  downloadMap,
  compareKey,
  compareValue,
}: {
  downloadMap: Record<string, DownloadData>;
  compareKey: keyof DownloadData;
  compareValue: unknown;
}) => {
  for (const key in downloadMap) {
    if (downloadMap[key][compareKey] === compareValue) {
      return downloadMap[key];
    }
  }
  return null;
};

export const getDownloadCachePath = (downloadId?: string) => {
  if (!downloadId || !window.electronAPI) return undefined;
  const cached = useMessageStore.getState().downloadCache[downloadId];
  if (cached && window.electronAPI.fileExists(cached)) {
    return cached;
  }
  return undefined;
};

export const getMessageCachePath = (message: ExMessageItem) => {
  return getDownloadCachePath(message.clientMsgID);
};

export const findExistingPath = (paths: Array<string | undefined>) => {
  if (!window.electronAPI) return undefined;
  return paths.find((item) => item && window.electronAPI!.fileExists(item));
};

export const resolveMessageLocalPath = (message: ExMessageItem) => {
  const cachedPath = getMessageCachePath(message);
  if (cachedPath) return cachedPath;
  return findExistingPath([
    message.fileElem?.filePath,
    message.pictureElem?.sourcePath,
    message.videoElem?.videoPath,
    message.soundElem?.soundPath,
  ]);
};

const getSaveTypeFromMessage = (message: ExMessageItem): SaveType => {
  switch (message.contentType) {
    case MessageType.PictureMessage:
      return "image";
    case MessageType.VideoMessage:
      return "video";
    case MessageType.VoiceMessage:
      return "voice";
    case MessageType.OANotification:
      return "video";
    case MessageType.FileMessage:
    default:
      return "file";
  }
};

const isMessageMedia = (message: ExMessageItem) =>
  message.contentType === MessageType.PictureMessage ||
  message.contentType === MessageType.VideoMessage;

export const buildMessageDownloadData = ({
  message,
  clientMsgID,
  conversationID,
  saveType,
  isMediaMessage,
  showError = true,
}: {
  message?: ExMessageItem;
  clientMsgID?: string;
  conversationID?: string;
  saveType?: SaveType;
  isMediaMessage?: boolean;
  showError?: boolean;
}): DownloadData => {
  const resolvedClientMsgID = clientMsgID ?? message?.clientMsgID;
  const resolvedSaveType =
    saveType ?? (message ? getSaveTypeFromMessage(message) : "file");
  const resolvedIsMedia =
    isMediaMessage ?? (message ? isMessageMedia(message) : undefined);

  const data: DownloadData = {
    conversationID,
    saveType: resolvedSaveType,
    isMediaMessage: resolvedIsMedia,
    showError,
  };
  if (resolvedClientMsgID) {
    data.clientMsgID = resolvedClientMsgID;
  }
  return data;
};

export const buildMomentDownloadData = ({
  workMomentID,
  saveType,
  showError = true,
  cacheKey,
}: {
  workMomentID: string;
  saveType: SaveType;
  showError?: boolean;
  cacheKey?: string;
}): DownloadData => ({
  workMomentID,
  saveType,
  showError,
  cacheKey,
});

export const buildImageCacheDownloadData = ({
  url,
  saveType = "image",
  randomName = false,
}: {
  url: string;
  saveType?: SaveType;
  randomName?: boolean;
}): DownloadData => ({
  saveType,
  randomName,
  cacheKey: url,
});
