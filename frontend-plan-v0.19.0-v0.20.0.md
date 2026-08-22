# 前端改造方案 v0.19.0→v0.20.0（2026-08-20）

> 对接回测引擎 v0.13.1→v0.20.0（文档：前端网关部署DBA对接说明-20260817-0820.md）
> 适用前端仓库：market-data-downloader（当前 v2.7.3，HEAD `e0a7ef7`）
> 涉及文件均在 `src/renderer/views/FactorLibrary/Backtest/` 或 `src/main/index.ts`
>
> **要求：17 项全部实现，不缺项、不分阶段。**

---

## 改动总览

| # | 优先级 | 改动项 | 涉及文件 |
|---|--------|--------|----------|
| 1 | **高** | 概览页超额收益/超额夏普改用后端字段 | `ResultContent.vue` |
| 2 | 中 | 详细报告页分层超额净值曲线改为遍历所有组 | `ReportV03View.vue` |
| 3 | **高** | 超额净值曲线停止首日归一化（确认） | `ReportV03View.vue` |
| 4 | **高** | benchmark 单选（已实现，确认） | `SubmitContent.vue` `MyFactors.vue` |
| 5 | 中 | 入库审核概览页 layer_returns 回填确认 | `ReportView.vue` |
| 6 | **高** | 中间表建表改用异步 /build + 轮询 | `index.ts` `CreateDialog.vue` `preload/index.ts` |
| 7 | 中 | 中间表管理页增加"去重元数据"按钮 | `ListContent.vue` `index.ts` `preload/index.ts` |
| 8 | 中 | 小表建表用 /ddl（同步幂等） | `index.ts` `preload/index.ts` |
| 9 | 中 | 数据源配置支持 role: IntermediateOnly | `SubmitContent.vue` `MyFactors.vue` `backtest.ts` |
| 10 | 中 | 错误卡片完整展示 ClickHouse DB::Exception | `CreateDialog.vue` |
| 11 | 低 | __py_file__ 哨兵值（已实现，确认） | `MyFactors.vue` |
| 12 | 中 | 详细报告绘制残差分层净值曲线与残差IC | `ReportV03View.vue` |
| 13 | 低 | 基准对比表超额收益语义落到因子列 | `ResultContent.vue` |
| 14 | **高** | 快照前视测试状态徽标 | `ResultContent.vue` |
| 15 | **高** | lookahead_suspected 卡片标红 + 跳变示例展开 | `ResultContent.vue` |
| 16 | 中 | needs_strong_review 显著标记 + python_validate 告警 | `ResultContent.vue` `SubmitContent.vue` `MyFactors.vue` |
| 17 | 中 | 头条收益按费后净收益展示（已实现，确认） | 全局 |

---

## 1. 概览页超额收益/超额夏普改用后端字段【高优先】

**文件**：`src/renderer/views/FactorLibrary/Backtest/ResultContent.vue`

**问题**：`benchmarkCompareData()` 函数（行 2124-2191）中"超额收益"和"超额夏普"用算术减法：

```js
// 行 2175（当前·错误）
const excess = (groupAnnualReturn || 0) - (bm.benchmark_annual_return || 0)

// 行 2184（当前·错误）
const excess = (groupSharpe || 0) - (bm.benchmark_sharpe || 0)
```

引擎超额收益走几何相对净值口径（`excess_nav = strategy_nav / benchmark_nav`），算术减法是错误口径。

**改法**：后端 `benchmark_metrics` 每项已带 `excess_return` / `excess_sharpe` / `excess_max_drawdown`，直接用：

```js
// 行 2172-2178 改为：
const row4: any = { metric_name: '超额收益', strategy: '-', strategy_raw: null }
result.value?.benchmark_metrics?.forEach((bm: any) => {
  row4[bm.benchmark_code + '_raw'] = bm.excess_return
  row4[bm.benchmark_code] = formatPercent(bm.excess_return)
})

// 行 2181-2187 改为：
const row5: any = { metric_name: '超额夏普', strategy: '-', strategy_raw: null }
result.value?.benchmark_metrics?.forEach((bm: any) => {
  row5[bm.benchmark_code + '_raw'] = bm.excess_sharpe
  row5[bm.benchmark_code] = formatNumber(bm.excess_sharpe, 2)
})

// 如需展示超额最大回撤，同理用 bm.excess_max_drawdown
```

