import { InfoCircleOutlined } from "@ant-design/icons";
import {
  CbEvents,
  FriendUserItem,
  GroupJoinSource,
  GroupMemberItem,
  SessionType,
  WSEvent,
} from "@openim/wasm-client-sdk";
import { useQuery } from "@tanstack/react-query";
import { useLatest } from "ahooks";
import { Button, Divider, Spin } from "antd";
import dayjs from "dayjs";
import { t } from "i18next";
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
import { useCopyToClipboard } from "react-use";

import {
  BusinessUserInfo,
  getBusinessUserInfo,
  getBusinessUserInfoWithDepartment,
} from "@/api/services/user";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import EditableContent from "@/components/EditableContent";
import OIMAvatar from "@/components/OIMAvatar";
import { useConversationToggle } from "@/hooks/useConversationToggle";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useUserRelation } from "@/hooks/useUserRelation";
import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

import CardActionRow from "./CardActionRow";
import EditSelfInfo from "./EditSelfInfo";
import SendRequest from "./SendRequest";

interface IUserCardModalProps {
  userID?: string;
  groupID?: string;
  isSelf?: boolean;
  notAdd?: boolean;
  cardInfo?: CardInfo;
}

export type CardInfo = Partial<BusinessUserInfo & FriendUserItem>;

const getGender = (gender: number) => {
  if (!gender) return "-";
  return gender === 1 ? t("common.text.man") : t("common.text.female");
};

