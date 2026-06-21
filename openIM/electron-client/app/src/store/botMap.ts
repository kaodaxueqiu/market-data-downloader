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

// 机器人/智能体的 userID 统一以 "bot_" 开头,用前缀同步判断,
// 不依赖异步加载的 botMap(避免「首次/无历史会话刚拉起时 botMap 未就绪 → 不被识别为机器人」的竞态)。
// botMap.has 仅作兜底,兼容个别不符合前缀约定的历史数据。
export function isBot(userID?: string): boolean {
  if (!userID) return false;
  return userID.startsWith("bot_") || botMap.has(userID);
}

export function getBot(userID?: string): Agent | undefined {
  if (!userID) return undefined;
  return botMap.get(userID);
}

export function getAllBots(): Agent[] {
  return [...botMap.values()];
}
