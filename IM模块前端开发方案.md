# IM 模块前端开发方案

> **日期**：2026-02-26
> **目标**：在资舟量化研究平台（Electron + Vue 3）中集成 IM 聊天功能
> **后端状态**：AI Bridge v4 已部署就绪，支持单聊、群聊、上下文会话、typing 状态通知

---

## 1. 整体方案

在现有平台中新增 IM 模块，侧边栏增加"智能助手"菜单项。用户进入后看到会话列表，点击某个会话进入聊天窗口，可以和 AI 智能体或其他用户对话。

**不改动现有代码**，仅新增文件和依赖。

### 技术选型

| 层面 | 方案 | 说明 |
|------|------|------|
| IM SDK | `@openim/wasm-client-sdk` | OpenIM 官方 Web SDK，处理登录、会话、消息收发 |
| 聊天 UI | `vue-element-plus-x` | Element Plus 生态的 AI 聊天组件库，提供气泡、会话列表、输入框、Markdown 渲染等 |
| 状态管理 | Pinia | IM 模块使用独立的 Pinia Store |

### 核心开源依赖详情

#### 1. vue-element-plus-x（聊天 UI 组件库）

- **GitHub**：https://github.com/HeJiaYue520/Element-Plus-X （1300+ star，活跃维护中）
- **npm**：`vue-element-plus-x`，当前最新版 v1.3.7
- **官方文档**：https://element-plus-x.com
- **在线 Demo**：https://chat.element-plus-x.com
- **选型理由**：
  - 专为 Vue 3 + Element Plus 设计，与我们现有前端技术栈完全一致
  - 提供开箱即用的 AI 聊天组件，不需要从零开发聊天界面
  - 支持按需导入，不会增加太多包体积

**我们要用到的组件**：

| 组件 | 用途 | 文档 |
|------|------|------|
| `Conversations` | 左侧会话列表（v1.2.0 新增） | https://element-plus-x.com/components/conversations/ |
| `BubbleList` | 聊天消息列表 | https://element-plus-x.com/components/bubbleList/ |
| `Bubble` | 单条消息气泡 | https://element-plus-x.com/components/bubble/ |
| `Sender` | 消息输入框（支持语音） | https://element-plus-x.com/components/sender/ |
| `Thinking` | AI 思考/typing 状态 | https://element-plus-x.com/components/thinking/ |
| `XMarkdown` | Markdown 渲染（v1.3.0 新增，内置代码高亮） | https://element-plus-x.com/components/xMarkdown/ |
| `Welcome` | 空会话时的欢迎引导页 | https://element-plus-x.com/components/welcome/ |
| `Typewriter` | 打字机逐字动画（可选） | https://element-plus-x.com/components/typewriter/ |

> **注意**：v1.3.0 新增的 `XMarkdown` 组件已内置 Markdown 渲染和代码高亮，可以替代 `markdown-it` + `highlight.js`，减少额外依赖。建议优先使用 `XMarkdown`，如不满足需求再手动引入 markdown-it。

#### 2. @openim/wasm-client-sdk（OpenIM 即时通讯 SDK）

- **GitHub**：https://github.com/openimsdk/open-im-sdk-web-wasm
- **npm**：`@openim/wasm-client-sdk`，当前最新版 v3.8.3-patch.3
- **官方文档**：https://docs.openim.io/sdks/quickstart/browser
- **选型理由**：
  - OpenIM 官方出品，与我们后端 OpenIM v3.8.3 服务端版本匹配
  - 基于 WebAssembly（Go 编译），性能好，自带 TypeScript 类型声明
  - 数据存储使用虚拟化 SQLite（IndexedDB），支持离线消息缓存
  - 0 外部依赖，集成简单
- **注意事项**：
  - 需要将 WASM 静态资源（openIM.wasm、sql-wasm.wasm、wasm_exec.js）复制到 public 目录
  - `wasm_exec.js` 必须通过 `<script>` 标签在 index.html 中引入，不能用 import

---

## 2. 需要安装的依赖

```bash
# IM SDK（版本需与服务端 v3.8.3 匹配）
npm install @openim/wasm-client-sdk

# 聊天 UI 组件库（>= 1.3.0，需要 Conversations 和 XMarkdown 组件）
npm install vue-element-plus-x
```

