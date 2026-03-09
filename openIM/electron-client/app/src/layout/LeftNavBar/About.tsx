import { CloseOutlined, RightOutlined } from "@ant-design/icons";
import { CbEvents, WSEvent } from "@openim/wasm-client-sdk";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Divider, Form, Input, Modal, Space, Spin } from "antd";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useEffect, useState } from "react";
import { useCopyToClipboard } from "react-use";

import logo from "@/assets/images/profile/logo.svg";
import { APP_NAME, APP_VERSION, SDK_VERSION } from "@/config";
import { feedbackToast } from "@/utils/feedback";
import { broadcastCheckAppUpdate } from "@/utils/window/broadcast";
import { emit } from "@/utils/window/events";

import { OverlayVisibleHandle, useOverlayVisible } from "../../hooks/useOverlayVisible";
import { IMSDK } from "../MainContentWrap";

const About: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (_, ref) => {
  const [form] = Form.useForm();

  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      centered
      onCancel={closeOverlay}
      afterClose={() => form.resetFields()}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={360}
      className="no-padding-modal"
      maskTransitionName=""
    >
      <AboutContent closeOverlay={closeOverlay} />
    </Modal>
  );
};

export default memo(forwardRef(About));

export const AboutContent = ({ closeOverlay }: { closeOverlay?: () => void }) => {
  const { modal } = App.useApp();
  const [progress, setProgress] = useState(0);

  const [_, copyToClipboard] = useCopyToClipboard();

  const { mutateAsync: uploadLogs, isPending } = useMutation<
    unknown,
    unknown,
    Parameters<typeof IMSDK.uploadLogs>[0]
  >({
    mutationFn: (params) => IMSDK.uploadLogs(params),
  });

  const tryLogReport = async (line: number) => {
    try {
      await uploadLogs({ line, ex: "" });
      feedbackToast({
        msg: t("system.toast.uploadSuccess"),
      });
    } catch (error) {
      feedbackToast({
        msg: t("system.toast.uploadFailed"),
        error: error,
      });
    }
    setProgress(0);
  };

  useEffect(() => {
    const uploadHandler = ({
      data: { current, size },
    }: WSEvent<{ current: number; size: number }>) => {
      const progress = (current / size) * 100;
      console.log("OnUploadLogsProgress", Number(progress.toFixed(0)), current, size);
      setProgress(Number(progress.toFixed(0)));
    };
    IMSDK.on(CbEvents.OnUploadLogsProgress, uploadHandler);
    return () => {
      IMSDK.off(CbEvents.OnUploadLogsProgress, uploadHandler);
    };
  }, []);

  const Modal = ({ close }: { close: () => void }) => {
    const [line, setLine] = useState(100);
    return (
      <div className="flex w-75 flex-col p-6">
        <Input
          addonBefore="Line:"
          value={line}
          onChange={(e) => {
            setLine(Number(e.target.value));
          }}
          type="number"
        />
        <Space className="mt-4 ml-auto">
          <Button onClick={() => close()}>{t("common.text.cancel")}</Button>
          <Button
            type="primary"
            onClick={() => {
              tryLogReport(line);
              close();
            }}
          >
            {t("common.text.confirm")}
          </Button>
        </Space>
      </div>
    );
  };

  const openSelectLine = () => {
    const current = modal.info({
      title: null,
      icon: null,
      footer: null,
      width: 300,
      className: "no-padding-modal",
      centered: true,
      maskTransitionName: "",
      content: <Modal close={() => current.destroy()} />,
    });
  };

  const handleCopy = () => {
    copyToClipboard(`${`${APP_NAME} ${APP_VERSION}`}/${SDK_VERSION}`);
    feedbackToast({ msg: t("common.toast.copySuccess") });
  };

  const handleCheckUpdate = () => {
    if (window.electronAPI?.enableCLib) {
      broadcastCheckAppUpdate({ source: "manual", force: true }, "main");
      return;
    }
    emit("CHECK_APP_UPDATE", { source: "manual", force: true });
  };

  return (
    <Spin spinning={isPending} tip={`${progress}%`}>
      <div className="bg-(--chat-bubble)">
        <div className="app-drag flex items-center justify-between bg-(--gap-text) p-5">
          <span className="text-base font-medium">{t("settings.text.about")}</span>
          <CloseOutlined
            className="app-no-drag cursor-pointer text-[#8e9aaf]"
            rev={undefined}
            onClick={closeOverlay}
          />
        </div>
        <div className="flex flex-col items-center justify-center">
          <img className="mt-7 mb-2" width={56} src={logo} alt="" />
          <div
            className="mb-5 flex cursor-pointer flex-col items-center"
            onClick={handleCopy}
          >
            <div>{`${APP_NAME} ${APP_VERSION}`}</div>
            <div>{SDK_VERSION}</div>
          </div>
        </div>

        <Divider className="m-0 border border-(--gap-text)" />

        {window.electronAPI && (
          <>
            <div
              className="flex cursor-pointer items-center justify-between border-b border-(--gap-text) px-3 py-2"
              onClick={handleCheckUpdate}
            >
              <div>{t("settings.text.checkNewVersion")}</div>
              <RightOutlined rev={undefined} />
            </div>
            <div
              className="flex cursor-pointer items-center justify-between border-b border-(--gap-text) px-3 py-2"
              onClick={() => tryLogReport(0)}
            >
              <div>{t("settings.text.reportLog")}</div>
              <RightOutlined rev={undefined} />
            </div>
            <div
              className="flex cursor-pointer items-center justify-between border-b border-(--gap-text) px-3 py-2"
              onClick={openSelectLine}
            >
              <div>{t("settings.text.reportSpecificLog")}</div>
              <RightOutlined rev={undefined} />
            </div>
            <div
              className="flex cursor-pointer items-center justify-between px-3 py-2"
              onClick={() => window.electronAPI?.showLogsInFinder()}
            >
              <div>{t("settings.text.viewingLocalLogs")}</div>
              <RightOutlined rev={undefined} />
            </div>
          </>
        )}
      </div>
    </Spin>
  );
};
