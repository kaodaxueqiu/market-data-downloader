import { GroupMemberRole, MessageStatus, MessageType } from "@openim/wasm-client-sdk";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "react-use";

import { modal } from "@/AntdGlobalComp";
import { useAddCollectRecord } from "@/api/hooks/collect";
import check from "@/assets/images/messageMenu/check.png";
import collect from "@/assets/images/messageMenu/collect.png";
import copy from "@/assets/images/messageMenu/copy.png";
import emoji from "@/assets/images/messageMenu/emoji.png";
import finder from "@/assets/images/messageMenu/finder.png";
import forward from "@/assets/images/messageMenu/forward.png";
import pin from "@/assets/images/messageMenu/pin.png";
import remove from "@/assets/images/messageMenu/remove.png";
import reply from "@/assets/images/messageMenu/reply.png";
import revoke from "@/assets/images/messageMenu/revoke.png";
import voice2text from "@/assets/images/messageMenu/voice2text.png";
import voice2text_cancel from "@/assets/images/messageMenu/voice2text_cancel.png";
import { useCheckConfirmModal } from "@/hooks/useCheckConfirmModal";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import { getSourceData } from "@/hooks/useMessageFileDownloadState";
import { useVoiceToText } from "@/hooks/useVoiceToText";
import { IMSDK } from "@/layout/MainContentWrap";
import {
  ExMessageItem,
  getImageMessageSourceUrl,
  getVideoMessageSourceUrl,
  useConversationStore,
  useMessageStore,
  useUserStore,
} from "@/store";
import { useCustomEmojiStore } from "@/store";
import { getMessageCachePath, resolveMessageLocalPath } from "@/utils/download";
import { feedbackToast } from "@/utils/feedback";
import { getLocalFileByPath } from "@/utils/file";
import { formatAtText, isGroupSession } from "@/utils/imCommon";
import { emit } from "@/utils/window/events";

import { deleteOneMessage, updateOneMessage } from "../useHistoryMessageList";

enum MessageMenuType {
  AddPhiz,
  Forward,
  Collect,
  Copy,
  Edit,
  Check,
  Reply,
  Revoke,
  Delete,
  SaveAs,
  Finder,
  Pin,
  VoiceToText,
}

const canPinTypes = [MessageType.TextMessage, MessageType.AtTextMessage];
const canCollectTypes = [
  MessageType.TextMessage,
  MessageType.AtTextMessage,
  MessageType.QuoteMessage,
  MessageType.PictureMessage,
  MessageType.VideoMessage,
  MessageType.FileMessage,
  MessageType.VoiceMessage,
  MessageType.CardMessage,
  MessageType.MergeMessage,
];
const canCopyTypes = [
  MessageType.TextMessage,
  MessageType.QuoteMessage,
  MessageType.AtTextMessage,
  MessageType.PictureMessage,
];
const canEditTypes = [
  MessageType.TextMessage,
  MessageType.QuoteMessage,
  MessageType.AtTextMessage,
];
const canAddPhizTypes = [MessageType.PictureMessage, MessageType.FaceMessage];
const canDownloadTypes = [
  MessageType.PictureMessage,
  MessageType.VideoMessage,
  MessageType.FileMessage,
];
const canSaveAsTypes = [
  MessageType.PictureMessage,
  MessageType.VideoMessage,
  MessageType.FileMessage,
];

