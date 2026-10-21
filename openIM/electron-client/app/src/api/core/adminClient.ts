import axios from "axios";
import { v4 as uuidv4 } from "uuid";

import { getSkillsUrl } from "@/config";
import { getIMToken } from "@/utils/storage";

import type { SkillsApiError } from "../types/skills";

/**
 * admin-backend 专用请求实例。
 * 鉴权：OpenIM token（token 请求头），网关持有 admin-backend 凭证，前端无需 X-API-Key。
 * 响应格式：{ success, data, error }（与 skillsClient 相同）
 */
const adminClient = axios.create({ timeout: 30000 });

adminClient.interceptors.request.use(
  async (config) => {
    config.baseURL = getSkillsUrl();
    config.headers = config.headers ?? {};
    const token = (await getIMToken()) as string | null;
    if (token) {
      config.headers.token = config.headers.token ?? token;
    }
    config.headers.operationID = config.headers.operationID ?? uuidv4();
    return config;
  },
  (err) => Promise.reject(err),
);

adminClient.interceptors.response.use(
  (res) => {
    const data = res.data;
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

export default adminClient;
