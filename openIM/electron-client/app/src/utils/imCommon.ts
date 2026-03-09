import dayjs from "dayjs";
import { v4 as uuidV4 } from "uuid";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";
import { t } from "i18next";
import default_group from "@/assets/images/contact/my_groups.png";
import { v4 as uuidv4 } from "uuid";

import {
  CustomMessageType,
  GroupSessionTypes,
  SystemMessageTypes,
} from "@/constants/im";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";

import { escapeHtml } from "@/utils/escapeHtml";
import { secondsToTime } from "@/utils/time";
import {
  AtTextElem,
  ConversationItem,
  MessageItem,
  MessageType,
  PublicUserItem,
  SessionType,
  UploadFileParams,
} from "@openim/wasm-client-sdk";
import { isThisYear } from "date-fns";
import { FileWithPath } from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";
import { IMSDK } from "@/layout/MainContentWrap";
import { emit } from "@/utils/window/events";
import { AT_ALL_KEY } from "@/hooks/useMention";
import {
  getFriendApplicationLatestTime,
  getGroupApplicationLatestTime,
} from "@/utils/storage";

dayjs.extend(calendar);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.updateLocale("en", {
  calendar: {
    sameDay: "HH:mm",
    nextDay: "[tomorrow]",
    nextWeek: "dddd",
    lastDay: "[yesterday] HH:mm",
    lastWeek: "dddd HH:mm",
    sameElse: "YYYY/M/D HH:mm",
  },
});
dayjs.updateLocale("zh-cn", {
  calendar: {
    sameDay: "HH:mm",
    nextDay: "[明天]",
    nextWeek: "dddd",
    lastDay: "[昨天] HH:mm",
    lastWeek: "dddd HH:mm",
    sameElse: "YYYY年M月D日 HH:mm",
  },
});

export const AddFriendQrCodePrefix = "io.openim.app/addFriend/";
export const AddGroupQrCodePrefix = "io.openim.app/joinGroup/";

const linkWrap = ({
  userID,
  groupID,
  name,
  fromAt,
}: {
  userID: string;
  groupID: string;
  name: string;
  fromAt?: boolean;
}) => {
  return `<span class='link-el${
    fromAt ? "" : " member-el"
  } max-w-50 truncate inline-block align-bottom' onclick='userClick("${userID}","${
    groupID ?? ""
  }")'>${escapeHtml(name)}</span>`;
};

