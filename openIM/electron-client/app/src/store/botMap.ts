import { getAgentListPage } from "@/api/services/agent";
import type { Agent } from "@/api/types/agent";

const botMap = new Map<string, Agent>();

export async function loadBotMap(): Promise<void> {
  try {
    let page = 1;
    let allAgents: Agent[] = [];

    while (true) {
      const { data: { agents } } = await getAgentListPage(page, 50);
      if (agents?.length) {
        allAgents = [...allAgents, ...agents];
      }
      if (!agents || agents.length < 50) break;
      page += 1;
    }

    botMap.clear();
    for (const agent of allAgents) {
      botMap.set(agent.userID, agent);
    }

    console.log(`[BotMap] loaded ${botMap.size} bots:`, [...botMap.keys()]);
  } catch (error) {
    console.error("[BotMap] load failed:", error);
  }
}

export function isBot(userID?: string): boolean {
  if (!userID) return false;
  return botMap.has(userID);
}

export function getBot(userID?: string): Agent | undefined {
  if (!userID) return undefined;
  return botMap.get(userID);
}

export function getAllBots(): Agent[] {
  return [...botMap.values()];
}