**可选增强（第 13 项）**：超额是"因子相对基准"的量，语义上应落在因子列。若要让因子列按选中组显示超额，取 `period_ic_stats[].layer_excess_returns[benchmark_source][groupIndex]`（每组年化超额，与详细报告同源）。

---

## 2. 详细报告页分层超额净值曲线改为遍历所有组【中优先】

**文件**：`src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue`

**问题**：行 292-307 只取 `exLayer.assessment_group` 一组的 `excess_nav_series`，未遍历所有组：

```js
// 行 296-304（当前·只画一组）
const g = exLayer?.assessment_group ?? null
if (g && exGroups[g - 1]?.excess_nav_series) {
  specs.push({
    id: 'excess-nav',
    title: `超额净值曲线（第${g}组 · 周期 ${exLayer?.period}）`,
    // series 只有一条
  })
}
```

**改法**：参照"分层净值曲线"（行 270-289）的 `groups.map(...)` 遍历写法：

```js
// 建议改为：每组都画超额净值
if (exGroups.length && exGroups.some(g => Array.isArray(g.excess_nav_series))) {
  const excessSeries = exGroups
    .filter(g => Array.isArray(g.excess_nav_series))
    .map(g => ({
      name: `第${g.group}组超额`, type: 'line', showSymbol: false,
      connectNulls: true, data: nz(g.excess_nav_series)
    }))
  specs.push({
    id: 'excess-nav',
    title: `分层超额净值曲线（周期 ${exLayer?.period}）`,
    option: {
      tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 },
      grid: baseGrid,
      xAxis: { type: 'category', data: exDates },
      yAxis: { type: 'value', scale: true },
      series: excessSeries
    }
  })
}
```

> 注：admission 模式无多组概念，不涉及本问题。

---

## 3. 超额净值曲线停止首日归一化【高优先·确认项】

**文件**：`ReportV03View.vue`

**现状**：行 176-177 的 `nz()` 函数只做 NaN→null，无首日归一化。后端 v0.15.0 起 `excess_nav_curves` 四数组（dates/strategy_nav/benchmark_nav/excess_nav）保留基点 1.0，长度 = n+1，首元素 = 1.0。

**结论**：前端**已经正确**——不归一化、直接按 index 映射。末值 - 1 即区间涨幅。无需改动，确认即可。

---

## 4. benchmark 单选限制【高优先·确认项】

**文件**：`SubmitContent.vue`（行 741/760）、`MyFactors.vue`（行 1711）

**现状**：已改为 `el-radio-group` 单选，提交时 `benchmarks: [selectedBenchmark]` 单元素数组，提示语"仅支持单选；不选则按股票池自动匹配"。

**结论**：已实现，无需改动。

---

## 5. 入库审核概览页 layer_returns 回填【中优先·确认项】

**文件**：`ReportView.vue`（admission 看板）、`ResultContent.vue`（行 938-968 分层收益柱状图）

**现状**：引擎 `663fdae` 已修复 `backfill_from_admission_report`，admission 概览页 `layer_returns` 等可正常回填。前端研究模式的分层收益柱状图已读 `layer_returns`。admission 看板（`ReportView.vue`）的 `sampleMetrics` 表无 `layer_returns` 行。

**结论**：后端已修复回填，前端研究模式展示正常。admission 看板可选增加分层收益展示行（复用研究模式的渲染逻辑），优先级低。

---

## 6. 中间表建表改用异步 /build + 轮询【高优先】

**涉及文件**：
- `src/main/index.ts`（行 6307-6330，IPC handler）
- `src/preload/index.ts`（行 312-320，preload 绑定）
- `src/renderer/views/FactorLibrary/IntermediateTable/CreateDialog.vue`（行 300，调用处）

**问题**：当前 `intermediateTable:create` 用 `axios.post` + `timeout: 30000` 同步等待，大表（CREATE TABLE AS SELECT）超 30s 会超时。

**改法**：

### 6.1 主进程新增 IPC（`src/main/index.ts`）

在 `intermediateTable:create` handler 后新增：

