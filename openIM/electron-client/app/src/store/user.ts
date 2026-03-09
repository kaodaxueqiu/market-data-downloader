import { t } from "i18next";
import { create } from "zustand";

import { getMomentsUnreadCount } from "@/api/services/moments";
import { getOrgnizationInfo, OrganizationInfo } from "@/api/services/organization";
import {
  BusinessUserInfo,
  getBusinessUserInfoWithDepartment,
} from "@/api/services/user";
import { IMSDK } from "@/layout/MainContentWrap";
import router from "@/routes";
import {
  getCacheRecordSync,
  mergeCacheRecord,
  setCacheRecord,
} from "@/utils/cache/cacheStore";
import { feedbackToast } from "@/utils/feedback";
import { clearIMProfile, getLocale, setLocale } from "@/utils/storage";
import { broadcastUserLogout } from "@/utils/window/broadcast";

import { useContactStore } from "./contact";
import { useConversationStore } from "./conversation";
import { AppSettings, IMConnectState, UserStore } from "./type";

export const useUserStore = create<UserStore>()((set, get) => ({
  syncState: "success",
  progress: 0,
  reinstall: true,
  isLogining: false,
  connectState: "success",
  selfInfo: {} as BusinessUserInfo,
  organizationInfoList: [] as OrganizationInfo[],
  appSettings: {
    locale: getLocale(),
    closeAction: "quit",
  },
  imageCache: {} as Record<string, string>,
  workMomentsUnreadCount: 0,
  updateSyncState: (syncState: IMConnectState) => {
    set({ syncState });
  },
  updateProgressState: (progress: number) => {
    set({ progress });
  },
  updateReinstallState: (reinstall: boolean) => {
    set({ reinstall });
  },
  updateIsLogining: (isLogining: boolean) => {
    set({ isLogining });
  },
  updateConnectState: (connectState: IMConnectState) => {
    set({ connectState });
  },
  refreshOrganizationList: async () => {
    const userID = get().selfInfo.userID;
    if (!userID) return;

    try {
      const users = await getBusinessUserInfoWithDepartment([userID]);
      const userInfo = users[0] ?? {};
      const joinedOrgIDs = (userInfo.members ?? [])
        .map((m) => m.department?.organizationID)
        .filter((id): id is string => Boolean(id));
      const memberOrgIDs = [...new Set(joinedOrgIDs)];

      set((state) => ({
        selfInfo: { ...state.selfInfo, ...userInfo },
      }));

      if (memberOrgIDs.length === 0) {
        set({ organizationInfoList: [] });
        return;
      }

      const { data: orgInfo } = await getOrgnizationInfo();
      const allOrgs = orgInfo?.organizations?.length
        ? orgInfo.organizations
        : orgInfo?.name ? [orgInfo] : [];
      const filteredOrgs = allOrgs.filter((org) =>
        memberOrgIDs.includes(org.organizationID),
      );
      set({ organizationInfoList: filteredOrgs });
    } catch (error) {
      console.error("refresh organization list err", error);
    }
  },
  getSelfInfoByReq: async () => {
    try {
      const { data } = await IMSDK.getSelfUserInfo();
      set(() => ({ selfInfo: data as unknown as BusinessUserInfo }));

      try {
        const users = await getBusinessUserInfoWithDepartment([data.userID]);
        const userInfo = users[0] ?? {};
        set((state) => ({
          selfInfo: { ...state.selfInfo, ...userInfo },
        }));
      } catch (error) {
        console.error("get business user info err", error);
      }

      await get().refreshOrganizationList();
    } catch (error) {
      feedbackToast({ error, msg: t("system.toast.getSelfInfoFailed") });
      broadcastUserLogout();
    }
  },
  updateSelfInfo: (info: Partial<BusinessUserInfo>) => {
    set((state) => ({ selfInfo: { ...state.selfInfo, ...info } }));
  },
  updateAppSettings: (settings: Partial<AppSettings>) => {
    if (settings.locale) {
      setLocale(settings.locale);
    }
    set((state) => ({ appSettings: { ...state.appSettings, ...settings } }));
  },
  userLogout: async (force?: boolean) => {
    try {
      if (!force) await IMSDK.logout();
    } catch (error) {
      console.error("IMSDK logout err", error);
    }
    clearIMProfile();
    set({ selfInfo: {} as BusinessUserInfo, progress: 0, organizationInfoList: [] });
    useContactStore.getState().clearContactStore();
    useConversationStore.getState().clearConversationStore();
    window.electronAPI?.updateUnreadCount(0);
    window.electronAPI?.clearChildWindows();
    router.navigate("/login");
  },
  getWorkMomentsUnreadCount: async () => {
    try {
      const { data } = await getMomentsUnreadCount();
      set({ workMomentsUnreadCount: data.total });
    } catch (error) {
      console.error("get work moments unread count err");
    }
  },
  updateWorkMomentsUnreadCount: (count = 0) => {
    set({ workMomentsUnreadCount: count });
  },
  initImageCache: () => {
    const cache = getCacheRecordSync("media_cache_record");
    set(() => ({ imageCache: cache }));
  },
  addImageCache: (url: string, path: string) => {
    const newCache = mergeCacheRecord(
      "media_cache_record",
      { [url]: path },
      get().imageCache,
    );
    set(() => ({ imageCache: newCache }));
  },
  clearImageCache: () => {
    setCacheRecord("media_cache_record", {});
    set({ imageCache: {} });
  },
}));
