import { useMutation } from "@tanstack/react-query";
import { Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo } from "react";

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

const ConversationNavMenuContent = memo(
  ({ closeConversationMenu }: { closeConversationMenu: () => void }) => {
    const updateConversationList = useConversationStore(
      (state) => state.updateConversationList,
    );

    const markAllMutation = useMutation({
      mutationFn: async () => {
        const { data: conversations } = await IMSDK.getAllConversationList();
        const unreadConversations = conversations.filter(
          (conversation) => conversation.unreadCount,
        );
        for (const conversation of unreadConversations) {
          await IMSDK.markConversationMessageAsRead(conversation.conversationID);
        }
        if (unreadConversations.length) {
          const updatedConversations = unreadConversations.map((conversation) => ({
            ...conversation,
            unreadCount: 0,
          }));
          updateConversationList(updatedConversations);
        }
      },
      onError: (error) => {
        feedbackToast({
          error,
          msg: t("settings.toast.markAllConversationAsReadFailed"),
        });
      },
      onSettled: closeConversationMenu,
    });

    return (
      <Spin spinning={markAllMutation.isPending}>
        <div className="p-1">
          <MenuItem
            title={t("common.text.markAsRead")}
            onClick={() => markAllMutation.mutate()}
          />
        </div>
      </Spin>
    );
  },
);

export default ConversationNavMenuContent;
