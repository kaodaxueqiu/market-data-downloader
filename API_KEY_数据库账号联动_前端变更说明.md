# API Key 数据库账号联动 — 前端变更说明

> 更新日期：2026-11-07  
> 影响范围：API Key 管理页面（吊销/激活、列表展示）

---

## 一、变更概述

吊销/激活 API Key 时，后端现在会**自动同步停用/恢复**该 Key 绑定的 PostgreSQL 和 ClickHouse 数据库账号。前端无需额外调用数据库接口，操作结果直接包含在吊销/激活接口的响应中。

此次共涉及 4 个接口变更：

| 接口 | 方法 | 变更类型 |
|------|------|---------|
| `GET /api/v1/admin/apikeys` | GET | 响应新增 `database_accounts` 字段，移除 metadata 密码 |
| `PUT /api/v1/admin/apikeys/:key` | PUT | 新增保护：禁止修改数据库账号名 |
| `POST /api/v1/admin/apikeys/:key/revoke` | POST | 响应新增 `databaseAccounts` 字段 |
| `POST /api/v1/admin/apikeys/:key/reactivate` | POST | 响应新增 `databaseAccounts` 字段 |

---

## 二、接口变更详情

### 2.1 列表接口变更

**`GET /api/v1/admin/apikeys`**

**新增字段 `database_accounts`**，每条 Key 记录中包含其绑定的数据库账号及实时状态。**原 `metadata` 字段已移除**（不再返回密码等敏感信息）。

```json
// 响应示例（单条 Key）
{
  "key": "ak_0b7e76eb...",
  "masked_key": "ak_0b7e76e**********c62a59bac1",
  "name": "DR24",
  "status": "active",
  "email": "DR24@zi-zhou.com",
  "company": "资舟投资",
  "database_accounts": [
    {
      "engine": "postgresql",
      "username": "dr24",
      "state": "active"
    },
    {
      "engine": "clickhouse",
      "username": "dr24",
      "state": "active"
    }
  ]
}
```

**`database_accounts` 说明：**

- 如果该 Key 没有绑定数据库账号，`database_accounts` 为 `null` 或空数组，不显示。
- `state` 枚举值：

| 值 | 含义 |
|----|------|
| `active` | 账号正常，可登录 |
| `suspended` | 账号已停用（Key 被吊销时自动设置） |
| `not_found` | 账号在数据库中不存在（异常情况） |
| `unknown` | 查询失败，状态未知 |

**前端处理建议：**
- `active` → 绿色标签
- `suspended` → 红色/灰色标签
- `not_found` → 黄色警告标签
- Key 的 `status` 为 `inactive` 时，`state` 通常也是 `suspended`，两者一致

---

### 2.2 吊销接口变更

**`POST /api/v1/admin/apikeys/:key/revoke`**

**无请求体变化**，响应新增 `databaseAccounts` 数组，说明每个数据库账号的操作结果。

```json
// 响应示例
{
  "success": true,
  "message": "API key revoked successfully",
  "data": {
    "apiKeyId": "ak_d3145f6...",
    "status": "revoked",
    "databaseAccounts": [
      {
        "engine": "postgresql",
        "username": "yuyangceshi",
        "action": "suspend",
        "result": "suspended",
        "reason": "已停用，终止 0 个连接"
      },
      {
        "engine": "clickhouse",
        "username": "yuyangceshi",
        "action": "suspend",
        "result": "suspended",
        "reason": "已停用"
      }
    ]
  }
}
```

**`databaseAccounts` 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `engine` | string | `postgresql` 或 `clickhouse` |
| `username` | string | 数据库账号名 |
| `action` | string | 本次操作：`suspend` |
| `result` | string | 操作结果：`suspended` / `already_suspended` / `not_found` / `error` |
| `reason` | string | 人类可读的结果说明，可直接展示给管理员 |

> 如果该 Key 没有绑定数据库账号，`databaseAccounts` 为空数组 `[]`，不影响正常吊销流程。

**前端处理建议：**
- 吊销成功后，可在操作结果弹窗中展示 `databaseAccounts` 的状态，让管理员确认数据库账号已同步停用。
- `result` 为 `error` 时，Key 仍已吊销，但数据库账号停用失败，需提示管理员手动检查。

---

### 2.3 激活接口变更

**`POST /api/v1/admin/apikeys/:key/reactivate`**

**无请求体变化**，响应新增 `databaseAccounts` 数组，与吊销接口对称。

```json
// 响应示例
{
  "success": true,
  "message": "API key reactivated successfully",
  "data": {
    "apiKeyId": "ak_d3145f6...",
    "status": "active",
    "databaseAccounts": [
      {
        "engine": "postgresql",
        "username": "yuyangceshi",
        "action": "activate",
        "result": "active",
        "reason": "已激活"
      },
      {
        "engine": "clickhouse",
        "username": "yuyangceshi",
        "action": "activate",
        "result": "active",
        "reason": "已激活"
      }
    ]
  }
}
```

`action` 此时为 `activate`，`result` 为 `active` / `already_active` / `not_found` / `error`。

---

### 2.4 更新接口新增保护

**`PUT /api/v1/admin/apikeys/:key`**

新增限制：**不允许通过 PUT 修改 `metadata.postgresql_username` 或 `metadata.clickhouse_username`**。尝试修改时返回 403：

```json
// 403 响应示例
{
  "error": "不允许通过 PUT 修改数据库账号名",
  "hint": "postgresql_username 只能在创建 Key 时指定，不可修改"
}
```

**前端处理：**
- 编辑 Key 的表单中，`postgresql_username` 和 `clickhouse_username` 字段改为**只读展示**，不可编辑。
- 如果当前表单有这两个字段的编辑能力，移除即可。

---

## 三、`数据库用户列表`接口说明

**`GET /api/v1/admin/db-permissions/users?db_type=all`**

此接口无变更，`can_login` 字段含义不变：

- PostgreSQL：`true` 表示账号有 LOGIN 权限（可登录）
- ClickHouse：`true` 表示账号 host_ip 配置不为空（可登录）

`can_login: false` 即表示账号已被停用，与 API Key 列表中 `database_accounts[].state = "suspended"` 含义一致。

---

## 四、典型 UI 改动建议

### API Key 列表页

1. 每行新增「数据库账号」列，展示账号名和状态标签（`active`/`suspended`）。
2. 状态标签与 Key 的 `status` 联动：Key 为 `inactive` 时，账号标签通常也是 `suspended`。
3. 如果某 Key 没有数据库账号（`database_accounts` 为空），该列显示「—」。

### 吊销/激活操作

1. 操作成功后的确认弹窗，增加数据库账号同步结果的展示。
2. 如果 `result` 为 `error`，额外提示「数据库账号同步失败，请联系后端排查」。

### 编辑 Key 弹窗

1. `postgresql_username` 和 `clickhouse_username` 改为只读文本，不提供输入框。

---

## 五、接口地址汇总

```
基础 URL: http://192.168.30.20:8080
认证 Header: X-API-Key: <管理员 Key>

GET  /api/v1/admin/apikeys                          — 列表（含 database_accounts）
POST /api/v1/admin/apikeys/:key/revoke              — 吊销（自动停用 DB 账号）
POST /api/v1/admin/apikeys/:key/reactivate          — 激活（自动恢复 DB 账号）
PUT  /api/v1/admin/apikeys/:key                     — 更新（禁止改账号名）
GET  /api/v1/admin/db-permissions/users?db_type=all — 数据库用户列表（含绑定关系）
```
