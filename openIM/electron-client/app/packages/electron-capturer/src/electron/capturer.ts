import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
  type BrowserWindowConstructorOptions,
  type Rectangle
} from 'electron';
import fs from 'fs';
import path from 'path';
import type {
  CaptureSaveResult,
  CaptureResult,
  OverlayInitPayload,
  OverlayTexts,
  ScreenSource,
  StartOverlayOptions
} from '../shared/ipc';

const useWorkAreaForOverlay = process.platform !== 'win32'; // macOS 用 workArea，其它平台用 bounds

export interface CapturerOptions {
  /**
   * 自定义 renderer 入口，默认会尝试 dist-electron/renderer/index.html。
   */
  rendererEntry?: string;
  /**
   * 自定义 preload 路径，默认 dist-electron/preload/index.js。
   */
  preloadPath?: string;
  /**
   * overlay 页面 hash。默认空字符串，直接加载首页作为 overlay。
   */
  overlayHash?: string;
  /**
   * 保存图片的回调；不提供时会弹出保存对话框。
   */
  onSave?: (dataUrl: string) => Promise<CaptureSaveResult>;
  /**
   * 覆盖 overlay 内的文案（按钮、提示）。
   */
  texts?: Partial<OverlayTexts>;
  /**
   * 自定义 BrowserWindow 配置，用于微调 overlay。
   */
  windowOptions?: BrowserWindowConstructorOptions;
  /**
   * 截屏时的 thumbnail 尺寸（越小越快）；不传则按显示器分辨率等比例。
   */
  thumbnailSize?: { width: number; height: number };
  /**
   * 分辨率缩放系数（如 0.5 表示 50% 分辨率缩略图），用于加速 desktopCapturer。
   */
  thumbnailScale?: number;
}

const getOverlayBoundsForDisplay = (display?: Electron.Display | null): Rectangle => {
  if (!display) {
    return { x: 0, y: 0, width: 800, height: 600 };
  }
  if (useWorkAreaForOverlay && display.workArea) {
    return display.workArea;
  }
  return display.bounds;
};

const getDisplayIdFromSource = (
  source: Electron.DesktopCapturerSource
): string | undefined => {
  const raw = source as { display_id?: string; displayId?: string };
  return raw.display_id || raw.displayId;
};

const pickSourceByDisplay = (
  sources: Electron.DesktopCapturerSource[],
  displayId?: string | number | null
): Electron.DesktopCapturerSource | null => {
  if (!sources?.length) return null;
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const cursorId = cursorDisplay?.id?.toString?.() || cursorDisplay?.id || '';
  const normalizedDisplayId = displayId?.toString?.() || displayId;
  if (normalizedDisplayId) {
    const match = sources.find(
      (s) => getDisplayIdFromSource(s) === normalizedDisplayId || s.id === normalizedDisplayId
    );
    if (match) return match;
  }
  const primary = screen.getPrimaryDisplay();
  const primaryId = primary?.id?.toString?.() || primary?.id || '';
  return (
    sources.find((s) => getDisplayIdFromSource(s) === cursorId) ||
    sources.find((s) => getDisplayIdFromSource(s) === primaryId) ||
    sources[0]
  );
};

const buildScreenList = (sources: Electron.DesktopCapturerSource[], thumbWidth = 320) =>
  sources.map((s) => {
    const thumb = thumbWidth ? s.thumbnail.resize({ width: thumbWidth }) : s.thumbnail;
    return {
      id: s.id,
      name: s.name,
      displayId: getDisplayIdFromSource(s),
      thumbnail: thumb.toDataURL()
    };
  });

const getThumbnailSize = (
  opts?: { size?: { width: number; height: number }; scale?: number }
) => {
  const displays = screen.getAllDisplays();
  if (opts?.size) {
    return { width: Math.max(1, Math.round(opts.size.width)), height: Math.max(1, Math.round(opts.size.height)) };
  }
  const scale = typeof opts?.scale === 'number' && opts.scale > 0 ? opts.scale : 1;
  const maxWidth = Math.max(
    ...displays.map((d) => Math.round(d.size.width * (d.scaleFactor || 1) * scale))
  );
  const maxHeight = Math.max(
    ...displays.map((d) => Math.round(d.size.height * (d.scaleFactor || 1) * scale))
  );
  return { width: maxWidth, height: maxHeight };
};

