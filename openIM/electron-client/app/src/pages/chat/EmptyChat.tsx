import { Button, Layout } from "antd";
import { useTranslation } from "react-i18next";

import empty_chat_bg from "@/assets/images/empty_chat_bg.png";
import { emit } from "@/utils/window/events";

export const EmptyChat = () => {
  const { t } = useTranslation();
  const createNow = () => {
    emit("OPEN_CHOOSE_MODAL", {
      type: "CRATE_GROUP",
    });
  };

  return (
    <div className="no-mobile flex h-full w-full items-center justify-center bg-white">
      <div>
        <div className="mb-12 flex flex-col items-center">
          <div className="mb-3 text-xl font-medium">{t("chat.group.createGroup")}</div>
          <div className="text-(--sub-text)">{t("chat.group.createGroupToast")}</div>
        </div>
        <img src={empty_chat_bg} alt="" width={320} />

        <div className="mt-28 flex justify-center">
          <Button className="px-8" type="primary" onClick={createNow}>
            {t("chat.action.createNow")}
          </Button>
        </div>
      </div>
    </div>
  );
};
