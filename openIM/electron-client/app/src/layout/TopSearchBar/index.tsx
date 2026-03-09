import { GroupItem } from "@openim/wasm-client-sdk";
import { Popover } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import logo from "@/assets/images/profile/logo.svg";
import add_friend from "@/assets/images/topSearchBar/add_friend.png";
import add_group from "@/assets/images/topSearchBar/add_group.png";
import create_group from "@/assets/images/topSearchBar/create_group.png";
import search from "@/assets/images/topSearchBar/search.png";
import show_more from "@/assets/images/topSearchBar/show_more.png";
import WindowControlBar from "@/components/WindowControlBar";
import { APP_NAME } from "@/config";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import ChooseModal, { ChooseModalState } from "@/pages/common/ChooseModal";
import GlobalSearchModal from "@/pages/common/GlobalSearchModal";
import GroupCardModal from "@/pages/common/GroupCardModal";
import MomentsModal, { RouteTravel } from "@/pages/common/MomentsModal";
import UserCardModal, { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore, useUserStore } from "@/store";
import { broadcastSetMomentsUser } from "@/utils/window/broadcast";
import { openGlobalSearch, openMoments } from "@/utils/window/childWindows";
import emitter, { OpenUserCardParams } from "@/utils/window/events";

import SearchUserOrGroup from "./SearchUserOrGroup";

type UserCardState = OpenUserCardParams & {
  cardInfo?: CardInfo;
};

