export type MomentsUser = {
  userID: string;
  userName: string;
};

export type PublishMomentsParams = {
  content: {
    metas: {
      original: string;
      thumb: string;
    }[];
    text: string;
    type: number;
  };
  permission: 0 | 1 | 2 | 3;
  atUserIDs?: string[];
  permissionUserIDs?: string[];
  permissionGroupIDs?: string[];
};

export type DeleteCommentParams = {
  workMomentID: string;
  commentID: string;
};

export type CreateCommentParams = {
  workMomentID: string;
  content: string;
  replyUserID: string;
  replyUserName: string;
};