const MessageMenuContent = ({
  message,
  conversationID,
  closeMenu,
  editMessage,
}: {
  message: ExMessageItem;
  conversationID: string;
  closeMenu: () => void;
  editMessage?: () => void;
}) => {
  const { t } = useTranslation();
  const { voiceToTextStatus, tryVoiceToText, cancelVoiceToText } = useVoiceToText({
    message,
    conversationID,
  });
  const { mutate: addCollect } = useAddCollectRecord();
  const messageMenuList = [
    {
      idx: MessageMenuType.AddPhiz,
      title: t("chat.action.add"),
      icon: emoji,
      hidden: false,
    },
    {
      idx: MessageMenuType.Forward,
      title: t("chat.action.forward"),
      icon: forward,
      hidden: false,
    },
    {
      idx: MessageMenuType.Collect,
      title: t("chat.action.collect"),
      icon: collect,
      hidden: false,
    },
    {
      idx: MessageMenuType.Copy,
      title: t("chat.action.copy"),
      icon: copy,
      hidden: false,
    },
    {
      idx: MessageMenuType.Edit,
      title: t("chat.action.edit"),
      icon: copy,
      hidden: false,
    },
    {
      idx: MessageMenuType.Check,
      title: t("chat.action.check"),
      icon: check,
      hidden: false,
    },
    {
      idx: MessageMenuType.Reply,
      title: t("common.text.reply"),
      icon: reply,
      hidden: false,
    },
    {
      idx: MessageMenuType.Revoke,
      title: t("chat.action.revoke"),
      icon: revoke,
      hidden: false,
    },
    {
      idx: MessageMenuType.Delete,
      title: t("chat.action.delete"),
      icon: remove,
      hidden: false,
    },
    {
      idx: MessageMenuType.SaveAs,
      title: t("chat.action.saveAs"),
      icon: finder,
      hidden: false,
    },
    {
      idx: MessageMenuType.Finder,
      title: t("common.text.finder"),
      icon: finder,
      hidden: false,
    },
    {
      idx: MessageMenuType.Pin,
      title: t("chat.action.pin"),
      icon: pin,
      hidden: false,
    },
    {
      idx: MessageMenuType.VoiceToText,
      title:
        voiceToTextStatus === "idle"
          ? t("chat.action.voiceToText")
          : t("chat.action.cancelVoiceToText"),
      icon: voiceToTextStatus === "idle" ? voice2text : voice2text_cancel,
      hidden: false,
    },
  ];
  const copying = useRef(false);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const ownerUserID = useConversationStore(
    (state) => state.currentGroupInfo?.ownerUserID,
  );
  const updateCheckMode = useMessageStore((state) => state.updateCheckMode);
  const updateQuoteMessage = useConversationStore((state) => state.updateQuoteMessage);
  const addRevokedMessage = useConversationStore((state) => state.addRevokedMessage);
  const addPinnedMessage = useConversationStore((state) => state.addPinnedMessage);

  const [_, copyToClipboard] = useCopyToClipboard();
  const { isNomal, isAdmin, isOwner } = useCurrentMemberRole();

  const isSender = message.sendID === selfUserID;
  const [senderRoleLevel, setSenderRoleLevel] = useState<GroupMemberRole>();

  const { showCheckConfirmModal } = useCheckConfirmModal();

  const getCustomEmojiData = async () => {
    let sourceData = {
      path: "",
      url: "",
      width: 0,
      height: 0,
    };
    if (message.contentType === MessageType.PictureMessage) {
      sourceData = {
        path: message.pictureElem!.sourcePath,
        url: message.pictureElem!.sourcePicture.url,
        width: message.pictureElem!.sourcePicture.width,
        height: message.pictureElem!.sourcePicture.height,
      };
    }
    if (message.contentType === MessageType.FaceMessage) {
      const faceEl = JSON.parse(message.faceElem!.data);
      sourceData = {
        path: faceEl.path ?? "",
        url: faceEl.url,
        width: faceEl.width,
        height: faceEl.height,
      };
    }
    if (window.electronAPI?.fileExists(sourceData.path)) {
      return sourceData;
    }
    const cachedPath = getMessageCachePath(message);
    if (cachedPath) {
      sourceData.path = cachedPath;
      return sourceData;
    }

    const blob = await fetch(sourceData.url).then((response) => response.blob());
    const file = new File([blob], getFileNameFromUrl(sourceData.url), {
      type: blob.type,
    });
    sourceData.path =
      (await window.electronAPI?.saveFileToDisk({
        file,
        type: "fileCache",
        sync: true,
      })) ?? "";
    return sourceData;
  };

  const getFileNameFromUrl = (url: string) => {
    const idx = url.lastIndexOf("/");
    return url.slice(idx + 1);
  };

  const getFileNameFromPath = (filePath: string) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  };

  const getRemoteFile = async (sourceUrl: string, fallbackName?: string) => {
    if (sourceUrl.startsWith("file://")) {
      return getLocalFileByPath(sourceUrl.replace("file://", ""));
    }
    const blob = await fetch(sourceUrl).then((response) => response.blob());
    return new File([blob], fallbackName || getFileNameFromUrl(sourceUrl), {
      type: blob.type,
    });
  };

  const getSaveFile = async () => {
    if (message.contentType === MessageType.PictureMessage) {
      const localFile = await getLocalFileByPath(message.pictureElem?.sourcePath);
      if (localFile) return localFile;
      const sourceUrl = getImageMessageSourceUrl(message);
      if (!sourceUrl) return null;
      return getRemoteFile(sourceUrl);
    }

    if (message.contentType === MessageType.VideoMessage) {
      const localFile = await getLocalFileByPath(
        resolveMessageLocalPath(message) || message.videoElem?.videoPath,
      );
      if (localFile) return localFile;
      const sourceUrl = getVideoMessageSourceUrl(message) || getSourceData(message).url;
      if (!sourceUrl) return null;
      return getRemoteFile(sourceUrl);
    }

    if (message.contentType === MessageType.FileMessage) {
      const localFile = await getLocalFileByPath(
        resolveMessageLocalPath(message) || message.fileElem?.filePath,
      );
      if (localFile) return localFile;
      const sourceUrl = getSourceData(message).url;
      if (!sourceUrl) return null;
      return getRemoteFile(sourceUrl, message.fileElem?.fileName);
    }

    return null;
  };

  const getSaveFileDefaultName = (file: File) => {
    if (message.contentType === MessageType.FileMessage) {
      return message.fileElem?.fileName || file.name || "file";
    }
    if (message.contentType === MessageType.VideoMessage) {
      return (
        file.name ||
        (message.videoElem?.videoPath
          ? getFileNameFromPath(message.videoElem.videoPath)
          : "video")
      );
    }
    if (message.contentType === MessageType.PictureMessage) {
      return (
        file.name ||
        (message.pictureElem?.sourcePath
          ? getFileNameFromPath(message.pictureElem.sourcePath)
          : "image")
      );
    }
    return file.name || "file";
  };

  const saveAs = async () => {
    try {
      if (!window.electronAPI?.showSaveDialog || !window.electronAPI?.saveFileToPath) {
        return;
      }
      const file = await getSaveFile();
      if (!file) {
        feedbackToast({ msg: t("system.toast.accessFailed") });
        return;
      }
      const defaultName = getSaveFileDefaultName(file);
      const { canceled, filePath } = await window.electronAPI.showSaveDialog({
        defaultPath: defaultName,
      });
      if (canceled || !filePath) return;
      await window.electronAPI.saveFileToPath({ file, filePath, sync: true });
      feedbackToast({ msg: t("common.toast.accessSuccess") });
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.accessFailed") });
    }
  };

  const customEmojis = useCustomEmojiStore((state) => state.customEmojis);
  const addCustomEmoji = useCustomEmojiStore((state) => state.addCustomEmoji);
  const refreshCustomEmojis = useCustomEmojiStore((state) => state.refreshCustomEmojis);

  const menuClick = (idx: MessageMenuType) => {
    switch (idx) {
      case MessageMenuType.AddPhiz:
        handleAddCustomEmoji();
        break;
      case MessageMenuType.Forward:
        emit("OPEN_CHOOSE_MODAL", {
          type: "FORWARD_MESSAGE",
          extraData: { kind: "forward", message },
        });
        break;
      case MessageMenuType.Collect:
        addCollect(
          { clientMsgID: message.clientMsgID, content: JSON.stringify(message) },
          {
            onSuccess: () => feedbackToast({ msg: t("chat.toast.addSuccess") }),
            onError: (error) => {
              if ((error as { errCode?: number })?.errCode === 1003) {
                feedbackToast({ msg: t("chat.toast.alreadyCollected") });
              } else {
                feedbackToast({ error });
              }
            },
          },
        );
        break;
      case MessageMenuType.Copy:
        if (message.contentType === MessageType.PictureMessage) {
          copyImage();
        } else {
          copyToClipboard(getCopyText().trim());
          feedbackToast({ msg: t("common.toast.copySuccess") });
        }
        break;
      case MessageMenuType.Edit:
        editMessage?.();
        break;
      case MessageMenuType.Check:
        updateOneMessage({
          ...message,
          checked: true,
        } as ExMessageItem);
        updateCheckMode(true);
        break;
      case MessageMenuType.Reply:
        updateQuoteMessage(message);
        break;
      case MessageMenuType.Revoke:
        modal.confirm({
          title: t("chat.toast.revokeMessage"),
          content: t("chat.toast.revokeConfirm"),
          onOk: tryRevoke,
        });
        break;
      case MessageMenuType.Delete:
        showCheckConfirmModal({
          title: t("chat.toast.deleteMessage"),
          confirmTip: t(
            isSender ? "common.toast.mutualDelete" : "common.toast.deleteConfirm",
          ),
          description: isSender ? t("chat.toast.deleteDescription") : undefined,
          showCheckbox: isSender,
          onOk: tryRemove,
        });
        break;
      case MessageMenuType.SaveAs:
        saveAs();
        break;
      case MessageMenuType.Finder:
        window.electronAPI?.showInFinder(
          resolveMessageLocalPath(message) || getSourceData(message).path,
        );
        break;
      case MessageMenuType.Pin:
        addPinnedMessage(conversationID, message).catch((error) => {
          feedbackToast({ error });
        });
        break;
      case MessageMenuType.VoiceToText:
        if (voiceToTextStatus === "idle") {
          tryVoiceToText();
          break;
        }
        cancelVoiceToText();
        break;
      default:
        break;
    }
    closeMenu();
  };

  useEffect(() => {
    refreshCustomEmojis();
  }, [refreshCustomEmojis]);

  useEffect(() => {
    setSenderRoleLevel(undefined);

    if (!isGroupSession(message.sessionType) || !isAdmin || isSender) {
      return;
    }

    let isMounted = true;

    if (!isMounted) return;
    IMSDK.getSpecifiedGroupMembersInfo({
      groupID: message.groupID,
      userIDList: [message.sendID],
    })
      .then(({ data }) => {
        setSenderRoleLevel(data?.[0]?.roleLevel);
      })
      .catch(() => {
        setSenderRoleLevel(undefined);
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isSender, message.sendID, message.sessionType]);

  const handleAddCustomEmoji = async () => {
    try {
      const customEmojiData = await getCustomEmojiData();
      const found = customEmojis.find((item) => item.url === customEmojiData.url);
      if (found) {
        feedbackToast({ msg: t("chat.toast.customEmojiAlreadyAdded") });
        return;
      }
      await addCustomEmoji(customEmojiData);
      feedbackToast({ msg: t("chat.toast.addSuccess") });
    } catch (error) {
      console.error("Failed to add custom emoji:", error);
      feedbackToast({ msg: t("chat.toast.addFailed"), error });
    }
  };

  const copyImage = async () => {
    let error;
    if (copying.current) return;
    copying.current = true;
    try {
      const sourceUrl = getImageMessageSourceUrl(message);
      let blob = await fetch(sourceUrl).then((response) => response.blob());
      if (blob.type !== "image/png") {
        blob = await convertToPng(blob);
      }

      await navigator.clipboard.write([
        new window.ClipboardItem({
          "image/png": blob,
        }),
      ]);
    } catch (err) {
      error = err;
      console.error(error);
    }
    feedbackToast({
      error,
      msg: error ? t("chat.toast.copyFailed") : t("common.toast.copySuccess"),
    });
    copying.current = false;
  };

  const tryRevoke = async () => {
    try {
      await IMSDK.revokeMessage({ conversationID, clientMsgID: message.clientMsgID });
      updateOneMessage({
        ...message,
        contentType: MessageType.RevokeMessage,
        notificationElem: {
          detail: JSON.stringify({
            clientMsgID: message.clientMsgID,
            revokeTime: Date.now(),
            revokerID: selfUserID,
            revokerNickname: t("system.text.you"),
            revokerRole: 0,
            seq: message.seq,
            sessionType: message.sessionType,
            sourceMessageSendID: message.sendID,
            sourceMessageSendTime: message.sendTime,
            sourceMessageSenderNickname: message.senderNickname,
          }),
        },
      });
      if (
        canCopyTypes.slice(0, 3).includes(message.contentType) &&
        message.sendID === selfUserID
      ) {
        addRevokedMessage(
          { ...message },
          message.atTextElem?.quoteMessage ?? message.quoteElem?.quoteMessage,
        );
      }
    } catch (error) {
      feedbackToast({ error });
    }
  };

  const tryRemove = async (mutual: boolean) => {
    try {
      if (message.status === MessageStatus.Failed) {
        await IMSDK.deleteMessageFromLocalStorage({
          clientMsgID: message.clientMsgID,
          conversationID,
        });
      } else {
        await IMSDK.deleteMessages({
          clientMsgIDs: [message.clientMsgID],
          conversationID,
          isSync: mutual,
        });
      }
      deleteOneMessage(message.clientMsgID);
    } catch (error) {
      feedbackToast({ error });
    }
  };

  const getCopyText = () => {
    const selection = window.getSelection()?.toString();

    if (message.contentType === MessageType.AtTextMessage) {
      return formatAtText(
        { ...message.atTextElem!, text: selection || message.atTextElem!.text },
        true,
      );
    }
    return selection || message.quoteElem?.text || message.textElem?.content || "";
  };

  const senderIsAdmin = senderRoleLevel === GroupMemberRole.Admin;
  const senderIsOwner = message.sendID === ownerUserID;
  const moreThanRevokeLimit = message.sendTime < Date.now() - 5 * 60 * 1000;
  const messageIsSuccess = message.status === MessageStatus.Succeed;
  const isPrivateChat = message.attachedInfoElem?.isPrivateChat;
  const privateCanShow = [
    MessageMenuType.AddPhiz,
    MessageMenuType.Copy,
    MessageMenuType.Check,
    MessageMenuType.Delete,
    MessageMenuType.SaveAs,
  ];

  return (
    <div className="app-no-drag p-1">
      {messageMenuList.map((menu) => {
        if (
          menu.idx === MessageMenuType.AddPhiz &&
          !canAddPhizTypes.includes(message.contentType)
        ) {
          return null;
        }

        if (
          menu.idx === MessageMenuType.Copy &&
          !canCopyTypes.includes(message.contentType)
        ) {
          return null;
        }

        if (
          menu.idx === MessageMenuType.Edit &&
          (!isSender || !canEditTypes.includes(message.contentType))
        ) {
          return null;
        }

        if (
          (menu.idx === MessageMenuType.Reply || menu.idx === MessageMenuType.Revoke) &&
          (!messageIsSuccess || message.contentType === MessageType.CustomMessage)
        ) {
          return null;
        }

        if (menu.idx === MessageMenuType.Revoke) {
          const isGroup = isGroupSession(message.sessionType);
          if (moreThanRevokeLimit && (!isGroup || (isGroup && isNomal))) return null;

          if (!isSender && !isGroup) return null;

          if (isGroup) {
            if (
              (isAdmin && (senderIsOwner || senderIsAdmin)) ||
              (isNomal && !isSender)
            ) {
              return null;
            }
          }
        }

        if (isPrivateChat && (!privateCanShow.includes(menu.idx) || message.isRead)) {
          return null;
        }

        if (menu.idx === MessageMenuType.Finder) {
          if (!canDownloadTypes.includes(message.contentType) || !window.electronAPI) {
            return null;
          }
          const sourceUrl =
            resolveMessageLocalPath(message) || getSourceData(message).path;
          if (!sourceUrl || !window.electronAPI?.fileExists(sourceUrl)) {
            return null;
          }
        }

        if (menu.idx === MessageMenuType.SaveAs) {
          if (!canSaveAsTypes.includes(message.contentType)) {
            return null;
          }
          if (!window.electronAPI?.showSaveDialog) {
            return null;
          }
          const sourceUrl =
            resolveMessageLocalPath(message) ||
            (message.contentType === MessageType.PictureMessage
              ? message.pictureElem?.sourcePath || getImageMessageSourceUrl(message)
              : message.contentType === MessageType.VideoMessage
                ? message.videoElem?.videoPath || getVideoMessageSourceUrl(message)
                : message.fileElem?.filePath || getSourceData(message).url);
          if (!sourceUrl) {
            return null;
          }
        }

        if (menu.idx === MessageMenuType.Pin) {
          if (
            !isGroupSession(message.sessionType) ||
            !(isAdmin || isOwner) ||
            !canPinTypes.includes(message.contentType)
          ) {
            return null;
          }
        }

        if (
          menu.idx === MessageMenuType.VoiceToText &&
          message.contentType !== MessageType.VoiceMessage
        ) {
          return null;
        }

        if (
          menu.idx === MessageMenuType.Collect &&
          !canCollectTypes.includes(message.contentType)
        ) {
          return null;
        }
        return (
          <div
            className="flex cursor-pointer items-center rounded px-3 py-2 hover:bg-(--primary-active)"
            key={menu.idx}
            onClick={() => menuClick(menu.idx)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <img className="mr-2 h-3.5" width={14} src={menu.icon} alt={menu.title} />
            <div className="text-xs">{menu.title}</div>
          </div>
        );
      })}
    </div>
  );
};

export default memo(MessageMenuContent);

async function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((pngBlob) => {
        resolve(pngBlob!);
      }, "image/png");
    };

    img.onerror = reject;

    img.src = URL.createObjectURL(blob);
  });
}
