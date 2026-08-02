# factor_code_meta 字段 — 交付报告

- 日期：2026-08-02
- 交付人：后端
- 状态：**已完成，前端可开始对接**

---

## 一、改动概览

| 项目 | 内容 |
|------|------|
| 需求来源 | 前端：《因子元数据新增 factor_code_meta 字段 — 后端需求》 |
| 改动范围 | 网关（api_gateway） |
| 改动文件 | 4 个 |
| 数据库变更 | 6 张表 + 21 个用户库迁移 |
| 编译状态 | 通过 |
| 数据库迁移 | 全部完成 |

---

## 二、改动文件

| 文件 | 改动内容 |
|------|---------|
| `internal/rest/handlers/factor/my_factor.go` | DDL/迁移/创建/更新/列表/详情/版本/批量创建/回测组装/自愈快照 |
| `internal/rest/handlers/factor/plaza.go` | DDL/迁移/广场提交/广场列表/广场详情/广场版本列表/提交流水 |
| `internal/rest/handlers/factor/handler.go` | 旧版因子列表/详情接口补字段 |
| `internal/rest/handlers/factor/models.go` | FactorMetadata / FactorListItem 结构体加字段 |
| `internal/rest/handlers/backtest/models.go` | BacktestTask 结构体加 FactorCodeMeta |
| `internal/rest/handlers/backtest/handler.go` | ListTasks 从 task_config 提取 factor_code_meta |

---

## 三、接口变更明细

### 3.1 创建因子 `POST /api/v1/factor/my/create`

**请求体新增字段：**