export const notificationMessageFormat = (msg: MessageItem) => {
  const selfID = useUserStore.getState().selfInfo.userID;
  const getName = (user: PublicUserItem) => {
    return user.userID === selfID ? t("system.text.you") : user.nickname;
  };
  try {
    switch (msg.contentType) {
      case MessageType.FriendAdded:
        return t("chat.message.description.alreadyFriendMessage");
      case MessageType.RevokeMessage:
        const data = JSON.parse(msg.notificationElem!.detail);
        const operator =
          data.revokerID === selfID ? t("system.text.you") : data.revokerNickname;
        const revoker =
          data.sourceMessageSendID === selfID
            ? t("system.text.you")
            : data.sourceMessageSenderNickname;
        const isAdminRevoke = data.revokerID !== data.sourceMessageSendID;
        if (isAdminRevoke) {
          return t("chat.message.description.advanceRevokeMessage", {
            operator: linkWrap({
              userID: data.revokerID,
              groupID: msg.groupID,
              name: operator,
            }),
            revoker: linkWrap({
              userID: data.sourceMessageSendID,
              groupID: msg.groupID,
              name: revoker,
            }),
          });
        }
        return t("chat.message.description.revokeMessage", {
          revoker: linkWrap({
            userID: data.revokerID,
            groupID: msg.groupID,
            name: operator,
          }),
        });
      case MessageType.GroupCreated:
        const groupCreatedDetail = JSON.parse(msg.notificationElem!.detail);
        const groupCreatedUser = groupCreatedDetail.opUser;
        return t("chat.message.description.createGroupMessage", {
          creator: linkWrap({
            userID: groupCreatedUser.userID,
            groupID: msg.groupID,
            name: getName(groupCreatedUser),
          }),
        });
      case MessageType.GroupInfoUpdated:
        const groupUpdateDetail = JSON.parse(msg.notificationElem!.detail);
        const groupUpdateUser = groupUpdateDetail.opUser;
        return t("chat.message.description.updateGroupInfoMessage", {
          operator: linkWrap({
            userID: groupUpdateUser.userID,
            groupID: msg.groupID,
            name: getName(groupUpdateUser),
          }),
        });
      case MessageType.GroupOwnerTransferred:
        const transferDetails = JSON.parse(msg.notificationElem!.detail);
        const transferOpUser = transferDetails.opUser;
        const newOwner = transferDetails.newGroupOwner;
        return t("chat.message.description.transferGroupMessage", {
          owner: linkWrap({
            userID: transferOpUser.userID,
            groupID: msg.groupID,
            name: getName(transferOpUser),
          }),
          newOwner: linkWrap({
            userID: newOwner.userID,
            groupID: msg.groupID,
            name: getName(newOwner),
          }),
        });
      case MessageType.MemberQuit:
        const quitDetails = JSON.parse(msg.notificationElem!.detail);
        const quitUser = quitDetails.quitUser;
        return t("chat.message.description.quitGroupMessage", {
          name: linkWrap({
            userID: quitUser.userID,
            groupID: msg.groupID,
            name: getName(quitUser),
          }),
        });
      case MessageType.MemberInvited:
        const inviteDetails = JSON.parse(msg.notificationElem!.detail);
        const inviteUser = inviteDetails.inviterUser ?? inviteDetails.opUser;
        const invitedUserList = inviteDetails.invitedUserList ?? [];
        let inviteStr = "";
        invitedUserList.slice(0, 3).map(
          (user: any) =>
            (inviteStr += `${linkWrap({
              userID: user.userID,
              groupID: msg.groupID,
              name: getName(user),
            })}、`),
        );
        inviteStr = inviteStr.slice(0, -1);
        return t("chat.message.description.invitedToGroupMessage", {
          operator: linkWrap({
            userID: inviteUser.userID,
            groupID: msg.groupID,
            name: getName(inviteUser),
          }),
          invitedUser: `${inviteStr}${
            invitedUserList.length > 3
              ? `${t("system.text.somePerson", {
                  num: invitedUserList.length,
                  othersNum: invitedUserList.length - 3,
                })}`
              : ""
          }`,
        });
      case MessageType.MemberKicked:
        const kickDetails = JSON.parse(msg.notificationElem!.detail);
        const kickOpUser = kickDetails.opUser;
        const kickdUserList = kickDetails.kickedUserList ?? [];
        let kickStr = "";
        kickdUserList.slice(0, 3).map(
          (user: any) =>
            (kickStr += `${linkWrap({
              userID: user.userID,
              groupID: msg.groupID,
              name: getName(user),
            })}、`),
        );
        kickStr = kickStr.slice(0, -1);
        return t("chat.message.description.kickInGroupMessage", {
          operator: linkWrap({
            userID: kickOpUser.userID,
            groupID: msg.groupID,
            name: getName(kickOpUser),
          }),
          kickedUser: `${kickStr}${kickdUserList.length > 3 ? "..." : ""}`,
        });
      case MessageType.MemberEnter:
        const enterDetails = JSON.parse(msg.notificationElem!.detail);
        const enterUser = enterDetails.entrantUser;
        return t("chat.message.description.joinGroupMessage", {
          name: linkWrap({
            userID: enterUser.userID,
            groupID: msg.groupID,
            name: getName(enterUser),
          }),
        });
      case MessageType.GroupDismissed:
        const dismissDetails = JSON.parse(msg.notificationElem!.detail);
        const dismissUser = dismissDetails.opUser;
        return t("chat.message.description.disbanedGroupMessage", {
          operator: linkWrap({
            userID: dismissUser.userID,
            groupID: msg.groupID,
            name: getName(dismissUser),
          }),
        });
      case MessageType.GroupMuted:
        const GROUPMUTEDDetails = JSON.parse(msg.notificationElem!.detail);
        const groupMuteOpUser = GROUPMUTEDDetails.opUser;
        return t("chat.message.description.allMuteMessage", {
          operator: linkWrap({
            userID: groupMuteOpUser.userID,
            groupID: msg.groupID,
            name: getName(groupMuteOpUser),
          }),
        });
      case MessageType.GroupCancelMuted:
        const GROUPCANCELMUTEDDetails = JSON.parse(msg.notificationElem!.detail);
        const groupCancelMuteOpUser = GROUPCANCELMUTEDDetails.opUser;
        return t("chat.message.description.cancelAllMuteMessage", {
          operator: linkWrap({
            userID: groupCancelMuteOpUser.userID,
            groupID: msg.groupID,
            name: getName(groupCancelMuteOpUser),
          }),
        });
      case MessageType.GroupMemberMuted:
        const gmMutedDetails = JSON.parse(msg.notificationElem!.detail);
        const muteTime = secondsToTime(gmMutedDetails.mutedSeconds);
        return t("chat.message.description.singleMuteMessage", {
          operator: linkWrap({
            userID: gmMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(gmMutedDetails.opUser),
          }),
          name: linkWrap({
            userID: gmMutedDetails.mutedUser.userID,
            groupID: msg.groupID,
            name: getName(gmMutedDetails.mutedUser),
          }),
          muteTime,
        });
      case MessageType.GroupMemberCancelMuted:
        const gmcMutedDetails = JSON.parse(msg.notificationElem!.detail);
        return t("chat.message.description.cancelSingleMuteMessage", {
          operator: linkWrap({
            userID: gmcMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(gmcMutedDetails.opUser),
          }),
          name: linkWrap({
            userID: gmcMutedDetails.mutedUser.userID,
            groupID: msg.groupID,
            name: getName(gmcMutedDetails.mutedUser),
          }),
        });
      case MessageType.GroupAnnouncementUpdated:
        const groupAnnouncementDetails = JSON.parse(msg.notificationElem!.detail);
        return t("chat.message.description.updateGroupAnnouncementMessage", {
          operator: linkWrap({
            userID: groupAnnouncementDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(groupAnnouncementDetails.opUser),
          }),
        });
      case MessageType.GroupNameUpdated:
        const groupNameDetails = JSON.parse(msg.notificationElem!.detail);
        return t("chat.message.description.updateGroupNameMessage", {
          operator: linkWrap({
            userID: groupNameDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(groupNameDetails.opUser),
          }),
          name: groupNameDetails.group.groupName,
        });
      case MessageType.BurnMessageChange:
        const burnDetails = JSON.parse(msg.notificationElem!.detail);
        return t("chat.message.description.burnReadStatus", {
          status: burnDetails.isPrivate
            ? t("system.text.open")
            : t("system.text.close"),
        });
      case MessageType.OANotification:
        const customNoti = JSON.parse(msg.notificationElem!.detail);
        return customNoti.text;
      case MessageType.MsgPinned:
        const pinMessageDetail = JSON.parse(msg.notificationElem!.detail);
        return t(
          pinMessageDetail.pinned
            ? "chat.message.description.pinnedMessage"
            : "chat.message.description.cancelPinnedMessage",
          {
            operator: linkWrap({
              userID: pinMessageDetail.opUser.userID,
              groupID: msg.groupID,
              name: getName(pinMessageDetail.opUser),
            }),
          },
        );
      default:
        return "";
    }
  } catch (error) {
    return "";
  }
};

