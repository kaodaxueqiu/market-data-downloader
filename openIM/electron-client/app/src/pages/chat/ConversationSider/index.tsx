import { ConversationItem, MessageReceiveOptType } from "@openim/wasm-client-sdk";
import { Spin } from "antd";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ListRange, Virtuoso, VirtuosoHandle } from "react-virtuoso";

import sync from "@/assets/images/common/sync.png";
import sync_error from "@/assets/images/common/sync_error.png";
import { ConversationGroupAllKey } from "@/constants/im";
import {
  useActiveConversationGroupID,
  useConversationStore,
  useUserStore,
} from "@/store";
import emitter from "@/utils/window/events";

import ConversationFilterDropdown from "./ConversationFilterDropdown";
import ConversationItemComp from "./ConversationItem";
import ConversationSkeleton from "./ConversationSkeleton";
import styles from "./index.module.scss";
import NewConversationGroupModal from "./NewConversationGroupModal";

function getNextUnreadIndex(
  conversationList: ConversationItem[],
  currentIndex: number,
) {
  let nextIndex = currentIndex + 1;
  let count = 0;
  while (count < conversationList.length) {
    if (nextIndex >= conversationList.length) {
      nextIndex = 0;
    }
    if (conversationList[nextIndex].unreadCount > 0) {
      return nextIndex;
    }
    nextIndex++;
    count++;
  }
  return 0;
}

function generateSkeletons(count: number) {
  const skeletons = [] as ConversationItem[];
  for (let i = 0; i < count; i++) {
    skeletons.push({ conversationID: `skeleton-${i}` } as ConversationItem);
  }
  return skeletons;
}

const ConnectBar = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const showLoading =
    userStore.syncState === "loading" || userStore.connectState === "loading";
  const showFailed =
    userStore.syncState === "failed" || userStore.connectState === "failed";

  const loadingTip =
    userStore.syncState === "loading"
      ? t("chat.connect.syncing")
      : t("chat.connect.connecting");

  const errorTip =
    userStore.syncState === "failed"
      ? t("chat.connect.syncFailed")
      : t("chat.connect.connectFailed");

  if (userStore.reinstall) {
    return null;
  }

  return (
    <>
      {showLoading && (
        <div className="flex h-6 items-center justify-center bg-[rgba(0,137,255,0.1)]">
          <img src={sync} alt="sync" className={clsx("mr-1 h-3 w-3", styles.loading)} />
          <span className="text-xs text-[#0089FF]">{loadingTip}</span>
        </div>
      )}
      {showFailed && (
        <div className="flex h-6 items-center justify-center bg-[rgba(255,56,31,0.15)]">
          <img src={sync_error} alt="sync" className="mr-1 h-3 w-3" />
          <span className="text-xs text-[#FF381F]">{errorTip}</span>
        </div>
      )}
    </>
  );
};

