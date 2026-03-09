import { bytesToSize } from "@openim/shared";
import { MessageType } from "@openim/wasm-client-sdk";
import { Empty, Spin } from "antd";
import { t } from "i18next";
import { memo, useEffect, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";

import JumpToMessageWrap from "@/components/JumpToMessageWrap";
import { useMessageFileDownloadState } from "@/hooks/useMessageFileDownloadState";
import { IMSDK } from "@/layout/MainContentWrap";
import { ExMessageItem } from "@/store";
import FileDownloadIcon from "@/svg/FileDownloadIcon";
import { feedbackToast } from "@/utils/feedback";
import { formatMessageTime } from "@/utils/imCommon";
import { getFileIcon } from "@/utils/media";

const initialData = {
  loading: false,
  hasMore: true,
  pageIndex: 1,
  messageList: [] as ExMessageItem[],
};

const FileMessagePane = ({
  isActive,
  conversationID,
  isOverlayOpen,
  keyword,
  closeOverlay,
}: {
  isActive: boolean;
  conversationID?: string;
  isOverlayOpen: boolean;
  keyword: string;
  closeOverlay: () => void;
}) => {
  const loadMoreKeyword = useRef("");
  const [loadState, setLoadState] = useState({
    ...initialData,
  });
  useEffect(() => {
    return () => {
      if (!isOverlayOpen) {
        setLoadState({ ...initialData });
      }
    };
  }, [conversationID, isOverlayOpen]);

  useEffect(() => {
    if (isActive) {
      console.log("useEffect file", keyword);
      triggerSearch(keyword);
    }
  }, [isActive, keyword]);

  const triggerSearch = (keyword: string, loadMore = false) => {
    if ((!loadState.hasMore && loadMore) || loadState.loading || !conversationID)
      return;
    setLoadState((state) => ({ ...state, loading: true }));

    IMSDK.searchLocalMessages({
      conversationID,
      keywordList: [keyword],
      keywordListMatchType: 0,
      senderUserIDList: [],
      messageTypeList: [MessageType.FileMessage],
      searchTimePosition: 0,
      searchTimePeriod: 0,
      pageIndex: !loadMore ? 1 : loadState.pageIndex,
      count: 20,
    })
      .then(({ data }) => {
        const searchData: ExMessageItem[] = data.searchResultItems
          ? data.searchResultItems[0].messageList
          : [];
        setLoadState((state) => ({
          loading: false,
          pageIndex: state.pageIndex + 1,
          hasMore: searchData.length === 20,
          messageList: [...(!loadMore ? [] : state.messageList), ...searchData],
        }));
      })
      .catch((error) => {
        setLoadState((state) => ({
          ...state,
          loading: false,
        }));
        feedbackToast({ error, msg: t("chat.toast.getMessageListFailed") });
      });
    loadMoreKeyword.current = keyword;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="my-2 box-border flex-1 pr-1 pl-2.5">
        <Virtuoso
          className="h-full overflow-x-hidden"
          data={loadState.messageList}
          endReached={() => triggerSearch(loadMoreKeyword.current, true)}
          components={{
            EmptyPlaceholder: () =>
              loadState.loading ? null : (
                <Empty
                  className="flex h-full flex-col items-center justify-center"
                  description={t("common.empty.noSearchResults")}
                />
              ),
            Footer: () =>
              loadState.loading ? (
                <div className="flex w-full justify-center py-3">
                  <Spin spinning />
                </div>
              ) : null,
          }}
          itemContent={(_, message) => (
            <FileMessageItem
              message={message}
              conversationID={conversationID}
              closeOverlay={closeOverlay}
            />
          )}
        />
      </div>
    </div>
  );
};

export default memo(FileMessagePane);

const FileMessageItem = memo(
  ({
    message,
    conversationID,
    closeOverlay,
  }: {
    message: ExMessageItem;
    conversationID?: string;
    closeOverlay: () => void;
  }) => {
    const { fileElem } = message;

    const { progress, downloadState, tryDownload } =
      useMessageFileDownloadState(message);

    return (
      <JumpToMessageWrap
        message={message}
        isChildWindow={false}
        conversationID={conversationID!}
        viewInFinder={true}
        afterJump={closeOverlay}
      >
        <div
          className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 hover:bg-(--primary-active)"
          onClick={tryDownload}
        >
          <div className="flex min-w-0 items-center">
            <div className="relative shrink-0">
              <img width={38} src={getFileIcon(fileElem?.fileName)} alt="file" />
              {downloadState !== "finish" && (
                <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center rounded-md bg-[rgba(0,0,0,.4)]">
                  <FileDownloadIcon
                    pausing={downloadState === "pause"}
                    percent={progress ?? 0}
                  />
                </div>
              )}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <div>{fileElem!.fileName}</div>
              <div className="mt-2 flex items-center text-xs">
                <div>{bytesToSize(fileElem!.fileSize)}</div>
                <div className="mr-2 ml-3.5 max-w-30 truncate text-(--sub-text)">
                  {message.senderNickname}
                </div>
                <div className="text-(--sub-text)">
                  {formatMessageTime(message.sendTime)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </JumpToMessageWrap>
    );
  },
);
