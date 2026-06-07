# API Gateway 对接清单：cron 新字段透传 + 按主人列会话

> 给 **API Gateway**(`/api/v1/agents/...`,前端直连的中间层)同事。openclaw(龙虾)侧已改完,现在需要确认/调整网关层,保证新字段**双向透传**、不被字段校验/白名单丢弃。

## 背景

链路:

```
前端  →  API Gateway (/api/v1/agents/{agentID}/cron|sessions)  →  openclaw 网关
```

openclaw 已支持三项新能力:① 多排期 `schedules`;② 任务绑定会话 `sessionTarget=session + sessionId`;③ 按主人列会话。若网关对请求体/响应做了字段白名单或信封转换,新字段会被丢掉,需逐项确认。

---

## 1. 多排期 `schedules`（数组）

一个定时任务可带多个执行时间(多条 cron),任一到点即执行。

- **创建 / 修改**(`POST` / `PATCH /api/v1/agents/{agentID}/cron/jobs`):
  - 请求体里的 `schedules`(数组)**原样透传**给 openclaw。
  - 不要只认单个 `schedule` 而把 `schedules` 当未知字段丢弃。
  - 前端约定:**单个时间发 `schedule`,多个时间发 `schedules`**,两者都要支持转发。
- **列表 / 详情**(`GET .../cron/jobs`、`.../jobs/{id}`):
  - openclaw 返回的 `schedules` 要**原样带回**前端(前端编辑时要回显多个时间)。
  - ⚠️ **硬约束**:`schedules` **不是恒定返回**的字段。龙虾只在排期 **>1 条**时才返回 `schedules`;**单排期任务只返回 `schedule`**(没有 `schedules`)。
    - 网关不要假设一定有 `schedules`;前端回显时:**有 `schedules` 用 `schedules`,否则用 `schedule`**(前端已按此处理)。
    - 依据(龙虾 `service/jobs.ts createJob`):`schedules` 仅当 length > 1 时持久化,单条保持老的 `schedule` 形态。

请求体示例:

```json
{
  "name": "每日早晚报",
  "schedules": [
    { "kind": "cron", "expr": "30 9 * * 1-5", "tz": "Asia/Shanghai" },
    { "kind": "cron", "expr": "0 18 * * 1-5", "tz": "Asia/Shanghai" }
  ],
  "payload":  { "kind": "agentTurn", "message": "…", "timeoutSeconds": 300 },
  "delivery": { "mode": "announce", "channel": "openim", "to": "<userID>" },
  "sessionTarget": "session",
  "sessionId": "<sessionId>"
}
```

## 2. 会话绑定 `sessionTarget` + `sessionId`

- **创建 / 修改**:`sessionTarget`(取值含 `"session"`)和 `sessionId` **透传**给 openclaw。
- **列表 / 详情**:把 `sessionTarget`、`sessionId` **带回**前端(回显用)。
- 注意:不要因为旧白名单只允许 `isolated/main` 就把 `sessionTarget:"session"` 或 `sessionId` 拦下。
- ⚠️ **硬约束(龙虾强校验,违反直接 400)**:当 `sessionTarget="session"` 时,
  - `payload.kind` **必须是 `agentTurn`**;
  - `sessionId` **必须非空字符串**。
  - 否则龙虾报 `session cron jobs require a non-empty sessionId` / `require payload.kind="agentTurn"`。
  - 说明:这个 400 **只校验「非空」**,不校验是不是真实 id。当初报 400 的真实原因是**没传 sessionId(空)**,不是因为传了短码。
  - ⚠️ **`sessionId` 必须是 openclaw 真实的会话 id(形如 `sess_xxxxxxxx`)**——就是「按主人列会话」接口返回的那个真实 `sessionId`,**不能用截断显示码(如 `43c080`)或 session key**。注意:传一个**非空的短码也能过 400**,但**投递时会路由到错误/不存在的会话**。要靠传真实 `sess_xxx` 来保证投对(前端已固定用真实 `sessionId`,短码只用于显示)。

## 3. 按主人列会话 `GET /api/v1/agents/{agentID}/sessions`

这是**纯网关层**的职责(token→当前用户、agentID→该智能体的主人、再查主人的会话),**不在龙虾(openclaw)职责内**——会话数据来源(session-api / openclaw session 文件)由网关决定。

- 确认该接口**已实现并上线**(详见 `cron-session-list-by-owner-requirement.md`)。
- ⚠️ **硬约束**:返回的 `sessionId` **必须是 openclaw 真实的 `sess_xxx`**(即 cron 绑定要用、投递路由要用的那个 id),**不能是截断显示码或 session key**。注意:短码不会被龙虾的「非空」校验(400)挡住——它能过 400,但**投递时会路由到错误/不存在的会话**。所以必须返回真实 `sessionId` 才能投对。
- 返回结构(前端已按此对接):

```json
{ "success": true, "data": {
  "agentID": "bot_xxx", "ownerUserID": "...", "ownerName": "...",
  "sessions": [ { "sessionId": "...", "title": "...", "lastActiveAt": "...", "createdAt": "..." } ]
}}
```

---

## 4. 通用要求

- **鉴权**:沿用现状,只用 `token`(chatToken),不需要 `X-API-Key`。
- **响应信封**:保持 `{ success, data }`(失败 `{ success:false, error:{code,message} }`),`data` 为可直接使用的 JSON(网关已替前端剥掉 openclaw 的双层信封)。
- **不要丢字段**:cron 任务对象在「创建请求 → 转发」「openclaw 响应 → 返回前端」两个方向上,`schedules` / `sessionTarget` / `sessionId` 都要完整保留。

---

## 5. 当前进度澄清（重要）

- 龙虾目前能正确**存储/解析** `sessionTarget=session + sessionId`、以及 `schedules` 多排期。
- 但「**任务结果运行后自动投递到那个绑定会话**」这一步(端到端闭环的最后一环)**龙虾尚未接通**,需等下一轮源码改 + 新构建。
- 也就是说:网关把字段都透传对了之后,「定点汇报到指定会话」端到端仍差龙虾这最后一步才完整。本文档只约定**字段透传契约**,不代表投递已打通。

---

## 一句话

> 网关对 cron 的创建/修改/详情接口,对 **`schedules`(数组,且单排期时只返回 `schedule`)、`sessionTarget`、`sessionId`(真实 `sess_xxx`)** 做到**双向透传**(请求转发 + 响应带回),不要因字段白名单丢弃;`sessionTarget="session"` 时确保 `sessionId` 非空且 `payload.kind=agentTurn`;并确认 **`GET /api/v1/agents/{id}/sessions`(按主人列会话,返回真实 sessionId)** 已上线。
