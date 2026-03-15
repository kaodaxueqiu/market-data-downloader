import { v4 as uuidv4 } from "uuid";

import { getAgentUrl } from "@/config";
import { getChatToken, getIMUserID } from "@/utils/storage";

import type {
  CreateSessionParams,
  CreateSessionResp,
  SessionHistoryResp,
  SessionItem,
  UpdateSessionParams,
} from "../types/session";

async function sessionPost<T = unknown>(path: string, body: Record<string, unknown>): Promise<{ data: T }> {
  const [chatToken, userID] = await Promise.all([
    getChatToken(),
    getIMUserID(),
  ]);
  const resp = await fetch(`${getAgentUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: chatToken ?? "",
      operationID: uuidv4(),
    },
    body: JSON.stringify({ ...body, userID }),
  });

  const json = await resp.json();
  if (json.errCode !== undefined && json.errCode !== 0) {
    throw json;
  }
  const data = json.data ?? json;
  return { data };
}

export const getSessions = (agentId: string) =>
  sessionPost<{ sessions: SessionItem[] }>("/agent/sessions/list", { agentId });

export const createSession = (params: CreateSessionParams) =>
  sessionPost<CreateSessionResp>("/agent/sessions/create", params);

export const updateSession = (agentId: string, sessionId: string, params: UpdateSessionParams) =>
  sessionPost("/agent/sessions/update", { agentId, sessionId, ...params });

export const deleteSession = (agentId: string, sessionId: string) =>
  sessionPost("/agent/sessions/delete", { agentId, sessionId });

export const getSessionHistory = (
  agentId: string,
  sessionId: string,
  limit = 50,
  cursor?: string,
) =>
  sessionPost<SessionHistoryResp>("/agent/sessions/history", {
    agentId,
    sessionId,
    limit,
    cursor,
  });
