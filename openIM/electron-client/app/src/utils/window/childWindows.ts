import { ChildWindowOptions } from "@/types/common";
import { getChatToken, getIMToken } from "@/utils/storage";
import { RouteTravel } from "@/pages/common/MomentsModal";
import { t } from "i18next";
import { useUserStore } from "@/store";

type PersonalSettingsOptions = {
  highlightCloseAction?: boolean;
};

export const openPersonalSettings = async (options?: PersonalSettingsOptions) => {
  const precheck = JSON.stringify({
    token: await getChatToken(),
    highlightCloseAction: options?.highlightCloseAction,
  });
  const windowOptions: ChildWindowOptions = {
    title: t("settings.text.personalSetting"),
    width: 600,
    height: 668,
    minWidth: 600,
    minHeight: 668,
    frame: false,
  };
  window.electronAPI?.openChildWindow({
    arg: "third/personal-settings",
    key: "personal-settings",
    search: `precheck=${precheck}`,
    options: windowOptions,
  });
};

export const openGlobalSearch = async () => {
  const precheck = JSON.stringify({
    token: await getChatToken(),
    user: useUserStore.getState().selfInfo,
    isOrganizationMember: useUserStore.getState().organizationInfoList.length > 0,
  });
  const options: ChildWindowOptions = {
    title: t("common.text.search"),
    width: 600,
    height: 668,
    minWidth: 600,
    minHeight: 668,
    frame: false,
  };
  window.electronAPI?.openChildWindow({
    arg: "third/global-search",
    key: "global-search",
    search: `precheck=${precheck}`,
    options,
  });
};

export const openMoments = async (user: RouteTravel) => {
  const precheck = JSON.stringify({
    token: await getChatToken(),
    user,
  });
  const options: ChildWindowOptions = {
    title: t("contact.text.moments"),
    width: 550,
    height: 668,
    minWidth: 550,
    minHeight: 668,
    resizable: false,
    frame: false,
  };
  window.electronAPI?.openChildWindow({
    arg: "third/moments",
    key: "moments",
    search: `precheck=${precheck}`,
    options,
  });
};

export const openAbout = async () => {
  const precheck = JSON.stringify({
    imToken: await getIMToken(),
  });
  const options: ChildWindowOptions = {
    title: t("settings.text.about"),
    width: 360,
    height: 410,
    resizable: false,
    frame: false,
  };
  window.electronAPI?.openChildWindow({
    arg: "third/about",
    key: "about",
    search: `precheck=${precheck}`,
    options,
  });
};

export const openChooseContact = (precheck?: string) => {
  const options: ChildWindowOptions = {
    title: t("system.text.selectUser"),
    width: 680,
    height: 680,
    resizable: false,
    frame: false,
  };
  window.electronAPI?.openChildWindow({
    arg: `third/choose-contact`,
    key: "choose-contact",
    search: precheck ? `precheck=${precheck}` : undefined,
    options,
  });
};
