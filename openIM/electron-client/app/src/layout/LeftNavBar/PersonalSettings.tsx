import { CloseOutlined, RightOutlined } from "@ant-design/icons";
import { AddFriendPermission, MessageReceiveOptType } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { Button, Checkbox, Divider, Modal, Spin } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { modal } from "@/AntdGlobalComp";
import { errorHandle } from "@/api/core/errors";
import {
  BusinessAllowType,
  BusinessUserInfo,
  deregister,
  updateBusinessUserInfo,
} from "@/api/services/user";
import i18n from "@/i18n";
import { useMessageStore, useUserStore } from "@/store";
import { LocaleString } from "@/store/type";
import type { CachePathInfo } from "@/types/globalExpose";
import { feedbackToast } from "@/utils/feedback";
import { broadcastCallStoreFunction } from "@/utils/window/broadcast";

import { OverlayVisibleHandle, useOverlayVisible } from "../../hooks/useOverlayVisible";
import { IMSDK } from "../MainContentWrap";
import BlackList from "./BlackList";
import ChangePassword from "./ChangePassword";

type PersonalSettingsProps = {
  highlightCloseAction?: boolean;
};

const PersonalSettings: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  PersonalSettingsProps
> = (props, ref) => {
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      onCancel={closeOverlay}
      centered
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={600}
      className="no-padding-modal max-w-[70vw]"
      maskTransitionName=""
    >
      <PersonalSettingsContent
        closeOverlay={closeOverlay}
        highlightCloseAction={props.highlightCloseAction}
      />
    </Modal>
  );
};

export default memo(forwardRef(PersonalSettings));

