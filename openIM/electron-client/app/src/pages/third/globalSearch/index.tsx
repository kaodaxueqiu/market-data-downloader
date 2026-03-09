import { CloseOutlined } from "@ant-design/icons";
import { useKeyPress } from "ahooks";
import { useEffect } from "react";

import { BusinessUserInfo } from "@/api";
import {
  useElectronDownloadHandler,
  useElectronEvent,
  useWindowEventHandler,
} from "@/hooks/useEventTransfer";
import { GlobalSearchContent } from "@/pages/common/GlobalSearchModal";
import { useMessageStore, useUserStore } from "@/store";
import { setChatToken } from "@/utils/storage";

export const GlobalSearch = () => {
  const str = window.location.href.split("precheck=")[1];
  const precheck = JSON.parse(decodeURIComponent(str));
  useElectronEvent();
  useWindowEventHandler();
  useElectronDownloadHandler();

  const initDownloadCache = useMessageStore((state) => state.initDownloadCache);

  useEffect(() => {
    const init = () => {
      if (precheck.token) {
        setChatToken(precheck.token as string);
      }
      if (precheck.user) {
        useUserStore.getState().updateSelfInfo(precheck.user as BusinessUserInfo);
      }
    };
    init();
  }, []);

  useEffect(() => {
    initDownloadCache();
  }, [initDownloadCache]);

  const closeOverlay = () => {
    // null function
  };

  useKeyPress(27, () => {
    window.electronAPI?.closeWindow("global-search");
  });

  return (
    <div className="relative flex h-full flex-col">
      <div className="app-drag flex shrink-0 justify-end px-5 pt-2">
        <CloseOutlined
          className="app-no-drag cursor-pointer"
          onClick={() => {
            window.electronAPI?.closeWindow("global-search");
          }}
        />
      </div>
      <div className="min-h-0 flex-1">
        <GlobalSearchContent
          closeOverlay={closeOverlay}
          isOrganizationMember={precheck.isOrganizationMember}
        />
      </div>
    </div>
  );
};