export class ElectronCapturer {
  private overlayWindow: BrowserWindow | null = null;
  private hiddenWindows = new Map<number, number>();
  private options: CapturerOptions;
  private registered = false;
  private readonly overlayHash: string;
  private readonly preloadPath?: string;
  private readonly rendererEntry?: string;

  constructor(options: CapturerOptions = {}) {
    this.options = options;
    this.overlayHash = options.overlayHash || '';
    this.rendererEntry = options.rendererEntry || this.resolveRendererEntry();
    this.preloadPath = options.preloadPath || this.resolvePreloadPath();

    if (process.platform === 'linux') {
      app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
      app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
    }
  }

  /**
   * 返回 renderer 入口（带 hash 时附加）。
   */
  public getRendererEntry(hash = ''): string {
    const normalizedHash =
      hash && hash.startsWith('#') ? hash : hash ? `#${hash.replace(/^#/, '')}` : '';
    const entry = this.rendererEntry;
    if (!entry) return '';
    if (entry.startsWith('http')) {
      return `${entry}${normalizedHash}`;
    }
    if (normalizedHash) {
      return `${entry}#${normalizedHash.replace(/^#/, '')}`;
    }
    return entry;
  }

  public getPreloadPath(): string | undefined {
    return this.preloadPath;
  }

  public registerIpc(): () => void {
    if (this.registered) {
      return this.unregister;
    }
    ipcMain.handle('capture:screens', this.handleCaptureScreens);
    ipcMain.handle('capture:save', this.handleCaptureSave);
    ipcMain.handle('overlay:start', this.handleStartOverlay);
    ipcMain.handle('overlay:close', this.handleCloseOverlay);
    ipcMain.handle('overlay:switch-screen', this.handleSwitchOverlayScreen);
    ipcMain.handle('overlay:lower', this.handleLowerOverlay);
    ipcMain.handle('overlay:raise', this.handleRaiseOverlay);
    ipcMain.handle('overlay:result', this.handleOverlayResult);
    ipcMain.handle('overlay:ready', this.handleOverlayReady);
    this.registered = true;
    return this.unregister;
  }

  public unregister = () => {
    if (!this.registered) return;
    ipcMain.removeHandler('capture:screens');
    ipcMain.removeHandler('capture:save');
    ipcMain.removeHandler('overlay:start');
    ipcMain.removeHandler('overlay:close');
    ipcMain.removeHandler('overlay:switch-screen');
    ipcMain.removeHandler('overlay:lower');
    ipcMain.removeHandler('overlay:raise');
    ipcMain.removeHandler('overlay:result');
    ipcMain.removeHandler('overlay:ready');
    this.registered = false;
  };

