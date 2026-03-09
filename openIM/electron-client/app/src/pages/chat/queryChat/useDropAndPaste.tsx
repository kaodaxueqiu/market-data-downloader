import { bytesToSize } from "@openim/shared";
import { ConversationItem } from "@openim/wasm-client-sdk";
import { useDrop } from "ahooks";
import { t } from "i18next";
import { useState } from "react";

import { message, modal } from "@/AntdGlobalComp";
import { getFileIcon } from "@/utils/media";

import { useFileMessage } from "./ChatFooter/SendActionBar/useFileMessage";
import { useSendMessage } from "./ChatFooter/useSendMessage";

export function useDropAndPaste({
  currentConversation,
  getIsCanSendMessage,
}: {
  currentConversation?: ConversationItem;
  getIsCanSendMessage: () => boolean;
}) {
  const [droping, setDroping] = useState(false);
  const { createFileMessage } = useFileMessage();
  const { sendMessage } = useSendMessage();

  const dropEnd = () => {
    if (!droping) return;
    setDroping(false);
  };

  useDrop(document.getElementById("chat-container"), {
    onText: () => {
      dropEnd();
    },
    onFiles: async (files, e) => {
      // Ignore paste events from inside the composer/editor
      const target = e?.target as HTMLElement;
      if (target?.closest(".im-composer") || target?.closest("[contenteditable]")) {
        return;
      }

      if (!getIsCanSendMessage()) return;
      await Promise.all(files.map(async (file) => await checkIsFile(file))).then(
        (results) => {
          files = files.filter((_, index) => results[index]);
        },
      );
      if (!files.length) {
        message.error(t("chat.toast.fileTypeError"));
        dropEnd();
        return;
      }

      modal.confirm({
        title: `${t("chat.action.sendTo")}${currentConversation?.showName}`,
        icon: null,
        width: 320,
        centered: true,
        className: "drop-file-moal",
        content: (
          <div className="h-60 overflow-y-auto border-t border-b border-(--gap-text) p-2">
            {files.map((file) => (
              <div className="mb-2 flex items-center" key={file.lastModified}>
                <img width={38} src={getFileIcon(file.name, file.type)} alt="file" />
                <div className="ml-3 overflow-hidden">
                  <div className="mb-1.5 truncate">{file.name}</div>
                  <div className="text-xs text-(--sub-text)">
                    {bytesToSize(file.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ),
        okText: t("common.text.confirm"),
        cancelText: t("common.text.cancel"),
        onOk: () => {
          files.map(async (file) => {
            const message = await createFileMessage(file);
            sendMessage({
              message: message,
            });
          });
        },
      });

      dropEnd();
    },
    onUri: (_, e) => {
      e?.preventDefault();
      dropEnd();
    },
    onDom: (_, e) => {
      e?.preventDefault();
      dropEnd();
    },
    onDragEnter: (e) => {
      if (e?.dataTransfer.types[0] === "custom") return;
      if (!getIsCanSendMessage()) return;
      setDroping(true);
    },
    onDragLeave: dropEnd,
  });

  return {
    droping,
  };
}

const checkIsFile = (file: File) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(true);
    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
