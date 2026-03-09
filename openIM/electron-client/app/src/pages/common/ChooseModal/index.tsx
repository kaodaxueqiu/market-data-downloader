import { CloseOutlined } from "@ant-design/icons";
import {
  CardElem,
  CustomMsgParams,
  GroupType,
  MergerMsgParams,
} from "@openim/wasm-client-sdk";
import { Button, Input, Modal, Upload } from "antd";
import clsx from "clsx";
import {
  FC,
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { message } from "@/AntdGlobalComp";
import OIMAvatar from "@/components/OIMAvatar";
import { useCheckConfirmModal } from "@/hooks/useCheckConfirmModal";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { IMSDK } from "@/layout/MainContentWrap";
import { FileWithPath } from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";
import { useSendMessage } from "@/pages/chat/queryChat/ChatFooter/useSendMessage";
import { ExMessageItem } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import {
  formatMessageByType,
  getGroupConversationID,
  uploadFile,
} from "@/utils/imCommon";
import { emit } from "@/utils/window/events";

import ChooseBox, { ChooseBoxHandle } from "./ChooseBox";
import { CheckListItem } from "./ChooseBox/CheckItem";

export type ChooseModalType =
  | "CRATE_GROUP"
  | "INVITE_TO_GROUP"
  | "KICK_FORM_GROUP"
  | "TRANSFER_IN_GROUP"
  | "FORWARD_MESSAGE"
  | "SELECT_CARD"
  | "SHARE_CARD"
  | "SELECT_USER";

export type ForwardMessagePayload =
  | { kind: "merger"; params: MergerMsgParams }
  | { kind: "forward"; message: ExMessageItem }
  | { kind: "custom"; params: CustomMsgParams }
  | { kind: "card"; params: CardElem };

export type ChooseModalListExtraData = {
  list?: CheckListItem[];
};

export type SelectUserExtraData = ChooseModalListExtraData & {
  notConversation?: boolean;
};

export type CreateGroupExtraData = ChooseModalListExtraData;

export type ChooseModalExtraDataMap = {
  CRATE_GROUP: CreateGroupExtraData | undefined;
  INVITE_TO_GROUP: { groupID: string };
  KICK_FORM_GROUP: { groupID: string };
  TRANSFER_IN_GROUP: { groupID: string };
  FORWARD_MESSAGE: ForwardMessagePayload;
  SELECT_CARD: undefined;
  SHARE_CARD: ForwardMessagePayload;
  SELECT_USER: SelectUserExtraData | undefined;
};

export type ChooseModalState = {
  [K in ChooseModalType]: ChooseModalExtraDataMap[K] extends undefined
    ? { type: K }
    : undefined extends ChooseModalExtraDataMap[K]
      ? { type: K; extraData?: Exclude<ChooseModalExtraDataMap[K], undefined> }
      : { type: K; extraData: ChooseModalExtraDataMap[K] };
}[ChooseModalType];

interface IChooseModalProps {
  state: ChooseModalState;
}

const TITLE_KEY_MAP: Record<ChooseModalType, string> = {
  CRATE_GROUP: "chat.group.createGroup",
  INVITE_TO_GROUP: "chat.group.invitation",
  KICK_FORM_GROUP: "chat.group.kickMember",
  TRANSFER_IN_GROUP: "chat.group.transferGroup",
  FORWARD_MESSAGE: "chat.action.mergeForward",
  SELECT_CARD: "common.text.share",
  SHARE_CARD: "common.text.share",
  SELECT_USER: "system.text.selectUser",
};

const SHOW_CONVERSATION_TYPES = new Set<ChooseModalType>([
  "FORWARD_MESSAGE",
  "SHARE_CARD",
]);
const ONLY_ONE_TYPES = new Set<ChooseModalType>(["TRANSFER_IN_GROUP", "SELECT_CARD"]);
const ONLY_MEMBER_TYPES = new Set<ChooseModalType>([
  "KICK_FORM_GROUP",
  "TRANSFER_IN_GROUP",
]);
const CAN_ADD_AGENTS_TYPES = new Set<ChooseModalType>([
  "CRATE_GROUP",
  "INVITE_TO_GROUP",
]);
const FILTER_BLACK_TYPES = new Set<ChooseModalType>([
  "INVITE_TO_GROUP",
  "FORWARD_MESSAGE",
]);

const resolveForwardPayload = (
  type: ChooseModalType,
  extraData?: ChooseModalExtraDataMap[ChooseModalType],
): ForwardMessagePayload | null => {
  if (!extraData) return null;
  if (type === "FORWARD_MESSAGE" || type === "SHARE_CARD") {
    return extraData as ForwardMessagePayload;
  }
  return null;
};

const getForwardContent = (
  payload: ForwardMessagePayload,
  t: (key: string, params?: Record<string, unknown>) => string,
) => {
  switch (payload.kind) {
    case "merger":
      return t("chat.message.description.forwardMessage", {
        additional: payload.params.title,
      });
    case "forward":
      return t("chat.message.description.forwardMessage", {
        additional: formatMessageByType(payload.message),
      });
    case "custom":
      return t("chat.message.description.customMessage");
    case "card":
      return t("chat.message.description.addtionalCardMessage", {
        additional: payload.params.nickname,
      });
    default:
      return undefined;
  }
};

const createForwardMessage = async (payload: ForwardMessagePayload) => {
  switch (payload.kind) {
    case "merger":
      return (await IMSDK.createMergerMessage(payload.params)).data;
    case "forward":
      return (await IMSDK.createForwardMessage(payload.message)).data;
    case "custom":
      return (await IMSDK.createCustomMessage(payload.params)).data;
    case "card":
      return (await IMSDK.createCardMessage(payload.params)).data;
    default:
      throw new Error("Unsupported forward payload");
  }
};

const ChooseModal: ForwardRefRenderFunction<OverlayVisibleHandle, IChooseModalProps> = (
  { state },
  ref,
) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);
  const handleClose = useCallback(() => {
    closeOverlay();
    emit("CHOOSE_MODAL_CLOSED", state);
  }, [closeOverlay, state]);

  return (
    <Modal
      title={null}
      footer={null}
      centered
      open={isOverlayOpen}
      closable={false}
      width={680}
      onCancel={handleClose}
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      className="no-padding-modal max-w-[80vw]"
      maskTransitionName=""
    >
      <ChooseContact
        isOverlayOpen={isOverlayOpen}
        closeOverlay={handleClose}
        {...state}
      />
    </Modal>
  );
};

