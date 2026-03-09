import { LeftOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, InputRef, Select, Space } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import md5 from "md5";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRegister, useSendSms, useVerifyCode } from "@/api/hooks/auth";
import { AuthCodePurpose } from "@/api/types/auth";
import { setAreaCode, setEmail, setIMProfile, setPhoneNumber } from "@/utils/storage";

import { areaCode } from "./areaCode";
import { DEFAULT_AREA_CODE, SMS_COUNTDOWN_SECONDS } from "./constants";
import { useCountdown } from "./hooks/useCountdown";
import { FormType, type LoginMethod } from "./types";

type RegisterFormProps = {
  loginMethod: LoginMethod;
  setFormType: (type: FormType) => void;
};

type FormFields = {
  email?: string;
  phoneNumber?: string;
  areaCode: string;
  verifyCode: string;
  nickname: string;
  password: string;
  password2: string;
};

enum RegisterStep {
  InputAccount,
  VerifyCode,
  SetProfile,
}

const RegisterForm = ({ loginMethod, setFormType }: RegisterFormProps) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormFields>();
  const navigate = useNavigate();
  const { mutate: sendSms } = useSendSms();
  const { mutate: verifySmsCode } = useVerifyCode();
  const { mutate: register } = useRegister();

  const [step, setStep] = useState<RegisterStep>(RegisterStep.InputAccount);

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<InputRef[]>([]);
  const handleInputChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const newCode = [...code];

    if (value.length === 1) {
      newCode[index] = value;
      setCode(newCode);

      if (index < code.length - 1) {
        inputRefs.current[index + 1].focus();
      }
    } else if (value.length === 0) {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
    }

    const isFilled = newCode.every((input) => input.length > 0);
    if (isFilled) {
      form.submit();
    }
  };
  const handleInputKeyUp = (index: number, event: KeyboardEvent) => {
    const keyPressed = event.keyCode || event.which;

    if (keyPressed === 8 && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1].focus();
    }

    if (keyPressed === 8 || keyPressed === 46) {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
    }
  };

  const { countdown, start } = useCountdown();
  const isInputStep = step === RegisterStep.InputAccount;
  const isVerifyStep = step === RegisterStep.VerifyCode;
  const isProfileStep = step === RegisterStep.SetProfile;

  const onFinish = (fields: FormFields) => {
    const verificationCode = code.join("");

    if (isInputStep) {
      const pattern = /^1\d{10}$/;
      if (fields.phoneNumber && !pattern.test(fields.phoneNumber)) {
        return message.error(t("auth.toast.inputCorrectPhoneNumber"));
      }
      sendSms(
        {
          usedFor: AuthCodePurpose.Register,
          ...fields,
        },
        {
          onSuccess() {
            start(SMS_COUNTDOWN_SECONDS);
            setStep(RegisterStep.VerifyCode);
            setTimeout(() => inputRefs.current[0]?.focus());
          },
        },
      );
      return;
    }

    if (isVerifyStep) {
      if (!verificationCode) return;
      verifySmsCode(
        {
          ...fields,
          verifyCode: verificationCode,
          usedFor: AuthCodePurpose.Register,
        },
        {
          onSuccess() {
            setStep(RegisterStep.SetProfile);
          },
        },
      );
      return;
    }
    if (isProfileStep) {
      setAreaCode(fields.areaCode);
      if (fields.phoneNumber) {
        setPhoneNumber(fields.phoneNumber);
      }
      if (fields.email) {
        setEmail(fields.email);
      }

      register(
        {
          verifyCode: verificationCode,
          autoLogin: true,
          user: {
            nickname: fields.nickname,
            faceURL: "",
            areaCode: fields.areaCode,
            phoneNumber: fields.phoneNumber,
            password: md5(fields.password),
            email: fields.email,
          },
        },
        {
          onSuccess(res) {
            message.success(t("auth.toast.registerSuccess"));
            const { chatToken, imToken, userID } = res.data;
            setIMProfile({ chatToken, imToken, userID });
            navigate("/chat");
          },
        },
      );
    }
  };

  const sendSmsHandle = () => {
    sendSms(
      {
        email: form.getFieldValue("email") as string,
        phoneNumber: form.getFieldValue("phoneNumber") as string,
        areaCode: form.getFieldValue("areaCode") as string,
        usedFor: AuthCodePurpose.Register,
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

  const isEmail = loginMethod === "email";

  const verifyTitle = !isEmail
    ? "auth.text.verifyPhoneNumber"
    : "auth.text.verifyEmail";

  const receiver = isEmail
    ? (form.getFieldValue("email") as string)
    : `${form.getFieldValue("areaCode")} ${form.getFieldValue("phoneNumber")}`;

  return (
    <div className="flex flex-col justify-between">
      <div className="cursor-pointer text-sm text-gray-400" onClick={back}>
        <LeftOutlined rev={undefined} />
        <span className="ml-1">{t("auth.text.getBack")}</span>
      </div>
      <div className={clsx("mt-4 text-2xl font-medium")}>
        {isInputStep && <span>{t("auth.text.register")}</span>}
        {isVerifyStep && <span>{t(verifyTitle)}</span>}
        {isProfileStep && <span>{t("auth.text.setInfo")}</span>}
      </div>
      <div className="mt-4 tracking-wider text-gray-400" hidden={!isVerifyStep}>
        <span>{t("auth.text.pleaseEnterSendTo")}</span>
        <span className="text-blue-600">{receiver}</span>
        <span>{t("auth.text.verifyValidity")}</span>
      </div>
      <Form
        form={form}
        layout="vertical"
        labelCol={{ prefixCls: "custom-form-item" }}
        onFinish={onFinish}
        autoComplete="off"
        className="mt-4"
        initialValues={{ areaCode: DEFAULT_AREA_CODE }}
      >
        {loginMethod !== "email" ? (
          <Form.Item label={t("auth.text.phoneNumber")} hidden={!isInputStep}>
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
            label={t("auth.text.email")}
            name="email"
            rules={[{ type: "email", message: t("auth.toast.inputCorrectEmail") }]}
            hidden={!isInputStep}
          >
            <Input allowClear placeholder={t("auth.toast.inputEmail")} />
          </Form.Item>
        )}

        <Form.Item label="" hidden={!isVerifyStep} className="mt-8 mb-14">
          <div className="flex flex-row items-center justify-center">
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={(input: InputRef) => (inputRefs.current[index] = input)}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e)}
                onKeyUp={(e) => handleInputKeyUp(index, e)}
                className="mr-1 h-11 w-11 text-center text-2xl"
              />
            ))}
          </div>
          <div className="mt-4 text-gray-400">
            {countdown > 0 ? (
              <>
                <span className="text-blue-500">{countdown}s </span>
                <span>{t("auth.text.regain") + t("auth.text.verifyCode")}</span>
              </>
            ) : (
              <>
                <span onClick={sendSmsHandle} className="cursor-pointer text-blue-500">
                  {t("auth.text.regain")}
                </span>
                <span>{t("auth.text.verifyCode")}</span>
              </>
            )}
          </div>
        </Form.Item>

        {isProfileStep && (
          <>
            <Form.Item
              label={t("common.text.nickName")}
              name="nickname"
              hidden={!isProfileStep}
              rules={[
                {
                  required: true,
                },
              ]}
            >
              <Input
                allowClear
                spellCheck={false}
                placeholder={t("common.toast.inputNickName")}
              />
            </Form.Item>

            <Form.Item
              label={t("auth.text.password")}
              name="password"
              rules={[
                {
                  required: true,
                  pattern: /^(?=.*[0-9])(?=.*[a-zA-Z]).{6,20}$/,
                  message: t("auth.toast.passwordRules"),
                },
              ]}
            >
              <Input.Password allowClear placeholder={t("auth.toast.inputPassword")} />
            </Form.Item>

            <Form.Item
              label={t("auth.text.confirmPassword")}
              name="password2"
              dependencies={["password"]}
              rules={[
                {
                  required: true,
                  message: t("auth.toast.reconfirmPassword"),
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
              className="mb-8"
            >
              <Input.Password
                allowClear
                placeholder={t("auth.toast.reconfirmPassword")}
              />
            </Form.Item>
          </>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {isProfileStep ? t("common.text.confirm") : t("auth.text.nextStep")}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default RegisterForm;
