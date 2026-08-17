# 前端改造方案 — 回测引擎 v0.13.1 对接（benchmark 单选 + 分组收益对齐 + benchmark 空白修复）

> **基线版本**：v0.13.0（当前线上引擎 HEAD `cde2385`，Cargo.toml `0.13.0`）
> **目标版本**：v0.13.1（benchmark 单选限制，提交 `56c7cc1`，核心改动 `4f241ff`）
> **本轮范围**：benchmark 多选→单选、分组收益口径对齐、benchmark 下拉空白修复
> **编制日期**：2026-08-17
> **状态**：benchmark 空白修复已落地验证（网关侧）；其余两块待实施

---

## 0. 综述

### 0.1 本轮三件事速览

| # | 事项 | 影响方 | 破坏性 | 优先级 | 状态 |
|---|------|--------|--------|--------|------|
| 1 | **benchmark 下拉空白修复** | 网关 | 无 | 高 | ✅ **已修复并验证** |
| 2 | **benchmark 多选 → 单选** | 前端（配合引擎 v0.13.1） | 中（UI 交互变更） | 高 | 📋 待实施 |
| 3 | **分组收益口径对齐** | 前端（验证为主） | 无 | 中 | 📋 待验证 |

### 0.2 部署节奏与兼容性（重要）

引擎 v0.13.1 的单选限制**尚未部署**（当前线上为 v0.13.0）。前后端改动顺序的兼容关系：

| 顺序 | 结果 |
|------|------|
| 前端先改单选 → 引擎后升 v0.13.1 | ✅ **兼容**。单选对 v0.13.0 同样合法（数组长度≤1 一直合法），平滑过渡。**推荐此顺序** |
| 引擎先升 v0.13.1 → 前端未改多选 | ❌ **报错**。用户选多个 benchmark 时引擎返回 `"benchmarks 仅支持单选基准..."` |

**结论：前端单选改造应先于引擎 v0.13.1 镜像部署，或两者同批上线。**

---

## 1. benchmark 下拉空白修复（✅ 已完成）

### 1.1 根因

前端 benchmark 下拉数据来自 `GET /api/v1/backtest/price-type-options` 的 `data.benchmarks.standard_indexes`。

实测该接口返回 **HTTP 403**：

```json
{"error":"Permission denied","message":"Your API key does not have permission to access this resource"}
```

**根因**：网关鉴权按 `method:path` 逐条匹配权限注册表（`/opt/api_gateway/data/permission_registry.json`）。backtest 模块逐条注册了 `stock_pools / submit / tasks / task.detail / ...` 等权限，**唯独漏注册 `price-type-options`**。鉴权逻辑对"注册表中无匹配资源"的请求一律返回 403 → 任何普通 Key 调此接口都被拒 → 前端拿不到 `standard_indexes` → 下拉空白。

### 1.2 修复方式（按"大家都会用的基础接口不做权限"原则）

该接口是回测提交页的**基础选项数据源**（价格类型/基准指数/时段预设），所有用回测功能的人都需要，不应走逐条权限校验。

**改动**：将 `price-type-options` 从带权限校验的 `backtestGroup`（`middleware.Auth`）摘出，挂到**只认证 API Key、跳过权限校验**的独立分组（`middleware.AuthenticateOnly`，与 translate 路由同模式）。

