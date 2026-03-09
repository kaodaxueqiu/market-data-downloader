import { appManager } from "./appManage";
import { cacheManager } from "./cacheManage";
import { trayManager } from "./trayManage";
import { exec as execCommond } from "child_process";
import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  ipcMain,
  screen,
  shell,
  systemPreferences,
} from "electron";
import zipUtil from "adm-zip";
import { t } from "i18next";

import { changeLanguage } from "../i18n";
import { IpcMainToRender, IpcRenderToMain } from "../constants";
import { applyRendererHotUpdate } from "../utils/hotUpdater";
import { createOAuthWindow } from "../utils/oauth";
import { getStore } from "./storeManage";
import { notificationManager } from "./notificationManage";
import { mainLogger as logger } from "../utils/log";
import { windowManager } from "./windowManage";
import { downloadManager } from "./downloadManage";

class IpcHandlerManager {
  private store = getStore();
  private windowModeCache = new Map<
    string,
    {
      bounds: Electron.Rectangle;
      minSize: [number, number];
      alwaysOnTop: boolean;
    }
  >();

  private getDataPathByKey(key: string) {
    switch (key) {
      case "public":
        return global.pathConfig.publicPath;
      case "fileCache":
        return global.pathConfig.fileCachePath;
      case "sentFileCache":
        return global.pathConfig.sentFileCachePath;
      case "sdkResources":
        return global.pathConfig.sdkResourcesPath;
      case "logsPath":
        return global.pathConfig.logsPath;
      default:
        return global.pathConfig.publicPath;
    }
  }

  private forwardEvent(args) {
    if (args.args.target === "main") {
      windowManager.sendEvent(IpcMainToRender.eventTransfer, args);
      return;
    }
    const childWindow = windowManager.getChildWindow(args.args.target);
    if (!childWindow) {
      logger.debug("eventTransfer target missing", args.args.target);
      return;
    }
    childWindow.webContents.send(IpcMainToRender.eventTransfer, args);
  }

