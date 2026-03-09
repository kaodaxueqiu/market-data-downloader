import { agentClient, postApi } from "../core/clients";
import { buildPagination } from "../core/helpers";
import type { Agent } from "../types/agent";
import { getIMUserID } from "@/utils/storage";

export const getAgentListPage = (pageNumber = 1, showNumber = 20) =>
  postApi<{ total: number; agents: Agent[] }>(agentClient, "/agent/page", {
    pagination: buildPagination(pageNumber, showNumber),
    userIDs: [],
  });

export interface AgentBinding {
  userID: string;
  agentID: string;
  createTime: number;
}

export const getUserAgentBindings = async (userID?: string) => {
  const uid = userID || (await getIMUserID()) as string;
  return postApi<{ bindings: AgentBinding[] }>(agentClient, "/agent/user_bindings", {
    userID: uid,
  });
};
