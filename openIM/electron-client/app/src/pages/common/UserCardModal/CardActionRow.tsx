import { FriendUserItem, SelfUserInfo } from "@openim/wasm-client-sdk";
import { Space, Tooltip } from "antd";
import { t } from "i18next";
import { memo } from "react";

import { modal } from "@/AntdGlobalComp";
import cancel from "@/assets/images/common/cancel.png";
import card from "@/assets/images/common/card.png";
import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/feedback";
import { emit } from "@/utils/window/events";

const CardActionRow = ({
  isAgent,
  isFriend,
  isSelf,
  cardInfo,
  isBlackUser,
  closeOverlay,
}: {
  isAgent?: boolean;
  isFriend?: boolean;
  isSelf?: boolean;
  isBlackUser?: boolean;
  cardInfo?: Partial<SelfUserInfo & FriendUserItem>;
  closeOverlay: () => void;
}) => {
  const shareCard = () => {
    const cardMessageOptions = {
      userID: cardInfo?.userID ?? "",
      nickname: cardInfo?.nickname ?? "",
      faceURL: cardInfo?.faceURL ?? "",
      ex: cardInfo?.ex ?? "",
    };
    emit("OPEN_CHOOSE_MODAL", {
      type: "SHARE_CARD",
      extraData: { kind: "card", params: cardMessageOptions },
    });
    closeOverlay();
  };

  const tryUnfriend = () => {
    modal.confirm({
      title: t("contact.text.unfriend"),
      content: t("contact.toast.confirmUnfriend"),
      onOk: async () => {
        try {
          await IMSDK.deleteFriend(cardInfo!.userID!);
          feedbackToast({ msg: t("contact.toast.unfriendSuccess") });
        } catch (error) {
          feedbackToast({ error, msg: t("contact.toast.unfriendFailed") });
        }
      },
    });
    closeOverlay();
  };

  return (
    <div className="flex items-center">
      <Space size={4}>
        <Tooltip title={t("common.text.share")} placement="bottom">
          <img
            className="cursor-pointer"
            width={18}
            src={card}
            alt=""
            onClick={shareCard}
          />
        </Tooltip>
        {isFriend && (
          <Tooltip title={t("contact.text.unfriend")} placement="bottom">
            <img
              className="cursor-pointer"
              width={18}
              src={cancel}
              alt=""
              onClick={tryUnfriend}
            />
          </Tooltip>
        )}
        {/* {!isAgent && (
          <Tooltip title={t("contact.text.moments")} placement="bottom">
            <img
              className="cursor-pointer"
              width={18}
              src={bench}
              alt=""
              onClick={showMoments}
            />
          </Tooltip>
        )} */}
      </Space>
    </div>
  );
};

export default memo(CardActionRow);