文件：[router.go](file:///opt/api_gateway/internal/rest/router.go#L636-L655)

```go
// 回测基础选项接口（价格类型/基准指数/时段预设），所有有效 Key 都可用，
// 只做 API Key 认证、跳过权限校验（与 translate 同模式，"大家都会用则不做权限"）
backtestOpenGroup := v1.Group("/backtest")
{
    if cfg.Auth.Enabled {
        backtestOpenGroup.Use(middleware.AuthenticateOnly(cfg.Auth))
    }
    backtestOpenGroup.GET("/price-type-options", backtest.GetPriceTypeOptions)
}
```

> 注：权限**未删除**，而是把该接口移到免权限分组。其余需权限的 backtest 接口不受影响。

### 1.3 验证结果（2026-08-17 已实测）

重启网关后实测：

```
GET /api/v1/backtest/price-type-options  →  200 OK（修复前 403）
standard_indexes: 8 个（sh000001 上证指数 / sh000300 沪深300 / sh000905 中证500 /
                       sh000852 中证1000 / sh000016 上证50 / sz399001 深证成指 /
                       sz399006 创业板指 / sh000688 科创50）
index_list: 4 个；index_industries: 4 组（CSI300/CSI500/CSI1000/SSE50）
```

返回同时含 `rebalance_price_types`（前端 [SubmitContent.vue:2527](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L2527) 优先读取）与 `time_filter_presets`，结构与前端解析逻辑完全匹配。**前端重新打开回测提交页，benchmark 下拉即恢复。**

### 1.4 前端轻提示（✅ 已拍板纳入实施）

当前前端对 `getPriceTypeOptions` 失败仅 `console.error`，用户无感知、呈现"静默空白"。在 [SubmitContent.vue:2565](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L2565) catch 分支补一句用户可见提示（`ElMessage` 已于 L1109 导入，可直接用），避免未来网关权限再漏配时无感知：

```ts
} catch (error) {
  console.error('加载价格类型选项失败:', error)
  ElMessage.warning('基准指数/价格类型选项加载失败，请检查网络或联系管理员')
}
```

---

## 2. benchmark 多选 → 单选（📋 待实施）

### 2.1 引擎 v0.13.1 的确切约束（已核实源码）

提交 `4f241ff fix(backtest): benchmarks 限制单选，避免多基准超额口径不一致`：

- **请求模型不变**：`benchmarks: Option<Vec<String>>`（仍是数组，[models.rs:366](file:///opt/work/backtest-engine/src/api/models.rs#L366)）
- **校验逻辑**（`validate_task_config_for_product`，main.rs）：统计**有效基准数**，`> 1` 则报错：
  - "有效"判定：去掉空串、`"none"`、未知指数（`BenchmarkIndex::None`）后剩余的个数
  - 报错文案：`"benchmarks 仅支持单选基准，当前提交 N 个有效基准，请只选择一个；多基准超额对比暂不支持（引擎按单一基准计算超额）"`
- **未配置时**：按股票池**自动匹配单选默认值**（提交 `1620e8d`），前端不选也有兜底

**对前端的关键结论：提交格式不变，仍传数组，只是长度从"任意"收紧到"≤1"。**

### 2.2 前端现状

| 位置 | 现状 |
|------|------|
| 状态 | [SubmitContent.vue:1226](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L1226) `const selectedBenchmarks = ref<string[]>([])`（数组） |
| UI（标准指数） | [L741-L749](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L741-L749) `el-checkbox-group` 多选 |
| UI（指数行业） | [L760-L768](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L760-L768) `el-checkbox-group` 多选 |
| 已选标签 | [L777-L789](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L777-L789) 多 tag 展示 + `removeBenchmark` |
| 提交 | [L2335](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L2335) `benchmarks: selectedBenchmarks.value`（数组） |

### 2.3 改造方案

**思路**：UI 改单选（radio），数据层仍保留数组（提交格式不变），改动最小、对后端零影响。

**单选语义（已评审拍板）：全局唯一**。两个 Tab（标准指数 / 指数行业）共享同一个 `selectedBenchmark` 单值，无论在哪一页选，全程只保留 1 个基准；在指数行业 Tab 选了某项再切回标准指数 Tab，之前的选中自动取消（单值只能存一个，Vue 自动同步）。这符合引擎"仅支持单选基准"的语义，无需额外处理。
> 不采用"按 Tab 各留一个"：那会凑出 2 个基准，违背引擎单选约束。

#### 改动点 1：标准指数 Tab — checkbox-group → radio-group

[SubmitContent.vue:741-L749](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L741-L749)

```vue
<!-- 改前：el-checkbox-group 多选 -->
<el-checkbox-group v-model="selectedBenchmarks" class="benchmark-checkbox-group">
  <el-checkbox v-for="opt in standardIndexes" :key="opt.value" :label="opt.value">
    {{ opt.label }}
  </el-checkbox>
</el-checkbox-group>

<!-- 改后：el-radio-group 单选，v-model 绑单值 -->
<el-radio-group v-model="selectedBenchmark" class="benchmark-checkbox-group">
  <el-radio v-for="opt in standardIndexes" :key="opt.value" :value="opt.value">
    {{ opt.label }}
  </el-radio>
</el-radio-group>
```

#### 改动点 2：指数行业 Tab — 同步改 radio

[SubmitContent.vue:760-L768](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L760-L768)，`el-checkbox-group` → `el-radio-group`，`el-checkbox` → `el-radio`，v-model 同样绑 `selectedBenchmark`。

#### 改动点 3：状态 — 新增单值 ref，提交时包成数组

[L1226](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L1226) 附近：

```ts
// 改后：单值（''表示未选）
const selectedBenchmark = ref<string>('')
```

#### 改动点 4：已选提示 — 单 tag + `removeBenchmark` 无参化

[L777-L789](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L777-L789) 模板：单选后只会有 1 个，把 `v-if="selectedBenchmarks.length > 0"` 改为 `v-if="selectedBenchmark"`，`v-for` 去掉、直接显示 `getBenchmarkLabel(selectedBenchmark)`，`@close="removeBenchmark"`（不再传参）。

[L1240-L1245](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L1240-L1245) `removeBenchmark` 简化：

```ts
// 改后：单选，直接清空（无参）
const removeBenchmark = () => {
  selectedBenchmark.value = ''
}
```

> `getBenchmarkLabel(value)` 签名不变（仍接收单个 value 查 label），无需改动。

#### 改动点 5：提交 — 单值包数组

[L2335](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L2335)：

```ts
// 改后：'' 视为未选传空数组，否则传单元素数组（引擎格式不变）
benchmarks: selectedBenchmark.value ? [selectedBenchmark.value] : [],
```

#### 改动点 6：提示文案

[L775](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L775) `"可多选，不选则不计算超额"` → `"仅支持单选；不选则按股票池自动匹配基准"`。

### 2.4 兼容性说明

- **对 v0.13.0**：单选提交（数组长度≤1）一直合法，改造后可立即上线，无需等引擎升级。
- **对 v0.13.1**：改造后不会再触发多选报错。
- **空选**：传 `[]`，引擎按股票池自动匹配默认基准（v0.13.1 行为），v0.13.0 下空选则不计算超额——两种行为都合理，前端无需区分。

---

## 3. 分组收益口径对齐（📋 待验证）

### 3.1 两页取值链路（已核实代码）

概览页与详细报告页来自**同一接口** `GET /task/{id}/result`（IPC `backtest:getResult`），但读**两套由引擎不同模块分别产出**的字段：

| 页面 | 取值路径 | 口径 |
|------|----------|------|
| **概览页** ResultContent.vue | `factor_results[].period_ic_stats[].layer_returns`（[L2136](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ResultContent.vue#L2136)）等 | 各组**单边几何年化** |
| **详细报告页** ReportV03View.vue | `summary.report_v03.report.layers[].groups[].nav / metrics`（[L267-L304](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L267-L304)） | 含 `interval_return` 区间收益、`ann_return` 纯多头几何年化 |

**关键风险**：前端**没有交叉换算机制**，两套字段若引擎计算口径不一致，两边数字就会对不上。

### 3.2 引擎侧口径统一现状

引擎 v0.13 已做分层收益口径统一（前端无需改取值逻辑，只需验证）：

- `f7ab034` 资金曲线口径分层收益（LayerAccountSimulator）
- `b70e953` 各周期独立资金账户（方案B），资金曲线按调仓频率分化
- `68432f0` 收益计算每日连续模式，各周期分层收益统一用 `state_machine_return`
- `a79faec` 因子正负向分组不取负，保证正负向镜像一致

### 3.3 前端验证清单（不改代码，验证展示）

用同一 task_id 跑一个 research 模式回测（含 benchmark），对照两页同一指标：

| 验证项 | 概览页取值 | 报告页取值 | 期望 |
|--------|-----------|-----------|------|
| 组1（多头）年化收益 | `period_ic_stats[?].layer_returns[0]` | `layers[?].groups[0].metrics.ann_return` | **数值一致**（同口径几何年化） |
| 年化口径 | 标题"各组单边几何年化"（[L941](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ResultContent.vue#L941)） | `ann_return` 标注"纯多头几何年化" | 口径描述一致 |
| 分层净值曲线 | — | `layers[].groups[].nav` 与 `benchmark_nav` | 起点对齐回测区间、无预热期数据 |
| 超额净值 | — | `groups[assessment_group-1].excess_nav_series` | 单选 benchmark 下只有 1 条基准曲线 |

### 3.4 若发现不一致的排查方向

1. **周期选择错位**：概览页 `selectedPeriods[index]` 与报告页 `selectedLayerIdx` 相互独立，先确认对比的是**同一周期**。
2. **年化 vs 累计**：概览页"年化/累计"切换（`layerReturnType`）只影响柱状图，基准对比表固定读年化 `layer_returns`；报告页 `interval_return` 是区间累计、`ann_return` 是年化——**对比时必须同为年化或同为累计**。
3. **引擎侧口径未对齐**：若同周期同口径下数值仍不一致，则是引擎 `period_ic_stats`（engine.rs 产出）与 `report_v03.layers`（research.rs 产出）两套计算逻辑差异，需反馈引擎侧（非前端问题）。

---

## 4. 工作量评估

| 事项 | 影响方 | 工作量 |
|------|--------|--------|
| benchmark 空白修复 | 网关 | ✅ 已完成（0.5 天，含定位+改动+验证） |
| benchmark 单选改造 | 前端 | **0.5~1 天**（6 处改动 + 自测） |
| 分组收益对齐验证 | 前端 | **0.5 天**（跑数对照，一般无需改码） |
| **合计** | — | **约 1~1.5 天**（不含已完成的空白修复） |

---

## 5. 上线检查清单

- [x] 网关 `price-type-options` 免鉴权改动，编译通过（`make quick-build`）
- [x] 网关重启，`price-type-options` 实测 200 且返回 8 个标准指数
- [ ] 前端 benchmark 单选改造（radio 化 + 提交包数组 + 文案 + 轻提示，共 7 处）
- [ ] 前端单选自测（选 1 个 / 不选 / 跨 Tab 切换全局唯一 / 选项加载失败提示，确认提交 `benchmarks` 长度≤1）
- [ ] 分组收益两页对照验证（同 task 同周期同口径）
- [ ] 引擎 v0.13.1 镜像部署（**须在前端单选上线之后或同批**）