export const formatConversionTime = (timestemp: number): string => {
  if (!timestemp) return "";

  const fromNowStr = dayjs(timestemp).fromNow();

  if (fromNowStr.includes(t("common.dateTime.relative.second"))) {
    return t("common.dateTime.relative.justNow");
  }

  if (
    !fromNowStr.includes(t("common.dateTime.relative.second")) &&
    !fromNowStr.includes(t("common.dateTime.relative.minute"))
  ) {
    return dayjs(timestemp).calendar();
  }

  return fromNowStr;
};

export const formatMessageTime = (timestemp: number, keepSameYear = false): string => {
  if (!timestemp) return "";

  const isRecent = dayjs().diff(timestemp, "day") < 7;
  const keepYear = keepSameYear || !isThisYear(timestemp);

  if (!isRecent && !keepYear) {
    return dayjs(timestemp).format("M/D HH:mm");
  }

  return dayjs(timestemp).calendar();
};

export const formatMomentsTime = (timestemp: number): string => {
  if (!timestemp) return "";

  const isRecent = dayjs().diff(timestemp, "day") < 7;

  if (!isRecent) {
    return dayjs(timestemp).format("M月D日");
  }

  return dayjs(timestemp).calendar();
};

export const parseBr = (text: string) => {
  return text
    .replace(new RegExp("\\n", "g"), "<br>")
    .replace(new RegExp("\n", "g"), "<br>");
};

