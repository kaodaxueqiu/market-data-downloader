import { CustomEmojiItem } from "@/pages/chat/queryChat/MessageItem/FaceMessageRender";
import { LocaleString } from "@/store/type";
import { getCacheRecordSync, setCacheRecord } from "@/utils/cache/cacheStore";
import { clearAllDraftCache } from "@/utils/cache/draftCache";
import { SendKeymap } from "@openim/im-composer";
import localForage from "localforage";

localForage.config({
  name: "G-Snowball-IM-Config",
});

export const setAreaCode = (areaCode: string) =>
  localStorage.setItem("IM_AREA_CODE", areaCode);
export const setAccount = (account: string) =>
  localStorage.setItem("IM_ACCOUNT", account);
export const setPhoneNumber = (account: string) =>
  localStorage.setItem("IM_PHONE_NUM", account);
export const setEmail = (email: string) => localStorage.setItem("IM_EMAIL", email);
export const setLoginMethod = (method: string) =>
  localStorage.setItem("IM_LOGIN_METHOD", method);
export const setTMToken = (token: string) => localForage.setItem("IM_TOKEN", token);
export const setChatToken = (token: string) =>
  localForage.setItem("IM_CHAT_TOKEN", token);
export const setTMUserID = (userID: string) => localForage.setItem("IM_USERID", userID);
export const setIMProfile = ({
  chatToken,
  imToken,
  userID,
}: {
  chatToken: string;
  imToken: string;
  userID: string;
}) => {
  setTMToken(imToken);
  setChatToken(chatToken);
  setTMUserID(userID);
};

export const setFriendApplicationLatestTime = async (time: number) => {
  const userID = await getIMUserID();
  if (!userID) return;
  await localForage.setItem(`${userID}_FRIEND_APPLICATION_LATEST_TIME`, time);
};
export const setGroupApplicationLatestTime = async (time: number) => {
  const userID = await getIMUserID();
  if (!userID) return;
  await localForage.setItem(`${userID}_GROUP_APPLICATION_LATEST_TIME`, time);
};

export const setUserCustomEmojis = async (list: CustomEmojiItem[]) =>
  localForage.setItem(`${await getIMUserID()}_customEmojis`, list);
export const addUserPlayedVoiceId = async (id: string) => {
  const ids = await getUserPlayedVoiceIds();
  ids.add(id);
  if (ids.size > 500) {
    const firstValue = ids.values().next().value;
    if (firstValue !== undefined) {
      ids.delete(firstValue);
    }
  }
  localForage.setItem(`${await getIMUserID()}_playedVoiceIds`, ids);
};

export const setLocale = (locale: string) => localStorage.setItem("IM_LOCALE", locale);
export const setSendAction = (action: string) =>
  localStorage.setItem("IM_SEND_ACTION", action);
export const setImageCache = async (caches: Record<string, string>) => {
  setCacheRecord("media_cache_record", caches);
};

export const setDownloadCacheRecord = async (caches: Record<string, string>) => {
  setCacheRecord("download_cache_record", caches);
};

export const clearIMProfile = () => {
  localForage.removeItem("IM_TOKEN");
  localForage.removeItem("IM_CHAT_TOKEN");
  localForage.removeItem("IM_USERID");
  clearAllDraftCache();
};

export const getAreaCode = () => localStorage.getItem("IM_AREA_CODE");
export const getAccount = () => localStorage.getItem("IM_ACCOUNT");
export const getPhoneNumber = () => localStorage.getItem("IM_PHONE_NUM");
export const getEmail = () => localStorage.getItem("IM_EMAIL");
export const getLoginMethod = () => {
  const method = localStorage.getItem("IM_LOGIN_METHOD");
  if (method === "account") return "phone";
  return method ?? "phone";
};
export const getIMToken = async () => await localForage.getItem("IM_TOKEN");
export const getChatToken = async () => await localForage.getItem("IM_CHAT_TOKEN");
export const getIMUserID = async () => await localForage.getItem("IM_USERID");

export const getFriendApplicationLatestTime = async () => {
  const userID = await getIMUserID();
  if (!userID) return null;
  return await localForage.getItem<number>(`${userID}_FRIEND_APPLICATION_LATEST_TIME`);
};
export const getGroupApplicationLatestTime = async () => {
  const userID = await getIMUserID();
  if (!userID) return null;
  return await localForage.getItem<number>(`${userID}_GROUP_APPLICATION_LATEST_TIME`);
};

export const getUserCustomEmojis = async (): Promise<CustomEmojiItem[]> =>
  (await localForage.getItem(`${await getIMUserID()}_customEmojis`)) ?? [];
export const getUserPlayedVoiceIds = async (): Promise<Set<string>> =>
  (await localForage.getItem<Set<string>>(`${await getIMUserID()}_playedVoiceIds`)) ??
  new Set();

export const getLocale = (): LocaleString =>
  window.electronAPI?.getKeyStoreSync({ key: "language" }) ||
  (localStorage.getItem("IM_LOCALE") as LocaleString) ||
  window.navigator.language ||
  "en-US";

export const getImageCacheSync = (): Record<string, string> =>
  getCacheRecordSync("media_cache_record");
export const getDownloadCacheRecordSync = (): Record<string, string> =>
  getCacheRecordSync("download_cache_record");
export const getSendAction = () =>
  (localStorage.getItem("IM_SEND_ACTION") as SendKeymap) || "enter";
