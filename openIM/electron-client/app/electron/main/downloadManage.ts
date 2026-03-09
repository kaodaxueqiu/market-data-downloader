import path from "path";

import { IpcMainToRender } from "../constants";
import { removeFileAndEmptyDir } from "../utils/fs";
import { cacheManager, CacheBucket } from "./cacheManage";
import { getScopedLogger } from "../utils/log";

const downloadLogger = getScopedLogger("DownloadManager");

type DownloadPayload = {
  url: string;
  downloadId?: string;
  saveType?: CacheBucket;
  fileName?: string;
  randomPrefix?: string;
  randomName?: boolean;
  uniqueName?: boolean;
  isUpdate?: boolean;
};

type ResolvedDownloadMeta = {
  url: string;
  rawUrl?: string;
  downloadId: string;
  saveType: CacheBucket;
  fileName?: string;
  randomPrefix?: string;
  uniqueName: boolean;
  isUpdate: boolean;
};

const DEFAULT_BUCKET: CacheBucket = "file";

const canonicalUrl = (url: string) => {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
};

class DownloadManager {
  private downloadItems = new Map<string, Electron.DownloadItem>();
  private pausedItems = new Set<string>();
  private pendingTasks = new Map<string, ResolvedDownloadMeta[]>();

  registerSession = (
    webContents: Electron.WebContents,
    hooks?: { setProgress?: (progress: number) => void },
  ) => {
    const webContentsSend = (channel: string, ...args: any[]) => {
      if (webContents.isDestroyed()) return;
      webContents.send(channel, ...args);
    };

    const handleWillDownload = (_: Electron.Event, item: Electron.DownloadItem) => {
      const realUrl = this.getRealUrl(item);
      const urlKey = canonicalUrl(realUrl);
      const pendingMeta = this.consumePendingMeta(urlKey);
      const meta = pendingMeta ?? this.normalizePayload(realUrl);
      const downloadId = meta.downloadId;

      this.downloadItems.set(downloadId, item);

      const savePath = this.resolveSavePath(item, meta);
      downloadLogger.debug("will-download", {
        realUrl,
        urlKey,
        downloadId,
        savePath,
        fileName: item.getFilename(),
        meta,
        fromPending: Boolean(pendingMeta),
      });
      item.setSavePath(savePath);

      item.on("updated", (_, state) => {
        if (state === "interrupted" && !this.pausedItems.has(downloadId)) {
          downloadLogger.debug("download interrupted", { downloadId, realUrl, state });
          webContentsSend(
            this.getChannel(meta, "failed"),
            downloadId,
            item.getSavePath(),
          );
          if (meta.isUpdate) hooks?.setProgress?.(-1);
          return;
        }

        if (state === "progressing" && !item.isPaused()) {
          const receivedBytes = item.getReceivedBytes();
          const totalBytes = item.getTotalBytes();
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          webContentsSend(this.getChannel(meta, "progress"), downloadId, progress);
          if (meta.isUpdate) hooks?.setProgress?.(progress);
        }
      });

      item.once("done", (_, state) => {
        const doneUrlKey = canonicalUrl(realUrl);
        downloadLogger.debug("download done", {
          downloadId,
          realUrl,
          urlKey: doneUrlKey,
          state,
          savePath: item.getSavePath(),
        });
        if (state === "completed") {
          webContentsSend(
            this.getChannel(meta, "success"),
            downloadId,
            item.getSavePath(),
          );
          if (meta.isUpdate) {
            global.pathConfig.hotUpdateAssetPath = item.getSavePath();
          }
        } else if (state === "cancelled") {
          webContentsSend(this.getChannel(meta, "cancel"), downloadId);
          removeFileAndEmptyDir(item.getSavePath());
        } else {
          webContentsSend(
            this.getChannel(meta, "failed"),
            downloadId,
            item.getSavePath(),
          );
          removeFileAndEmptyDir(item.getSavePath());
        }

        if (meta.isUpdate) hooks?.setProgress?.(-1);
        this.cleanupDownload(downloadId);
      });
    };

    webContents.session.on("will-download", handleWillDownload);

    return () => {
      webContents.session.removeListener("will-download", handleWillDownload);
      Array.from(this.downloadItems.entries()).forEach(([downloadId, item]) => {
        item.cancel();
        removeFileAndEmptyDir(item.getSavePath());
        this.cleanupDownload(downloadId);
      });
    };
  }

