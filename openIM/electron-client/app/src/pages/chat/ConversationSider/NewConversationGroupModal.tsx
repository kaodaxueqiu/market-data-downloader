import {
  ConversationGroup,
  ConversationGroupType,
  ConversationItem,
} from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Button, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import conversation_tag from "@/assets/images/conversation_tag.png";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";

type NewConversationGroupModalProps = {
  open: boolean;
  conversation?: ConversationItem;
  group?: ConversationGroup;
  mode: "create" | "rename";
  onClose: () => void;
};

export default function NewConversationGroupModal({
  open,
  conversation,
  group,
  mode,
  onClose,
}: NewConversationGroupModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const customConversationGroups = useConversationStore(
    (state) => state.customConversationGroups,
  );
  const getConversationGroupsByReq = useConversationStore(
    (state) => state.getConversationGroupsByReq,
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "rename") {
      setName(group?.name ?? "");
    } else {
      setName("");
    }
  }, [open, mode, group?.name]);

  const renameMutation = useMutation({
    mutationFn: async (trimmedName: string) => {
      if (!group?.conversationGroupID) {
        return;
      }
      await IMSDK.updateConversationGroup({
        conversationGroupID: group.conversationGroupID,
        name: trimmedName,
      });
      await getConversationGroupsByReq();
    },
    onError: (error) => {
      feedbackToast({ error, msg: t("chat.toast.renameConversationTagFailed") });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (trimmedName: string) => {
      if (!conversation?.conversationID) {
        return;
      }
      const existingGroup = customConversationGroups.find(
        (group) => group.name === trimmedName,
      );
      if (existingGroup) {
        await IMSDK.addConversationsToGroups({
          conversationGroupIDs: [existingGroup.conversationGroupID],
          conversationIDs: [conversation.conversationID],
        });
      } else {
        await IMSDK.createConversationGroup({
          name: trimmedName,
          conversationID: conversation.conversationID,
          conversationGroupType: ConversationGroupType.ConversationGroupTypeNormal,
        });
      }
      // Keep the group list in sync (e.g. conversationIDs updates) after group changes.
      await getConversationGroupsByReq();
    },
    onError: (error, trimmedName) => {
      const existingGroup = customConversationGroups.find(
        (group) => group.name === trimmedName,
      );
      feedbackToast({
        error,
        msg: existingGroup
          ? t("chat.toast.addConversationToTagFailed")
          : t("chat.toast.createConversationTagFailed"),
      });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const handleRename = async (trimmedName: string) => {
    if (!group?.conversationGroupID) {
      return;
    }
    if (trimmedName === group.name) {
      onClose();
      return;
    }
    await renameMutation.mutateAsync(trimmedName);
  };

  const handleCreate = async (trimmedName: string) => {
    if (!conversation?.conversationID) {
      return;
    }
    await createMutation.mutateAsync(trimmedName);
  };

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (mode === "rename") {
      await handleRename(trimmedName);
    } else {
      await handleCreate(trimmedName);
    }
  };

  const isPending = renameMutation.isPending || createMutation.isPending;

  return (
    <Modal
      destroyOnClose={true}
      open={open}
      centered
      footer={null}
      closeIcon={null}
      onCancel={onClose}
      width={320}
      styles={{
        mask: { background: "transparent" },
        content: { padding: 0 },
      }}
      zIndex={2000}
    >
      <div className="flex flex-col border-b border-(--gap-text) px-4 pt-3 pb-1">
        <span className="mb-0.5 text-sm font-medium">
          {mode === "rename"
            ? t("chat.conversation.tag.rename")
            : t("chat.conversation.tag.new")}
        </span>
        <span className="text-xs font-normal">
          {mode === "rename" ? group?.name : conversation?.showName}
        </span>
      </div>
      <div className="border-b border-(--gap-text) px-4 py-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("chat.conversation.tag.inputPlaceholder")}
          prefix={<img className="size-4 object-contain" src={conversation_tag} />}
          allowClear={true}
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-2.5 py-3">
        <Button className="w-1/2" onClick={onClose} disabled={isPending}>
          {t("common.text.cancel")}
        </Button>
        <Button
          className="w-1/2"
          type="primary"
          loading={isPending}
          disabled={!name.trim()}
          onClick={handleConfirm}
        >
          {t("common.text.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
