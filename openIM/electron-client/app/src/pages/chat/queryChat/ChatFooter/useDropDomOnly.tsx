import { bytesToSize } from "@openim/shared";
import { MessageType } from "@openim/wasm-client-sdk";
import { useDrop, useUpdate } from "ahooks";
import { t } from "i18next";
import { useEffect } from "react";

import { modal } from "@/AntdGlobalComp";
import { IMSDK } from "@/layout/MainContentWrap";
import { ExMessageItem, useConversationStore } from "@/store";
import { getFileIcon } from "@/utils/media";

import { SendMessageParams } from "./useSendMessage";

export function useDropDomOnly({
  domRef,
  sendMessage,
}: {
  domRef?: React.RefObject<HTMLDivElement>;
  sendMessage: (params: SendMessageParams) => void;
}) {
  const update = useUpdate();

  useEffect(() => {
    setTimeout(() => {
      update();
    });
  }, []);

  useDrop(domRef, {
    onDom: ({ message }: { message: ExMessageItem }, e) => {
      const conversationName =
        useConversationStore.getState().currentConversation?.showName;
      const { fileName, fileSize } = getFileData(message);
      modal.confirm({
        title: `${t("chat.action.sendTo")}${conversationName}`,
        icon: null,
        width: 320,
        className: "drop-file-moal",
        centered: true,
        content: (
          <div className="h-60 overflow-y-auto border-t border-b border-(--gap-text) p-2">
            <div className="mb-2 flex items-center">
              <img width={38} src={getFileIcon(fileName)} alt="file" />
              <div className="ml-3 overflow-hidden">
                <div className="mb-1.5 truncate">{fileName}</div>
                <div className="text-xs text-(--sub-text)">{bytesToSize(fileSize)}</div>
              </div>
            </div>
          </div>
        ),
        okText: t("common.text.confirm"),
        cancelText: t("common.text.cancel"),
        onOk: async () => {
          const newMessage = (await IMSDK.createForwardMessage(message)).data;
          sendMessage({
            message: newMessage,
          });
        },
      });
      e?.preventDefault();
    },
  });
}

const getFileData = (message: ExMessageItem) => {
  if (message.contentType === MessageType.PictureMessage) {
    const idx = message.pictureElem!.sourcePath?.lastIndexOf("/") ?? -1;
    return {
      fileName:
        idx > -1 ? message.pictureElem!.sourcePath.slice(idx + 1) : t("chat.file.file"),
      fileSize: message.pictureElem!.sourcePicture.size,
    };
  }
  if (message.contentType === MessageType.VideoMessage) {
    const idx = message.videoElem!.videoPath.lastIndexOf("/");
    return {
      fileName:
        idx > -1 ? message.videoElem!.videoPath.slice(idx + 1) : t("chat.file.file"),
      fileSize: message.videoElem!.videoSize,
    };
  }
  return {
    fileName: message.fileElem!.fileName,
    fileSize: message.fileElem!.fileSize,
  };
};
