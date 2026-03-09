import { Divider, Empty, Image, Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useImperativeHandle,
  useMemo,
} from "react";
import { Virtuoso } from "react-virtuoso";

import { useLogs } from "@/api/hooks/moments";
import liked from "@/assets/images/moments/liked.png";
import OIMAvatar from "@/components/OIMAvatar";
import { WorkMomentLogType } from "@/constants";
import { WorkMoments } from "@/types/moment";
import { formatMomentsTime } from "@/utils/imCommon";

const MomentsMessageList: ForwardRefRenderFunction<
  { refetch: () => void },
  {
    clearLoading: boolean;
    jumpToMoments: (workMomentID: string) => void;
    clearMessageList: () => void;
  }
> = ({ clearLoading, jumpToMoments, clearMessageList }, ref) => {
  const { isFetching, fetchNextPage, refetch, hasNextPage, data } = useLogs();

  const items = data?.pages.flatMap((page) => page.data?.workMoments ?? []);

  const endReached = () => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      refetch,
    }),
    [],
  );

  return (
    <Spin spinning={clearLoading}>
      <div className="flex h-105 w-80 flex-col overflow-hidden rounded-lg">
        <div className="flex items-center justify-between px-3 py-2">
          <div />
          <div>{t("chat.text.chat")}</div>
          <div className="cursor-pointer" onClick={clearMessageList}>
            {t("contact.text.clear")}
          </div>
        </div>

        <div className="flex-1">
          <Virtuoso
            data={items}
            className="no-scrollbar"
            endReached={endReached}
            // computeItemKey={(_, item) => item.conversationID}
            components={{
              Footer: () => (
                <div>
                  {isFetching && (
                    <div className="flex justify-center py-3">
                      <Spin />
                    </div>
                  )}
                  {!isFetching && Boolean(items?.length) && (
                    <Divider className="m-0! bg-(--chat-bubble) px-20 py-3 text-xs! font-normal! text-(--sub-text)!">
                      {t("contact.empty.noMoreMessage")}
                    </Divider>
                  )}
                </div>
              ),
              EmptyPlaceholder: () =>
                !isFetching ? (
                  <Empty
                    rootClassName="mt-[120px]"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("contact.empty.noMoments")}
                  />
                ) : null,
            }}
            itemContent={(_, moments) => (
              <MomentsMessageItem moments={moments} jumpToMoments={jumpToMoments} />
            )}
          />
        </div>
      </div>
    </Spin>
  );
};

export default memo(forwardRef(MomentsMessageList));

const getOpUser = (moments: WorkMoments) => {
  if (moments.type === WorkMomentLogType.Like) {
    return {
      faceURL: moments.likeUsers?.[0].faceURL,
      nickname: moments.likeUsers?.[0].nickname,
    };
  }
  if (moments.type === WorkMomentLogType.Comment) {
    return {
      faceURL: moments.comments?.[0].faceURL,
      nickname: moments.comments?.[0].nickname,
    };
  }
  return {
    faceURL: moments.faceURL,
    nickname: moments.nickname,
  };
};

const MomentsMessageItem = memo(
  ({
    moments,
    jumpToMoments,
  }: {
    moments: WorkMoments;
    jumpToMoments: (workMomentID: string) => void;
  }) => {
    const opUser = getOpUser(moments);

    const isLikeNotification = moments.type === WorkMomentLogType.Like;
    const isCommentNotification = moments.type === WorkMomentLogType.Comment;

    const getContent = () => {
      if (isLikeNotification) {
        return (
          <img src={liked} width={16} className="inline-block align-middle" alt="" />
        );
      }
      if (isCommentNotification) {
        return (
          <>
            {Boolean(moments.comments?.[0].replyUserID) && (
              <>
                <span>{t("contact.text.replied")}</span>
                <span className="text-(--moment-text)">
                  {moments.comments?.[0].replyNickname}:
                </span>
              </>
            )}
            <span>{moments.comments?.[0].content}</span>
          </>
        );
      }
      return t("contact.text.atYou");
    };

    const notificationTime = useMemo(() => {
      if (isLikeNotification) {
        return moments.likeUsers?.[0].likeTime;
      }
      if (isCommentNotification) {
        return moments.comments?.[0].createTime;
      }
      return moments.createTime;
    }, []);

    const onlyText = !moments.content.metas?.[0]?.thumb;

    return (
      <div className="flex items-center p-3">
        <OIMAvatar src={opUser.faceURL} text={opUser.nickname} />
        <div className="mx-2 flex-1 overflow-hidden">
          <div className="max-w-[60%] truncate text-(--moment-text)">
            {opUser.nickname}
          </div>
          <div className="truncate">{getContent()}</div>
        </div>
        <div className="mr-1 text-xs text-(--sub-text)">
          {formatMomentsTime(notificationTime ?? 0)}
        </div>
        <div
          className={clsx(
            "relative line-clamp-2 h-10.5 w-10.5 cursor-pointer overflow-hidden text-xs break-all",
            onlyText && "bg-(--chat-bubble)",
          )}
          onClick={() => jumpToMoments(moments.workMomentID)}
        >
          <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center">
            <Image
              className="max-w-10.5"
              src={moments.content.metas?.[0]?.thumb}
              preview={false}
            />
          </div>
          {onlyText ? moments.content.text : ""}
        </div>
      </div>
    );
  },
);
