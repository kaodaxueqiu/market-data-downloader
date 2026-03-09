import { GroupMemberRole } from "@openim/wasm-client-sdk";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { useUserStore } from "@/store";

export const AT_ALL_KEY = "AtAllTag";

export function useMention() {
  const { t } = useTranslation();

  const fetchMentionUsers = useCallback(
    async (keyword: string) => {
      const groupID = useConversationStore.getState().currentConversation?.groupID;
      if (!groupID) return [];

      try {
        if (
          (useConversationStore.getState().currentGroupInfo?.memberCount ?? 0) > 1000
        ) {
          let hasMore = true;
          let offset = 0;
          while (hasMore) {
            const { data } = await IMSDK.getGroupMemberList({
              groupID,
              offset,
              count: 500,
              filter: 0,
            });
            hasMore = data.length === 500;
            offset += data.length;
          }
        }
        const { data } = await IMSDK.searchGroupMembers({
          groupID,
          offset: 0,
          count: 100,
          keywordList: [keyword],
          isSearchMemberNickname: true,
          isSearchUserID: false,
        });
        if (data.length === 0) return [];

        const selfID = useUserStore.getState().selfInfo.userID;

        const users = data
          .filter((item) => item.userID !== selfID)
          .map((item) => ({
            userID: item.userID,
            nickname: item.nickname,
            faceURL: item.faceURL,
          }));

        const roleLevel =
          useConversationStore.getState().currentMemberInGroup?.roleLevel;
        if (
          !keyword &&
          (roleLevel === GroupMemberRole.Admin || roleLevel === GroupMemberRole.Owner)
        ) {
          users.unshift({
            userID: AT_ALL_KEY,
            nickname: t("system.text.mentionAll"),
            faceURL: "",
          });
        }
        return users;
      } catch (error) {
        return [];
      }
    },
    [t],
  );

  return { fetchMentionUsers };
}
