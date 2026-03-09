import { SearchOutlined } from "@ant-design/icons";
import { GroupMemberItem, SessionType } from "@openim/wasm-client-sdk";
import { useDebounceFn, useLatest } from "ahooks";
import { Breadcrumb, Input, Spin } from "antd";
import { BreadcrumbItemType } from "antd/es/breadcrumb/Breadcrumb";
import clsx from "clsx";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import { useOrganizationSearch, useOrganizationTree } from "@/api/hooks/search";
import friend from "@/assets/images/chooseModal/friend.png";
import group from "@/assets/images/chooseModal/group.png";
import recently from "@/assets/images/chooseModal/recently.png";
import agents from "@/assets/images/contact/agent.png";
import organization_icon from "@/assets/images/contact/organization_icon.png";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import useGroupMembers, { REACH_SEARCH_FLAG } from "@/hooks/useGroupMembers";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/feedback";

import CheckItem, { CheckListItem } from "./CheckItem";
import MenuItem from "./MenuItem";

export type ChooseMenuItem = {
  idx: number;
  title: string;
  icon: string;
};

interface IChooseBoxProps {
  className?: string;
  isCheckInGroup?: boolean;
  notConversation?: boolean;
  notOrgMember?: boolean;
  canAddAgents?: boolean;
  showGroupMember?: boolean;
  chooseOneOnly?: boolean;
  checkMemberRole?: boolean;
  fowardContent?: string;
  filterBlack?: boolean;
}

export interface ChooseBoxHandle {
  getAdditional: () => string;
  getCheckedList: () => CheckListItem[];
  updatePrevCheckList: (data: CheckListItem[]) => void;
  resetState: () => void;
}