```typescript
// 中间统计表: 异步建表（大表，返回 build_id 后轮询）
ipcMain.handle('intermediateTable:build', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) return { success: false, error: '未找到API Key' }
    const axios = require('axios')
    const response = await axios.post(`${MIDSTATS_API_BASE}/build`, data, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      timeout: 30000  // 提交本身不超时，30s 仅兜底
    })
    return { success: true, data: response.data }  // { build_id, table_name, ... }
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})

// 中间统计表: 查询建表进度
ipcMain.handle('intermediateTable:buildStatus', async (_event, buildId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) return { success: false, error: '未找到API Key' }
    const axios = require('axios')
    const response = await axios.get(`${MIDSTATS_API_BASE}/build/${encodeURIComponent(buildId)}`, {
      headers: { 'X-API-Key': apiKey },
      timeout: 10000
    })
    return { success: true, data: response.data }  // BuildState
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})
```

### 6.2 preload 绑定（`src/preload/index.ts`）

在 `intermediateTable` 对象（行 312-320）中新增：

```typescript
intermediateTable: {
  // ... 现有方法 ...
  build: (data: any) => ipcRenderer.invoke('intermediateTable:build', data),
  buildStatus: (buildId: string) => ipcRenderer.invoke('intermediateTable:buildStatus', buildId),
}
```

### 6.3 CreateDialog 改为轮询（`CreateDialog.vue`）

```typescript
let pollTimer: ReturnType<typeof setInterval> | null = null

// 清理轮询：在 el-dialog @close 事件 + onBeforeUnmount 双保险
// 注意：CreateDialog.vue 有 destroy-on-close（行 9），关对话框时销毁的是 slot 内容，
// 组件本身不会 unmount，所以 onUnmounted 不会触发。
// 已 import 的是 onBeforeUnmount（行 87），不是 onUnmounted。
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
onBeforeUnmount(() => {
  stopPolling()
})
// el-dialog 上加 @close="stopPolling"（见 template 部分）

// handleSubmit 改为：
const buildResult = await window.electronAPI.intermediateTable.build(payload)
if (!buildResult.success) {
  ElMessage.error(buildResult.error || '提交建表失败')
  return
}
const { build_id } = buildResult.data

// 轮询进度（1.5s 间隔）
pollTimer = setInterval(async () => {
  const status = await window.electronAPI.intermediateTable.buildStatus(build_id)
  if (!status.success) return
  const s = status.data
  // 更新进度条：s.progress (0-100), s.detail, s.elapsed_secs, s.read_rows
  progressPercent.value = s.progress
  progressDetail.value = s.detail
  if (s.status === 'completed') {
    clearInterval(pollTimer!)
    pollTimer = null
    ElMessage.success('建表完成')
    // 刷新列表
  } else if (s.status === 'failed') {
    clearInterval(pollTimer!)
    pollTimer = null
    ElMessage.error(s.error || '建表失败')
  }
}, 1500)
```

> 与 /ddl 的区别：/ddl 同步执行、立即返回，适合小表；/build 异步带进度，适合大表。前端可在 UI 上提供两种模式，或统一走 /build。

---

## 7. 中间表管理页增加"去重元数据"按钮【中优先】

**涉及文件**：
- `src/renderer/views/FactorLibrary/IntermediateTable/ListContent.vue`（行 107-113，操作列）
- `src/main/index.ts`、`src/preload/index.ts`

### 7.1 主进程新增 IPC

```typescript
// 中间统计表: 元数据去重
ipcMain.handle('intermediateTable:dedup', async (_event) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) return { success: false, error: '未找到API Key' }
    const axios = require('axios')
    const response = await axios.post(`${MIDSTATS_API_BASE}/dedup`, {}, {
      headers: { 'X-API-Key': apiKey },
      timeout: 30000
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})
```

### 7.2 preload 绑定

```typescript
dedup: () => ipcRenderer.invoke('intermediateTable:dedup'),
```

### 7.3 ListContent.vue

在操作列（行 109-111 之间）或 header 工具栏新增"去重元数据"按钮：

```html
<el-button size="small" link type="warning" @click="handleDedup">去重元数据</el-button>
```

```typescript
const handleDedup = async () => {
  const result = await window.electronAPI.intermediateTable.dedup()
  if (result.success) {
    ElMessage.success(result.data?.message || `已去重 ${result.data?.deduped?.length || 0} 个表名`)
    refreshList()
  } else {
    ElMessage.error(result.error || '去重失败')
  }
}
```

---

## 8. 小表建表用 /ddl（同步幂等）【中优先】

**涉及文件**：`src/main/index.ts`、`src/preload/index.ts`

### 8.1 主进程新增 IPC

