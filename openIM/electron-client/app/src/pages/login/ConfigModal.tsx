import { LogLevel } from "@openim/wasm-client-sdk";
import { Button, Form, Input, Modal, Select, Tabs } from "antd";
import { t } from "i18next";
import React, { memo } from "react";

import { getApiUrl, getChatUrl, getLogLevel, getWsUrl } from "@/config";

enum HostType {
  Https = "https://",
  Http = "http://",
  Ws = "ws://",
  Wss = "wss://",
}

interface ConfigModalProps {
  visible: boolean;
  close: () => void;
}

interface ConfigValues {
  IMWsUrl: string;
  IMApiUrl: string;
  ChatUrl: string;
  LogLevel: LogLevel;
}

const getUrlWithoutHosts = (url: string) => {
  return url
    .replace("https://", "")
    .replace("http://", "")
    .replace("ws://", "")
    .replace("wss://", "");
};

const getUrlWithHosts = (url: string, type: HostType) => {
  return type + url;
};

const logLevelOptions = [
  { value: LogLevel.Verbose, label: <span>Verbose</span> },
  { value: LogLevel.Debug, label: <span>Debug</span> },
  { value: LogLevel.Info, label: <span>Info</span> },
  { value: LogLevel.Warn, label: <span>Warn</span> },
  { value: LogLevel.Error, label: <span>Error</span> },
  { value: LogLevel.Fatal, label: <span>Fatal</span> },
  { value: LogLevel.Panic, label: <span>Panic</span> },
];

const ConfigModal: React.FC<ConfigModalProps> = ({ visible, close }) => {
  const getIntialValues = (type: HostType): ConfigValues => {
    console.log(getLogLevel());

    if (!getApiUrl().includes(type)) {
      return {
        IMWsUrl: "",
        IMApiUrl: "",
        ChatUrl: "",
        LogLevel: getLogLevel(),
      };
    }
    return {
      IMWsUrl: getUrlWithoutHosts(getWsUrl()),
      IMApiUrl: getUrlWithoutHosts(getApiUrl()),
      ChatUrl: getUrlWithoutHosts(getChatUrl()),
      LogLevel: getLogLevel(),
    };
  };

  const updateFinish = (values: ConfigValues, isHttps: boolean) => {
    localStorage.setItem(
      "wsUrl",
      getUrlWithHosts(values.IMWsUrl, isHttps ? HostType.Wss : HostType.Ws),
    );
    localStorage.setItem(
      "apiUrl",
      getUrlWithHosts(values.IMApiUrl, isHttps ? HostType.Https : HostType.Http),
    );
    localStorage.setItem(
      "chatUrl",
      getUrlWithHosts(values.ChatUrl, isHttps ? HostType.Https : HostType.Http),
    );
    localStorage.setItem("logLevel", values.LogLevel.toString());

    window.location.reload();
  };

  const defaultActiveKey = getApiUrl().includes(HostType.Http) ? "http" : "https";

  return (
    <Modal
      width={600}
      footer={null}
      title={t("auth.text.config")}
      open={visible}
      onCancel={close}
      centered
    >
      <Tabs
        defaultActiveKey={defaultActiveKey}
        items={[
          {
            key: "http",
            label: t("auth.text.ipPort"),
            children: (
              <Form<ConfigValues>
                name="http"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 16 }}
                initialValues={getIntialValues(HostType.Http)}
                onFinish={(values) => updateFinish(values, false)}
                autoComplete="off"
              >
                <Form.Item
                  label="IMWsUrl"
                  name="IMWsUrl"
                  rules={[{ required: true, message: t("auth.toast.inputIMWsUrl") }]}
                >
                  <Input
                    addonBefore="ws://"
                    placeholder={`${t("auth.text.suchAs")}127.0.0.1:10001`}
                  />
                </Form.Item>
                <Form.Item
                  label="IMApiUrl"
                  name="IMApiUrl"
                  rules={[{ required: true, message: t("auth.toast.inputIMApiUrl") }]}
                >
                  <Input
                    addonBefore="http://"
                    placeholder={`${t("auth.text.suchAs")}127.0.0.1:10002`}
                  />
                </Form.Item>
                <Form.Item
                  label="ChatUrl"
                  name="ChatUrl"
                  rules={[{ required: true, message: t("auth.toast.inputChatUrl") }]}
                >
                  <Input
                    addonBefore="http://"
                    placeholder={`${t("auth.text.suchAs")}127.0.0.1:10008`}
                  />
                </Form.Item>
                <Form.Item
                  label="LogLevel"
                  name="LogLevel"
                  rules={[{ required: true, message: t("auth.toast.inputLogLevel") }]}
                >
                  <Select options={logLevelOptions} />
                </Form.Item>
                <Form.Item wrapperCol={{ offset: 10, span: 14 }}>
                  <Button type="primary" htmlType="submit">
                    {t("common.text.save")}
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "https",
            label: t("auth.text.httpsDomain"),
            children: (
              <Form<ConfigValues>
                name="https"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 16 }}
                initialValues={getIntialValues(HostType.Https)}
                onFinish={(values) => updateFinish(values, true)}
                autoComplete="off"
              >
                <Form.Item
                  label="IMWsUrl"
                  name="IMWsUrl"
                  rules={[{ required: true, message: t("auth.toast.inputIMWsUrl") }]}
                >
                  <Input
                    addonBefore="wss://"
                    placeholder={`${t("auth.text.suchAs")}web.imdomain.com/msg_gateway`}
                  />
                </Form.Item>
                <Form.Item
                  label="IMApiUrl"
                  name="IMApiUrl"
                  rules={[{ required: true, message: t("auth.toast.inputIMApiUrl") }]}
                >
                  <Input
                    addonBefore="https://"
                    placeholder={`${t("auth.text.suchAs")}web.imdomain.com/api`}
                  />
                </Form.Item>
                <Form.Item
                  label="ChatUrl"
                  name="ChatUrl"
                  rules={[{ required: true, message: t("auth.toast.inputChatUrl") }]}
                >
                  <Input
                    addonBefore="https://"
                    placeholder={`${t("auth.text.suchAs")}web.imdomain.com/chat`}
                  />
                </Form.Item>
                <Form.Item
                  label="LogLevel"
                  name="LogLevel"
                  rules={[{ required: true, message: t("auth.toast.inputLogLevel") }]}
                >
                  <Select options={logLevelOptions} />
                </Form.Item>
                <Form.Item wrapperCol={{ offset: 10, span: 14 }}>
                  <Button type="primary" htmlType="submit">
                    {t("common.text.save")}
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      ></Tabs>
    </Modal>
  );
};

export default memo(ConfigModal);