  startDownload = (ev: Electron.IpcMainInvokeEvent, payload: string | DownloadPayload) => {
    let meta: ResolvedDownloadMeta;
    try {
      meta = this.normalizePayload(payload);
    } catch (error) {
      downloadLogger.error("startDownload invalid payload", { payload, error });
      const fallback = this.buildFailureMeta(payload);
      if (fallback) {
        this.notifyDownloadFailure(ev.sender, fallback, error);
      }
      return;
    }

    if (!this.isSupportedDownloadUrl(meta.url)) {
      const error = new Error(`Unsupported download url: ${meta.url}`);
      downloadLogger.warn("startDownload invalid url", { payload, meta, error });
      this.notifyDownloadFailure(ev.sender, meta, error);
      return;
    }

    downloadLogger.debug("startDownload", { payload, normalized: meta });
    this.enqueuePendingMeta(meta);
    try {
      ev.sender.session.downloadURL(meta.url);
    } catch (error) {
      downloadLogger.error("downloadURL failed", { meta, error });
      this.removePendingMeta(meta);
      this.notifyDownloadFailure(ev.sender, meta, error);
    }
  }

  pauseDownload = (_: Electron.IpcMainInvokeEvent, downloadId: string) => {
    const item = this.downloadItems.get(downloadId);
    if (item && !item.isPaused()) {
      item.pause();
      this.pausedItems.add(downloadId);
      downloadLogger.debug("pauseDownload", { downloadId });
    }
  }

  resumeDownload = (_: Electron.IpcMainInvokeEvent, downloadId: string) => {
    const item = this.downloadItems.get(downloadId);
    if (item && item.isPaused()) {
      item.resume();
      this.pausedItems.delete(downloadId);
      downloadLogger.debug("resumeDownload", { downloadId });
    }
  }

  cancelDownload = (_: Electron.IpcMainInvokeEvent, downloadId: string) => {
    const item = this.downloadItems.get(downloadId);
    if (item) {
      item.cancel();
      this.pausedItems.delete(downloadId);
      downloadLogger.debug("cancelDownload", { downloadId });
    }
  }

  private enqueuePendingMeta = (meta: ResolvedDownloadMeta) => {
    const list = this.pendingTasks.get(meta.url) ?? [];
    list.push(meta);
    this.pendingTasks.set(meta.url, list);
    downloadLogger.debug("enqueuePendingMeta", { url: meta.url, queueLength: list.length, meta });
  }

  private consumePendingMeta = (url: string): ResolvedDownloadMeta | undefined => {
    const list = this.pendingTasks.get(url);
    if (!list || list.length === 0) return undefined;
    const meta = list.shift();
    if (!list.length) {
      this.pendingTasks.delete(url);
    } else {
      this.pendingTasks.set(url, list);
    }
    downloadLogger.debug("consumePendingMeta", { url, queueLength: list?.length ?? 0, meta });
    return meta;
  }

  private removePendingMeta = (meta: ResolvedDownloadMeta) => {
    const list = this.pendingTasks.get(meta.url);
    if (!list || list.length === 0) return;
    const index = list.findIndex((item) => item.downloadId === meta.downloadId);
    if (index >= 0) {
      list.splice(index, 1);
    }
    if (!list.length) {
      this.pendingTasks.delete(meta.url);
    } else {
      this.pendingTasks.set(meta.url, list);
    }
  }

  private cleanupDownload = (downloadId: string) => {
    this.downloadItems.delete(downloadId);
    this.pausedItems.delete(downloadId);
  }

  private resolveSavePath = (item: Electron.DownloadItem, meta: ResolvedDownloadMeta) => {
    if (meta.isUpdate) {
      const defaultUpdateDir = global.pathConfig.autoUpdateCachePath;
      return path.join(defaultUpdateDir, item.getFilename());
    }

    const filename = this.getFileName(item, meta);
    return cacheManager.buildCachePath({
      bucket: meta.saveType,
      filename,
      randomPrefix: meta.randomPrefix,
      unique: meta.uniqueName,
    });
  }

  private getFileName = (item: Electron.DownloadItem, meta: ResolvedDownloadMeta) => {
    if (meta.fileName) return meta.fileName;
    const urlFileName = this.extractFileNameFromUrl(meta.url);
    if (urlFileName) return urlFileName;
    return item.getFilename();
  }

