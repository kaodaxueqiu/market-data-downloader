import { GithubOutlined, GoogleOutlined } from "@ant-design/icons";
import { Button, Form, Input, Select, Space, Tabs } from "antd";
import { t } from "i18next";
import md5 from "md5";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLogin, useSendSms } from "@/api/hooks/auth";
import {
  AuthCodePurpose,
  type LoginParams,
  type SendSmsParams,
} from "@/api/types/auth";
import { getChatUrl } from "@/config";
import { feedbackToast } from "@/utils/feedback";
import {
  getEmail,
  getPhoneNumber,
  setAreaCode,
  setEmail,
  setIMProfile,
  setPhoneNumber,
} from "@/utils/storage";

import { areaCode } from "./areaCode";
import { DEFAULT_AREA_CODE, SMS_COUNTDOWN_SECONDS } from "./constants";
import { useCountdown } from "./hooks/useCountdown";
import styles from "./index.module.scss";
import { FormType, type LoginMethod } from "./types";

enum LoginType {
  Password,
  VerifyCode,
}

type LoginFormProps = {
  setFormType: (type: FormType) => void;
  loginMethod: LoginMethod;
  updateLoginMethod: (method: LoginMethod) => void;
  onPasswordFocusChange?: (focused: boolean) => void;
};

const LoginForm = ({ loginMethod, setFormType, updateLoginMethod, onPasswordFocusChange }: LoginFormProps) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loginType, setLoginType] = useState<LoginType>(LoginType.Password);
  const { mutate: login, isPending: loginLoading } = useLogin();
  const { mutate: sendSms } = useSendSms();

  const { countdown, start } = useCountdown();
  const isVerifyCodeLogin = loginType === LoginType.VerifyCode;

  const onFinish = (params: LoginParams) => {
    if (loginType === LoginType.Password) {
      params.password = md5(params.password ?? "");
    }
    if (params.phoneNumber) {
      setAreaCode(params.areaCode);
      setPhoneNumber(params.phoneNumber);
    }
    if (params.email) {
      setEmail(params.email);
    }
    login(params, {
      onSuccess: (data) => {
        const { chatToken, imToken, userID } = data.data;
        setIMProfile({ chatToken, imToken, userID });
        navigate("/chat");
      },
    });
  };

  const sendSmsHandle = () => {
    const options: SendSmsParams = {
      usedFor: AuthCodePurpose.Login,
    };
    if (loginMethod === "phone") {
      options.phoneNumber = form.getFieldValue("phoneNumber") as string;
      options.areaCode = form.getFieldValue("areaCode") as string;
    }
    if (loginMethod === "email") {
      options.email = form.getFieldValue("email") as string;
    }

    sendSms(options, {
      onSuccess() {
        start(SMS_COUNTDOWN_SECONDS);
      },
    });
  };

  const onLoginMethodChange = (key: string) => {
    updateLoginMethod(key as LoginMethod);
  };

  const toOAuthLogin = async (provider: "google" | "github") => {
    const chatUrl = getChatUrl();
    if (window.electronAPI) {
      const { success, data } = await window.electronAPI.oauthLogin({
        baseUrl: chatUrl,
        provider,
      });
      if (!success) {
        feedbackToast({ error: {} });
        console.error(`${provider} OAuth login failed`);
        return;
      }
      const { chatToken, imToken, userID } = data;
      setIMProfile({ chatToken, imToken, userID });
      navigate("/chat", { replace: true });
      return;
    }
    const callback = `${window.location.origin}/#/oauth/callback`;
    window.location.href = `${chatUrl}/oauth/login/${provider}?cb=${encodeURIComponent(
      callback,
    )}`;
  };

  const handleGoogleLogin = () => toOAuthLogin("google");
  const handleGithubLogin = () => toOAuthLogin("github");

  const handlePasswordFocus = () => onPasswordFocusChange?.(true);
  const handlePasswordBlur = () => onPasswordFocusChange?.(false);

  return (
    <>
      <div className="flex flex-row items-center justify-center">
        <div className="text-xl font-medium">{t("auth.text.welcome")}</div>
      </div>
      <Tabs
        className={styles["login-method-tab"]}
        activeKey={loginMethod}
        items={[
          { key: "phone", label: t("auth.text.phoneNumber") },
          { key: "email", label: t("auth.text.email") },
        ]}
        onChange={onLoginMethodChange}
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
        labelCol={{ prefixCls: "custom-form-item" }}
        initialValues={{
          areaCode: DEFAULT_AREA_CODE,
          phoneNumber: getPhoneNumber() ?? "",
          email: getEmail() ?? "",
        }}
      >
        {loginMethod === "phone" && (
          <Form.Item label={t("auth.text.phoneNumber")}>
            <Space.Compact className="w-full">
              <Form.Item name="areaCode" noStyle>
                <Select options={areaCode} className="w-28!" />
              </Form.Item>
              <Form.Item name="phoneNumber" noStyle>
                <Input
                  allowClear
                  placeholder={t("auth.toast.inputPhoneNumber")}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
        )}
        {loginMethod === "email" && (
          <Form.Item
            label={t("auth.text.email")}
            name="email"
            rules={[{ type: "email", message: t("auth.toast.inputCorrectEmail") }]}
          >
            <Input
              allowClear
              placeholder={t("auth.toast.inputEmail")}
            />
          </Form.Item>
        )}

        {isVerifyCodeLogin ? (
          <Form.Item label={t("auth.text.verifyCode")} name="verifyCode">
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
        ) : (
          <Form.Item label={t("auth.text.password")} name="password">
            <Input.Password
              allowClear
              placeholder={t("auth.toast.inputPassword")}
              onFocus={handlePasswordFocus}
              onBlur={handlePasswordBlur}
            />
          </Form.Item>
        )}

        <div className="mb-2 flex flex-row justify-between">
          <span
            className="cursor-pointer text-sm text-gray-400"
            onClick={() => setFormType(FormType.ResetPassword)}
          >
            {t("auth.text.forgetPassword")}
          </span>
          <span
            className="text-primary cursor-pointer text-sm"
            onClick={() =>
              setLoginType(
                loginType === LoginType.Password
                  ? LoginType.VerifyCode
                  : LoginType.Password,
              )
            }
          >
            {`${
              loginType === LoginType.Password
                ? t("auth.text.verifyCode")
                : t("auth.text.password")
            }${t("auth.text.login")}`}
          </span>
        </div>

        <div className="mb-2 flex justify-end space-x-3">
          <Button icon={<GoogleOutlined />} onClick={handleGoogleLogin}></Button>
          <Button icon={<GithubOutlined />} onClick={handleGithubLogin}></Button>
        </div>

        <Form.Item className="mb-4">
          <Button type="primary" htmlType="submit" block loading={loginLoading}>
            {t("auth.text.login")}
          </Button>
        </Form.Item>

        <div className="flex flex-row items-center justify-center">
          <span className="text-sm text-gray-400">{t("auth.text.registerToast")}</span>
          <span
            className="cursor-pointer text-sm text-blue-500"
            onClick={() => setFormType(FormType.Register)}
          >
            {t("auth.text.toRegister")}
          </span>
        </div>
      </Form>
    </>
  );
};

export default LoginForm;
