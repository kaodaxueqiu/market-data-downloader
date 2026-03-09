import fs from "fs";
import { app } from "electron";
import log from "electron-log/main";
import { join } from "node:path";

const LOG_FILE_NAME = "OpenIM.log";
const MAX_SIZE = 524288000; // 100M
const FORMAT = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}";

const resolveLogsPath = (customPath?: string) => {
  if (customPath) return customPath;
  try {
    if (global.pathConfig?.logsPath) return global.pathConfig.logsPath;
  } catch {
    // ignore
  }
  return join(app.getPath("userData"), "OpenIMData/logs");
};

let initialized = false;
let currentLogsPath: string | undefined;

const initLogger = (logsPath?: string) => {
  const target = resolveLogsPath(logsPath);
  log.transports.file.level = "debug";
  log.transports.file.maxSize = MAX_SIZE;
  log.transports.file.format = FORMAT;
  log.transports.file.resolvePathFn = () => join(target, LOG_FILE_NAME);
  if (!initialized) {
    log.initialize({ preload: true });
    initialized = true;
  }
  currentLogsPath = target;
};

export const getMainLogger = (logsPath?: string) => {
  initLogger(logsPath);
  return log.scope("main");
};

export const getScopedLogger = (scope: string, logsPath?: string) => {
  initLogger(logsPath);
  return log.scope(scope);
};

export const updateLoggerPath = (logsPath?: string) => {
  if (!initialized || logsPath !== currentLogsPath) {
    initLogger(logsPath);
  }
};

export const mainLogger = getMainLogger();

export const checkClearLogs = async () => {
  initLogger();
  const logsPath = resolveLogsPath();
  const today = new Date();
  let files: string[] = [];
  try {
    files = await fs.promises.readdir(logsPath);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      log.error(`Error: ${logsPath} does not exist`);
    } else {
      log.error(`Error reading directory ${logsPath}: ${err}`);
    }
  }
}