export const formatMessageByType = (message?: MessageItem): string => {
  if (!message) return "";
  const selfUserID = useUserStore.getState().selfInfo.userID;
  const isSelf = (id: string) => id === selfUserID;
  const getName = (user: PublicUserItem) => {
    return user.userID === selfUserID ? t("system.text.you") : user.nickname;
  };
  try {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return message.textElem!.content;
      case MessageType.AtTextMessage:
        return formatAtText(message.atTextElem!, true);
      case MessageType.PictureMessage:
        return t("chat.message.description.imageMessage");
      case MessageType.VideoMessage:
        return t("chat.message.description.videoMessage");
      case MessageType.VoiceMessage:
        return t("chat.message.description.voiceMessage");
      case MessageType.LocationMessage:
        const locationInfo = JSON.parse(message.locationElem!.description);
        return t("chat.message.description.locationMessage", {
          location: locationInfo.name,
        });
      case MessageType.CardMessage:
        return t("chat.message.description.cardMessage");
      case MessageType.MergeMessage:
        return t("chat.message.description.mergeMessage");
      case MessageType.FileMessage:
        return t("chat.message.description.fileMessage", {
          file: message.fileElem!.fileName,
        });
      case MessageType.RevokeMessage:
        const data = JSON.parse(message.notificationElem!.detail);
        const operator = isSelf(data.revokerID)
          ? t("system.text.you")
          : data.revokerNickname;
        const revoker = isSelf(data.sourceMessageSendID)
          ? t("system.text.you")
          : data.sourceMessageSenderNickname;

        const isAdminRevoke = data.revokerID !== data.sourceMessageSendID;
        if (isAdminRevoke) {
          return t("chat.message.description.advanceRevokeMessage", {
            operator,
            revoker,
          });
        }
        return t("chat.message.description.revokeMessage", { revoker });
      case MessageType.CustomMessage:
        const customEl = message.customElem;
        const customData = JSON.parse(customEl!.data);
        if (customData.customType === CustomMessageType.MassMsg)
          return t("chat.message.description.massMessage");
        return t("chat.message.description.customMessage");
      case MessageType.QuoteMessage:
        return message.quoteElem!.text || t("chat.message.description.quoteMessage");
      case MessageType.FaceMessage:
        return t("chat.message.description.faceMessage");
      case MessageType.FriendAdded:
        return t("chat.message.description.alreadyFriendMessage");
      case MessageType.MemberEnter:
        const enterDetails = JSON.parse(message.notificationElem!.detail);
        const enterUser = enterDetails.entrantUser;
        return t("chat.message.description.joinGroupMessage", {
          name: getName(enterUser),
        });
      case MessageType.GroupCreated:
        const groupCreatedDetail = JSON.parse(message.notificationElem!.detail);
        const groupCreatedUser = groupCreatedDetail.opUser;
        return t("chat.message.description.createGroupMessage", {
          creator: getName(groupCreatedUser),
        });
      case MessageType.MemberInvited:
        const inviteDetails = JSON.parse(message.notificationElem!.detail);
        const inviteUser = inviteDetails.inviterUser ?? inviteDetails.opUser;
        const invitedUserList = inviteDetails.invitedUserList ?? [];
        let inviteStr = "";
        invitedUserList
          .slice(0, 3)
          .map((user: any) => (inviteStr += `${getName(user)}、`));
        inviteStr = inviteStr.slice(0, -1);
        return t("chat.message.description.invitedToGroupMessage", {
          operator: getName(inviteUser),
          invitedUser: `${inviteStr}${
            invitedUserList.length > 3
              ? `${t("system.text.somePerson", {
                  num: invitedUserList.length,
                  othersNum: invitedUserList.length - 3,
                })}`
              : ""
          }`,
        });
      case MessageType.MemberKicked:
        const kickDetails = JSON.parse(message.notificationElem!.detail);
        const kickOpUser = kickDetails.opUser;
        const kickdUserList = kickDetails.kickedUserList ?? [];
        let kickStr = "";
        kickdUserList.slice(0, 3).map((user: any) => (kickStr += `${getName(user)}、`));
        kickStr = kickStr.slice(0, -1);
        return t("chat.message.description.kickInGroupMessage", {
          operator: getName(kickOpUser),
          kickedUser: `${kickStr}${
            kickdUserList.length > 3
              ? `${t("system.text.somePerson", {
                  num: kickdUserList.length,
                  othersNum: kickdUserList.length - 3,
                })}`
              : ""
          }`,
        });
      case MessageType.MemberQuit:
        const quitDetails = JSON.parse(message.notificationElem!.detail);
        const quitUser = quitDetails.quitUser;
        return t("chat.message.description.quitGroupMessage", {
          name: getName(quitUser),
        });
      case MessageType.GroupInfoUpdated:
        const groupUpdateDetail = JSON.parse(message.notificationElem!.detail);
        const groupUpdateUser = groupUpdateDetail.opUser;
        return t("chat.message.description.updateGroupInfoMessage", {
          operator: getName(groupUpdateUser),
        });
      case MessageType.GroupOwnerTransferred:
        const transferDetails = JSON.parse(message.notificationElem!.detail);
        const transferOpUser = transferDetails.opUser;
        const newOwner = transferDetails.newGroupOwner;
        return t("chat.message.description.transferGroupMessage", {
          owner: getName(transferOpUser),
          newOwner: getName(newOwner),
        });
      case MessageType.GroupDismissed:
        const dismissDetails = JSON.parse(message.notificationElem!.detail);
        const dismissUser = dismissDetails.opUser;
        return t("chat.message.description.disbanedGroupMessage", {
          operator: getName(dismissUser),
        });
      case MessageType.GroupMuted:
        const GROUPMUTEDDetails = JSON.parse(message.notificationElem!.detail);
        const groupMuteOpUser = GROUPMUTEDDetails.opUser;
        return t("chat.message.description.allMuteMessage", {
          operator: getName(groupMuteOpUser),
        });
      case MessageType.GroupCancelMuted:
        const GROUPCANCELMUTEDDetails = JSON.parse(message.notificationElem!.detail);
        const groupCancelMuteOpUser = GROUPCANCELMUTEDDetails.opUser;
        return t("chat.message.description.cancelAllMuteMessage", {
          operator: getName(groupCancelMuteOpUser),
        });
      case MessageType.GroupMemberMuted:
        const gmMutedDetails = JSON.parse(message.notificationElem!.detail);
        const muteTime = secondsToTime(gmMutedDetails.mutedSeconds);
        return t("chat.message.description.singleMuteMessage", {
          operator: getName(gmMutedDetails.opUser),
          name: getName(gmMutedDetails.mutedUser),
          muteTime,
        });
      case MessageType.GroupMemberCancelMuted:
        const gmcMutedDetails = JSON.parse(message.notificationElem!.detail);
        return t("chat.message.description.cancelSingleMuteMessage", {
          operator: getName(gmcMutedDetails.opUser),
          name: getName(gmcMutedDetails.mutedUser),
        });
      case MessageType.GroupAnnouncementUpdated:
        const groupAnnouncementDetails = JSON.parse(message.notificationElem!.detail);
        return t("chat.message.description.updateGroupAnnouncementMessage", {
          operator: getName(groupAnnouncementDetails.opUser),
        });
      case MessageType.GroupNameUpdated:
        const groupNameDetails = JSON.parse(message.notificationElem!.detail);
        return t("chat.message.description.updateGroupNameMessage", {
          operator: getName(groupNameDetails.opUser),
          name: groupNameDetails.group.groupName,
        });
      case MessageType.OANotification:
        const customNoti = JSON.parse(message.notificationElem!.detail);
        return customNoti.text;
      case MessageType.BurnMessageChange:
        const burnDetails = JSON.parse(message.notificationElem!.detail);
        return t("chat.message.description.burnReadStatus", {
          status: burnDetails.isPrivate
            ? t("system.text.open")
            : t("system.text.close"),
        });
      case MessageType.MarkdownMessage:
        return t("chat.message.description.markdownMessage");
      case MessageType.StreamMessage:
        return (
          message.streamElem?.content + (message.streamElem?.packets.join("") ?? "")
        );
      case MessageType.MsgPinned:
        const pinMessageDetail = JSON.parse(message.notificationElem!.detail);
        return t(
          pinMessageDetail.pinned
            ? "chat.message.description.pinnedMessage"
            : "chat.message.description.cancelPinnedMessage",
          {
            operator: getName(pinMessageDetail.opUser),
          },
        );
      default:
        return "";
    }
  } catch (error) {
    console.warn(message);
    console.warn(error);
    return "";
  }
};

