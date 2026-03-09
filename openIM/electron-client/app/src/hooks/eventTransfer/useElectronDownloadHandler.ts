import { t } from "i18next";
import { useEffect } from "react";

import { message as antdMessage } from "@/AntdGlobalComp";
import { useMessageStore, useUserStore } from "@/store";
import { broadcastMessageStore } from "@/utils/window/broadcast";

export const useElectronDownloadHandler = () => {
  const {
    updateDownloadTask,
    removeDownloadTask,
    updateMessagePreview,
    setDownloadCache,
  } = useMessageStore.getState();
  const { addImageCache } = useUserStore.getState();

  useEffect(() => {
    const downloadProgressHandler = (downloadId: string, progress: number) => {
      const task = useMessageStore.getState().downloadMap[downloadId];
      if (!task) {
        console.warn(
          "[DownloadHandler] progress with unknown task",
          downloadId,
          progress,
        );
        return;
      }
      updateDownloadTask(downloadId, {
        ...task,
        downloadUrl: downloadId,
        progress,
        downloadState: task.downloadState ?? "downloading",
      });
    };
    const downloadSuccessHandler = (downloadId: string, savePath: string) => {
      const task = useMessageStore.getState().downloadMap[downloadId];
      if (!task) {
        console.warn(
          "[DownloadHandler] success with unknown task",
          downloadId,
          savePath,
        );
        return;
      }
      console.debug("[DownloadHandler] success", downloadId, savePath, task);
      const { clientMsgID, cacheKey, isMediaMessage } = task;
      if (cacheKey) {
        addImageCache(cacheKey, savePath);
      } else {
        setDownloadCache(downloadId, savePath);
        broadcastMessageStore("setDownloadCache", [downloadId, savePath]);
      }

      updateDownloadTask(downloadId, {
        progress: 0,
        downloadState: "finish",
      });
      broadcastMessageStore("updateDownloadTask", [
        downloadId,
        {
          ...task,
          downloadUrl: downloadId,
          progress: 0,
          downloadState: "finish",
        },
      ]);

      setTimeout(() => removeDownloadTask(downloadId), 2000);
      setTimeout(() => broadcastMessageStore("removeDownloadTask", [downloadId]), 2000);
      if (clientMsgID && isMediaMessage) {
        updateMessagePreview(clientMsgID, savePath);
        broadcastMessageStore("updateMessagePreview", [clientMsgID, savePath]);
      }
    };
    const downloadCancelHandler = (downloadId: string) => {
      const task = useMessageStore.getState().downloadMap[downloadId];
      if (!task) {
        console.warn("[DownloadHandler] cancel with unknown task", downloadId);
        return;
      }
      removeDownloadTask(downloadId);
      broadcastMessageStore("removeDownloadTask", [downloadId]);
    };
    const downloadFailedHandler = (downloadId: string) => {
      const task = useMessageStore.getState().downloadMap[downloadId];
      if (!task) {
        console.warn("[DownloadHandler] failed with unknown task", downloadId);
        return;
      }
      removeDownloadTask(downloadId);
      broadcastMessageStore("removeDownloadTask", [downloadId]);
      if (task.showError) antdMessage.error(t("system.toast.downloadFailed"));
    };
    const unsubscribeProgress = window.electronAPI?.onDownloadProgress(
      downloadProgressHandler,
    );
    const unsubscribeSuccess =
      window.electronAPI?.onDownloadSuccess(downloadSuccessHandler);
    const unsubscribeCancel =
      window.electronAPI?.onDownloadCancel(downloadCancelHandler);
    const unsubscribeFailed =
      window.electronAPI?.onDownloadFailed(downloadFailedHandler);
    return () => {
      unsubscribeProgress?.();
      unsubscribeSuccess?.();
      unsubscribeCancel?.();
      unsubscribeFailed?.();
    };
  }, []);
};
