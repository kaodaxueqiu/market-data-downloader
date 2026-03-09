import { MessageType } from "@openim/wasm-client-sdk";
import { useLatest, useMount } from "ahooks";
import { useCallback, useEffect, useState } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { SystemNotificationElem } from "@/pages/chat/queryChat/SystemNotification";
import { ExMessageItem, useMessageStore } from "@/store";
import { SaveType } from "@/store/type";
import {
  buildMessageDownloadData,
  downloadFile,
  getDownloadTask,
  resolveMessageLocalPath,
} from "@/utils/download";
import { getConversationIDByMsg } from "@/utils/imCommon";

export const getSourceData = (message: ExMessageItem) => {
  if (message.contentType === MessageType.PictureMessage) {
    return {
      url: message.pictureElem!.sourcePicture.url,
      path: message.pictureElem!.sourcePath,
      saveType: "image" as SaveType,
    };
  }
  if (message.contentType === MessageType.VideoMessage) {
    return {
      url: message.videoElem!.videoUrl,
      path: message.videoElem!.videoPath,
      saveType: "video" as SaveType,
    };
  }
  if (message.contentType === MessageType.VoiceMessage) {
    return {
      url: message.soundElem!.sourceUrl,
      path: message.soundElem!.soundPath,
      saveType: "voice" as SaveType,
    };
  }
  if (message.contentType === MessageType.OANotification) {
    const notificationEl: SystemNotificationElem = JSON.parse(
      message.notificationElem!.detail,
    );
    return {
      url: notificationEl.videoElem?.videoUrl ?? "",
      path: notificationEl.videoElem?.videoPath ?? "",
      saveType: "video" as SaveType,
    };
  }
  return {
    url: message.fileElem!.sourceUrl,
    path: message.fileElem!.filePath,
    saveType: "file" as SaveType,
  };
};

export function useMessageFileDownloadState(
  message: ExMessageItem,
  customCallback?: (path: string) => void,
) {
  const [previewPath, setPreviewPath] = useState<string>();
  const latestPreviewPath = useLatest(previewPath);

  const updateDownloadTask = useMessageStore((state) => state.updateDownloadTask);
  const currentTask = useMessageStore((state) =>
    getDownloadTask({
      downloadMap: state.downloadMap,
      compareKey: "clientMsgID",
      compareValue: message.clientMsgID,
    }),
  );
  const latestCurrentTask = useLatest(currentTask);
  const latestMessage = useLatest(message);
  const downloadId = latestMessage.current.clientMsgID;

  const setExistingPath = useCallback((msg: ExMessageItem) => {
    setPreviewPath(resolveMessageLocalPath(msg));
  }, []);

  const checkIsDownload = useCallback(async () => {
    const conversationID = getConversationIDByMsg(latestMessage.current);
    if (resolveMessageLocalPath(latestMessage.current)) {
      setExistingPath(latestMessage.current);
      return;
    }
    if (!conversationID || !window.electronAPI) {
      setExistingPath(latestMessage.current);
      return;
    }

    try {
      const { data } = await IMSDK.findMessageList([
        {
          conversationID,
          clientMsgIDList: [latestMessage.current.clientMsgID],
        },
      ]);
      const refreshedMessage =
        data.findResultItems?.[0]?.messageList?.[0] ?? latestMessage.current;
      setExistingPath(refreshedMessage as ExMessageItem);
    } catch {
      setExistingPath(latestMessage.current);
    }
  }, [setExistingPath]);

  useMount(() => {
    checkIsDownload();
  });

  useEffect(() => {
    if (currentTask?.downloadState === "finish") {
      checkIsDownload();
    }
  }, [checkIsDownload, currentTask?.downloadState]);

  const executeDownload = useCallback(() => {
    const { url, saveType } = getSourceData(latestMessage.current);
    const conversationID = getConversationIDByMsg(latestMessage.current);
    downloadFile(
      url,
      buildMessageDownloadData({
        message: latestMessage.current,
        conversationID,
        saveType,
      }),
    );
  }, [message.contentType]);

  const tryDownload = useCallback(() => {
    if (latestPreviewPath.current) {
      const confirmCheckIsDownload = window.electronAPI?.fileExists(
        latestPreviewPath.current,
      );
      if (!confirmCheckIsDownload) {
        setPreviewPath(undefined);
        executeDownload();
        return;
      }
      const callback = customCallback ?? window.electronAPI?.openFile;
      callback?.(latestPreviewPath.current);
      return;
    }

    if (
      latestCurrentTask.current?.downloadState === "downloading" ||
      latestCurrentTask.current?.downloadState === "resume"
    ) {
      const taskId = latestCurrentTask.current.downloadUrl ?? downloadId;
      window.electronAPI?.pauseDownload(taskId);
      updateDownloadTask(taskId, {
        downloadState: "pause",
      });
      return;
    }

    if (latestCurrentTask.current?.downloadState === "pause") {
      const taskId = latestCurrentTask.current.downloadUrl ?? downloadId;
      window.electronAPI?.resumeDownload(taskId);
      updateDownloadTask(taskId, {
        downloadState: "downloading",
      });
      return;
    }

    if (!latestCurrentTask.current) {
      executeDownload();
    }
  }, [
    customCallback,
    downloadId,
    executeDownload,
    latestCurrentTask,
    latestPreviewPath,
    updateDownloadTask,
  ]);

  return {
    progress: currentTask?.progress ?? 0,
    downloadState: previewPath
      ? "finish"
      : (currentTask?.downloadState ?? "common.text.cancel"),
    tryDownload,
    checkIsDownload,
  };
}
