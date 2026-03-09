import "@openim/im-composer/styles.css";

import { AudioOutlined, CheckOutlined, CloseCircleOutlined, DownOutlined } from "@ant-design/icons";
import {
  type Attachment,
  IMComposer,
  type IMComposerRef,
  type MarkdownMessagePayload,
  type Member,
  type PlainMessagePayload,
  type SendKeymap,
} from "@openim/im-composer";
import { base64toFile, bytesToSize } from "@openim/shared";
import { GroupMemberItem } from "@openim/wasm-client-sdk";
import { useDebounceFn, useLatest, useThrottleFn } from "ahooks";
import { Dropdown, Image } from "antd";
import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import { message } from "@/AntdGlobalComp";
import { useMention } from "@/hooks/useMention";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import {
  deleteDraftCache,
  getDraftCache,
  setDraftCache,
} from "@/utils/cache/draftCache";
import { formatMessageByType } from "@/utils/imCommon";
import { getSendAction, setSendAction as saveSendAction } from "@/utils/storage";
import emitter from "@/utils/window/events";

import MarkdownEditor from "../MarkdownEditor";
import MentionListItem from "./MentionListItem";
import SendActionBar from "./SendActionBar";
import { FileWithPath, useFileMessage } from "./SendActionBar/useFileMessage";
import { useDropDomOnly } from "./useDropDomOnly";
import { useSendMessage } from "./useSendMessage";

export type DraftMap = {
  text?: string;
};

