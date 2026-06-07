# 需求：按「智能体的主人」返回会话列表（给定时任务选择会话用）

> 给 openclaw / 网关工程师。配合「任务清单」菜单的「会话」下拉:需要后端提供一个能返回「**某智能体 ↔ 它的主人**」会话列表的接口。

## 1. 背景与问题

- 「任务清单」给定时任务选「运行的会话」时,下拉要列出**该智能体对应的会话**。
- 现有接口 `POST /agent/sessions/list { agentId }` 会**自动用当前登录用户的 userID** 去查,返回的是「**当前登录人 ↔ 该智能体**」的会话。
- 但实际场景是「管理者」在统一配置**别人**的智能体定时任务。例如:
  - 登录人 = **于洋**
  - 选「**于洋的小跟班**」→ 主人就是于洋 → 现接口正好匹配 → 有会话 ✅
  - 选「**张婷的小跟班 / 王剑飞的小跟班**」→ 主人是张婷、王剑飞,**不是于洋** → 现接口按「于洋」查 → 返回空 ❌
- 即:**会话属于「智能体 + 它的主人」,而主人通常不是当前查看的人**。现接口把人固定成了当前登录用户,导致跨主人查询为空。

## 2. 需求

提供一个接口,**给定 `agentID`,后端通过绑定关系找到该智能体的主人,返回「主人 ↔ 该智能体」的会话列表**。

- 主人 = 该智能体在绑定关系(`user_agent_bindings`)里对应的用户(即「X的小跟班」中的 X)。
- 由**后端**自己根据 `agentID` 解析主人,前端**不传**别人的 userID(避免越权 / 乱传)。
- 鉴权同其它接口:只用 `token`(chatToken),后端校验当前登录用户有权管理该智能体(例如是管理员 / 有相应权限),再返回其主人的会话。

## 3. 建议接口形态(二选一,后端定)

### 方案 A（推荐）:新增「按智能体主人查会话」接口

```http
POST /agent/sessions/list_by_owner
token: <chatToken>
Content-Type: application/json

{ "agentId": "bot_9377891392" }
```

响应(结构与现有 `/agent/sessions/list` 一致即可):

```json
{
  "errCode": 0,
  "data": {
    "ownerUserID": "<该智能体主人的 userID>",
    "ownerName": "张婷",
    "sessions": [
      { "sessionId": "...", "sessionKey": "...", "title": "择时模型", "createdAt": 0, "lastActiveAt": 0, "isDefault": false, "isPinned": false, "isOpen": true, "messageCount": 0 }
    ]
  }
}
```

### 方案 B:给现有 `/agent/sessions/list` 加可选 `ownerScope`

```http
POST /agent/sessions/list
{ "agentId": "bot_xxx", "scope": "owner" }   // scope=owner 时按智能体主人查，不用当前登录人
```

后端在 `scope=owner` 时,忽略当前登录人,改用「该 agent 的主人」查询。

## 4. 字段说明（sessions[] 项,沿用现有结构）

| 字段 | 说明 |
| --- | --- |
| `sessionId` | 会话 id（定时任务绑定用,前端会把它作为 cron 的 `sessionId` 提交） |
| `title` | 会话标题（下拉里展示给用户看） |
| 其它 | 与现有 `/agent/sessions/list` 返回一致 |

## 5. 与「定时任务绑定 session」的关系

- 本接口解决「**下拉里能列出该智能体(按主人)的会话**」。
- 另一份文档 `cron-session-binding-requirement.md` 解决「**cron 任务接受 `sessionTarget=session` + `sessionId` 并在该会话里执行**」。
- 两者配合:前端用本接口列出会话 → 用户选一个 `sessionId` → 按绑定文档提交给 cron。

## 6. 前端对接

- 后端给出接口后,前端把「会话」下拉的数据源从现有 `/agent/sessions/list` 换成本接口(方案 A 用新 path,方案 B 加 `scope:"owner"`)。
- 其余 UI / 提交逻辑不变。

---

一句话:**需要一个「按智能体的主人(而非当前登录人)返回会话列表」的接口**,因为定时任务要绑定的是「智能体 ↔ 它主人」的会话,而配置者(管理员)往往不是主人本人。
