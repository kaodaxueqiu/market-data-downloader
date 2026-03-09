export enum AuthCodePurpose {
  Register = 1,
  ResetPassword = 2,
  Login = 3,
}

export type RegisterUserInfo = {
  nickname: string;
  faceURL: string;
  birth?: number;
  gender?: number;
  email?: string;
  account?: string;
  areaCode?: string;
  phoneNumber?: string;
  password: string;
};

export type RegisterParams = {
  invitationCode?: string;
  verifyCode: string;
  deviceID?: string;
  autoLogin?: boolean;
  user: RegisterUserInfo;
};

export type LoginParams = {
  verifyCode: string;
  deviceID?: string;
  areaCode: string;
  account?: string;
  phoneNumber?: string;
  email?: string;
  password: string;
};

export type ModifyPasswordParams = {
  userID: string;
  currentPassword: string;
  newPassword: string;
};

export type ResetPasswordParams = {
  phoneNumber?: string;
  areaCode?: string;
  email?: string;
  verifyCode: string;
  password: string;
};

export type VerifyCodeParams = {
  email?: string;
  phoneNumber?: string;
  areaCode?: string;
  verifyCode: string;
  usedFor: AuthCodePurpose;
};

export type SendSmsParams = {
  email?: string;
  phoneNumber?: string;
  areaCode?: string;
  deviceID?: string;
  usedFor: AuthCodePurpose;
  invitationCode?: string;
};
