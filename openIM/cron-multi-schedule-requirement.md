# 需求：定时任务支持「一个任务、多个时间/排期」

> 给 openclaw / 网关(龙虾)工程师。前端「任务清单」需要在**同一个定时任务**里设置**多个执行时间**(例如「每个工作日 09:30 和 18:00 各跑一次」)。

## 1. 背景与问题

- 现状:一个 cron 任务只有**一条** `schedule`(单个 cron 表达式)。
- cron 表达式的「分 时」是**笛卡尔积**,无法表达「分钟不同的多个时间点」:
  - 「每天 09:00 和 18:00」可以用一条:`0 9,18 * * *` ✅
  - 「每天 09:30 和 18:00」**没法用一条**:`30,0 9,18 * * *` 会变成 09:00/09:30/18:00/18:30 四个点 ❌
- 因此需要让**一个任务携带多个排期**,后端在**任一排期到点时**都执行一次该任务。

## 2. 需求

在 cron 任务的创建/修改接口里,支持**多个排期**:任务带一个 `schedules` 数组,后端在**其中任意一个排期到期时**触发执行(其余字段 payload/delivery/sessionId 等共用同一份)。

### 2.1 字段约定

新增 `schedules`(数组),与现有单个 `schedule` 二选一(建议优先 `schedules`):

```jsonc
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

- `schedules`:数组,每个元素就是现有的 `CronSchedule` 结构(`kind/expr/tz`,也兼容 `every`/`at`)。
- 兼容:如果仍收到单个 `schedule`(非数组),按原逻辑处理;如果收到 `schedules` 数组,则按多排期处理。前端会做到:**单个时间发 `schedule`,多个时间发 `schedules`**。

### 2.2 执行语义

- 任一 `schedules[i]` 到点 → 执行一次该任务(payload/delivery/session 用任务上共用的那份)。
- 多个排期碰巧同一时刻到点 → 只执行一次(去重,避免重复触发)。

### 2.3 返回 / 回显

- 任务列表/详情返回里要**带回** `schedules` 数组(前端编辑时要把多个时间回显出来)。
- 若任务只有一个排期,返回 `schedule` 或 `schedules`(单元素)都可,前端都能处理。

### 2.4 状态(state)

- `state.nextRunAtMs`:取**所有排期里最近的下一次**。
- `state.lastRunAtMs/lastStatus` 等:沿用现状(整任务维度)。

## 3. 前端会怎么用(已按此约定实现)

- 「每天 / 每周 / 每月」都支持**多选时间**。
- 提交时:
  - 只选了 **1 个时间** → 发单个 `schedule`(和现在一样,后端无需改也能跑)。
  - 选了 **多个时间** → 发 `schedules` 数组(每个时间一条 cron 表达式,星期/号数等模式相同,只是时分不同)。
- 例:每周一至周五,09:30 和 18:00:
  ```json
  "schedules": [
    { "kind": "cron", "expr": "30 9 * * 1-5", "tz": "Asia/Shanghai" },
    { "kind": "cron", "expr": "0 18 * * 1-5", "tz": "Asia/Shanghai" }
  ]
  ```

## 4. 鉴权 / 其它

- 鉴权与现有 cron 接口一致(只用 `token`)。
- 本需求只涉及「多排期」,不改 payload/delivery/session 等其它结构。

---

一句话:**让一个定时任务支持 `schedules` 数组(多个 cron 排期),任一到点即执行,并在返回中带回该数组。** 前端做到「单时间发 `schedule`、多时间发 `schedules`」,后端按数组逐个排期触发即可。
