# API Key 与数据库账号联动 — 后端需求

## 一、背景与目标

当前 API Key 创建时会同时生成 PostgreSQL / ClickHouse 的数据库账号，但两者的生命周期是割裂的：

- 吊销 API Key 只改 Key 自身状态，数据库账号仍可正常登录
- 数据库账号还能在「控制中心 → 数据库管理」里被独立创建、改密、删除
- 前端无法知道某个 Key 的数据库账号当前是否真的可用

本次目标：**以 API Key 为唯一入口管理用户**。

1. 吊销 / 激活 API Key 时，**联动停用 / 启用**其数据库账号
2. API Key 列表接口返回数据库账号状态，供前端展示
3. 创建 API Key 时保证 Key 与数据库账号的一致性
4. 后续不再允许创建「裸数据库账号」（存量暂不处理）

## 二、需求一（核心）：吊销 / 激活联动数据库账号

### 2.1 涉及接口

沿用现有接口，不新增路由：

| 接口 | 改动 |
|------|------|
| `POST /api/v1/admin/apikeys/:id/revoke` | 吊销 Key 时，同时停用其 PG / CH 账号 |
| `POST /api/v1/admin/apikeys/:id/reactivate` | 激活 Key 时，同时恢复其 PG / CH 账号 |

### 2.2 账号定位

停用 / 启用的目标账号，取该 Key 当前生效的数据库配置：

- `postgresql_username`
- `clickhouse_username`

两者可能同名，也可能不同名，**必须分别处理，不能假设同名**。

### 2.3 PostgreSQL 实现

停用：

```sql
ALTER ROLE <pg_username> NOLOGIN;
```

随后主动断开已存在的会话，否则老连接仍可继续使用：

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = '<pg_username>'
  AND pid <> pg_backend_pid();
