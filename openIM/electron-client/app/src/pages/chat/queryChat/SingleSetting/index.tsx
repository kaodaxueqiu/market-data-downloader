import { ArrowLeftOutlined, CheckOutlined, RightOutlined } from "@ant-design/icons";
import { MessageReceiveOptType } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Button, Divider, Drawer, Modal, Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useRef, useState } from "react";

import { modal } from "@/AntdGlobalComp";
import OIMAvatar from "@/components/OIMAvatar";
import SettingRow from "@/components/SettingRow";
import { useConversationSettings } from "@/hooks/useConversationSettings";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useUserRelation } from "@/hooks/useUserRelation";
import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/feedback";
import { emit } from "@/utils/window/events";

import MsgDestructSetting from "../MsgDestructSetting";

// export interface SingleSettingProps {}

const SingleSetting: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
  const durationModalRef = useRef<OverlayVisibleHandle>(null);

  const {
    currentConversation,
    updateBurnDuration,
    updateDestructDuration,
    updateConversationPin,
    updateConversationMessageRemind,
    updateConversationPrivateState,
    updateConversationMsgDestructState,
    clearConversationMessages,
  } = useConversationSettings();

  const { isFriend, isBlack } = useUserRelation(currentConversation?.userID ?? "");

  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  const updateBlack = async () => {
    if (!currentConversation) return;
    const execFunc = async () => {
      try {
        if (isBlack) {
          await IMSDK.removeBlack(currentConversation?.userID);
        } else {
          await IMSDK.addBlack({
            toUserID: currentConversation?.userID,
          });
        }
      } catch (error) {
        feedbackToast({ error, msg: t("chat.toast.updateBlackStateFailed") });
      }
    };
    if (!isBlack) {
      modal.confirm({
        title: t("chat.contact.moveBlacklist"),
        content: (
          <div className="flex items-baseline">
            <div>{t("chat.toast.confirmMoveBlacklist")}</div>
            <span className="text-xs text-(--sub-text)">
              {t("chat.message.willFilterThisUserMessage")}
            </span>
          </div>
        ),
        onOk: execFunc,
      });
    } else {
      await execFunc();
    }
  };

  const tryUnfriend = () => {
    if (!currentConversation) return;
    modal.confirm({
      title: t("contact.text.unfriend"),
      content: t("contact.toast.confirmUnfriend"),
      onOk: async () => {
        try {
          await IMSDK.deleteFriend(currentConversation.userID);
          feedbackToast({ msg: t("contact.toast.unfriendSuccess") });
        } catch (error) {
          feedbackToast({ error, msg: t("contact.toast.unfriendFailed") });
        }
      },
    });
  };

  const openUserCard = () => {
    emit("OPEN_USER_CARD", { userID: currentConversation?.userID });
  };

  return (
    <Drawer
      title={t("chat.conversation.setting")}
      placement="right"
      rootClassName="chat-drawer"
      destroyOnClose
      onClose={closeOverlay}
      open={isOverlayOpen}
      maskClassName="opacity-0"
      maskMotion={{
        visible: false,
      }}
      width={450}
      getContainer={"#chat-container"}
    >
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={openUserCard}
      >
        <div className="flex items-center">
          <OIMAvatar
            src={currentConversation?.faceURL}
            text={currentConversation?.showName}
          />
          <div className="ml-3">{currentConversation?.showName}</div>
        </div>
        <RightOutlined rev={undefined} />
      </div>
      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      <SettingRow
        className="pb-2"
        title={t("chat.conversation.sticky")}
        value={currentConversation?.isPinned}
        tryChange={updateConversationPin}
      />
      <SettingRow
        className="pb-2"
        title={t("chat.conversation.notNotify")}
        value={currentConversation?.recvMsgOpt === MessageReceiveOptType.NotNotify}
        tryChange={(checked) =>
          updateConversationMessageRemind(checked, MessageReceiveOptType.NotNotify)
        }
      />
      {/* <SettingRow
        className="pb-2"
        title={t("chat.conversation.shieldConversation")}
        value={currentConversation?.recvMsgOpt === MessageReceiveOptType.NotReceive}
        tryChange={(checked) =>
          updateConversationMessageRemind(checked, MessageReceiveOptType.NotReceive)
        }
      /> */}
      <SettingRow
        title={t("chat.contact.moveBlacklist")}
        value={isBlack}
        tryChange={updateBlack}
      />
      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      <SettingRow
        className="pb-2"
        title={t("chat.conversation.privateChat")}
        value={currentConversation?.isPrivateChat}
        tryChange={updateConversationPrivateState}
      />
      {currentConversation?.isPrivateChat && (
        <SettingRow
          className="cursor-pointer"
          title={t("chat.conversation.privateChatTime")}
          value={false}
          rowClick={() => durationModalRef.current?.openOverlay()}
        >
          <div className="flex items-center">
            <span className="mr-1 text-xs text-(--sub-text)">
              {burnDurationMap[currentConversation?.burnDuration ?? 30]}
            </span>
            <RightOutlined rev={undefined} />
          </div>
        </SettingRow>
      )}
      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      <MsgDestructSetting
        currentConversation={currentConversation}
        updateDestructDuration={updateDestructDuration}
        updateConversationMsgDestructState={updateConversationMsgDestructState}
      />
      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      <SettingRow
        className="cursor-pointer"
        title={t("chat.toast.clearChatHistory")}
        rowClick={clearConversationMessages}
      >
        <RightOutlined rev={undefined} />
      </SettingRow>

      <div className="flex-1" />
      {isFriend && (
        <div className="flex w-full justify-center pt-24 pb-3">
          <Button type="primary" danger onClick={tryUnfriend}>
            {t("contact.text.unfriend")}
          </Button>
        </div>
      )}
      <ForwardBurnDurationModal
        ref={durationModalRef}
        burnDuration={currentConversation?.burnDuration ?? 30}
        updateBurnDuration={updateBurnDuration}
      />
    </Drawer>
  );
};