```typescript
// 中间统计表: DDL 直接建表（同步、幂等，适合小表）
ipcMain.handle('intermediateTable:createFromDDL', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) return { success: false, error: '未找到API Key' }
    const axios = require('axios')
    const response = await axios.post(`${MIDSTATS_API_BASE}/ddl`, data, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      timeout: 60000  // 小表 60s 够了
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})
```

### 8.2 preload 绑定

```typescript
createFromDDL: (data: any) => ipcRenderer.invoke('intermediateTable:createFromDDL', data),
```

---

## 9. 数据源配置支持 role: IntermediateOnly【中优先】

**涉及文件**：
- `src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue`（行 1367-1382，数据源 formData）
- `src/renderer/views/FactorLibrary/MyFactors.vue`（行 2437-2451，DataSourceItem 类型）
- `src/renderer/types/backtest.ts`（行 44，data_sources 类型）
- `src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue`（行 2294-2326，processedDataSources 提交逻辑）

### 9.1 类型定义

`backtest.ts` 中 DataSourceItem 或 data_sources 项新增：

```typescript
role?: 'load' | 'intermediate_only'  // 缺省 load；intermediate_only = 仅 DDL 聚合源
```

### 9.2 提交逻辑

`SubmitContent.vue` 的 `processedDataSources`（行 2294-2326）和 `MyFactors.vue` 的 `buildDataSources`（对应位置）中新增透传：

```typescript
// 在 mappedDataSources 的 map 中新增
role: ds.role || undefined,
```

### 9.3 UI

数据源配置表单中新增一个下拉（直接放在数据源行内，无需折叠区，项目里没有 showAdvanced 变量）：

```html
<el-form-item label="数据源角色">
  <el-select v-model="ds.role" placeholder="正常加载" clearable>
    <el-option label="正常加载（进回测）" value="load" />
    <el-option label="仅中间表聚合源（不加载进内存）" value="intermediate_only" />
  </el-select>
</el-form-item>
```

---

## 10. 错误卡片完整展示 ClickHouse DB::Exception【中优先】

**文件**：`src/renderer/views/FactorLibrary/IntermediateTable/CreateDialog.vue`（行 306）

**问题**：当前用 `ElMessage.error(result.error)`（轻提示 toast），长 DB::Exception 会被视觉截断。

**改法**：对建表/重建这类可能产生长错误的操作，改用 `ElMessageBox.alert`：

```typescript
// 行 306 改为：
if (result.error) {
  ElMessageBox.alert(result.error, isRebuild.value ? '重建失败' : '创建失败', {
    confirmButtonText: '关闭',
    customClass: 'error-detail-dialog',
    dangerouslyUseHTMLString: false,
    type: 'error'
  })
}
```

配合 CSS 保证长文本可滚动 + 可复制：

```css
.error-detail-dialog .el-message-box__message {
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 13px;
}
```

---

## 11. __py_file__ 哨兵值识别【低优先·确认项】

**文件**：`src/renderer/views/FactorLibrary/MyFactors.vue`（行 3889-3896 写入，行 3494-3501 读取）

**现状**：已实现。写入时 `expressionValue = '__py_file__'`，读取时优先用 `expression_type`，回退判断 `expression === '__py_file__'`。后端已识别该哨兵值。

**结论**：无需改动，确认即可。

---

## 12. 详细报告绘制残差分层净值曲线与残差IC【中优先】

**文件**：`src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue`

**问题**：研究模式选风险因子剥离后，后端 `neutralization` 字段已产出 `residual_portfolio` / `neutralized_ic_pages` / `original_portfolio` / `pearson`，但前端未绘制。

### 12.1 数据来源

```jsonc
neutralization: {
  residual_portfolio: [  // LayersBlock[]，按周期分页，每组带 nav / excess_nav_series
    { groups: [{ group: 1, nav: [...], excess_nav_series: [...] }] }
  ],
  neutralized_ic_pages: [  // IcPage[]，与 ic_pages 同结构
    { period: 5, dates: [...], ic_series: [...], rank_ic_series: [...] }
  ],
  original_portfolio: [...],
  pearson: [...]
}
```

### 12.2 残差分层净值曲线

在 `chartSpecs`（行 260+）中新增，参照 `layers-nav` 写法：

