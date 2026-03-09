import { MessageItem } from "@openim/wasm-client-sdk";
import { Attachment } from "@openim/im-composer";

/**
 * Draft cache for storing editor state between conversation switches.
 * - editorState and quote: persisted in localStorage
 * - attachments: in-memory only (temporary, lost when page closes)
 */

// Types
export type DraftCacheData = {
  editorState?: string;
  quote?: MessageItem;
  attachments?: Attachment[];
};

type PersistedDraftData = {
  editorState?: string;
  quote?: MessageItem;
};

// Storage key prefix
const DRAFT_STORAGE_KEY = "IM_DRAFT_CACHE";

// In-memory cache for attachments (not persisted)
const attachmentsCache = new Map<string, Attachment[]>();

/**
 * Get persisted draft data from localStorage
 */
const getPersistedDrafts = (): Record<string, PersistedDraftData> => {
  try {
    const data = localStorage.getItem(DRAFT_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

/**
 * Save persisted draft data to localStorage
 */
const savePersistedDrafts = (drafts: Record<string, PersistedDraftData>): void => {
  try {
    if (Object.keys(drafts).length === 0) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } else {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    }
  } catch (e) {
    console.error("Failed to save draft cache:", e);
  }
};

/**
 * Get cached draft data for a conversation
 */
export const getDraftCache = (conversationID: string): DraftCacheData | undefined => {
  const persisted = getPersistedDrafts()[conversationID];
  const attachments = attachmentsCache.get(conversationID);

  if (!persisted && !attachments) {
    return undefined;
  }

  return {
    editorState: persisted?.editorState,
    quote: persisted?.quote,
    attachments,
  };
};

/**
 * Set draft data for a conversation
 */
export const setDraftCache = (conversationID: string, data: DraftCacheData): void => {
  // Save editorState and quote to localStorage
  const drafts = getPersistedDrafts();
  if (data.editorState || data.quote) {
    drafts[conversationID] = {
      editorState: data.editorState,
      quote: data.quote,
    };
  } else {
    delete drafts[conversationID];
  }
  savePersistedDrafts(drafts);

  // Save attachments to memory only
  if (data.attachments && data.attachments.length > 0) {
    attachmentsCache.set(conversationID, data.attachments);
  } else {
    attachmentsCache.delete(conversationID);
  }
};

/**
 * Delete draft data for a conversation
 */
export const deleteDraftCache = (conversationID: string): void => {
  // Remove from localStorage
  const drafts = getPersistedDrafts();
  delete drafts[conversationID];
  savePersistedDrafts(drafts);

  // Remove from memory
  attachmentsCache.delete(conversationID);
};

/**
 * Clear all draft cache (call on logout)
 */
export const clearAllDraftCache = (): void => {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  attachmentsCache.clear();
};

/**
 * Check if draft exists for a conversation
 */
export const hasDraftCache = (conversationID: string): boolean => {
  const persisted = getPersistedDrafts()[conversationID];
  const attachments = attachmentsCache.get(conversationID);
  return !!(persisted?.editorState || persisted?.quote || attachments?.length);
};
