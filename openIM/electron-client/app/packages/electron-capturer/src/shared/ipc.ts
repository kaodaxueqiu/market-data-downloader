export interface Dimensions {
  width: number;
  height: number;
}

export interface DisplayBounds extends Dimensions {
  x: number;
  y: number;
}

export interface ScreenSource {
  id: string;
  name?: string;
  displayId?: string;
  thumbnail: string;
}

export interface CaptureSaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface OverlayInitPayload {
  dataUrl?: string | null;
  dataBuffer?: Uint8Array;
  imageMime?: string;
  size?: Dimensions;
  displayId?: string | number;
  displayBounds?: DisplayBounds;
  scaleFactor?: number;
  screens?: ScreenSource[];
  selectedScreen?: string;
  texts?: Partial<OverlayTexts>;
}

export interface CaptureResult {
  dataUrl: string;
}

export interface StartOverlayOptions {
  /**
   * 启动截屏时是否隐藏当前窗口（调用方窗口），在 overlay 关闭后自动恢复。
   */
  hideCurrentWindow?: boolean;
  /**
   * 自定义截屏 thumbnail 尺寸（越小越快）；不传则使用显示器分辨率等比例。
   */
  thumbnailSize?: Dimensions;
  /**
   * 相对分辨率的缩放系数（例如 0.5 则使用 50% 分辨率的缩略图）。
   */
  thumbnailScale?: number;
}

export interface OverlayAPI {
  captureScreens(): Promise<ScreenSource[]>;
  saveCapture(dataUrl: string): Promise<CaptureSaveResult>;
  startOverlay(options?: StartOverlayOptions): Promise<{ ok: boolean }>;
  closeOverlay(): Promise<{ ok: boolean }>;
  switchOverlayScreen(displayId: string): Promise<{ ok: boolean }>;
  lowerOverlay(): Promise<{ ok: boolean }>;
  raiseOverlay(): Promise<{ ok: boolean }>;
  onOverlayInit(callback: (payload: OverlayInitPayload) => void): () => void;
  emitCaptureResult(dataUrl: string): Promise<{ ok: boolean }>;
  onCaptureResult(callback: (payload: CaptureResult) => void): () => void;
  notifyReady(): Promise<{ ok: boolean }>;
}

export interface OverlayTexts {
  escHint?: string;
  loading?: string;
  textPlaceholder?: string;
  statusReady?: string;
  toolLabels?: ToolLabels;
  toolbar?: {
    color?: string;
    strokeWidth?: string;
    undo?: string;
    redo?: string;
    copy?: string;
    save?: string;
    cancel?: string;
    confirm?: string;
  };
}

export interface ToolLabels {
  select?: string;
  rect?: string;
  arrow?: string;
  pen?: string;
  text?: string;
  mosaic?: string;
  eraser?: string;
}