```typescript
// 残差分层净值曲线
const neutr = summary.value?.neutralization
if (neutr?.residual_portfolio) {
  const resLayers = neutr.residual_portfolio[selectedLayerIdx.value]
  if (resLayers?.groups?.length) {
    const resSeries = resLayers.groups.map((g: any) => ({
      name: `残差·第${g.group}组`, type: 'line', showSymbol: false,
      connectNulls: true, data: nz(g.nav)
    }))
    specs.push({
      id: 'residual-nav',
      title: `残差分层净值曲线（周期 ${resLayers.period}）`,
      option: {
        tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 },
        grid: baseGrid,
        xAxis: { type: 'category', data: resLayers.dates || [] },
        yAxis: { type: 'value', scale: true },
        series: resSeries
      }
    })
  }
}
```

### 12.3 残差 IC 时序

参照 `ic-page` 写法：

```typescript
if (neutr?.neutralized_ic_pages?.length) {
  const neutPage = neutr.neutralized_ic_pages[selectedNeutIcIdx.value] ?? neutr.neutralized_ic_pages[0]
  if (neutPage) {
    specs.push({
      id: `neut-ic-page-${selectedNeutIcIdx.value}`,
      title: `残差 IC 时序（周期 ${neutPage.period}）`,
      option: {
        tooltip: { trigger: 'axis' }, legend: { data: ['IC', 'Rank IC'], type: 'scroll', bottom: 0 },
        grid: baseGrid,
        xAxis: { type: 'category', data: neutPage.dates || [] },
        yAxis: { type: 'value' },
        series: [
          { name: 'IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(neutPage.ic_series) },
          { name: 'Rank IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(neutPage.rank_ic_series) }
        ]
      }
    })
  }
}
```

> 需新增 `selectedNeutIcIdx` ref 和对应的周期切换器。`neutralization` 失败时后端不返回该字段，前端按未启用剥离处理（已有的 `if (neutr?.)` 判空兜底）。

---

## 13. 基准对比表超额收益语义落到因子列

**文件**：`ResultContent.vue`（行 2173-2188）

**现状**：超额收益行因子列写死 `strategy: '-'`，超额数值落在基准列。

**改法**：与 #1 配合。#1 把基准列的超额收益改用后端 `bm.excess_return`（多头腿相对基准）；#13 把因子列也填上选中组的超额收益，取 `period_ic_stats[].layer_excess_returns[benchmark_source][groupIndex]`。

> **数据源已确认**：引擎 `api/models.rs:654` 定义了 `layer_excess_returns: Option<HashMap<String, Vec<f64>>>`，`main.rs:1434/1601` 有实际赋值逻辑。前端确实从未引用过，但后端**确实在返回**此字段。

```typescript
// 超额收益行
// 注意：key 是 benchmark_source（如 "csi500"），不是 benchmark_code
const layerExcess = periodData.layer_excess_returns?.[bm.benchmark_source]?.[groupIndex]
const row4: any = { metric_name: '超额收益' }
row4.strategy_raw = layerExcess
row4.strategy = formatPercent(layerExcess)
// 基准列仍用 bm.excess_return（多头腿相对基准）
```

> 注意：`benchmark_metrics.excess_return` 是多头腿（Q1）相对各基准的值；`layer_excess_returns` 是每组年化超额。两者口径不同，按需选择。

---

## 14. 快照前视测试状态徽标【高优先】

**文件**：`src/renderer/views/FactorLibrary/Backtest/ResultContent.vue`

**现状**：admission 概览（行 407-410）已有 `el-tag` 展示 `factor_snapshot_test.status`，并用 `getStatusTagType()` 做颜色区分。但 `getStatusTagType`（行 1802-1808）的 danger 数组里**没有 `lookahead_suspected`**，它会 fall through 到 `'info'`（灰色），而不是 `'danger'`（红色）。research 模式（行 350-375）完全不展示快照测试结果。

### 14.1 修正颜色映射（一行改完）

在 `getStatusTagType` 函数（行 1806）的 danger 数组里加 `'lookahead_suspected'`：

```typescript
// 行 1806 改为：
if (['fail', 'failed', 'error', 'reject', 'rejected', 'lookahead_suspected'].includes(status)) return 'danger'
```

### 14.2 research 模式补充展示

research 区域（行 350-375）的 `analysis-flags` div（行 361）内，加一个快照测试状态标签：

```html
<!-- 在行 362 的 el-tag 后面加 -->
<el-tag
  v-if="summary.factor_snapshot_test?.status"
  size="small"
  :type="getStatusTagType(summary.factor_snapshot_test.status)"
  effect="plain"
>
  前视: {{ summary.factor_snapshot_test.status }}
</el-tag>
```

