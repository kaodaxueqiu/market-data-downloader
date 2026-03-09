import { useMutation } from "@tanstack/react-query";
import { Button, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { t } from "i18next";
import { forwardRef, ForwardRefRenderFunction, memo, useEffect, useState } from "react";

import { errorHandle } from "@/api/core/errors";
import { BusinessUserInfo, getBusinessUserInfo, updateBusinessUserInfo } from "@/api/services/user";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { useUserStore } from "@/store";

const EditSelfInfo: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  { refreshSelfInfo: () => void }
> = ({ refreshSelfInfo }, ref) => {
  const [form] = Form.useForm();
  const selfInfo = useUserStore((state) => state.selfInfo);
  const updateSelfInfo = useUserStore((state) => state.updateSelfInfo);

  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  useEffect(() => {
    if (isOverlayOpen && selfInfo.userID) {
      getBusinessUserInfo([selfInfo.userID]).then((resp) => {
        const info = resp.data.users[0];
        if (info) {
          updateSelfInfo(info);
          form.setFieldsValue({
            ...info,
            birth: info.birth ? dayjs(info.birth) : undefined,
          });
        }
      }).catch((err) => console.error("fetch self info for edit failed", err));
    }
  }, [isOverlayOpen]);

  const { isPending, mutate } = useMutation({
    mutationFn: updateBusinessUserInfo,
    onError: errorHandle,
  });

  const onFinish = (value: BusinessUserInfo & { birth?: Dayjs }) => {
    const options: Partial<BusinessUserInfo> = {
      nickname: value.nickname,
      gender: value.gender,
      birth: value.birth ? value.birth.unix() * 1000 : 0,
    };
    mutate(options, {
      onSuccess: () => {
        updateSelfInfo(options);
        refreshSelfInfo();
        closeOverlay();
      },
    });
  };

  return (
    <Modal
      title={null}
      footer={null}
      closable={false}
      open={isOverlayOpen}
      centered
      onCancel={closeOverlay}
      destroyOnClose
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      width={484}
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div>
        <div className="flex bg-(--chat-bubble) p-5">
          <span className="text-base font-medium">{t("common.text.editInfo")}</span>
        </div>
        {isOverlayOpen && (
          <Form
            form={form}
            colon={false}
            requiredMark={false}
            labelCol={{ span: 3 }}
            onFinish={onFinish}
            className="sub-label-form p-6.5"
            autoComplete="off"
            initialValues={{
              ...selfInfo,
              birth: selfInfo.birth ? dayjs(selfInfo.birth) : undefined,
            }}
          >
            <Form.Item
              label={t("common.text.nickName")}
              name="nickname"
              rules={[{ required: true, message: t("common.toast.inputNickName") }]}
            >
              <Input maxLength={20} spellCheck={false} />
            </Form.Item>
            <Form.Item label={t("common.text.gender")} name="gender">
              <Select>
                <Select.Option value={1}>{t("common.text.man")}</Select.Option>
                <Select.Option value={2}>{t("common.text.female")}</Select.Option>
                <Select.Option value={0}>{t("common.text.unknown")}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label={t("auth.text.phoneNumber")}
              name="phoneNumber"
              // rules={[{ pattern: /^1[3-9]\d{9}$/, message: t("auth.toast.inputCorrectPhoneNumber") }]}
            >
              <Input disabled />
            </Form.Item>

            <Form.Item
              label={t("auth.text.email")}
              name="email"
            >
              <Input disabled />
            </Form.Item>

            <Form.Item label={t("common.text.birth")} name="birth">
              <DatePicker
                disabledDate={(current) => current && current > dayjs().endOf("day")}
              />
            </Form.Item>

            <Form.Item className="mb-0">
              <div className="flex justify-end">
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
                  loading={isPending}
                >
                  {t("common.text.confirm")}
                </Button>
              </div>
            </Form.Item>
          </Form>
        )}
      </div>
    </Modal>
  );
};

export default memo(forwardRef(EditSelfInfo));
