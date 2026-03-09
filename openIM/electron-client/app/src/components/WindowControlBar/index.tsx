import { Platform } from "@openim/wasm-client-sdk";
import { useKeyPress } from "ahooks";
import { useCallback, useEffect, useState } from "react";

import win_close from "@/assets/images/topSearchBar/win_close.png";
import win_max from "@/assets/images/topSearchBar/win_max.png";
import win_min from "@/assets/images/topSearchBar/win_min.png";

const imCtrl = (window as any).imWindowControl;

const RestoreIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="4.5" width="8" height="6" rx="0.5" stroke="white" strokeWidth="1.2" />
    <path d="M4.5 4.5V2.5C4.5 2.22386 4.72386 2 5 2H10.5C10.7761 2 11 2.22386 11 2.5V8C11 8.27614 10.7761 8.5 10.5 8.5H10.5" stroke="white" strokeWidth="1.2" />
  </svg>
);

const WindowControlBar = () => {
  const [maximized, setMaximized] = useState(false);

  const checkMaximized = useCallback(() => {
    if (imCtrl) {
      setMaximized(imCtrl.isMaximized());
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(checkMaximized, 300);
    return () => clearInterval(interval);
  }, [checkMaximized]);

  useKeyPress("esc", () => {
    if (imCtrl) {
      imCtrl.minimize();
    } else {
      window.electronAPI?.minimizeWindow();
    }
  });

  const hasControl = window.electronAPI || imCtrl;
  const isMac =
    window.electronAPI?.getPlatform() === Platform.MacOSX ||
    imCtrl?.platform === Platform.MacOSX;

  if (!hasControl || isMac) {
    return null;
  }

  const handleMaximize = () => {
    if (imCtrl) {
      imCtrl.maximize();
      setTimeout(checkMaximized, 100);
    } else {
      window.electronAPI?.maxmizeWindow();
    }
  };

  return (
    <div className="absolute top-3.5 right-3 z-99999999 flex h-fit items-center">
      <div
        className="app-no-drag flex h-3.5 cursor-pointer items-center"
        onClick={() =>
          imCtrl ? imCtrl.minimize() : window.electronAPI?.minimizeWindow()
        }
      >
        <img
          className="app-no-drag cursor-pointer"
          width={14}
          src={win_min}
          alt="win_min"
        />
      </div>
      <div
        className="app-no-drag mx-3 flex cursor-pointer items-center"
        onClick={handleMaximize}
      >
        {maximized ? (
          <RestoreIcon />
        ) : (
          <img width={13} src={win_max} alt="win_max" />
        )}
      </div>
      <img
        className="app-no-drag cursor-pointer"
        width={12}
        src={win_close}
        alt="win_close"
        onClick={() =>
          imCtrl ? imCtrl.close() : window.electronAPI?.closeWindow()
        }
      />
    </div>
  );
};

export default WindowControlBar;