> 如果 `XMarkdown` 组件不能满足 Markdown 渲染需求，可额外安装：
> ```bash
> npm install markdown-it highlight.js
> npm install -D @types/markdown-it
> ```

---

## 3. OpenIM SDK 集成

### 3.1 WASM 静态资源

安装 `@openim/wasm-client-sdk` 后，将以下文件从 `node_modules/@openim/wasm-client-sdk/assets/` 复制到 `public/` 目录：

```
public/
├── openIM.wasm
├── sql-wasm.wasm
└── wasm_exec.js
```

在 `index.html` 中引入：

```html
<script src="./wasm_exec.js"></script>
```

### 3.2 连接配置

> **重要**：OpenIM 服务运行在内网（192.168.30.11），通过公网 IP `61.151.241.233` 的 Nginx 反向代理暴露。
>
> | 内网地址 | 公网反代地址 |
> |----------|-------------|
> | 192.168.30.11:10002 (HTTP) | `http://61.151.241.233:8080/api/im/` |
> | 192.168.30.11:10001 (WebSocket) | `ws://61.151.241.233:8080/ws/im/` |
> | 192.168.30.11:10008 (HTTP) | `http://61.151.241.233:8080/api/im-chat/` |

```typescript
// src/renderer/config/imConfig.ts

export const IM_CONFIG = {
  apiAddr: 'http://61.151.241.233:8080/api/im',
  wsAddr: 'ws://61.151.241.233:8080/ws/im',
  chatAddr: 'http://61.151.241.233:8080/api/im-chat',
  platformID: 5,  // Windows 客户端
}
```

### 3.3 SDK 初始化与登录

```typescript
// src/renderer/services/imService.ts

import { getSDK, CbEvents } from '@openim/wasm-client-sdk'

const OpenIM = getSDK()

// 初始化
export async function initIM() {
  await OpenIM.login({
    userID: '<当前用户的 IM UserID>',
    token: '<从 OpenIM Chat 服务获取的 user token>',
    platformID: IM_CONFIG.platformID,
    apiAddr: IM_CONFIG.apiAddr,
    wsAddr: IM_CONFIG.wsAddr,
  })
}

// 监听事件
OpenIM.on(CbEvents.OnConnectSuccess, () => { /* 连接成功 */ })
OpenIM.on(CbEvents.OnConnectFailed, (err) => { /* 连接失败 */ })
OpenIM.on(CbEvents.OnKickedOffline, () => { /* 被踢下线 */ })
OpenIM.on(CbEvents.OnRecvNewMessages, (messages) => { /* 收到新消息 */ })
OpenIM.on(CbEvents.OnConversationChanged, (conversations) => { /* 会话变更 */ })

export { OpenIM }
```

### 3.4 用户 Token 获取（已有后端接口）

前端通过现有 API Gateway 接口直接获取 IM 凭证，**不需要直接调用 OpenIM API**：

```
GET /api/v1/account/im-token
Header: X-API-Key: <当前用户的API Key>
```

**成功响应**（首次调用会自动创建 IM 账号，后续直接返回）：

```json
{
  "success": true,
  "userID": "im_a3b2c1d4e5f6",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expireTimeSeconds": 86400
}
```

> **自动创建机制**：如果该 API Key 还没有关联 IM 账号，后端会自动完成以下操作：
> 1. 基于 API Key 生成唯一的 OpenIM userID（`im_` + 12位哈希）
> 2. 调用 OpenIM 注册接口创建用户（昵称取自 API Key 名称，手机号取自 API Key metadata 的 `phone` 字段）
> 3. 将 userID 保存到 API Key 的 metadata 中
> 4. 如果配置了默认好友（如 IT 支持），自动添加好友关系
> 5. 返回 token
>
> 整个过程对前端透明，**前端只需调用一次接口**，不需要关心用户是否已有 IM 账号。

**前端使用流程**：

1. 用户进入"智能助手"页面时，调用 `GET /api/v1/account/im-token`（带现有 X-API-Key）
2. 接口一定返回 `userID` 和 `token`（首次自动创建，后续直接获取）
3. 拿到凭证后调用 OpenIM SDK 的 `login()` 方法
4. Token 有效期较长，但建议每次进入 IM 页面时重新获取以确保有效

