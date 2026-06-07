# 需求：定时任务(cron)支持绑定到指定会话(session)

> 给 openclaw / 网关工程师。前端「任务清单」菜单已就绪,需要后端把 cron 任务的执行会话从「只能 isolated/main」扩展为「可绑定到某个具体 session」。

## 1. 背景与问题

- 现状:cron 任务的 `sessionTarget` 只支持 `isolated`(每次新开临时会话)/ `main`(主会话)。
- 我们的产品模型里**没有「主会话/独立会话」这种概念**——每个智能体下就是若干个**具体业务会话**(聊天顶部的会话标签,如「鸿蒙移动端开发 / 择时模型 / 无事闲聊」)。
- 因此:定时任务**必须绑定到一个具体 session**,在该会话上下文里执行。前端「会话」就是一个**必选的会话下拉**(不再提供 isolated/main 选项)。
- 诉求:cron 任务支持 `sessionTarget="session" + sessionId`,**每个定时任务都运行在指定会话里**,互不干扰。

## 2. 前端已具备的能力

- 前端可以列出某智能体的全部会话:`POST {agentUrl}/agent/sessions/list { agentId, userID }` → `data.sessions[]`(含 `sessionId`、`title`)。
- 前端「新建/编辑任务」表单里已加「会话」选项:`独立会话 / 主会话 / 指定会话…`,选「指定会话」时用上面的接口让用户选一个 `sessionId`。

## 3. 需要后端做的改动

在 cron 任务的创建/修改接口(经网关 `POST/PATCH .../cron/jobs`)里,扩展 `sessionTarget`:

```text
sessionTarget: "isolated" | "main" | "session"
sessionId?: string      // 当 sessionTarget = "session" 时必填
```

行为要求:

1. `sessionTarget = "session"` 且带 `sessionId` 时,**该定时任务在指定的 session 上下文里执行**(读写都落在这个会话),不污染主会话、也不每次新开。
2. 任务列表 / 详情返回里要**带回** `sessionTarget` 与 `sessionId`,前端编辑时要回显。
3. 校验:
   - `sessionTarget = "session"` 但缺 `sessionId` → 返回参数错误(可复用现有 `CRON_INVOKE_FAILED` 带说明)。
   - `sessionId` 不属于该智能体 / 不存在 → 返回明确错误。
4. 兼容:不传 `sessionTarget` 时维持现有默认(`isolated` 或原默认),老任务不受影响。

## 4. 前端对接约定(已按此实现,后端对齐即可)

- 创建/修改任务请求体新增字段:

```json
{
  "name": "每日宏观早报",
  "schedule": { "kind": "cron", "expr": "0 9 * * 1-5", "tz": "Asia/Shanghai" },
  "sessionTarget": "session",
  "sessionId": "<从 /agent/sessions/list 拿到的 sessionId>",
  "payload": { "kind": "agentTurn", "message": "…", "timeoutSeconds": 300 },
  "delivery": { "mode": "announce", "channel": "openim", "to": "<userID>" }
}
```

- 任务对象返回里期望包含:`sessionTarget`、`sessionId`(供前端回显)。

## 5. 鉴权 / 其它

- 鉴权与现有 cron 接口一致:只用 `token`(chatToken),后端解析 UserID + 校验智能体绑定,无需 X-API-Key。
- 本需求只涉及「绑定 session」,不改 schedule / payload / delivery 等其它结构。

---

一句话:**把 cron 的 `sessionTarget` 增加 `"session"` 取值并新增 `sessionId` 字段,让定时任务能在指定会话里执行,并在返回中带回这两个字段。** 前端已按此实现,后端对齐后即可生效。
