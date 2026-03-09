import { CloseOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Button, Divider, Form, FormInstance, Input, Modal } from "antd";
import { t } from "i18next";
import md5 from "md5";
import { forwardRef, ForwardRefRenderFunction, memo } from "react";

import { modifyPassword } from "@/api/services/auth";
import { useUserStore } from "@/store";
import { feedbackToast } from "@/utils/feedback";
import { broadcastUserLogout } from "@/utils/window/broadcast";

import { OverlayVisibleHandle, useOverlayVisible } from "../../hooks/useOverlayVisible";

interface PasswordFormData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ChangePassword: ForwardRefRenderFunction<OverlayVisibleHandle, unknown> = (
  _,
  ref,
) => {
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
      destroyOnClose
      afterClose={() => form.resetFields()}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={320}
      className="no-padding-modal"
      maskTransitionName=""
    >
      <ChangePasswordContent form={form} closeOverlay={closeOverlay} />
    </Modal>
  );
};

export default memo(forwardRef(ChangePassword));

export const ChangePasswordContent = ({
  form,
  closeOverlay,
}: {
  form?: FormInstance;
  closeOverlay?: () => void;
}) => {
  const { mutateAsync: updatePassword, isPending: passwordUpdating } = useMutation({
    mutationFn: modifyPassword,
  });

  const onFinish = (value: PasswordFormData) => {
    updatePassword({
      currentPassword: md5(value.oldPassword),
      newPassword: md5(value.newPassword),
      userID: useUserStore.getState().selfInfo.userID,
    })
      .then(() => {
        closeOverlay?.();
        feedbackToast({
          msg: t("auth.toast.updatePasswordSuccess"),
          onClose: () => {
            if (!window.electronAPI) {
              useUserStore.getState().userLogout();
            }
            broadcastUserLogout();
          },
        });
      })
      .catch((error) => {
        if (error.errDlt === "new password == current password") {
          feedbackToast({ msg: t("settings.toast.samePassword"), error });
          return;
        }
        if (error.errDlt === "current password is wrong") {
          feedbackToast({ msg: t("settings.toast.currentPassworWrong"), error });
          return;
        }
        feedbackToast({ error });
      });
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <span className="text-base font-medium">
          {t("settings.text.changePassword")}
        </span>
        <CloseOutlined
          className="app-no-drag cursor-pointer text-[#8e9aaf]!"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        className="bold-label-form"
        autoComplete="off"
      >
        <Form.Item
          label={t("settings.text.oldPassword")}
          name="oldPassword"
          className="mb-2 px-5"
          rules={[{ required: true, message: t("settings.toast.inputOldPassword") }]}
        >
          <Input.Password allowClear />
        </Form.Item>
        <Form.Item
          label={t("settings.text.newPassword")}
          name="newPassword"
          className="mb-2 px-5"
          rules={[
            {
              required: true,
              pattern: /^(?=.*[0-9])(?=.*[a-zA-Z]).{6,20}$/,
              message: t("auth.toast.passwordRules"),
            },
          ]}
        >
          <Input.Password allowClear />
        </Form.Item>
        <Form.Item
          label={t("auth.text.confirmPassword")}
          name="confirmPassword"
          className="mb-2 px-5"
          dependencies={["newPassword"]}
          rules={[
            {
              required: true,
              message: t("auth.toast.reconfirmPassword"),
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("auth.toast.passwordsDifferent")));
              },
            }),
          ]}
        >
          <Input.Password allowClear />
        </Form.Item>

        <Divider className="my-5 border border-(--gap-text)" />

        <Form.Item>
          <div className="mr-6 flex justify-end">
            <Button
              className="mr-3.5 border-0 bg-(--chat-bubble) px-6"
              onClick={closeOverlay}
            >
              {t("common.text.cancel")}
            </Button>
            <Button
              className="px-6"
              type="primary"
              htmlType="submit"
              loading={passwordUpdating}
            >
              {t("common.text.confirm")}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
};
