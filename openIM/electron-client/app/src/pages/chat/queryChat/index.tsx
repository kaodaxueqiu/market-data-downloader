import { InfoCircleOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { useUnmount } from "ahooks";
import { t } from "i18next";
import { Group, Panel } from "react-resizable-panels";

import AgentStatusPanel from "@/components/AgentStatusPanel";
import { useAgentPolling } from "@/components/AgentStatusPanel/useAgentPolling";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useMessageStore, useUserStore } from "@/store";

import ChatContent from "./ChatContent";
import ChatFooter from "./ChatFooter";
import MultipleActionBar from "./ChatFooter/MultipleActionBar";
import ChatHeader from "./ChatHeader";
import useConversationState from "./useConversationState";
import { useDropAndPaste } from "./useDropAndPaste";
import { useMessageReceipt } from "./useMessageReceipt";

export const QueryChat = () => {
  const isCheckMode = useMessageStore((state) => state.isCheckMode);
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );

  const {
    agent,
    getIsCanSendMessage,
    isMutedGroup,
    currentIsMuted,
    isBlackUser,
    currentConversation,
  } = useConversationState();
  useMessageReceipt();

  const agentActive = useAgentPolling(agent?.userID);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);

  const isNotificationSession =
    currentConversation?.conversationType === SessionType.Notification;

  const { droping } = useDropAndPaste({
    currentConversation,
    getIsCanSendMessage,
  });

  useUnmount(() => {
    updateCurrentConversation();
  });

  const switchFooter = () => {
    if (isNotificationSession) {
      return null;
    }
    if (isCheckMode) {
      return <MultipleActionBar />;
    }
    if (!getIsCanSendMessage()) {
      let tip = t("chat.toast.notCanSendMessage");
      if (isMutedGroup) tip = t("chat.toast.groupMuted");
      if (currentIsMuted) tip = t("chat.toast.currentMuted");
      if (isBlackUser) tip = t("contact.toast.userBlacked");

      if (currentConversation?.draftText) {
        IMSDK.setConversationDraft({
          conversationID: currentConversation.conversationID,
          draftText: "",
        });
      }

      return (
        <div className="flex justify-center py-4.5 text-xs text-(--sub-text)">
          <InfoCircleOutlined rev={undefined} />
          <span className="ml-1">{tip}</span>
        </div>
      );
    }

    return (
      <Panel
        id="chat-footer"
        defaultSize={"25%"}
        maxSize={"60%"}
        minSize={210}
        className="min-h-50 overflow-visible!"
      >
        <ChatFooter />
      </Panel>
    );
  };

  return (
    <Group
      id="chat-container"
      className="relative h-full w-full overflow-hidden"
      orientation="vertical"
    >
      <ChatHeader agent={agent} isBlackUser={isBlackUser} />
      <Panel id="chat-main">
        <div className="flex h-full flex-col overflow-hidden">
          {agent && selfUserID && (
            <AgentStatusPanel agent={agent} userID={selfUserID} active={agentActive} />
          )}
          <div className="min-h-0 flex-1">
            <ChatContent isNotificationSession={isNotificationSession} />
          </div>
        </div>
      </Panel>
      {switchFooter()}

      {droping && (
        <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-[rgba(248,229,229,0.4)]">
          <div className="max-w-50 truncate text-(--sub-text)">
            {`${t("chat.composer.loosenToSend")} ${currentConversation?.showName}`}
          </div>
        </div>
      )}
    </Group>
  );
};
