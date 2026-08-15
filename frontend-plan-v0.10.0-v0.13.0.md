# 前端改造方案 — 回测引擎 v0.10.0 → v0.13.0 对接

> **基线版本**：v0.9.2（已完成，网关已改、镜像已推 latest）  
> **目标版本**：v0.13.0（origin/main HEAD `cde2385`，Cargo.toml `0.13.0`）  
> **跨越版本**：v0.10.0 / v0.10.1 / v0.10.2 / v0.11.0 / v0.12.0 / v0.13.0（共 12 个提交）  
> **参考文档**：前端部署网关DBA对接说明-20260811-0813.md、回测引擎更新说明-20260811-0813.md  
> **编制日期**：2026-08-14

---

## 0. 综述

### 0.1 改动量级评估

| 影响方 | 优先级高 | 优先级中 | 工作量（人天） |
|--------|---------|---------|---------------|
| **网关** | 4 项 | 1 项 | **2~3 天**（新增 translate 端点 + CH port 注入 + 限流 + 测试）|
| **前端** | 3 项 | 7 项 | **5~7 天**（translate 预览/下载组件 + warnings 4 级适配 + NaN 处理 + 口径变化文案）|
| **部署** | 2 项 | 1 项 | **1 天**（镜像重建 + 环境变量）|
| **DBA** | 1 项 | 3 项 | **0.5 天**（核查配置，无 DDL 变更）|

**总计预估**：8.5~11.5 人天（网关 + 前端并行，部署/DBA 验证）

### 0.2 核心改动速览

| # | 改动 | 影响方 | 破坏性 | 优先级 |
|---|------|--------|--------|--------|
| 1 | **翻译下载端点**：`/v1/translate/{polars,clickhouse}` | 前端/网关 | 无（纯新增） | 高 |
| 2 | **CH 端口修复**：不再硬编码 8123，读 `credentials.port` | 网关/DBA | 无（port=0 回退 8123） | 高 |
| 3 | **stage_errors 4 级体系**：`ErrorSeverity` 新增 `Info` | 前端 | 低（JSON 向后兼容） | 中 |
| 4 | **回测口径变化**：停牌 NAV/正负向分组/Sharpe 年化 | 前端 | 中（数值不可对比） | 高 |
| 5 | **NaN 语义变化**：`daily_return` NaN 而非 0.0 | 前端 | 低（图表断点为预期） | 中 |
| 6 | **pyo3 0.22 + Python 3.13** | 部署 | 无（需重建镜像） | 高 |

### 0.3 本文档结构

- **第 1 节**：网关改造清单（我负责实施）
- **第 2 节**：前端改造清单（给前端工程师）
- **第 3 节**：部署 & DBA 清单（给运维/DBA）
- **第 4 节**：验收测试用例
- **第 5 节**：版本兼容性与回退策略

---

## 1. 网关改造清单（API Gateway，2~3 人天）

### 1.1 现状核查

已确认网关实际情况：
- ✅ CH credentials 已包含 `port` 字段（handler.go:595 硬编码 9000，data_handler.go:324 同）
- ✅ 回测提交已下发 CH/PG credentials 给引擎
- ❌ **不存在** `/v1/translate/*` 路由（midstats/handler.go 无 translate 关键字）
- ✅ `/midstats/*` 由网关自己实现，**不走 meta-service 反代**

### 1.2 必做项（高优先级，4 项）

#### 1.2.1 新增 `/v1/translate/polars` 端点

**路由**：`POST /v1/translate/polars`（支持查询参数 `?as_file=1`）

**实现方式**：直接调用引擎 meta-service 的 `/v1/translate/polars` 端点（与 `/midstats/*` 不同，translate 端点**不需要网关自己实现逻辑**，只需转发）

**请求体**：
```json
{
  "code": "def calculate_factor(data, context):\n    ...",
  "context": {}  // 可选
}
```

**响应**：
- 默认（无 `?as_file=1`）：返回 JSON
  ```json
  {
    "source": "import polars as pl\n\n...",
    "fallback": false,
    "fallback_reason": null,
    "entry_function": "calculate_factor",
    "original_mode": "polars_lazy"
  }
  ```
