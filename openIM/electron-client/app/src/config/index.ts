// WS 10001 API 10002 CHAT 10008

import { LogLevel } from "@openim/wasm-client-sdk";

// 从环境变量读取配置
export const WS_URL = import.meta.env.VITE_WS_URL;
export const API_URL = import.meta.env.VITE_API_URL;
export const CHAT_URL = import.meta.env.VITE_CHAT_URL;
export const AGENT_URL = import.meta.env.VITE_AGENT_URL;
export const LOG_LEVEL = LogLevel.Verbose;

// 应用信息从环境变量读取
export const APP_NAME = import.meta.env.VITE_APP_NAME;
export const APP_VERSION = import.meta.env.VITE_APP_VERSION;
export const SDK_VERSION = import.meta.env.VITE_SDK_VERSION;
export const DEFAULT_TIME_ZONE =
  import.meta.env.VITE_DEFAULT_TIME_ZONE || "Asia/Shanghai";

export const SKILLS_URL = import.meta.env.VITE_SKILLS_URL;
export const SKILLS_API_KEY = import.meta.env.VITE_SKILLS_API_KEY;

export const getWsUrl = () => localStorage.getItem("wsUrl") || WS_URL;
export const getApiUrl = () => localStorage.getItem("apiUrl") || API_URL;
export const getChatUrl = () => localStorage.getItem("chatUrl") || CHAT_URL;
export const getAgentUrl = () => localStorage.getItem("agentUrl") || AGENT_URL;

// Skills 文件穿透接口基址（网关 /api/v1）。优先级：localStorage > 环境变量 > 从 IM API 地址推导网关 host
export const getSkillsUrl = () => {
  const override = localStorage.getItem("skillsUrl");
  if (override) return override;
  if (SKILLS_URL) return SKILLS_URL;
  const api = getApiUrl() || "";
  const host = api.match(/^https?:\/\/[^/]+/);
  return host ? `${host[0]}/api/v1` : "";
};

// Skills 接口所需的网关 API Key。由宿主主程序注入 localStorage('skillsApiKey'/'apiKey') 或构建期环境变量提供
export const getSkillsApiKey = () =>
  localStorage.getItem("skillsApiKey") ||
  localStorage.getItem("apiKey") ||
  SKILLS_API_KEY ||
  "";
export const getLogLevel = () =>
  JSON.parse(localStorage.getItem("logLevel") ?? LOG_LEVEL.toString()) as LogLevel;
export const isSaveLog = process.env.NODE_ENV !== "development";