export default memo(forwardRef(SingleSetting));

const durationOptions = [
  {
    title: t("common.dateTime.relative.second", { num: 30 }),
    value: 30,
  },
  {
    title: t("common.dateTime.relative.minute", { num: 5 }),
    value: 60 * 5,
  },
  {
    title: t("common.dateTime.relative.hour", { num: 1 }),
    value: 60 * 60,
  },
];

const burnDurationMap = durationOptions.reduce(
  (acc, option) => {
    acc[option.value] = option.title;
    return acc;
  },
  {} as Record<number, string>,
);

const BurnDurationModal: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  {
    burnDuration: number;
    updateBurnDuration: (seconds: number) => Promise<void>;
  }
> = ({ burnDuration, updateBurnDuration }, ref) => {
  const [selectedOption, setSelectedOption] = useState<number>(burnDuration);
  const { closeOverlay, isOverlayOpen } = useOverlayVisible(ref);

  const { mutateAsync: updateBurnDurationMutation, isPending } = useMutation({
    mutationFn: updateBurnDuration,
  });

  const saveMute = async () => {
    if (selectedOption === undefined) {
      return;
    }
    await updateBurnDurationMutation(selectedOption);
    closeOverlay();
  };

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      destroyOnClose
      centered
      onCancel={closeOverlay}
      width={320}
      className="no-padding-modal"
    >
      <Spin spinning={isPending}>
        <div className="py-6">
          <div className="flex items-center justify-between px-5">
            <ArrowLeftOutlined
              className="cursor-pointer text-[#8e9aaf]!"
              onClick={closeOverlay}
            />
            <div>{t("chat.conversation.privateChatTime")}</div>
            <span className="text-primary cursor-pointer" onClick={saveMute}>
              {t("common.text.save")}
            </span>
          </div>
          <div className="mt-5">
            {durationOptions.map((option) => (
              <div
                key={option.value}
                className={clsx(
                  "flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-(--primary-active)",
                  { "bg-(--primary-active)": selectedOption === option.value },
                )}
                onClick={() => setSelectedOption(option.value)}
              >
                <span>{option.title}</span>
                {selectedOption === option.value && (
                  <CheckOutlined className="text-primary!" />
                )}
              </div>
            ))}
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

const ForwardBurnDurationModal = memo(forwardRef(BurnDurationModal));
