# 前端改造方案 — 回测引擎 v0.9.2 对接

> 交付对象：前端工程师
> 版本：v0.9.2
> 背景：网关已完成改造（TaskResult 补 stage_errors 透传，已编译通过）。以下 3 项前端独立完成，互不依赖，可分别提 PR。
> 核心文件：`src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue`

---

## 改动概览

| # | 改动项 | 优先级 | 破坏性 | 涉及组件 |
|---|--------|--------|--------|---------|
| 1 | layers 单对象 改为 数组（多周期分层） | 高 | 是 | ReportV03View.vue |
| 2 | stage_errors 结构化错误展示 | 高 | 否（新功能） | Result.vue / ResearchResults.vue / 新建 StageErrors.vue |
| 3 | 超额净值曲线等长验收 | 低 | 否 | ReportV03View.vue（验收项） |

---

## 改动 1：layers 单对象 改为 数组（高优先级，破坏性）

### 问题

`ReportV03View.vue:165` 现在把 layers 当单个对象：

```js
const layers = computed(() => report.value?.layers ?? null)   // 旧：单对象
// 后续用 layers.value.dates / .groups / .benchmark_nav / .assessment_group
```

v0.9.2 引擎把 layers 改成数组，每个预测周期一份：

```jsonc
"layers": [
  { "period": 1, "dates": [], "benchmark_nav": [], "groups": [], "assessment_group": 10 },
  { "period": 5, "dates": [], "benchmark_nav": [], "groups": [], "assessment_group": 10 }
]
```

### 改法要点

#### 1. 加周期选择状态 + 兼容层

新增 selectedLayerIdx，并做数组/对象双兼容（老报告仍是对象）。在 script setup 里，把 layers 定义处（L165 附近）改为：

```js
const layerList = computed(() => {
  const l = report.value?.layers
  if (!l) return []
  return Array.isArray(l) ? l : [l]   // 旧报告单对象包成数组
})

const selectedLayerIdx = ref(0)

const layers = computed(() => layerList.value[selectedLayerIdx.value] ?? null)
```

改完后，下游 `layers.value.dates` / `.groups` / `.benchmark_nav` / `.assessment_group`（L171、L185、L229-267）全部自动适配，因为 layers 计算属性形态没变，只是多了一层选择。

#### 2. 加周期切换 UI（注意挂载位置）

**关键**：这段控件必须插入到 `v-for="(spec, i) in chartSpecs"` 循环内部（即 `rv-chart-block` 循环体内，与现有 IC 切换控件 L109 同级），靠 `spec.id === 'layers-nav'` 匹配才会显示在分层净值图上方。不能放在循环外，否则不渲染。

参照现有 IC 切换控件（模板 L109-118）的位置，在同一个循环体内追加：

```vue
<!-- 放在 rv-chart-block 循环内部，与 IC 切换控件（L109）并列 -->
<div
  class="rv-ic-controls"
  v-if="mode === 'research' && spec.id === 'layers-nav' && layerList.length > 1"
>
  <span class="rv-ic-label">分层周期：</span>
  <el-radio-group v-model="selectedLayerIdx" size="small">
    <el-radio-button
      v-for="(item, idx) in layerList"
      :key="idx"
      :label="idx"
    >周期 {{ item.period }}</el-radio-button>
  </el-radio-group>
</div>
```

可直接复用 .rv-ic-controls 样式（已有）。

#### 2.1 IC 切换器与分层切换器保持独立（产品决策已定）

`selectedIcIdx`（IC 时序图用）与 `selectedLayerIdx`（分层图用）是**两套独立下标**，不联动。多周期场景下，用户切分层周期时 IC 图仍停在 `selectedIcIdx`——这是**预期行为**，产品侧已确认保持两个独立切换器，无需合并为单一"预测周期"总控。实现上无需做 period 值对齐，各自维护自己的下标即可。

#### 3. 超额净值取数

L257-264 超额净值图取数逻辑不用改，因 layers 已指向选中周期。现有代码：

```js
const g = assessmentGroup.value
if (g && groups[g - 1]?.excess_nav_series) {
  // 数据取自 layers.value.groups[g-1].excess_nav_series，即当前选中周期
}
```

### 验收

- 多周期任务能按周期 Tab 切换：分层净值曲线、超额净值曲线、考核组指标表。
- 旧单对象报告（v0.9.0 之前）仍正常显示（兼容层包成单元素数组）。

---

## 改动 2：stage_errors 结构化错误展示（高优先级，新功能）

### 问题

现在 3 处错误展示只读裸 error_message 字符串，完全没用 stage_errors：