const ConversationSider = () => {
  const { conversationID } = useParams();
  const conversationList = useConversationStore(
    (state) => state.displayConversationList,
  );
  const conversationIniting = useConversationStore(
    (state) => state.conversationIniting,
  );
  const activeConversationGroupID = useActiveConversationGroupID();
  const activeGroupHasMore = useConversationStore(
    (state) => state.activeGroupPagination.hasMore,
  );
  const conversationListRefreshId = useConversationStore(
    (state) => state.conversationListRefreshId,
  );
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagConversation, setTagConversation] = useState<ConversationItem | undefined>(
    undefined,
  );
  const virtuoso = useRef<VirtuosoHandle>(null);
  const hasmore = useRef(true);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const currentIndex = useRef(0);
  const refreshIdRef = useRef(conversationListRefreshId);

  const logHasMoreUpdate = useCallback((next: boolean, source: string) => {
    const prev = hasmore.current;
    const listLength = useConversationStore.getState().displayConversationList.length;
    console.debug("[ConversationSider] hasmore update", {
      source,
      prev,
      next,
      listLength,
      loading: loadingRef.current,
    });
    hasmore.current = next;
  }, []);

  useEffect(() => {
    if (refreshIdRef.current === conversationListRefreshId) return;
    refreshIdRef.current = conversationListRefreshId;
    currentIndex.current = 0;
    logHasMoreUpdate(true, "conversationListRefresh");
  }, [conversationListRefreshId, logHasMoreUpdate]);

  useEffect(() => {
    if (activeConversationGroupID === ConversationGroupAllKey) {
      return;
    }
    hasmore.current = activeGroupHasMore;
  }, [activeConversationGroupID, activeGroupHasMore]);

  useEffect(() => {
    const getUnreadTotal = (list: ConversationItem[]) =>
      list.reduce(
        (prev, current) =>
          prev +
          (current.recvMsgOpt === MessageReceiveOptType.Normal
            ? current.unreadCount
            : 0),
        0,
      );

    // Jump to the next unread conversation. If none is found, load more and retry,
    // wrapping around to the top when needed.
    const scrollToUnread = async () => {
      let conversations = useConversationStore.getState().displayConversationList;
      let hasUnreadInLoaded = conversations.some(
        (conversation) => conversation.unreadCount > 0,
      );
      let newIndex = hasUnreadInLoaded
        ? getNextUnreadIndex(conversations, currentIndex.current)
        : -1;
      let loadedUnread = getUnreadTotal(conversations);

      const canLoadMoreForUnread = () => {
        if (!hasmore.current) return false;
        if (activeConversationGroupID === ConversationGroupAllKey) {
          return loadedUnread < useConversationStore.getState().unReadCount;
        }
        return true;
      };

      while (newIndex === -1 && canLoadMoreForUnread()) {
        const flag = await getConversationListByReq(true);
        logHasMoreUpdate(flag, "scrollToUnread");
        if (!flag) {
          break;
        }
        conversations = useConversationStore.getState().displayConversationList;
        loadedUnread = getUnreadTotal(conversations);
        hasUnreadInLoaded = conversations.some(
          (conversation) => conversation.unreadCount > 0,
        );
        newIndex = hasUnreadInLoaded
          ? getNextUnreadIndex(conversations, currentIndex.current)
          : -1;
      }

      if (newIndex === -1) {
        if (!conversations.length) {
          return;
        }
        // If no unread conversations exist, scroll back to the top.
        newIndex = 0;
      }

      currentIndex.current = newIndex;
      virtuoso.current?.scrollToIndex({
        index: currentIndex.current,
        behavior: "smooth",
      });
    };
    emitter.on("TRY_JUMP_TO_UNREAD", scrollToUnread);
    return () => {
      emitter.off("TRY_JUMP_TO_UNREAD", scrollToUnread);
    };
  }, [activeConversationGroupID, getConversationListByReq, logHasMoreUpdate]);

  const endReached = useCallback(async () => {
    if (conversationIniting || !hasmore.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      logHasMoreUpdate(await getConversationListByReq(true), "endReached");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [conversationIniting, getConversationListByReq, logHasMoreUpdate]);

  const rangeChanged = useCallback((range: ListRange) => {
    const maybeJump = currentIndex.current - 1 === range.startIndex;
    currentIndex.current = maybeJump ? range.startIndex + 1 : range.startIndex;
  }, []);

  const dataSoure = useMemo(
    () =>
      conversationIniting
        ? generateSkeletons(20)
        : conversationList.filter((c) => !c.isHidden),
    [conversationIniting, conversationList],
  );

  const computeItemKey = useCallback(
    (_: number, item: ConversationItem) => item.conversationID,
    [],
  );

  const itemContent = useCallback(
    (_: number, conversation: ConversationItem) =>
      conversationIniting ? (
        <ConversationSkeleton />
      ) : (
        <ConversationItemComp
          isActive={conversationID === conversation.conversationID}
          conversation={conversation}
          onOpenNewTagModal={(item) => {
            setTagConversation(item);
            setTagModalOpen(true);
          }}
        />
      ),
    [conversationIniting, conversationID],
  );

  const footer = useCallback(
    () =>
      loading ? (
        <div className="flex items-center justify-center py-2">
          <Spin size="small" />
        </div>
      ) : null,
    [loading],
  );

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="border-b border-(--gap-text) px-2.5 py-4">
        <ConversationFilterDropdown />
      </div>
      <ConnectBar />
      <div className="min-h-0 flex-1 p-2 pr-1">
        <Virtuoso
          className="flex-1"
          data={dataSoure}
          ref={virtuoso}
          endReached={endReached}
          rangeChanged={rangeChanged}
          computeItemKey={computeItemKey}
          itemContent={itemContent}
          components={{ Footer: footer }}
        />
      </div>

      <NewConversationGroupModal
        mode="create"
        open={tagModalOpen}
        conversation={tagConversation}
        onClose={() => {
          setTagModalOpen(false);
          setTagConversation(undefined);
        }}
      />
    </div>
  );
};

export default ConversationSider;
