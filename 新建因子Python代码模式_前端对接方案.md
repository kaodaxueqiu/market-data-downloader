# 新建因子："Python 代码"模式 — 前端对接方案

- 日期：2026-08-01
- 受众：前端工程师
- 状态：**后端已完成，前端可开始对接**

---

## 一、与原方案的核心差异（必读）

前端原方案基于 `expression` 字段存魔法字符串 `__py_code__` 来区分因子类型。后端实际实现做了**架构升级**：

| 原方案 | 实际实现 |
|--------|---------|
| 用 `expression === '__py_code__'` 判断类型 | 新增 `expression_type` 字段，显式标记类型 |
| Python 代码通过 MinIO 源码接口存储 | Python 代码**直接存在 `expression` 字段里**（和表达式一样） |
| `expression` 存标记字符串 `__py_code__` | `expression` 存**实际代码内容** |
| 不需要新增字段 | 新增 `expression_type` 字段 |

**简单说：`expression_type` 告诉你是什么类型，`expression` 存实际内容。**

---

## 二、三种因子类型定义

| expression_type | 含义 | expression 字段内容 | 源码接口 |
|----------------|------|-------------------|---------|
| `expr` | 表达式因子 | 表达式文本，如 `Mean(volume, 60)` | 不需要 |
| `py_file` | Py 文件因子 | `__py_file__`（标记） | MinIO 存储，通过 `/{factorId}/source` 上传/下载 |
| `py_code` | Python 代码因子（**新**） | **Python 代码文本**（直接存） | 不需要（代码就在 expression 里） |

---

## 三、接口变更

### 3.1 创建因子

`POST /api/v1/factor/my/create`

**请求体新增字段：**

```json
{
  "factor_code": "my_factor_001",
  "factor_name": "我的因子",
  "expression": "def calculate_factor(data, context):\n    df = data['market_mart.zz_500D']\n    ...",
  "expression_type": "py_code",
  "description": "...",
  "data_sources": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expression_type` | string | 否（默认 `expr`） | `expr` / `py_file` / `py_code` |
| `expression` | string | 是 | 表达式因子填表达式文本；py_code 填 Python 代码文本；py_file 填 `__py_file__` |

**前端三种模式的提交逻辑：**

| 模式 | expression | expression_type | 源码上传 |
|------|-----------|----------------|---------|
| 表达式 | 表达式文本 | `expr`（或不传） | 不需要 |
| Py 文件 | `__py_file__` | `py_file` | 创建后调 `POST /{factorId}/source` 上传 .py 文件 |
| Python 代码 | **Python 代码文本** | `py_code` | **不需要**（代码已在 expression 中） |

### 3.2 更新因子

`PUT /api/v1/factor/my/{factorId}`

同创建接口，支持 `expression_type` 字段（可选，不传不更新）。

### 3.3 因子列表

`GET /api/v1/factor/my/list`

**响应新增字段：**

```json
{
  "factor_id": "lianglixiao_23",
  "factor_code": "LIQ_turnover_5d",
  "factor_name": "5日换手均值",
  "expression": "Mean(TURNOVER_VOL, 5)",
  "expression_type": "expr",
  ...
}
```

### 3.4 因子详情

`GET /api/v1/factor/my/{factorId}`

响应同上，包含 `expression_type` 字段。

**Python 代码因子的详情返回示例：**

```json
{
  "factor_id": "yuyang_500",
  "expression_type": "py_code",
  "expression": "def calculate_factor(data, context):\n    df = data['market_mart.zz_500D']\n    df['ret'] = df['close_price'].pct_change(1)\n    ...",
  ...
}
```

前端直接从 `expression` 字段读取代码内容，**不需要调源码接口**。

### 3.5 版本列表 / 版本详情

`GET /api/v1/factor/my/{factorId}/versions`
`GET /api/v1/factor/my/{factorId}/version/{ver}`

响应均包含 `expression_type` 字段。

### 3.6 源码上传/下载接口（仅 py_file 模式使用）

- `POST /api/v1/factor/my/{factorId}/source` — **仅 py_file 模式需要调用**
- `GET /api/v1/factor/my/{factorId}/source` — **仅 py_file 模式需要调用**

Python 代码模式（py_code）的代码内容直接存在 `expression` 字段中，**不需要调源码接口**。

### 3.7 回测任务列表

`GET /api/v1/backtest/tasks`

**响应新增字段：**

```json
{
  "task_id": "bt_lianglixiao_1722345678",
  "expression_type": "expr",
  ...
}
```

### 3.8 回测历史

`GET /api/v1/factor/my/{factorId}/backtest-history`

**响应新增字段：**

```json
{
  "task_id": "bt_lianglixiao_1722345678",
  "expression_type": "expr",
  ...
}
```

### 3.9 广场列表 / 广场详情

`GET /api/v1/factor/plaza/list`
`GET /api/v1/factor/plaza/{id}`

响应均包含 `expression_type` 字段。

---

## 四、前端判断因子类型的方式（重要变更）

