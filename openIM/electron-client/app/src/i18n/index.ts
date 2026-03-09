import "dayjs/locale/zh-cn";

import dayjs from "dayjs";
import i18n from "i18next";
// import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { getLocale } from "@/utils/storage";

import hostAuth_en from "./resources/host/en/auth.json";
import hostChat_en from "./resources/host/en/chat.json";
import hostCommon_en from "./resources/host/en/common.json";
import hostContact_en from "./resources/host/en/contact.json";
import hostSettings_en from "./resources/host/en/settings.json";
import hostSystem_en from "./resources/host/en/system.json";
import hostAuth_zh from "./resources/host/zh/auth.json";
import hostChat_zh from "./resources/host/zh/chat.json";
import hostCommon_zh from "./resources/host/zh/common.json";
import hostContact_zh from "./resources/host/zh/contact.json";
import hostSettings_zh from "./resources/host/zh/settings.json";
import hostSystem_zh from "./resources/host/zh/system.json";

const host_en = {
  ...hostCommon_en,
  ...hostAuth_en,
  ...hostChat_en,
  ...hostContact_en,
  ...hostSettings_en,
  ...hostSystem_en,
};

const host_zh = {
  ...hostCommon_zh,
  ...hostAuth_zh,
  ...hostChat_zh,
  ...hostContact_zh,
  ...hostSettings_zh,
  ...hostSystem_zh,
};

const resources = {
  "en-US": {
    translation: {
      ...host_en,
    },
  },
  "zh-CN": {
    translation: {
      ...host_zh,
    },
  },
  zh: {
    translation: {
      ...host_zh,
    },
  },
};

i18n
  .use(initReactI18next)
  // .use(LanguageDetector)
  .init({
    resources,
    lng: getLocale(),
    fallbackLng: "en-US",
    interpolation: {
      escapeValue: false,
    },
  })
  .then(() => dayjs.locale(i18n.language))
  .catch(() => console.error("i18n init error"));

i18n.on("languageChanged", () => dayjs.locale(i18n.language));

export default i18n;