export const initStore = () => {
  calcApplicationBadge();
  const { getSelfInfoByReq, getWorkMomentsUnreadCount } = useUserStore.getState();
  const {
    getBlackListByReq,
    getAgentsListByReq,
    getRecvFriendApplicationListByReq,
    getRecvGroupApplicationListByReq,
    getSendFriendApplicationListByReq,
    getSendGroupApplicationListByReq,
  } = useContactStore.getState();
  const { getConversationListByReq, getConversationGroupsByReq, getUnReadCountByReq } =
    useConversationStore.getState();

  getConversationListByReq();
  getConversationGroupsByReq();
  getSelfInfoByReq();
  getBlackListByReq();
  getAgentsListByReq();
  getRecvFriendApplicationListByReq();
  getRecvGroupApplicationListByReq();
  getSendFriendApplicationListByReq();
  getSendGroupApplicationListByReq();
  getWorkMomentsUnreadCount();
  getUnReadCountByReq().then((count) => window.electronAPI?.updateUnreadCount(count));
};

export const conversationSort = (
  conversationList: ConversationItem[],
  originalList?: ConversationItem[],
) => {
  const listWithIndex = conversationList.map((item, index) => ({
    ...item,
    originalIndex:
      originalList?.findIndex((c) => c.conversationID === item.conversationID) ?? index,
  }));

  const arr: string[] = [];
  const filterArr = listWithIndex.filter((c) => {
    if (!arr.includes(c.conversationID)) {
      arr.push(c.conversationID);
      return true;
    }
    return false;
  });

  filterArr.sort((a, b) => {
    if (a.isPinned === b.isPinned) {
      const aCompare =
        a.draftTextTime > a.latestMsgSendTime ? a.draftTextTime : a.latestMsgSendTime;
      const bCompare =
        b.draftTextTime > b.latestMsgSendTime ? b.draftTextTime : b.latestMsgSendTime;
      if (aCompare > bCompare) {
        return -1;
      } else if (aCompare < bCompare) {
        return 1;
      } else {
        if (!originalList) return 0;
        return a.originalIndex - b.originalIndex;
      }
    } else if (a.isPinned && !b.isPinned) {
      return -1;
    } else {
      return 1;
    }
  });

  return filterArr.map(({ originalIndex, ...rest }) => rest);
};

