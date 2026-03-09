import { chatClient, postApi } from "../core/clients";
import { buildPagination, getSelfUserId } from "../core/helpers";
import type { AddCollectResp, GetCollectResp } from "../types/collect";

export const addCollectRecord = (id: string, content: string) =>
  postApi<AddCollectResp>(chatClient, "/collect/add", {
    uuid: id,
    userID: getSelfUserId(),
    collectType: "msg",
    content,
  });

export const delCollectRecord = (ids: string[]) =>
  postApi<unknown>(chatClient, "/collect/del", {
    collectIDs: ids,
    userID: getSelfUserId(),
  });

export const getCollectRecords = (pageNumber = 1, showNumber = 20) =>
  postApi<GetCollectResp>(chatClient, "/collect/list", {
    userID: getSelfUserId(),
    collectTypes: ["msg"],
    pagination: buildPagination(pageNumber, showNumber),
  });