export const PersonalSettingsContent = ({
  closeOverlay,
  highlightCloseAction,
}: {
  closeOverlay?: () => void;
  highlightCloseAction?: boolean;
}) => {
  const [addFriendPermissionUpdating, setAddFriendPermissionUpdating] = useState(false);
  const selfInfo = useUserStore((state) => state.selfInfo);
  const localeStr = useUserStore((state) => state.appSettings.locale);
  const closeAction = useUserStore((state) => state.appSettings.closeAction);
  const updateAppSettings = useUserStore((state) => state.updateAppSettings);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);
  const userLogout = useUserStore((state) => state.userLogout);
  const clearPreviewList = useMessageStore((state) => state.clearPreviewList);

  const backListRef = useRef<OverlayVisibleHandle>(null);
  const changePasswordRef = useRef<OverlayVisibleHandle>(null);
  const [cachePaths, setCachePaths] = useState<CachePathInfo | null>(null);
  const [cachePathUpdating, setCachePathUpdating] = useState(false);
  const [closeActionHighlighting, setCloseActionHighlighting] = useState(false);
  const closeActionRef = useRef<HTMLDivElement>(null);

  const { isPending: businessSettingUpdating, mutate: updateBusinessSetting } =
    useMutation({
      mutationFn: updateBusinessUserInfo,
      onError: errorHandle,
    });

  const updateSelfInfoWithMainWindow = (info: Partial<BusinessUserInfo>) => {
    if (window.electronAPI) {
      broadcastCallStoreFunction({
        store: "user",
        functionName: "updateSelfInfo",
        args: [info],
      });
    }
    updateSelfInfo(info);
  };

  const clearPreviewListWithMainWindow = () => {
    if (window.electronAPI) {
      broadcastCallStoreFunction({
        store: "message",
        functionName: "clearPreviewList",
        args: [],
      });
    } else {
      clearPreviewList();
    }
  };

  const localeChange = (checked: boolean, locale: LocaleString) => {
    if (!checked) return;
    window.electronAPI?.changeLanguage(locale);
    i18n.changeLanguage(locale);
    updateAppSettings({
      locale,
    });
  };

  const closeActionChange = (checked: boolean, action: "miniSize" | "quit") => {
    if (checked) {
      window.electronAPI?.setKeyStore({
        key: "closeAction",
        data: action,
      });
      updateAppSettings({
        closeAction: action,
      });
    }
  };

  const tryClearChatLogs = () => {
    modal.confirm({
      title: t("chat.toast.confirmClearChatHistory"),
      icon: null,
      centered: true,
      className: "clear-chat-confirm",
      onOk: async () => {
        try {
          await IMSDK.deleteAllMsgFromLocalAndSvr();
          clearPreviewListWithMainWindow();
        } catch (error) {
          feedbackToast({ error });
        }
      },
    });
  };

  const deregisterAccount = () => {
    modal.confirm({
      title: t("settings.toast.deregisterAccount"),
      content: (
        <div className="flex items-end">
          <div>{t("settings.toast.confirmDeregisterAccount")}</div>
          <div className="ml-1 text-xs text-(--sub-text)">
            {t("settings.toast.deregisterDescription")}
          </div>
        </div>
      ),
      onOk: async () => {
        try {
          await deregister();
          feedbackToast({ msg: t("settings.toast.deregisterSuccess") });
          await userLogout();
        } catch (error) {
          feedbackToast({ error });
        }
      },
    });
  };

  const toBlackList = () => {
    backListRef.current?.openOverlay();
  };

  const toChangePassword = () => {
    changePasswordRef.current?.openOverlay();
  };

  const businessSettingsUpdate = (vaule: boolean, key: keyof BusinessUserInfo) => {
    const updateInfo: Partial<BusinessUserInfo> = {};
    if (key === "allowBeep") {
      updateInfo[key] = vaule ? BusinessAllowType.Allow : BusinessAllowType.NotAllow;
    }
    if (key === "globalRecvMsgOpt") {
      updateInfo[key] = vaule
        ? MessageReceiveOptType.NotNotify
        : MessageReceiveOptType.Normal;
    }

    updateBusinessSetting(updateInfo, {
      onSuccess: () => {
        updateSelfInfoWithMainWindow(updateInfo);
      },
    });
  };

  const updateAddFriendPermission = async (
    checked: boolean,
    value: AddFriendPermission,
  ) => {
    setAddFriendPermissionUpdating(true);
    try {
      const newPermission = checked ? value : AddFriendPermission.AddFriendAllowed;
      await IMSDK.setSelfInfo({
        addFriendPermission: newPermission,
      });
      updateSelfInfoWithMainWindow({ addFriendPermission: newPermission });
    } catch (error) {
      feedbackToast({ error });
    }
    setAddFriendPermissionUpdating(false);
  };

  useEffect(() => {
    if (!highlightCloseAction) return;
    setCloseActionHighlighting(true);
    closeActionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setCloseActionHighlighting(false), 2200);
    return () => clearTimeout(timer);
  }, [highlightCloseAction]);

  useEffect(() => {
    if (!window.electronAPI?.getCachePathInfo) return;
    window.electronAPI
      .getCachePathInfo()
      .then((info) => setCachePaths(info))
      .catch((error) => {
        console.error("getCachePathInfo failed", error);
      });
  }, []);

  const changeCacheDirectory = async () => {
    if (
      !window.electronAPI?.selectCacheDirectory ||
      !window.electronAPI?.updateCacheBasePath
    ) {
      return;
    }
    setCachePathUpdating(true);
    try {
      const dialogRes = await window.electronAPI.selectCacheDirectory();
      if (dialogRes.canceled || !dialogRes.filePaths?.length) {
        setCachePathUpdating(false);
        return;
      }
      const nextPath = dialogRes.filePaths[0];
      const result = await window.electronAPI.updateCacheBasePath({
        basePath: nextPath,
        userID: selfInfo.userID,
      });
      if (result?.success) {
        if (result.data) setCachePaths(result.data);
        feedbackToast({ msg: t("settings.toast.cachePathUpdated") });
      } else {
        feedbackToast({
          error: new Error(
            result?.message ?? t("settings.toast.cachePathUpdateFailed"),
          ),
        });
      }
    } catch (error) {
      feedbackToast({ error, msg: t("settings.toast.cachePathUpdateFailed") });
    }
    setCachePathUpdating(false);
  };

  return (
    <div className="flex h-full flex-col bg-(--chat-bubble)">
      <BlackList ref={backListRef} />
      <ChangePassword ref={changePasswordRef} />
      <div className="app-drag flex items-center justify-between bg-(--gap-text) p-5">
        <span className="text-base font-medium">
          {t("settings.text.accountSetting")}
        </span>
        <CloseOutlined
          className="app-no-drag cursor-pointer text-[#8e9aaf]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6">
          <div>
            <div className="pt-4 pb-5 text-base font-medium">
              {t("settings.text.personalSetting")}
            </div>
            <div className="pb-8 pl-1">
              <div className="pb-3 font-medium">
                {t("settings.text.chooseLanguage")}
              </div>
              <div>
                <Checkbox
                  checked={localeStr === "zh-CN"}
                  className="mr-4"
                  onChange={(e) => localeChange(e.target.checked, "zh-CN")}
                >
                  简体中文
                </Checkbox>
                <Checkbox
                  checked={localeStr === "en-US"}
                  onChange={(e) => localeChange(e.target.checked, "en-US")}
                >
                  English
                </Checkbox>
              </div>
            </div>
            {Boolean(window.electronAPI) && (
              <div
                ref={closeActionRef}
                className={clsx(
                  "rounded-md pb-8 pl-1 transition duration-300",
                  closeActionHighlighting && "ring-2 ring-[#5b8ff9]",
                )}
              >
                <div className="pb-3 font-medium">
                  {t("settings.text.closeButtonEvent")}
                </div>
                <div>
                  <Checkbox
                    checked={closeAction === "quit"}
                    className="mr-4"
                    onChange={(e) => closeActionChange(e.target.checked, "quit")}
                  >
                    {t("settings.text.exitApplication")}
                  </Checkbox>
                  <Checkbox
                    checked={closeAction === "miniSize"}
                    onChange={(e) => closeActionChange(e.target.checked, "miniSize")}
                  >
                    {t("settings.text.minimize")}
                  </Checkbox>
                </div>
              </div>
            )}
            {Boolean(window.electronAPI) && (
              <div className="pb-8 pl-1">
                <div className="pb-3 font-medium">
                  {t("settings.text.cacheDirectory")}
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-(--sub-text)">
                    {t("settings.text.cacheDirectoryDesc")}
                  </div>
                  <div className="rounded-md bg-(--gap-text) px-3 py-2 text-xs leading-6 break-all text-(--sub-text)">
                    <div>
                      <span className="font-medium">
                        {t("settings.text.cacheRoot")}:
                      </span>{" "}
                      {cachePaths?.cacheBasePath || t("settings.text.notAvailable")}
                    </div>
                    <div className="text-[11px] text-(--sub-text)">
                      ({t("settings.text.logsDirectory")} &{" "}
                      {t("settings.text.userCacheDirectory")})
                    </div>
                  </div>
                  <Button
                    type="primary"
                    className="w-fit"
                    onClick={changeCacheDirectory}
                    loading={cachePathUpdating}
                  >
                    {t("settings.text.changeCacheDirectory")}
                  </Button>
                </div>
              </div>
            )}
            <div className="pb-8 pl-1">
              <div className="pb-3 font-medium">{t("settings.text.messageToast")}</div>
              <Spin spinning={businessSettingUpdating}>
                <div>
                  <Checkbox
                    className="mr-4"
                    checked={selfInfo.allowBeep === BusinessAllowType.Allow}
                    onChange={(e) =>
                      businessSettingsUpdate(e.target.checked, "allowBeep")
                    }
                  >
                    {t("settings.text.messageAllowBeep")}
                  </Checkbox>
                  <Checkbox
                    checked={
                      selfInfo.globalRecvMsgOpt === MessageReceiveOptType.NotNotify
                    }
                    onChange={(e) =>
                      businessSettingsUpdate(e.target.checked, "globalRecvMsgOpt")
                    }
                  >
                    {t("settings.text.messageNotNotify")}
                  </Checkbox>
                </div>
              </Spin>
            </div>
            <div className="pb-8 pl-1">
              <div className="pb-3 font-medium">
                {t("settings.text.addFriendsSetting")}
              </div>
              <div>
                <Spin spinning={addFriendPermissionUpdating}>
                  <Checkbox
                    className="mr-4"
                    checked={
                      selfInfo.addFriendPermission ===
                      AddFriendPermission.AddFriendDenied
                    }
                    onChange={(e) =>
                      updateAddFriendPermission(
                        e.target.checked,
                        AddFriendPermission.AddFriendDenied,
                      )
                    }
                  >
                    {t("settings.text.refuseAddFriend")}
                  </Checkbox>

                  <Checkbox
                    checked={
                      selfInfo.addFriendPermission ===
                      AddFriendPermission.AddFriendAllowedNoReview
                    }
                    onChange={(e) =>
                      updateAddFriendPermission(
                        e.target.checked,
                        AddFriendPermission.AddFriendAllowedNoReview,
                      )
                    }
                  >
                    {t("settings.text.notVerifyAddFriend")}
                  </Checkbox>
                </Spin>
              </div>
            </div>
          </div>
        </div>
        <Divider className="m-0 border-4 border-(--gap-text)" />
        <div
          className="flex cursor-pointer items-center justify-between px-6 py-4"
          onClick={toBlackList}
        >
          <div className="text-base font-medium">{t("settings.text.blackList")}</div>
          <RightOutlined rev={undefined} />
        </div>
        <Divider className="m-0 border-4 border-(--gap-text)" />
        <div
          className="flex cursor-pointer items-center justify-between px-6 py-4"
          onClick={toChangePassword}
        >
          <div className="text-base font-medium">
            {t("settings.text.changePassword")}
          </div>
          <RightOutlined rev={undefined} />
        </div>
        <Divider className="m-0 border-4 border-(--gap-text)" />
      </div>
    </div>
  );
};
