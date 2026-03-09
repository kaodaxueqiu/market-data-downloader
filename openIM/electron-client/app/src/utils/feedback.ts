import { t } from "i18next";
import type { MessageArgsProps } from "antd";

import { message } from "@/AntdGlobalComp";

type FeedbackToastParams = {
  type?: MessageArgsProps["type"];
  msg?: string | null;
  error?: unknown;
  duration?: number;
  onClose?: () => void;
};

interface FeedbackError extends Error {
  errMsg?: string;
  errDlt?: string;
}

export const feedbackToast = (config?: FeedbackToastParams) => {
  const { type, msg, error, duration, onClose } = config ?? {};
  let content = "";
  if (error) {
    content =
      (error as FeedbackError)?.message ??
      (error as FeedbackError)?.errDlt ??
      t("system.toast.accessFailed");
  }
  message.open({
    type: error ? "error" : type || "success",
    content: msg ?? content ?? t("common.toast.accessSuccess"),
    duration,
    onClose,
  });
  if (error) {
    console.error(msg, error);
  }
};
