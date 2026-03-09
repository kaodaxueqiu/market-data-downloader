import type { ToSpecifiedConversationParams } from "@/hooks/useConversationToggle";
import type { RouteTravel } from "@/pages/common/MomentsModal";
import type {
  AppUpdateCheckPayload,
  CallStoreFunctionParams,
  ReadyJumpToHistoryParams,
  WindowEmitterEvents,
  WindowKey,
} from "./events";
import { getMainOrGlobalSearchWindowKey } from "./windowKey";

import { emitToSpecifiedWindow } from "./events";

const broadcastToWindow = <K extends keyof WindowEmitterEvents>(
  event: K,
  args: WindowEmitterEvents[K],
  target: WindowKey,
) => {
  if (!window.electronAPI?.enableCLib) return;
  emitToSpecifiedWindow(event, args, target);
};

export const broadcastCallStoreFunction = (
  params: CallStoreFunctionParams,
  target: WindowKey = "main",
) => {
  broadcastToWindow("CALL_STORE_FUNCTION", params, target);
};

export const broadcastMessageStore = (
  functionName: CallStoreFunctionParams["functionName"],
  args: CallStoreFunctionParams["args"],
  target?: WindowKey,
) => {
  broadcastCallStoreFunction(
    {
      store: "message",
      functionName,
      args,
    },
    target ?? getMainOrGlobalSearchWindowKey(),
  );
};

export const broadcastUserLogout = (target: WindowKey = "main") => {
  broadcastToWindow("USER_LOGOUT", undefined, target);
};

export const broadcastJumpToConversation = (
  params: ToSpecifiedConversationParams,
  target: WindowKey = "main",
) => {
  broadcastToWindow("JUMP_TO_SPECIFIED_CONVERSATION", params, target);
};

export const broadcastRepeatJumpToHistory = (
  params: ReadyJumpToHistoryParams,
  target: WindowKey = "main",
) => {
  broadcastToWindow("REPEAT_JUMP_TO_HISTORY", params, target);
};

export const broadcastSetMomentsUser = (params: RouteTravel) => {
  broadcastToWindow("SET_MOMENTS_USER", params, "moments");
};

export const broadcastClearMomentsUnreadCount = () => {
  broadcastToWindow("CLEAR_MOMENTS_UNREAD_COUNT", undefined, "main");
};

export const broadcastCheckAppUpdate = (
  params: AppUpdateCheckPayload,
  target: WindowKey = "main",
) => {
  broadcastToWindow("CHECK_APP_UPDATE", params, target);
};