```json
{
  "factor_code": "test_momentum_5d",
  "factor_name": "测试5日动量",
  "expression": "def calculate_factor(data, context): ...",
  "expression_type": "py_code",
  "factor_code_meta": {
    "factor_aggregation": "mean",
    "requires": ["numpy"]
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `factor_code_meta` | JSON 对象 | 否 | `{}` | Python 代码因子的执行元信息 |

- 不传则存默认值 `{"factor_aggregation": "mean", "requires": []}`
- 仅 `expression_type=py_code` 时有实际意义，其他类型传了也存

### 3.2 更新因子 `PUT /api/v1/factor/my/{factorId}`

- 支持 `factor_code_meta` 字段（可选，不传不更新）
- 更新时自动写入版本快照

### 3.3 因子列表 `GET /api/v1/factor/my/list`

响应中每个因子对象包含 `factor_code_meta` 字段。

### 3.4 因子详情 `GET /api/v1/factor/my/{factorId}`

响应包含 `factor_code_meta` 字段：

```json
{
  "factor_id": "yuyang_500",
  "expression_type": "py_code",
  "expression": "def calculate_factor(...): ...",
  "factor_code_meta": {
    "factor_aggregation": "mean",
    "requires": ["numpy"]
  }
}
```

### 3.5 版本列表 `GET /api/v1/factor/my/{factorId}/versions`

响应包含 `factor_code_meta` 字段（每个版本可能不同）。

### 3.6 版本详情 `GET /api/v1/factor/my/{factorId}/version/{ver}`

响应包含 `factor_code_meta` 字段。

### 3.7 批量创建 `POST /api/v1/factor/my/batch-create`

每个因子项支持 `factor_code_meta` 字段。

### 3.8 旧版因子列表 `GET /api/v1/factor/list`

响应包含 `expression_type` 和 `factor_code_meta` 字段。

### 3.9 旧版因子详情 `GET /api/v1/factor/detail/{factorId}`

响应包含 `expression_type` 和 `factor_code_meta` 字段。

### 3.10 广场列表 `GET /api/v1/factor/plaza/list`

响应包含 `factor_code_meta` 字段。

### 3.11 广场详情 `GET /api/v1/factor/plaza/{id}`

响应包含 `factor_code_meta` 字段。

### 3.12 广场版本列表 `GET /api/v1/factor/plaza/{id}/versions`

响应包含 `factor_code_meta` 字段。

### 3.13 提交流水 `GET /api/v1/factor/plaza/submissions`

响应包含 `factor_code_meta` 字段。

### 3.14 回测任务列表 `GET /api/v1/backtest/tasks`

响应包含 `factor_code_meta` 字段（从 task_config 提取）。

### 3.15 从因子发起回测 `POST /api/v1/factor/my/{factorId}/backtest`

后端自动从因子元数据读取 `factor_code_meta`，组装到 `task_config.factor_code_meta` 中，**前端无需传递**。

---

## 四、回测引擎对接

从"我的因子"发起回测时，网关自动组装 task_config：

```json
{
  "factor_code": "def calculate_factor(data, context): ...",
  "factor_code_meta": {
    "entrypoint": "calculate_factor",
    "allow_pandas": true,
    "result_mode": "dataframe",
    "factor_aggregation": "mean",
    "requires": ["numpy"],
    "isolation": false
  },
  "expression_type": "py_code"
}
```

**组装逻辑：**

1. 从 `factor_metadata.factor_code_meta` 读取（或指定版本时从 `factor_versions.factor_code_meta` 读取）
2. **显式补齐协议常量字段**——防止引擎默认值变更导致行为不一致：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `entrypoint` | `"calculate_factor"` | 入口函数名（与引擎实际调用的函数名一致） |
| `allow_pandas` | `true` | 是否允许 pandas 运行时 |
| `result_mode` | `"dataframe"` | 返回格式 |
| `factor_aggregation` | `"mean"` | 聚合方式（前端可配置覆盖） |
| `requires` | `[]` | 依赖库列表（前端可配置覆盖） |
| `isolation` | `false` | 子进程隔离（与前端单因子回测默认值一致） |

3. 如果前端传了自定义值（如 `factor_aggregation: "last"`），保留前端的值，只补齐缺失的字段

---

## 五、数据库变更

### 5.1 新增列

| 表 | 列 | 类型 | 默认值 |
|----|-----|------|--------|
| factor_metadata | factor_code_meta | JSONB | `'{}'` |
| factor_versions | factor_code_meta | JSONB | `'{}'` |
| plaza_factor_metadata | factor_code_meta | JSONB | `'{}'` |
| plaza_factor_versions | factor_code_meta | JSONB | `'{}'` |
| plaza_submission_log | factor_code_meta | JSONB | `'{}'` |

### 5.2 迁移情况

| 数据库 | 状态 |
|--------|------|
| 21 个用户因子库（factor_db_*） | ✅ 全部加列完成 |
| 广场库（factor_db） | ✅ 全部加列完成 |
| 新用户首次建库 | ✅ DDL 自动包含 |

### 5.3 自动迁移

- 每个用户库在首次访问时自动执行 `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- 广场库在首次调用广场接口时自动执行
- 无需手动干预

---

## 六、验收标准对照

| # | 验收标准 | 状态 |
|---|---------|------|
| 1 | 创建 py_code 因子时传 factor_code_meta，后端正确存储 | ✅ |
| 2 | 因子详情/列表接口返回 factor_code_meta 字段 | ✅ |
| 3 | 更新因子时可修改 factor_code_meta | ✅ |
| 4 | 从我的因子发起回测时，后端自动读取传给引擎 | ✅ |
| 5 | 不传 factor_code_meta 时使用默认值，不报错 | ✅ |
| 6 | expression_type=expr 的因子不受影响 | ✅ |

---

## 七、已知限制

1. **回测历史列表**（`GET /factor/my/{factorId}/backtest-history`）不返回 `factor_code_meta`——该接口是摘要列表，详情可通过 `GET /backtest/task/{taskId}` 获取完整 task_config
2. `factor_code_meta` 当前值为空对象 `{}`——等前端加上配置 UI 后，新建/编辑因子时传入实际值

---

## 八、前端对接提示

1. 新建因子对话框 py_code 模式加"聚合方式"（下拉：mean/last/sum）和"依赖库"（多选/输入）配置
2. 编辑因子对话框回填 `factor_code_meta`
3. 因子详情页展示聚合方式和依赖库
4. 创建/更新时将配置传入 `factor_code_meta` 字段
5. 从"我的因子"发起回测**不需要**传 `factor_code_meta`，后端自动读取
