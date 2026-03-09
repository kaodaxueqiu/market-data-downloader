import { GroupAtType, GroupItem, GroupMemberItem } from "@openim/wasm-client-sdk";
import { t } from "i18next";
import { useEffect, useState } from "react";

import cancel from "@/assets/images/chatHeader/cancel.png";
import speaker from "@/assets/images/chatHeader/speaker.png";
import OIMAvatar from "@/components/OIMAvatar";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";

import styles from "./chat-header.module.scss";

const GroupAnnouncementCard = ({
  currentGroupInfo,
  conversationID,
  openGroupAnnouncementDrawer,
}: {
  currentGroupInfo?: GroupItem;
  conversationID?: string;
  openGroupAnnouncementDrawer: () => void;
}) => {
  const [notificationOpUser, setNotificationOpUser] = useState<GroupMemberItem>();
  const updateCurrentConversationFields = useConversationStore(
    (state) => state.updateCurrentConversationFields,
  );

  useEffect(() => {
    if (!currentGroupInfo?.notificationUserID) return;

    const getNotificationOpUser = async () => {
      try {
        const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
          groupID: currentGroupInfo.groupID,
          userIDList: [currentGroupInfo.notificationUserID],
        });
        setNotificationOpUser(data[0]);
      } catch (error) {
        console.error(error);
      }
    };
    getNotificationOpUser();
  }, [currentGroupInfo?.notificationUserID, currentGroupInfo?.groupID]);

  const notificationRead = () => {
    if (!conversationID) return;
    IMSDK.resetConversationGroupAtType(conversationID);
    updateCurrentConversationFields({
      groupAtType: GroupAtType.AtNormal,
    });
  };

  return (
    <div
      className={styles["notice-card"]}
      onDoubleClick={() => {
        openGroupAnnouncementDrawer();
        notificationRead();
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <img width={20} src={speaker} alt="spear" />
          <span className="text-primary ml-2">{t("chat.group.groupAnnouncement")}</span>
        </div>
        <img
          className="cursor-pointer"
          width={16}
          src={cancel}
          alt="common.text.cancel"
          onClick={notificationRead}
        />
      </div>

      <div className="mb-4 line-clamp-2 pt-3 select-text">
        {currentGroupInfo?.notification}
      </div>

      <div
        className="flex w-fit items-center"
        onClick={() =>
          window.userClick(notificationOpUser?.userID, notificationOpUser?.groupID)
        }
      >
        <OIMAvatar
          size={20}
          src={notificationOpUser?.faceURL}
          text={notificationOpUser?.nickname || t("chat.group.administrator")}
        />
        <div className="ml-2 max-w-30 truncate text-xs text-(--sub-text)">
          {notificationOpUser?.nickname || t("chat.group.administrator")}
        </div>
      </div>
    </div>
  );
};

export default GroupAnnouncementCard;
