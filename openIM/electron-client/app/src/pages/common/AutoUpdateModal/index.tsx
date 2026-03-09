import { RocketOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { useLatest } from "ahooks";
import { Button, Input, Modal, Progress, Space } from "antd";
import {
  forwardRef,
  ForwardRefRenderFunction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { modal } from "@/AntdGlobalComp";
import { checkUpdatePkg } from "@/api/services/update";
import type { AutoUpdateVersion } from "@/api/types/auto-update";
import { APP_VERSION } from "@/config";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { feedbackToast } from "@/utils/feedback";
import emitter, {
  type AppUpdateCheckPayload,
  type AppUpdateCheckSource,
} from "@/utils/window/events";

enum UpdateStep {
  Wating,
  Downloading,
  Applying,
  Failed,
}

const UPDATE_CHECK_DELAY_MS = 5000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const hasUpdate = (newVersion: string) => {
  const currentVersion = APP_VERSION.slice(1).split("+");
  const newVersionArr = newVersion.split("+");
  const currentVersionNum = Number(currentVersion[0].replace(new RegExp(/\./g), ""));
  const newVersionNum = Number(newVersionArr[0].replace(new RegExp(/\./g), ""));

  if (currentVersionNum === newVersionNum) {
    const currentBuildVersionNum = Number(currentVersion[1] ?? 0);
    const newBuildVersionNum = Number(newVersionArr[1] ?? 0);

    return newBuildVersionNum > currentBuildVersionNum;
  }
  return newVersionNum > currentVersionNum;
};

const AutoUpdateModal: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
  const [step, setStep] = useState<UpdateStep>(UpdateStep.Wating);
  const [progress, setProgress] = useState<number>(0);
  const [versionInfo, setVersionInfo] = useState<AutoUpdateVersion>(
    {} as AutoUpdateVersion,
  );
  const latestVersionInfo = useLatest(versionInfo);
  const { isOverlayOpen, openOverlay, closeOverlay } = useOverlayVisible(ref);
  const latestIsOverlayOpen = useLatest(isOverlayOpen);
  const ignoreAutoCheckRef = useRef(false);
  const lastPromptSourceRef = useRef<AppUpdateCheckSource>("startup");
  const checkingRef = useRef(false);
  const updateTimerRef = useRef<number | null>(null);

  const { t } = useTranslation();
  const { mutateAsync: checkUpdatePkgReq } = useMutation({
    mutationFn: checkUpdatePkg,
  });

  const stopUpdateTimer = useCallback(() => {
    if (!updateTimerRef.current) return;
    clearInterval(updateTimerRef.current);
    updateTimerRef.current = null;
  }, []);

  const checkUpdate = useCallback(
    async (payload: AppUpdateCheckPayload = {}) => {
      if (!window.electronAPI) return;
      const source = payload.source ?? "startup";
      const force = payload.force ?? source === "manual";
      if (!force && ignoreAutoCheckRef.current && source !== "manual") {
        return;
      }
      if (checkingRef.current || latestIsOverlayOpen.current) {
        return;
      }
      checkingRef.current = true;
      try {
        const { data } = await checkUpdatePkgReq();
        const version = data?.version;
        if (version && hasUpdate(version.version)) {
          lastPromptSourceRef.current = source;
          setVersionInfo({ ...version });
          openOverlay();
        } else if (source === "manual") {
          feedbackToast({ msg: t("common.toast.latestVersion") });
        }
      } catch (error) {
        console.warn("checkUpdatePkg failed", error);
      } finally {
        checkingRef.current = false;
      }
    },
    [latestIsOverlayOpen, openOverlay],
  );

  const startUpdateTimer = useCallback(() => {
    if (updateTimerRef.current) return;
    updateTimerRef.current = window.setInterval(() => {
      checkUpdate({ source: "timer" });
    }, UPDATE_CHECK_INTERVAL_MS);
  }, [checkUpdate]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const updateDownloadProgressHandler = (_: string, progress: number) => {
      setProgress(progress);
    };
    const updateDownloadSuccessHandler = async (_: string, pkgPath: string) => {
      setStep(UpdateStep.Applying);
      try {
        const success =
          (await window.electronAPI?.appUpdate({
            isHot: latestVersionInfo.current.hot,
            pkgPath,
          })) ?? false;
        if (!success) {
          setStep(UpdateStep.Failed);
          return;
        }
        setVersionInfo((prev) => ({ ...prev }));
      } catch (error) {
        console.log(error);
        setStep(UpdateStep.Failed);
      }
    };
    const udpateDownloadFailedHandler = () => {
      setStep(UpdateStep.Failed);
    };
    const unsubscribeUpdateDownloadProgress =
      window.electronAPI?.onUpdateDownloadProgress(updateDownloadProgressHandler);
    const unsubscribeUpdateDownloadSuccess =
      window.electronAPI?.onUpdateDownloadSuccess(updateDownloadSuccessHandler);
    const unsubscribeUpdateDownloadFailed = window.electronAPI?.onUpdateDownloadFailed(
      udpateDownloadFailedHandler,
    );
    const startupTimer = window.setTimeout(() => {
      checkUpdate({ source: "startup" });
    }, UPDATE_CHECK_DELAY_MS);
    const handleCheckUpdate = (payload: AppUpdateCheckPayload) => {
      const source = payload?.source ?? "manual";
      const force = payload?.force;
      if (!force && ignoreAutoCheckRef.current && source !== "manual") {
        return;
      }
      if (source === "login") {
        startUpdateTimer();
      }
      checkUpdate({ source, force });
    };
    emitter.on("CHECK_APP_UPDATE", handleCheckUpdate);
    return () => {
      unsubscribeUpdateDownloadProgress?.();
      unsubscribeUpdateDownloadSuccess?.();
      unsubscribeUpdateDownloadFailed?.();
      clearTimeout(startupTimer);
      stopUpdateTimer();
      emitter.off("CHECK_APP_UPDATE", handleCheckUpdate);
    };
  }, [checkUpdate, startUpdateTimer, stopUpdateTimer]);

  const startDownload = () => {
    if (step === UpdateStep.Applying) {
      window.electronAPI?.hotRelaunch();
      return;
    }
    setStep(UpdateStep.Downloading);
    window.electronAPI?.startDownload(`${versionInfo.url}?is-update=true`);
  };

  const cancelUpdate = () => {
    const markStartupIgnore = () => {
      if (lastPromptSourceRef.current !== "startup") return;
      ignoreAutoCheckRef.current = true;
      stopUpdateTimer();
    };
    const closeModal = () => {
      setStep(UpdateStep.Wating);
      closeOverlay();
    };
    if (step === UpdateStep.Downloading) {
      modal.confirm({
        content: t("common.toast.isCancelUpdate"),
        onOk: () => {
          window.electronAPI?.cancelDownload(`${versionInfo.url}?is-update=true`);
          markStartupIgnore();
          closeModal();
        },
      });
      return;
    }
    markStartupIgnore();
    closeModal();
  };

  const getSubTitle = () => {
    if (step === UpdateStep.Wating) {
      return t("common.toast.updateVersion", { version: versionInfo.version });
    }
    if (step === UpdateStep.Applying) {
      return versionInfo.hot
        ? t("common.toast.applyUpdateSuccess")
        : t("common.toast.applyDownloadSuccess");
    }
    return t("system.toast.downloadFailed");
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <RocketOutlined size={20} className="text-[#0089ff]" />
          <div className="ml-2">{t("common.toast.appUpdate")}</div>
        </div>
      }
      footer={null}
      open={isOverlayOpen}
      closable={false}
      maskClosable={false}
      width={332}
      centered
      onCancel={closeOverlay}
      destroyOnClose
    >
      <div>
        {step !== UpdateStep.Downloading ? (
          <div>{getSubTitle()}</div>
        ) : (
          <div className="flex flex-col pr-4">
            <div>{t("common.toast.downloading")}</div>
            <Progress
              percent={progress}
              strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }}
            />
          </div>
        )}

        <div className="my-2">{t("common.toast.updateContent")}</div>
        <Input.TextArea
          autoSize={{
            minRows: 4,
            maxRows: 4,
          }}
          readOnly
          value={versionInfo.text}
        />
      </div>
      {!versionInfo.hot && step === UpdateStep.Applying ? null : (
        <div className="flex flex-row-reverse pt-3">
          <Space>
            {!versionInfo?.force && (
              <Button onClick={cancelUpdate}>
                {t(
                  step === UpdateStep.Applying
                    ? "common.toast.later"
                    : "common.text.cancel",
                )}
              </Button>
            )}
            <Button
              disabled={step === UpdateStep.Downloading}
              type="primary"
              onClick={startDownload}
            >
              {t(
                step === UpdateStep.Failed
                  ? "common.text.retry"
                  : "common.text.confirm",
              )}
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default forwardRef(AutoUpdateModal);