- `Result.vue:85` — 回测结果页
- `ResearchResults.vue:176-182` — research 列表/详情
- `Backtest/index.vue:322` — 提交回调

网关现已透传 stage_errors（任务结果顶层数组）。字段结构：

```ts
interface StageError {
  stage: 'Config' | 'DataLoading' | 'IntermediateTable' | 'FactorCalc' | 'Neutralization' | 'WalkForward' | 'Report' | 'Backtest' | 'Admission'
  severity: 'fatal' | 'error' | 'warning'
  code: string        // 如 IT_MATERIALIZATION_FAILED / NEUT_VARIANT_FAILED / WF_FOLD_FAILED
  message: string     // 人类可读错误说明（中文）
  detail?: string     // 技术详情（Python traceback / SQL 片段）
  suggestion?: string // 修复建议
  context?: Record<string, any>  // 阶段特定上下文，如 { fingerprint, workspace_db, ddl_preview }
}
```

三级严重程度语义：

| severity | 语义 | 前端表现 |
|----------|------|---------|
| fatal | 任务整体失败 | 红色错误态，展示 message + detail + suggestion |
| error | 结果有降级（部分失败） | 黄色警告条，结果仍可查看，标注降级原因 |
| warning | 任务完整，提示注意 | 可折叠提示 |

### 改法

#### 1. 新建 StageErrors.vue 展示组件

在 `src/renderer/components/` 下新建 StageErrors.vue（错误卡片列表）：

```vue
<template>
  <div class="stage-errors" v-if="errors?.length">
    <el-alert
      v-for="(err, i) in errors"
      :key="i"
      :type="alertType(err.severity)"
      :title="err.message"
      :closable="false"
      show-icon
      class="stage-error-item"
    >
      <template #default>
        <div class="error-meta">
          <el-tag size="small" type="info">{{ err.stage }}</el-tag>
          <el-tag size="small" type="info">{{ err.code }}</el-tag>
        </div>
        <p v-if="err.suggestion" class="error-suggestion">
          建议：{{ err.suggestion }}
        </p>
        <el-collapse v-if="err.detail" class="error-detail-collapse">
          <el-collapse-item title="技术详情" name="detail">
            <pre class="error-detail">{{ err.detail }}</pre>
          </el-collapse-item>
        </el-collapse>
        <el-descriptions
          v-if="err.context && Object.keys(err.context).length"
          :column="1"
          size="small"
          border
          class="error-context"
        >
          <el-descriptions-item
            v-for="(v, k) in err.context"
            :key="k"
            :label="k"
          >{{ renderCtx(v) }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
defineProps<{ errors: any[] | null }>()

const alertType = (severity: string) => {
  if (severity === 'fatal') return 'error'
  if (severity === 'error') return 'warning'
  return 'info'
}

// context 的 value 类型是任意 JSON（引擎侧 context: Option<serde_json::Value>），
// 可能是嵌套对象/数组。直接 {{ v }} 会显示 [object Object]，非字符串一律 JSON.stringify。
const renderCtx = (v: any): string =>
  v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)
</script>

<style scoped>
.stage-error-item { margin-bottom: 12px; }
.error-meta { display: flex; gap: 8px; margin-bottom: 8px; }
.error-suggestion { margin: 8px 0; color: #606266; }
.error-detail { font-size: 12px; background: #f5f7fa; padding: 8px; border-radius: 4px; overflow-x: auto; }
.error-context { margin-top: 8px; }
</style>
```

#### 2. 在任务详情/结果页使用

以 ResearchResults.vue 为例（任务详情抽屉，L277 附近），在"任务配置"区块上方加一段：

```vue
<script setup>
import StageErrors from '@/components/StageErrors.vue'
</script>

<template>
  <!-- 在 el-drawer 内，任务配置 section 上方 -->
  <div class="detail-section" v-if="taskDetail.stage_errors?.length">
    <h4 class="section-title">阶段错误</h4>
    <StageErrors :errors="taskDetail.stage_errors" />
  </div>

  <!-- 保留原 error_message 兜底（当 stage_errors 为空时） -->
  <div class="detail-section" v-if="!taskDetail.stage_errors?.length && taskDetail.error_message">
    <h4 class="section-title">错误信息</h4>
    <el-alert type="error" :title="taskDetail.error_message" :closable="false" show-icon />
  </div>
</template>
```

同理，在 Result.vue:85 和 Backtest/index.vue:322 也按此模式替换裸 error_message 展示。

### 验收