**前端代码示例**：

```typescript
import { IM_CONFIG } from '@/config/imConfig'
import { OpenIM } from '@/services/imService'
import { apiRequest } from '@/utils/request' // 现有的请求封装

async function connectIM() {
  const { data } = await apiRequest.get('/api/v1/account/im-token')
  if (!data.success) {
    console.error('IM 登录失败:', data.error)
    return false
  }

  await OpenIM.login({
    userID: data.userID,
    token: data.token,
    platformID: IM_CONFIG.platformID,
    apiAddr: IM_CONFIG.apiAddr,
    wsAddr: IM_CONFIG.wsAddr,
  })
  return true
}
```

> **说明**：IM 账号完全自动创建，管理员只需为 API Key 分配 `im_assistant` 菜单权限即可。昵称默认取 API Key 的名称，手机号取自 API Key 的 `phone` 字段。后续会支持用户自行修改个人资料。

---

## 4. 新增文件结构

```
src/renderer/
├── views/
│   └── IM/                           # IM 模块页面
│       ├── index.vue                 # IM 主页面（左右分栏布局）
│       ├── ConversationList.vue      # 左侧：会话列表
│       ├── ChatWindow.vue            # 右侧：聊天窗口
│       ├── ChatMessage.vue           # 单条消息组件
│       ├── FriendSearch.vue           # 手机号搜索用户、发送好友申请
│       ├── FriendRequests.vue        # 好友申请列表（收到的/发出的）
│       ├── FriendList.vue            # 好友列表
│       ├── UserProfile.vue           # 个人资料修改（昵称、手机号、头像）
│       └── GroupInfo.vue             # 群信息面板
├── services/
│   └── imService.ts                  # OpenIM SDK 封装
├── stores/
│   └── imStore.ts                    # IM Pinia Store
├── config/
│   └── imConfig.ts                   # IM 连接配置
└── utils/
    └── markdown.ts                   # Markdown 渲染工具
```

---

## 5. 路由配置

在 `src/renderer/router/index.ts` 中新增：

```typescript
{
  path: '/im',
  name: 'IM',
  component: () => import('../views/IM/index.vue'),
  meta: { menuId: 'im' },
  children: [
    {
      path: '',
      name: 'IMDefault',
      component: () => import('../views/IM/ConversationList.vue'),
      meta: { menuId: 'im' }
    },
    {
      path: 'chat/:conversationID',
      name: 'IMChat',
      component: () => import('../views/IM/ChatWindow.vue'),
      meta: { menuId: 'im' }
    },
    {
      path: 'friends',
      name: 'IMFriends',
      component: () => import('../views/IM/FriendList.vue'),
      meta: { menuId: 'im' }
    },
    {
      path: 'friend-search',
      name: 'IMFriendSearch',
      component: () => import('../views/IM/FriendSearch.vue'),
      meta: { menuId: 'im' }
    },
    {
      path: 'friend-requests',
      name: 'IMFriendRequests',
      component: () => import('../views/IM/FriendRequests.vue'),
      meta: { menuId: 'im' }
    },
    {
      path: 'profile',
      name: 'IMProfile',
      component: () => import('../views/IM/UserProfile.vue'),
      meta: { menuId: 'im' }
    }
  ]
}
```

---

## 6. 菜单权限配置

### 6.1 后端已完成

菜单已注册到 API Gateway 的权限注册表（`api_gateway/data/permission_registry.json`）：

```json
{
  "id": "im_assistant",
  "name": "智能助手",
  "description": "AI智能助手，支持与AI智能体对话、群聊协作",
  "level": 1,
  "order": 3,
  "icon": "ChatDotRound",
  "path": "/im",
  "category": "menu"
}
```

管理员需要在前端"API Key 管理"页面为对应的 Key 分配 `im_assistant` 菜单权限，用户才能在侧边栏看到"智能助手"。

### 6.2 前端路由

前端路由中的 `menuId` 需要与后端注册的菜单 `id` 一致（`im_assistant`），确保权限过滤能正确匹配：

```typescript
{
  path: '/im',
  name: 'IM',
  component: () => import('../views/IM/index.vue'),
  meta: { menuId: 'im_assistant' },
  // ...children
}
```

