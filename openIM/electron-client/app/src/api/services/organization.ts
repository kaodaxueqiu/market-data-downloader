import { chatClient, postApi } from "../core/clients";
import type { BusinessUserInfo } from "./user";

export interface Department {
  departmentID: string;
  organizationID?: string;
  faceURL: string;
  name: string;
  parentDepartmentID: string;
  order: number;
  createTime: number;
  memberNum: number;
}

export interface MemberInDepartment {
  userID: string;
  departmentID: string;
  position: string;
  station: string;
  order: number;
  entryTime: number;
  terminationTime: number;
  createTime: number;
  department: Department;
}

export interface UsersWithDepartment {
  users: Array<{ user: BusinessUserInfo; members: MemberInDepartment[] }>;
}

export const getUserJoinedDep = (userIDs: string[]) =>
  postApi<UsersWithDepartment>(chatClient, "/organization/user/department", {
    userIDs,
  });

export const getDepartmentInfo = (departmentIDs: string[]) =>
  postApi<{ departments: Department[] }>(chatClient, "/organization/department/find", {
    departmentIDs,
  });

export type SubDepartmentAndMemberResult = {
  departments?: Department[];
  parents?: Department[];
  current: Department;
  members?: BusinessUserInfoWithDepartment[];
};

export type BusinessUserInfoWithDepartment = {
  member: MemberInDepartment;
  user: BusinessUserInfo;
};

export const getSubDepartmentAndMember = (departmentID: string, organizationID?: string) =>
  postApi<SubDepartmentAndMemberResult>(chatClient, "/organization/department/child", {
    departmentID,
    ...(organizationID ? { organizationID } : {}),
  });

export interface OrganizationInfo {
  organizationID: string;
  logoURL: string;
  name: string;
  homepage: string;
  introduction: string;
  createTime: number;
  organizations?: OrganizationInfo[];
}

export const getOrgnizationInfo = (organizationID?: string) =>
  postApi<OrganizationInfo>(chatClient, "/organization/info", {
    ...(organizationID ? { organizationID } : {}),
  });
