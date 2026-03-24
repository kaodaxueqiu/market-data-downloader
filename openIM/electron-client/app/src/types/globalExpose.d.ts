import { OverlayAPI } from "@openim/electron-capturer";
import { Platform } from "@openim/wasm-client-sdk";
import {
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from "electron";

export type DataPath =
  | "public"
  | "sdkResources"
  | "logsPath"
  | "fileCache"
  | "sentFileCache";

export type DownloadPayload = {
  url: string;
  downloadId?: string;
  saveType?: "avatar" | "image" | "video" | "file" | "voice" | "sentFile";
  fileName?: string;
  randomPrefix?: string;
  randomName?: boolean;
  uniqueName?: boolean;
  isUpdate?: boolean;
};

export interface PathConfig {
  publicPath: string;
  asarPath: string;
  logsPath: string;
  autoUpdateCachePath: string;
  extraResourcesPath: string;
  sdkResourcesPath: string;
  appDistPath: string;
  rendererAssetsPath: string;
  rendererTempPath: string;
  cacheBasePath: string;
  imageCachePath?: string;
  videoCachePath?: string;
  fileCachePath?: string;
  voiceCachePath?: string;
  avatarCachePath?: string;
  sentFileCachePath?: string;
  hotUpdateAssetPath?: string;
  userCacheRoot?: string;
}

export type Unsubscribe = () => void;

type MessageBoxReturnType = Promise<number>;

export interface NewMessageSummary {
  conversationId: string;
  conversationName: string;
  senderName: string;
  text: string;
  isGroup?: boolean;
}

export interface IElectronAPI {
  // main -> render events
  onUpdateAvailable: (cb: () => void) => Unsubscribe;
  onUpdateNotAvailable: (cb: () => void) => Unsubscribe;
  onUpdateError: (cb: (error: any) => void) => Unsubscribe;
  onUpdateDownloadPaused: (cb: (...args: any[]) => void) => Unsubscribe;
  onUpdateDownloadFailed: (cb: (url: string, savePath?: string) => void) => Unsubscribe;
  onUpdateDownloadSuccess: (cb: (url: string, savePath: string) => void) => Unsubscribe;
  onUpdateDownloadProgress: (
    cb: (url: string, progress: number) => void,
  ) => Unsubscribe;
  onDownloadSuccess: (cb: (url: string, savePath: string) => void) => Unsubscribe;
  onDownloadFailed: (cb: (url: string, savePath?: string) => void) => Unsubscribe;
  onDownloadCancel: (cb: (url: string) => void) => Unsubscribe;
  onDownloadPaused: (cb: (url: string) => void) => Unsubscribe;
  onDownloadProgress: (cb: (url: string, progress: number) => void) => Unsubscribe;
  onEventTransfer: (cb: (payload: any) => void) => Unsubscribe;
  onAppResume: (cb: () => void) => Unsubscribe;
  onOpenConversation: (cb: (conversationId: string | null) => void) => Unsubscribe;

  // render -> main actions
  changeLanguage: (locale: string) => Promise<void>;
  mainWinReady: () => Promise<void>;
  showMainWindow: () => Promise<void>;
  openChildWindow: (props: any) => Promise<void>;
  clearSession: () => Promise<void>;
  clearSdkData: () => Promise<{ success: boolean; message?: string }>;
  minimizeWindow: (key?: string) => Promise<void>;
  maxmizeWindow: (key?: string) => Promise<void>;
  closeWindow: (key?: string) => Promise<void>;
  resizeWindow: (params: {
    key?: string;
    width: number;
    height: number;
    useContentSize?: boolean;
    animate?: boolean;
    center?: boolean;
  }) => Promise<void>;
  setWindowMinSize: (params: {
    key?: string;
    width: number;
    height: number;
  }) => Promise<void>;
  setWindowMode: (params: {
    key?: string;
    mode: "normal" | "mini";
    width?: number;
    height?: number;
    margin?: number;
    useContentSize?: boolean;
  }) => Promise<void>;
  setWindowFullScreen: (params: { key?: string; fullscreen: boolean }) => Promise<void>;
  clearChildWindows: () => Promise<void>;
  showMessageBox: (options: any) => MessageBoxReturnType;
  setKeyStore: (params: { key: string; data: any }) => Promise<void>;
  getKeyStore: <T = unknown>(params: { key: string }) => Promise<T>;
  getKeyStoreSync: <T = unknown>(params: { key: string }) => T;
  startDownload: (payload: string | DownloadPayload) => Promise<void>;
  pauseDownload: (url: string) => Promise<void>;
  resumeDownload: (url: string) => Promise<void>;
  cancelDownload: (url: string) => Promise<void>;
  showInputContextMenu: () => Promise<void>;
  updateUnreadCount: (count: number) => Promise<void>;
  triggerNewMessage: (msg: any) => Promise<void>;
  setUserCachePath: (userID: string) => Promise<void>;
  getDataPath: (key: DataPath) => string;
  dragFile: (filePath: string) => Promise<void>;
  appUpdate: (payload: { pkgPath: string; isHot: boolean }) => Promise<boolean>;
  showLogsInFinder: () => Promise<void>;
  prepareUploadLogs: () => Promise<string>;
  hotRelaunch: () => Promise<void>;
  sendEventTransfer: (payload: any) => Promise<void>;
  checkChildWindowStatus: (params: { key: string }) => Promise<boolean>;
  checkChildWindowStatusSync: (params: { key: string }) => boolean;
  checkMediaAccess: (device: "screen") => Promise<boolean>;
  oauthLogin: (options: {
    baseUrl: string;
    provider: "google" | "github";
  }) => Promise<any>;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndUpdate: () => Promise<void>;
  getCachePathInfo: () => Promise<CachePathInfo>;
  selectCacheDirectory: () => Promise<OpenDialogReturnValue>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
  updateCacheBasePath: (params: { basePath: string; userID?: string }) => Promise<{
    success: boolean;
    data?: CachePathInfo;
    message?: string;
  }>;

  getVersion: () => string;
  getPlatform: () => Platform;
  getOsArch: () => string;
  getSystemVersion: () => string;
  fileExists: (path: string) => boolean;
  openFile: (path: string) => void;
  showInFinder: (path: string) => void;
  getTempFileURL: (path: string) => string;
  saveFileToDisk: (params: {
    file: File;
    type: "fileCache" | "sentFileCache";
    sync?: boolean;
  }) => Promise<string>;
  saveFileToPath: (params: {
    file: File;
    filePath: string;
    sync?: boolean;
  }) => Promise<string>;
  getFileByPath: (filePath: string) => Promise<File | null>;
  deleteFile: (filePath: string) => Promise<boolean>;
  writeVersionFile: (version: string) => boolean;
  enableCLib: boolean;
}

export interface CachePathInfo {
  cacheBasePath: string;
  logsPath: string;
  userCachePath?: string;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
    electronCapturer?: OverlayAPI;
    userClick: (userID?: string, groupID?: string) => void;
    editRevoke: (clientMsgID: string) => void;
    screenshotPreview: (results: string) => void;
  }
  // main-process globals

  var pathConfig: PathConfig;

  var forceQuit: boolean;
}

declare module "i18next" {
  interface TFunction {
    (key: string, options?: object): string;
  }
}
