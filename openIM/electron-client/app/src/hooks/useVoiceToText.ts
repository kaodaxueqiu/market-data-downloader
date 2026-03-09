import { normalizeAudioToPcmWavBase64 } from "@openim/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { IMSDK } from "@/layout/MainContentWrap";
import { ExMessageItem, useMessageStore } from "@/store";
import { getMessageCachePath } from "@/utils/download";
import { feedbackToast } from "@/utils/feedback";
import { getLocalFileByPath } from "@/utils/file";

type UseVoiceToTextParams = {
  message: ExMessageItem;
  conversationID: string;
};

export const useVoiceToText = ({ message, conversationID }: UseVoiceToTextParams) => {
  const { t } = useTranslation();
  const voiceToTextLoadingIds = useMessageStore((state) => state.voiceToTextLoadingIds);
  const addVoiceToTextLoading = useMessageStore((state) => state.addVoiceToTextLoading);
  const removeVoiceToTextLoading = useMessageStore(
    (state) => state.removeVoiceToTextLoading,
  );

  const isVoiceToTextLoading = voiceToTextLoadingIds.includes(message.clientMsgID);
  const hasVoiceText = message.soundElem?.text !== undefined;
  const voiceToTextStatus = isVoiceToTextLoading
    ? "loading"
    : hasVoiceText
      ? "done"
      : "idle";

  const updateVoiceTextLocalContent = useCallback(
    async (text?: { text: string; translate: Record<string, string> }) => {
      if (!message.soundElem) return;
      const tempMessage = {
        ...message,
        soundElem: {
          ...message.soundElem,
        },
      };
      if (text) {
        tempMessage.soundElem.text = text;
      } else {
        delete tempMessage.soundElem.text;
      }
      await IMSDK.setMessageLocalContent({
        conversationID,
        message: tempMessage,
      });
    },
    [conversationID, message],
  );

  const cancelVoiceToText = useCallback(async () => {
    // When user cancels during loading, remove loading state so UI stops and result is ignored.
    // "Clear" here means removing the local text content if it already exists.
    removeVoiceToTextLoading(message.clientMsgID);

    if (!message.soundElem?.text) return;
    await updateVoiceTextLocalContent();
  }, [message, removeVoiceToTextLoading, updateVoiceTextLocalContent]);

  const getVoiceFile = useCallback(async () => {
    const sourceUrl = message.soundElem?.sourceUrl;
    if (!sourceUrl) return null;
    if (window.electronAPI) {
      const cachedPath = getMessageCachePath(message);
      if (cachedPath) {
        const cachedFile = await getLocalFileByPath(cachedPath);
        if (cachedFile) return cachedFile;
      }
    }
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error("fetch voice file failed");
    }
    return response.blob();
  }, [message]);

  const tryVoiceToText = useCallback(async () => {
    if (isVoiceToTextLoading) return;
    let tempFilePath = "";
    try {
      // 1) mark as loading
      addVoiceToTextLoading(message.clientMsgID);
      // 2) load voice file (local cache first, fallback to network)
      const file = await getVoiceFile();
      if (!file) {
        feedbackToast({ error: true, msg: t("system.toast.accessFailed") });
        return;
      }

      // 3) normalize audio to PCM16 mono WAV and get base64 + metadata
      const transformed = await normalizeAudioToPcmWavBase64(file);

      let speechParams: { filename: string; data: string };
      if (window.electronAPI) {
        // 4) Electron: write temp file for SDK, pass filename
        const filename = await saveAsrAudioToLocalPath(
          transformed.base64,
          transformed.mime,
          message.clientMsgID,
        );
        if (!filename) {
          feedbackToast({ error: true, msg: t("system.toast.accessFailed") });
          return;
        }
        tempFilePath = filename;
        speechParams = { filename, data: "" };
      } else {
        // 4) Web: pass base64
        speechParams = { filename: "", data: transformed.base64 };
      }

      // 5) call speech-to-text
      const { data } = await IMSDK.speechToText(speechParams);
      // 6) avoid writing back if user canceled voiceToText while the request was in-flight
      if (
        !useMessageStore.getState().voiceToTextLoadingIds.includes(message.clientMsgID)
      ) {
        return;
      }
      // 7) update local message content with the recognized text
      await updateVoiceTextLocalContent({
        text: data.text,
        translate: {},
      });
    } catch (error) {
      feedbackToast({ error: true, msg: t("system.toast.accessFailed") });
    } finally {
      // 8) cleanup temp file (Electron) and loading state
      if (tempFilePath) {
        window.electronAPI?.deleteFile(tempFilePath);
      }
      removeVoiceToTextLoading(message.clientMsgID);
    }
  }, [
    addVoiceToTextLoading,
    getVoiceFile,
    isVoiceToTextLoading,
    message.clientMsgID,
    removeVoiceToTextLoading,
    updateVoiceTextLocalContent,
  ]);

  return {
    isVoiceToTextLoading,
    hasVoiceText,
    voiceToTextStatus,
    tryVoiceToText,
    cancelVoiceToText,
  };
};

const base64ToFileRaw = (
  base64: string,
  filename: string,
  mime = "application/octet-stream",
): File => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
};

const getAudioExtension = (mime: string): string => {
  const cleanMime = mime.split(";")[0]?.trim().toLowerCase();
  if (!cleanMime) return "wav";
  if (cleanMime === "audio/mpeg") return "mp3";
  if (cleanMime === "audio/x-wav") return "wav";
  const parts = cleanMime.split("/");
  return parts[1] || "wav";
};

const saveAsrAudioToLocalPath = async (
  base64: string,
  mime: string,
  clientMsgID: string,
): Promise<string> => {
  if (!window.electronAPI?.saveFileToDisk) {
    return "";
  }
  const ext = getAudioExtension(mime);
  const file = base64ToFileRaw(base64, `voice2text-${clientMsgID}.${ext}`, mime);
  return window.electronAPI.saveFileToDisk({
    file,
    type: "fileCache",
    sync: true,
  });
};