const ChatFooter: FC = () => {
  const { t } = useTranslation();
  const { conversationID } = useParams();
  const [sendAction, setSendAction] = useState(getSendAction());
  const [files, setFiles] = useState<Attachment[]>([]);
  const sendActions = [
    { label: t("chat.composer.sendWithEnter"), key: "enter" },
    { label: t("chat.composer.sendWithShiftEnter"), key: "ctrlEnter" },
  ];

  const editorWrapRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<IMComposerRef>(null);
  const markdownEditorRef = useRef<OverlayVisibleHandle>(null);

  const quoteMessage = useConversationStore((state) => state.quoteMessage);
  const latestQuoteMessage = useLatest(quoteMessage);
  const updateQuoteMessage = useConversationStore((state) => state.updateQuoteMessage);

  const { createFileMessage } = useFileMessage();
  const { sendMessage } = useSendMessage();
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder();

  const { fetchMentionUsers } = useMention();
  useDropDomOnly({ domRef: editorWrapRef, sendMessage });

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleVoiceClick = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    const result = await startRecording();
    if (!result) return;
    try {
      let msg;
      if (window.electronAPI?.enableCLib) {
        const soundPath =
          (await window.electronAPI.saveFileToDisk({
            file: result.file,
            sync: true,
            type: "sentFileCache",
          })) || `/${result.file.name}`;
        msg = (
          await IMSDK.createSoundMessageFromFullPath({
            soundPath,
            duration: result.duration,
          })
        ).data;
      } else {
        msg = (
          await IMSDK.createSoundMessageByFile({
            uuid: `voice_${Date.now()}`,
            soundPath: "",
            sourceUrl: "",
            dataSize: result.file.size,
            duration: result.duration,
            soundType: result.file.type,
            file: result.file,
          })
        ).data;
      }
      sendMessage({ message: msg });
    } catch (err) {
      console.error("[Voice] 发送语音失败:", err);
      message.error("语音发送失败");
    }
  }, [isRecording, startRecording, stopRecording, sendMessage]);

  const insertComposerText = useCallback((text: string, replace?: boolean) => {
    if (replace) {
      composerRef.current?.clear();
    }
    if (!text) return;
    composerRef.current?.focus();
    requestAnimationFrame(() => {
      composerRef.current?.insertText(text);
    });
  }, []);

  const addComposerAttachments = useCallback((files: File[]) => {
    const existing = composerRef.current?.getAttachments() ?? [];
    const nextAttachments: Attachment[] = files.map((file) => ({
      id: uuidv4(),
      file,
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      lastModified: file.lastModified,
    }));
    composerRef.current?.setAttachments([...existing, ...nextAttachments]);
  }, []);

  useEffect(() => {
    const dispose = window.electronCapturer?.onCaptureResult(({ dataUrl }) => {
      composerRef.current?.focus();
      const file = base64toFile(dataUrl);
      addComposerAttachments([file]);
      composerRef.current?.focus();
    });
    return () => {
      dispose?.();
    };
  }, [addComposerAttachments]);

  useEffect(() => {
    window.editRevoke = (clientMsgID: string) => {
      // eslint-disable-next-line
      let { quoteMessage, text, atEl } =
        useConversationStore.getState().revokeMap[clientMsgID];
      updateQuoteMessage(quoteMessage);
      if (atEl?.text) {
        text = atEl.text;
      }
      insertComposerText(text, true);
      setTimeout(() => composerRef.current?.focus());
    };
    const atHandler = (atUser: GroupMemberItem) => {
      composerRef.current?.insertMention(atUser.userID, atUser.nickname);
    };
    emitter.on("TRIGGER_GROUP_AT", atHandler);
    return () => {
      emitter.off("TRIGGER_GROUP_AT", atHandler);
    };
  }, [insertComposerText, updateQuoteMessage]);

  useEffect(() => {
    if (quoteMessage) {
      composerRef.current?.insertQuote(
        `${t("common.text.reply")} ${quoteMessage.senderNickname}：`,
        String(formatMessageByType(quoteMessage)),
      );
    }
  }, [quoteMessage]);

  useEffect(() => {
    checkSavedDraft();
    setTimeout(() => composerRef.current?.focus());

    return () => {
      checkDraftSave();
      changeInputState(false);
      composerRef.current?.clear();
    };
  }, [conversationID]);

  const checkSavedDraft = () => {
    if (!conversationID) return;

    // Restore from in-memory cache
    const cached = getDraftCache(conversationID);
    if (cached) {
      if (cached.editorState) {
        composerRef.current?.setDraft({
          editorState: cached.editorState,
          attachments: cached.attachments,
        });
      }
      if (cached.quote) {
        updateQuoteMessage(cached.quote);
      }
    }
  };

  const checkDraftSave = () => {
    if (!conversationID) return;

    const draft = composerRef.current?.getDraft();
    const hasDraft = Boolean(
      draft?.editorState || draft?.attachments?.length || latestQuoteMessage.current,
    );
    // Save to  cache
    if (hasDraft) {
      setDraftCache(conversationID, {
        editorState: draft?.editorState,
        quote: latestQuoteMessage.current ?? undefined,
        attachments: draft?.attachments,
      });
    } else {
      deleteDraftCache(conversationID);
    }

    // Save to SDK - use text if available, otherwise indicator
    let draftText = "";
    if (hasDraft) {
      const text = draft?.text?.trim() || "";
      draftText = JSON.stringify({ text });
    }
    IMSDK.setConversationDraft({
      conversationID,
      draftText,
    });
  };

  const changeInputState = (focus: boolean) => {
    const conversationID =
      useConversationStore.getState().currentConversation?.conversationID;
    if (!conversationID) return;
    IMSDK.changeInputStates({
      conversationID,
      focus,
    });
  };

  const { run: throttleTyping } = useThrottleFn(changeInputState, { wait: 1500 });
  const { run: debounceTyping } = useDebounceFn(changeInputState, { wait: 1500 });

  const handleChange = useCallback(() => {
    if (!useConversationStore.getState().currentConversation?.userID) return;
    const payload = composerRef.current?.exportPayload();
    const text =
      payload?.type === "text"
        ? payload.plainText
        : payload?.type === "markdown"
          ? payload.markdown
          : "";
    if (text) {
      throttleTyping(true);
    }
    debounceTyping(false);
  }, [debounceTyping, throttleTyping]);

  const getTextMessage = async (
    cleanText: string,
    mentions: PlainMessagePayload["mentions"],
  ) => {
    if (
      useConversationStore.getState().currentConversation?.groupID &&
      mentions.length > 0
    ) {
      const dedupedMentions = Array.from(
        new Map(mentions.map((item) => [item.userId, item])).values(),
      );
      return (
        await IMSDK.createTextAtMessage({
          text: cleanText,
          atUserIDList: dedupedMentions.map((at) => at.userId),
          atUsersInfo: dedupedMentions.map((at) => ({
            atUserID: at.userId,
            groupNickname: at.display,
          })),
          message: latestQuoteMessage.current,
        })
      ).data;
    }
    if (latestQuoteMessage.current) {
      return (
        await IMSDK.createQuoteMessage({
          text: cleanText,
          message: JSON.stringify(latestQuoteMessage.current),
        })
      ).data;
    }
    return (await IMSDK.createTextMessage(cleanText)).data;
  };

  const handleSendPayload = useCallback(
    async (payload: PlainMessagePayload | MarkdownMessagePayload) => {
      if (payload.type !== "text") return;
      const cleanText = payload.plainText.trim();
      const { attachments, mentions } = payload;

      if (attachments.length > 0) {
        await Promise.all(
          attachments.map(async (attachment) => {
            const message = await createFileMessage(attachment.file as FileWithPath);
            sendMessage({ message });
          }),
        );
      }

      if (!cleanText) return;

      const message = await getTextMessage(cleanText, mentions);
      sendMessage({ message });
      if (latestQuoteMessage.current) {
        updateQuoteMessage();
      }
    },
    [
      createFileMessage,
      getTextMessage,
      latestQuoteMessage,
      sendMessage,
      updateQuoteMessage,
    ],
  );

  const enterToSend = useCallback(async () => {
    const payload = composerRef.current?.exportPayload();
    if (!payload) return;
    if (payload.type === "text") {
      const hasText = payload.plainText.trim().length > 0;
      const hasAttachments = payload.attachments.length > 0;
      if (!hasText && !hasAttachments) return;
    }
    await handleSendPayload(payload);
    composerRef.current?.clear();
  }, [handleSendPayload]);

  const sendEmoji = useCallback(
    (unicode: string) => {
      insertComposerText(unicode);
    },
    [insertComposerText],
  );

  const cancelQuote = () => {
    updateQuoteMessage();
    composerRef.current?.focus();
  };

  const handleRemoveFile = useCallback((id: string) => {
    composerRef.current?.removeAttachment(id);
  }, []);

  const updateSendAction = (action: SendKeymap) => {
    setSendAction(action);
    saveSendAction(action);
  };

  const mentionProvider = useCallback(
    async (query: string): Promise<Member[]> => {
      const users = await fetchMentionUsers(query);
      return users.map((item) => ({
        userId: item.userID,
        display: item.nickname,
        avatarUrl: item.faceURL,
      }));
    },
    [fetchMentionUsers],
  );

  return (
    <footer className="h-full bg-white py-px">
      <div className="flex h-full flex-col border-t border-t-(--gap-text)">
        <SendActionBar
          sendEmoji={sendEmoji}
          sendMessage={sendMessage}
          createFileMessage={createFileMessage}
          onMarkdownClick={() => markdownEditorRef.current?.openOverlay()}
          onVoiceClick={handleVoiceClick}
        />
        <div
          ref={editorWrapRef}
          id="editor-wrap"
          className="relative flex flex-1 flex-col overflow-hidden"
        >
          {isRecording && (
            <div className="absolute inset-0 z-50 flex items-center justify-center gap-6 bg-white">
              <div className="flex items-center gap-3">
                <AudioOutlined
                  className="animate-pulse text-red-500"
                  style={{ fontSize: 28 }}
                />
                <span className="text-lg font-medium tabular-nums text-gray-700">
                  {formatDuration(duration)}
                </span>
                <span className="text-sm text-gray-400">录音中...</span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-200"
                onClick={cancelRecording}
              >
                <CloseCircleOutlined /> 取消
              </button>
              <button
                type="button"
                className="rounded-full bg-blue-500 px-5 py-1.5 text-sm text-white hover:bg-blue-600"
                onClick={stopRecording}
              >
                完成发送
              </button>
            </div>
          )}
          <IMComposer
            className="min-h-0 flex-1"
            ref={composerRef}
            mode="plain"
            placeholder=""
            onSend={enterToSend}
            maxMentions={10}
            mentionProvider={mentionProvider}
            keymap={{ send: sendAction }}
            onChange={handleChange}
            onQuoteRemoved={cancelQuote}
            showAttachmentPreview={false}
            onFilesChange={setFiles}
            renderMentionItem={MentionListItem}
            onMentionLimitExceeded={() => {
              message.warning(t("chat.toast.mentionLimitExceeded"));
            }}
            onContextMenu={
              !window.electronAPI
                ? undefined
                : () => window.electronAPI?.showInputContextMenu()
            }
          />
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            {/* Custom file list */}
            <div className="flex flex-1 items-center gap-3 overflow-x-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="relative flex shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5"
                >
                  {file.mime.startsWith("image/") && file.previewUrl ? (
                    <Image
                      src={file.previewUrl}
                      alt={file.name}
                      width={36}
                      height={36}
                      className="rounded"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-gray-200 text-lg">
                      📄
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="max-w-20 truncate text-xs" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {bytesToSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ml-1 text-gray-400 hover:text-red-500"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <Dropdown.Button
              overlayClassName="send-action-dropdown"
              className="w-fit shrink-0 px-6 py-1"
              type="primary"
              icon={<DownOutlined />}
              menu={{
                items: sendActions.map((item) => ({
                  label: item.label,
                  key: item.key,
                  itemIcon: sendAction === item.key ? <CheckOutlined /> : undefined,
                  onClick: () => updateSendAction(item.key as SendKeymap),
                })),
              }}
              onClick={enterToSend}
            >
              {t("common.text.send")}
            </Dropdown.Button>
          </div>
        </div>
      </div>
      <MarkdownEditor
        ref={markdownEditorRef}
        onSend={async (markdown) => {
          const message = (await IMSDK.createMarkdownMessage(markdown)).data;
          await sendMessage({ message });
        }}
      />
    </footer>
  );
};

export default memo(ChatFooter);
