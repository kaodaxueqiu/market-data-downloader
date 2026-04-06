import fs from "fs";
import os from "os";
import path from "path";

import { contextBridge, ipcRenderer, shell } from "electron";

import "@openim/electron-client-sdk/lib/preload";
import "@openim/electron-capturer/preload";

import { DataPath, IElectronAPI } from "../../src/types/globalExpose.d";
import { IpcMainToRender, IpcRenderToMain } from "../constants";
import { enableCLib } from "../config";
import { ensureDirSync, getUniqueSavePath } from "../utils/fs";

const buildListener =
  (channel: string) =>
  (callback: (...args: any[]) => void): (() => void) => {
    const subscription = (_: unknown, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  };

const eventListeners = {
  onUpdateAvailable: buildListener(IpcMainToRender.updateAvailable),
  onUpdateNotAvailable: buildListener(IpcMainToRender.updateNotAvailable),
  onUpdateError: buildListener(IpcMainToRender.updateError),
  onUpdateDownloadPaused: buildListener(IpcMainToRender.updateDownloadPaused),
  onUpdateDownloadFailed: buildListener(IpcMainToRender.updateDownloadFailed),
  onUpdateDownloadSuccess: buildListener(IpcMainToRender.updateDownloadSuccess),
  onUpdateDownloadProgress: buildListener(IpcMainToRender.updateDownloadProgress),
  onDownloadSuccess: buildListener(IpcMainToRender.downloadSuccess),
  onDownloadFailed: buildListener(IpcMainToRender.downloadFailed),
  onDownloadCancel: buildListener(IpcMainToRender.downloadCancel),
  onDownloadPaused: buildListener(IpcMainToRender.downloadPaused),
  onDownloadProgress: buildListener(IpcMainToRender.downloadProgress),
  onEventTransfer: buildListener(IpcMainToRender.eventTransfer),
  onAppResume: buildListener(IpcMainToRender.appResume),
  onOpenConversation: buildListener(IpcMainToRender.openConversation),
};

const invokeChannels: Record<string, string> = {
  changeLanguage: "changeLanguage",
  mainWinReady: "main-win-ready",
  showMainWindow: IpcRenderToMain.showMainWindow,
  openChildWindow: IpcRenderToMain.openChildWindow,
  clearSession: IpcRenderToMain.clearSession,
  minimizeWindow: IpcRenderToMain.minimizeWindow,
  maxmizeWindow: IpcRenderToMain.maxmizeWindow,
  closeWindow: IpcRenderToMain.closeWindow,
  resizeWindow: IpcRenderToMain.resizeWindow,
  setWindowMinSize: IpcRenderToMain.setWindowMinSize,
  setWindowMode: IpcRenderToMain.setWindowMode,
  setWindowFullScreen: IpcRenderToMain.setWindowFullScreen,
  clearChildWindows: IpcRenderToMain.clearChildWindows,
  showMessageBox: IpcRenderToMain.showMessageBox,
  setKeyStore: IpcRenderToMain.setKeyStore,
  getKeyStore: IpcRenderToMain.getKeyStore,
  startDownload: IpcRenderToMain.startDownload,
  pauseDownload: IpcRenderToMain.pauseDownload,
  resumeDownload: IpcRenderToMain.resumeDownload,
  cancelDownload: IpcRenderToMain.cancelDownload,
  showInputContextMenu: IpcRenderToMain.showInputContextMenu,
  updateUnreadCount: IpcRenderToMain.updateUnreadCount,
  triggerNewMessage: IpcRenderToMain.newMessageTrigger,
  setUserCachePath: IpcRenderToMain.setUserCachePath,
  getCachePathInfo: IpcRenderToMain.getCachePathInfo,
  selectCacheDirectory: IpcRenderToMain.selectCacheDirectory,
  updateCacheBasePath: IpcRenderToMain.updateCacheBasePath,
  showSaveDialog: IpcRenderToMain.showSaveDialog,
  dragFile: IpcRenderToMain.dragFile,
  appUpdate: IpcRenderToMain.appUpdate,
  showLogsInFinder: IpcRenderToMain.showLogsInFinder,
  prepareUploadLogs: IpcRenderToMain.prepareUploadLogs,
  hotRelaunch: IpcRenderToMain.hotRelaunch,
  sendEventTransfer: IpcRenderToMain.eventTransfer,
  checkChildWindowStatus: IpcRenderToMain.checkChildWindowStatus,
  checkMediaAccess: IpcRenderToMain.checkMediaAccess,
  oauthLogin: IpcRenderToMain.oauthLogin,
  clearSdkData: IpcRenderToMain.clearSdkData,
  checkForUpdate: IpcRenderToMain.checkForUpdate,
  downloadUpdate: IpcRenderToMain.downloadUpdate,
  quitAndUpdate: IpcRenderToMain.quitAndUpdate,
};

const syncChannels: Record<string, string> = {
  getKeyStoreSync: IpcRenderToMain.getKeyStoreSync,
  checkChildWindowStatusSync: IpcRenderToMain.checkChildWindowStatus,
};

const buildInvokeApi = (map: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(map).map(([name, channel]) => [
      name,
      (...args: any[]) => ipcRenderer.invoke(channel, ...args),
    ]),
  ) as any;

const buildSyncApi = (map: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(map).map(([name, channel]) => [
      name,
      (...args: any[]) => ipcRenderer.sendSync(channel, ...args),
    ]),
  ) as any;

const getPlatform = () => {
  if (process.platform === "darwin") {
    return 4;
  }
  if (process.platform === "win32") {
    return 3;
  }
  return 7;
};

const getOsArch = () => os.arch();

const getDataPath = (key: DataPath) => {
  return ipcRenderer.sendSync(IpcRenderToMain.getDataPath, key) || "";
};

const fileExists = (targetPath: string) => fs.existsSync(targetPath);
const openFile = (targetPath: string) => shell.openPath(targetPath);
const showInFinder = (targetPath: string) => shell.showItemInFolder(targetPath);

const getTempFileURL = (targetPath: string) => {
  const file = fs.readFileSync(targetPath);
  const bolb = new Blob([file]);
  return URL.createObjectURL(bolb);
};

const validCacheTypes = new Set(["fileCache", "sentFileCache"]);

const ensureValidFile = (file: File) => {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Invalid file");
  }
};