---

## 15. lookahead_suspected 卡片标红 + 跳变示例展开【高优先】

**文件**：`ResultContent.vue`

### 15.1 卡片标红

当 `factor_snapshot_test.status === 'lookahead_suspected'` 时，任务卡片加红色边框 + "前视风险"角标。

**注意**：ResultContent.vue 中没有 `el-card`，实际结构是 `div.analysis-card`（行 351/378/631/667）。class 和 CSS 选择器都要对应改：

```html
<div class="analysis-card" :class="{ 'lookahead-risk': summary?.factor_snapshot_test?.status === 'lookahead_suspected' }">
  <!-- 角标 -->
  <div v-if="summary?.factor_snapshot_test?.status === 'lookahead_suspected'" class="lookahead-badge">
    ⚠ 前视风险
  </div>
</div>
```

```css
.analysis-card.lookahead-risk { border-color: var(--el-color-danger) !important; }
.lookahead-badge {
  position: absolute; top: 0; right: 0;
  background: var(--el-color-danger); color: #fff;
  padding: 2px 8px; font-size: 12px; border-radius: 0 0 0 4px;
}
```

### 15.2 跳变示例展开

点击徽标展开 `cutoffs[].examples`：

```html
<el-collapse-transition>
  <div v-if="showLookaheadDetail && summary?.factor_snapshot_test?.cutoffs">
    <el-table :data="lookaheadExamples" size="small" border>
      <el-table-column prop="trade_date" label="日期" width="120" />
      <el-table-column prop="stock_code" label="股票" width="100" />
      <el-table-column prop="full_value" label="完整值" />
      <el-table-column prop="as_of_value" label="截断值" />
      <el-table-column prop="abs_diff" label="偏差" />
    </el-table>
    <p class="hint">请排查 unique() 是否加 maintain_order=True、shift(-N) 负向位移等前视操作</p>
  </div>
</el-collapse-transition>
```

```typescript
const lookaheadExamples = computed(() => {
  const cutoffs = summary.value?.factor_snapshot_test?.cutoffs || []
  return cutoffs.flatMap((c: any) => c.examples || [])
})
```

### 15.3 前视风险时显示入库警告

**注意**：`ResultContent.vue` 中没有"入库"按钮，入库流程在 `MyFactors.vue:711-718`（"入库审核"按钮发起 admission 回测）+ `MyFactors.vue:4101`（`submitPlaza` 提交广场）。`handleAdmission`、`submitToLibrary` 全项目不存在。

改为：在 `ReportView.vue` 的入库审核看板里（行 3-5），当 `lookahead_suspected` 时显示警告提示，不建议提交入库：

```html
<!-- ReportView.vue 入库审核看板内加 -->
<el-alert
  v-if="admissionReport?.lookahead_suspected"
  type="error"
  title="前视风险检测异常"
  description="快照前视测试未通过，不建议提交入库。请排查 unique() 是否加 maintain_order=True、shift(-N) 负向位移等前视操作。"
  :closable="false"
  show-icon
/>
```

不禁用按钮——前端展示警告即可，最终由人工判断是否提交。

---

## 16. needs_strong_review 显著标记 + python_validate 告警【中优先】

### 16.1 needs_strong_review 标记

**文件**：`ResultContent.vue`（行 427-431 admission 描述项，行 668-682 泛化性诊断卡片）

```html
<!-- admission 描述项 -->
<el-descriptions-item label="泛化性">
  <el-tag :type="generalization?.status === 'needs_strong_review' ? 'danger' : 'info'">
    {{ generalization?.status || '—' }}
  </el-tag>
  <el-tag v-if="generalization?.status === 'needs_strong_review'" type="danger" effect="dark" size="small">
    需强制人工复核
  </el-tag>
</el-descriptions-item>
```

```html
<!-- 泛化性诊断卡片 -->
<el-alert v-if="generalization?.status === 'needs_strong_review'"
  title="需强制人工复核" type="error" :closable="false"
  description="本因子结果必须经人工确认后方可采信" />
```

### 16.2 python_validate 前视告警展示

**文件**：`SubmitContent.vue`、`MyFactors.vue`、`src/main/index.ts`、`src/preload/index.ts`

