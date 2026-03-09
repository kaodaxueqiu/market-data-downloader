import { MessageItem } from "@openim/wasm-client-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addCollectRecord,
  delCollectRecord,
  getCollectRecords,
} from "../services/collect";
import type { CollectType } from "../types/collect";

export type CollectMessage = {
  collectID: string;
  collectType: CollectType;
  content: MessageItem;
  createTime: number;
};

export const favoritesQueryKey = ["favorites"] as const;

const parseCollectMessage = (item: {
  collectID: string;
  collectType: CollectType;
  content: string;
  createTime: number;
}): CollectMessage | null => {
  try {
    return {
      collectID: item.collectID,
      collectType: item.collectType,
      content: JSON.parse(item.content) as MessageItem,
      createTime: item.createTime,
    };
  } catch {
    return null;
  }
};

export const useCollectRecords = () =>
  useQuery({
    queryKey: favoritesQueryKey,
    queryFn: async () => {
      const { data } = await getCollectRecords();
      const collects = data.collects ?? [];
      return collects
        .map((item) => parseCollectMessage(item))
        .filter((item): item is CollectMessage => Boolean(item));
    },
  });

export const useDeleteCollectRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectID: string) => delCollectRecord([collectID]),
    onSuccess: (_, collectID) => {
      queryClient.setQueryData<CollectMessage[] | undefined>(
        favoritesQueryKey,
        (prev) => (prev ? prev.filter((item) => item.collectID !== collectID) : prev),
      );
    },
  });
};

export const useAddCollectRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clientMsgID: string; content: string }) =>
      addCollectRecord(params.clientMsgID, params.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });
};