- `?as_file=1`：直接透传引擎返回的文件流（`Content-Type: text/x-python`、`Content-Disposition: attachment; filename="translated_factor_polars.py"`）

**鉴权**：
- 与 `/v1/meta/intermediate` 一致，校验 `X-API-Key` 或 Bearer token
- 不需要注入 credentials（translate 端点不连 DB）

**限流**：建议 10 QPS/用户、超时 5s

**关键点**：
- fallback 时 HTTP 状态码仍是 **200**（不是 400/500），前端必须检查 `fallback` 字段
- 引擎内置 8 并发 Semaphore，网关只需加用户级 QPS 限流

#### 1.2.2 新增 `/v1/translate/clickhouse` 端点

**路由**：`POST /v1/translate/clickhouse`（支持 `?as_file=1`）

**请求体**：
```json
{
  "code": "def build_intermediate_table(sources, context, *, ttl='30d'):\n    ...",
  "user_name": "my_ohlcv",      // 可选，影响表名
  "ttl": "30d",                  // 可选
  "workspace_db": "factor_workspace"  // 可选，默认 factor_workspace
}
```

**网关特殊处理**：
- **必须注入 `workspace_db`**：从 X-API-Key 解析当前用户，覆盖请求体中的 `workspace_db` 为 `factor_workspace_<username>`（即使 translate 不连 DB，也要防止 DDL 字符串泄露其他用户库命名）
- `user_name` / `ttl` 透传

**响应**：
- JSON 模式：
  ```json
  {
    "ddl": "CREATE TABLE factor_workspace.it_my_ohlcv ENGINE = MergeTree() ...",
    "table_name": "factor_workspace.it_my_ohlcv",
    "source_tables": ["market_mart.zz_5001"],
    "fingerprint": "a1b2c3d4...",
    "fallback": false,
    "fallback_reason": null
  }
  ```
- `?as_file=1`：文件流（`.sql`）

#### 1.2.3 CH credentials 下发 **正确端口**

**现状问题**：
- `handler.go:595` 和 `data_handler.go:324` 都硬编码 `"port": 9000`
- 如果实际 ClickHouse 部署在 **8123**（HTTP 接口）或其他端口，引擎会连接失败

**修复**：
- 确认生产 CH 实际端口（问 DBA）
- 如果是 8123（HTTP 接口），改为 `"port": 8123`
- 如果是 9000（Native 接口），保持不变
- **引擎侧已修复**：`port=0` 时回退 8123（向后兼容），但网关应下发正确端口

**涉及文件**：
- `/opt/api_gateway/internal/rest/handlers/backtest/handler.go:595`
- `/opt/api_gateway/internal/rest/handlers/backtest/data_handler.go:324`

#### 1.2.4 路由注册与中间件

**新增路由组**（伪代码，按实际框架调整）：
```go
// internal/rest/router.go 或类似文件
translateGroup := api.Group("/v1/translate")
translateGroup.Use(authMiddleware) // 与 /v1/meta 一致的鉴权
translateGroup.POST("/polars", translateHandlers.HandlePolarsTranslate)
translateGroup.POST("/clickhouse", translateHandlers.HandleClickHouseTranslate)
```

**限流中间件**（如果现有限流框架支持）：
- 用户级 10 QPS
- 超时 5s

### 1.3 建议项（中优先级，1 项）

#### 1.3.1 HTTPS 环境变量传递

如果 ClickHouse 部署走 HTTPS，需确保引擎 Pod 设置了环境变量 `BACKTEST_CH_HTTPS=1`。

**动作**：与部署确认，如 CH 走 HTTPS，在 K8s deployment/helm values 里加环境变量。

### 1.4 网关改造文件清单

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `internal/rest/handlers/translate/handler.go`（新建） | 实现 polars/clickhouse 转发逻辑 + workspace_db 注入 + 限流 | 0.5 天 |
| `internal/rest/router.go` | 注册 `/v1/translate/*` 路由 | 0.2 天 |
| `internal/rest/handlers/backtest/handler.go` | 修正 CH port 硬编码（2 处） | 0.1 天 |
| `internal/rest/handlers/backtest/data_handler.go` | 修正 CH port 硬编码（2 处） | 0.1 天 |
| 测试用例 | translate 端点单测 + 集成测试 | 1 天 |

