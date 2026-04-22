import {
  ConversationItem as ConversationItemType,
  GroupAtType,
  MessageItem,
  MessageReceiveOptType,
  MessageStatus,
  SessionType,
} from "@openim/wasm-client-sdk";
import { Badge, Popover } from "antd";
import clsx from "clsx";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import agent_icon from "@/assets/images/contact/agent.png";
import conversation_marked from "@/assets/images/conversation_marked.png";
import conversation_readed from "@/assets/images/conversation_readed.png";
import conversation_sending from "@/assets/images/conversation_sending.png";
import disturb from "@/assets/images/disturb.png";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useConversationStore, useUserStore } from "@/store";
import { getBot, isBot } from "@/store/botMap";
import { escapeHtml } from "@/utils/escapeHtml";
import { formatConversionTime, getConversationContent } from "@/utils/imCommon";

import { DraftMap } from "../queryChat/ChatFooter";
import styles from "./conversation-item.module.scss";
import ConversationMenuContent from "./ConversationMenuContent";
import { useDropFileAndDom } from "./useDropFileAndDom";

interface IConversationProps {
  isActive: boolean;
  conversation: ConversationItemType;
  onOpenNewTagModal: (conversation: ConversationItemType) => void;
}

const ConversationItem = ({
  isActive,
  conversation,
  onOpenNewTagModal,
}: IConversationProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversationItemRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showSending, setShowSending] = useState(false);
  const [isReaded, setIsReaded] = useState(false);
  const [internalActive, setInternalActive] = useState(isActive);
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const currentUser = useUserStore((state) => state.selfInfo.userID);

  const agentInfo = getBot(conversation.userID);
  const isAgent = isBot(conversation.userID);

  const { droping } = useDropFileAndDom({
    domRef: conversationItemRef,
    currentConversation: conversation,
  });

  useEffect(() => {
    if (isActive) {
      setInternalActive(true);
    } else {
      const timer = setTimeout(() => {
        setInternalActive(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const toSpecifiedConversation = async () => {
    if (isActive) {
      return;
    }
    await updateCurrentConversation({ ...conversation });
    navigate(`/chat/${conversation.conversationID}`);
  };

  const closeConversationMenu = () => {
    setShowConversationMenu(false);
  };

  const getMessagePrefix = () => {
    if (conversation.draftText && !internalActive) {
      return t("chat.message.description.drftPrefix");
    }
    let prefix = "";

    if (notNomalReceive && conversation.unreadCount > 0) {
      prefix = t("chat.message.description.unreadCount", {
        count: conversation.unreadCount,
      });
    }

    if (atReminder) {
      switch (conversation.groupAtType) {
        case GroupAtType.AtAll:
          prefix = t("chat.message.description.atAllPrefix");
          break;
        case GroupAtType.AtMe:
          prefix = t("chat.message.description.atYouPrefix");
          break;
        case GroupAtType.AtAllAtMe:
          prefix = t("chat.message.description.atYouPrefix");
          break;
        case GroupAtType.AtGroupNotice:
          prefix = t("chat.message.description.groupAnnouncementPrefix");
          break;
      }
    }

    return prefix;
  };

  const atReminder = conversation.groupAtType !== GroupAtType.AtNormal;
  const isNotification = conversation.conversationType === SessionType.Notification;

  useEffect(() => {
    // Clear previous timer if exists
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (!conversation.latestMsg) return;

      const message = JSON.parse(conversation.latestMsg) as MessageItem;
      if (
        conversation.userID &&
        message.sendID !== conversation.userID &&
        message.isRead
      ) {
        setIsReaded(true);
      } else {
        setIsReaded(false);
      }
      if (message.status === MessageStatus.Sending) {
        timerRef.current = setTimeout(() => {
          setShowSending(true);
          timerRef.current = null;
        }, 1000);
      } else {
        setShowSending(false);
      }
    } catch (e) {
      console.error("parse latestMsg error", e);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [conversation.latestMsg]);

  const showReaded = useMemo(() => {
    if (!isReaded) return false;

    // not display readed state when having draft and not active
    if (conversation.draftText && !internalActive) return false;
    return true;
  }, [isReaded, conversation.draftText, internalActive]);

  const latestMessageContent = useMemo(() => {
    let content = "";
    if (conversation.draftText && !internalActive) {
      let draftMap: DraftMap = {};
      if (conversation.draftText) {
        try {
          draftMap = JSON.parse(conversation.draftText);
          if (draftMap.text) {
            content = draftMap.text;
          }
        } catch (error) {
          console.error("parse conversation.draftText error", conversation.draftText);
        }
      }
    } else if (conversation.latestMsg) {
      try {
        content = getConversationContent(
          JSON.parse(conversation.latestMsg) as MessageItem,
        );
      } catch (error) {
        content = t("chat.message.description.catchMessage");
      }
    }

    return escapeHtml(content);
  }, [conversation.draftText, conversation.latestMsg, internalActive, currentUser]);

  const latestMessageTime = formatConversionTime(conversation.latestMsgSendTime);

  const notNomalReceive = conversation.recvMsgOpt !== MessageReceiveOptType.Normal;

  return (
    <Popover
      overlayClassName="common-menu-popover"
      placement="bottomRight"
      title={null}
      arrow={false}
      open={showConversationMenu}
      onOpenChange={(vis) => setShowConversationMenu(vis)}
      content={
        <ConversationMenuContent
          conversation={conversation}
          onCreateTag={() => onOpenNewTagModal(conversation)}
          closeConversationMenu={closeConversationMenu}
        />
      }
      trigger="contextMenu"
    >
      <div
        ref={conversationItemRef}
        className={clsx(
          styles["conversation-item"],
          "border border-transparent",
          (isActive || conversation.isPinned) && `bg-(--primary-active)`,
          conversation.isPinned && styles["conversation-item-pinned"],
          droping && "border-primary!",
        )}
        onClick={toSpecifiedConversation}
      >
        <Badge size="small" count={notNomalReceive ? 0 : conversation.unreadCount}>
          <OIMAvatar
            src={agentInfo?.faceURL || conversation.faceURL}
            isgroup={Boolean(conversation.groupID)}
            isnotification={isNotification}
            text={agentInfo?.nickname || conversation.showName}
          />
        </Badge>

        <div className="ml-3 flex h-11! flex-1 flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center truncate">
              <div className="truncate font-medium">{conversation.showName}</div>
              {isAgent && (
                <img
                  src={agent_icon}
                  alt="agent_icon"
                  className="ml-1 inline-block h-4 w-4"
                />
              )}
            </div>
            <div className="ml-2 text-xs whitespace-nowrap text-(--sub-text)">
              {latestMessageTime}
            </div>
          </div>

          <div className="flex items-center">
            <div className="flex min-h-4 flex-1 items-center overflow-hidden text-xs">
              <div
                className={clsx("text-primary mr-px whitespace-nowrap", {
                  "text-(--sub-text)!": notNomalReceive && !atReminder,
                })}
              >
                {getMessagePrefix()}
              </div>
              {showSending && (
                <img
                  src={conversation_sending}
                  alt="conversation_sending"
                  className="mr-1 h-3 w-3.5"
                />
              )}
              {showReaded && (
                <img
                  src={conversation_readed}
                  alt="conversation_readed"
                  className="mr-1 h-3 max-h-3 min-h-3 w-3.5 max-w-3.5 min-w-3.5"
                />
              )}
              <div
                className="twemoji truncate text-[rgba(81,94,112,0.5)]"
                dangerouslySetInnerHTML={{
                  __html: latestMessageContent,
                }}
              ></div>
            </div>

            <img
              className={notNomalReceive ? "visible" : "invisible"}
              src={disturb}
              width={14}
              alt="disturb"
            />
            {conversation.isMarked && (
              <img className="ml-1" src={conversation_marked} width={14} alt="marked" />
            )}
          </div>
        </div>
      </div>
    </Popover>
  );
};

export default memo(ConversationItem);
