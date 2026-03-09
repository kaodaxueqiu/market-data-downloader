import { useInfiniteQuery } from "@tanstack/react-query";

import { IMSDK } from "@/layout/MainContentWrap";

export const messageReadQueryKey = (params: {
  conversationID: string;
  clientMsgID: string;
  filter: 0 | 1;
}) =>
  ["messageRead", params.conversationID, params.clientMsgID, params.filter] as const;

const MESSAGE_READ_PAGE_SIZE = 20;

export type GroupMessageReaderListPage = Awaited<
  ReturnType<typeof IMSDK.getGroupMessageReaderList>
> & {
  nextOffset?: number;
  hasMore: boolean;
};

export const useGroupMessageReaderList = ({
  conversationID,
  clientMsgID,
  filter,
  enabled = true,
}: {
  conversationID?: string;
  clientMsgID?: string;
  filter: 0 | 1;
  enabled?: boolean;
}) =>
  useInfiniteQuery<GroupMessageReaderListPage>({
    queryKey: messageReadQueryKey({
      conversationID: conversationID ?? "",
      clientMsgID: clientMsgID ?? "",
      filter,
    }),
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const page = await IMSDK.getGroupMessageReaderList({
        conversationID: conversationID ?? "",
        clientMsgID: clientMsgID ?? "",
        filter,
        offset,
        count: MESSAGE_READ_PAGE_SIZE,
      });
      const hasMore = page.data.length === MESSAGE_READ_PAGE_SIZE;
      return {
        ...page,
        hasMore,
        nextOffset: hasMore ? offset + MESSAGE_READ_PAGE_SIZE : undefined,
      };
    },
    enabled: Boolean(conversationID && clientMsgID && enabled),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
