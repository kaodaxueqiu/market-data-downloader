import { ConversationGroup } from "@openim/wasm-client-sdk";
import { App, Popover } from "antd";
import clsx from "clsx";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import arrow_bottom from "@/assets/images/contact/arrow_bottom.png";
import conversation_bubble from "@/assets/images/contact/conversation_bubble.png";
import { ConversationGroupAllKey } from "@/constants/im";
import { IMSDK } from "@/layout/MainContentWrap";
import { useActiveConversationGroupID, useConversationStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

import NewConversationGroupModal from "./NewConversationGroupModal";

type ConversationGroupOption =
  | ConversationGroup
  | { conversationGroupID: string; name: string };

const DefaultGroupLabelKeyMap: Record<string, string> = {
  i_Pinned: "chat.conversation.filter.pinned",
  i_Unread: "chat.conversation.filter.unread",
  i_MentionMe: "chat.conversation.filter.atMe",
  i_SingleChat: "chat.conversation.filter.single",
  i_GroupChat: "chat.conversation.filter.group",
  i_Marked: "chat.conversation.filter.marked",
};

const ConversationFilterMenu = ({
  presetItems,
  customItems,
  activeConvGroupID,
  onSelect,
  getLabel,
  getUnreadCount,
  onRenameItem,
  onDeleteItem,
}: {
  presetItems: ConversationGroupOption[];
  customItems: ConversationGroup[];
  activeConvGroupID: string;
  onSelect: (convGroupID: string) => void;
  getLabel: (item: ConversationGroupOption) => string;
  getUnreadCount: (item: ConversationGroupOption) => number | undefined;
  onRenameItem: (group: ConversationGroup) => void;
  onDeleteItem: (group: ConversationGroup) => void;
}) => {
  const { t } = useTranslation();

  const renderMenuItem = (item: ConversationGroupOption) => {
    const isActive = item.conversationGroupID === activeConvGroupID;
    const unreadCount = getUnreadCount(item);
    return (
      <button
        type="button"
        key={item.conversationGroupID}
        onClick={() => onSelect(item.conversationGroupID)}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left hover:bg-(--primary-active)",
          { "bg-(--primary-active)": isActive },
        )}
      >
        <span className="min-w-0 flex-1 truncate text-sm">{getLabel(item)}</span>
        {typeof unreadCount === "number" && unreadCount > 0 && (
          <span className="text-xs text-(--sub-text)">{unreadCount}</span>
        )}
      </button>
    );
  };

  const renderCustomMenuItem = (item: ConversationGroup) => (
    <Popover
      key={item.conversationGroupID}
      placement="rightTop"
      arrow={false}
      trigger="contextMenu"
      autoAdjustOverflow={false}
      content={
        <div className="p-1">
          <CustomItemActionButton
            label={t("chat.conversation.tag.rename")}
            onClick={() => onRenameItem(item)}
          />
          <CustomItemActionButton
            label={t("chat.conversation.tag.delete")}
            danger={true}
            onClick={() => onDeleteItem(item)}
          />
        </div>
      }
    >
      {renderMenuItem(item)}
    </Popover>
  );

  return (
    <div className="w-48 py-2">
      <div className="max-h-80 w-full overflow-auto">
        {presetItems.map(renderMenuItem)}
        {customItems.length > 0 && (
          <>
            <div className="border-b border-(--gap-text)"></div>
            {customItems.map(renderCustomMenuItem)}
          </>
        )}
      </div>
    </div>
  );
};

