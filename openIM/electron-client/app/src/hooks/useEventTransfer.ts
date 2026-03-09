import {
  useElectronDownloadHandler,
  useElectronEvent,
  useMomentsWindowEventHandler,
  useWindowEventHandler,
} from "./eventTransfer";

export {
  useElectronDownloadHandler,
  useElectronEvent,
  useMomentsWindowEventHandler,
  useWindowEventHandler,
};

export const useEventTransfer = () => {
  useElectronEvent();
  useElectronDownloadHandler();
  useWindowEventHandler();
  useMomentsWindowEventHandler();
};
