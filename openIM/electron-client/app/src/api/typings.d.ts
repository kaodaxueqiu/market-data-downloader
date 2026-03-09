export {};

declare global {
  namespace API {
    type Pagination = import("./types/common").Pagination;

    namespace Login {
      type AuthCodePurpose = import("./types/auth").AuthCodePurpose;
      type RegisterUserInfo = import("./types/auth").RegisterUserInfo;
      type RegisterParams = import("./types/auth").RegisterParams;
      type LoginParams = import("./types/auth").LoginParams;
      type ModifyPasswordParams = import("./types/auth").ModifyPasswordParams;
      type ResetPasswordParams = import("./types/auth").ResetPasswordParams;
      type VerifyCodeParams = import("./types/auth").VerifyCodeParams;
      type SendSmsParams = import("./types/auth").SendSmsParams;
    }

    namespace Moments {
      type User = import("./types/moments").MomentsUser;
      type PublishMomentsParams = import("./types/moments").PublishMomentsParams;
      type DeleteCommentParams = import("./types/moments").DeleteCommentParams;
      type CreateCommentParams = import("./types/moments").CreateCommentParams;
    }

    namespace AutoUpdate {
      type Version = import("./types/auto-update").AutoUpdateVersion;
    }

    namespace Agent {
      type Agent = import("./types/agent").Agent;
    }

    namespace Collect {
      type CollectType = import("./types/collect").CollectType;
      type CollectContent = import("./types/collect").CollectContent;
      type AddCollectResp = import("./types/collect").AddCollectResp;
      type GetCollectResp = import("./types/collect").GetCollectResp;
    }
  }
}
