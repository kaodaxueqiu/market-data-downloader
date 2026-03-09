import { CloseOutlined } from "@ant-design/icons";
import {
  CbEvents,
  GroupMemberItem,
  GroupMessageReceiptInfo,
  SessionType,
  WSEvent,
} from "@openim/wasm-client-sdk";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { Popover, Spin } from "antd";
import clsx from "clsx";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import {
  GroupMessageReaderListPage,
  messageReadQueryKey,
  useGroupMessageReaderList,
} from "@/api/hooks/messageRead";
import OIMAvatar from "@/components/OIMAvatar";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";

import { IMessageItemProps } from ".";

const MessageReadState: FC<IMessageItemProps> = ({ message }) => {
  const { t } = useTranslation();
  const [showReadList, setShowReadList] = useState(false);
  const isSingle = message.sessionType === SessionType.Single;
  const unReadCount = message.attachedInfoElem?.groupHasReadInfo.unreadCount ?? 0;

  const getReadStateStr = () => {
    if (isSingle) {
      return message.isRead ? t("chat.message.isRead") : t("chat.message.unread");
    }

    return unReadCount < 1
      ? t("chat.message.allIsRead")
      : t("chat.message.unreadNum", { num: unReadCount });
  };

  const closeOverlay = useCallback(() => setShowReadList(false), []);

  return (
    <Popover
      content={
        <ReadedList
          clientMsgID={message.clientMsgID}
          readedCount={message.attachedInfoElem?.groupHasReadInfo.hasReadCount ?? 0}
          unReadCount={unReadCount}
          closeOverlay={closeOverlay}
        />
      }
      destroyTooltipOnHide
      trigger="click"
      placement="bottomLeft"
      overlayClassName="profile-popover"
      title={null}
      arrow={false}
      open={isSingle ? false : showReadList}
      onOpenChange={(vis) => setShowReadList(vis)}
    >
      <div
        className={clsx("mt-1 text-xs text-[#0289FA]", {
          "text-(--sub-text)!": isSingle ? message.isRead : unReadCount < 1,
          "cursor-pointer!": !isSingle,
        })}
      >
        {getReadStateStr()}
      </div>
    </Popover>
  );
};

export default MessageReadState;

interface IReadedListProps {
  clientMsgID: string;
  unReadCount: number;
  readedCount: number;
  closeOverlay: () => void;
}