- failed / 降级任务能看到结构化失败阶段（stage）、错误码（code）、原因（message）、修复建议（suggestion）、技术详情（可折叠）。
- IT_* 错误（中间表物化失败）能展示 context（workspace_db / ddl_preview）。
- 无 stage_errors 的老任务仍显示原 error_message，不受影响。

---

## 改动 3：超额净值曲线等长验收（低优先级，通常无需改）

### 背景

引擎已把 strategy_nav / benchmark_nav / excess_nav 裁掉起点 1.0，与 dates 等长。

### 验收点

前端现在用 nz() + connectNulls 按 index 直接映射（L153-154），本就没有手动跳首点的逻辑，所以大概率无需改动。

仅需验收：

- 确认超额净值曲线与 dates 对齐、无错位。
- 若前端别处有"四数组等长"断言，现应通过。

---

## 不需要前端改的项（澄清预期）

### 1. assessment_group / rebalance_period / factor_direction=1/-1 可配置

引擎 v0.9.2 硬编码写死（assessment_group=None、factor_direction=1），API 层未打通。

前端现在不用加这些配置项入口，加了也不生效。ResearchResults.vue 里已有的 factor_direction（positive/negative/auto）是另一套因子值方向机制，保持现状。

### 2. fallback_reason 透传

网关 midstats 已透传，中间表管理页若已展示则无需改。

---

## 版本兼容性策略

| 版本 | 破坏性 | 说明 |
|------|--------|------|
| v0.6.4 | 低 | 超额净值数组少一个起点元素，前端按等长处理 |
| v0.7.0 | 中 | stage_errors 顶层新字段；旧 summary key 保留但不再作为主要错误来源，建议尽快迁移 |
| v0.9.0 | 高 | layers 单对象改为数组，前端需双结构兼容或一次性适配 |
| v0.9.2 | 低 | list 空参行为回到只扫共享库，网关已处理权限隔离 |

推荐策略：改动 1（layers 数组）做双结构兼容（Array.isArray(l) ? l : [l]），可无缝兼容旧报告；改动 2（stage_errors）加兜底（无 stage_errors 时仍显示 error_message）。

---

## 对接检查清单（前端工程师，3 项）

- [ ] 1. 改动 1 完成：分层净值曲线按 layers[i].period 分页 + Tab 切换（切换控件插在 chartSpecs 循环内、spec.id === 'layers-nav' 匹配）；超额净值曲线读 layers[period_idx].groups[g].excess_nav_series；对旧报告做数组/对象双结构兼容；IC 与分层两个切换器保持独立，无需联动。
- [ ] 2. 改动 2 完成：新建 StageErrors.vue 组件，在 Result.vue / ResearchResults.vue / Backtest/index.vue 三处接入；展示 severity/code/message/detail/suggestion/context；context 的 value 用 JSON.stringify 兜底（可能是嵌套对象，直接插值会显示 [object Object]）；保留 error_message 兜底。
- [ ] 3. 改动 3 验收：超额净值曲线与 dates 对齐、无错位；若有四数组等长断言，现应通过。

---

## 附录：完整 layers 数组示例（v0.9.0+）

```json
{
  "layers": [
    {
      "period": 1,
      "dates": ["2026-01-05", "2026-01-06"],
      "benchmark_nav": [1.0, 1.002],
      "groups": [
        { "group": 1, "nav": [1.0, 1.001], "turnover_series": [0.8, 0.7], "excess_nav_series": [1.0, 0.999], "metrics": { "ann_return": 0.05, "excess_sharpe": 1.2 } },
        { "group": 10, "nav": [1.0, 1.003], "turnover_series": [0.8, 0.7], "excess_nav_series": [1.0, 1.001], "metrics": { "ann_return": 0.12, "excess_sharpe": 2.5 } }
      ],
      "assessment_group": 10
    },
    {
      "period": 5,
      "dates": ["2026-01-05", "2026-01-06"],
      "benchmark_nav": [1.0, 1.002],
      "groups": [
        { "group": 1, "nav": [1.0, 1.0], "turnover_series": [0.8, 0.0], "excess_nav_series": [1.0, 0.998], "metrics": {} },
        { "group": 10, "nav": [1.0, 1.0], "turnover_series": [0.8, 0.0], "excess_nav_series": [1.0, 0.998], "metrics": {} }
      ],
      "assessment_group": 10
    }
  ]
}
```

注：period=5 的调仓日之间 turnover_series 为 0（持有期不换手）。

---

撰写时间：2026-08-13
网关改造状态：已完成并编译通过（TaskResult 补 stage_errors 透传）
下一步：前端工程师按此方案完成改造，网关+前端都完成后，打包 v0.9.2 镜像并推送镜像库
