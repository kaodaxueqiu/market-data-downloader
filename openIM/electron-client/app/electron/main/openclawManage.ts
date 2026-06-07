import { spawn, execSync, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

import { app, ipcMain } from "electron";

import { IpcMainToRender, IpcRenderToMain } from "../constants";
import { mainLogger as logger } from "../utils/log";
import { getStore } from "./storeManage";
import { windowManager } from "./windowManage";

type OpenclawStatus =
  | "stopped"
  | "starting"
  | "running"
  | "error"
  | "connected"
  | "disconnected";

interface OpenclawConfig {
  agentName: string;
  agentHistory: string[];
}

// 网关地址与 token（与主程序保持一致；如需可后续抽成配置）
const GATEWAY_BASE = "ws://61.151.241.233:8080/openclaw/agent";
const GATEWAY_TOKEN = "unified-gateway-token-2026";

class OpenclawManager {
  private store = getStore();
  private proc: ChildProcess | null = null;
  private status: OpenclawStatus = "stopped";
  private lastError = "";
  private message = "";

  private sendStatus() {
    windowManager.sendEvent(IpcMainToRender.openclawStatusChanged, {
      status: this.proc ? this.status : "stopped",
      message: this.message,
      error: this.lastError,
    });
  }

  private getConfig(): OpenclawConfig {
    const raw = (this.store.get("openclawConfig") as Partial<OpenclawConfig>) || {};
    return {
      agentName: raw.agentName || "",
      agentHistory: Array.isArray(raw.agentHistory) ? raw.agentHistory : [],
    };
  }

  private saveAgentToHistory(agentName: string) {
    const config = this.getConfig();
    const history = config.agentHistory.filter((n) => n !== agentName);
    history.unshift(agentName);
    this.store.set("openclawConfig", {
      agentName,
      agentHistory: history.slice(0, 20),
    });
  }

  private resolveExePath(): string | null {
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";
    const isArm = process.arch === "arm64";

    const exeName = isWin
      ? "openclaw-node-win.exe"
      : isMac
        ? isArm
          ? "openclaw-node-macos-arm64"
          : "openclaw-node-macos-x64"
        : null;

    if (!exeName) return null;

    // 打包后 extraResources 目录会被复制到 resources/extraResources
    const candidates = [
      path.join(process.resourcesPath, "extraResources", "openclaw", exeName),
      path.join(process.resourcesPath, "openclaw", exeName),
      path.join(app.getAppPath(), "extraResources", "openclaw", exeName),
      path.join(process.cwd(), "extraResources", "openclaw", exeName),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    logger.warn("[Openclaw] 未找到可执行文件", { exeName, candidates });
    return null;
  }

  private getConfigDir(): string {
    if (process.platform === "win32") {
      return path.join(
        process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
        "openclaw",
      );
    }
    if (process.platform === "darwin") {
      return path.join(process.env.HOME || "", "Library", "Application Support", "openclaw");
    }
    return path.join(process.env.HOME || "", ".config", "openclaw");
  }

  private writeNodeConfig(agentName: string) {
    const configDir = this.getConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, "node-config.json");
    const config = {
      agentName,
      gatewayUrl: `${GATEWAY_BASE}/${agentName}`,
      token: GATEWAY_TOKEN,
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  private async start(agentName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.proc) return { success: false, error: "已在运行中" };
      if (!agentName?.trim()) return { success: false, error: "请输入智能体名称" };

      const exePath = this.resolveExePath();
      if (!exePath) {
        return { success: false, error: "未找到 openclaw-node 程序，请确认已正确安装" };
      }

      if (process.platform !== "win32") {
        try {
          fs.chmodSync(exePath, 0o755);
        } catch {
          /* ignore */
        }
        if (process.platform === "darwin") {
          try {
            execSync(`xattr -cr "${exePath}"`, { timeout: 5000 });
            execSync(`codesign --force --deep --sign - "${exePath}"`, { timeout: 10000 });
          } catch {
            /* ignore */
          }
        }
      }

      const name = agentName.trim();
      this.writeNodeConfig(name);
      this.saveAgentToHistory(name);

      this.status = "starting";
      this.lastError = "";

      this.proc = spawn(exePath, [], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
        cwd: path.dirname(exePath),
        windowsHide: true,
      });

      this.proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString().trim();
        logger.debug("[Openclaw]", text);
        if (text.includes("连接成功")) {
          this.status = "connected";
          this.message = text;
          this.sendStatus();
        } else if (text.includes("连接失败")) {
          this.status = "error";
          this.message = text;
          this.lastError = text;
          this.sendStatus();
        } else if (text.includes("连接已断开")) {
          this.status = "disconnected";
          this.message = text;
          this.sendStatus();
        } else if (text.includes("正在连接")) {
          this.status = "starting";
          this.message = text;
          this.sendStatus();
        }
      });

      this.proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString().trim();
        logger.error("[Openclaw Error]", text);
        if (!text.includes("Warning:") && !text.includes("single-executable")) {
          this.lastError = text;
          this.sendStatus();
        }
      });

      this.proc.on("close", (code: number | null) => {
        logger.debug(`[Openclaw] 进程退出, code=${code}`);
        this.proc = null;
        this.status = code === 0 ? "stopped" : "error";
        this.message = code === 0 ? "已停止" : `进程异常退出 (code: ${code})`;
        if (code !== 0 && code !== null) {
          this.lastError = `进程异常退出 (code: ${code})`;
        }
        this.sendStatus();
      });

      this.proc.on("error", (err: Error) => {
        logger.error("[Openclaw] 启动失败:", err);
        this.proc = null;
        this.status = "error";
        this.lastError = err.message;
        this.message = "启动失败: " + err.message;
        this.sendStatus();
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if ((this.status as string) === "error") {
        return { success: false, error: this.lastError || "启动失败" };
      }
      return { success: true };
    } catch (error) {
      this.status = "error";
      this.lastError = (error as Error).message;
      return { success: false, error: (error as Error).message || "启动失败" };
    }
  }

  private async stop(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.proc) {
        this.status = "stopped";
        return { success: true };
      }
      this.proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.proc) this.proc.kill("SIGKILL");
          resolve();
        }, 3000);
        this.proc?.on("close", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.proc = null;
      this.status = "stopped";
      this.lastError = "";
      this.message = "";
      this.sendStatus();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message || "停止失败" };
    }
  }

  register() {
    ipcMain.handle(IpcRenderToMain.openclawStart, (_e, agentName: string) =>
      this.start(agentName),
    );
    ipcMain.handle(IpcRenderToMain.openclawStop, () => this.stop());
    ipcMain.handle(IpcRenderToMain.openclawGetStatus, () => ({
      status: this.proc ? this.status : "stopped",
      agentName: this.getConfig().agentName,
      message: this.message,
      error: this.lastError,
    }));
    ipcMain.handle(IpcRenderToMain.openclawGetConfig, () => this.getConfig());
  }
}

export const openclawManager = new OpenclawManager();