```

启用：

```sql
ALTER ROLE <pg_username> LOGIN;
```

状态查询：

```sql
SELECT rolcanlogin FROM pg_roles WHERE rolname = '<pg_username>';
```

注意：

- 账号不存在时应视为「已停用 / 不存在」，不要报 500
- 不要使用修改密码、`VALID UNTIL` 之类的方式做停用，语义不对且会破坏凭据

### 2.4 ClickHouse 实现

ClickHouse 没有 `NOLOGIN` 等价开关，需选择一种可逆的近似方案，并在接口返回中说明实际使用的手段。可选：

- 来源限制：`ALTER USER <ch_username> HOST NONE`，启用时恢复为原值
- 或配额 / 只读设置限制

硬性要求：

- **禁止使用 `ALTER USER ... NOT IDENTIFIED`**，该语句会让账号变成免密登录，属于扩大风险而不是停用
- 如果账号定义在 `users.xml` 中，SQL 层 `ALTER USER` 可能不生效，需要走配置或明确返回不支持

### 2.5 分引擎返回结果

两个引擎可能一个成功、一个失败（账号不存在、权限不足、CH 不支持等），接口必须能表达部分成功，不能整体回滚后返回一个笼统的失败。

建议响应结构：

```json
{
  "success": true,
  "data": {
    "apiKeyId": "xxx",
    "status": "revoked",
    "databaseAccounts": [
      {
        "engine": "postgresql",
        "username": "zhangsan",
        "action": "suspend",
        "result": "suspended"
      },
      {
        "engine": "clickhouse",
        "username": "zhangsan",
        "action": "suspend",
        "result": "failed",
        "reason": "user defined in users.xml"
      }
    ]
  }
}
```

`result` 取值建议：`suspended` / `activated` / `not_found` / `failed` / `unsupported`。

### 2.6 幂等与重试

- 重复吊销已吊销的 Key：返回成功，数据库账号已是停用状态时不再执行变更
- 重复激活同理
- 停用 / 启用操作本身不要做自动重试，避免 `pg_terminate_backend` 反复中断线上查询

### 2.7 审计

建议记录：操作人、操作时间、Key ID、引擎、账号名、执行结果。便于后续排查「谁把谁的账号停了」。

## 三、需求二：列表接口返回数据库账号状态

`GET /api/v1/admin/apikeys` 的每条记录增加数据库账号状态，避免前端逐条再查：

```json
{
  "id": "xxx",
  "name": "张三",
  "status": "active",
  "databaseAccounts": [
    { "engine": "postgresql", "username": "zhangsan", "state": "active" },
    { "engine": "clickhouse", "username": "zhangsan", "state": "suspended" }
  ]
}
```

`state` 取值：`active`（可登录）/ `suspended`（已停用）/ `not_found`（账号不存在）/ `unknown`（无法判定）。

状态应反映**数据库真实状态**，而不是 Key 自身状态。两者可能不一致，正因如此才需要在列表里暴露出来。

如果实时查询成本高，可以接受短 TTL 缓存（例如 60 秒），但吊销 / 激活后必须主动失效，不能让用户看到过期状态。

同时，`GET /api/v1/admin/db-permissions/users` 的用户列表也需要返回启停状态，前端「控制中心 → 数据库管理 → 用户列表」要展示这一列：

```json
{
  "postgresql": {
    "users": [
      { "username": "zhangsan", "state": "active", "bound_api_key": { "api_key_name": "张三" } }
    ]
  },
  "clickhouse": {
    "users": [
      { "username": "zhangsan", "state": "suspended", "bound_api_key": { "api_key_name": "张三" } }
    ]
  }
}
```

`state` 取值同上。PostgreSQL 可用 `pg_roles.rolcanlogin` 判定；ClickHouse 按实际采用的停用手段判定。PG 和 CH 要分别返回，因为两个引擎的状态可能不一致。

## 四、需求三：创建 API Key 的一致性

现有创建流程：前端生成 PG / CH 用户名密码，随 `POST /api/v1/admin/apikeys` 一并提交，后端创建 Key 并建数据库账号。

需要明确并修复的边界：

1. **账号创建失败时，Key 不能留下半成品**。要么事务回滚，要么接口明确返回失败并说明「Key 已创建、数据库账号未创建」的状态，前端才能提示用户处理
2. 账号已存在时的行为要明确：拒绝创建 Key，还是复用已有账号并返回冲突提示
3. 创建成功响应应返回实际生效的账号信息，前端会展示给用户

## 五、需求四：禁止裸数据库账号（后续）

归口后，数据库账号只能由 API Key 派生。

- `POST /api/v1/admin/db-permissions/users` 建议下线，或仅允许内部服务调用，不再对前端开放
- 「控制中心 → 数据库管理」中的用户创建入口已在前端屏蔽
- **存量裸账号本次不处理**，但建议后端提供一份「未绑定 API Key 的账号清单」，便于后续治理

## 六、非目标

以下内容不在本次范围内：

- 库表管理（建库 / 删库 / 建表 / 删表 / 迁移表）保持现状
- 库表级授权的存储与权限模型不改
- 存量裸数据库账号的迁移与清理

## 七、验收标准

1. 吊销 API Key 后：
   - PG 账号 `rolcanlogin = false`
   - 该账号已有连接被断开，新连接被拒绝
   - CH 账号按约定手段不可用
2. 激活 API Key 后，两个引擎账号均恢复可用，且原密码不变
3. 重复吊销 / 重复激活返回成功，不产生异常
4. 一个引擎失败、另一个成功时，接口返回分引擎结果，前端能展示具体失败原因
5. 列表接口返回的账号状态与数据库实际状态一致
6. 吊销 / 激活后立即刷新列表，状态不回退到旧值
7. 创建 API Key 时账号创建失败，不会留下只有 Key 没有账号的半成品

## 八、需要提前确认的风险

**停用会立即切断在线业务。** 如果该 API Key 正被数据下载、跑批或智能体使用，停用数据库账号会让相关任务立刻失败，且 PG 侧的 `pg_terminate_backend` 会中断正在执行的查询。前端已做二次确认，但后端返回的错误信息需要能明确区分「Key 状态已变更」与「数据库账号停用失败」，避免用户误判。