### 原方案（废弃）

```javascript
// ❌ 不要再用这种方式
if (factor.expression === '__py_file__') { /* Py文件 */ }
if (factor.expression === '__py_code__') { /* Py代码 */ }
```

### 新方案（使用 expression_type）

```javascript
// ✅ 使用 expression_type 判断
switch (factor.expression_type) {
  case 'expr':
    // 表达式因子：expression 就是表达式文本
    break
  case 'py_file':
    // Py文件因子：expression 是 '__py_file__'，源码需要调 source 接口
    break
  case 'py_code':
    // Python代码因子：expression 就是代码文本，直接用
    break
}
```

### 兼容处理（推荐）

```javascript
function getExpressionType(factor) {
  // 优先用 expression_type（新字段）
  if (factor.expression_type && factor.expression_type !== '') {
    return factor.expression_type
  }
  // 回退：老数据可能没有 expression_type（理论上不会，已全量回填）
  if (factor.expression === '__py_file__') return 'py_file'
  return 'expr'
}
```

---

## 五、业务行为矩阵

| 场景 | expr | py_file | py_code |
|------|------|---------|---------|
| 发起回测 | ✅ | ✅ | ✅ |
| 入库审核 | ✅ | ✅ | ✅ |
| 提交广场 | ✅ | ✅ | ✅ |
| 查看源码 | 直接显示 expression | 调 source 接口 | 直接显示 expression |
| 编辑源码 | 编辑器（表达式） | 需重新上传文件 | 编辑器（CodeMirror） |
| 回测历史 | ✅ | ✅ | ✅ |
| 版本迭代 | ✅ | ✅ | ✅ |

> **与原方案的区别**：原方案说 py_file "不支持回测/入库/广场"，实际后端**已修复**——py_file 因子回测时会自动从 MinIO 读取源码传给引擎。三种类型在业务权限上**完全一致**。

---

## 六、前端改动清单

### 6.1 新建因子对话框

- 新增第三种模式选项："Python 代码"
- 选择"Python 代码"时：
  - 显示 CodeMirror 编辑器（Python 语法高亮）
  - 提交时 `expression` 传编辑器中的代码文本
  - 提交时 `expression_type` 传 `py_code`
  - **不需要调源码上传接口**
- 选择"表达式"时：
  - `expression_type` 传 `expr`（或不传）
- 选择"Py 文件"时：
  - `expression_type` 传 `py_file`
  - `expression` 传 `__py_file__`
  - 创建成功后调 `POST /{factorId}/source` 上传文件

### 6.2 因子列表

- 使用 `expression_type` 字段显示类型标签：
  - `expr` → "表达式"
  - `py_file` → "Py文件"
  - `py_code` → "Py代码"

### 6.3 因子详情页

- `expression_type === 'py_code'` 时：
  - 显示 CodeMirror 代码编辑器
  - 代码内容从 `expression` 字段读取
  - 编辑后提交时更新 `expression` 字段
- `expression_type === 'py_file'` 时：
  - 显示源码查看器（调 `GET /{factorId}/source` 获取）
- `expression_type === 'expr'` 时：
  - 显示表达式输入框

### 6.4 回测相关页面

- 回测任务列表：可用 `expression_type` 字段展示因子类型标签
- 回测历史：同上

### 6.5 广场页面

- 广场列表/详情：可用 `expression_type` 字段展示因子类型标签

### 6.6 TypeScript 类型定义

```typescript
// types/factor.ts
type ExpressionType = 'expr' | 'py_file' | 'py_code'

interface Factor {
  factor_id: string
  factor_code: string
  factor_name: string
  expression: string
  expression_type: ExpressionType  // 新增
  // ...其他字段
}

interface CreateFactorRequest {
  factor_code: string
  factor_name: string
  expression: string
  expression_type?: ExpressionType  // 新增，不传默认 expr
  // ...其他字段
}
```

---

## 七、验收标准

1. 新建因子选择"Python 代码"模式，输入代码，提交成功
2. 因子列表显示"Py代码"标签
3. 因子详情页正确显示 CodeMirror 编辑器和代码内容
4. 编辑代码后保存（PUT 更新），代码内容更新成功
5. Python 代码因子能正常发起回测
6. Python 代码因子能提交广场
7. 回测任务列表/回测历史正确显示 `expression_type`
8. 广场列表正确显示 `expression_type`
9. 历史因子（expr / py_file）功能不受影响

---

## 八、数据现状

后端已完成全量数据回填，所有接口均返回 `expression_type` 字段：

| 数据 | 状态 |
|------|------|
| 21 个用户因子库（factor_metadata / factor_versions） | ✅ 字段已加，数据已填充 |
| 广场库（plaza_factor_metadata / plaza_factor_versions） | ✅ 字段已加，数据已填充 |
| 回测任务（backtest_task.task_config JSONB） | ✅ 9819 条历史任务全部回填 |

前端可以安全地使用 `expression_type` 字段，不存在 NULL 或缺失的情况。
