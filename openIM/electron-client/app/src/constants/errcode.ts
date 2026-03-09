import { t } from "i18next";

export const ErrCodeMap: Record<number, string> = {
  1003: t("common.error.duplicateKey"),
  20001: t("auth.error.passwordError"),
  20002: t("auth.error.accountNotExist"),
  20003: t("auth.error.phoneNumberRegistered"),
  20004: t("auth.error.accountRegistered"),
  20005: t("auth.error.operationTooFrequent"),
  20006: t("auth.error.verificationCodeError"),
  20007: t("auth.error.verificationCodeExpired"),
  20008: t("auth.error.verificationCodeErrorLimitExceed"),
  20009: t("auth.error.verificationCodeUsed"),
  20010: t("auth.error.invitationCodeUsed"),
  20011: t("auth.error.invitationCodeNotExist"),
  20012: t("common.error.operationRestriction"),
  20014: t("auth.error.accountRegistered"),
  200005: t("common.error.meetingCantEditAfterStart"),
};

export enum IMSDKErrCode {
  Blacked = 1302,
  NotFriend = 1303,
  NotAllowAddFriend = 1310,
}
