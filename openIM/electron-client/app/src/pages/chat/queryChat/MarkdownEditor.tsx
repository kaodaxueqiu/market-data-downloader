import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
} from "@ant-design/icons";
import { IMComposer, IMComposerRef } from "@openim/im-composer";
import { CbEvents, WSEvent } from "@openim/wasm-client-sdk";
import { Button } from "antd";
import { forwardRef, ForwardRefRenderFunction, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import DraggableModalWrap from "@/components/DraggableModalWrap";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { getIMComposerLocale } from "@/i18n/imComposerLocale";
import { IMSDK } from "@/layout/MainContentWrap";
import { uploadFile } from "@/utils/imCommon";

interface MarkdownEditorProps {
  onSend: (markdown: string) => Promise<void>;
}

const MarkdownEditorInner: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  MarkdownEditorProps
> = ({ onSend }, ref) => {
  const { t } = useTranslation();
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);
  const composerRef = useRef<IMComposerRef>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const imComposerLocale = useMemo(() => getIMComposerLocale(t), [t]);

  const handleSend = async () => {
    const payload = composerRef.current?.exportPayload();
    if (!payload || payload.type !== "markdown") {
      return;
    }

    const markdownPayload = payload;
    if (!markdownPayload.markdown.trim()) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(markdownPayload.markdown);
      composerRef.current?.clear();
      closeOverlay();
    } finally {
      setIsSending(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const uploadImage = async (
    file: File,
    onProgress?: (event: { progress: number }) => void,
  ) => {
    const uplaodHander = ({
      data: { fileSize, streamSize },
    }: WSEvent<{ fileSize: number; streamSize: number }>) => {
      onProgress?.({ progress: Math.round((streamSize / fileSize) * 100) });
    };
    IMSDK.on(CbEvents.UploadComplete, uplaodHander);
    const {
      data: { url },
    } = await uploadFile(file);
    IMSDK.off(CbEvents.UploadComplete, uplaodHander);
    return { url };
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={isFullscreen ? "90vw" : 760}
      centered
      onCancel={closeOverlay}
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          composerRef.current?.focus();
        }
      }}
      destroyOnClose
      className="no-padding-modal"
      mask={false}
      ignoreClasses=".ignore-drag, .cursor-pointer"
    >
      <div className="flex h-12 items-center justify-between bg-(--gap-text) px-5">
        <div className="font-medium">{t("chat.composer.formatMessageEditor")}</div>
        <div className="flex items-center gap-3">
          {isFullscreen ? (
            <FullscreenExitOutlined
              className="cursor-pointer text-(--sub-text)"
              onClick={toggleFullscreen}
            />
          ) : (
            <FullscreenOutlined
              className="cursor-pointer text-(--sub-text)"
              onClick={toggleFullscreen}
            />
          )}
          <CloseOutlined
            className="cursor-pointer text-(--sub-text)"
            rev={undefined}
            onClick={closeOverlay}
          />
        </div>
      </div>
      <div
        className="ignore-drag flex flex-col"
        style={{ height: isFullscreen ? "80vh" : "60vh" }}
      >
        <div className="flex-1 overflow-hidden py-4">
          <IMComposer
            ref={composerRef}
            mode="rich"
            className="h-full"
            locale={imComposerLocale}
            keymap={{ send: "ctrlEnter" }}
            placeholder={t("chat.composer.markdownEditorPlaceholder")}
            uploadImage={uploadImage}
            richToolbarConfig={{
              highlight: false,
              textAlign: false,
              underline: false,
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-(--gap-text) px-5 py-3">
          <Button className="border-0 bg-(--chat-bubble)" onClick={closeOverlay}>
            {t("common.text.cancel")}
          </Button>
          <Button type="primary" onClick={handleSend} loading={isSending}>
            {t("common.text.send")}
          </Button>
        </div>
      </div>
    </DraggableModalWrap>
  );
};

const MarkdownEditor = forwardRef(MarkdownEditorInner);

export default MarkdownEditor;