**总计**：1.9 天编码 + 1 天测试 = **2.9 天**

---

## 2. 前端改造清单（基于最新代码 94d3ff8 逐项核实）

> ⚠️ 本节已按前端真实代码现状重写。核对结论：**0.9.2 的 layers 数组化 + stage_errors 展示前端已完成**（见 `StageErrors.vue`、`ReportV03View.vue` 周期切换），**不重复做**。本节只列 v0.10.0→v0.13.0 的**真实增量**。

### 2.0 已完成项（明确不做，避免重复劳动）

| 项 | 前端现状 | 结论 |
|---|---|---|
| layers 数组化 + 周期切换 | [ReportV03View.vue:197-203](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L197-L203) `Array.isArray(l)?l:[l]` 双兼容 + `selectedLayerIdx` | ✅ 已做 |
| stage_errors 展示 | `src/renderer/components/StageErrors.vue`，fatal/error/info 兜底、stage/code/message/suggestion/detail/context 全读、renderCtx 处理嵌套 | ✅ 已做 |
| NaN 图表断点 | [ReportV03View.vue:182-187](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L182-L187) `nz()` 非有限值转 null + 全图 `connectNulls` | ✅ 已做 |
| severity 4 级（Info） | StageErrors.vue `alertType` 兜底 `return 'info'` | ✅ 天然兼容 |

### 2.1 必做项（高优先级）

#### 2.1.1 新增「翻译代码下载」功能模块（全新，唯一大工作量）

**引擎端点**（v0.10.1 新增，网关已转发好）：
- `POST /api/v1/translate/polars`（JSON 预览 / `?as_file=1` 文件下载）
- `POST /api/v1/translate/clickhouse`（同上）

**入口位置**：
- **polars**：因子编辑页 py_code 代码编辑器旁——[MyFactors.vue:812-820](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L812-L820)（可参照同区块已有的「代码检查」按钮 `runPyCodeCheck`，L842-850）
- **clickhouse**：中间表建表单——`IntermediateTable/CreateDialog.vue`

**polars 请求/响应**：
```jsonc
// 请求
{ "code": "def calculate_factor(data, context):\n    ...", "context": {} }
// JSON 响应
{ "source": "import polars as pl\n...", "fallback": false, "fallback_reason": null, "entry_function": "calculate_factor", "original_mode": "polars_lazy" }
```

**clickhouse 请求/响应**：
```jsonc
// 请求（复用建表表单值）
{ "code": "...", "user_name": "my_ohlcv", "ttl": "30d", "workspace_db": "factor_workspace" }
// JSON 响应
{ "ddl": "CREATE TABLE ...", "table_name": "factor_workspace.it_my_ohlcv", "source_tables": [...], "fingerprint": "...", "fallback": false, "fallback_reason": null }
```

**复用建表表单时的字段名差异（重要）**：
| 建表表单字段 | translate/clickhouse 参数 | 说明 |
|---|---|---|
| `form.table_name` | `user_name` | 需做字段名映射 |
| `form.ttl` | `ttl` | 直接复用 |
| （无）| `workspace_db` | **前端不用填**，网关已强制注入 `factor_workspace_<user>` |

**fallback 处理（关键，不能只看 HTTP 状态码）**：
```typescript
const data = await (await fetch('/api/v1/translate/polars', {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({code})
})).json();
// fallback 时 HTTP 仍是 200！必须检查字段
if (data.fallback) showWarning(`翻译未完成：${data.fallback_reason}`);
editor.setValue(data.source);  // 半成品（含注释）也要展示
```

**下载**：`?as_file=1` 返回文件流，前端 `Blob` + `a[download]` 触发下载（polars→`.py`，clickhouse→`.sql`）。

**工作量**：约 2 天。

#### 2.1.2 ReportV03View warnings 对象化适配（真 bug，升级后必现）

**问题**：[ReportV03View.vue:155-165](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L155-L165) 把 warnings 当纯字符串渲染：
```vue
<el-alert v-for="(w,i) in warnings" :title="w" type="warning" ... />
```
配合 L162 附近 `warnings = computed<string[]>(() => report.value?.warnings ?? [])`。

