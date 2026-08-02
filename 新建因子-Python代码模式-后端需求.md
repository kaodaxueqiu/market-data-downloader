# 新建因子：新增"Python 代码"模式 — 后端需求

- 日期：2026-08-01
- 受众：后端工程师
- 优先级：中
- 依赖：无（前端等后端完成后再对接）

---

## 一、背景

当前"我的因子"新建因子支持两种模式：

| 模式 | expression 字段值 | 说明 |
|------|------------------|------|
| Py 文件 | `__py_file__` | 用户上传本地 .py 文件，源码通过 `POST /{factorId}/source` 上传 |
| 表达式 | 用户输入的表达式文本 | 如 `(close - lag(close, 5)) / lag(close, 5)` |

现在需要新增第三种模式：**Python 代码**（用户在前端编辑器中直接编写 Python 代码，无需上传文件）。

---

## 二、新模式定义

| 属性 | 值 |
|------|---|
| 模式名 | Python 代码（pycode） |
| expression 字段值 | `__py_code__`（新标记，用于区分 Py 文件模式） |
| 源码存储 | 复用现有 `/{factorId}/source` 接口 |
| 业务行为 | 与表达式因子一致（可发起回测、可入库审核、可提交广场） |

---

## 三、后端改动点

### 3.1 创建因子接口

`POST /api/v1/factor/my/create`

- 请求体 `expression` 字段新增合法值 `__py_code__`
- 后端对 `expression` 字段的校验/存储逻辑需要兼容这个新值
- 如果后端有枚举或白名单校验 expression 字段（如只允许 `__py_file__` 或合法表达式），需要加上 `__py_code__`

### 3.2 更新因子接口

`PUT /api/v1/factor/my/{factorId}`

- 同上，`expression` 字段允许 `__py_code__`

### 3.3 上传源码接口（复用，无需改动）

`POST /api/v1/factor/my/{factorId}/source`

- 现有接口接收 `multipart/form-data`，字段名 `file`，content-type `text/x-python`
- **Python 代码模式复用此接口**：前端会把编辑器中的代码文本构造为虚拟文件上传，后端无需区分文件来源
- **无需改动**

### 3.4 获取源码接口（复用，无需改动）

`GET /api/v1/factor/my/{factorId}/source?version=N`

- Python 代码模式的因子，前端也通过此接口获取源码用于编辑/查看
- **无需改动**

### 3.5 因子列表/详情接口

- `expression` 字段需要正确返回 `__py_code__` 值
- 前端会用 `expression === '__py_code__'` 来判断因子类型并展示不同 UI
- **如果后端有对 expression 做特殊处理（如过滤、转换），需要兼容 `__py_code__`**

### 3.6 业务逻辑确认

Python 代码模式的因子在以下场景中的行为应与**表达式因子一致**（而非 Py 文件因子）：

| 场景 | Py 文件因子 | 表达式因子 | Python 代码因子（新） |
|------|-----------|-----------|-------------------|
| 发起回测 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| 入库审核 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| 提交广场 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| 查看/上传源码 | ✅ 支持 | ❌ 无源码 | ✅ 支持 |
| 版本迭代 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 回测历史 | ❌ 不显示 | ✅ 显示 | ✅ 显示 |

> 简单说：Python 代码因子 = 表达式因子的业务权限 + Py 文件因子的源码存储能力

如果后端有基于 `expression === '__py_file__'` 的业务逻辑判断（如限制回测、限制入库），需要确保 `__py_code__` 不会命中这些限制。

---

## 四、数据库改动

- `expression` 字段类型如果是 `VARCHAR` / `TEXT`，无需改动（新值 `__py_code__` 是普通字符串）
- 如果有枚举约束，需要新增 `__py_code__` 枚举值
- 不需要新增字段或新表

---

## 五、验收标准

1. `POST /create` 接口能接受 `expression: "__py_code__"` 并成功创建因子
2. 创建成功后，`GET /{factorId}` 返回的 `expression` 字段值为 `__py_code__`
3. `POST /{factorId}/source` 能正常上传源码（和 Py 文件模式一致）
4. `GET /{factorId}/source` 能正常返回源码
5. Python 代码因子不受 Py 文件因子的业务限制（能回测、能入库、能提交广场）

---

## 六、前端对接计划

后端完成上述改动后，前端将：

1. 新建因子对话框新增第三种模式"Python 代码"，带 CodeMirror 编辑器
2. 提交时 `expression` 传 `__py_code__`，源码通过 `/{factorId}/source` 上传
3. 因子列表用 `expression === '__py_code__'` 显示"Py代码"标签
4. 详情页支持查看/编辑代码（复用源码查看器）
5. 回测/入库/广场按钮对 pycode 因子开放
