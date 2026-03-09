import { CheckOutlined, CloseOutlined, SmileOutlined } from "@ant-design/icons";
import { IMComposer, IMComposerRef, PlainMessagePayload } from "@openim/im-composer";
import { deepClone, formatBr } from "@openim/shared";
import { MessageType } from "@openim/wasm-client-sdk";
import { Popover, Spin } from "antd";
import clsx from "clsx";
import {
  forwardRef,
  ForwardRefRenderFunction,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { message as antdMessage } from "@/AntdGlobalComp";
import { MessageRenderContext } from "@/constants";
import { useMention } from "@/hooks/useMention";
import { IMSDK } from "@/layout/MainContentWrap";
import { escapeHtml } from "@/utils/escapeHtml";
import { feedbackToast } from "@/utils/feedback";
import { formatAtText, formatLink } from "@/utils/imCommon";

import MentionListItem from "../ChatFooter/MentionListItem";
import EmojiPopContent from "../ChatFooter/SendActionBar/EmojiPopContent";
import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

export type EditState = "preview" | "edit" | "updating";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightHtml = (html: string, keyword: string, className: string) => {
  if (!keyword.trim()) return html;
  const regex = new RegExp(escapeRegExp(keyword), "gi");
  return html
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(regex, `<span class="${className}">$&</span>`),
    )
    .join("");
};

const TextMessageRender: ForwardRefRenderFunction<
  { updateEditState: (state: EditState) => void },
  IMessageItemProps
> = ({ message, conversationID, renderContext, highlightKeyword }, ref) => {
  const { t } = useTranslation();
  let content = message.textElem?.content || "";
  let editAtContent = "";

  if (message.contentType === MessageType.QuoteMessage) {
    content = message.quoteElem!.text;
  }
  content = escapeHtml(content);
  if (message.contentType === MessageType.AtTextMessage) {
    const atEl = {
      ...message.atTextElem!,
      text: escapeHtml(message.atTextElem!.text),
    };
    content = formatAtText(atEl);
    editAtContent = message.atTextElem!.text;
  }

  content = formatLink(content);
  content = formatBr(content);

  if (renderContext === MessageRenderContext.Search && highlightKeyword) {
    content = highlightHtml(content, highlightKeyword, styles["keyword-highlight"]);
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<IMComposerRef>(null);
  const [editState, setEditState] = useState<EditState>("preview");
  const [emojiOpen, setEmojiOpen] = useState(false);

  const { fetchMentionUsers } = useMention();

  const mentionProvider = useCallback(
    async (query: string) => {
      const users = await fetchMentionUsers(query);
      return users.map((u) => ({
        userId: u.userID,
        display: u.nickname,
        avatarUrl: u.faceURL,
      }));
    },
    [fetchMentionUsers],
  );

  const handleInsertEmoji = useCallback((emoji: string) => {
    composerRef.current?.insertText(emoji);
    composerRef.current?.focus();
  }, []);

  const closeEmojiPop = useCallback(() => {
    setEmojiOpen(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      updateEditState: (state: EditState) => {
        if (state === "edit") {
          setTimeout(() => {
            let text = "";
            let mentions: { userId: string; display: string }[] = [];

            if (message.contentType === MessageType.AtTextMessage) {
              text = message.atTextElem?.text || "";
              mentions =
                message.atTextElem?.atUsersInfo?.map((u) => ({
                  userId: u.atUserID,
                  display: u.groupNickname || u.atUserID,
                })) || [];
            } else if (message.contentType === MessageType.QuoteMessage) {
              text = message.quoteElem?.text || "";
            } else {
              text = message.textElem?.content || "";
            }

            composerRef.current?.setText(text, mentions);
            composerRef.current?.focus();
          });
        }
        setEditState(state);
      },
    }),
    [message, editAtContent, content],
  );

  const cancelEdit = () => {
    setEditState("preview");
  };

  const handleEdit = async () => {
    const payload = composerRef.current?.exportPayload();
    const transformedText =
      payload?.type === "text"
        ? payload.plainText
        : payload?.type === "markdown"
          ? payload.markdown
          : "";
    if (!transformedText.trim()) {
      antdMessage.info(t("chat.toast.contentEmpty"));
      return;
    }

    const mentions = (payload as PlainMessagePayload).mentions || [];

    const newMessage = deepClone(message);

    if (newMessage.contentType === MessageType.TextMessage) {
      newMessage.textElem!.content = transformedText;
    } else if (newMessage.contentType === MessageType.QuoteMessage) {
      newMessage.quoteElem!.text = transformedText;
    } else if (newMessage.contentType === MessageType.AtTextMessage) {
      newMessage.atTextElem!.text = transformedText;
      newMessage.atTextElem!.atUsersInfo = mentions.map((m) => ({
        atUserID: m.userId,
        groupNickname: m.display,
      }));
    }

    setEditState("updating");
    try {
      await IMSDK.modifyMessage({
        message: newMessage,
        conversationID: conversationID!,
      });
    } catch (error: any) {
      if (error?.errCode === 1001) {
        console.error("modifyMessage", error);
      } else {
        feedbackToast({ error });
      }
    }
    setEditState("preview");
  };

  return editState === "preview" ? (
    <div
      className={`${styles.bubble} twemoji`}
      dangerouslySetInnerHTML={{ __html: content }}
    ></div>
  ) : (
    <Spin spinning={editState === "updating"}>
      <div
        ref={wrapperRef}
        className={clsx(
          "border-primary max-w-[50vw] min-w-70 rounded-xl border bg-white shadow-sm",
          styles["edit-wrapper"],
        )}
      >
        {/* Editor Area */}
        <div className="px-2 py-1">
          <IMComposer
            className="max-h-28"
            ref={composerRef}
            mode="plain"
            placeholder={t("common.text.pleaseEnter")}
            onSend={handleEdit}
            mentionProvider={mentionProvider}
            renderMentionItem={MentionListItem}
            enableAttachments={false}
            showAttachmentPreview={false}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1">
          {/* Left: Emoji Button */}
          <div className="flex items-center gap-2">
            <Popover
              content={
                <EmojiPopContent
                  sendEmoji={handleInsertEmoji}
                  closeAllPop={closeEmojiPop}
                />
              }
              trigger="click"
              open={emojiOpen}
              onOpenChange={setEmojiOpen}
              placement="topLeft"
              arrow={false}
            >
              <div className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-gray-100">
                <SmileOutlined className="text-base text-gray-500" />
              </div>
            </Popover>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              onClick={cancelEdit}
            >
              <CloseOutlined className="text-sm text-gray-400" />
            </div>
            <div
              className="bg-primary flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:opacity-90"
              onClick={handleEdit}
            >
              <CheckOutlined className="text-sm text-white" />
            </div>
          </div>
        </div>
      </div>
    </Spin>
  );
};

export default forwardRef(TextMessageRender);