**已确认**：引擎**不在提交响应中返回** `python_validate`。它是一个**独立的同步校验端点** `POST /v1/validate/python`（meta_service），返回 `{ valid: bool, warnings: Vec<String>, error: Option<String> }`，毫秒级。warnings 中包含 `unique()` 未加 `maintain_order=True`、`shift(-N)` 负向位移等前视告警文本。

**网关已补透传**：`POST /api/v1/validate/python` → `http://192.168.20.11:30890/v1/validate/python`（router.go validateGroup）。

前端需在**提交前**调一次预检接口，拿到 warnings 后展示告警，允许用户修复后再提交。

#### 主进程新增 IPC（`src/main/index.ts`）

```typescript
// Python 代码静态校验（提交前预检）
// API_BASE_URL 复用 download.ts:16 已有的 'http://61.151.241.233:8080/api/v1'，
// 或从 index.ts 顶部已有的定义导入。不要新建 GATEWAY_BASE 常量。
ipcMain.handle('validate:python', async (_event, data: { code: string; requires?: string[] }) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) return { success: false, error: '未找到API Key' }
    const axios = require('axios')
    const response = await axios.post(`${API_BASE_URL}/validate/python`, data, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      timeout: 10000
    })
    return { success: true, data: response.data }  // { valid, warnings, error }
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})
```

#### preload 绑定（`src/preload/index.ts`）

```typescript
validatePython: (data: { code: string; requires?: string[] }) => ipcRenderer.invoke('validate:python', data),
```

#### 前端展示（`SubmitContent.vue` / `MyFactors.vue`）

```html
<!-- 代码编辑器下方 -->
<el-alert v-for="(warn, i) in pythonValidateWarnings" :key="i"
  :title="warn" type="warning" :closable="false" show-icon />
```

```typescript
const pythonValidateWarnings = ref<string[]>([])

// 提交前预检
const prevalidateCode = async () => {
  pythonValidateWarnings.value = []
  const code = getCurrentFactorCode()
  if (!code) return true
  const result = await window.electronAPI.validatePython({ code, requires: getRequires() })
  if (!result.success) return true  // 预检失败不阻塞提交
  const data = result.data
  if (data.warnings?.length) {
    pythonValidateWarnings.value = data.warnings
  }
  return data.valid  // 硬错误时阻止提交
}

const handleSubmit = async () => {
  const valid = await prevalidateCode()
  if (!valid) {
    ElMessage.error('代码静态校验未通过，请修复后再提交')
    return
  }
  // ... 正常提交逻辑 ...
}
```

---

## 17. 头条收益按费后净收益展示【中优先·确认项】

**文件**：全局（`Plaza.vue`、`MyFactors.vue`、`ResultContent.vue`、`Result.vue`、`ReportView.vue` 等）

**现状**：全代码库无 `net_annual_return` / `net_sharpe_ratio` / `net_max_drawdown` 读取。头条已统一用 `annual_return` / `sharpe_ratio` / `max_drawdown`。

引擎 `86ae13c` 将 `headline_metric_basis.cost_aware` 从 `false`→`true`，头条字段现为费后净收益口径。

**结论**：前端已正确，无需改动。可选：读 `headline_metric_basis.cost_aware === true` 时在指标旁标注"已扣交易成本"。

---

## 附：类型定义补充（必做）

在 `src/renderer/types/backtest.ts` 中补充以下类型定义，减少 `any` 使用，让 TS 在编译期暴露字段缺失：

```typescript
// BacktestSummary 新增
interface BacktestSummary {
  // ... 现有字段 ...
  factor_snapshot_test?: {
    status: 'pass' | 'lookahead_suspected' | 'skipped'
    method?: string
    total_jump_cells?: number
    max_abs_diff?: number
    cutoffs?: Array<{
      cutoff_date: string
      jump_cells: number
      jump_ratio: number
      examples: Array<{
        trade_date: string
        stock_code: string
        full_value: number
        as_of_value: number
        abs_diff: number
      }>
    }>
  }
  headline_metric_basis?: {
    cost_aware?: boolean
    basis?: string
    annualization?: string
  }
  neutralization?: {
    risk_factors?: string[]
    pearson?: any[]
    neutralized_ic_pages?: any[]
    original_portfolio?: any[]
    residual_portfolio?: any[]
  }
  generalization?: {
    status: string
    findings?: Array<{ code: string; severity: string; message: string }>
  }
}

// DataSourceItem 新增
interface DataSourceItem {
  // ... 现有字段 ...
  role?: 'load' | 'intermediate_only'
}
```
