import { contextBridge, ipcRenderer } from 'electron';
import type {
  CaptureResult,
  OverlayAPI,
  OverlayInitPayload,
  StartOverlayOptions
} from '../shared/ipc';

const api: OverlayAPI = {
  captureScreens: () => ipcRenderer.invoke('capture:screens'),
  saveCapture: (dataUrl: string) => ipcRenderer.invoke('capture:save', dataUrl),
  startOverlay: (options?: StartOverlayOptions) => ipcRenderer.invoke('overlay:start', options),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  switchOverlayScreen: (displayId: string) => ipcRenderer.invoke('overlay:switch-screen', displayId),
  lowerOverlay: () => ipcRenderer.invoke('overlay:lower'),
  raiseOverlay: () => ipcRenderer.invoke('overlay:raise'),
  emitCaptureResult: (dataUrl: string) => ipcRenderer.invoke('overlay:result', { dataUrl }),
  onOverlayInit: (cb: (payload: OverlayInitPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: OverlayInitPayload) => cb?.(payload);
    ipcRenderer.on('overlay:init', listener);
    return () => ipcRenderer.removeListener('overlay:init', listener);
  },
  onCaptureResult: (cb: (payload: CaptureResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CaptureResult) => cb?.(payload);
    ipcRenderer.on('overlay:result', listener);
    return () => ipcRenderer.removeListener('overlay:result', listener);
  },
  notifyReady: () => ipcRenderer.invoke('overlay:ready')
};

contextBridge.exposeInMainWorld('electronCapturer', api);