const ReadedList = memo(
  ({ clientMsgID, unReadCount, readedCount, closeOverlay }: IReadedListProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const conversationID =
      useConversationStore((state) => state.currentConversation?.conversationID) ?? "";

    const readQueryKey = messageReadQueryKey({
      conversationID,
      clientMsgID,
      filter: 0,
    });
    const unreadQueryKey = messageReadQueryKey({
      conversationID,
      clientMsgID,
      filter: 1,
    });
    const readQuery = useGroupMessageReaderList({
      conversationID,
      clientMsgID,
      filter: 0,
    });
    const unreadQuery = useGroupMessageReaderList({
      conversationID,
      clientMsgID,
      filter: 1,
    });
    const readedData = useMemo(
      () => readQuery.data?.pages.flatMap((page) => page.data) ?? [],
      [readQuery.data],
    );
    const unReadData = useMemo(
      () => unreadQuery.data?.pages.flatMap((page) => page.data) ?? [],
      [unreadQuery.data],
    );
    const readedLoading = readQuery.isPending || readQuery.isFetchingNextPage;
    const unreadLoading = unreadQuery.isPending || unreadQuery.isFetchingNextPage;

    useEffect(() => {
      const keyDownHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeOverlay();
        }
      };
      document.addEventListener("keydown", keyDownHandler);
      return () => {
        document.removeEventListener("keydown", keyDownHandler);
      };
    }, []);

    useEffect(() => {
      const groupMessageHasReadedHander = ({
        data,
      }: WSEvent<GroupMessageReceiptInfo>) => {
        if (data.conversationID !== conversationID) return;
        const usefullData = data.groupMessageReadInfo.filter(
          (receipt) => receipt.clientMsgID === clientMsgID,
        );
        if (!usefullData.length) return;

        const readMembers = usefullData.map((item) => item.readMembers).flat();
        if (!readQuery.hasNextPage) {
          queryClient.setQueryData<InfiniteData<GroupMessageReaderListPage>>(
            readQueryKey,
            (old) => {
              if (!old || readMembers.length === 0) return old;
              const existing = new Set(
                old.pages.flatMap((page) => page.data).map((member) => member.userID),
              );
              const nextMembers = readMembers.filter(
                (member) => !existing.has(member.userID),
              );
              if (!nextMembers.length) return old;
              const lastIndex = old.pages.length - 1;
              const pages = old.pages.map((page, index) =>
                index === lastIndex
                  ? { ...page, data: [...page.data, ...nextMembers] }
                  : page,
              );
              return { ...old, pages };
            },
          );
        }
        queryClient.setQueryData<InfiniteData<GroupMessageReaderListPage>>(
          unreadQueryKey,
          (old) => {
            if (!old || readMembers.length === 0) return old;
            const removeIds = new Set(readMembers.map((member) => member.userID));
            let changed = false;
            const pages = old.pages.map((page) => {
              const filtered = page.data.filter(
                (member) => !removeIds.has(member.userID),
              );
              if (filtered.length !== page.data.length) {
                changed = true;
              }
              return filtered.length === page.data.length
                ? page
                : { ...page, data: filtered };
            });
            return changed ? { ...old, pages } : old;
          },
        );
      };
      IMSDK.on(CbEvents.OnRecvGroupReadReceipt, groupMessageHasReadedHander);
      return () => {
        IMSDK.off(CbEvents.OnRecvGroupReadReceipt, groupMessageHasReadedHander);
      };
    }, [
      clientMsgID,
      conversationID,
      queryClient,
      readQuery.hasNextPage,
      readQueryKey,
      unreadQueryKey,
    ]);

    const getMoreReadedList = () => {
      if (readedLoading || !readQuery.hasNextPage || !conversationID) return;
      readQuery.fetchNextPage();
    };

    const getMoreUnReadList = () => {
      const conversationID =
        useConversationStore.getState().currentConversation?.conversationID;
      if (unreadLoading || !unreadQuery.hasNextPage || !conversationID) return;
      unreadQuery.fetchNextPage();
    };

    return (
      <div className="flex h-72 w-125 flex-col overflow-hidden rounded-md">
        <div className="flex items-center justify-between bg-(--gap-text) px-4 py-2">
          <span className="font-medium">{t("chat.message.isReadList")}</span>
          <CloseOutlined
            className="cursor-pointer text-[#8e9aaf]!"
            rev={undefined}
            onClick={closeOverlay}
          />
        </div>
        <div className="flex flex-1 px-2">
          <div className="flex flex-1 flex-col">
            <div className="flex items-center px-4 py-2.5">
              <span className="text-primary mr-1">{unReadCount}</span>
              {t("chat.message.unread")}
            </div>
            <Virtuoso
              className="flex-1 overflow-x-hidden"
              data={unReadData}
              computeItemKey={(_, member) => member.userID}
              endReached={getMoreUnReadList}
              components={{
                Footer: () => (unreadLoading ? <ListSpin /> : null),
              }}
              itemContent={(_, member) => <MemberItem member={member} />}
            />
          </div>
          <div className="w-3"></div>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center px-4 py-2.5">
              <span className="text-primary mr-1">{readedCount}</span>
              {t("chat.message.isRead")}
            </div>
            <Virtuoso
              className="flex-1 overflow-x-hidden"
              data={readedData ?? []}
              computeItemKey={(_, member) => member.userID}
              endReached={getMoreReadedList}
              components={{
                Header: () => (readedLoading ? <ListSpin /> : null),
              }}
              itemContent={(_, member) => <MemberItem member={member} />}
            />
          </div>
        </div>
      </div>
    );
  },
);

const MemberItem = ({ member }: { member: GroupMemberItem }) => (
  <div className="flex items-center rounded-md px-3 py-2 hover:bg-(--primary-active)">
    <OIMAvatar size={26} src={member.faceURL} text={member.nickname} />
    <div className="ml-3 max-w-[80%] truncate text-xs">{member.nickname}</div>
  </div>
);

const ListSpin = () => (
  <div className="mt-12 flex justify-center">
    <Spin />
  </div>
);
