import { GroupAtType, GroupStatus } from "@openim/wasm-client-sdk";
import { useLatest, useThrottleFn, useUpdateEffect } from "ahooks";
import { useEffect } from "react";

import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import { IMSDK } from "@/layout/MainContentWrap";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
import { getBot } from "@/store/botMap";

export default function useConversationState() {
  const syncState = useUserStore((state) => state.syncState);
  const latestSyncState = useLatest(syncState);
  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const latestCurrentConversation = useLatest(currentConversation);
  const updateCurrentConversationFields = useConversationStore(
    (state) => state.updateCurrentConversationFields,
  );
  const updateConversationList = useConversationStore(
    (state) => state.updateConversationList,
  );
  const isMutedGroup = useConversationStore(
    (state) => state.currentGroupInfo?.status === GroupStatus.Muted,
  );
  const isBlackUser = useContactStore(
    (state) =>
      state.blackList.findIndex(
        (user) => user.userID === currentConversation?.userID,
      ) !== -1,
  );
  const agent = getBot(currentConversation?.userID);

  const { isJoinGroup, isNomal, currentIsMuted } = useCurrentMemberRole();

  useUpdateEffect(() => {
    if (syncState !== "loading") {
      checkConversationState();
    }
  }, [syncState]);

  useUpdateEffect(() => {
    throttleCheckConversationState();
  }, [currentConversation?.groupAtType, currentConversation?.unreadCount]);

  useEffect(() => {
    checkConversationState();
  }, [currentConversation?.conversationID]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkConversationState();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const checkConversationState = () => {
    if (
      !latestCurrentConversation.current ||
      latestSyncState.current === "loading" ||
      document.visibilityState === "hidden"
    )
      return;

    const conversation = latestCurrentConversation.current;

    if (conversation.unreadCount > 0) {
      IMSDK.markConversationMessageAsRead(conversation.conversationID);
      const updatedConversation = {
        ...conversation,
        unreadCount: 0,
      };
      updateConversationList([updatedConversation]);
      updateCurrentConversationFields({ unreadCount: 0 });
    }
    if (
      conversation.groupAtType !== GroupAtType.AtNormal &&
      conversation.groupAtType !== GroupAtType.AtGroupNotice
    ) {
      IMSDK.resetConversationGroupAtType(conversation.conversationID);
      updateCurrentConversationFields({
        groupAtType: GroupAtType.AtNormal,
      });
    }
  };

  const { run: throttleCheckConversationState } = useThrottleFn(
    checkConversationState,
    { wait: 2000, leading: false },
  );

  const getIsCanSendMessage = () => {
    if (currentConversation?.userID) {
      return !isBlackUser;
    }

    if (!isJoinGroup) {
      return false;
    }

    if (isMutedGroup && isNomal) {
      return false;
    }

    return !currentIsMuted;
  };

  return {
    agent,
    getIsCanSendMessage,
    currentIsMuted,
    isMutedGroup,
    isBlackUser,
    currentConversation,
  };
}
