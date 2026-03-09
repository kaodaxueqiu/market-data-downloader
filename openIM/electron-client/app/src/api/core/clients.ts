import type { AxiosInstance } from "axios";

import { getAgentUrl, getApiUrl, getChatUrl } from "@/config";
import createAxiosInstance from "@/utils/request";

import type { ApiResponse } from "./types";

export const chatClient = createAxiosInstance(getChatUrl(), false);
export const chatImClient = createAxiosInstance(getChatUrl(), true);
export const apiClient = createAxiosInstance(getApiUrl(), true);
export const agentClient = createAxiosInstance(getAgentUrl(), false);

export const postApi = <T, D = unknown>(client: AxiosInstance, url: string, data?: D) =>
  client.post<T, ApiResponse<T>, D>(url, data);
