export enum CollectType {
  Message = "3",
}

export type CollectContent = {
  collectID: string;
  collectType: CollectType;
  content: string;
  createTime: number;
};

export type AddCollectResp = {
  collectID: string;
  createTime: number;
};

export type GetCollectResp = {
  count: number;
  collects: CollectContent[];
};
