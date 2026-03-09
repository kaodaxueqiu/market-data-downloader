import type { WindowKey } from "./events";

const WINDOW_KEY_MATCHERS: Array<{ key: WindowKey; match: string }> = [
  { key: "global-search", match: "third/global-search" },
  { key: "moments", match: "third/moments" },
];

export const resolveWindowKeyFromHash = (hash: string): WindowKey => {
  for (const { key, match } of WINDOW_KEY_MATCHERS) {
    if (hash.includes(match)) return key;
  }
  return "main";
};

export const getCurrentWindowKey = (): WindowKey => {
  if (typeof window === "undefined") return "main";
  return resolveWindowKeyFromHash(window.location.hash);
};

export const getMainOrGlobalSearchWindowKey = (): WindowKey =>
  getCurrentWindowKey() === "main" ? "global-search" : "main";
