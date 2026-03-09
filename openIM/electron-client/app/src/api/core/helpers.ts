import { Platform } from "@openim/wasm-client-sdk";

import { useUserStore } from "@/store";

export const getPlatformId = () => window.electronAPI?.getPlatform() ?? 5;

export const getPlatformLabel = () => {
  const platformID = window.electronAPI?.getPlatform();
  if (platformID === Platform.Linux) {
    return "linux";
  }
  if (platformID === Platform.MacOSX) {
    return "mac";
  }
  return "windows";
};

export const getOsArch = () => window.electronAPI?.getOsArch() || "";

export const normalizeAreaCode = (code?: string) =>
  code ? (code.includes("+") ? code : `+${code}`) : code;

export const buildPagination = (pageNumber = 1, showNumber = 20) => ({
  pageNumber,
  showNumber,
});

export const getSelfUserId = () => useUserStore.getState().selfInfo.userID;
