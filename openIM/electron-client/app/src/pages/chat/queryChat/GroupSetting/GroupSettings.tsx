import { RightOutlined } from "@ant-design/icons";
import { GroupStatus, MessageReceiveOptType } from "@openim/wasm-client-sdk";
import { Button, Divider, Popover, Upload } from "antd";
import clsx from "clsx";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "react-use";

import copy from "@/assets/images/chatSetting/copy.png";
import edit_avatar from "@/assets/images/chatSetting/edit_avatar.png";
import EditableContent from "@/components/EditableContent";
import OIMAvatar from "@/components/OIMAvatar";
import SettingRow from "@/components/SettingRow";
import { useConversationSettings } from "@/hooks/useConversationSettings";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import { useConversationStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { uploadFile } from "@/utils/imCommon";
import { emit } from "@/utils/window/events";

import { FileWithPath } from "../ChatFooter/SendActionBar/useFileMessage";
import MsgDestructSetting from "../MsgDestructSetting";
import GroupMemberRow from "./GroupMemberRow";
import MemberPermissionSelectContent from "./MemberPermissionSelectContent";
import { useGroupSettings } from "./useGroupSettings";
import VerificationSelectContent, {
  getVerificationMenuList,
} from "./VerificationSelectContent";

const GroupSettings = ({
  updateTravel,
  closeOverlay,
}: {
  updateTravel: () => void;
  closeOverlay: () => void;
}) => {
  const { t } = useTranslation();
  const verificationMenuList = getVerificationMenuList(t);
  const currentMemberNickInGroup = useConversationStore(
    (state) => state.currentMemberInGroup?.nickname,
  );

  const { isNomal, isOwner, isAdmin, isJoinGroup } = useCurrentMemberRole();

  const {
    currentConversation,
    updateConversationPin,
    updateConversationMessageRemind,
    clearConversationMessages,
    updateDestructDuration,
    updateConversationMsgDestructState,
  } = useConversationSettings();

  const {
    currentGroupInfo,
    updateGroupInfo,
    updateGroupMuteAll,
    updateNickNameInGroup,
    updateGroupVerification,
    updateGroupMemberPermission,
    tryQuitGroup,
    tryDismissGroup,
  } = useGroupSettings({ closeOverlay });

  const [_, copyToClipboard] = useCopyToClipboard();

  const customUpload = async ({ file }: { file: FileWithPath }) => {
    try {
      const {
        data: { url },
      } = await uploadFile(file);
      await updateGroupInfo({ faceURL: url });
    } catch (error) {
      feedbackToast({ error: t("settings.toast.updateAvatarFailed") });
    }
  };

  const updateGroupName = useCallback(
    async (groupName: string) => {
      await updateGroupInfo({ groupName });
    },
    [updateGroupInfo],
  );

  const transferGroup = () => {
    emit("OPEN_CHOOSE_MODAL", {
      type: "TRANSFER_IN_GROUP",
      extraData: { groupID: currentGroupInfo?.groupID ?? "" },
    });
  };

  const hasPermissions = isAdmin || isOwner;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-4">
        <div className="flex items-center">
          <Upload
            accept="image/*"
            className={clsx({ "disabled-upload": isNomal })}
            openFileDialogOnClick={hasPermissions}
            showUploadList={false}
            customRequest={customUpload as any}
          >
            <div className="relative">
              <OIMAvatar
                isgroup
                src={currentGroupInfo?.faceURL}
                text={currentGroupInfo?.groupName}
              />
              {hasPermissions && (
                <img
                  className="absolute -right-1 -bottom-1"
                  width={15}
                  src={edit_avatar}
                  alt="edit avatar"
                />
              )}
            </div>
          </Upload>

          <EditableContent
            textClassName="font-medium"
            value={currentGroupInfo?.groupName}
            editable={hasPermissions}
            onChange={updateGroupName}
          />
        </div>
      </div>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      {currentGroupInfo && isJoinGroup && (
        <GroupMemberRow
          currentGroupInfo={currentGroupInfo}
          isNomal={isNomal}
          updateTravel={updateTravel}
        />
      )}
      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      <SettingRow className="pb-2" title={`${t("chat.group.group")}ID`}>
        <div className="flex items-center">
          <span className="mr-1 text-xs text-(--sub-text)">
            {currentGroupInfo?.groupID}
          </span>
          <img
            className="cursor-pointer"
            width={14}
            src={copy}
            alt=""
            onClick={() => {
              copyToClipboard(currentGroupInfo?.groupID ?? "");
              feedbackToast({ msg: t("common.toast.copySuccess") });
            }}
          />
        </div>
      </SettingRow>
      <SettingRow title={t("chat.group.groupTppe")}>
        <span className="text-xs text-(--sub-text)">{t("chat.group.workGroup")}</span>
      </SettingRow>
      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <SettingRow
        hidden={!isJoinGroup}
        className="pb-2"
        title={t("chat.group.myGroupNickname")}
      >
        <EditableContent
          textClassName="text-xs text-(--sub-text)"
          value={currentMemberNickInGroup}
          editable
          onChange={updateNickNameInGroup}
        />
      </SettingRow>
      <SettingRow
        hidden={!isJoinGroup}
        className="pb-2"
        title={t("chat.conversation.sticky")}
        value={currentConversation?.isPinned}
        tryChange={updateConversationPin}
      />
      <SettingRow
        hidden={!isJoinGroup}
        className="pb-2"
        title={t("chat.conversation.notNotify")}
        value={currentConversation?.recvMsgOpt === MessageReceiveOptType.NotNotify}
        tryChange={(checked) =>
          updateConversationMessageRemind(checked, MessageReceiveOptType.NotNotify)
        }
      />
      {hasPermissions && (
        <SettingRow
          className="pb-2"
          title={t("chat.group.allMuted")}
          value={currentGroupInfo?.status === GroupStatus.Muted}
          tryChange={updateGroupMuteAll}
        />
      )}
      <SettingRow
        className="cursor-pointer"
        title={t("chat.toast.clearChatHistory")}
        rowClick={clearConversationMessages}
      >
        <RightOutlined rev={undefined} />
      </SettingRow>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      {isJoinGroup && (
        <MsgDestructSetting
          currentConversation={currentConversation}
          updateDestructDuration={updateDestructDuration}
          updateConversationMsgDestructState={updateConversationMsgDestructState}
        />
      )}

      {!hasPermissions ? (
        <Divider className="m-0 border-4 border-[#F4F5F7]" />
      ) : (
        <>
          <Divider className="m-0 border-4 border-[#F4F5F7]" />
          <SettingRow
            className="cursor-pointer pb-2"
            title={t("chat.group.groupVerification")}
          >
            <Popover
              content={
                <VerificationSelectContent
                  activeType={currentGroupInfo?.needVerification}
                  tryChange={updateGroupVerification}
                />
              }
              trigger="click"
              placement="topLeft"
              title={null}
              arrow={false}
            >
              <div className="flex max-w-55 items-center">
                <span className="mr-1 text-xs text-(--sub-text)">
                  {
                    verificationMenuList[Number(currentGroupInfo?.needVerification)]
                      ?.title
                  }
                </span>
                <RightOutlined rev={undefined} />
              </div>
            </Popover>
          </SettingRow>
          <Popover
            content={
              <MemberPermissionSelectContent
                applyMemberFriend={currentGroupInfo?.applyMemberFriend}
                lookMemberInfo={currentGroupInfo?.lookMemberInfo}
                tryChange={updateGroupMemberPermission}
              />
            }
            trigger="click"
            placement="topRight"
            title={null}
            arrow={false}
          >
            <div>
              <SettingRow
                className="cursor-pointer"
                title={t("chat.group.groupMemberPermissions")}
              >
                <RightOutlined rev={undefined} />
              </SettingRow>
            </div>
          </Popover>
          <Divider className="m-0 border-4 border-[#F4F5F7]" />
        </>
      )}

      {isOwner && (
        <>
          <Divider className="m-0 border-4 border-[#F4F5F7]" />
          <SettingRow
            className="cursor-pointer"
            title={t("chat.group.transferGroup")}
            rowClick={transferGroup}
          >
            <RightOutlined rev={undefined} />
          </SettingRow>
        </>
      )}

      <div className="flex-1" />
      {isJoinGroup && (
        <div className="flex w-full justify-center pt-24 pb-3">
          {!isOwner ? (
            <Button type="primary" danger ghost onClick={tryQuitGroup}>
              {t("chat.group.exitGroup")}
            </Button>
          ) : (
            <Button type="primary" danger onClick={tryDismissGroup}>
              {t("chat.group.disbandGroup")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(GroupSettings);
