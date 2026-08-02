# 因子元数据新增 factor_code_meta 字段 — 后端需求

- 日期：2026-08-01
- 受众：后端工程师
- 优先级：高
- 关联：新建因子 Python 代码模式（expression_type=py_code）

---

## 一、背景

Python 代码类型的因子（expression_type=py_code）在回测时，引擎需要知道两个关键元信息：

| 字段 | 含义 | 示例 |
|------|------|------|
| `factor_aggregation` | 因子值聚合方式（引擎对 calculate_factor 返回值按截面分组时用） | `mean` / `last` / `sum` |
| `requires` | 代码依赖的第三方库（引擎需预装） | `["numpy", "scipy", "talib"]` |

这两个字段是因子的**固有属性**（不随回测任务变化），应作为因子元数据持久化存储，而非每次回测时由用户手动指定。

当前单因子回测页面（SubmitContent.vue）已有这两个配置项的 UI，但从"我的因子"发起回测时没有传递，且因子定义中也未存储。

---

## 二、方案

在因子元数据中新增 `factor_code_meta` JSON 字段，存储 Python 代码因子的执行元信息。

### 2.1 字段定义

| 字段 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `factor_code_meta` | JSONB / TEXT | factor_metadata 表 | Python 代码因子的执行元信息 |

`factor_code_meta` 内部结构：

```json
{
  "factor_aggregation": "mean",
  "requires": ["numpy", "scipy"]
}
```

| 子字段 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `factor_aggregation` | string | 否 | `"mean"` | `mean` / `last` / `sum` |
| `requires` | string[] | 否 | `[]` | 第三方库列表 |

> 注：后续可能扩展更多字段（如 `entrypoint`、`result_mode`、`isolation` 等），所以用 JSON 而非独立列。

### 2.2 适用范围

- **仅 `expression_type=py_code` 的因子需要此字段**
- `expression_type=expr` 的因子不需要（表达式因子无需聚合方式和依赖库）
- `expression_type=py_file` 的因子暂不需要（由用户自行管理）

---

## 三、接口变更

### 3.1 创建因子

`POST /api/v1/factor/my/create`

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

- `factor_code_meta` 为可选字段，不传则使用默认值（aggregation=mean, requires=[]）
- 仅 `expression_type=py_code` 时有意义，其他类型传了也存但不使用

### 3.2 更新因子

`PUT /api/v1/factor/my/{factorId}`

同创建接口，支持 `factor_code_meta` 字段（可选，不传不更新）。

### 3.3 因子详情

`GET /api/v1/factor/my/{factorId}`

**响应新增字段：**

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

### 3.4 因子列表

`GET /api/v1/factor/my/list`

响应中每个因子对象包含 `factor_code_meta` 字段。

### 3.5 版本详情

`GET /api/v1/factor/my/{factorId}/version/{ver}`

响应包含 `factor_code_meta` 字段（每个版本可能不同）。

### 3.6 回测任务提交

`POST /api/v1/backtest/submit` 或对应的批量回测接口

从"我的因子"发起回测时，后端应自动从因子元数据中读取 `factor_code_meta`，组装到回测引擎的 `task_config.factor_code_meta` 中，无需前端传递。

---

## 四、回测引擎对接

后端在组装回测任务配置时，对于 `expression_type=py_code` 的因子：

```python
task_config = {
    "factor_code": factor.expression,  # Python 代码文本
    "factor_code_meta": {
        "entrypoint": "calculate_factor",
        "factor_aggregation": factor.factor_code_meta.get("factor_aggregation", "mean"),
        "requires": factor.factor_code_meta.get("requires", []),
        "allow_pandas": True,
        "result_mode": "dataframe"
    },
    # ... 其他配置
}
```

---

## 五、数据库变更

### 5.1 factor_metadata 表

```sql
ALTER TABLE factor_metadata 
ADD COLUMN factor_code_meta JSONB DEFAULT '{}';
```

### 5.2 factor_versions 表（如果版本也有独立元数据）

```sql
ALTER TABLE factor_versions 
ADD COLUMN factor_code_meta JSONB DEFAULT '{}';
```

### 5.3 数据回填

历史 `expression_type=py_code` 的因子（如果有），回填默认值：

```sql
UPDATE factor_metadata 
SET factor_code_meta = '{"factor_aggregation": "mean", "requires": []}'
WHERE expression_type = 'py_code' AND (factor_code_meta IS NULL OR factor_code_meta = '{}');
```

---

## 六、验收标准

1. 创建 py_code 因子时传 `factor_code_meta`，后端正确存储
2. 因子详情/列表接口返回 `factor_code_meta` 字段
3. 更新因子时可修改 `factor_code_meta`
4. 从"我的因子"发起回测时，后端自动读取 `factor_code_meta` 传给回测引擎
5. 不传 `factor_code_meta` 时使用默认值，不报错
6. `expression_type=expr` 的因子不受影响

---

## 七、前端对接计划

后端完成后，前端将：

1. 新建因子对话框 pycode 模式加"聚合方式"和"依赖库"配置
2. 编辑因子对话框回填 `factor_code_meta`
3. 因子详情页展示聚合方式和依赖库
4. 创建/更新时将配置传入 `factor_code_meta` 字段
