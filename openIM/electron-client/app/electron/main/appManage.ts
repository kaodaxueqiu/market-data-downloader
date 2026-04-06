import fs from "fs";
import { join, resolve, sep } from "node:path";
import { release } from "node:os";

import { app, powerMonitor, shell, systemPreferences } from "electron";

import { singleInstanceLock } from "../config";
import { IpcMainToRender } from "../constants";
import { isMac, isProd } from "../utils";
import { mainLogger as logger, checkClearLogs, updateLoggerPath } from "../utils/log";
import { cacheManager } from "./cacheManage";
import { getStore } from "./storeManage";
import { trayManager } from "./trayManage";
import { windowManager } from "./windowManage";
import { ensureDirSync } from "../utils/fs";

class AppManager {
  private store = getStore();

  prepare = () => {
    this.setSingleInstance();
    this.performAppStartup();
    this.setAppGlobalData();
  }

  setSingleInstance = () => {
    if (!singleInstanceLock) return;

    if (!app.requestSingleInstanceLock()) {
      app.quit();
      process.exit(0);
    }

    app.on("second-instance", () => {
      if (app.isReady()) {
        windowManager.showWindow();
      } else {
        app.whenReady().then(() => windowManager.showWindow());
      }
    });
  }

  setAppListener = (startApp: () => void) => {
    app.on("web-contents-created", (event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        if (!/^devtools/.test(url) && /^https?:\/\//.test(url)) {
          shell.openExternal(url);
        }
        return { action: "deny" };
      });
    });

    app.on("activate", () => {
      const activateApp = () => {
        if (windowManager.isExistMainWindow()) {
          windowManager.showWindow();
        } else {
          startApp();
        }
      };
      if (app.isReady()) {
        activateApp();
      } else {
        app.whenReady().then(activateApp);
      }
    });

    app.on("window-all-closed", () => {
      if (isMac && !this.getIsForceQuit()) return;
      app.quit();
    });

    powerMonitor.on("suspend", () => {
      logger.debug("app suspend");
    });

    powerMonitor.on("resume", () => {
      logger.debug("app resume");
      windowManager.sendEvent(IpcMainToRender.appResume);
    });

    app.on("quit", () => {
      checkClearLogs();
      trayManager.flicker(false);
    });
  }

  performAppStartup = () => {
    app.setAppUserModelId(app.getName());
    app.commandLine.appendSwitch("--autoplay-policy", "no-user-gesture-required");
    app.commandLine.appendSwitch(
      "disable-features",
      "HardwareMediaKeyHandling,MediaSessionService",
    );

    if (release().startsWith("6.1")) app.disableHardwareAcceleration();
  }

  private getCacheBaseFromStore = () => {
    const stored = this.store.get("cacheBasePath") as string | undefined;
    if (typeof stored === "string" && stored.trim()) {
      return stored.trim();
    }
    return undefined;
  }

  private buildPathConfig = ({
    logsPath,
    autoUpdateCachePath,
    sdkResourcesPath,
    rendererAssetsPath,
    rendererTempPath,
    baseRoot,
  }: ReturnType<typeof cacheManager.getBasePaths>) => {
    const distRoot = join(__dirname, "../");
    const distPath = join(distRoot, "../dist");
    const defaultPublicPath = isProd ? distPath : join(distRoot, "../public");
    const publicPath = this.getRendererEntryPath(rendererAssetsPath, defaultPublicPath);
    const asarPath = process.resourcesPath;

    return {
      publicPath,
      asarPath,
      logsPath,
      autoUpdateCachePath,
      extraResourcesPath: join(asarPath, "extraResources"),
      sdkResourcesPath,
      appDistPath: distPath,
      rendererAssetsPath,
      rendererTempPath,
      cacheBasePath: baseRoot,
    };
  }

  setAppGlobalData = () => {
    const cacheBase = this.getCacheBaseFromStore();
    cacheManager.setBaseRoot(cacheBase);
    const pathConfig = this.buildPathConfig(cacheManager.getBasePaths());

    global.pathConfig = pathConfig;
    updateLoggerPath(pathConfig.logsPath);

    cacheManager.ensureBaseDirs([
      global.pathConfig.logsPath,
      global.pathConfig.sdkResourcesPath,
    ]);

    if (isProd) {
      this.clearRendererAssetsOnAppUpdate();
      cacheManager.ensureBaseDirs([
        global.pathConfig.autoUpdateCachePath,
        global.pathConfig.rendererAssetsPath,
        global.pathConfig.rendererTempPath,
      ]);
    }
  }

  private clearRendererAssetsOnAppUpdate = () => {
    const currentVersion = app.getVersion();
    const storedVersion = this.store.get("appVersion") as string | undefined;
    if (storedVersion && storedVersion !== currentVersion) {
      try {
        fs.rmSync(global.pathConfig.rendererAssetsPath, { recursive: true, force: true });
        logger.info("renderer assets cleared for app update", {
          from: storedVersion,
          to: currentVersion,
        });
      } catch (error) {
        logger.error("clear renderer assets failed", error);
      }
    }
    this.store.set("appVersion", currentVersion);
  }

  getCachePathInfo = () => {
    return {
      cacheBasePath: cacheManager.getBaseRoot(),
      logsPath: global.pathConfig.logsPath,
      userCachePath: global.pathConfig.userCacheRoot,
    };
  }

  updateCacheBasePath = async (basePath: string, userID?: string) => {
    const target = basePath?.trim();
    if (!target) {
      throw new Error("Invalid cache directory");
    }

    const currentRoot = cacheManager.getBaseRoot();
    const normalizedCurrent = resolve(currentRoot);
    const normalizedTarget = resolve(target);

    if (normalizedTarget === normalizedCurrent) {
      return this.getCachePathInfo();
    }

    if (normalizedTarget.startsWith(`${normalizedCurrent}${sep}`)) {
      throw new Error("New cache directory cannot be inside the current cache directory.");
    }

    const basePaths = await cacheManager.updateBaseRoot(target);
    const newConfig = this.buildPathConfig(basePaths);

    global.pathConfig = {
      ...global.pathConfig,
      ...newConfig,
    };
    updateLoggerPath(global.pathConfig.logsPath);

    if (userID) {
      cacheManager.setUserCachePath(userID);
    }

    if (isProd) {
      ensureDirSync(
        global.pathConfig.logsPath,
      );
    }

    this.store.set("cacheBasePath", cacheManager.getBaseRoot());

    return this.getCachePathInfo();
  }

  private getRendererEntryPath = (rendererAssetsPath: string, fallbackPath: string) => {
    if (!isProd) {
      return fallbackPath;
    }
    try {
      if (!fs.existsSync(rendererAssetsPath)) {
        return fallbackPath;
      }
      const candidates = fs
        .readdirSync(rendererAssetsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const fullPath = join(rendererAssetsPath, entry.name);
          return {
            fullPath,
            indexPath: join(fullPath, "index.html"),
            time: fs.statSync(fullPath).mtimeMs,
          };
        })
        .filter((entry) => fs.existsSync(entry.indexPath))
        .sort((a, b) => b.time - a.time);
      return candidates[0]?.fullPath ?? fallbackPath;
    } catch (error) {
      logger.error("getRendererEntryPath failed", error);
      return fallbackPath;
    }
  }

  checkPreferences = () => {
    if (process.platform !== "darwin") {
      return;
    }
    const version = release().split(".")[0];
    if (Number(version) < 21) {
      return;
    }
    systemPreferences.getMediaAccessStatus("screen");
  }

  getIsForceQuit() {
    return this.store.get("closeAction") !== "miniSize" || global.forceQuit;
  }
}

export const appManager = new AppManager();
