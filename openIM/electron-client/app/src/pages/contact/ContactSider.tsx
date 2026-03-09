import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "antd";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { chooseKeys } from "@/api/hooks/search";
import agent_icon from "@/assets/images/contact/agent.png";
import department_icon from "@/assets/images/contact/department_icon.png";
import group_notifications from "@/assets/images/contact/group_notifications.png";
import my_friends from "@/assets/images/contact/my_friends.png";
import my_groups from "@/assets/images/contact/my_groups.png";
import new_friends from "@/assets/images/contact/new_friends.png";
import OIMAvatar from "@/components/OIMAvatar";
import { useContactStore, useUserStore } from "@/store";

const ContactSider = () => {
  const { t } = useTranslation();
  const [selectIndex, setSelectIndex] = useState(2);
  const queryClient = useQueryClient();
  const organizationInfoList = useUserStore((state) => state.organizationInfoList);
  const refreshOrganizationList = useUserStore((state) => state.refreshOrganizationList);

  useEffect(() => {
    refreshOrganizationList();
  }, []);
  const unHandleFriendApplicationCount = useContactStore(
    (state) => state.unHandleFriendApplicationCount,
  );
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );
  const navigate = useNavigate();
  const links = useMemo(
    () => [
      {
        label: t("contact.text.newFriends"),
        icon: new_friends,
        path: "/contact/newFriends",
      },
      {
        label: t("contact.text.groupNotification"),
        icon: group_notifications,
        path: "/contact/groupNotifications",
      },
      {
        label: t("contact.text.myFriend"),
        icon: my_friends,
        path: "/contact",
      },
      {
        label: t("chat.group.myGroup"),
        icon: my_groups,
        path: "/contact/myGroups",
      },
      {
        label: t("common.text.agents"),
        icon: agent_icon,
        path: "/contact/agents",
      },
    ],
    [t],
  );

  useEffect(() => {
    if (location.hash.includes("/contact/newFriends")) {
      setSelectIndex(0);
    }
    if (location.hash.includes("/contact/groupNotifications")) {
      setSelectIndex(1);
    }
    if (location.hash.includes("/contact/myGroups")) {
      setSelectIndex(3);
    }
    if (location.hash.includes("/contact/agents")) {
      setSelectIndex(4);
    }
  }, []);

  const getBadge = (index: number) => {
    if (index === 0) {
      return unHandleFriendApplicationCount;
    }
    if (index === 1) {
      return unHandleGroupApplicationCount;
    }
    return 0;
  };

  const showOrganization = (orgID: string, departmentID = "0") => {
    setSelectIndex(-1);
    queryClient.invalidateQueries({ queryKey: chooseKeys.orgTree(departmentID === "0" ? "" : departmentID, orgID) });
    navigate(`/contact/organization/${orgID}/${departmentID}`);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="shrink-0 pt-5.5 pb-3 pl-5 text-base font-extrabold">
        {t("contact.text.contact")}
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul>
          {links.map((item, index) => {
            return (
              <li
                key={item.path}
                className={clsx(
                  "mx-2 mb-1 flex cursor-pointer items-center rounded-md px-3 py-2.5 text-sm last:mb-0 hover:bg-(--primary-active)",
                  { "bg-[#f3f8fe]": index === selectIndex },
                )}
                onClick={() => {
                  setSelectIndex(index);
                  navigate(String(item.path));
                }}
              >
                <Badge size="small" count={getBadge(index)}>
                  <img
                    alt={item.label}
                    src={item.icon}
                    className="mr-3 h-10.5 w-10.5 rounded-md"
                  />
                </Badge>
                <div className="text-sm">{item.label}</div>
              </li>
            );
          })}
        </ul>
        {organizationInfoList.map((org) => (
          <ul key={org.organizationID}>
            <li className="mx-3 my-3 border-t border-(--gap-text)" />
            <li className="mx-2 mb-1 flex items-center rounded-md px-3 py-2.5 text-sm">
              <OIMAvatar src={org.logoURL} isdepartment />
              <div className="ml-3 truncate">{org.name}</div>
            </li>
            <li
              onClick={() => showOrganization(org.organizationID)}
              className="mx-2 flex cursor-pointer items-center rounded-md px-3 py-2.5 text-sm hover:bg-(--primary-active)"
            >
              <div className="flex h-10.5 min-w-10.5 items-center justify-center">
                <img width={9} src={department_icon} alt="" />
              </div>
              <div className="ml-3 truncate">{t("common.text.organization")}</div>
            </li>
          </ul>
        ))}
      </div>
    </div>
  );
};
export default ContactSider;
