import { useLatest } from "ahooks";
import { Breadcrumb, Divider, Spin } from "antd";
import { ItemType } from "antd/es/breadcrumb/Breadcrumb";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { useOrganizationTree } from "@/api/hooks/search";
import {
  BusinessUserInfoWithDepartment,
  Department,
  SubDepartmentAndMemberResult,
} from "@/api/services/organization";
import arrow_right from "@/assets/images/contact/arrow_right.png";
import OIMAvatar from "@/components/OIMAvatar";
import { useUserStore } from "@/store";

type SafeOrgData = Omit<SubDepartmentAndMemberResult, "current"> & {
  current?: Department | null;
};
const EMPTY_DATA: SafeOrgData = {
  departments: [],
  members: [],
  parents: [],
  current: null,
};

export const Organization = () => {
  const { orgId, id } = useParams();
  const currentRouteID = id ?? "0";
  const organizationInfoList = useUserStore((state) => state.organizationInfoList);
  const organizationInfo = useMemo(
    () => organizationInfoList.find((o) => o.organizationID === orgId) ?? organizationInfoList[0],
    [organizationInfoList, orgId],
  );
  const departmentID = useMemo(() => {
    if (!id || id === "0") return "";
    return id;
  }, [id]);
  const { data: response, isPending } = useOrganizationTree(departmentID, Boolean(id), orgId);
  const data: SafeOrgData = response?.data ?? EMPTY_DATA;
  const dataLoading = isPending;

  const [breadcrumbItems, setBreadcrumbItems] = useState<ItemType[]>([]);
  const latestBreadcrumbItems = useLatest(breadcrumbItems);

  const navigate = useNavigate();

  useEffect(() => {
    if (!data.current) {
      setBreadcrumbItems([]);
      return;
    }
    const breadcrumbs: ItemType[] = [...(data.parents ?? []), data.current]
      .filter(Boolean)
      .map((dep, idx) => ({
        title: dep.name,
        href: "",
        key: dep.departmentID || "0",
        onClick: (e) => breadcrumbClick(e, dep.departmentID, idx),
      }));
    setBreadcrumbItems(breadcrumbs);
  }, [data.current, data.parents]);

  const breadcrumbClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement, MouseEvent>,
    departmentID: string,
    idx: number,
  ) => {
    e.preventDefault();
    if (idx === latestBreadcrumbItems.current.length - 1) return;
    toSubDepartment(departmentID || "0");
    setBreadcrumbItems((prev) => prev.slice(0, idx + 1));
  };

  const toSubDepartment = (depID: string) => {
    const nextID = depID || "0";
    if (nextID === currentRouteID) return;
    navigate(`/contact/organization/${orgId}/${nextID}`);
  };

  const renderList = useMemo(
    () =>
      [...(data.members ?? []), ...(data.departments ?? [])] as Partial<
        BusinessUserInfoWithDepartment & Department
      >[],
    [data.members, data.departments],
  );

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="mx-3 mt-4 flex items-center">
        <OIMAvatar src={organizationInfo.logoURL} isdepartment />
        <div className="ml-3 truncate">{organizationInfo.name}</div>
      </div>
      <Breadcrumb className="mx-3 mb-2 text-xs" separator=">" items={breadcrumbItems} />
      <div className="min-h-0 flex-1 px-2 pb-3">
        <Spin className="h-full" wrapperClassName="h-full" spinning={dataLoading}>
          <Virtuoso
            className="h-full overflow-x-hidden"
            data={renderList}
            computeItemKey={(index, item) =>
              item.departmentID || item.user?.userID || String(index)
            }
            itemContent={(idx, item) => {
              if (item.user) {
                const needGap =
                  idx === (data.members?.length ?? 0) - 1 &&
                  Boolean(data.departments?.length);
                return (
                  <MemberItem
                    needGap={needGap}
                    item={item as BusinessUserInfoWithDepartment}
                  />
                );
              }
              return (
                <DepartmentItem
                  department={item as Department}
                  toSubDepartment={toSubDepartment}
                />
              );
            }}
          />
        </Spin>
      </div>
    </div>
  );
};

const DepartmentItem = ({
  department,
  toSubDepartment,
}: {
  department: Department;
  toSubDepartment: (depID: string) => void;
}) => {
  return (
    <div
      className="flex items-center rounded-md px-3 py-2 hover:bg-(--primary-active)"
      onClick={() => toSubDepartment(department.departmentID)}
    >
      <div className="flex flex-1 items-center">
        <OIMAvatar src={department.faceURL} isdepartment />
        <div className="ml-3 flex items-center">
          <div className="mr-2 truncate">{department.name}</div>
          <div>{`(${department.memberNum})`}</div>
        </div>
      </div>
      <img width={20} src={arrow_right} alt="" />
    </div>
  );
};

const MemberItem = ({
  item,
  needGap,
}: {
  item: BusinessUserInfoWithDepartment;
  needGap: boolean;
}) => {
  return (
    <>
      <div
        className="flex items-center rounded-md px-3 py-2 hover:bg-(--primary-active)"
        onClick={() => window.userClick(item.user.userID)}
      >
        <div className="flex flex-1 items-center">
          <OIMAvatar src={item.user.faceURL} text={item.user.nickname} />
          <div className="ml-3 truncate">{item.user.nickname}</div>
          {Boolean(item.member?.position) && (
            <span className="ml-2 rounded border border-[#0289FA] px-1 text-xs text-[#0289FA]">
              {item.member.position}
            </span>
          )}
        </div>
        <img width={20} src={arrow_right} alt="" />
      </div>
      {needGap && <Divider className="m-2 border border-(--gap-text)" />}
    </>
  );
};
