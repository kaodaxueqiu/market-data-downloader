import fs from "fs";
import { dirname, join, resolve } from "node:path";

import { app } from "electron";

import { ensureDirSync, getUniqueSavePath } from "../utils/fs";
import { mainLogger as logger } from "../utils/log";

const OPENIM_DATA_DIR = "OpenIMData";

const USER_CACHE_DIR_MAP = {
  image: "imageCache",
  video: "videoCache",
  file: "fileCache",
  voice: "voiceCache",
  avatar: "avatarCache",
  sentFile: "sentFileCache",
};

export type CacheBucket = keyof typeof USER_CACHE_DIR_MAP;

class CacheManager {
  private getDefaultBaseRoot = () => join(app.getPath("userData"), OPENIM_DATA_DIR);
  // Root that remains fixed for non-cache assets
  private dataRoot = this.getDefaultBaseRoot();
  // Root that can be moved for logs/user caches
  private cacheRoot = this.getDefaultBaseRoot();

  private resolveCacheRootInput = (root?: string) =>
    resolve(root?.trim() || this.getDefaultBaseRoot());

  private buildBasePaths = () => ({
    baseRoot: this.cacheRoot,
    logsPath: join(this.cacheRoot, "logs"),
    autoUpdateCachePath: join(this.dataRoot, "autoUpdateCache"),
    rendererAssetsPath: join(this.dataRoot, "rendererAssets"),
    rendererTempPath: join(this.dataRoot, "rendererTemp"),
    sdkResourcesPath: join(this.dataRoot, "sdkResources"),
  });

  private buildUserCachePaths = (root: string, userID: string) => {
    const userCacheRoot = join(root, userID);
    return {
      userCacheRoot,
      imageCachePath: join(userCacheRoot, "imageCache"),
      videoCachePath: join(userCacheRoot, "videoCache"),
      fileCachePath: join(userCacheRoot, "fileCache"),
      voiceCachePath: join(userCacheRoot, "voiceCache"),
      avatarCachePath: join(userCacheRoot, "avatarCache"),
      sentFileCachePath: join(userCacheRoot, "sentFileCache"),
    };
  };

  setBaseRoot = (root?: string) => {
    const targetRoot = this.resolveCacheRootInput(root);
    this.cacheRoot = targetRoot;
    ensureDirSync(targetRoot);
  }

  getBaseRoot = () => this.cacheRoot;

  getBasePaths = () => {
    return this.buildBasePaths();
  }

  ensureBaseDirs = (paths: string[]) => {
    paths.forEach((dir) => ensureDirSync(dir));
  }

  /**
   * Get a writable cache directory for a given bucket. Falls back to a user-data
   * folder even when the user specific path has not been set yet.
   */
  getCacheRoot = (bucket: CacheBucket) => {
    const pathKey = `${bucket}CachePath` as keyof typeof global.pathConfig;
    const configuredPath = global.pathConfig?.[pathKey] as string | undefined;
    const fallbackPath = join(this.cacheRoot, USER_CACHE_DIR_MAP[bucket]);
    const targetDir = configuredPath ?? fallbackPath;
    ensureDirSync(targetDir);
    return targetDir;
  }

  /**
   * Build a save path under the cache directory, optionally applying a random prefix
   * and ensuring uniqueness.
   */
  buildCachePath = ({
    bucket,
    filename,
    randomPrefix,
    unique = true,
  }: {
    bucket: CacheBucket;
    filename: string;
    randomPrefix?: string;
    unique?: boolean;
  }) => {
    const dir = this.getCacheRoot(bucket);
    const prefix = randomPrefix ? `${randomPrefix}-` : "";
    const rawPath = join(dir, `${prefix}${filename}`);
    return unique ? getUniqueSavePath(rawPath) : rawPath;
  }

  setUserCachePath = (userID: string) => {
    const cachePaths = this.buildUserCachePaths(this.cacheRoot, userID);
    Object.values(cachePaths).forEach((dir) => ensureDirSync(dir));
    Object.assign(global.pathConfig, cachePaths);
  }

  /**
   * Generate a unique cache path for ad-hoc saves (e.g. saving sent files from renderer).
   */
  getUniqueCachePath = (bucket: CacheBucket, filename: string, randomPrefix?: string) => {
    return this.buildCachePath({
      bucket,
      filename,
      randomPrefix,
      unique: true,
    });
  }

  private async moveDir(from: string, to: string) {
    const normalizedFrom = resolve(from);
    const normalizedTo = resolve(to);
    if (normalizedFrom === normalizedTo) return;

    if (!fs.existsSync(from)) {
      ensureDirSync(to);
      return;
    }

    ensureDirSync(dirname(to));

    try {
      if (fs.existsSync(to)) {
        await fs.promises.cp(from, to, { recursive: true, force: true });
        try {
          await fs.promises.rm(from, { recursive: true, force: true });
        } catch (rmError) {
          logger.error("remove old cache dir failed", { from, rmError });
        }
        return;
      }
      await fs.promises.rename(from, to);
    } catch (error) {
      logger.error("moveDir failed, fallback to copy", { from, to, error });
      try {
        await fs.promises.mkdir(to, { recursive: true });
        await fs.promises.cp(from, to, { recursive: true, force: true });
        try {
          await fs.promises.rm(from, { recursive: true, force: true });
        } catch (rmError) {
          logger.error("remove old cache dir failed", { from, rmError });
        }
      } catch (cpError) {
        logger.error("moveDir copy fallback failed", { from, to, cpError });
        throw cpError;
      }
    }
  }

  /**
   * Move the whole cache root to a new base directory (includes logs/user caches).
   */
  updateBaseRoot = async (targetRoot: string) => {
    const normalizedTarget = this.resolveCacheRootInput(targetRoot);
    const currentRoot = this.cacheRoot;
    if (normalizedTarget === currentRoot) {
      ensureDirSync(normalizedTarget);
      return this.getBasePaths();
    }

    const reserveDirs = new Set([
      "autoUpdateCache",
      "rendererAssets",
      "rendererTemp",
      "sdkResources",
    ]);

    const pathsToMove: { from: string; to: string }[] = [];
    try {
      const entries = await fs.promises.readdir(currentRoot, { withFileTypes: true });
      entries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) => {
          if (reserveDirs.has(entry.name)) return;
          pathsToMove.push({
            from: join(currentRoot, entry.name),
            to: join(normalizedTarget, entry.name),
          });
        });
    } catch (error) {
      logger.error("read cache root dir failed", error);
    }

    for (const entry of pathsToMove) {
      logger.debug(`Moving cache dir from ${entry.from} to ${entry.to}`);
      await this.moveDir(entry.from, entry.to);
    }

    this.cacheRoot = normalizedTarget;
    if (global.pathConfig?.userCacheRoot) {
      const userRootName = global.pathConfig.userCacheRoot.split(/[\\/]/).pop() || "";
      const cachePaths = this.buildUserCachePaths(this.cacheRoot, userRootName);
      Object.assign(global.pathConfig, cachePaths);
    } else {
      // ensure fallback bucket paths align to new cache root
      Object.keys(USER_CACHE_DIR_MAP).forEach((bucket) => {
        const key = `${bucket}CachePath` as keyof typeof global.pathConfig;
        if (global.pathConfig?.[key]) {
          (global.pathConfig as any)[key] = join(
            this.cacheRoot,
            USER_CACHE_DIR_MAP[bucket as CacheBucket],
          );
        }
      });
    }
    return this.getBasePaths();
  }
}

export const cacheManager = new CacheManager();
