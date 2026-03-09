import { RightOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Badge, Divider, Layout, Popover, Upload } from "antd";
import clsx from "clsx";
import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ImageResizer from "react-image-file-resizer";
import { UNSAFE_NavigationContext, useResolvedPath } from "react-router-dom";

import { modal } from "@/AntdGlobalComp";
import { updateBusinessUserInfo } from "@/api/services/user";
import contact_icon from "@/assets/images/nav/nav_bar_contact.png";
import contact_icon_active from "@/assets/images/nav/nav_bar_contact_active.png";
import nav_bar_favorites from "@/assets/images/nav/nav_bar_favorites.png";
import nav_bar_favorites_active from "@/assets/images/nav/nav_bar_favorites_active.png";
import message_icon from "@/assets/images/nav/nav_bar_message.png";
import message_icon_active from "@/assets/images/nav/nav_bar_message_active.png";
import change_avatar from "@/assets/images/profile/change_avatar.png";
import OIMAvatar from "@/components/OIMAvatar";
import { useConversationUnreadCount } from "@/hooks/useConversationUnreadCount";
import { useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { uploadFile } from "@/utils/imCommon";
import { openAbout, openPersonalSettings } from "@/utils/window/childWindows";
import emitter, { emit } from "@/utils/window/events";

import { OverlayVisibleHandle } from "../../hooks/useOverlayVisible";
import About from "./About";
import ConversationNavMenuContent from "./ConversationNavMenuContent";
import styles from "./left-nav-bar.module.scss";
import PersonalSettings from "./PersonalSettings";

const { Sider } = Layout;

type NavItemType = {
  icon: string;
  icon_active: string;
  title: string;
  path: string;
};

const resizeFile = (file: File): Promise<File> =>
  new Promise((resolve) => {
    ImageResizer.imageFileResizer(
      file,
      400,
      400,
      "webp",
      90,
      0,
      (uri) => {
        resolve(uri as File);
      },
      "file",
    );
  });

const NavItem = ({ nav: { icon, icon_active, title, path } }: { nav: NavItemType }) => {
  const resolvedPath = useResolvedPath(path);
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const toPathname = navigator.encodeLocation
    ? navigator.encodeLocation(path).pathname
    : resolvedPath.pathname;
  const locationPathname = location.pathname;
  const isActive =
    locationPathname === toPathname ||
    (locationPathname.startsWith(toPathname) &&
      locationPathname.charAt(toPathname.length) === "/") ||
    location.hash.startsWith(`#${toPathname}`);

  const [showConversationMenu, setShowConversationMenu] = useState(false);

  const conversationUnreadCount = useConversationUnreadCount();
  const workMomentsUnreadCount = useUserStore((state) => state.workMomentsUnreadCount);
  const unHandleFriendApplicationCount = useContactStore(
    (state) => state.unHandleFriendApplicationCount,
  );
  const unHandleGroupApplicationCount = useContactStore(
    (state) => state.unHandleGroupApplicationCount,
  );

  const tryNavigate = () => {
    if (isActive) {
      if (path === "/chat") {
        emit("TRY_JUMP_TO_UNREAD");
      }
      return;
    }

    if (path === "/moments") {
      emit("OPEN_MOMENTS", {
        userID: "",
        nickname: "",
        faceURL: "",
      });
      return;
    }
    // TODO Keep answering when jumping back to chat from another page (if there is one)
    navigator.push(path);
  };

  const closeConversationMenu = () => {
    setShowConversationMenu(false);
  };

  const getBadge = () => {
    if (path === "/chat") {
      return conversationUnreadCount;
    }
    if (path === "/contact") {
      return unHandleFriendApplicationCount + unHandleGroupApplicationCount;
    }

    if (path === "/moments") {
      return workMomentsUnreadCount;
    }
    return 0;
  };

  return (
    <Badge size="small" count={getBadge()}>
      <Popover
        overlayClassName="common-menu-popover"
        placement="bottomRight"
        title={null}
        arrow={false}
        open={path === "/chat" ? showConversationMenu : false}
        onOpenChange={(vis) => setShowConversationMenu(vis)}
        content={
          <ConversationNavMenuContent closeConversationMenu={closeConversationMenu} />
        }
        trigger="contextMenu"
      >
        <div
          className={clsx(
            "mb-3 flex h-13 w-12 cursor-pointer flex-col items-center justify-center rounded-md",
            { "bg-[#e9e9eb]": isActive },
          )}
          onClick={tryNavigate}
        >
          <img width={20} src={isActive ? icon_active : icon} alt="" />
          <div className="mt-1 text-xs text-gray-500">{title}</div>
        </div>
      </Popover>
    </Badge>
  );
};

const LeftNavBar = memo(() => {
  const { t } = useTranslation();
  const aboutRef = useRef<OverlayVisibleHandle>(null);
  const personalSettingsRef = useRef<OverlayVisibleHandle>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [highlightCloseAction, setHighlightCloseAction] = useState(false);
  const selfInfo = useUserStore((state) => state.selfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  const { mutateAsync: updateProfile } = useMutation({
    mutationFn: updateBusinessUserInfo,
  });

  const navList: NavItemType[] = [
    {
      icon: message_icon,
      icon_active: message_icon_active,
      title: t("chat.text.chat"),
      path: "/chat",
    },
    {
      icon: contact_icon,
      icon_active: contact_icon_active,
      title: t("contact.text.contact"),
      path: "/contact",
    },
    {
      icon: nav_bar_favorites,
      icon_active: nav_bar_favorites_active,
      title: t("common.text.favorites"),
      path: "/favorites",
    },
  ];

  const profileMenuList = [
    {
      title: t("settings.text.myInfo"),
      gap: true,
      idx: 0,
    },
    {
      title: t("settings.text.accountSetting"),
      gap: true,
      idx: 1,
    },
    {
      title: t("settings.text.about"),
      gap: false,
      idx: 2,
    },
    {
      title: t("settings.text.logOut"),
      gap: false,
      idx: 3,
    },
  ];

  const profileMenuClick = (idx: number) => {
    switch (idx) {
      case 0:
        emit("OPEN_USER_CARD", {
          userID: useUserStore.getState().selfInfo.userID,
        });
        break;
      case 1:
        if (window.electronAPI?.enableCLib) {
          openPersonalSettings();
          setShowProfile(false);
          setHighlightCloseAction(false);
          return;
        }
        setHighlightCloseAction(false);
        personalSettingsRef.current?.openOverlay();
        break;
      case 2:
        if (window.electronAPI?.enableCLib) {
          openAbout();
          setShowProfile(false);
          return;
        }
        aboutRef.current?.openOverlay();
        break;
      case 3:
        tryLogout();
        break;
      default:
        break;
    }
    setShowProfile(false);
  };

  useEffect(() => {
    const handleOpenPersonalSettings = (payload?: {
      highlightCloseAction?: boolean;
    }) => {
      if (window.electronAPI?.enableCLib) {
        openPersonalSettings({ highlightCloseAction: payload?.highlightCloseAction });
      } else {
        setHighlightCloseAction(Boolean(payload?.highlightCloseAction));
        personalSettingsRef.current?.openOverlay();
      }
      setShowProfile(false);
    };
    emitter.on("OPEN_PERSONAL_SETTINGS", handleOpenPersonalSettings);
    return () => {
      emitter.off("OPEN_PERSONAL_SETTINGS", handleOpenPersonalSettings);
    };
  }, []);

  const tryLogout = () => {
    modal.confirm({
      title: t("settings.text.logOut"),
      content: t("settings.toast.confirmlogOut"),
      onOk: async () => {
        try {
          await userLogout();
        } catch (error) {
          feedbackToast({ error });
        }
      },
    });
  };

  const customUpload = async ({ file }: { file: File }) => {
    const resizedFile = await resizeFile(file);
    try {
      const {
        data: { url },
      } = await uploadFile(resizedFile);
      const newInfo = {
        faceURL: url,
      };
      await updateProfile(newInfo);
      updateSelfInfo(newInfo);
    } catch (error) {
      feedbackToast({ error: t("settings.toast.updateAvatarFailed") });
    }
  };

  const ProfileContent = (
    <div className="w-72 px-2.5 pt-5.5 pb-3">
      <div className="mb-4.5 ml-3 flex items-center">
        <Upload
          accept=".jpeg,.jpg,.png,.webp"
          // openFileDialogOnClick={false}
          showUploadList={false}
          customRequest={customUpload as any}
        >
          <div className={styles["avatar-wrapper"]}>
            <OIMAvatar src={selfInfo.faceURL} text={selfInfo.nickname} />
            <div className={styles["mask"]}>
              <img src={change_avatar} width={19} alt="" />
            </div>
          </div>
        </Upload>
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 truncate text-base font-medium">{selfInfo.nickname}</div>
        </div>
      </div>
      {profileMenuList.map((menu) => (
        <div key={menu.idx}>
          <div
            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-4 hover:bg-(--primary-active)"
            onClick={() => profileMenuClick(menu.idx)}
          >
            <div>{menu.title}</div>
            <RightOutlined rev={undefined} />
          </div>
          {menu.gap && (
            <div className="px-3">
              <Divider className="my-1.5 border-(--gap-text)" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Sider
      className="no-mobile border-r border-(--gap-text) bg-[#F4F4F4]!"
      width={60}
      theme="light"
    >
      <div className="mt-6 flex flex-col items-center">
        <Popover
          content={ProfileContent}
          trigger="click"
          placement="rightBottom"
          overlayClassName="profile-popover"
          title={null}
          arrow={false}
          open={showProfile}
          onOpenChange={(vis) => setShowProfile(vis)}
        >
          <OIMAvatar
            className="mb-6 cursor-pointer"
            src={selfInfo.faceURL}
            text={selfInfo.nickname}
          />
        </Popover>

        {navList.map((nav) => (
          <NavItem nav={nav} key={nav.path} />
        ))}
      </div>
      <PersonalSettings
        ref={personalSettingsRef}
        highlightCloseAction={highlightCloseAction}
      />
      <About ref={aboutRef} />
    </Sider>
  );
});

export default LeftNavBar;