export default memo(forwardRef(ChooseModal));

type ChooseContactProps = {
  isOverlayOpen: boolean;
  closeOverlay: () => void;
} & ChooseModalState;

export const ChooseContact: FC<ChooseContactProps> = (props) => {
  const { isOverlayOpen, closeOverlay } = props;
  const { type } = props;
  const resolvedExtraData = "extraData" in props ? props.extraData : undefined;
  const { t } = useTranslation();
  const chooseBoxRef = useRef<ChooseBoxHandle>(null);
  const [loading, setLoading] = useState(false);
  const [groupBaseInfo, setGroupBaseInfo] = useState({
    groupName: "",
    groupAvatar: "",
  });
  const title = t(TITLE_KEY_MAP[type]);

  const { sendMessage } = useSendMessage();
  const { showCheckConfirmModal } = useCheckConfirmModal();

  useEffect(() => {
    if (!isOverlayOpen) {
      resetState();
      return;
    }
    if (resolvedExtraData && "list" in resolvedExtraData) {
      const initialList = resolvedExtraData.list;
      if (initialList?.length) {
        setTimeout(() => chooseBoxRef.current?.updatePrevCheckList(initialList), 100);
      }
    }
  }, [isOverlayOpen, type, resolvedExtraData]);

  const confirmChoose = async () => {
    const choosedList = chooseBoxRef.current?.getCheckedList() ?? [];
    if (!choosedList?.length && type !== "SELECT_USER")
      return message.warning(t("common.toast.selectLeastOne"));

    if (!groupBaseInfo.groupName.trim() && type === "CRATE_GROUP")
      return message.warning(t("common.toast.inputGroupName"));

    setLoading(true);
    try {
      switch (props.type) {
        case "CRATE_GROUP":
          await IMSDK.createGroup({
            groupInfo: {
              groupType: GroupType.WorkingGroup,
              groupName: groupBaseInfo.groupName,
              faceURL: groupBaseInfo.groupAvatar,
            },
            memberUserIDs: choosedList.map(
              (item) => item.userID ?? item.user?.userID ?? "",
            ),
            adminUserIDs: [],
          });
          break;
        case "INVITE_TO_GROUP":
          await IMSDK.inviteUserToGroup({
            groupID: props.extraData.groupID,
            userIDList: choosedList.map(
              (item) => item.userID ?? item.user?.userID ?? "",
            ),
            reason: "",
          });
          break;
        case "KICK_FORM_GROUP":
          showCheckConfirmModal({
            title: t("chat.group.kickMember"),
            confirmTip: t("chat.group.kickMemberConfirm"),
            onOk: async (checked) => {
              await IMSDK.kickGroupMember({
                groupID: props.extraData.groupID,
                userIDList: choosedList.map(
                  (item) => item.userID ?? item.user?.userID ?? "",
                ),
                reason: "",
              });
              if (checked) {
                await Promise.all(
                  choosedList.map((member) =>
                    IMSDK.deleteUserAllMessagesInConv({
                      conversationID: getGroupConversationID(props.extraData.groupID),
                      userID: member.userID ?? member.user?.userID ?? "",
                    }),
                  ),
                );
              }
            },
          });
          break;
        case "TRANSFER_IN_GROUP":
          await IMSDK.transferGroupOwner({
            groupID: props.extraData.groupID,
            newOwnerUserID: choosedList[0].userID!,
          });
          break;
        case "SELECT_CARD":
          sendMessage({
            message: (
              await IMSDK.createCardMessage({
                userID: choosedList[0].userID ?? choosedList[0].user?.userID ?? "",
                nickname:
                  choosedList[0].nickname ?? choosedList[0].user?.nickname ?? "",
                faceURL: choosedList[0].faceURL ?? choosedList[0].user?.faceURL ?? "",
                ex: choosedList[0].ex ?? "",
              })
            ).data,
          });
          break;
        case "FORWARD_MESSAGE":
        case "SHARE_CARD":
          {
            const forwardPayload = resolveForwardPayload(type, resolvedExtraData);
            if (forwardPayload) {
              const additional = chooseBoxRef.current?.getAdditional();
              choosedList.forEach((item) => {
                void (async () => {
                  const batchMessage = await createForwardMessage(forwardPayload);
                  if (
                    item.groupID &&
                    !(await IMSDK.isJoinGroup<boolean>(item.groupID))
                  ) {
                    return;
                  }
                  const params = {
                    message: batchMessage,
                    recvID: item.userID ?? item.user?.userID ?? "",
                    groupID: item.groupID ?? "",
                  };
                  void sendMessage(params);
                  if (additional) {
                    const additionalMessage = (
                      await IMSDK.createTextMessage(additional)
                    ).data;
                    const params = {
                      message: additionalMessage,
                      recvID: item.userID ?? item.user?.userID ?? "",
                      groupID: item.groupID ?? "",
                    };
                    void sendMessage(params);
                  }
                })();
              });
              message.success(t("common.toast.sendSuccess"));
            }
            emit("SELECT_USER", {
              choosedList,
            });
          }
          break;
        case "SELECT_USER":
          emit("SELECT_USER", {
            choosedList,
            notConversation: props.extraData?.notConversation,
          });
          break;
        default:
          break;
      }
    } catch (error) {
      feedbackToast({ error });
    }
    setLoading(false);
    closeOverlay();
  };

  const resetState = () => {
    chooseBoxRef.current?.resetState();
    setGroupBaseInfo({
      groupName: "",
      groupAvatar: "",
    });
  };

  const customUpload = async ({ file }: { file: FileWithPath }) => {
    try {
      const {
        data: { url },
      } = await uploadFile(file);
      setGroupBaseInfo((prev) => ({ ...prev, groupAvatar: url }));
    } catch (error) {
      feedbackToast({ error: t("settings.toast.updateAvatarFailed") });
    }
  };

  const isCheckInGroup = type === "INVITE_TO_GROUP";
  const canAddAgents = CAN_ADD_AGENTS_TYPES.has(type);
  const chooseOneOnly = ONLY_ONE_TYPES.has(type);
  const showGroupMember = ONLY_MEMBER_TYPES.has(type);
  const filterBlack = FILTER_BLACK_TYPES.has(type);
  const notOrgMember = type === "SELECT_USER";
  const checkMemberRole = type === "KICK_FORM_GROUP";
  const baseNotConversation = !SHOW_CONVERSATION_TYPES.has(type);
  const notConversation =
    type === "SELECT_USER"
      ? (props.extraData?.notConversation ?? baseNotConversation)
      : baseNotConversation;
  const forwardPayload = resolveForwardPayload(type, resolvedExtraData);
  const forwardContent =
    forwardPayload && SHOW_CONVERSATION_TYPES.has(type)
      ? getForwardContent(forwardPayload, t)
      : undefined;

  return (
    <>
      <div className="flex h-16 items-center justify-between bg-(--gap-text) px-7">
        <div>{title}</div>
        <CloseOutlined
          className="cursor-pointer text-(--sub-text)"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      {type === "CRATE_GROUP" ? (
        <div className="px-6 pt-4">
          <div className="mb-6 flex items-center">
            <div className="mr-4 w-16 font-medium">{t("common.text.groupName")}</div>
            <Input
              className="flex-1"
              placeholder={t("common.text.pleaseEnter")}
              maxLength={16}
              spellCheck={false}
              value={groupBaseInfo.groupName}
              onChange={(e) =>
                setGroupBaseInfo((state) => ({ ...state, groupName: e.target.value }))
              }
            />
          </div>
          <div className="mb-6 flex items-center">
            <div className="mr-4 w-16 font-medium">{t("common.text.groupAvatar")}</div>
            <div className="flex items-center">
              <OIMAvatar src={groupBaseInfo.groupAvatar} isgroup />
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={customUpload as any}
              >
                <span className="text-primary ml-3 cursor-pointer text-xs">
                  {t("common.text.clickToModify")}
                </span>
              </Upload>
            </div>
          </div>
          <div className="flex">
            <div className="mr-4 w-16 font-medium">{t("chat.group.groupMember")}</div>
            <ChooseBox
              className={clsx("m-0! h-[40vh]! flex-1", {
                "h-[56vh]!": window.electronAPI?.enableCLib,
              })}
              ref={chooseBoxRef}
              notConversation={notConversation}
              canAddAgents={canAddAgents}
              filterBlack={true}
            />
          </div>
        </div>
      ) : (
        <ChooseBox
          className="h-[60vh]!"
          ref={chooseBoxRef}
          isCheckInGroup={isCheckInGroup}
          notConversation={notConversation}
          canAddAgents={canAddAgents}
          notOrgMember={notOrgMember}
          showGroupMember={showGroupMember}
          chooseOneOnly={chooseOneOnly}
          checkMemberRole={checkMemberRole}
          fowardContent={forwardContent}
          filterBlack={filterBlack}
        />
      )}
      <div className="flex justify-end px-9 py-6">
        <Button
          className="mr-6 border-0 bg-(--chat-bubble) px-6"
          onClick={closeOverlay}
        >
          {t("common.text.cancel")}
        </Button>
        <Button
          className="px-6"
          type="primary"
          loading={loading}
          onClick={confirmChoose}
        >
          {t("common.text.confirm")}
        </Button>
      </div>
    </>
  );
};
