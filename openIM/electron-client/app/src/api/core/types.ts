export type ApiResponse<T = unknown> = {
  errCode: number;
  errMsg?: string;
  data: T;
};