const UserCardModal: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  IUserCardModalProps
> = (props, ref) => {
  const { userID, groupID, isSelf, notAdd } = props;

  const editInfoRef = useRef<OverlayVisibleHandle>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo>();
  const [isSendRequest, setIsSendRequest] = useState(false);
  const [userFields, setUserFields] = useState<FieldRow[]>([]);
  const [organizationFields, setOrganizationFields] = useState<
    { orgName: string; fields: FieldRow[] }[]
  >([]);
  const [gorupMemberFields, setGorupMemberFields] = useState<FieldRow[]>([]);

  const selfInfo = useUserStore((state) => state.selfInfo);
  const organizationInfoList = useUserStore((state) => state.organizationInfoList);

  const { isBlack, isFriend } = useUserRelation(userID ?? "");

  const { isOverlayOpen, closeOverlay: originalCloseOverlay } = useOverlayVisible(ref);

  const closeOverlay = useCallback(() => {
    console.log("[UserCardModal] closeOverlay called");
    console.trace("[UserCardModal] Stack trace:");
    originalCloseOverlay();
  }, [originalCloseOverlay]);
  const { toSpecifiedConversation } = useConversationToggle();
  const [_, copyToClipboard] = useCopyToClipboard();

  const getCardInfo = async (): Promise<{
    cardInfo: CardInfo;
    memberInfo?: GroupMemberItem | null;
  }> => {
    if (isSelf) {
      setGorupMemberFields([]);
      let cardInfo: CardInfo = selfInfo;
      try {
        const users = await getBusinessUserInfoWithDepartment([selfInfo.userID]);
        if (users[0]) {
          cardInfo = { ...selfInfo, ...users[0] };
          useUserStore.getState().updateSelfInfo(users[0]);
        }
      } catch {
        try {
          const resp = await getBusinessUserInfo([selfInfo.userID]);
          const info = resp.data.users[0];
          if (info) {
            cardInfo = { ...selfInfo, ...info };
            useUserStore.getState().updateSelfInfo(info);
          }
        } catch (error) {
          console.error("get self business info failed", error);
        }
      }
      return { cardInfo };
    }
    let userInfo: CardInfo | null = null;
    const friendInfo = useContactStore
      .getState()
      .friendList.find((item) => item.userID === userID);
    if (friendInfo) {
      userInfo = { ...friendInfo };
    } else {
      const { data } = await IMSDK.getUsersInfo([userID!]);
      userInfo = { ...(data[0] ?? {}) };
    }

    let memberInfo;
    if (groupID) {
      const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
        groupID,
        userIDList: [userID!],
      });
      memberInfo = data[0];
    }

    try {
      const users = await getBusinessUserInfoWithDepartment([userID!]);
      userInfo = { ...userInfo, ...users[0] };
    } catch (error) {
      console.error("get business user info failed", userID, error);
    }
    return {
      cardInfo: userInfo,
      memberInfo,
    };
  };

  const refreshData = (data?: {
    cardInfo: CardInfo | null;
    memberInfo?: GroupMemberItem | null;
  }) => {
    if (!data) {
      return;
    }
    const { cardInfo, memberInfo } = data;

    setCardInfo(cardInfo!);
    setUserInfoRow(cardInfo!);
    setOrganizationInfoRow(cardInfo!);
    setGroupMemberInfoRow(memberInfo ?? undefined);
  };

  const {
    data: fullCardInfo,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["userInfo", userID],
    queryFn: getCardInfo,
    enabled: isOverlayOpen && Boolean(userID),
  });

  const latestFullCardInfo = useLatest(fullCardInfo);

  useEffect(() => {
    if (!isOverlayOpen) return;
    const friendAddedHandler = ({ data }: WSEvent<FriendUserItem>) => {
      if (data.userID === userID) {
        refetch();
      }
    };
    IMSDK.on(CbEvents.OnFriendAdded, friendAddedHandler);
    refreshData(
      props.cardInfo ? { cardInfo: props.cardInfo } : latestFullCardInfo.current,
    );
    return () => {
      IMSDK.off(CbEvents.OnFriendAdded, friendAddedHandler);
    };
  }, [isOverlayOpen, props.cardInfo]);

  useEffect(() => {
    if (fullCardInfo) {
      refreshData(fullCardInfo);
    }
  }, [fullCardInfo]);

  const refreshSelfInfo = useCallback(() => {
    const latestInfo = useUserStore.getState().selfInfo;
    setCardInfo(latestInfo);
    setUserInfoRow(latestInfo);
  }, [isSelf]);

  const updateCardRemark = (remark: string) => {
    setUserInfoRow({ ...cardInfo!, remark });
  };
  const setUserInfoRow = (info: CardInfo) => {
    let tmpFields = [] as FieldRow[];
    tmpFields.push({
      title: t("common.text.nickName"),
      value: info.nickname || "",
    });
    const isFriend = info?.remark !== undefined;

    if (isFriend) {
      tmpFields.push({
        title: t("common.text.remark"),
        value: info.remark || "-",
        editable: true,
      });
    }
    if (isFriend || isSelf) {
      tmpFields = [
        ...tmpFields,
        ...[
          {
            title: t("common.text.gender"),
            value: getGender(info.gender!),
          },
          {
            title: t("common.text.birth"),
            value: info.birth ? dayjs(info.birth).format("YYYY/M/D") : "-",
          },
          {
            title: t("auth.text.phoneNumber"),
            value: info.phoneNumber || "-",
          },
          {
            title: t("auth.text.email"),
            value: info.email || "-",
          },
        ],
      ];
    }
    setUserFields(tmpFields);
  };

  const setGroupMemberInfoRow = async (memberInfo?: GroupMemberItem) => {
    if (!memberInfo) {
      return;
    }

    let joinSourceStr = "-";
    if (memberInfo.joinSource === GroupJoinSource.Invitation) {
      const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
        groupID: groupID!,
        userIDList: [memberInfo.inviterUserID],
      });
      const inviterInfo = data[0];
      joinSourceStr = t("common.text.inviteToGroup", {
        who: inviterInfo?.nickname ?? "",
      });
    } else {
      joinSourceStr =
        memberInfo.joinSource === GroupJoinSource.QrCode
          ? t("common.text.qrCodeToGroup")
          : t("common.text.selectIDToGroup");
    }
    setGorupMemberFields([
      {
        title: t("common.text.groupNickName"),
        value: memberInfo.nickname,
      },
      {
        title: t("common.text.joinGroupTime"),
        value: dayjs(memberInfo.joinTime).format("YYYY/M/D"),
      },
      {
        title: t("common.text.joinGroupMode"),
        value: joinSourceStr,
      },
    ]);
  };

  const setOrganizationInfoRow = (cardInfo: CardInfo) => {
    const orgInfoList = useUserStore.getState().organizationInfoList;
    const organizationData =
      cardInfo.members?.map((item) => {
        const orgName =
          orgInfoList.find((o) => o.organizationID === item.department?.organizationID)?.name ?? "";
        return {
          orgName,
          fields: [
            {
              title: t("common.text.department"),
              value: item.department?.name ?? "-",
            },
            {
              title: t("common.text.position"),
              value: item.position || "-",
            },
          ],
        };
      }) ?? [];
    setOrganizationFields(organizationData);
  };

  const backToCard = () => {
    setIsSendRequest(false);
  };

  const trySendRequest = () => {
    setIsSendRequest(true);
  };

  const resetState = () => {
    setCardInfo(undefined);
    setUserFields([]);
    setGorupMemberFields([]);
    setOrganizationFields([]);
    setIsSendRequest(false);
  };

  const showAddFriend = !isFriend && !isSelf && !notAdd;

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={332}
      centered
      onCancel={closeOverlay}
      destroyOnClose
      mask={false}
      afterClose={resetState}
      ignoreClasses=".ignore-drag, .no-padding-modal, .cursor-pointer"
      className="no-padding-modal"
    >
      <Spin spinning={isPending}>
        {isSendRequest ? (
          <SendRequest cardInfo={cardInfo!} backToCard={backToCard} />
        ) : (
          <div className="flex max-h-130 min-h-121 flex-col overflow-hidden bg-[url(@/assets/images/common/card_bg.png)] bg-size-[332px_134px] bg-no-repeat px-5.5">
            <div className="h-26 min-h-26 w-full cursor-move" />
            <div className="ignore-drag flex flex-1 flex-col overflow-hidden">
              <div className="mb-1 flex items-center">
                <OIMAvatar
                  size={60}
                  src={cardInfo?.faceURL}
                  text={cardInfo?.nickname}
                />
                <div className="ml-3 flex h-15 flex-1 flex-col justify-around overflow-hidden">
                  <div className="flex w-fit max-w-[80%] items-baseline">
                    <div
                      className="flex-1 truncate text-base font-medium text-white select-text"
                      title={cardInfo?.nickname}
                    >
                      {cardInfo?.nickname}
                    </div>
                    {/* <div className="ml-3 text-xs text-white">{t("common.text.online")}</div> */}
                  </div>
                  <div className="flex items-center">
                    <div
                      className="mr-3 cursor-pointer text-xs text-(--sub-text)"
                      onClick={() => {
                        copyToClipboard(cardInfo?.userID ?? "");
                        feedbackToast({ msg: t("common.toast.copySuccess") });
                      }}
                    >
                      {cardInfo?.userID}
                    </div>
                    <CardActionRow
                      cardInfo={cardInfo}
                      isFriend={isFriend}
                      isBlackUser={isBlack}
                      isSelf={isSelf}
                      closeOverlay={closeOverlay}
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                {Boolean(groupID) && Boolean(gorupMemberFields.length) && (
                  <UserCardDataGroup
                    divider
                    title={t("common.text.groupInfo")}
                    fieldRows={gorupMemberFields}
                  />
                )}
                {organizationFields.map((org, idx) => (
                  <UserCardDataGroup
                    key={idx}
                    hiddenTitle={idx > 0 && org.orgName === organizationFields[idx - 1]?.orgName}
                    title={org.orgName}
                    fieldRows={org.fields}
                  />
                ))}
                <UserCardDataGroup
                  title={t("common.text.personalInfo")}
                  userID={cardInfo?.userID}
                  fieldRows={userFields}
                  updateCardRemark={updateCardRemark}
                />
              </div>
            </div>
            {isBlack && (
              <div className="mt-3 flex justify-center text-xs text-(--sub-text)">
                <InfoCircleOutlined rev={undefined} />
                <span className="ml-1">{t("contact.toast.userBlacked")}</span>
              </div>
            )}
            <div className="mx-1 mt-3 mb-6 flex items-center gap-6">
              {showAddFriend && (
                <Button type="primary" className="flex-1" onClick={trySendRequest}>
                  {t("common.text.addFriends")}
                </Button>
              )}
              {isSelf && (
                <Button
                  type="primary"
                  className="flex-1"
                  onClick={() => editInfoRef.current?.openOverlay()}
                >
                  {t("common.text.editInfo")}
                </Button>
              )}
              {!isSelf && !isBlack && (
                <Button
                  type="primary"
                  className="flex-1"
                  onClick={async () => {
                    let conv = useConversationStore.getState().conversationList.find(
                      (c) => c.userID === userID,
                    );
                    if (!conv) {
                      try {
                        const { data } = await IMSDK.getOneConversation({
                          sourceID: userID!,
                          sessionType: SessionType.Single,
                        });
                        conv = data;
                      } catch {}
                    }
                    if (conv?.isHidden) {
                      (IMSDK as any).unhideConversation(conv.conversationID).catch(() => {});
                      useConversationStore.getState().pushConversationList([
                        { ...conv, isHidden: false },
                      ]);
                    }
                    await toSpecifiedConversation({
                      sourceID: userID!,
                      sessionType: SessionType.Single,
                    });
                    closeOverlay();
                  }}
                >
                  {t("chat.action.sendMessage")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Spin>

      <EditSelfInfo ref={editInfoRef} refreshSelfInfo={refreshSelfInfo} />
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(UserCardModal));

interface IUserCardDataGroupProps {
  title: string;
  userID?: string;
  divider?: boolean;
  fieldRows: FieldRow[];
  hiddenTitle?: boolean;
  updateCardRemark?: (remark: string) => void;
}

type FieldRow = {
  title: string;
  value: string;
  editable?: boolean;
};

const UserCardDataGroup: FC<IUserCardDataGroupProps> = ({
  title,
  userID,
  divider,
  fieldRows,
  hiddenTitle,
  updateCardRemark,
}) => {
  const tryUpdateRemark = async (remark: string) => {
    try {
      await IMSDK.setFriendRemark({
        toUserID: userID!,
        remark,
      });
      updateCardRemark?.(remark);
    } catch (error) {
      feedbackToast({ error });
    }
  };
  return (
    <div>
      {!hiddenTitle && <div className="my-4 text-(--sub-text)">{title}</div>}
      {fieldRows.map((fieldRow, idx) => (
        <div className="my-4 flex items-center text-xs" key={idx}>
          <div className="w-24 shrink-0 text-(--sub-text)">{fieldRow.title}</div>
          {fieldRow.editable ? (
            <EditableContent
              className="ml-0!"
              textClassName="font-medium"
              value={fieldRow.value}
              editable={true}
              onChange={tryUpdateRemark}
              size="small"
            />
          ) : (
            <div className="flex-1 truncate select-text">{fieldRow.value}</div>
          )}
        </div>
      ))}

      {divider && <Divider className="my-0 border-(--gap-text)" />}
    </div>
  );
};
