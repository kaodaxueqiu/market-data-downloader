import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/store";
import { WorkMoments, WorkMomentsResponse } from "@/types/moment";

import type { ApiResponse } from "../core/types";
import {
  clearUnreadMoments,
  createComment,
  deleteComment,
  deleteMoments,
  fetchMomentsLogs,
  fetchUserMoments,
  likeMoments,
  MOMENTS_PAGE_SIZE,
  MomentsClearType,
  publishMoments,
} from "../services/moments";
import type {
  CreateCommentParams,
  DeleteCommentParams,
  PublishMomentsParams,
} from "../types/moments";

const DEFAULT_MOMENTS_KEY = "SelfMoments";

export const momentsQueryKey = (key?: string) =>
  ["moments", key ?? DEFAULT_MOMENTS_KEY] as const;

export const usePublishMoments = (queryKey?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: PublishMomentsParams) => publishMoments(params),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: momentsQueryKey(queryKey) }),
  });
};

export const useUserMoments = (enabled: boolean, queryKey?: string) =>
  useInfiniteQuery<WorkMoments[]>({
    queryKey: momentsQueryKey(queryKey),
    queryFn: ({ pageParam }) =>
      fetchUserMoments({ pageParam: pageParam as number }, queryKey),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage?.length < MOMENTS_PAGE_SIZE ? undefined : pages.length + 1,
    enabled,
  });

export const useDeleteMoments = (queryKey?: string) => {
  const queryClient = useQueryClient();
  const momentsKey = momentsQueryKey(queryKey);
  return useMutation({
    mutationFn: (workMomentID: string) => deleteMoments(workMomentID),
    onMutate: (updatedData) => {
      const previousData = queryClient.getQueryData<
        InfiniteData<WorkMoments[]> | undefined
      >(momentsKey);
      queryClient.setQueryData<InfiniteData<WorkMoments[]> | undefined>(
        momentsKey,
        (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map((page) => {
            return page.filter((item) => item.workMomentID !== updatedData);
          });
          return {
            ...oldData,
            pages: newPages,
          };
        },
      );
      return previousData;
    },
    onError: (_, __, onMutateResult) => {
      queryClient.setQueryData(momentsKey, onMutateResult);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: momentsKey }),
  });
};

export const useCreateComment = (queryKey?: string) => {
  const queryClient = useQueryClient();
  const selfInfo = useUserStore.getState().selfInfo;
  const momentsKey = momentsQueryKey(queryKey);
  return useMutation({
    mutationFn: (params: CreateCommentParams) => createComment(params),
    onMutate: (updatedData) => {
      const previousData = queryClient.getQueryData<
        InfiniteData<WorkMoments[]> | undefined
      >(momentsKey);
      queryClient.setQueryData<InfiniteData<WorkMoments[]> | undefined>(
        momentsKey,
        (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map((page) => {
            return page.map((item) => {
              if (item.workMomentID !== updatedData.workMomentID) return item;
              const newComment = {
                userID: selfInfo.userID,
                nickname: selfInfo.nickname,
                faceURL: selfInfo.faceURL,
                commentID: uuidv4(),
                content: updatedData.content,
                createTime: new Date().getTime(),
                replyFaceURL: "",
                replyNickname: updatedData.replyUserName,
                replyUserID: updatedData.replyUserID,
              };
              const updatedComments = item.comments
                ? [...item.comments, newComment]
                : [newComment];
              return { ...item, comments: updatedComments };
            });
          });
          return {
            ...oldData,
            pages: newPages,
          };
        },
      );
      return previousData;
    },
    onError: (_, __, onMutateResult) => {
      queryClient.setQueryData(momentsKey, onMutateResult);
    },
  });
};

export const useDeleteComment = (queryKey?: string) => {
  const queryClient = useQueryClient();
  const momentsKey = momentsQueryKey(queryKey);
  return useMutation({
    mutationFn: (params: DeleteCommentParams) => deleteComment(params),
    onMutate: (updatedData) => {
      const previousData = queryClient.getQueryData<
        InfiniteData<WorkMoments[]> | undefined
      >(momentsKey);
      queryClient.setQueryData<InfiniteData<WorkMoments[]> | undefined>(
        momentsKey,
        (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map((page) => {
            return page.map((item) => {
              if (item.workMomentID !== updatedData.workMomentID) return item;
              const newItem = { ...item };
              newItem.comments = newItem.comments?.filter(
                (comment) => comment.commentID !== updatedData.commentID,
              );
              return newItem;
            });
          });
          return {
            ...oldData,
            pages: newPages,
          };
        },
      );
      return previousData;
    },
    onError: (_, __, onMutateResult) => {
      queryClient.setQueryData(momentsKey, onMutateResult);
    },
  });
};

export const useLikeMoments = (queryKey?: string) => {
  const queryClient = useQueryClient();
  const selfInfo = useUserStore.getState().selfInfo;
  const momentsKey = momentsQueryKey(queryKey);
  return useMutation({
    mutationFn: (params: { workMomentID: string; like: boolean }) =>
      likeMoments(params),
    onMutate: (updatedData) => {
      const previousData = queryClient.getQueryData<
        InfiniteData<WorkMoments[]> | undefined
      >(momentsKey);
      queryClient.setQueryData<InfiniteData<WorkMoments[]> | undefined>(
        momentsKey,
        (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map((page) => {
            return page.map((item) => {
              if (item.workMomentID !== updatedData.workMomentID) return item;
              const newItem = { ...item };
              if (updatedData.like) {
                newItem.likeUsers = newItem.likeUsers
                  ? [
                      ...newItem.likeUsers,
                      { ...selfInfo, likeTime: new Date().getTime() },
                    ]
                  : [{ ...selfInfo, likeTime: new Date().getTime() }];
              } else {
                newItem.likeUsers = newItem.likeUsers?.filter(
                  (user) => user.userID !== selfInfo.userID,
                );
              }
              return newItem;
            });
          });
          return {
            ...oldData,
            pages: newPages,
          };
        },
      );
      return previousData;
    },
    onError: (_, __, onMutateResult) => {
      queryClient.setQueryData(momentsKey, onMutateResult);
    },
  });
};

export const useLogs = () =>
  useInfiniteQuery<ApiResponse<WorkMomentsResponse>>({
    queryKey: ["MomentsMessageList"],
    queryFn: ({ pageParam }) => fetchMomentsLogs(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if ((lastPage.data.workMoments?.length ?? 0) < MOMENTS_PAGE_SIZE) {
        return undefined;
      }
      return pages.length + 1;
    },
  });

export const useClearUnreadMoments = () =>
  useMutation({
    mutationFn: (type: MomentsClearType) => clearUnreadMoments(type),
  });