  private extractFileNameFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathname = decodeURIComponent(urlObj.pathname);
      const filename = path.basename(pathname);
      return filename || undefined;
    } catch {
      return undefined;
    }
  }

  private normalizePayload = (payload: string | DownloadPayload): ResolvedDownloadMeta => {
    if (typeof payload === "string") {
      const url = payload.trim();
      if (!url) {
        throw new Error("Download url is required");
      }
      return this.normalizePayload({ url });
    }

    if (!payload || typeof payload.url !== "string" || !payload.url.trim()) {
      throw new Error("Download url is required");
    }

    const normalizedUrl = canonicalUrl(payload.url);
    const urlMeta = this.getMetaFromUrl(normalizedUrl);
    const downloadId =
      (typeof payload.downloadId === "string" && payload.downloadId.trim()) ||
      urlMeta.downloadId ||
      normalizedUrl;
    const saveType = this.normalizeBucket(payload.saveType ?? urlMeta.saveType);
    const randomPrefix =
      (typeof payload.randomPrefix === "string" && payload.randomPrefix.trim()) ||
      urlMeta.randomPrefix ||
      (payload.randomName ? this.generatePrefix() : undefined);
    const fileName =
      typeof payload.fileName === "string" && payload.fileName.trim()
        ? path.basename(payload.fileName)
        : urlMeta.fileName;

    return {
      url: normalizedUrl,
      rawUrl: payload.url,
      downloadId,
      saveType,
      fileName,
      randomPrefix,
      uniqueName: payload.uniqueName ?? true,
      isUpdate: payload.isUpdate ?? urlMeta.isUpdate ?? false,
    };
  }

  private getMetaFromUrl = (url: string): Partial<ResolvedDownloadMeta> => {
    try {
      const searchParams = new URL(url).searchParams;
      const saveType = searchParams.get("save-type") as CacheBucket | null;
      const randomPrefix = searchParams.get("random-prefix") ?? undefined;
      const fileName = searchParams.get("file-name") ?? undefined;
      const isUpdate = searchParams.get("is-update") === "true";

      return {
        url,
        downloadId: url,
        saveType: this.normalizeBucket(saveType ?? DEFAULT_BUCKET),
        randomPrefix: randomPrefix || undefined,
        fileName,
        isUpdate,
      };
    } catch {
      return {
        url,
        downloadId: url,
        saveType: DEFAULT_BUCKET,
        isUpdate: false,
      };
    }
  }

  private normalizeBucket = (bucket?: CacheBucket) => {
    const validBuckets: CacheBucket[] = [
      "image",
      "video",
      "file",
      "voice",
      "avatar",
      "sentFile",
    ];
    if (bucket && validBuckets.includes(bucket)) {
      return bucket;
    }
    return DEFAULT_BUCKET;
  }

  private getChannel = (
    meta: ResolvedDownloadMeta,
    type: "success" | "failed" | "progress" | "cancel",
  ) => {
    const map = {
      success: meta.isUpdate ? IpcMainToRender.updateDownloadSuccess : IpcMainToRender.downloadSuccess,
      failed: meta.isUpdate ? IpcMainToRender.updateDownloadFailed : IpcMainToRender.downloadFailed,
      progress: meta.isUpdate ? IpcMainToRender.updateDownloadProgress : IpcMainToRender.downloadProgress,
      cancel: meta.isUpdate ? IpcMainToRender.updateDownloadPaused : IpcMainToRender.downloadCancel,
    };
    return map[type];
  }

  private getRealUrl = (item: Electron.DownloadItem) => {
    return item.getURLChain()[0];
  }

  private generatePrefix = () => {
    return Date.now().toString(36);
  }

  private notifyDownloadFailure = (
    sender: Electron.WebContents,
    meta: ResolvedDownloadMeta,
    error: unknown,
  ) => {
    if (!sender || sender.isDestroyed()) return;
    downloadLogger.error("download failed before start", { meta, error });
    sender.send(this.getChannel(meta, "failed"), meta.downloadId, meta.url);
  }

  private isSupportedDownloadUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:", "file:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  private buildFailureMeta = (payload: string | DownloadPayload): ResolvedDownloadMeta | null => {
    const url =
      typeof payload === "string"
        ? payload.trim()
        : typeof payload?.url === "string"
          ? payload.url.trim()
          : "";
    if (!url) return null;
    const urlMeta = this.getMetaFromUrl(url);
    const downloadId =
      typeof payload !== "string" && typeof payload?.downloadId === "string"
        ? payload.downloadId
        : urlMeta.downloadId ?? url;
    const saveType = this.normalizeBucket(
      typeof payload !== "string" ? payload?.saveType : urlMeta.saveType,
    );
    return {
      url,
      rawUrl: typeof payload === "string" ? payload : payload.url,
      downloadId,
      saveType,
      fileName: urlMeta.fileName,
      randomPrefix: urlMeta.randomPrefix,
      uniqueName: true,
      isUpdate: urlMeta.isUpdate ?? false,
    };
  }
}

export const downloadManager = new DownloadManager();