> **注意**：前端不需要在 `menuConfig.ts` 中手动添加菜单项。侧边栏菜单由后端 `/api/v1/account/menus` 接口返回，前端根据 `/api/v1/account/my-menus` 的权限过滤显示。

---

## 7. Pinia Store

```typescript
// src/renderer/stores/imStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { OpenIM } from '@/services/imService'

export const useIMStore = defineStore('im', () => {
  const conversations = ref([])       // 会话列表
  const currentConversation = ref(null) // 当前会话
  const messages = ref([])             // 当前会话消息
  const isConnected = ref(false)       // 连接状态
  const typingUsers = ref(new Map())   // 正在输入的用户 Map<conversationID, userID[]>
  const unreadTotal = ref(0)           // 未读消息总数

  // 获取会话列表
  async function loadConversations() {
    const { data } = await OpenIM.getConversationListSplit({
      offset: 0,
      count: 100,
    })
    conversations.value = data
  }

  // 获取历史消息
  async function loadMessages(conversationID: string, startClientMsgID = '') {
    const { data } = await OpenIM.getAdvancedHistoryMessageList({
      conversationID,
      startClientMsgID,
      count: 20,
      lastMinSeq: 0,
    })
    messages.value = startClientMsgID
      ? [...data.messageList, ...messages.value]
      : data.messageList
  }

  // 发送文本消息
  async function sendTextMessage(recvID: string, groupID: string, text: string) {
    const message = await OpenIM.createTextMessage(text)
    await OpenIM.sendMessage({
      message,
      recvID,
      groupID,
      offlinePushInfo: {
        title: '新消息',
        desc: text.slice(0, 50),
      },
    })
  }

  return {
    conversations, currentConversation, messages,
    isConnected, typingUsers, unreadTotal,
    loadConversations, loadMessages, sendTextMessage,
  }
})
```

---

## 8. 核心页面实现

### 8.1 IM 主页面（左右分栏）

```vue
<!-- src/renderer/views/IM/index.vue -->
<template>
  <div class="im-container">
    <div class="im-sidebar">
      <ConversationList @select="onSelectConversation" />
    </div>
    <div class="im-main">
      <router-view v-if="currentConversation" />
      <div v-else class="im-empty">
        <el-empty description="选择一个会话开始聊天" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.im-container {
  display: flex;
  height: 100%;
}
.im-sidebar {
  width: 280px;
  border-right: 1px solid var(--el-border-color-lighter);
  overflow-y: auto;
}
.im-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.im-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
```

### 8.2 聊天窗口（使用 Element-Plus-X）

```vue
<!-- src/renderer/views/IM/ChatWindow.vue -->
<template>
  <div class="chat-window">
    <!-- 顶部：会话标题 -->
    <div class="chat-header">
      <span>{{ conversationName }}</span>
    </div>

    <!-- 消息列表 -->
    <div class="chat-body" ref="chatBodyRef">
      <BubbleList :list="bubbleList" :roles="roles" />

      <!-- Typing 状态 -->
      <div v-if="isTyping" class="typing-indicator">
        <Thinking text="正在输入" />
      </div>
    </div>

    <!-- 输入框 -->
    <div class="chat-footer">
      <Sender
        placeholder="输入消息..."
        :loading="sending"
        @submit="onSend"
      />
    </div>
  </div>
</template>

<script setup>
import { BubbleList, Sender, Thinking } from 'vue-element-plus-x'
import { computed, ref, watch } from 'vue'
import { useIMStore } from '@/stores/imStore'
import { renderMarkdown } from '@/utils/markdown'

const imStore = useIMStore()

// 将 OpenIM 消息转换为 BubbleList 的 list 格式
const bubbleList = computed(() =>
  imStore.messages.map(msg => ({
    content: msg.contentType === 101
      ? renderMarkdown(JSON.parse(msg.content).content)
      : msg.content,
    role: msg.sendID === currentUserID ? 'user' : 'assistant',
    avatar: msg.senderFaceUrl || '',
    name: msg.senderNickname,
  }))
)

const roles = {
  user: { placement: 'right' },
  assistant: { placement: 'left' },
}

async function onSend(text) {
  await imStore.sendTextMessage(recvID, groupID, text)
}
</script>
```

---

## 9. Typing 状态处理

AI Bridge 在处理消息时会发送 **contentType 110** 的自定义在线消息作为 typing 状态通知。

