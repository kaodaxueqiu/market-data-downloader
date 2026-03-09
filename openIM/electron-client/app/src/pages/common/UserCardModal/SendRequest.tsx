import { LeftOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Button, Input, message } from "antd";
import { t } from "i18next";
import { useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import { IMSDKErrCode } from "@/constants";
import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/feedback";

import { CardInfo } from ".";

const SendRequest = ({
  cardInfo,
  backToCard,
}: {
  cardInfo: CardInfo;
  backToCard: () => void;
}) => {
  const [reqMsg, setReqMsg] = useState("");
  const { mutateAsync: addFriend, isPending } = useMutation<
    unknown,
    unknown,
    Parameters<typeof IMSDK.addFriend>[0]
  >({
    mutationFn: (params) => IMSDK.addFriend(params),
  });

  const sendApplication = async () => {
    try {
      await addFriend({
        toUserID: cardInfo.userID!,
        reqMsg,
      });
      feedbackToast({ msg: t("common.toast.sendFreiendRequestSuccess") });
    } catch (error) {
      if ((error as any).errCode === IMSDKErrCode.NotAllowAddFriend) {
        message.warning(t("common.toast.notCanAddFriend"));
      } else {
        feedbackToast({ error, msg: t("common.toast.sendApplicationFailed") });
      }
    }
    backToCard();
  };

  return (
    <div className="flex max-h-130 min-h-121 flex-col overflow-hidden px-5.5">
      <div className="w-full cursor-move">
        <div className="mt-4.5 mb-8 flex items-center">
          <LeftOutlined
            className="cursor-pointer text-(--sub-text)"
            rev={undefined}
            onClick={backToCard}
          />
          <div className="ml-2 font-medium">{t("common.text.friendVerification")}</div>
        </div>
      </div>
      <div className="ignore-drag flex flex-1 flex-col">
        <div className="flex items-center">
          <OIMAvatar size={60} src={cardInfo?.faceURL} text={cardInfo?.nickname} />
          <div className="ml-3 flex-1 overflow-hidden">
            <div
              className="mb-3 flex-1 truncate text-base font-medium"
              title={cardInfo?.nickname}
            >
              {cardInfo?.nickname}
            </div>
            <div className="mr-3 text-xs text-(--sub-text)">{cardInfo?.userID}</div>
          </div>
        </div>
        <div className="mt-7">
          <div className="text-xs text-(--sub-text)">
            {t("contact.message.request.information")}
          </div>
          <div className="mx-2 my-4">
            <Input.TextArea
              showCount
              value={reqMsg}
              maxLength={50}
              bordered={false}
              spellCheck={false}
              placeholder={t("common.text.pleaseEnter")}
              style={{ padding: "8px 6px" }}
              autoSize={{ minRows: 6, maxRows: 6 }}
              onChange={(e) => setReqMsg(e.target.value)}
              className="bg-(--chat-bubble) hover:bg-(--chat-bubble)"
            />
          </div>
        </div>
        <div className="mx-2 mb-6 flex flex-1 items-end">
          <Button
            className="flex-1"
            type="primary"
            onClick={sendApplication}
            loading={isPending}
          >
            {t("common.text.send")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SendRequest;
