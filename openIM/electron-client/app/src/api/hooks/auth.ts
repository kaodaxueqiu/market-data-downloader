import { useMutation } from "@tanstack/react-query";

import { errorHandle } from "../core/errors";
import { login, register, resetPassword, sendSms, verifyCode } from "../services/auth";
import type {
  LoginParams,
  RegisterParams,
  ResetPasswordParams,
  SendSmsParams,
  VerifyCodeParams,
} from "../types/auth";

export const useSendSms = () =>
  useMutation({
    mutationFn: (params: SendSmsParams) => sendSms(params),
    onError: errorHandle,
  });

export const useVerifyCode = () =>
  useMutation({
    mutationFn: (params: VerifyCodeParams) => verifyCode(params),
    onError: errorHandle,
  });

export const useRegister = () =>
  useMutation({
    mutationFn: (params: RegisterParams) => register(params),
    onError: errorHandle,
  });

export const useReset = () =>
  useMutation({
    mutationFn: (params: ResetPasswordParams) => resetPassword(params),
    onError: errorHandle,
  });

export const useLogin = () =>
  useMutation({
    mutationFn: (params: LoginParams) => login(params),
    onError: errorHandle,
  });
