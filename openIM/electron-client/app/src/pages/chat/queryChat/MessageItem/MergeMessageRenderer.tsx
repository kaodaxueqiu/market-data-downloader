import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCommonModal } from "@/pages/common";

import { IMessageItemProps } from ".";

const buildMergeTitle = (
  rawTitle: string,
  lang: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
) => {
  if (!rawTitle) return "";
  const match =
    rawTitle.match(/^Chat history for (.+)$/) || rawTitle.match(/^(.+)的聊天记录$/);
  if (!match) return rawTitle;
  let who = match[1].trim();
  const isZh = lang.startsWith("zh");
  who = isZh ? who.replace(/\s+and\s+/i, "和") : who.replace(/和/, " and ");
  return t("chat.message.whosMessageHistory", { who });
};

const MergeMessageRenderer: FC<IMessageItemProps> = ({ message }) => {
  const { showMergeModal } = useCommonModal();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "";
  const title = useMemo(
    () => buildMergeTitle(message.mergeElem?.title ?? "", lang, t),
    [message.mergeElem?.title, lang, t],
  );
  return (
    <div
      className="w-60 cursor-pointer rounded-md border border-(--gap-text)"
      onClick={() => showMergeModal?.(message.mergeElem!)}
    >
      <div className="border-b border-(--gap-text) px-4 py-2.5">{title}</div>
      <ul className="px-4 py-2.5 text-xs text-(--sub-text)">
        {message.mergeElem!.abstractList.map((item, idx) => (
          <li key={idx} className="twemoji mb-2 line-clamp-3 break-all last:mb-0">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MergeMessageRenderer;