### 消息格式

```json
{
  "contentType": 110,
  "isOnlineOnly": true,
  "content": {
    "data": "{\"type\":\"typing\",\"status\":\"start\"}",
    "description": "typing",
    "extension": ""
  }
}
```

### 前端处理逻辑

在 `OnRecvNewMessages` 回调中识别 contentType 110：

```typescript
OpenIM.on(CbEvents.OnRecvNewMessages, (data) => {
  const messages = JSON.parse(data)
  messages.forEach(msg => {
    if (msg.contentType === 110) {
      // 自定义消息：解析 typing 状态
      try {
        const custom = JSON.parse(msg.content)
        const typingData = JSON.parse(custom.data)
        if (typingData.type === 'typing') {
          if (typingData.status === 'start') {
            // 显示 "xxx 正在输入..."
            imStore.setTyping(msg.conversationID, msg.sendID, true)
          } else if (typingData.status === 'stop') {
            // 隐藏 typing 状态
            imStore.setTyping(msg.conversationID, msg.sendID, false)
          }
        }
      } catch (e) { /* 非 typing 消息，忽略 */ }
    } else {
      // 普通消息：更新消息列表
      imStore.onNewMessage(msg)
    }
  })
})
```

### UI 展示

使用 Element-Plus-X 的 `Thinking` 组件：

```vue
<Thinking v-if="isTyping" text="正在输入" />
```

> **可扩展**：未来 AI Bridge 可能发送更多状态类型（`thinking`、`searching` 等），前端根据 `typingData.type` 判断展示不同的状态组件。

---

## 10. Markdown 渲染

AI 智能体的回复是 Markdown 格式，需要渲染：

```typescript
// src/renderer/utils/markdown.ts

import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang }).value
    }
    return ''
  },
})

export function renderMarkdown(text: string): string {
  return md.render(text)
}
```

聊天气泡中使用 `v-html` 渲染：

```vue
<Bubble>
  <div v-html="renderMarkdown(message.content)" class="markdown-body" />
</Bubble>
```

引入 highlight.js 的样式：

```scss
// src/renderer/styles/global.scss
@import 'highlight.js/styles/github.css';
```

---

## 11. 服务端地址汇总

### 内网地址（仅运维参考）

| 服务 | 内网地址 | 协议 | 说明 |
|------|----------|------|------|
| OpenIM API | 192.168.30.11:10002 | HTTP | REST API |
| OpenIM WebSocket | 192.168.30.11:10001 | WebSocket | 实时消息 |
| OpenIM Chat | 192.168.30.11:10008 | HTTP | 用户登录注册 |
| OpenIM Web Demo | 192.168.30.11:11001 | HTTP | 官方 Web 前端（可参考交互） |
| OpenIM 管理后台 | 192.168.30.11:11002 | HTTP | 管理后台（用户/群组管理） |
| AI Bridge | 192.168.20.100:30100 | HTTP | 消息代理（前端不直接调用） |

### 前端实际使用的公网地址

| 服务 | 公网地址 | 说明 |
|------|----------|------|
| OpenIM API | `http://61.151.241.233:8080/api/im/` | 反代 → 192.168.30.11:10002 |
| OpenIM WebSocket | `ws://61.151.241.233:8080/ws/im/` | 反代 → 192.168.30.11:10001 |
| OpenIM Chat | `http://61.151.241.233:8080/api/im-chat/` | 反代 → 192.168.30.11:10008 |

> **前端只需连接上面 3 个公网地址**，不需要直接调用 AI Bridge。AI 回复通过 OpenIM 消息自动投递到客户端。
>
> 这 3 个路径由 **API Gateway 直接路由**（反向代理到内网 OpenIM 服务），无需额外配置 Nginx。建议后续全部启用 HTTPS/WSS。

---

## 12. 用户账号对接方案（已实现后端接口）

后端已提供 `GET /api/v1/account/im-token` 接口，前端通过现有 API Key 自动获取 IM 凭证，**用户无需手动配置**。

### 对接流程（全自动）

1. 用户进入"智能助手"页面
2. 前端调用 `GET /api/v1/account/im-token`（复用现有 X-API-Key 认证）
3. 后端自动处理：
   - 首次调用：自动创建 OpenIM 用户 → 保存到 API Key metadata → 生成 token → 返回
   - 后续调用：直接读取已绑定的 userID → 生成 token → 返回
