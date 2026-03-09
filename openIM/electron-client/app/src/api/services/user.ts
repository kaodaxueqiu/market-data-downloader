import type {
  AddFriendPermission,
  MessageReceiveOptType,
} from "@openim/wasm-client-sdk";

import { chatClient, postApi } from "../core/clients";
import { buildPagination, getSelfUserId } from "../core/helpers";
import { getUserJoinedDep, type MemberInDepartment } from "./organization";

export interface BusinessUserInfo {
  userID: string;
  password: string;
  account: string;
  phoneNumber: string;
  areaCode: string;
  email: string;
  nickname: string;
  faceURL: string;
  gender: number;
  level: number;
  birth: number;
  addFriendPermission: AddFriendPermission;
  allowAddFriend: BusinessAllowType;
  allowBeep: BusinessAllowType;
  allowVibration: BusinessAllowType;
  globalRecvMsgOpt: MessageReceiveOptType;
  members?: MemberInDepartment[];
  organizationIDs?: string[];
  registerType: RegisterType;
}

export enum RegisterType {
  Account,
  Email,
  PhoneNumber,
}

export enum BusinessAllowType {
  Allow = 1,
  NotAllow = 2,
}

export const getBusinessUserInfo = (userIDs: string[]) =>
  postApi<{ users: BusinessUserInfo[] }>(chatClient, "/user/find/full", {
    userIDs,
  });

export const searchBusinessUserInfo = (
  keyword: string,
  pageNumber = 1,
  showNumber = 1,
) =>
  postApi<{ total: number; users: BusinessUserInfo[] }>(
    chatClient,
    "/user/search/full",
    {
      keyword,
      pagination: buildPagination(pageNumber, showNumber),
    },
  );

export const searchOrganizationUserInfo = (
  keyword: string,
  pageNumber = 1,
  showNumber = 20,
) =>
  postApi<{ total: number; users: BusinessUserInfo[] }>(
    chatClient,
    "/user/search/organization/full",
    {
      keyword,
      pagination: buildPagination(pageNumber, showNumber),
    },
  );

interface UpdateBusinessUserInfoParams {
  email: string;
  nickname: string;
  faceURL: string;
  gender: number;
  birth: number;
  allowAddFriend: number;
  allowBeep: number;
  allowVibration: number;
  globalRecvMsgOpt: number;
}

export const updateBusinessUserInfo = (params: Partial<UpdateBusinessUserInfoParams>) =>
  postApi<unknown>(chatClient, "/user/update", {
    ...params,
    userID: getSelfUserId(),
  });

export const getBusinessUserInfoWithDepartment = async (userIDs: string[]) => {
  const [userResp, departmentResp] = await Promise.all([
    getBusinessUserInfo(userIDs),
    getUserJoinedDep(userIDs),
  ]);
  const userInfos = userResp.data;
  const departmentInfos = departmentResp.data;
  return userInfos.users.map((user) => ({
    ...user,
    members: departmentInfos.users.find((item) =>
      item.members.some((member) => member.userID === user.userID),
    )?.members,
  }));
};

export const deregister = () =>
  postApi<unknown>(chatClient, "/user/unregister_user", {
    userIDs: [getSelfUserId()],
  });
