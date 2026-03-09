import { bytesToSize } from "@openim/shared";
import { MessageStatus } from "@openim/wasm-client-sdk";
import { useDrag } from "ahooks";
import { Spin } from "antd";
import { FC, useRef } from "react";

import { MessageRenderContext } from "@/constants";
import { useMessageFileDownloadState } from "@/hooks/useMessageFileDownloadState";
import { useMessageStore } from "@/store";
import FileDownloadIcon from "@/svg/FileDownloadIcon";
import { getDownloadTask } from "@/utils/download";
import { getFileIcon } from "@/utils/media";

import { IMessageItemProps } from ".";
import { useMessageUploadProgress } from "./useMessageUploadProgress";

const FileMessageRenderer: FC<IMessageItemProps> = ({ message, renderContext }) => {
  const { fileElem } = message;
  const dragRef = useRef(null);

  const { downloadState, tryDownload } = useMessageFileDownloadState(message);

  const currentTask = useMessageStore((state) =>
    getDownloadTask({
      downloadMap: state.downloadMap,
      compareKey: "clientMsgID",
      compareValue: message.clientMsgID,
    }),
  );

  const uploadProgress = useMessageUploadProgress(message.clientMsgID);

  const isSending = message.status === MessageStatus.Sending;
  const isSucceed = message.status === MessageStatus.Succeed;
  const avoidPreview = renderContext === MessageRenderContext.CollectionPreview;

  // useDrag({ message }, dragRef, {
  // onDragStart: (e) => {
  //   const filePath = message.localEx || message.fileElem?.filePath;
  //   if (filePath && window.electronAPI?.fileExists(filePath)) {
  //     e.preventDefault();
  //     window.electronAPI.dragFile(, filePath);
  //   }
  // },
  // });

  const showDownloadProgressTypes = ["downloading", "pause", "resume"];
  const showDownloadProgress = showDownloadProgressTypes.includes(downloadState);

  return (
    <Spin spinning={isSending} tip={`${uploadProgress}%`}>
      <div
        ref={dragRef}
        onClick={avoidPreview ? undefined : tryDownload}
        className="flex w-60 cursor-pointer items-center justify-between rounded-md border border-(--gap-text) p-3"
      >
        <div className="mr-2 flex h-full flex-1 flex-col justify-between overflow-hidden">
          <div data-drag="app-drag" className="line-clamp-2 break-all">
            {fileElem!.fileName}
          </div>
          <div data-drag="app-drag" className="text-xs text-(--sub-text)">
            {bytesToSize(fileElem!.fileSize)}
          </div>
        </div>
        <div className="relative min-w-9.5">
          <img
            width={38}
            src={getFileIcon(fileElem?.fileName)}
            alt="file"
            data-drag="app-drag"
          />
          {!avoidPreview && isSucceed && downloadState !== "finish" && (
            <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center rounded-md bg-[rgba(0,0,0,.4)]">
              <FileDownloadIcon
                pausing={downloadState === "pause"}
                percent={!showDownloadProgress ? 0 : currentTask?.progress || 0}
              />
            </div>
          )}
        </div>
      </div>
    </Spin>
  );
};

export default FileMessageRenderer;
