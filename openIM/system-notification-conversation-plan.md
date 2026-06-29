# 系统通知会话 · 技术方案（已对齐真实代码与后端部署）

> 状态：待评审。本文不含已落地代码，仅为实现方案。
> 事实来源：前端 `electron-client/app/src` 实测 + 后端 `192.168.30.11` OpenIM 企业版部署实测。

---

## 一、目标

给每个用户固定一个「系统消息」会话容器：每人各自一份、内容互相隔离、只读、**永久固定在会话列表绝对第一行**。本方案只解决「容器稳定存在并锁定在列表顶部」；消息内容由谁/如何下发是后续独立的事。

---

## 二、路线选择：OpenIM 原生通知会话（Notification, type=4）

经前后端核对，该容器是 OpenIM 原生概念，绝大部分能力现成：

| 能力 | 现成位置 | 状态 |
|---|---|---|
| 通知会话类型 `SessionType.Notification=4` | 前端已用（`useGlobalEvents.tsx:790`） | ✅ |
| 会话列表来源 `getConversationListSplit` | `store/conversation.ts:186` | ✅ |
| 取单会话 `getOneConversation({sessionType,sourceID})` | `useGlobalEvents.tsx:611` 已用 | ✅ |
| 置顶 `pinConversation({conversationID,isPinned})` | `ConversationMenuContent.tsx` / `useConversationSettings.ts:23` 已用 | ✅ |
| 通知消息渲染 `SystemNotification` / `OANotification` | `queryChat/SystemNotification`、`useMessageFileDownloadState.tsx:39` | ✅ |
| 排序（置顶优先）`conversationSort` | `utils/imCommon.ts:629` | ⚠️ 见风险①ٍ |

结论：**走原生路线 A 成立**，工作量集中在「确保会话存在 + 绝对置顶 + UI 定制」。

---

## 三、后端现状与建议（已实测）

后端 OpenIM 企业版部署在 `192.168.30.11`：
- `openim-api` :10002（IM 核心，注册用户/发消息）、`chat-api` :10008、`admin-api` :10009
- server secret：`share.yml` 中 `secret: ZiZhou2025!OpenIM`
- 系统账号现状：**`user` 集合仅有 `imAdmin`（nickname superAdmin，app_manger_level=2）**，无专用通知账号
- 会话现状：type=1 单聊 392、type=3 群聊 24、**type=4 通知会话 0 个**（该机制目前完全未启用）
- imAdmin 作为对端的会话仅 1 个（几乎未被业务占用）

### 账号选型建议（需与后端工程师确认）

**建议方案 B：新建专用通知账号 `system_notification`。**

理由：
1. 语义干净，专款专用，不与「系统管理员 imAdmin」混淆。
2. type=4 当前零占用，从零开类型无冲突，正是新建专用账号的好时机。
3. 后端注册成本极低：用管理员 token 调 `POST :10002/user/user_register` 注册一个普通用户即可，无需特殊配置。

备选方案 A：复用 `imAdmin`。零成本、立即可用，但语义混；若 imAdmin 将来用于其它管理动作，会话内容会混入。**不推荐**。

> 待后端确认：① 账号 ID 最终取名（建议 `system_notification`）；② 由谁/用哪条接口下发 type=4 通知消息（建议后端服务用该账号 sendID 调 OpenIM 发消息接口，向目标用户推送）。

---

## 四、前端改动点（精确到文件/行）

### 1. 常量（新增）
`electron-client/app/src/constants/im.ts`
```ts
export const SYSTEM_NOTIFICATION_USER_ID = "system_notification"; // 与后端账号 ID 一致
```

### 2. 登录同步完成后：确保会话存在并置顶（主改动）
`electron-client/app/src/layout/useGlobalEvents.tsx` 的 `syncFinishHandler`（第 463 行起）。
插入点：在 `while(hasMore)` 全量会话分页拉完、`const list = useConversationStore.getState().conversationList` 之后。

```ts
// 伪代码，落地按现有写法对齐
try {
  const { data: conv } = await IMSDK.getOneConversation({
    sessionType: SessionType.Notification,
    sourceID: SYSTEM_NOTIFICATION_USER_ID,
  });
  if (conv) {
    if (!conv.isPinned) {
      await IMSDK.pinConversation({ conversationID: conv.conversationID, isPinned: true });
    }
    useConversationStore.getState().pushConversationList([conv]);
  }
} catch (e) {
  // 账号未建/无会话时 getOneConversation 抛错：不兜底，列表不显示该容器（符合预期）
}
```
说明：`getOneConversation` 即使无历史消息也会返回会话，这是「空也要固定显示」的关键。**置顶逻辑必须放在全量会话拉取完成之后**，否则会被后续分页结果覆盖排序。

### 3. 绝对第一行（排序特判）
`electron-client/app/src/utils/imCommon.ts:629` `conversationSort`。
现状：`isPinned` 优先，但**多个置顶项之间按最新消息时间排**——无法保证系统通知恒在最顶。
改动：在比较函数最前面加特判，命中系统通知会话的 `conversationID`（或 `userID === SYSTEM_NOTIFICATION_USER_ID`）的一方恒排最前（返回 -1 / 1），优先级高于 isPinned。

### 4. 展示名与图标 override（UI 定制）
`electron-client/app/src/pages/chat/ConversationSider/ConversationItem.tsx`
- 标题 `{conversation.showName}` 与 `OIMAvatar` 的 `src`/`text`，对 `conversation.userID === SYSTEM_NOTIFICATION_USER_ID` 强制显示「系统通知」名称与专属图标。
- 已有先例：当前 agent 会话用 `agentInfo?.nickname || conversation.showName` override，照此模式即可。

### 5. 禁止删除/取消置顶（UI 定制）
`electron-client/app/src/pages/chat/ConversationSider/ConversationMenuContent.tsx`
- 对系统通知会话，隐藏「置顶/取消置顶」MenuItem 与底部红色「隐藏」MenuItem，保证其真正固定、不可被用户移除。

---

## 五、不需要改动的部分

`ChatContent` 渲染、`SystemNotification` 组件、`queryChat` 只读输入框逻辑——通知会话天然只读、自动用通知组件渲染，全部复用，不动。

---

## 六、风险与边界

1. **多置顶项排序**（已在四.3处理）：不加特判则系统通知只是「置顶组内按时间排」，当用户置顶了其它有新消息的会话时会被挤下去。要「绝对第一行」必须改 `conversationSort`。
2. **`pushConversationList` 分组副作用**：`store/conversation.ts:385` 仅在 `activeConversationGroup === 全部` 时同步 `displayConversationList`。同步刚完成时用户通常在「全部」分组，问题不大；若严谨需确认或改用 `updateConversationList`（对 all+display 双写）。
3. **账号未建好时**：`getOneConversation` 抛错 → 列表不显示该容器。这是预期行为，不加前端兜底。
4. **多设备/重装**：依赖 SDK 同步，每次 `syncFinish` 重新确保一次，天然幂等。

---

## 七、落地顺序建议

1. 后端确认并建好 `system_notification` 账号，向某测试用户推一条 type=4 通知（验证会话能冒出来）。
2. 前端：常量 → syncFinish 确保+置顶 → conversationSort 绝对置顶特判 → ConversationItem 名称/图标 → 菜单禁删禁取消置顶。
3. 前后端联调：空会话显示、绝对置顶、只读、不可删除四项验收。

> 前端与后端账号解耦：前端代码可先行落地，账号未就绪时列表暂不显示该容器，不阻塞。