4. 前端拿到 `userID` + `token` 后登录 OpenIM SDK

### 管理员操作

管理员只需在菜单权限中勾选 `im_assistant`（智能助手），IM 账号由系统自动创建，**无需手动配置**。

### 前端不需要额外处理

- 不需要 Settings 页面配置 IM 账号
- 不需要处理"未关联账号"的情况（系统自动创建）
- 只需在 IM 模块入口调用一次 `im-token` 接口即可

---

## 13. 好友机制与用户搜索

### 13.1 好友申请制

用户之间采用 **好友申请制**，需要对方同意后才能单聊。OpenIM SDK 原生支持完整的好友流程：

| SDK 方法 | 说明 |
|----------|------|
| `searchUsersByKeyword` | 按手机号/昵称搜索用户 |
| `addFriend` | 发送好友申请 |
| `getFriendApplicationListAsRecipient` | 获取收到的好友申请 |
| `acceptFriendApplication` | 同意好友申请 |
| `refuseFriendApplication` | 拒绝好友申请 |
| `getFriendList` | 获取好友列表 |
| `deleteFriend` | 删除好友 |

### 13.2 用户搜索（手机号）

用户通过 **手机号** 搜索其他用户并发送好友申请。后端在自动注册 IM 用户时已将手机号写入 OpenIM 用户资料的 `phoneNumber` 字段。

**前端搜索示例**：

```typescript
// 通过手机号搜索用户
async function searchByPhone(phone: string) {
  const { data } = await OpenIM.searchUsersByKeyword({
    keywordList: [phone],
    isSearchUserID: false,
    isSearchNickname: false,
    isSearchRemark: false,
  })
  return data  // 返回匹配的用户列表
}
```

> **注意**：手机号来源于 API Key 的 `phone` 字段，管理员在创建 API Key 时需要填写。如果用户的手机号为空，则无法被搜索到。

### 13.3 默认好友

新用户自动注册 IM 账号时，后端会自动将其与预设的 **默认好友**（如 IT 支持）建立好友关系，用户进入 IM 即可直接与 IT 支持沟通，无需手动添加。

### 13.4 前端 UI 要点

1. **搜索入口**：在联系人/会话页面提供搜索框，用户输入手机号搜索
2. **搜索结果**：显示匹配用户的昵称和头像，提供"添加好友"按钮
3. **好友申请**：支持填写验证消息，发送后等待对方处理
4. **申请通知**：监听 `OnFriendApplicationAdded` 事件，收到新申请时弹出通知
5. **申请列表**：提供好友申请管理页面，可同意/拒绝申请

```typescript
// 监听好友申请事件
OpenIM.on(CbEvents.OnFriendApplicationAdded, (data) => {
  const application = JSON.parse(data)
  // 弹出通知或更新申请列表
  ElNotification({
    title: '新的好友申请',
    message: `${application.fromNickname} 请求添加你为好友`,
  })
})
```

### 13.5 个人资料修改

用户可以修改自己的昵称和头像，通过 OpenIM SDK：

```typescript
// 修改个人资料（仅允许昵称和头像）
await OpenIM.setSelfInfo({
  nickname: '新昵称',
  faceURL: 'https://...',
})
```

> **⚠️ 手机号禁止修改**：手机号是生成 IM 用户 ID 的唯一依据（`im_` + SHA256(手机号) 前12位）。如果用户修改了手机号，下次登录时系统会根据新手机号算出不同的 ID，导致原账号的好友关系、会话记录、消息历史全部丢失。前端必须将手机号字段设为 **disabled 只读显示**，不允许用户编辑。

前端可在 IM 设置页面或用户头像处提供入口。

---

## 14. 开发优先级

### P0（必须完成）

1. **OpenIM SDK 集成**：初始化、登录、事件监听
2. **会话列表**：展示所有会话，显示最近消息、未读数
3. **聊天窗口**：消息展示（BubbleList）、文本发送（Sender）
4. **用户搜索与好友申请**：手机号搜索用户、发送/接收好友申请、好友列表
5. **Typing 状态**：识别 contentType 110，展示"正在输入..."
6. **Markdown 渲染**：AI 回复的格式化展示

