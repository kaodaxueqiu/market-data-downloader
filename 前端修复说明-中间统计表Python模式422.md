# 前端修复说明：中间统计表 Python 模式建表 422 报错

## 问题现象

用户选择 Python 代码模式建表时，后端返回 422 Unprocessable Entity，建表失败。DDL 模式正常。

## 根因

`CreateDialog.vue` 的 `handleSubmit` 函数中，Python 模式和 DDL 模式都调用了同一个接口 `intermediateTable.build(payload)`，对应后端 `POST /api/v1/midstats/build`。

但后端有两个不同的建表端点，期望的请求体格式不同：

| 后端端点 | 期望请求体 | 用途 |
|---------|-----------|------|
| `POST /api/v1/midstats/build` | `{ddl, table_name, workspace_db?, ttl?}` | DDL 异步建表 |
| `POST /api/v1/midstats/create` | `{code, user_name?, ttl?, workspace_db?}` | Python 代码翻译建表 |

Python 模式发送的请求体是 `{mode, ttl, py_code, table_name?}`，后端 build 端点找不到必填字段 `ddl`，axum 反序列化失败返回 422：

```
Failed to deserialize the JSON body into the target type: missing field `ddl`
```

## 修复方案

### 改动 1：CreateDialog.vue 按模式分流接口

`handleSubmit` 函数中，新建分支（非重建）按 `mode` 调用不同接口：

```javascript
// 当前代码（有问题）：两种模式都调 build
result = await window.electronAPI.intermediateTable.build(payload)

// 改为：按模式分流
if (form.mode === 'python') {
  result = await window.electronAPI.intermediateTable.create(payload)
} else {
  result = await window.electronAPI.intermediateTable.build(payload)
}
```

### 改动 2：Python 模式请求体字段名改为 code

meta-service 的 `CreateIntermediateReq` 期望的字段是 `code`，不是 `py_code`。

Python 模式组装 payload 时：

```javascript
// 当前代码（有问题）：
payload.py_code = form.py_code

// 改为：
payload.code = form.py_code
```

### 改动 3：Python 模式不需要 table_name

Python 模式下 `table_name` 由 meta-service 自动生成（基于代码指纹），不需要前端传。DDL 模式才需要传 `table_name`。

组装 payload 逻辑：

```javascript
// Python 模式
if (form.mode === 'python') {
  payload.code = form.py_code
  // 不要传 table_name，meta-service 自动生成
}
// DDL 模式
else {
  payload.ddl = form.ddl
  payload.table_name = form.table_name  // 必填，须以 it_ 开头
}
```

### 改动 4：Python 模式的返回值格式不同

`/midstats/create` 返回的响应体格式：

```json
{
  "table_name": "factor_workspace_yutianran.it_auto_xxx",
  "fingerprint": "abc123",
  "reused": false,
  "workspace_db": "factor_workspace_yutianran"
}
```

`/midstats/build` 返回的响应体格式：

```json
{
  "build_id": "b_1787363724924",
  "table_name": "factor_workspace_yutianran.it_test",
  "workspace_db": "factor_workspace",
  "message": "建表任务已提交，请轮询 GET /v1/meta/intermediate/build/{build_id} 查看进度"
}
```

Python 模式是同步建表（直接返回结果），不需要轮询 build 进度。DDL 模式是异步建表（返回 build_id，需要轮询）。

前端 `handleSubmit` 收到结果后的处理逻辑也要区分：

```javascript
if (form.mode === 'python') {
  // create 返回 {table_name, fingerprint, reused, workspace_db}
  // 直接刷新列表，不需要轮询
  emit('build', { build_id: null, table_name: result.table_name, is_rebuild })
  // 或者直接调用 loadList() 刷新
} else {
  // build 返回 {build_id, table_name, ...}
  // 启动轮询
  emit('build', { build_id: result.build_id, table_name: result.table_name, is_rebuild })
}
```

## 接口对照表

| 前端调用 | HTTP 方法 + 路径 | 请求体 | 响应体 | 是否轮询 |
|---------|-----------------|--------|--------|---------|
| `intermediateTable.create(payload)` | `POST /api/v1/midstats/create` | `{code, ttl?, workspace_db?}` | `{table_name, fingerprint, reused, workspace_db}` | 否（同步） |
| `intermediateTable.build(payload)` | `POST /api/v1/midstats/build` | `{ddl, table_name, ttl?, workspace_db?}` | `{build_id, table_name, workspace_db, message}` | 是（异步） |
| `intermediateTable.buildStatus(id)` | `GET /api/v1/midstats/build/{buildId}` | 无 | `{build_id, status, stage, progress, detail, elapsed_secs, read_rows, read_bytes, error}` | — |

注意：`workspace_db` 字段由网关自动注入（从 API Key 解析用户工作区库），前端不需要传。

## 涉及文件

- `src/renderer/views/FactorLibrary/IntermediateTable/CreateDialog.vue` — 主要改动
- `src/renderer/views/FactorLibrary/IntermediateTable/ListContent.vue` — Python 模式不需要轮询，DDL 模式才启动轮询
