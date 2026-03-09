import { useEffect } from "react";

import { useUserStore } from "@/store";
import emitter from "@/utils/window/events";

export const useMomentsWindowEventHandler = () => {
  const { updateWorkMomentsUnreadCount } = useUserStore.getState();
  useEffect(() => {
    const clearMomentsUnreadCount = () => {
      updateWorkMomentsUnreadCount(0);
    };

    emitter.on("CLEAR_MOMENTS_UNREAD_COUNT", clearMomentsUnreadCount);
    return () => {
      emitter.off("CLEAR_MOMENTS_UNREAD_COUNT", clearMomentsUnreadCount);
    };
  }, []);
};