const ConversationFilterDropdown = () => {
  const { t } = useTranslation();
  const { modal } = App.useApp();

  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ConversationGroup | null>(null);
  const deleteModalRef = useRef<ReturnType<typeof modal.confirm> | null>(null);

  const activeConversationGroupID = useActiveConversationGroupID();
  const conversationGroups = useConversationStore((state) => state.conversationGroups);
  const customConversationGroups = useConversationStore(
    (state) => state.customConversationGroups,
  );
  const unReadCount = useConversationStore((state) => state.unReadCount);
  const setActiveConversationGroup = useConversationStore(
    (state) => state.setActiveConversationGroup,
  );
  const removeConversationGroups = useConversationStore(
    (state) => state.removeConversationGroups,
  );

  const visiblePresetGroups = [...conversationGroups]
    .filter((group) => !group.hidden)
    .sort((a, b) => a.serial - b.serial);
  const visibleCustomGroups = [...customConversationGroups]
    .filter((group) => !group.hidden)
    .sort((a, b) => a.serial - b.serial);

  const presetItems: ConversationGroupOption[] = [
    {
      conversationGroupID: ConversationGroupAllKey,
      name: t("chat.conversation.filter.all"),
    },
    ...visiblePresetGroups,
  ];
  const customItems = [...visibleCustomGroups];

  const handleSelect = async (convGroupID: string) => {
    setOpen(false);
    await setActiveConversationGroup(convGroupID);
  };

  const handleDeleteGroup = (group: ConversationGroup) => {
    if (deleteModalRef.current) return;
    deleteModalRef.current = modal.confirm({
      content: t("chat.conversation.tag.deleteContent"),
      okText: t("chat.conversation.tag.deleteConfirmOk"),
      centered: true,
      maskClosable: true,
      zIndex: 2000,
      onOk: async () => {
        try {
          await IMSDK.deleteConversationGroup(group.conversationGroupID);
          removeConversationGroups([group.conversationGroupID]);
        } catch (error) {
          feedbackToast({ error, msg: t("chat.toast.deleteConversationTagFailed") });
        } finally {
          deleteModalRef.current = null;
        }
      },
      onCancel: () => {
        deleteModalRef.current = null;
      },
    });
  };

  const getGroupLabel = (item: ConversationGroupOption) => {
    if (item.conversationGroupID === ConversationGroupAllKey) {
      return t("chat.conversation.filter.all");
    }
    const labelKey = DefaultGroupLabelKeyMap[item.conversationGroupID];
    if (labelKey) {
      return t(labelKey);
    }
    return item.name;
  };

  const getGroupUnreadCount = (item: ConversationGroupOption) => {
    if (item.conversationGroupID === ConversationGroupAllKey) {
      return unReadCount;
    }
    if ("unreadCount" in item) {
      return item.unreadCount;
    }
    return undefined;
  };

  const activeLabel =
    activeConversationGroupID === ConversationGroupAllKey
      ? getGroupLabel({
          conversationGroupID: ConversationGroupAllKey,
          name: "all",
        })
      : getGroupLabel(
          visiblePresetGroups.find(
            (item) => item.conversationGroupID === activeConversationGroupID,
          ) ??
            visibleCustomGroups.find(
              (item) => item.conversationGroupID === activeConversationGroupID,
            ) ?? {
              conversationGroupID: ConversationGroupAllKey,
              name: "all",
            },
        );

  return (
    <>
      <Popover
        content={
          <ConversationFilterMenu
            presetItems={presetItems}
            customItems={customItems}
            activeConvGroupID={activeConversationGroupID}
            onSelect={handleSelect}
            getLabel={getGroupLabel}
            getUnreadCount={getGroupUnreadCount}
            onRenameItem={(group) => setEditingGroup(group)}
            onDeleteItem={handleDeleteGroup}
          />
        }
        arrow={false}
        placement={"bottomLeft"}
        trigger={"click"}
        open={open}
        onOpenChange={setOpen}
      >
        <button
          type="button"
          className={clsx(
            "flex h-8.5 w-22.5 cursor-pointer items-center justify-between rounded-md bg-(--primary-active) pr-4 pl-2",
            "border border-transparent transition-colors duration-150",
            "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
            "hover:border-primary active:border-primary",
          )}
        >
          <img className="w-4" src={conversation_bubble} />
          <span className="text-primary truncate text-sm">{activeLabel}</span>
          <img className="w-2.5" src={arrow_bottom} />
        </button>
      </Popover>
      <NewConversationGroupModal
        mode="rename"
        open={Boolean(editingGroup)}
        group={editingGroup ?? undefined}
        onClose={() => setEditingGroup(null)}
      />
    </>
  );
};

const CustomItemActionButton = ({
  label,
  danger = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className={clsx(
      "flex w-full cursor-pointer items-center rounded px-3 py-2 text-xs hover:bg-(--primary-active)",
      danger && "text-[#FF381F]",
    )}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
  >
    {label}
  </button>
);

export default ConversationFilterDropdown;
