import { WorkMoments, WorkMomentsResponse } from "@/types/moment";

import { chatClient, postApi } from "../core/clients";
import { buildPagination } from "../core/helpers";
import type {
  CreateCommentParams,
  DeleteCommentParams,
  PublishMomentsParams,
} from "../types/moments";

export const MOMENTS_PAGE_SIZE = 20;
type MomentsPageParam = { pageParam?: number };

export const publishMoments = (params: PublishMomentsParams) =>
  postApi<unknown>(chatClient, "/office/work_moment/add", {
    ...params,
  });

export const fetchUserMoments = async (
  { pageParam = 1 }: MomentsPageParam,
  userID?: string,
): Promise<WorkMoments[]> => {
  const url = `/office/work_moment/find/${!userID ? "recv" : "send"}`;
  try {
    const response = await postApi<WorkMomentsResponse>(chatClient, url, {
      userID,
      pagination: buildPagination(pageParam, MOMENTS_PAGE_SIZE),
    });
    return response.data.workMoments;
  } catch {
    return [];
  }
};

export const getMomentsByID = (workMomentID: string) =>
  postApi<{ workMoment: WorkMoments }>(chatClient, "/office/work_moment/get", {
    workMomentID,
  });

export const deleteMoments = (workMomentID: string) =>
  postApi<unknown>(chatClient, "/office/work_moment/del", {
    workMomentID,
  });

export const createComment = (params: CreateCommentParams) =>
  postApi<{ workMoment: WorkMoments }>(chatClient, "/office/work_moment/comment/add", {
    ...params,
  });

export const deleteComment = (params: DeleteCommentParams) =>
  postApi<unknown>(chatClient, "/office/work_moment/comment/del", {
    ...params,
  });

export const likeMoments = (params: { workMomentID: string; like: boolean }) =>
  postApi<{ workMoment: WorkMoments }>(chatClient, "/office/work_moment/like", {
    ...params,
  });

export const getMomentsUnreadCount = () =>
  postApi<{ total: number }>(chatClient, "/office/work_moment/unread/count", {});

export const fetchMomentsLogs = (pageNumber: number) =>
  postApi<WorkMomentsResponse>(chatClient, "/office/work_moment/logs", {
    pagination: buildPagination(pageNumber, MOMENTS_PAGE_SIZE),
  });

export enum MomentsClearType {
  Count = 1,
  List = 2,
  All = 3,
}

export const clearUnreadMoments = (type: MomentsClearType) =>
  postApi<unknown>(chatClient, "/office/work_moment/unread/clear", {
    type,
  });