### P1（优先完成）

7. **好友申请管理**：好友申请列表、同意/拒绝、申请通知
8. **个人资料修改**：修改昵称、头像（手机号只读，禁止修改）
9. **历史消息加载**：上滑加载更多
10. **群聊支持**：群会话列表、群消息展示
11. **未读消息徽标**：侧边栏"智能助手"菜单显示未读总数
12. **消息通知**：收到新消息时系统通知（Electron Notification API）

### P1.5（输入框增强 — 后端已就绪）

13. **发送图片**：支持选择图片、粘贴截图发送（SDK `createImageMessageByFile`）
14. **发送文件/附件**：支持 pdf/doc/xls/zip/csv/parquet 等（SDK `createFileMessageByFile`）
15. **语音消息**：使用 MediaRecorder 录音，上传后通过 `createSoundMessageByURL` 发送
16. **@提及**：群聊中 @成员（SDK `createTextAtMessage`），成员列表通过 `getGroupMemberList` 获取
17. **引用回复**：长按/右键消息引用回复（SDK `createQuoteMessage`）
18. **表情选择器**：选中 Unicode 表情插入文本发送，纯前端实现

### P2（后续迭代）

19. **消息搜索**：按关键词搜索历史消息
20. **多状态类型**：支持 `thinking`、`searching` 等更多状态展示
21. **AI 智能体列表**：查看所有可用的 AI 智能体

---

## 15. 文件上传与多媒体消息

### 15.1 后端文件存储架构

文件上传通过 OpenIM SDK 内部处理，存储在 MinIO 对象存储中，前端无需直接对接 MinIO：

```
SDK sendMessage → API Gateway (/api/im/) → OpenIM Server → MinIO (192.168.30.11:9000)
文件下载 URL → API Gateway (/openim/) → MinIO (透明代理)
```

| 配置项 | 值 |
|--------|-----|
| 上传入口 | SDK 内部调用 `http://61.151.241.233:8080/api/im/object/initiate_form_data` |
| 文件存储 | MinIO，bucket: `openim`，公开可读 |
| 下载 URL 格式 | `http://61.151.241.233:8080/openim/openim/direct/{date}/{userID}/{hash}.{ext}` |
| 支持 Range 请求 | ✅ 支持（音频进度条拖拽必需） |
| CORS | ✅ 已配置，允许 `Range` 请求头，暴露 `Content-Range`、`Accept-Ranges` |
| 文件大小限制 | 无硬限制，建议图片 10MB、文件 100MB、语音 5MB |

### 15.2 图片消息

```typescript
// 选择图片文件后
const imageFile: File = event.target.files[0]

const picBaseInfo = {
  uuid: crypto.randomUUID(),
  type: imageFile.type,
  size: imageFile.size,
  width: 1024,  // 实际应读取图片尺寸
  height: 768,
  url: '',
}

const { data: message } = await OpenIM.createImageMessageByFile({
  sourcePicture: picBaseInfo,
  bigPicture: picBaseInfo,
  snapshotPicture: picBaseInfo,
  sourcePath: '',
  file: imageFile,
})

await OpenIM.sendMessage({
  recvID: targetUserID,  // 单聊
  groupID: '',
  message,
})
```

> 截图粘贴：监听输入框 `paste` 事件，从 `clipboardData.items` 中获取 `image/*` 类型的 `File` 对象，同上流程。

### 15.3 文件/附件消息

```typescript
const file: File = event.target.files[0]

const { data: message } = await OpenIM.createFileMessageByFile({
  filePath: '',
  fileName: file.name,
  uuid: crypto.randomUUID(),
  sourceUrl: '',
  fileSize: file.size,
  fileType: file.type,
  file: file,
})

await OpenIM.sendMessage({ recvID, groupID: '', message })
```

### 15.4 语音消息

前端录音方案（Electron/Chromium 环境）：