const ChooseBox: ForwardRefRenderFunction<ChooseBoxHandle, IChooseBoxProps> = (
  props,
  ref,
) => {
  const { t } = useTranslation();
  const {
    className,
    isCheckInGroup,
    notConversation,
    notOrgMember,
    canAddAgents,
    showGroupMember,
    chooseOneOnly,
    checkMemberRole,
    fowardContent,
    filterBlack = false,
  } = props;

  const [additional, setAdditional] = useState("");
  const [checkedList, setCheckedList] = useState<CheckListItem[]>([]);
  const latestCheckedList = useLatest(checkedList);

  const [searchState, setSearchState] = useState({
    keywords: "",
    searching: false,
    canSearch: showGroupMember,
  });

  const memberListRef = useRef<MemberListHandle>(null);
  const commLeftRef = useRef<CommonLeftHandle>(null);

  const checkClick = useCallback(
    (data: CheckListItem) => {
      const idx = latestCheckedList.current.findIndex(
        (item) =>
          (item.userID && item.userID === data.userID) ||
          (item.groupID && item.groupID === data.groupID && !showGroupMember) ||
          (item.user?.userID &&
            item.user.userID === (data.userID ?? data.user?.userID)),
      );
      if (idx > -1) {
        setCheckedList((state) => {
          const newState = [...state];
          newState.splice(idx, 1);
          return newState;
        });
      } else {
        if (chooseOneOnly && latestCheckedList.current.length > 0) {
          feedbackToast({
            msg: t("common.toast.beyondSelectionLimit"),
            error: t("common.toast.beyondSelectionLimit"),
          });
          return;
        }

        setCheckedList((state) => [...state, data]);
      }
    },
    [chooseOneOnly],
  );

  const isChecked = useCallback(
    (data: CheckListItem) =>
      checkedList.some(
        (item) =>
          (item.userID && item.userID === data.userID) ||
          (item.user?.userID &&
            item.user.userID === (data.userID ?? data.user?.userID)) ||
          (item.groupID && item.groupID === data.groupID && !showGroupMember),
      ),
    [checkedList.length, showGroupMember],
  );

  const resetState = () => {
    setAdditional("");
    setCheckedList([]);
  };

  const updatePrevCheckList = (data: CheckListItem[]) => {
    setCheckedList([...data]);
  };

  const { run: onEnterSearch } = useDebounceFn(
    () => {
      if (!searchState.keywords) return;
      setSearchState((state) => ({ ...state, searching: true }));

      if (showGroupMember) {
        memberListRef.current?.searchMember(searchState.keywords);
      } else {
        commLeftRef.current?.getFilterCheckList(searchState.keywords);
      }
    },
    { wait: 150 },
  );

  const updateIsCanSearch = useCallback((canSearch: boolean) => {
    setSearchState((state) => ({ keywords: "", searching: false, canSearch }));
  }, []);

  useImperativeHandle(ref, () => ({
    getAdditional: () => additional,
    getCheckedList: () => checkedList,
    resetState,
    updatePrevCheckList,
  }));

  return (
    <div
      className={clsx(
        "mx-9 mt-5 flex h-120 rounded-md border border-(--gap-text)",
        className,
      )}
    >
      <div className="flex flex-1 flex-col border-r border-(--gap-text)">
        <div className="p-5.5 pb-3">
          <Input
            value={searchState.keywords}
            allowClear
            spellCheck={false}
            disabled={!searchState.canSearch}
            onChange={(e) => {
              setSearchState((state) => ({
                searching: e.target.value ? state.searching : false,
                keywords: e.target.value,
                canSearch: state.canSearch,
              }));
              onEnterSearch();
            }}
            prefix={<SearchOutlined rev={undefined} className="text-(--sub-text)" />}
          />
        </div>
        {showGroupMember ? (
          <ForwardMemberList
            ref={memberListRef}
            isChecked={isChecked}
            checkClick={checkClick}
            checkMemberRole={checkMemberRole}
            isSearching={searchState.searching}
          />
        ) : (
          <ForwardCommonLeft
            ref={commLeftRef}
            notConversation={notConversation!}
            notOrgMember={Boolean(notOrgMember)}
            canAddAgents={Boolean(canAddAgents)}
            isCheckInGroup={isCheckInGroup!}
            isSearching={searchState.searching}
            isChecked={isChecked}
            checkClick={checkClick}
            updateIsCanSearch={updateIsCanSearch}
            filterBlack={filterBlack}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-5 py-5.5">
          {t("common.text.selected")}
          <span className="text-primary">{` ${checkedList.length} `}</span>
        </div>
        <div className="mb-3 flex-1 overflow-y-auto">
          {checkedList.map((item) => (
            <CheckItem
              data={item}
              key={item.userID || item.groupID || item.user?.userID}
              cancelClick={checkClick}
            />
          ))}
        </div>
        {fowardContent && (
          <div className="mx-5.5 mb-5 border-t border-(--gap-text)">
            <div className="mt-1 mb-2 truncate text-(--sub-text)">{fowardContent}</div>
            <div className="rounded-md bg-[#e3e3e3]">
              <Input
                value={additional}
                onChange={(e) => setAdditional(e.target.value)}
                bordered={false}
                placeholder={t("common.text.leaveMessage")}
                maxLength={255}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(forwardRef(ChooseBox));

interface ICommonLeftProps {
  notConversation: boolean;
  notOrgMember: boolean;
  canAddAgents: boolean;
  isCheckInGroup: boolean;
  isSearching: boolean;
  checkClick: (data: CheckListItem) => void;
  isChecked: (data: CheckListItem) => boolean;
  updateIsCanSearch: (canSearch: boolean) => void;
  filterBlack?: boolean;
}

interface CommonLeftHandle {
  getFilterCheckList: (keyword: string) => void;
}

const CommonLeft: ForwardRefRenderFunction<CommonLeftHandle, ICommonLeftProps> = (
  {
    notConversation,
    notOrgMember,
    canAddAgents,
    isCheckInGroup,
    isSearching,
    checkClick,
    isChecked,
    updateIsCanSearch,
    filterBlack,
  },
  ref,
) => {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItemType[]>([]);
  const [checkList, setCheckList] = useState<CheckListItem[]>([]);
  const [searchList, setSearchList] = useState<CheckListItem[]>([]);
  const [organizationDepartmentID, setOrganizationDepartmentID] = useState<
    string | null
  >(null);
  const [organizationSearchKeyword, setOrganizationSearchKeyword] = useState("");
  const latestBreadcrumb = useLatest(breadcrumb);

  const selfID = useUserStore((state) => state.selfInfo?.userID);
  const organizationName = useUserStore((state) =>
    state.organizationInfoList.map((o) => o.name).join(", "),
  );

  const blackList = useContactStore((state) => state.blackList);

  const { t } = useTranslation();

  const menuList: ChooseMenuItem[] = useMemo(
    () => [
      {
        idx: 0,
        title: t("common.text.latestChat"),
        icon: recently,
      },
      {
        idx: 1,
        title: t("contact.text.myFriend"),
        icon: friend,
      },
      {
        idx: 2,
        title: t("chat.group.myGroup"),
        icon: group,
      },
      {
        idx: 3,
        title: t("common.text.organization"),
        icon: organization_icon,
      },
      {
        idx: 4,
        title: t("common.text.agents"),
        icon: agents,
      },
    ],
    [t],
  );

  const isOrganizationMode = breadcrumb[0]?.href !== undefined;
  const organizationTreeEnabled =
    isOrganizationMode && organizationDepartmentID !== null;
  const { data: organizationData, isFetching: orgDataLoading } = useOrganizationTree(
    organizationDepartmentID ?? "",
    organizationTreeEnabled,
  );
  const { data: organizationSearchData, isFetching: orgSearchLoading } =
    useOrganizationSearch(organizationSearchKeyword, isOrganizationMode);

  const breadcrumbClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    setBreadcrumb([]);
    setOrganizationDepartmentID(null);
    setOrganizationSearchKeyword("");
    setSearchList([]);
    setCheckList([]);
    updateIsCanSearch(false);
  };

  const checkInGroup = useCallback(
    async (list: CheckListItem[]) => {
      const currentGroupID =
        useConversationStore.getState().currentConversation?.groupID;
      if (!isCheckInGroup || !currentGroupID) {
        list.map((item) => {
          const userID = item.userID ?? item.user?.userID ?? "";
          item.disabled = userID === selfID;
        });
        return list;
      }
      const tmpList = JSON.parse(JSON.stringify(list)) as CheckListItem[];
      const userIDList = tmpList
        .filter((item) => Boolean(item.userID || item.user?.userID))
        .map((item) => item.userID ?? item.user?.userID ?? "");
      try {
        const { data } = await IMSDK.getUsersInGroup({
          groupID: currentGroupID,
          userIDList,
        });
        tmpList.map((item) => {
          const userID = item.userID ?? item.user?.userID ?? "";
          item.disabled = data.includes(userID) || userID === selfID;
        });
      } catch (error) {
        console.error(error);
      }
      return tmpList;
    },
    [isCheckInGroup, selfID],
  );

  useEffect(() => {
    if (!isOrganizationMode || !organizationData?.data) return;
    const syncOrganizationData = async () => {
      let members = organizationData.data.members ?? [];
      if (filterBlack) {
        members = members.filter(
          (item) => !blackList.some((black) => black.userID === item.member.userID),
        );
      }
      const nextList = await checkInGroup([
        ...(members ?? []),
        ...(organizationData.data.departments ?? []),
      ]);
      setCheckList(nextList);
    };
    void syncOrganizationData();
  }, [blackList, checkInGroup, filterBlack, isOrganizationMode, organizationData]);

  useEffect(() => {
    if (!isOrganizationMode) return;
    if (!organizationSearchKeyword) {
      setSearchList([]);
      return;
    }
    const total = organizationSearchData?.data.total ?? 0;
    let searchData = total ? (organizationSearchData?.data.users ?? []) : [];
    if (filterBlack) {
      searchData = searchData.filter(
        (item) => !blackList.some((black) => black.userID === item.userID),
      );
    }
    setSearchList(searchData);
  }, [
    blackList,
    filterBlack,
    isOrganizationMode,
    organizationSearchData,
    organizationSearchKeyword,
  ]);

  const menuClick = useCallback(async (idx: number) => {
    const pushItem: BreadcrumbItemType = {};
    switch (idx) {
      case 0:
        setCheckList(
          await checkInGroup(
            useConversationStore.getState().conversationList.filter((conversation) => {
              const isNotificationConversation =
                conversation.conversationType === SessionType.Notification;
              if (filterBlack) {
                const isBlack = blackList.some(
                  (black) => black.userID === conversation.userID,
                );
                return !isNotificationConversation && !isBlack;
              }
              return !isNotificationConversation;
            }),
          ),
        );
        pushItem.title = t("common.text.latestChat");
        break;
      case 1:
        // black list user not in friend list, so don't need to filter black list
        setCheckList(await checkInGroup(useContactStore.getState().friendList));
        pushItem.title = t("contact.text.myFriend");
        break;
      case 2:
        setCheckList(await checkInGroup(useContactStore.getState().groupList));
        pushItem.title = t("chat.group.myGroup");
        break;
      case 3:
        setOrganizationDepartmentID("");
        setOrganizationSearchKeyword("");
        setSearchList([]);
        setCheckList([]);
        pushItem.title = t("common.text.organization");
        pushItem.href = "";
        pushItem.key = "";
        pushItem.onClick = (e) => breadcrumbDepClick(e, "", 0);
        break;
      case 4:
        setCheckList(await checkInGroup(useContactStore.getState().agents));
        pushItem.title = t("common.text.agents");
        break;
      default:
        break;
    }
    setBreadcrumb((state) => [...state, pushItem]);
    updateIsCanSearch(true);
  }, []);

  const getFilterCheckList = (keyword: string) => {
    if (!latestBreadcrumb.current) return;

    if (!keyword) {
      setOrganizationSearchKeyword("");
      setSearchList([]);
      return;
    }
    if (latestBreadcrumb.current[0].href !== undefined) {
      setOrganizationSearchKeyword(keyword.trim());
      return;
    }
    const upperCaseKeyword = keyword.toUpperCase();
    // checkList has filter black list, so don't need to filter black list again
    const filterList = checkList.filter((item) => {
      if (item.conversationID) {
        return item.showName?.toUpperCase().includes(upperCaseKeyword);
      }
      if (item.groupID) {
        return (
          item.groupName?.toUpperCase().includes(upperCaseKeyword) ||
          item.groupID?.toUpperCase().includes(upperCaseKeyword)
        );
      }
      return (
        item.nickname?.toUpperCase().includes(upperCaseKeyword) ||
        item.userID?.toUpperCase().includes(upperCaseKeyword) ||
        item.remark?.toUpperCase().includes(upperCaseKeyword)
      );
    });
    setSearchList(filterList);
  };

  const breadcrumbDepClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement, MouseEvent>,
    departmentID: string,
    idx: number,
  ) => {
    e.preventDefault();
    if (idx === latestBreadcrumb.current.length - 1) return;
    setOrganizationDepartmentID(departmentID);
    setOrganizationSearchKeyword("");
    setSearchList([]);
    setBreadcrumb((prev) => prev.slice(0, idx + 1));
  };

  const itemClick = useCallback((item: CheckListItem) => {
    if (item.departmentID) {
      const idx = latestBreadcrumb.current.length;

      const pushItem: BreadcrumbItemType = {
        title: item.name,
        href: "",
        key: item.departmentID,
        onClick: (e) => breadcrumbDepClick(e, item.departmentID ?? "", idx),
      };
      setBreadcrumb((prev) => [...prev, pushItem]);
      setOrganizationDepartmentID(item.departmentID);
      setOrganizationSearchKeyword("");
      setSearchList([]);
      return;
    }
    checkClick(item);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getFilterCheckList,
    }),
    [JSON.stringify(checkList)],
  );

  if (breadcrumb.length < 1) {
    return (
      <div className="flex-1 overflow-auto">
        {menuList.map((menu) => {
          if (notConversation && (menu.idx === 0 || menu.idx === 2)) {
            return null;
          }
          if ((notOrgMember || !organizationName) && menu.idx === 3) {
            return null;
          }
          if (!canAddAgents && menu.idx === 4) {
            return null;
          }
          return <MenuItem menu={menu} key={menu.idx} menuClick={menuClick} />;
        })}
      </div>
    );
  }

  const dataSource = isSearching ? searchList : checkList;
  const organizationLoading =
    isOrganizationMode && (orgDataLoading || orgSearchLoading);

  return (
    <div className="flex flex-1 flex-col">
      <Breadcrumb
        className="choose-box-breadcrumb mx-5.5"
        separator=">"
        items={[
          {
            title: t("common.text.contacts"),
            href: "",
            onClick: breadcrumbClick,
          },
          ...breadcrumb,
        ]}
      />
      <div className="mb-3 flex-1 overflow-y-auto">
        <Spin wrapperClassName="h-full" spinning={organizationLoading}>
          <Virtuoso
            className="h-full"
            data={dataSource}
            itemContent={(_, item) => (
              <CheckItem
                showCheck
                isChecked={isChecked(item)}
                data={item}
                key={item.userID || item.groupID}
                itemClick={itemClick}
              />
            )}
          />
        </Spin>
      </div>
    </div>
  );
};

const ForwardCommonLeft = memo(forwardRef(CommonLeft));

interface IGroupMemberListProps {
  isSearching?: boolean;
  checkMemberRole?: boolean;
  checkClick: (data: CheckListItem) => void;
  isChecked: (data: CheckListItem) => boolean;
}

interface MemberListHandle {
  searchMember: (keywords: string) => void;
}

const GroupMemberList: ForwardRefRenderFunction<
  MemberListHandle,
  IGroupMemberListProps
> = ({ isSearching, checkMemberRole, checkClick, isChecked }, ref) => {
  const { currentRolevel, currentMemberInGroup } = useCurrentMemberRole();
  const { fetchState, searchMember, getMemberData, resetState } = useGroupMembers({
    notRefresh: true,
  });

  useEffect(() => {
    if (currentMemberInGroup?.groupID) {
      getMemberData(true);
    }
    return () => {
      resetState();
    };
  }, [currentMemberInGroup?.groupID]);

  const endReached = () => {
    if (fetchState.loading || !fetchState.hasMore) {
      return;
    }
    if (!isSearching) {
      getMemberData();
    } else {
      searchMember(REACH_SEARCH_FLAG);
    }
  };

  const isDisabled = (member: GroupMemberItem) => {
    if (member.userID === currentMemberInGroup?.userID) return true;
    if (!checkMemberRole) return false;
    return member.roleLevel >= currentRolevel;
  };

  useImperativeHandle(
    ref,
    () => ({
      searchMember,
    }),
    [],
  );

  const dataSource = isSearching
    ? fetchState.searchMemberList
    : fetchState.groupMemberList;

  return (
    <Spin wrapperClassName="h-full" spinning={fetchState.loading}>
      <Virtuoso
        className="h-full overflow-x-hidden"
        data={dataSource}
        fixedItemHeight={62}
        endReached={endReached}
        itemContent={(_, member) => (
          <CheckItem
            showCheck
            isChecked={isChecked(member)}
            disabled={isDisabled(member)}
            data={member}
            itemClick={checkClick}
          />
        )}
      />
    </Spin>
  );
};

const ForwardMemberList = memo(forwardRef(GroupMemberList));
