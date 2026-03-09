import { LeftOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Select, Space } from "antd";
import { t } from "i18next";
import md5 from "md5";
import { useState } from "react";

import { useReset, useSendSms, useVerifyCode } from "@/api/hooks/auth";
import { AuthCodePurpose } from "@/api/types/auth";

import { areaCode } from "./areaCode";
import { DEFAULT_AREA_CODE, SMS_COUNTDOWN_SECONDS } from "./constants";
import { useCountdown } from "./hooks/useCountdown";
import { FormType, type LoginMethod } from "./types";

type ModifyFormProps = {
  loginMethod: LoginMethod;
  setFormType: (type: FormType) => void;
};

type FormFields = {
  phoneNumber?: string;
  areaCode?: string;
  email?: string;
  verifyCode: string;
  password: string;
  password2: string;
};

const ModifyForm = ({ loginMethod, setFormType }: ModifyFormProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormFields>();
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const { mutate: sendSms } = useSendSms();
  const { mutate: reset } = useReset();
  const { mutate: verifyCode } = useVerifyCode();
  const { countdown, start } = useCountdown();

  const onFinish = (fields: FormFields) => {
    if (!fields.verifyCode) return;
    if (!isCodeVerified) {
      verifyCode(
        {
          email: fields.email,
          phoneNumber: fields.phoneNumber,
          areaCode: fields.areaCode,
          verifyCode: fields.verifyCode,
          usedFor: AuthCodePurpose.ResetPassword,
        },
        {
          onSuccess() {
            setIsCodeVerified(true);
          },
        },
      );
    } else {
      reset(
        {
          phoneNumber: fields.phoneNumber,
          areaCode: fields.areaCode,
          email: fields.email,
          verifyCode: fields.verifyCode,
          password: md5(fields.password),
        },
        {
          onSuccess() {
            message.success(t("auth.toast.updatePasswordSuccess"));
            setFormType(FormType.Login);
          },
        },
      );
    }
  };

  const sendSmsHandle = () => {
    sendSms(
      {
        phoneNumber: form.getFieldValue("phoneNumber") as string,
        email: form.getFieldValue("email") as string,
        areaCode: form.getFieldValue("areaCode") as string,
        usedFor: AuthCodePurpose.Login,
      },
      {
        onSuccess() {
          start(SMS_COUNTDOWN_SECONDS);
        },
      },
    );
  };

  const back = () => {
    setFormType(FormType.Login);
    form.resetFields();
  };

  return (
    <div className="flex flex-col justify-between">
      <div className="cursor-pointer text-sm text-gray-400" onClick={back}>
        <LeftOutlined rev={undefined} />
        <span className="ml-1">{t("auth.text.getBack")}</span>
      </div>
      <div className="mt-6 text-2xl font-medium">{t("auth.text.forgetPassword")}</div>
      <Form
        form={form}
        layout="vertical"
        labelCol={{ prefixCls: "custom-form-item" }}
        onFinish={onFinish}
        autoComplete="off"
        className="mt-6"
        initialValues={{ areaCode: DEFAULT_AREA_CODE }}
      >
        {isCodeVerified && (
          <>
            <Form.Item
              label={t("auth.text.password")}
              name="password"
              help={
                <span className="text-xs text-gray-400">
                  {t("auth.toast.passwordRules")}
                </span>
              }
              rules={[
                {
                  required: true,
                  pattern: /^(?=.*[0-9])(?=.*[a-zA-Z]).{6,20}$/,
                  message: t("auth.toast.passwordRules"),
                },
              ]}
              hidden={!isCodeVerified}
            >
              <Input.Password allowClear placeholder={t("auth.toast.inputPassword")} />
            </Form.Item>
            <Form.Item
              label={t("auth.text.confirmPassword")}
              name="password2"
              rules={[
                {
                  required: true,
                  message: "Please confirm your password",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error(t("auth.toast.passwordsDifferent")),
                    );
                  },
                }),
              ]}
            >
              <Input.Password
                allowClear
                placeholder={t("auth.toast.reconfirmPassword")}
              />
            </Form.Item>
          </>
        )}
        {loginMethod === "phone" ? (
          <Form.Item
            label={t("auth.text.phoneNumber")}
            required
            hidden={isCodeVerified}
          >
            <Space.Compact className="w-full">
              <Form.Item name="areaCode" noStyle>
                <Select options={areaCode} className="w-28!" />
              </Form.Item>
              <Form.Item name="phoneNumber" noStyle>
                <Input allowClear placeholder={t("auth.toast.inputPhoneNumber")} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
        ) : (
          <Form.Item
            required
            hidden={isCodeVerified}
            label={t("auth.text.email")}
            name="email"
            rules={[{ type: "email", message: t("auth.toast.inputCorrectEmail") }]}
          >
            <Input allowClear placeholder={t("auth.toast.inputEmail")} />
          </Form.Item>
        )}

        <Form.Item
          label={t("auth.text.verifyCode")}
          name="verifyCode"
          hidden={isCodeVerified}
          required
        >
          <Space.Compact className="w-full">
            <Input
              allowClear
              placeholder={t("auth.toast.inputVerifyCode")}
              className="w-full"
            />
            <Button type="primary" onClick={sendSmsHandle} loading={countdown > 0}>
              {countdown > 0
                ? t("common.dateTime.relative.second", { num: countdown })
                : t("auth.text.sendVerifyCode")}
            </Button>
          </Space.Compact>
        </Form.Item>
        <Form.Item className="mt-20">
          <Button type="primary" htmlType="submit" block>
            {isCodeVerified ? t("common.text.confirm") : t("auth.text.nextStep")}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default ModifyForm;
