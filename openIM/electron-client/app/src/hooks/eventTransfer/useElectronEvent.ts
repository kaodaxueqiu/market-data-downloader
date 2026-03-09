import { useEffect } from "react";

import emitter from "@/utils/window/events";

export const useElectronEvent = () => {
  const onEventTransfer = ({ event, args }: { event: any; args: any }) => {
    emitter.emit(event, args);
  };
  useEffect(() => {
    const unsubscribeEmitTrasfer = window.electronAPI?.onEventTransfer(onEventTransfer);
    return () => {
      unsubscribeEmitTrasfer?.();
    };
  }, []);
};