但 v0.12.0 起 `report_v03.report.warnings[]` 每项是完整 `StageError` 对象（引擎 [schema.rs:14](file:///opt/work/backtest-engine/src/report/schema.rs#L14) `pub warnings: Vec<StageError>`），`:title="w"` 传对象会渲染成 **`[object Object]`**。只要任务产生任何 warning 就会触发。

**改法（推荐复用现有组件）**：
```vue
<!-- 直接把这段 el-alert 换成 StageErrors 组件 -->
<StageErrors v-if="warnings.length" :errors="warnings" />
```
```typescript
// 类型从 string[] 改为对象数组
const warnings = computed<any[]>(() => report.value?.warnings ?? [])
```
`StageErrors.vue` 已完整支持 severity/stage/code/message/suggestion/detail/context，直接复用最省事。

**工作量**：0.2 天。

#### 2.1.3 ReportView severity 映射补 fatal/error

**问题**：[ReportView.vue:168-171](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportView.vue#L168-L171)：
```typescript
const severityToType = (sev) => {
  if (sev === 'critical') return 'error'
  if (sev === 'warning') return 'warning'
  return 'info'   // v0.12.0 的 fatal / error 会掉这里 → 误显灰色
}
```
v0.12.0 的 severity 是 `fatal/error/warning/info`，`fatal` 和 `error` 都会落进 `info` 兜底，颜色不对。

**改法**：
```typescript
const severityToType = (sev) => {
  if (sev === 'fatal' || sev === 'critical') return 'error'
  if (sev === 'error') return 'warning'
  if (sev === 'warning') return 'warning'
  return 'info'
}
```
同时检查 L165 的 `severityOrder` 排序映射，补上 `fatal`/`error` 权重。

**工作量**：0.2 天。

#### 2.1.4 口径变化提示（用户确认必做）

**变更**：v0.13.0 回测口径变化，**与历史报告数值不可直接对比**：
- 停牌股 NAV 用昨收估值（停牌期净值/回撤/超额会变）
- 正负向分组镜像一致（负向因子分层组收益分布会变）
- Sharpe 与 annual_return 年化口径统一（Sharpe 可能 ±0.1~0.2）

**前端改动**：
1. 结果页顶部标注引擎版本（如「回测引擎 v0.13.0」）
2. 若有「历史对比」功能选了不同版本任务，弹窗提示：
   ```
   提示：v0.13.0 与更早版本回测口径不同（停牌 NAV / Sharpe 年化 / 分组逻辑），数值不可直接对比，建议用同一版本重跑后再对比。
   ```
3. 若前端有「由 annual_return/ann_vol 反推 Sharpe」的校验逻辑，现在二者严格自洽（rf=0），可去掉差异告警。

**定位**：指标卡片标签在 [ReportV03View.vue:234-238](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L234-L238)（`ann_return`/`excess_sharpe` 等）。版本对比提示需先确认前端是否有任务版本字段可读。

**工作量**：0.5 天。

### 2.2 可选优化项（低优先级）

| 项 | 内容 | 工作量 |
|---|---|---|
| 数据合理性校验 code 中文映射 | v0.11.0 的 `date_gap`/`universe_drop` 等 10 个 code 加中文文案 | 0.5 天 |
| warnings 按 stage 分组展示 | StageErrors 已平铺，可按 DataLoading/FactorCalc/Backtest 分组 | 0.3 天 |

### 2.3 前端工作量汇总

| 项 | 工作量 |
|---|---|
| 2.1.1 translate 下载组件 | 2 天 |
| 2.1.2 ReportV03View warnings 对象化 | 0.2 天 |
| 2.1.3 ReportView severity 补 fatal/error | 0.2 天 |
| 2.1.4 口径变化提示 | 0.5 天 |
| 联调测试 | 1 天 |
| **必做合计** | **约 4 天** |
| 可选优化 | +0.8 天 |

---

## 3. 部署 & DBA 清单

### 3.1 部署（高优先级，2 项）

#### 3.1.1 镜像重建（必做）

**原因**：v0.10.1 升级 pyo3 0.20 → 0.22，支持 Python 3.13

**动作**：
1. 拉取最新代码（`origin/main` HEAD `cde2385`）
2. 重建镜像：
   ```bash
   cd /opt/work/backtest-engine
   docker build -t backtest-engine:v0.13.0 .
   docker tag backtest-engine:v0.13.0 192.168.20.100:5000/backtest-engine:v0.13.0
   docker push 192.168.20.100:5000/backtest-engine:v0.13.0
   docker tag backtest-engine:v0.13.0 192.168.20.100:5000/backtest-engine:latest
   docker push 192.168.20.100:5000/backtest-engine:latest
   ```
3. 确认 Python 运行时 ≥ 3.13（Dockerfile 里或基础镜像）

#### 3.1.2 环境变量配置（按需）

**新增环境变量**：`BACKTEST_CH_HTTPS`

| 场景 | 配置 |
|------|------|
| ClickHouse 走 HTTPS | K8s deployment 加 `BACKTEST_CH_HTTPS=1` |
| 走 HTTP | 不设置（默认） |

**验证**：部署后调用任意回测任务，检查日志里 CH 连接 URL（http 或 https）

### 3.2 DBA（高优先级，1 项 + 3 确认项）

#### 3.2.1 确认 ClickHouse 实际端口（必做）

**问题**：网关硬编码 `port: 9000`（Native 接口），但如果生产 CH 走 HTTP 接口（8123），会连接失败。

**动作**：
1. 核查生产 ClickHouse 实际监听端口：
   - HTTP 接口：通常 8123
   - Native 接口：通常 9000
2. 告知网关开发实际端口，修改硬编码
3. 如走 HTTPS，确认证书配置（自签证书需处理信任）

#### 3.2.2 ~ 3.2.4（确认项）

| 项 | 说明 |
|---|------|
| 存量任务 port=0 回退 | 引擎会自动回退 8123，行为符合预期 |
| 本批次无 DDL 变更 | v0.10.0~v0.13.0 未改 `init_db.sql`，无需执行建表脚本 |
| HTTPS 环境变量 | 如 CH 走 HTTPS，与部署确认引擎 Pod 设了 `BACKTEST_CH_HTTPS=1` |

---

## 4. 验收测试用例

### 4.1 网关测试

| 用例 | 步骤 | 预期 |
|------|------|------|
| translate/polars JSON 模式 | `POST /v1/translate/polars` + 合法 code | 返回 `{"source": "...", "fallback": false}` |
| translate/polars 下载模式 | `POST /v1/translate/polars?as_file=1` | 返回 `Content-Type: text/x-python`、文件名 `translated_factor_polars.py` |
| translate/clickhouse workspace_db 注入 | `POST /v1/translate/clickhouse` + `workspace_db: "other_user"` | 实际下发给引擎时被覆盖为 `factor_workspace_<current_user>` |
| translate fallback 场景 | code 含 `@numba.njit` | HTTP 200 + `{"fallback": true, "fallback_reason": "unsupported statement: FunctionDef"}` |
| CH port 下发 | 提交回测任务，抓包/日志查看 credentials | `"port": 8123`（或实际端口，不是 9000 硬编码） |

### 4.2 前端测试

| 用例 | 步骤 | 预期 |
|------|------|------|
| polars 预览 | 因子编辑页点「预览翻译」 | 弹窗/编辑器显示 polars 源码 |
| polars 下载 | 点「下载 Polars 代码」 | 浏览器下载 `.py` 文件 |
| clickhouse DDL 预览 | 中间表建表页点「预览 DDL」 | 显示 CREATE TABLE 语句 + 表名 + 源表列表 |
| fallback 警告条 | 提交含 numba 的代码预览 | 黄色警告条显示「翻译未完成：unsupported statement: FunctionDef」，source 仍显示 |
| warnings 4 级展示 | 任务详情页查看 warnings | Info 灰色、Warning 蓝色、Error 黄色、Fatal 红色 |
| NaN 点图表 | 查看含 NaN 的收益曲线 | 曲线在 NaN 处断点（不是 0 值连线） |
| 口径变化提示 | 对比 v0.9.2 和 v0.13.0 任务 | 弹窗提示「回测口径不同，数值不可直接对比」 |

### 4.3 部署测试

| 用例 | 步骤 | 预期 |
|------|------|------|
| 镜像版本 | `kubectl get pod -n backtest -o yaml \| grep image:` | `backtest-engine:v0.13.0` 或 `latest` |
| Python 版本 | 进入 Pod 执行 `python --version` | `Python 3.13.x` |
| HTTPS 环境变量 | `kubectl exec <pod> -- env \| grep BACKTEST_CH_HTTPS` | 如 CH 走 HTTPS，显示 `BACKTEST_CH_HTTPS=1` |

---

## 5. 版本兼容性与回退策略

### 5.1 破坏性评估

| 版本 | 破坏性 | 说明 |
|------|--------|------|
| v0.10.0 | 低 | daily_return NaN 语义（0→NaN），前端图表需适配 |
| v0.10.1 | 无 | 纯新增端点 + pyo3 升级（API 无破坏） |
| v0.10.2 | 无 | CH port 读配置（port=0 回退 8123） |
| v0.11.0 | 低 | warnings 新增恒等式校验条目 |
| v0.12.0 | 低 | warnings JSON 多字段（只读 message 的旧前端无需改） |
| v0.13.0 | **中** | 回测数值口径变化，与旧报告不可直接对比 |

### 5.2 回退策略

如上线后发现重大问题，回退步骤：

1. **镜像回退**：
   ```bash
   kubectl set image deployment/backtest-engine \
     backtest-engine=192.168.20.100:5000/backtest-engine:v0.9.2 \
     -n backtest
   ```

2. **网关回退**：
   - 注释掉 `/v1/translate/*` 路由（或回滚代码）
   - CH port 改回硬编码 9000（如必要）

3. **前端回退**：
   - 隐藏「翻译下载」功能入口
   - warnings 展示回退到只读 message（忽略新字段）

4. **数据无损**：本批次改动**无 DB schema 变更**，回退无需数据迁移

### 5.3 灰度策略（可选）

如担心影响面大，可分阶段上线：

| 阶段 | 上线内容 | 灰度范围 |
|------|---------|---------|
| 阶段 1 | 网关 translate 端点 + 前端预览组件（只读，不影响回测） | 内部测试用户 |
| 阶段 2 | 镜像升级到 v0.13.0（回测口径变化） | 5% 用户 |
| 阶段 3 | 全量发布 | 全部用户 |

---

## 6. 附录

### 6.1 关键文件索引

**网关**：
- `/opt/api_gateway/internal/rest/handlers/translate/handler.go`（新建）
- `/opt/api_gateway/internal/rest/router.go`
- `/opt/api_gateway/internal/rest/handlers/backtest/handler.go`（CH port 修正）
- `/opt/api_gateway/internal/rest/handlers/backtest/data_handler.go`（CH port 修正）

**引擎**：
- `/opt/work/backtest-engine/src/bin/handlers/translate.rs`（translate 端点实现）
- `/opt/work/backtest-engine/scripts/pandas_to_polars.py`（PolarsSourceRenderer）
- `/opt/work/backtest-engine/src/db/clickhouse.rs`（CH port/HTTPS 修复）
- `/opt/work/backtest-engine/src/main.rs`（CH 错误诊断保留）

**文档**：
- `/opt/前端部署网关DBA对接说明-20260811-0813.md`（对接侧）
- `/opt/回测引擎更新说明-20260811-0813.md`（引擎侧详情）
- `/opt/work/backtest-engine/docs/翻译后原生代码下载-前端网关对接说明.md`（translate 端点专项）

### 6.2 联系人

| 角色 | 负责范围 | 对接人 |
|------|---------|--------|
| 网关开发 | translate 端点 + CH port 修正 | 我（Claude Code） |
| 前端开发 | translate 组件 + warnings 适配 | 前端工程师 |
| 引擎维护 | v0.13.0 代码 + 对接文档 | 同事（backtest-engine.git） |
| 部署运维 | 镜像重建 + 环境变量 | 运维 |
| DBA | CH 端口/协议确认 | DBA |

---

**编制说明**：本文档基于引擎同事提供的两份文档（前端部署网关DBA对接说明-20260811-0813.md、回测引擎更新说明-20260811-0813.md）以及网关代码实际情况编制。网关改造部分由我全权负责实施，前端部分提供给前端工程师参考。