const TopSearchBar = () => {
  const { t } = useTranslation();
  const userCardRef = useRef<OverlayVisibleHandle>(null);
  const groupCardRef = useRef<OverlayVisibleHandle>(null);
  const chooseModalRef = useRef<OverlayVisibleHandle>(null);
  const searchModalRef = useRef<OverlayVisibleHandle>(null);
  const momentModalRef = useRef<OverlayVisibleHandle>(null);
  const [momentModalState, setMomentModalState] = useState<RouteTravel>({
    userID: "",
    nickname: "",
    faceURL: "",
  });
  const globalSearchModalRef = useRef<OverlayVisibleHandle>(null);
  const [chooseModalState, setChooseModalState] = useState<ChooseModalState>({
    type: "CRATE_GROUP",
  });
  const [userCardState, setUserCardState] = useState<UserCardState>();
  const [groupCardData, setGroupCardData] = useState<
    GroupItem & { inGroup?: boolean }
  >();
  const [actionVisible, setActionVisible] = useState(false);
  const [isSearchGroup, setIsSearchGroup] = useState(false);

  useEffect(() => {
    const userCardHandler = (params: OpenUserCardParams) => {
      const selfUserID = useUserStore.getState().selfInfo.userID;
      setUserCardState({ ...params, isSelf: params.userID === selfUserID });
      userCardRef.current?.openOverlay();
    };
    const chooseModalHandler = (params: ChooseModalState) => {
      setChooseModalState({ ...params });
      chooseModalRef.current?.openOverlay();
    };
    const momentsModalHandler = (params: RouteTravel) => {
      setMomentModalState({ ...params });
      if (window.electronAPI?.enableCLib) {
        openMoments(params);
        const state = window.electronAPI?.checkChildWindowStatusSync({
          key: "moments",
        });
        if (state) {
          broadcastSetMomentsUser(params);
          return;
        }
        return;
      }
      momentModalRef.current?.openOverlay();
    };

    emitter.on("OPEN_USER_CARD", userCardHandler);
    emitter.on("OPEN_GROUP_CARD", openGroupCardWithData);
    emitter.on("OPEN_CHOOSE_MODAL", chooseModalHandler);
    emitter.on("OPEN_MOMENTS", momentsModalHandler);
    return () => {
      emitter.off("OPEN_USER_CARD", userCardHandler);
      emitter.off("OPEN_GROUP_CARD", openGroupCardWithData);
      emitter.off("OPEN_CHOOSE_MODAL", chooseModalHandler);
      emitter.off("OPEN_MOMENTS", momentsModalHandler);
    };
  }, []);

  const actionClick = (idx: number) => {
    switch (idx) {
      case 0:
      case 1:
        setIsSearchGroup(Boolean(idx));
        searchModalRef.current?.openOverlay();
        break;
      case 2:
        setChooseModalState({ type: "CRATE_GROUP" });
        chooseModalRef.current?.openOverlay();
        break;
      default:
        break;
    }
    setActionVisible(false);
  };

  const openUserCardWithData = useCallback((cardInfo: CardInfo) => {
    searchModalRef.current?.closeOverlay();
    setUserCardState({ userID: cardInfo.userID, cardInfo });
    userCardRef.current?.openOverlay();
  }, []);

  const openGroupCardWithData = useCallback((group: GroupItem) => {
    searchModalRef.current?.closeOverlay();
    const inGroup = useContactStore
      .getState()
      .groupList.some((g) => g.groupID === group.groupID);
    setGroupCardData({ ...group, inGroup });
    groupCardRef.current?.openOverlay();
  }, []);

  const openGlobalSearchModal = () => {
    if (window.electronAPI?.enableCLib) {
      openGlobalSearch();
      return;
    }
    if (globalSearchModalRef.current?.isOverlayOpen) return;
    globalSearchModalRef.current?.openOverlay();
  };

  return (
    <>
      <div className="no-mobile app-drag flex h-10 min-h-10 items-center bg-(--top-search-bar)">
        <div className="app-no-drag flex shrink-0 items-center pl-4">
          <img src={logo} alt="logo" className="h-5 w-5" />
          <span className="ml-2 text-sm font-semibold text-white">{APP_NAME}</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div
            className="app-no-drag flex h-6.5 w-1/3 cursor-pointer items-center justify-center rounded-md bg-[rgba(255,255,255,0.2)]"
            onClick={() => openGlobalSearchModal()}
          >
            <img width={16} src={search} alt="" />
            <span className="ml-2 text-[#D2E3F8]">{t("common.text.search")}</span>
          </div>
          <Popover
            content={<ActionPopContent actionClick={actionClick} />}
            arrow={false}
            title={null}
            trigger="click"
            placement="bottom"
            open={actionVisible}
            onOpenChange={(vis) => setActionVisible(vis)}
          >
            <img
              className="app-no-drag ml-8 cursor-pointer"
              width={20}
              src={show_more}
              alt=""
            />
          </Popover>
        </div>
        <WindowControlBar />
        <UserCardModal ref={userCardRef} {...userCardState} />
        <GroupCardModal ref={groupCardRef} groupData={groupCardData} />
        <ChooseModal ref={chooseModalRef} state={chooseModalState} />
        <MomentsModal ref={momentModalRef} state={momentModalState} />
        <SearchUserOrGroup
          ref={searchModalRef}
          isSearchGroup={isSearchGroup}
          openUserCardWithData={openUserCardWithData}
          openGroupCardWithData={openGroupCardWithData}
        />
        <GlobalSearchModal ref={globalSearchModalRef} />
      </div>
    </>
  );
};

export default TopSearchBar;

const ActionPopContent = ({ actionClick }: { actionClick: (idx: number) => void }) => {
  const { t } = useTranslation();
  const actionMenuList = [
    {
      idx: 0,
      title: t("common.text.addFriends"),
      icon: add_friend,
    },
    {
      idx: 1,
      title: t("common.text.addGroup"),
      icon: add_group,
    },
    {
      idx: 2,
      title: t("chat.group.createGroup"),
      icon: create_group,
    },
  ];

  return (
    <div className="p-1">
      {actionMenuList.map((action) => (
        <div
          className="flex cursor-pointer items-center rounded px-3 py-2 text-xs hover:bg-(--primary-active)"
          key={action.idx}
          onClick={() => actionClick?.(action.idx)}
        >
          <img width={20} src={action.icon} alt="call_video" />
          <div className="ml-3">{action.title}</div>
        </div>
      ))}
    </div>
  );
};
