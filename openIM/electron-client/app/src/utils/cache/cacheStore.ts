export type CacheRecordKey = "media_cache_record" | "download_cache_record";

const MAX_CACHE_ENTRIES = 500;

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

const pruneIfNeeded = (record: Record<string, string>): Record<string, string> => {
  const entries = Object.entries(record);
  if (entries.length <= MAX_CACHE_ENTRIES) return record;
  return Object.fromEntries(entries.slice(-(MAX_CACHE_ENTRIES / 2 | 0)));
};

export const mergeCacheRecord = (
  key: CacheRecordKey,
  patch: Record<string, string>,
  current?: Record<string, string>,
) => {
  const base = current ?? getCacheRecordSync<Record<string, string>>(key);
  const merged = pruneIfNeeded({ ...base, ...patch });
  setCacheRecord(key, merged);
  return merged;
};
