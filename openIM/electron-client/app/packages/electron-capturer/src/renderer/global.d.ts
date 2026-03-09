import type { OverlayAPI } from '../shared/ipc';

declare global {
  interface Window {
    electronCapturer?: OverlayAPI;
  }
}

export {};