export const isGroupSession = (sessionType?: SessionType) =>
  sessionType ? GroupSessionTypes.includes(sessionType) : false;

export const formatAtText = (atel: AtTextElem, onlyText?: boolean) => {
  let text = atel.text;
  const pattern = /@(\S+?)\b/g;
  const arr = text.replace(/@+/g, "@").match(pattern);
  const atUserList = atel.atUsersInfo ?? [];
  const currentGroupID = useConversationStore.getState().currentConversation?.groupID;
  arr?.map((match) => {
    const member = atUserList.find((user) => user.atUserID === match.slice(1));
    if (member) {
      const displayName = `@${
        member.atUserID === AT_ALL_KEY
          ? t("system.text.mentionAll")
          : member.groupNickname
      }`;
      text = text.replace(
        match,
        onlyText
          ? displayName
          : linkWrap({
              fromAt: true,
              userID: member.atUserID,
              name: displayName,
              groupID: currentGroupID!,
            }),
      );
    }
  });
  return text;
};

export const parseAtToModel = (atel: AtTextElem) => {
  let str = atel.text;
  const atUserList = atel.atUsersInfo ?? [];
  const pattern = /@(\S+?)\b/g;
  const arr = str.replace(/@+/g, "@").match(pattern);
  arr?.map((match) => {
    const member = atUserList.find((user) => user.atUserID === match.slice(1));
    if (member) {
      const displayName =
        member.atUserID === AT_ALL_KEY
          ? t("system.text.mentionAll")
          : member.groupNickname;
      str = str.replace(
        match,
        `<span class="im-mention-blot" data-id="${member.atUserID}" data-value="${displayName}" contenteditable="false"><span contenteditable="false">@${displayName}</span></span>${mentionCursorChar}`,
      );
    }
  });
  return str;
};

