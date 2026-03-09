import { MessageItem } from "@openim/wasm-client-sdk";
import { Empty, Spin } from "antd";
import clsx from "clsx";
import { memo, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";

import JumpToMessageWrap from "@/components/JumpToMessageWrap";
import { useMessageFileDownloadState } from "@/hooks/useMessageFileDownloadState";
import FileDownloadIcon from "@/svg/FileDownloadIcon";
import { formatConversionTime } from "@/utils/imCommon";
import { getFileIcon } from "@/utils/media";

import { EmptyPlaceholder } from "./EmptyPlaceholder";
import styles from "./index.module.scss";
import { useKeyPage } from "./useKeyPage";

export type MessageItemForFilePanel = MessageItem & { conversationID: string };

export const FileRender = memo(
  ({
    id,
    message,
    isActive,
    onClick,
  }: {
    id?: string;
    message: MessageItemForFilePanel;
    isActive?: boolean;
    onClick?: () => void;
  }) => {
    const { progress, downloadState, tryDownload } =
      useMessageFileDownloadState(message);
    const fileIcon = getFileIcon(message.fileElem?.fileName);

    const showDownloadProgressTypes = ["downloading", "pause", "resume"];
    const showDownloadProgress = showDownloadProgressTypes.includes(downloadState);

    return (
      <JumpToMessageWrap
        message={message}
        isChildWindow
        conversationID={message.conversationID}
        viewInFinder={true}
      >
        <div
          id={id}
          onClick={() => onClick?.()}
          className={clsx(
            "flex items-center rounded px-3 py-2 hover:bg-(--primary-active)",
            {
              "bg-(--primary-active)": isActive,
            },
          )}
        >
          <div className="relative min-w-9.5 cursor-pointer" onClick={tryDownload}>
            <img width={38} src={fileIcon} alt="file" data-drag="app-drag" />
            {downloadState !== "finish" && (
              <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center rounded-md bg-[rgba(0,0,0,.4)]">
                <FileDownloadIcon
                  pausing={downloadState === "pause"}
                  percent={!showDownloadProgress ? 0 : progress}
                />
              </div>
            )}
          </div>
          <div className="ml-3 flex-1 overflow-hidden select-text">
            <div className="flex items-center">
              <div className="flex-1 truncate">{message.fileElem!.fileName}</div>
              <div className="ml-3 text-xs text-(--sub-text)">
                {formatConversionTime(message.sendTime)}
              </div>
            </div>
            <div className="mt-2 text-xs text-(--sub-text)">
              {message.senderNickname}
            </div>
          </div>
        </div>
      </JumpToMessageWrap>
    );
  },
);

const FilePanel = ({
  data,
  loading,
  isActive,
}: {
  data: MessageItemForFilePanel[];
  loading: boolean;
  isActive: boolean;
}) => {
  const { activeIdx, updateIdx } = useKeyPage({
    isActive,
    maxIndex: data.length,
    elPrefix: `#file-item-`,
    callback: (idx) => {
      const item = data[idx];
      if (item) {
        clickFile(idx);
      }
    },
  });

  useEffect(() => {
    if (loading || data.length === 0) {
      updateIdx(-1);
      return;
    }
    if (activeIdx >= data.length) {
      updateIdx(0);
    }
  }, [activeIdx, data.length, loading, updateIdx]);

  const clickFile = (index: number) => {
    updateIdx(index);
  };

  return (
    <Spin wrapperClassName="h-full" spinning={loading}>
      <Virtuoso
        className={styles["virtuoso-wrapper"]}
        data={data}
        components={{
          EmptyPlaceholder: () => (loading ? null : <EmptyPlaceholder />),
        }}
        itemContent={(idx, message) => (
          <FileRender
            message={message}
            id={`file-item-${idx}`}
            isActive={activeIdx === idx}
            onClick={() => updateIdx(idx)}
          />
        )}
      />
    </Spin>
  );
};

export default FilePanel;
