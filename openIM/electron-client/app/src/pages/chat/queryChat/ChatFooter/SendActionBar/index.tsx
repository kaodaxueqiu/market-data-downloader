import { DownOutlined } from "@ant-design/icons";
import { Popover, PopoverProps, Tooltip, Upload } from "antd";
import { TooltipPlacement } from "antd/es/tooltip";
import clsx from "clsx";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, useCallback, useRef, useState } from "react";
import React from "react";
import { useTranslation } from "react-i18next";

import { message as antdMessage } from "@/AntdGlobalComp";
import { AudioOutlined } from "@ant-design/icons";
import card from "@/assets/images/chatFooter/card.png";
import cut from "@/assets/images/chatFooter/cut.png";
import emoji from "@/assets/images/chatFooter/emoji.png";
import file from "@/assets/images/chatFooter/file.png";
import image from "@/assets/images/chatFooter/image.png";
import markdown from "@/assets/images/chatFooter/markdown.png";
import { ExMessageItem } from "@/store";
import { emit } from "@/utils/window/events";

import { SendMessageParams } from "../useSendMessage";
import CutPopContent from "./CutPopContent";
import EmojiPopContent from "./EmojiPopContent";

const SendActionBar = ({
  sendEmoji,
  sendMessage,
  createFileMessage,
  onMarkdownClick,
  onVoiceClick,
}: {
  sendEmoji: (unicode: string) => void;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  createFileMessage: (file: File) => Promise<ExMessageItem>;
  onMarkdownClick?: () => void;
  onVoiceClick?: () => void;
}) => {
  const { t } = useTranslation();
  const blockCutRef = useRef(false);
  const [visibleState, setVisibleState] = useState({
    emoji: false,
    cut: false,
  });
  const sendActionList = [
    {
      title: t("chat.action.emoji"),
      icon: emoji,
      key: "emoji",
      accept: undefined,
      comp: <EmojiPopContent />,
      placement: "topLeft",
    },
    {
      title: t("chat.file.screenshot"),
      icon: cut,
      key: "cut",
      accept: undefined,
      comp: <CutPopContent />,
      placement: "bottomLeft",
    },
    {
      title: t("chat.file.image"),
      icon: image,
      key: "image",
      accept: "image/*",
      comp: null,
      placement: undefined,
    },
    {
      title: t("chat.contact.card"),
      icon: card,
      key: "card",
      accept: undefined,
      comp: null,
      placement: undefined,
    },
    {
      title: t("chat.file.file"),
      icon: file,
      key: "file",
      accept: "*",
      comp: null,
      placement: undefined,
    },
    {
      title: t("chat.composer.markdown"),
      icon: markdown,
      key: "markdown",
      accept: undefined,
      comp: null,
      placement: undefined,
    },
    {
      title: "语音",
      icon: null,
      key: "voice",
      accept: undefined,
      comp: null,
      placement: undefined,
    },
  ];

  const closeAllPop = useCallback(
    () => setVisibleState({ cut: false, emoji: false }),
    [],
  );
  const cutWithoutWindow = useCallback(async () => {
    blockCutRef.current = true;
    closeAllPop();
    if (window.electronAPI) {
      const canCapture = await window.electronAPI.checkMediaAccess("screen");
      if (!canCapture) {
        blockCutRef.current = false;
        return;
      }
    }
    window.electronCapturer?.startOverlay({ hideCurrentWindow: true });
    setTimeout(() => {
      blockCutRef.current = false;
    }, 300);
  }, [closeAllPop]);

  const actionClick = async (key: string) => {
    if (key === "card") {
      emit("OPEN_CHOOSE_MODAL", {
        type: "SELECT_CARD",
      });
    }
    if (key === "cut") {
      if (blockCutRef.current) {
        blockCutRef.current = false;
        return;
      }
      if (window.electronAPI) {
        const canCapture = await window.electronAPI.checkMediaAccess("screen");
        if (!canCapture) return;
      }
      window.electronCapturer?.startOverlay({ hideCurrentWindow: false });
    }
    if (key === "markdown") {
      onMarkdownClick?.();
    }
    if (key === "voice") {
      onVoiceClick?.();
    }
  };

  const fileHandle = async (options: UploadRequestOption) => {
    const fileEl = options.file as File;
    if (fileEl.size === 0) {
      antdMessage.warning(t("chat.empty.fileContentEmpty"));
      return;
    }
    const message = await createFileMessage(fileEl);
    sendMessage({
      message,
    });
  };

  return (
    <div className="flex items-center px-4.5 pt-2">
      {sendActionList.map((action) => {
        const isCut = action.key === "cut";

        const popProps: PopoverProps = {
          placement: action.placement as TooltipPlacement,
          content:
            action.comp &&
            React.cloneElement(action.comp as React.ReactElement, {
              sendEmoji,
              closeAllPop,
              cutWithoutWindow,
            }),
          title: null,
          arrow: false,
          trigger: "click",
          // @ts-ignore
          open: action.key ? visibleState[action.key] : false,
          onOpenChange: (visible) =>
            setVisibleState((state) => {
              const tmpState = { ...state };
              // @ts-ignore
              tmpState[action.key] = visible;
              return tmpState;
            }),
        };

        if (isCut) {
          return window.electronAPI ? (
            <div
              title={action.title}
              className="mr-5 flex cursor-pointer items-center last:mr-0"
              key={action.key}
              onClick={() => actionClick(action.key)}
            >
              <img src={action.icon} width={20} alt={action.title} />
              <Popover {...popProps}>
                <DownOutlined
                  className="ml-px scale-75 text-xs"
                  rev={undefined}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popover>
            </div>
          ) : null;
        }

        if (action.key === "voice") {
          return (
            <div
              key={action.key}
              title={action.title}
              className="mr-5 flex cursor-pointer items-center last:mr-0"
              onClick={() => actionClick(action.key)}
            >
              <AudioOutlined style={{ fontSize: 20, color: "#666" }} />
            </div>
          );
        }

        return (
          <ActionWrap
            popProps={popProps}
            key={action.key}
            accept={action.accept}
            fileHandle={fileHandle}
          >
            <div
              title={action.title}
              className={clsx("flex cursor-pointer items-center last:mr-0", {
                "mr-5": !action.accept,
              })}
              onClick={() => actionClick(action.key)}
            >
              <img src={action.icon} width={20} alt={action.title} />
            </div>
          </ActionWrap>
        );
      })}
    </div>
  );
};

export default memo(SendActionBar);

const ActionWrap = ({
  accept,
  popProps,
  children,
  fileHandle,
}: {
  accept?: string;
  children: ReactNode;
  popProps?: PopoverProps;
  fileHandle: (options: UploadRequestOption) => void;
}) => {
  return accept ? (
    <Upload
      showUploadList={false}
      customRequest={fileHandle}
      accept={accept}
      multiple
      className="mr-5 flex"
    >
      {children}
    </Upload>
  ) : (
    <Popover {...popProps}>{children}</Popover>
  );
};
