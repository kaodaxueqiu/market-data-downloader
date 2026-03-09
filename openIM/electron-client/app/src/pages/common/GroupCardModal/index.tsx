import { LeftOutlined } from "@ant-design/icons";
import {
  CbEvents,
  GroupApplicationItem,
  GroupItem,
  GroupJoinSource,
  GroupVerificationType,
  SessionType,
  WSEvent,
} from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Button, Input } from "antd";
import dayjs from "dayjs";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";

import clock from "@/assets/images/common/clock.png";
import member_etc from "@/assets/images/common/member_etc.png";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import OIMAvatar from "@/components/OIMAvatar";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import useGroupMembers from "@/hooks/useGroupMembers";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { IMSDK } from "@/layout/MainContentWrap";
import { useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { getDefaultAvatar } from "@/utils/media";

interface IGroupCardModalProps {
  groupData?: GroupItem & { inGroup?: boolean };
}

const GroupCardModal: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  IGroupCardModalProps
> = ({ groupData }, ref) => {
  const [reqMsg, setReqMsg] = useState("");
  const [isSendRequest, setIsSendRequest] = useState(false);
  const [localGroupData, setLocalGroupData] = useState<
    (GroupItem & { inGroup?: boolean }) | undefined
  >(groupData);
  const groupID = localGroupData?.groupID;
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const { fetchState, getMemberData, resetState } = useGroupMembers({
    groupID,
  });

  const { toSpecifiedConversation } = useConversationToggle();
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  const { mutateAsync: joinGroup, isPending } = useMutation<
    unknown,
    unknown,
    Parameters<typeof IMSDK.joinGroup>[0]
  >({
    mutationFn: (params) => IMSDK.joinGroup(params),
  });

  const refreshMemberList = useCallback(() => {
    if (!isOverlayOpen) return;
    setTimeout(() => {
      getMemberData(true);
    }, 250);
  }, [getMemberData, isOverlayOpen]);

  useEffect(() => {
    setLocalGroupData(groupData);
  }, [groupData]);

  useEffect(() => {
    if (isOverlayOpen) {
      getMemberData(true);
    }
  }, [isOverlayOpen]);

  useEffect(() => {
    const groupApplicationAcceptedHandler = ({
      data,
    }: WSEvent<GroupApplicationItem>) => {
      if (data.groupID !== groupID || data.userID !== selfUserID) return;
      setLocalGroupData((prev) => (prev ? { ...prev, inGroup: true } : prev));
      setIsSendRequest(false);
      refreshMemberList();
    };
    IMSDK.on(CbEvents.OnGroupApplicationAccepted, groupApplicationAcceptedHandler);
    return () => {
      IMSDK.off(CbEvents.OnGroupApplicationAccepted, groupApplicationAcceptedHandler);
    };
  }, [groupID, refreshMemberList, selfUserID]);

  const createTimeStr = dayjs(localGroupData?.createTime ?? 0).format("YYYY/M/D");

  const sliceNum = Math.min(
    localGroupData?.memberCount ?? 0,
    localGroupData?.memberCount === 8 ? 8 : 7,
  );

  const renderList = localGroupData?.inGroup
    ? fetchState.groupMemberList.slice(0, sliceNum)
    : Array.from({ length: sliceNum ?? 0 }, (_, idx) => ({
        userID: idx,
        nickname: "",
        faceURL: getDefaultAvatar(`ic_avatar_0${(idx % 6) + 1}`),
      }));

  const joinOrSendMessage = async () => {
    if (localGroupData?.inGroup) {
      toSpecifiedConversation({
        sourceID: localGroupData.groupID,
        sessionType: SessionType.WorkingGroup,
      });
      closeOverlay();
      return;
    }

    if (localGroupData?.needVerification === GroupVerificationType.AllNot) {
      await sendApplication();
      closeOverlay();
      return;
    }
    setIsSendRequest(true);
  };

  const sendApplication = async () => {
    if (!groupID) return;
    try {
      await joinGroup({
        groupID,
        reqMsg,
        joinSource: GroupJoinSource.Search,
      });
      feedbackToast({ msg: t("common.toast.sendJoinGroupRequestSuccess") });
      setIsSendRequest(false);
    } catch (error) {
      feedbackToast({ error, msg: t("common.toast.sendApplicationFailed") });
    }
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={484}
      onCancel={closeOverlay}
      afterClose={resetState}
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      ignoreClasses=".ignore-drag, .no-padding-modal, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div>
        {isSendRequest && (
          <div
            className="flex w-fit cursor-pointer items-center pt-5.5 pl-5.5"
            onClick={() => setIsSendRequest(false)}
          >
            <LeftOutlined rev={undefined} />
            <div className="ml-1 font-medium">{t("chat.group.groupVerification")}</div>
          </div>
        )}
        <div className="flex p-5.5">
          <OIMAvatar size={60} src={localGroupData?.faceURL} isgroup />
          <div className="ml-3">
            <div className="mb-3 max-w-30 truncate text-base font-medium">
              {localGroupData?.groupName}
            </div>
            <div className="flex items-center">
              <div className="text-xs text-(--sub-text)">{`ID：${groupID}`}</div>
              <div className="ml-4 flex items-center">
                <img src={clock} width={10} alt="" />
                <div className="text-xs text-(--sub-text)">{createTimeStr}</div>
              </div>
            </div>
          </div>
        </div>
        {isSendRequest ? (
          <div className="mx-5.5">
            <div className="text-xs text-(--sub-text)">
              {t("contact.message.request.information")}
            </div>
            <div className="mt-3">
              <Input.TextArea
                showCount
                value={reqMsg}
                maxLength={50}
                bordered={false}
                spellCheck={false}
                placeholder={t("common.text.pleaseEnter")}
                style={{ padding: "8px 6px" }}
                autoSize={{ minRows: 4, maxRows: 4 }}
                onChange={(e) => setReqMsg(e.target.value)}
                className="bg-(--chat-bubble) hover:bg-(--chat-bubble)"
              />
            </div>
            <div className="my-6 flex justify-center">
              <Button
                className="w-[60%]"
                type="primary"
                loading={isPending}
                onClick={sendApplication}
              >
                {t("common.text.send")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-[#F2F8FF] p-5.5">
            <div className="mb-3">{`${t("chat.group.groupMember")}：${
              localGroupData?.memberCount
            }`}</div>
            <div className="flex items-center">
              {renderList.map((item) => (
                <OIMAvatar
                  className="mr-3"
                  src={item.faceURL}
                  text={item.nickname}
                  key={item.userID}
                />
              ))}
              {renderList.length === 7 && <OIMAvatar src={member_etc} />}
            </div>
            <div className="mt-28 flex justify-center">
              <Button
                className="w-[60%]"
                type="primary"
                loading={isPending}
                onClick={joinOrSendMessage}
              >
                {localGroupData?.inGroup
                  ? t("chat.action.sendMessage")
                  : t("common.text.addGroup")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(GroupCardModal));
