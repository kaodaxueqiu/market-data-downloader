import { ConversationGroup, ConversationItem } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Popover, Spin } from "antd";
import clsx from "clsx";
import { FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import conversation_tag_checked from "@/assets/images/conversation_tag_checked.png";
import { ConversationGroupMarkedKey } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

const MenuItem: FC<{ title: string; className?: string; onClick: () => void }> = ({
  title,
  className,
  onClick,
}) => (
  <div
    className={clsx(
      "cursor-pointer rounded px-3 py-2 text-xs hover:bg-(--primary-active)",
      className,
    )}
    onClick={onClick}
  >
    {title}
  </div>
);

const ConversationMenuContent = memo(
  ({
    conversation,
    onCreateTag,
    closeConversationMenu,
  }: {
    conversation: ConversationItem;
    onCreateTag: () => void;
    closeConversationMenu: () => void;
  }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
    const delConversationByCID = useConversationStore(
      (state) => state.delConversationByCID,
    );
    const updateCurrentConversation = useConversationStore(
      (state) => state.updateCurrentConversation,
    );
    const updateCurrentConversationFields = useConversationStore(
      (state) => state.updateCurrentConversationFields,
    );
    const updateConversationList = useConversationStore(
      (state) => state.updateConversationList,
    );
    const getConversationGroupsByReq = useConversationStore(
      (state) => state.getConversationGroupsByReq,
    );
    const removeConversationFromDisplayList = useConversationStore(
      (state) => state.removeConversationFromDisplayList,
    );
    const customConversationGroups = useConversationStore(
      (state) => state.customConversationGroups,
    );
    const hasCustomGroups = customConversationGroups.some((group) => !group.hidden);

    const pinMutation = useMutation({
      mutationFn: async () => {
        await IMSDK.pinConversation({
          conversationID: conversation.conversationID,
          isPinned: !conversation.isPinned,
        });
      },
      onError: (error) => {
        feedbackToast({ error, msg: t("chat.toast.pinConversationFailed") });
      },
      onSettled: closeConversationMenu,
    });

    const removeMutation = useMutation({
      mutationFn: async () => {
        await IMSDK.hideConversation(conversation.conversationID);
        delConversationByCID(conversation.conversationID);
        if (
          conversation.conversationID ===
          useConversationStore.getState().currentConversation?.conversationID
        ) {
          updateCurrentConversation();
          navigate("/chat");
        }
      },
      onError: (error) => {
        feedbackToast({ error, msg: t("chat.toast.deleteConversationFailed") });
      },
      onSettled: closeConversationMenu,
    });

    const markReadMutation = useMutation({
      mutationFn: async () => {
        await IMSDK.markConversationMessageAsRead(conversation.conversationID);
        updateConversationList([{ ...conversation, unreadCount: 0 }]);
        if (
          conversation.conversationID ===
          useConversationStore.getState().currentConversation?.conversationID
        ) {
          updateCurrentConversationFields({ unreadCount: 0 });
        }
      },
      onError: (error) => {
        feedbackToast({ error, msg: t("chat.toast.markConversationAsReadFailed") });
      },
      onSettled: closeConversationMenu,
    });

    const toggleMarkMutation = useMutation({
      mutationFn: async () => {
        const nextMarked = !conversation.isMarked;
        await IMSDK.setConversation({
          conversationID: conversation.conversationID,
          isMarked: nextMarked,
        });
        updateConversationList([{ ...conversation, isMarked: nextMarked }]);
        if (
          conversation.conversationID ===
          useConversationStore.getState().currentConversation?.conversationID
        ) {
          updateCurrentConversationFields({ isMarked: nextMarked });
        }
        if (!nextMarked) {
          removeConversationFromDisplayList(
            conversation.conversationID,
            ConversationGroupMarkedKey,
          );
        }
        // Refresh conversation group
        await getConversationGroupsByReq();
      },
      onError: (error) => {
        feedbackToast({ error, msg: t("chat.toast.updateConversationMarkFailed") });
      },
      onSettled: closeConversationMenu,
    });

    const isPending =
      pinMutation.isPending ||
      removeMutation.isPending ||
      markReadMutation.isPending ||
      toggleMarkMutation.isPending;

    return (
      <Spin spinning={isPending}>
        <div className="p-1">
          <MenuItem
            title={
              conversation.isPinned
                ? t("chat.conversation.removeSticky")
                : t("chat.conversation.sticky")
            }
            onClick={() => pinMutation.mutate()}
          />
          {Boolean(conversation.unreadCount) && (
            <MenuItem
              title={t("common.text.markAsRead")}
              onClick={() => markReadMutation.mutate()}
            />
          )}
          {hasCustomGroups ? (
            <Popover
              placement="rightTop"
              arrow={false}
              trigger={"hover"}
              open={tagPopoverOpen}
              onOpenChange={setTagPopoverOpen}
              content={
                <CustomGroupsSelectPopoverContent
                  conversation={conversation}
                  onCreateTag={() => {
                    setTagPopoverOpen(false);
                    closeConversationMenu();
                    onCreateTag();
                  }}
                />
              }
            >
              {/* Popover needs a DOM element that can receive onMouseEnter/onMouseLeave and ref. */}
              <div>
                <MenuItem
                  title={t("chat.conversation.tag.menuTitle")}
                  onClick={() => {}}
                />
              </div>
            </Popover>
          ) : (
            <MenuItem
              title={t("chat.conversation.tag.new")}
              onClick={() => {
                closeConversationMenu();
                onCreateTag();
              }}
            />
          )}
          <MenuItem
            title={
              conversation.isMarked
                ? t("chat.conversation.unmarkConversation")
                : t("chat.conversation.markConversation")
            }
            onClick={() => toggleMarkMutation.mutate()}
          />
          <MenuItem
            className="text-[#FF381F]"
            title="隐藏"
            onClick={() => removeMutation.mutate()}
          />
        </div>
      </Spin>
    );
  },
);

export default ConversationMenuContent;

function CustomGroupsSelectPopoverContent({
  conversation,
  onCreateTag,
}: {
  conversation: ConversationItem;
  onCreateTag: () => void;
}) {
  const { t } = useTranslation();
  const [updatingGroupID, setUpdatingGroupID] = useState<string | null>(null);
  const customGroups = useConversationStore((state) => state.customConversationGroups);
  const getConversationGroupsByReq = useConversationStore(
    (state) => state.getConversationGroupsByReq,
  );
  const removeConversationFromDisplayList = useConversationStore(
    (state) => state.removeConversationFromDisplayList,
  );

  const visibleGroups = [...customGroups]
    .filter((group) => !group.hidden)
    .sort((a, b) => a.serial - b.serial);

  const toggleConversationGroup = async (group: ConversationGroup) => {
    if (!conversation.conversationID) {
      return;
    }
    const isInGroup = group.conversationIDs?.includes(conversation.conversationID);
    setUpdatingGroupID(group.conversationGroupID);
    try {
      if (isInGroup) {
        await IMSDK.removeConversationsFromGroups({
          conversationGroupIDs: [group.conversationGroupID],
          conversationIDs: [conversation.conversationID],
        });
        removeConversationFromDisplayList(
          conversation.conversationID,
          group.conversationGroupID,
        );
      } else {
        await IMSDK.addConversationsToGroups({
          conversationGroupIDs: [group.conversationGroupID],
          conversationIDs: [conversation.conversationID],
        });
      }
      await getConversationGroupsByReq();
    } catch (error) {
      feedbackToast({
        error,
        msg: isInGroup
          ? t("chat.toast.removeConversationFromTagFailed")
          : t("chat.toast.addConversationToTagFailed"),
      });
    }
    setUpdatingGroupID(null);
  };

  return (
    <div className="w-24 py-2">
      <button
        type="button"
        onClick={onCreateTag}
        className="flex w-full cursor-pointer items-center justify-center px-4 py-2 text-xs hover:bg-(--primary-active)"
      >
        {t("chat.conversation.tag.new")}
      </button>
      <div className="border-b border-(--gap-text)"></div>
      <Spin spinning={Boolean(updatingGroupID)} size="small">
        <div className="max-h-56 overflow-auto">
          {visibleGroups.map((group) => {
            const isInGroup = group.conversationIDs?.includes(
              conversation.conversationID,
            );
            const isUpdating = updatingGroupID === group.conversationGroupID;
            return (
              <button
                type="button"
                key={group.conversationGroupID}
                onClick={() => toggleConversationGroup(group)}
                disabled={isUpdating}
                className={clsx(
                  "flex w-full cursor-pointer items-center justify-start py-2 pr-4 pl-2.5 text-xs hover:bg-(--primary-active)",
                  { "cursor-not-allowed": isUpdating },
                )}
              >
                <span className="mr-1.5 h-2 w-2.5 shrink-0 text-(--sub-text)">
                  {isInGroup ? (
                    <img
                      className="h-auto w-full object-center"
                      src={conversation_tag_checked}
                    />
                  ) : (
                    ""
                  )}
                </span>
                <span className="truncate">{group.name}</span>
              </button>
            );
          })}
        </div>
      </Spin>
    </div>
  );
}
