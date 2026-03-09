import { t } from "i18next";
import { useCallback, useState } from "react";
import { useCopyToClipboard } from "react-use";

import logo from "@/assets/images/profile/logo.svg";
import WindowControlBar from "@/components/WindowControlBar";
import { APP_NAME, APP_VERSION, SDK_VERSION } from "@/config";
import { feedbackToast } from "@/utils/feedback";
import { getLoginMethod, setLoginMethod as saveLoginMethod } from "@/utils/storage";

import ConfigModal from "./ConfigModal";
import GeometricCharacters from "./GeometricCharacters";
import styles from "./index.module.scss";
import LoginForm from "./LoginForm";
import ModifyForm from "./ModifyForm";
import RegisterForm from "./RegisterForm";
import { FormType, type LoginMethod } from "./types";

export const Login = () => {
  const [formType, setFormType] = useState<FormType>(FormType.Login);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(
    getLoginMethod() as LoginMethod,
  );
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [_, copyToClipboard] = useCopyToClipboard();

  const updateLoginMethod = useCallback((method: LoginMethod) => {
    setLoginMethod(method);
    saveLoginMethod(method);
  }, []);

  const handleCopy = () => {
    copyToClipboard(`${`${APP_NAME} ${APP_VERSION}`}/${SDK_VERSION}`);
    feedbackToast({ msg: t("common.toast.copySuccess") });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="app-drag absolute top-0 right-0 left-0 z-10 flex h-10 items-center">
        <div className="no-drag flex items-center pl-4">
          <img src={logo} alt="logo" className="h-5 w-5" />
          <span className="ml-2 text-sm font-semibold text-[#2d3748]">{APP_NAME}</span>
        </div>
        <WindowControlBar />
      </div>
      <div className="flex flex-1">
        <LeftBar isPasswordFocused={isPasswordFocused} />
        <div
          className={`${styles.login} flex w-[40%] items-center justify-center`}
        >
          <div
            className="w-87.5 rounded-md p-11"
            style={{ boxShadow: "0 0 30px rgba(0,0,0,.1)" }}
          >
            {formType === FormType.Login && (
              <LoginForm
                setFormType={setFormType}
                loginMethod={loginMethod}
                updateLoginMethod={updateLoginMethod}
                onPasswordFocusChange={setIsPasswordFocused}
              />
            )}
            {formType === FormType.ResetPassword && (
              <ModifyForm setFormType={setFormType} loginMethod={loginMethod} />
            )}
            {formType === FormType.Register && (
              <RegisterForm loginMethod={loginMethod} setFormType={setFormType} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LeftBar = ({ isPasswordFocused }: { isPasswordFocused: boolean }) => {
  const [configVisible, setConfigVisible] = useState<boolean>(false);
  const closeConfigModal = useCallback(() => setConfigVisible(false), []);

  return (
    <div className="flex w-[60%] flex-col items-center justify-center rounded-r-3xl bg-[#f0f4f8]">
      <div
        className="mb-6 text-3xl font-semibold text-[#2d3748]"
        onDoubleClick={() => setConfigVisible(true)}
      >
        {t("auth.text.title")}
      </div>
      <span className="mb-10 text-base text-gray-400">
        {t("auth.text.subTitle")}
      </span>
      <GeometricCharacters isPasswordFocused={isPasswordFocused} />
      <ConfigModal visible={configVisible} close={closeConfigModal} />
    </div>
  );
};
