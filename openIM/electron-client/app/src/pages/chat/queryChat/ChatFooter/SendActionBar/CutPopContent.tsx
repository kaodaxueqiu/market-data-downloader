import { t } from "i18next";
import { memo } from "react";

const CutPopConent = ({ cutWithoutWindow }: { cutWithoutWindow?: () => void }) => {
  return (
    <div className="p-1">
      <div
        className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-(--primary-active)"
        onClick={(e) => {
          e.stopPropagation();
          cutWithoutWindow?.();
        }}
      >
        {t("chat.file.screenshotHideWindow")}
      </div>
    </div>
  );
};

export default memo(CutPopConent);