  public async captureScreens(): Promise<ScreenSource[]> {
    const thumbnailSize = getThumbnailSize({
      size: this.options.thumbnailSize,
      scale: this.options.thumbnailScale
    });
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      displayId: getDisplayIdFromSource(source),
      thumbnail: source.thumbnail.toDataURL()
    }));
  }

  public async startOverlay(
    options?: StartOverlayOptions,
    caller?: BrowserWindow | null
  ): Promise<{ ok: boolean }> {
    if (options?.hideCurrentWindow && caller && !caller.isDestroyed()) {
      const prevOpacity = caller.getOpacity();
      caller.setOpacity(0.01);
      this.hiddenWindows.set(caller.id, prevOpacity);
    }

    try {
      const thumbnailSize = getThumbnailSize({
        size: this.options.thumbnailSize || options?.thumbnailSize,
        scale: this.options.thumbnailScale ?? options?.thumbnailScale
      });
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize
      });
      const target = pickSourceByDisplay(sources);
      if (!target) throw new Error('未找到屏幕源');

      const size = target.thumbnail.getSize();
      const displayForTarget =
        screen.getAllDisplays().find((d) => {
          const id = d.id?.toString?.() || d.id;
          const targetId = getDisplayIdFromSource(target) || target.id;
          return id === targetId;
        }) || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

      const overlayBounds = getOverlayBoundsForDisplay(displayForTarget);

      if (this.overlayWindow && displayForTarget) {
        this.overlayWindow.setBounds(overlayBounds);
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      }

      const jpegBuffer = target.thumbnail.toJPEG(80);

      await this.createOverlayWindow({
        dataBuffer: jpegBuffer,
        imageMime: 'image/jpeg',
        size,
        displayId: displayForTarget?.id,
        displayBounds: overlayBounds,
        scaleFactor: displayForTarget?.scaleFactor || 1,
        screens: buildScreenList(sources),
        selectedScreen: target.id,
        texts: this.options.texts
      });
      return { ok: true };
    } catch (err) {
      this.restoreHiddenWindows();
      throw err;
    }
  }

  public async switchOverlayScreen(displayId: string): Promise<{ ok: boolean }> {
    const thumbnailSize = getThumbnailSize({
      size: this.options.thumbnailSize,
      scale: this.options.thumbnailScale
    });
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize
    });
    const target = pickSourceByDisplay(sources, displayId);
    if (!target) throw new Error('未找到屏幕源');

    const size = target.thumbnail.getSize();
    const jpegBuffer = target.thumbnail.toJPEG(80);
    const displayForTarget =
      screen.getAllDisplays().find((d) => {
        const id = d.id?.toString?.() || d.id;
        const targetId = getDisplayIdFromSource(target) || target.id;
        return id === targetId;
      }) || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

    const overlayBounds = getOverlayBoundsForDisplay(displayForTarget);

    if (this.overlayWindow && displayForTarget) {
      this.overlayWindow.setBounds(overlayBounds);
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    if (this.overlayWindow) {
      this.overlayWindow.webContents.send('overlay:init', {
        dataBuffer: jpegBuffer,
        imageMime: 'image/jpeg',
        size,
        displayBounds: overlayBounds,
        scaleFactor: displayForTarget?.scaleFactor || 1,
        displayId: displayForTarget?.id,
        screens: buildScreenList(sources),
        selectedScreen: target.id,
        texts: this.options.texts
      });
    }
    return { ok: true };
  }

  public closeOverlay(): { ok: boolean } {
    if (this.overlayWindow) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
    this.restoreHiddenWindows();
    return { ok: true };
  }

  public lowerOverlay(): { ok: boolean } {
    if (this.overlayWindow) {
      this.overlayWindow.setAlwaysOnTop(false);
    }
    return { ok: true };
  }

  public raiseOverlay(): { ok: boolean } {
    if (this.overlayWindow) {
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      this.overlayWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true
      });
    }
    return { ok: true };
  }

  private handleCaptureScreens = async (): Promise<ScreenSource[]> => {
    return this.captureScreens();
  };

  private handleStartOverlay = async (
    event: Electron.IpcMainInvokeEvent,
    options?: StartOverlayOptions
  ): Promise<{ ok: boolean }> => {
    const caller = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    return this.startOverlay(options, caller);
  };

  private handleCloseOverlay = async (): Promise<{ ok: boolean }> => {
    return this.closeOverlay();
  };

  private handleSwitchOverlayScreen = async (
    _event: Electron.IpcMainInvokeEvent,
    displayId: string
  ): Promise<{ ok: boolean }> => {
    return this.switchOverlayScreen(displayId);
  };

  private handleLowerOverlay = async (): Promise<{ ok: boolean }> => {
    return this.lowerOverlay();
  };

  private handleRaiseOverlay = async (): Promise<{ ok: boolean }> => {
    return this.raiseOverlay();
  };

  private handleCaptureSave = async (
    _event: Electron.IpcMainInvokeEvent,
    dataUrl: string
  ): Promise<CaptureSaveResult> => {
    if (this.options.onSave) {
      return this.options.onSave(dataUrl);
    }
    return this.saveToDialog(dataUrl);
  };

  private handleOverlayResult = async (
    _event: Electron.IpcMainInvokeEvent,
    payload: CaptureResult
  ): Promise<{ ok: boolean }> => {
    if (payload?.dataUrl) {
      this.broadcastResult(payload);
    }
    return { ok: true };
  };

  private handleOverlayReady = async (): Promise<{ ok: boolean }> => {
    if (this.overlayWindow) {
      this.overlayWindow.showInactive();
      this.overlayWindow.focus();
    }
    return { ok: true };
  };

  private broadcastResult(payload: CaptureResult) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win === this.overlayWindow) return;
      win.webContents.send('overlay:result', payload);
    });
  }

  private restoreHiddenWindows() {
    this.hiddenWindows.forEach((opacity, id) => {
      const win = BrowserWindow.fromId(id);
      if (win && !win.isDestroyed()) {
        try {
          win.setOpacity(typeof opacity === 'number' ? opacity : 1);
        } catch {
          // ignore
        }
      }
    });
    this.hiddenWindows.clear();
  }

  private async createOverlayWindow(payload: OverlayInitPayload): Promise<void> {
    if (this.overlayWindow) {
      this.overlayWindow.hide();
      this.overlayWindow.webContents.send('overlay:init', payload);
      return;
    }

    const display =
      screen
        .getAllDisplays()
        .find((d) => {
          const id = d.id?.toString?.() || d.id;
          const targetId = payload?.displayId?.toString?.() || payload?.displayId;
          return id === targetId;
        }) ||
      screen.getPrimaryDisplay();

    const overlayBounds = getOverlayBoundsForDisplay(display);

    const preload = this.preloadPath || path.join(__dirname, '..', 'preload', 'index.js');
    const windowOptions: BrowserWindowConstructorOptions = {
      x: overlayBounds.x,
      y: overlayBounds.y,
      width: overlayBounds.width,
      height: overlayBounds.height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      focusable: true,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      fullscreenable: false,
      fullscreen: false,
      simpleFullscreen: false,
      show: false,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      },
      ...this.options.windowOptions
    };

    this.overlayWindow = new BrowserWindow(windowOptions);

    this.overlayWindow.setMenuBarVisibility(false);
    this.overlayWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    });
    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    this.overlayWindow.setBounds(overlayBounds);

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.restoreHiddenWindows();
    });

    const entry = this.getRendererEntry(this.overlayHash);
    if (!entry) {
      throw new Error('未能解析 overlay 页面入口');
    }

    if (entry.startsWith('http')) {
      void this.overlayWindow.loadURL(entry);
    } else if (entry.includes('#')) {
      const [filePath, hash] = entry.split('#');
      void this.overlayWindow.loadFile(filePath, { hash });
    } else if (this.overlayHash) {
      void this.overlayWindow.loadFile(entry, { hash: this.overlayHash.replace(/^#/, '') });
    } else {
      void this.overlayWindow.loadFile(entry);
    }
    
    this.overlayWindow.once('ready-to-show', () => {
      this.overlayWindow?.webContents.send('overlay:init', payload);
    });
  }

  private resolveRendererEntry(): string | undefined {
    const candidates = [
      path.resolve(__dirname, '..', '..', 'dist-electron', 'renderer', 'index.html'),
      path.resolve(__dirname, '..', 'renderer', 'index.html')
    ];

    return candidates.find((p) => fs.existsSync(p));
  }

  private resolvePreloadPath(): string | undefined {
    const candidates = [
      path.resolve(__dirname, '..', '..', 'dist-electron', 'preload', 'index.js'),
      path.resolve(__dirname, '..', 'preload', 'index.js')
    ];
    return candidates.find((p) => fs.existsSync(p));
  }

  private async saveToDialog(dataUrl: string): Promise<CaptureSaveResult> {
    const result = await dialog.showSaveDialog({
      title: 'Save capture',
      defaultPath: `capture-${Date.now()}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await fs.promises.writeFile(result.filePath, base64, 'base64');
    return { canceled: false, filePath: result.filePath };
  }
}

export const createCapturer = (options?: CapturerOptions) => new ElectronCapturer(options);