const regex =
  /\b(https?:\/\/|www\.)[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+)?(\.[a-zA-Z]{2,})?(\/[a-zA-Z0-9\/_.-]*(%[a-fA-F0-9]{2})*(\/[a-zA-Z0-9\/_.-]*)*(\?\S*)?(#\S*)?)?(?=([^a-zA-Z0-9\/_.-]|$))/g;

const mentionCursorChar = "\u200B";

export const formatLink = (content: string) =>
  content.replace(regex, (match) => {
    let href = match;
    if (!match.match(/^https?:\/\//)) {
      href = "https://" + match;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow" class="link-el">${match}</a>`;
  });

export const calcApplicationBadge = async () => {
  const friendApplicationLatestTime = (await getFriendApplicationLatestTime()) ?? 0;
  const groupApplicationLatestTime = (await getGroupApplicationLatestTime()) ?? 0;
  const { data: unHandleFriendApplicationNum } =
    await IMSDK.getFriendApplicationUnhandledCount({
      time: friendApplicationLatestTime,
    });
  const { data: unHandleGroupApplicationNum } =
    await IMSDK.getGroupApplicationUnhandledCount({ time: groupApplicationLatestTime });
  useContactStore
    .getState()
    .updateUnHandleFriendApplicationCount(unHandleFriendApplicationNum);
  useContactStore
    .getState()
    .updateUnHandleGroupApplicationCount(unHandleGroupApplicationNum);
};

export const checkNotificationPermission = () => {
  if (window.Notification && window.Notification.permission === "default") {
    Notification.requestPermission();
  }
};

export const createNotification = ({
  message,
  conversation,
  callback,
}: {
  message: MessageItem;
  conversation: ConversationItem;
  callback: (conversation: ConversationItem) => void;
}) => {
  if (!window.Notification || window.Notification.permission !== "granted") return;

  const notification = new Notification(conversation.showName, {
    dir: "auto",
    tag: uuidv4(),
    // @ts-ignore
    renotify: true,
    body: getConversationContent(message),
  });
  notification.onclick = () => {
    callback(conversation);
    window.focus();
    setTimeout(() => window.electronAPI?.showMainWindow());
    notification.close();
  };
};

export const createRTCNotification = async ({
  message,
  userInfo,
  sessionType,
  callback,
}: {
  message: string;
  sessionType: SessionType;
  userInfo: PublicUserItem;
  callback?: (sourceID: string, sessionType: SessionType) => void;
}) => {
  if (!window.Notification || window.Notification.permission !== "granted") return;
  const notification = new Notification(t("system.text.meetingInvitation"), {
    dir: "auto",
    tag: uuidv4(),
    // @ts-ignore
    renotify: true,
    body: message,
  });
  notification.onclick = () => {
    callback?.(userInfo.userID, sessionType);
    window.focus();
    notification.close();
  };
};

export const getConversationContent = (message: MessageItem) => {
  if (
    !message.groupID ||
    SystemMessageTypes.includes(message.contentType) ||
    message.sendID === useUserStore.getState().selfInfo.userID
  ) {
    return formatMessageByType(message);
  }
  return `${message.senderNickname}：${formatMessageByType(message)}`;
};

export const uploadFile = async (file: FileWithPath) => {
  const params: UploadFileParams = {
    name: file.name,
    contentType: file.type,
    uuid: uuidV4(),
    cause: "",
  };
  if (window.electronAPI) {
    params.filepath =
      file.path ||
      (await window.electronAPI.saveFileToDisk({
        file,
        type: "fileCache",
        sync: true,
      }));
  } else {
    params.file = file;
  }
  return IMSDK.uploadFile(params);
};

export const getConversationIDByMsg = (message: MessageItem) => {
  if (message.sessionType === SessionType.Single) {
    const ids = [message.sendID, message.recvID].sort();
    return `si_${ids[0]}_${ids[1]}`;
  }
  if (message.sessionType === SessionType.Group) {
    return `sg_${message.groupID}`;
  }
  if (message.sessionType === SessionType.Notification) {
    return `sn_${message.sendID}_${message.recvID}`;
  }
  return "";
};

export const getGroupConversationID = (groupID: string) => `sg_${groupID}`;
