import { chatClient, postApi } from "../core/clients";
import { getPlatformId, normalizeAreaCode } from "../core/helpers";
import type {
  LoginParams,
  ModifyPasswordParams,
  RegisterParams,
  ResetPasswordParams,
  SendSmsParams,
  VerifyCodeParams,
} from "../types/auth";

const platform = getPlatformId();
type AuthTokenPayload = { chatToken: string; imToken: string; userID: string };

export const sendSms = (params: SendSmsParams) =>
  postApi<unknown>(chatClient, "/account/code/send", {
    ...params,
  });

export const verifyCode = (params: VerifyCodeParams) =>
  postApi<unknown>(chatClient, "/account/code/verify", {
    ...params,
    areaCode: normalizeAreaCode(params.areaCode),
  });

export const register = (params: RegisterParams) =>
  postApi<AuthTokenPayload>(chatClient, "/account/register", {
    ...params,
    user: {
      ...params.user,
      areaCode: normalizeAreaCode(params.user.areaCode),
    },
    platform,
  });

export const resetPassword = (params: ResetPasswordParams) =>
  postApi<unknown>(chatClient, "/account/password/reset", {
    ...params,
    areaCode: normalizeAreaCode(params.areaCode),
  });

export const modifyPassword = (params: ModifyPasswordParams) =>
  postApi<unknown>(chatClient, "/account/password/change", {
    ...params,
  });

export const login = (params: LoginParams) =>
  postApi<AuthTokenPayload>(chatClient, "/account/login", {
    ...params,
    platform,
    areaCode: normalizeAreaCode(params.areaCode),
  });

export const oAuthRegister = (state: string) =>
  postApi<AuthTokenPayload>(chatClient, "/account/register/oauth", {
    state,
    platform,
  });

export const oAuthLogin = (state: string) =>
  postApi<AuthTokenPayload>(chatClient, "/account/login/oauth", {
    state,
    platform,
  });
