import { Popover } from "antd";
import clsx from "clsx";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "react-use";

import copy from "@/assets/images/messageMenu/copy.png";
import voice2text_cancel from "@/assets/images/messageMenu/voice2text_cancel.png";
import { useVoiceToText } from "@/hooks/useVoiceToText";
import { ExMessageItem } from "@/store";
import { feedbackToast } from "@/utils/feedback";

import styles from "./message-item.module.scss";
type VoiceToTextBubleProps = {
  conversationID: string;
  message: ExMessageItem;
};

const VoiceToTextBubble: FC<VoiceToTextBubleProps> = ({ conversationID, message }) => {
  const { t } = useTranslation();
  const [_, copyToClipboard] = useCopyToClipboard();
  const { cancelVoiceToText, isVoiceToTextLoading, hasVoiceText } = useVoiceToText({
    message,
    conversationID,
  });
  const isLoading = isVoiceToTextLoading;
  const displayText = isLoading
    ? t("chat.message.voiceToTextLoading")
    : (message.soundElem?.text?.text ?? "");

  function menuSelected(key: VoiceToTextBubbleMenuOptions) {
    if (key === VoiceToTextBubbleMenuOptions.Copy) {
      if (!message.soundElem?.text?.text) return;
      copyToClipboard(message.soundElem.text.text);
      feedbackToast({ msg: t("common.toast.copySuccess") });
    } else if (key === VoiceToTextBubbleMenuOptions.CancelVoiceToText) {
      cancelVoiceToText();
    }
  }

  return (
    <Popover
      className={styles["menu-wrap"]}
      overlayClassName="app-no-drag"
      content={
        <VoiceToTextBubbleMenu
          onSelect={menuSelected}
          hideCopy={isLoading || !hasVoiceText || !message.soundElem?.text?.text}
        />
      }
      title={null}
      trigger="contextMenu"
      placement="bottom"
    >
      <div className={clsx(styles["bubble"], "mt-1 flex items-center")}>
        {isLoading && (
          <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border border-(--sub-text) border-t-transparent"></span>
        )}
        <span className="max-w-full">{displayText}</span>
      </div>
    </Popover>
  );
};

type VoiceToTextBubbleMenuProps = {
  onSelect: (key: VoiceToTextBubbleMenuOptions) => void;
  hideCopy?: boolean;
};

enum VoiceToTextBubbleMenuOptions {
  Copy = "Copy",
  CancelVoiceToText = "CancelVoiceToText",
}

const VoiceToTextBubbleMenu: FC<VoiceToTextBubbleMenuProps> = ({
  onSelect,
  hideCopy,
}) => {
  const { t } = useTranslation();

  const menuList = [
    {
      key: VoiceToTextBubbleMenuOptions.Copy,
      title: t("chat.action.copy"),
      icon: copy,
      hidden: hideCopy,
    },
    {
      key: VoiceToTextBubbleMenuOptions.CancelVoiceToText,
      title: t("chat.action.cancelVoiceToText"),
      icon: voice2text_cancel,
      hidden: false,
    },
  ];

  return (
    <div className="app-no-drag p-1">
      {menuList.map((menu) => {
        if (menu.hidden) return null;
        return (
          <div
            className="flex cursor-pointer items-center rounded px-3 py-2 hover:bg-(--primary-active)"
            key={menu.key}
            onClick={() => onSelect(menu.key)}
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

export default VoiceToTextBubble;
