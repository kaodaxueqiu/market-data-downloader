import axios from "axios";
import { v4 as uuidv4 } from "uuid";

import { getSkillsApiKey, getSkillsUrl } from "@/config";
import { getChatToken } from "@/utils/storage";

import type { SkillsApiError } from "../types/skills";

/**
 * Skills 文件穿透专用请求实例。
 *
 * 与现有 createAxiosInstance 不同：
 * 1. 后端响应格式为 { success, data, error }（不是 errCode），需要单独的拦截器处理；
 * 2. 每个请求需同时携带 X-API-Key（网关 Key）和 token（用户 IM/Chat token）。
 */
const skillsClient = axios.create({
  timeout: 30000,
});

skillsClient.interceptors.request.use(
  async (config) => {
    config.baseURL = getSkillsUrl();
    config.headers = config.headers ?? {};

    const token = (await getChatToken()) as string | null;
    if (token) {
      config.headers.token = config.headers.token ?? token;
    }
    const apiKey = getSkillsApiKey();
    if (apiKey) {
      config.headers["X-API-Key"] = config.headers["X-API-Key"] ?? apiKey;
    }
    config.headers.operationID = config.headers.operationID ?? uuidv4();
    return config;
  },
  (err) => Promise.reject(err),
);

skillsClient.interceptors.response.use(
  (res) => {
    const data = res.data;
    // 文件流（下载）等非 JSON 包络，直接返回
    if (data && typeof data === "object" && "success" in data) {
      if (!data.success) {
        return Promise.reject(
          (data.error as SkillsApiError) ?? { code: "UNKNOWN", message: "请求失败" },
        );
      }
      return data.data;
    }
    return data;
  },
  (err) => {
    const respData = err.response?.data;
    if (respData?.error) {
      return Promise.reject(respData.error as SkillsApiError);
    }
    return Promise.reject({
      code: "NETWORK",
      message: err.message || "网络错误",
    } as SkillsApiError);
  },
);

export default skillsClient;
