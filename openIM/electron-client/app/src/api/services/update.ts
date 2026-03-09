import { chatImClient, postApi } from "../core/clients";
import { getOsArch, getPlatformLabel } from "../core/helpers";
import type { ApiResponse } from "../core/types";
import type { AutoUpdateVersion } from "../types/auto-update";

export const checkUpdatePkg = async (): Promise<
  ApiResponse<{
    version: AutoUpdateVersion;
  }>
> => {
  const platform = getPlatformLabel();
  const osArch = getOsArch();
  return postApi<{ version: AutoUpdateVersion }>(
    chatImClient,
    "/application/latest_version",
    {
      platform: `electron_${platform}_${osArch}`,
      version: "",
    },
  );
};
