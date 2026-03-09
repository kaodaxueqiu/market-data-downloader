import { RightOutlined } from "@ant-design/icons";
import { SessionType } from "@openim/wasm-client-sdk";
import { FriendUserItem, GroupItem } from "@openim/wasm-client-sdk";
import { Empty, Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { useCallback } from "react";

import { BusinessUserInfo } from "@/api/services/user";
import { useConversationToggle } from "@/hooks/useConversationToggle";

import { ChatLogsItem, SearchData, TabKey } from ".";
import { ChatLogsRender } from "./ChatLogsPanel";
import { ContactItem, ContactRender } from "./ContactPanel";
import { ConversationRender } from "./ConversationPanel";
import { EmptyPlaceholder } from "./EmptyPlaceholder";
import { FileRender, MessageItemForFilePanel } from "./FilePanel";
import { useKeyPage } from "./useKeyPage";

const ShowMoreAction = ({ onClick }: { onClick: () => void }) => (
  <div className="flex cursor-pointer items-center" onClick={onClick}>
    <span className="text-primary">{t("common.text.viewMore")}</span>
    <RightOutlined className="text-primary" />
  </div>
);

const DashboardPanel = ({
  colleagues,
  friends,
  groups,
  chatLogs,
  keyword,
  historyFiles,
  // conversations,
  isActive,
  toggleTab,
  closeOverlay,
  toggleChatLogActive,
}: {
  colleagues: SearchData<BusinessUserInfo>;
  friends: SearchData<FriendUserItem>;
  groups: SearchData<GroupItem>;
  chatLogs: SearchData<ChatLogsItem>;
  keyword: string;
  historyFiles: SearchData<MessageItemForFilePanel>;
  // conversations: SearchData<ConversationItem>;
  isActive: boolean;
  toggleTab: (key: TabKey) => void;
  closeOverlay: () => void;
  toggleChatLogActive: (idx: number) => void;
}) => {
  const { toSpecifiedConversation } = useConversationToggle();

  const { activeIdx, updateIdx } = useKeyPage({
    isActive,
    maxIndex:
      friends.data.slice(0, 3).length +
      colleagues.data.slice(0, 3).length +
      groups.data.slice(0, 3).length +
      chatLogs.data.slice(0, 3).length +
      historyFiles.data.slice(0, 3).length,
    // conversations.data.slice(0, 3).length,
    elPrefix: "#dashboard-item-",
    callback: (idx) => {
      const tmpArr = [
        ...friends.data.slice(0, 3),
        ...colleagues.data.slice(0, 3),
        ...groups.data.slice(0, 3),
        ...chatLogs.data.slice(0, 3),
        ...historyFiles.data.slice(0, 3),
        // ...conversations.data.slice(0, 3),
      ];
      const select = tmpArr[idx];
      if (!select) return;

      if ((select as ContactItem).userID || (select as ContactItem).groupID) {
        contactJumpToConversation(select as ContactItem, idx);
      }
      // if (typeof (select as ConversationItem).attachedInfo === "string") {
      //   toSpecifiedConversation({
      //     sourceID:
      //       (select as ConversationItem).userID ||
      //       (select as ConversationItem).groupID ||
      //       "",
      //     sessionType: (select as ConversationItem).groupID
      //       ? SessionType.WorkingGroup
      //       : SessionType.Single,
      //     isChildWindow: true,
      //   });
      //   closeOverlay();
      //   return;
      // }
      if ((select as ChatLogsItem).conversationID) {
        messageJumpToConversation(select as ChatLogsItem, idx);
      }
    },
  });

  const contactJumpToConversation = useCallback((item: ContactItem, index: number) => {
    updateIdx(index);
    toSpecifiedConversation({
      sourceID: item.userID || item.groupID || "",
      sessionType: item.groupID ? SessionType.WorkingGroup : SessionType.Single,
      isChildWindow: true,
    });
    closeOverlay();
  }, []);

  const messageJumpToConversation = useCallback((item: ChatLogsItem, index: number) => {
    updateIdx(index);
    const idx = chatLogs.data.findIndex(
      (logs) => logs.conversationID === item.conversationID,
    );
    toggleTab("ChatLogs");
    setTimeout(() => toggleChatLogActive(idx));
  }, []);

  const loading =
    friends.loading ||
    colleagues.loading ||
    groups.loading ||
    chatLogs.loading ||
    historyFiles.loading;
  // conversations.loading;
  const isEmpty =
    !loading &&
    !(
      (
        friends.data.length +
        colleagues.data.length +
        groups.data.length +
        chatLogs.data.length +
        historyFiles.data.length
      )
      // conversations.data.length
    );
  const initialColleagueIdx = friends.data.slice(0, 3).length;
  const initialGroupIdx = initialColleagueIdx + colleagues.data.slice(0, 3).length;
  const initialChatLogsIdx = initialGroupIdx + groups.data.slice(0, 3).length;
  const initialHistoryFilesIdx = initialChatLogsIdx + chatLogs.data.slice(0, 3).length;
  const initialConversationIdx =
    initialHistoryFilesIdx + historyFiles.data.slice(0, 3).length;

  return (
    <Spin wrapperClassName="h-full" spinning={loading}>
      <div className="mr-1.5 ml-3 h-full overflow-y-auto pt-3 pr-1">
        {isEmpty && <EmptyPlaceholder />}
        {friends.data.length > 0 && (
          <div>
            <div className="mx-3 my-1 flex justify-between">
              <div>{t("common.text.contacts")}</div>
              {friends.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("Friends")} />
              )}
            </div>
            {friends.data.slice(0, 3).map((friend, idx) => (
              <ContactRender
                key={friend.userID}
                id={`dashboard-item-${idx}`}
                isActive={idx === activeIdx}
                item={friend}
                onClick={() => contactJumpToConversation(friend, idx)}
              />
            ))}
          </div>
        )}

        {colleagues.data.length > 0 && (
          <div>
            <div className="mx-3 my-1 flex justify-between">
              <div>{t("common.text.organization")}</div>
              {colleagues.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("Colleagues")} />
              )}
            </div>
            {colleagues.data.slice(0, 3).map((friend, idx) => (
              <ContactRender
                key={friend.userID}
                id={`dashboard-item-${initialColleagueIdx + idx}`}
                isActive={initialColleagueIdx + idx === activeIdx}
                item={friend}
                onClick={() =>
                  contactJumpToConversation(friend, initialColleagueIdx + idx)
                }
              />
            ))}
          </div>
        )}

        {groups.data.length > 0 && (
          <div
            className={clsx("mt-2 border-(--gap-text)", {
              "border-t": initialGroupIdx,
            })}
          >
            <div className="mx-3 mt-3 mb-1 flex justify-between">
              <div>{t("chat.group.myGroup")}</div>
              {groups.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("Groups")} />
              )}
            </div>
            {groups.data.slice(0, 3).map((group, idx) => (
              <ContactRender
                key={group.groupID}
                id={`dashboard-item-${initialGroupIdx + idx}`}
                isActive={activeIdx === initialGroupIdx + idx}
                item={group}
                onClick={() => contactJumpToConversation(group, initialGroupIdx + idx)}
              />
            ))}
          </div>
        )}

        {chatLogs.data.length > 0 && (
          <div
            className={clsx("mt-2 border-(--gap-text)", {
              "border-t": initialChatLogsIdx,
            })}
          >
            <div className="mx-3 mt-3 mb-1 flex justify-between">
              <div>{t("chat.message.messageHistory")}</div>
              {chatLogs.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("ChatLogs")} />
              )}
            </div>
            {chatLogs.data.slice(0, 3).map((chatLog, idx) => (
              <ChatLogsRender
                key={chatLog.conversationID}
                id={`dashboard-item-${initialChatLogsIdx + idx}`}
                isActive={activeIdx === initialChatLogsIdx + idx}
                result={chatLog}
                keyword={keyword}
                onClick={() =>
                  messageJumpToConversation(chatLog, initialChatLogsIdx + idx)
                }
              />
            ))}
          </div>
        )}

        {historyFiles.data.length > 0 && (
          <div
            className={clsx("mt-2 border-(--gap-text)", {
              "border-t": initialHistoryFilesIdx,
            })}
          >
            <div className="mx-3 mt-3 mb-1 flex justify-between">
              <div>{t("common.text.document")}</div>
              {historyFiles.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("HistoryFiles")} />
              )}
            </div>
            {historyFiles.data.slice(0, 3).map((fileMessage, idx) => (
              <FileRender
                key={fileMessage.clientMsgID}
                id={`dashboard-item-${initialHistoryFilesIdx + idx}`}
                isActive={activeIdx === initialHistoryFilesIdx + idx}
                message={fileMessage}
                onClick={() => updateIdx(initialHistoryFilesIdx + idx)}
              />
            ))}
          </div>
        )}

        {/* {conversations.data.length > 0 && (
          <div
            className={clsx("mt-2 border-(--gap-text)", {
              "border-t": initialConversationIdx,
            })}
          >
            <div className="mx-3 my-1 flex justify-between">
              <div>{t("common.text.conversation")}</div>
              {conversations.data.length > 3 && (
                <ShowMoreAction onClick={() => toggleTab("Conversations")} />
              )}
            </div>
            {conversations.data.slice(0, 3).map((conversation, idx) => (
              <ConversationRender
                key={conversation.conversationID}
                id={`dashboard-item-${initialConversationIdx + idx}`}
                isActive={activeIdx === initialConversationIdx + idx}
                item={conversation}
                onClick={() =>
                  contactJumpToConversation(conversation, initialConversationIdx + idx)
                }
              />
            ))}
          </div>
        )} */}
      </div>
    </Spin>
  );
};

export default DashboardPanel;
