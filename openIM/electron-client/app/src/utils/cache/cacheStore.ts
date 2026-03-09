export type CacheRecordKey = "media_cache_record" | "download_cache_record";

export const getCacheRecordSync = <T = Record<string, string>>(
  key: CacheRecordKey,
): T => {
  return window.electronAPI?.getKeyStoreSync({ key }) ?? ({} as T);
};

export const setCacheRecord = (key: CacheRecordKey, data: Record<string, string>) => {
  window.electronAPI?.setKeyStore({
    key,
    data,
  });
};

export const mergeCacheRecord = (
  key: CacheRecordKey,
  patch: Record<string, string>,
  current?: Record<string, string>,
) => {
  const base = current ?? getCacheRecordSync<Record<string, string>>(key);
  const merged = { ...base, ...patch };
  setCacheRecord(key, merged);
  return merged;
};