const ensureValidCacheType = (type: string) => {
  if (!validCacheTypes.has(type)) {
    throw new Error("Invalid cache type");
  }
};

const normalizeFileName = (name: string) => {
  const safeName = path.basename(name || "file");
  return safeName || "file";
};

const saveFileToDisk = async ({
  file,
  type,
  sync,
}: {
  file: File;
  type: "fileCache" | "sentFileCache";
  sync?: boolean;
}): Promise<string> => {
  try {
    ensureValidFile(file);
    ensureValidCacheType(type);
    const arrayBuffer = await file.arrayBuffer();
    const saveDir = ipcRenderer.sendSync(IpcRenderToMain.getDataPath, type);
    if (!saveDir || typeof saveDir !== "string") {
      throw new Error("Invalid save directory");
    }
    const savePath = path.join(saveDir, normalizeFileName(file.name));
    const uniqueSavePath = getUniqueSavePath(savePath);
    ensureDirSync(saveDir);
    const writeTask = fs.promises.writeFile(uniqueSavePath, Buffer.from(arrayBuffer));
    if (sync) {
      await writeTask;
    } else {
      writeTask.catch((error) => {
        console.error("[saveFileToDisk] async write failed", error);
      });
    }
    return uniqueSavePath;
  } catch (error) {
    console.error("[saveFileToDisk] failed", error);
    throw error;
  }
};

const saveFileToPath = async ({
  file,
  filePath,
  sync,
}: {
  file: File;
  filePath: string;
  sync?: boolean;
}): Promise<string> => {
  try {
    ensureValidFile(file);
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid file path");
    }
    const targetPath = filePath.trim();
    const arrayBuffer = await file.arrayBuffer();
    ensureDirSync(path.dirname(targetPath));
    const writeTask = fs.promises.writeFile(targetPath, Buffer.from(arrayBuffer));
    if (sync) {
      await writeTask;
    } else {
      writeTask.catch((error) => {
        console.error("[saveFileToPath] async write failed", error);
      });
    }
    return targetPath;
  } catch (error) {
    console.error("[saveFileToPath] failed", error);
    throw error;
  }
};

const getFileByPath = async (filePath: string) => {
  try {
    const filename = path.basename(filePath);
    const data = await fs.promises.readFile(filePath);
    return new File([data], filename);
  } catch (error) {
    console.log(error);
    return null;
  }
};

const deleteFile = async (filePath: string) => {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    console.error("[deleteFile] failed", error);
    return false;
  }
};

const getIMDataRoot = () => {
  const sdkPath = ipcRenderer.sendSync(IpcRenderToMain.getDataPath, "sdkResources");
  if (sdkPath) return path.dirname(sdkPath);
  return "";
};

const writeVersionFile = (version: string) => {
  try {
    const imDataRoot = getIMDataRoot();
    if (!imDataRoot) return false;
    const versionFile = path.join(imDataRoot, "im-version.json");
    ensureDirSync(imDataRoot);
    fs.writeFileSync(versionFile, JSON.stringify({ version, updatedAt: Date.now() }));
    console.log(`[IM] 版本文件已写入: ${versionFile} (${version})`);
    return true;
  } catch (error) {
    console.error("[writeVersionFile] failed", error);
    return false;
  }
};

const Api: IElectronAPI = {
  ...eventListeners,
  ...buildInvokeApi(invokeChannels),
  ...buildSyncApi(syncChannels),
  getDataPath,
  getVersion: () => process.version,
  getPlatform,
  getOsArch,
  getSystemVersion: process.getSystemVersion,
  fileExists,
  openFile,
  showInFinder,
  getTempFileURL,
  saveFileToDisk,
  saveFileToPath,
  getFileByPath,
  deleteFile,
  writeVersionFile,
  enableCLib,
};

contextBridge.exposeInMainWorld("electronAPI", Api);