```typescript
// 开始录音
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const recorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
})
const chunks: Blob[] = []
recorder.ondataavailable = (e) => chunks.push(e.data)

recorder.start()

// 停止录音（用户松开按钮时）
recorder.stop()
const audioBlob = new Blob(chunks, { type: 'audio/webm' })
const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
  type: 'audio/webm',
})

// 上传语音文件 → 获取 URL → 创建语音消息
// 方式一：使用 createSoundMessageByFile（SDK 自动上传）
const { data: message } = await OpenIM.createSoundMessageByFile({
  uuid: crypto.randomUUID(),
  soundPath: '',
  sourceUrl: '',
  dataSize: audioFile.size,
  duration: recordingDuration, // 秒
  soundType: 'audio/webm',
  soundFile: audioFile,
})

await OpenIM.sendMessage({ recvID, groupID: '', message })
```

**录音格式**：WebM + Opus（Chromium 原生支持，无需额外编解码库），1 分钟约 0.3~0.5MB。

**接收端播放**：使用 `<audio>` 标签，`src` 设为消息体中 `soundElem.sourceUrl`，后端已支持 Range 请求和正确的 `Content-Type`。

### 15.5 @提及（群聊）

```typescript
// 获取群成员列表（用于 @ 输入时的下拉选择）
const { data } = await OpenIM.getGroupMemberList({
  groupID,
  offset: 0,
  count: 100,
  filter: 0,  // 0=全部
})

// 创建 @消息
const { data: message } = await OpenIM.createTextAtMessage({
  text: '@张三 你好',
  atUserIDList: ['im_abc123'],       // 被 @ 的用户 ID 列表
  atUsersInfo: [{
    atUserID: 'im_abc123',
    groupNickname: '张三',
  }],
  message: undefined,  // 非引用消息时传 undefined
})

await OpenIM.sendMessage({ recvID: '', groupID, message })
```

### 15.6 引用回复

```typescript
// quotedMessage 是被引用的完整消息对象（从消息列表中获取）
const { data: message } = await OpenIM.createQuoteMessage({
  text: '同意你的观点',
  message: quotedMessage,
})

await OpenIM.sendMessage({ recvID, groupID: '', message })
```

---

## 16. 参考资源

| 资源 | 链接 | 说明 |
|------|------|------|
| vue-element-plus-x 文档 | https://element-plus-x.com | 组件 API、示例 |
| vue-element-plus-x 在线 Demo | https://chat.element-plus-x.com | 可直接体验聊天交互效果 |
| vue-element-plus-x GitHub | https://github.com/HeJiaYue520/Element-Plus-X | 源码、Issue |
| OpenIM SDK 文档 | https://docs.openim.io/sdks/quickstart/browser | SDK 初始化、API 参考 |
| OpenIM SDK GitHub | https://github.com/openimsdk/open-im-sdk-web-wasm | 源码、WASM 资源 |
| OpenIM 官方 Web Demo | https://github.com/openimsdk/openim-h5-demo | Vue 3 示例项目，可参考集成方式 |

> 各组件的详细 API 和用法已在第 1 节「核心开源依赖详情」中列出，不再重复。

---

## 17. 注意事项

1. **WASM 文件必须放到 public 目录**，否则 SDK 初始化会失败
2. **`wasm_exec.js` 必须在 index.html 中通过 script 标签引入**，不能通过 import 引入
3. **OpenIM SDK 是单例**，全局只初始化一次，建议在 App.vue 的 onMounted 中初始化
4. **contentType 110 的消息是 `isOnlineOnly`**，不会存在消息历史中，仅在线接收
5. **Electron 中 WebSocket 连接**：确保 Electron 的 CSP 策略允许连接 `ws://61.151.241.233:8080`（未来升级 HTTPS 后改为 `wss://`）
6. **AI 回复可能很长**（几百上千字），聊天窗口需要做好滚动和性能优化
7. **群聊中多个 AI 可能同时回复**，typing 状态需要支持同时显示多个用户"正在输入"
8. **手机号字段必须只读**：个人资料页的手机号必须设为 disabled，不允许用户修改。手机号是 IM 用户 ID 的生成依据，修改后会导致账号身份错乱
9. **文件上传由 SDK 处理**：前端不需要直接调用 MinIO API，SDK 的 `createXxxMessageByFile` 方法会自动完成上传并生成可访问的 URL
10. **语音录音格式**：Chromium 环境只支持 `audio/webm;codecs=opus`，无需引入其他编解码库
11. **音频播放需要 Range 支持**：后端已配置，前端使用原生 `<audio>` 标签即可正常播放和拖拽进度条