  private async handleCheckMediaAccess(_: unknown, device: "screen"): Promise<boolean> {
    if (process.platform === "linux") return true;

    const getMediaStatus = (media: "screen") => {
      try {
        return systemPreferences.getMediaAccessStatus(media);
      } catch (error) {
        logger.warn("getMediaAccessStatus failed", { media, error });
        return "unknown";
      }
    };

    if (process.platform !== "darwin") return true;
    const status = getMediaStatus("screen");
    logger.debug("checkMediaAccess", device, status);
    if (status === "granted") return true;
    windowManager.showDialog({
      type: "warning",
      message: t("system.screenPrivacyDenied"),
    });
    execCommond(
      "open x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    );
    return false;
  }

  private registerWindowHandlers() {
    ipcMain.handle("changeLanguage", (_, locale) => {
      this.store.set("language", locale);
      changeLanguage(locale).then(() => {
        app.relaunch();
        app.exit(0);
      });
    });
    ipcMain.handle("main-win-ready", windowManager.splashEnd);
    ipcMain.handle(IpcRenderToMain.showMainWindow, windowManager.showWindow);
    ipcMain.handle(IpcRenderToMain.openChildWindow, (_, props) => {
      windowManager.openChildWindowHandle(props);
    });
    ipcMain.on(IpcRenderToMain.checkChildWindowStatus, (e, { key }) => {
      e.returnValue = Boolean(windowManager.getChildWindow(key));
    });
    ipcMain.handle(IpcRenderToMain.minimizeWindow, (_, key) => {
      const childWindow = windowManager.getChildWindow(key);
      if (childWindow) {
        childWindow.minimize();
        return;
      }
      windowManager.minimize();
    });
    ipcMain.handle(IpcRenderToMain.maxmizeWindow, (_, key) => {
      const childWindow = windowManager.getChildWindow(key);
      if (childWindow) {
        if (childWindow.isMaximized()) {
          childWindow.unmaximize();
        } else {
          childWindow.maximize();
        }
        return;
      }
      windowManager.updateMaximize();
    });
    ipcMain.handle(IpcRenderToMain.resizeWindow, (_, params) => {
      const { key, width, height, useContentSize, animate, center } = params || {};
      const target =
        typeof key === "string" && key.trim().length > 0
          ? windowManager.getChildWindow(key)
          : BrowserWindow.getFocusedWindow();
      if (!target || target.isDestroyed() || target.isMinimized()) return;
      const nextWidth = Math.max(0, Math.round(width));
      const nextHeight = Math.max(0, Math.round(height));
      if (useContentSize) {
        target.setContentSize(nextWidth, nextHeight, Boolean(animate));
      } else {
        target.setSize(nextWidth, nextHeight, Boolean(animate));
      }
      if (center) {
        target.center();
      }
    });
    ipcMain.handle(IpcRenderToMain.setWindowMinSize, (_, params) => {
      const { key, width, height } = params || {};
      const target =
        typeof key === "string" && key.trim().length > 0
          ? windowManager.getChildWindow(key)
          : BrowserWindow.getFocusedWindow();
      if (!target || target.isDestroyed()) return;
      const nextWidth = Math.max(0, Math.round(width));
      const nextHeight = Math.max(0, Math.round(height));
      target.setMinimumSize(nextWidth, nextHeight);
    });
    ipcMain.handle(IpcRenderToMain.setWindowMode, (_, params) => {
      const { key, mode, width, height, margin = 16, useContentSize = false } =
        params || {};
      const windowKey = typeof key === "string" && key.trim().length > 0 ? key : "focused";
      const target =
        typeof key === "string" && key.trim().length > 0
          ? windowManager.getChildWindow(key)
          : BrowserWindow.getFocusedWindow();
      if (!target || target.isDestroyed() || target.isMinimized()) return;

      if (mode === "mini") {
        if (!this.windowModeCache.has(windowKey)) {
          this.windowModeCache.set(windowKey, {
            bounds: target.getBounds(),
            minSize: target.getMinimumSize(),
            alwaysOnTop: target.isAlwaysOnTop(),
          });
        }
        const nextWidth = Math.max(0, Math.round(width ?? 316));
        const nextHeight = Math.max(0, Math.round(height ?? 54));
        const display = screen.getDisplayMatching(target.getBounds());
        const workArea = display.workArea;
        target.setMinimumSize(nextWidth, nextHeight);
        if (useContentSize) {
          target.setContentSize(nextWidth, nextHeight, true);
        } else {
          target.setSize(nextWidth, nextHeight, true);
        }
        const { width: winWidth, height: winHeight } = target.getBounds();
        const nextX = workArea.x + workArea.width - winWidth - margin;
        const nextY = workArea.y + margin;
        target.setAlwaysOnTop(true, 'floating');
        target.showInactive();
        target.moveTop();
        target.setPosition(nextX, nextY, true);
        return;
      }

      if (mode === "normal") {
        const cached = this.windowModeCache.get(windowKey);
        if (cached) {
          target.setAlwaysOnTop(cached.alwaysOnTop);
          target.setMinimumSize(cached.minSize[0], cached.minSize[1]);
          target.setBounds(cached.bounds, true);
          this.windowModeCache.delete(windowKey);
        } else {
          target.setAlwaysOnTop(false);
        }
      }
    });
    ipcMain.handle(IpcRenderToMain.setWindowFullScreen, (_, params) => {
      const { key, fullscreen } = params || {};
      const target =
        typeof key === "string" && key.trim().length > 0
          ? windowManager.getChildWindow(key)
          : BrowserWindow.getFocusedWindow();
      if (!target || target.isDestroyed()) return;
      const next = Boolean(fullscreen);
      if (target.isFullScreen() === next) return;
      target.setFullScreen(next);
    });
    ipcMain.handle(IpcRenderToMain.closeWindow, (_, key) => {
      if (key === undefined) {
        console.warn(`[ipcMain closeWindow] close mainWindows`);
        windowManager.closeWindow();
        return;
      }
      if (typeof key !== "string" || key.trim().length === 0) {
        console.error(`[ipcMain closeWindow] args error`);
        return;
      }
      const childWindow = windowManager.getChildWindow(key);
      if (!childWindow) {
        console.error(`[ipcMain closeWindow] ${key} window not exist or deleted`);
        return;
      }
      if (!childWindow.isDestroyed()) {
        console.warn(`[ipcMain closeWindow] ${key} window close`);
        childWindow.close();
      }
      this.windowModeCache.delete(key);
      windowManager.deleteChildWindow(key);
    });
    ipcMain.handle(IpcRenderToMain.clearChildWindows, () => {
      windowManager.clearChildWindows();
    });
    ipcMain.handle(IpcRenderToMain.eventTransfer, (_, args) => {
      this.forwardEvent(args);
    });
  }

  private registerDialogsHandlers() {
    ipcMain.handle(IpcRenderToMain.showMessageBox, (_, options) =>
      dialog
        .showMessageBox(BrowserWindow.getFocusedWindow(), options)
        .then((res) => res.response),
    );
    ipcMain.handle(IpcRenderToMain.showSaveDialog, (_, options) =>
      windowManager.showSaveDialog(options),
    );
    ipcMain.handle(IpcRenderToMain.checkMediaAccess, this.handleCheckMediaAccess.bind(this));
    ipcMain.handle(IpcRenderToMain.oauthLogin, async (_, options) => {
      try {
        const result = await createOAuthWindow(options);
        return { success: true, data: result };
      } catch (error) {
        logger.error("oauthLogin failed", error);
        return { success: false };
      }
    });
    ipcMain.handle(IpcRenderToMain.showInputContextMenu, () => {
      const menu = Menu.buildFromTemplate([
        {
          label: t("system.copy"),
          type: "normal",
          role: "copy",
          accelerator: "CommandOrControl+c",
        },
        {
          label: t("system.paste"),
          type: "normal",
          role: "paste",
          accelerator: "CommandOrControl+v",
        },
        {
          label: t("system.selectAll"),
          type: "normal",
          role: "selectAll",
          accelerator: "CommandOrControl+a",
        },
      ]);
      menu.popup({
        window: BrowserWindow.getFocusedWindow()!,
      });
    });
  }

  private registerStoreHandlers() {
    ipcMain.handle(IpcRenderToMain.setKeyStore, (_, { key, data }) => {
      this.store.set(key, data);
    });
    ipcMain.handle(IpcRenderToMain.getKeyStore, (_, { key }) => this.store.get(key));
    ipcMain.on(IpcRenderToMain.getKeyStoreSync, (e, { key }) => {
      e.returnValue = this.store.get(key);
    });
  }

  private registerTrayAndNoticeHandlers() {
    ipcMain.handle(IpcRenderToMain.updateUnreadCount, (_, count) => {
      app.setBadgeCount(count);
      trayManager.setTrayTitle(count);
      trayManager.flicker(count > 0);
    });
    ipcMain.handle(IpcRenderToMain.newMessageTrigger, (_, msg) => {
      windowManager.taskFlicker();
      notificationManager.handleNewMessage(msg);
    });
  }

  private registerDownloadHandlers() {
    ipcMain.handle(IpcRenderToMain.startDownload, (ev, payload) =>
      downloadManager.startDownload(ev, payload),
    );

    ipcMain.handle(IpcRenderToMain.pauseDownload, (event, downloadId: string) =>
      downloadManager.pauseDownload(event, downloadId),
    );

    ipcMain.handle(IpcRenderToMain.resumeDownload, (event, downloadId: string) =>
      downloadManager.resumeDownload(event, downloadId),
    );

    ipcMain.handle(IpcRenderToMain.cancelDownload, (event, downloadId: string) =>
      downloadManager.cancelDownload(event, downloadId),
    );
  }

  private registerUpdateHandlers() {
    ipcMain.handle(IpcRenderToMain.appUpdate, async (_, { pkgPath, isHot }) => {
      if (isHot) {
        const flag = await applyRendererHotUpdate(pkgPath);
        logger.debug("applyRendererHotUpdate flag", flag);
        if (flag) {
          fs.unlink(pkgPath, () => {});
        }
        return flag;
      }
      shell.openPath(pkgPath);
      return true;
    });
    ipcMain.handle(IpcRenderToMain.hotRelaunch, async () => {
      app.relaunch();
      app.exit(0);
    });
    ipcMain.handle(IpcRenderToMain.setUserCachePath, (_, userID) => {
      cacheManager.setUserCachePath(userID);
    });
  }

  private registerPathHandlers() {
    ipcMain.handle(IpcRenderToMain.getCachePathInfo, () => {
      return appManager.getCachePathInfo();
    });
    ipcMain.handle(IpcRenderToMain.selectCacheDirectory, async () => {
      return windowManager.showSelectDialog({
        properties: ["openDirectory", "createDirectory"],
        defaultPath: global.pathConfig?.cacheBasePath || app.getPath("userData"),
      });
    });
    ipcMain.handle(
      IpcRenderToMain.updateCacheBasePath,
      async (_, payload: { basePath?: string; userID?: string }) => {
        try {
          if (!payload?.basePath) {
            return { success: false, message: "Invalid cache path" };
          }
          const data = await appManager.updateCacheBasePath(payload.basePath, payload.userID);
          return { success: true, data };
        } catch (error) {
          logger.error("updateCacheBasePath failed", error);
          return { success: false, message: (error as Error).message || "updateCacheBasePath failed" };
        }
      },
    );
    ipcMain.on(IpcRenderToMain.getDataPath, (e, key: string) => {
      e.returnValue = this.getDataPathByKey(key);
    });
    ipcMain.handle(IpcRenderToMain.dragFile, (e, filePath) => {
      e.sender.startDrag({
        file: filePath,
        icon: trayManager.trayIconPath,
      });
    });
    ipcMain.handle(IpcRenderToMain.showLogsInFinder, () => {
      shell.openPath(global.pathConfig.logsPath);
    });
    ipcMain.handle(IpcRenderToMain.prepareUploadLogs, async () => {
      const logsPath = global.pathConfig.logsPath;
      const zip = new zipUtil();
      zip.addLocalFolder(logsPath);
      const date = new Date();
      const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const zipPath = join(global.pathConfig.logsPath, `${dateStr}electronlog.zip`);
      await zip.writeZipPromise(zipPath);
      return zipPath;
    });
  }

  private registerSessionHandlers() {
    ipcMain.handle(IpcRenderToMain.clearSession, windowManager.clearCache);
  }

  setIpcMainListener = () => {
    this.registerSessionHandlers();
    this.registerWindowHandlers();
    this.registerDialogsHandlers();
    this.registerStoreHandlers();
    this.registerTrayAndNoticeHandlers();
    this.registerDownloadHandlers();
    this.registerUpdateHandlers();
    this.registerPathHandlers();
  }
}

export const ipcHandlerManager = new IpcHandlerManager();
