# 前端改造方案：入库审核共线性报告（factor_collinearity）完整展示

> 版本：回测引擎 v0.3.2 方案D（ANN 投影检索）
> 目标文件：`src/renderer/views/FactorLibrary/Backtest/ResultContent.vue`
> 交付对象：前端工程师
> 说明：本方案完全基于当前前端实际代码撰写，所有行号、变量名、函数签名均已核对。

---

## 一、背景与问题

回测引擎 v0.3.2 给「入库审核模式（admission）」新增了方案D因子共线性检测，`summary.factor_collinearity` 现在会返回 **20+ 个字段**（`method`、`cache_status`、`max_abs_corr`、`matches[]`、`risk_level`、`decision`、`grid_match_count` 等，完整结构见文末附录）。

但前端目前**只展示了一个字段** `status`：

当前代码 `ResultContent.vue:388-392`（「入库审核」卡片内的 `el-descriptions`）：

```vue
<el-descriptions-item label="库级共线性">
  <el-tag size="small" :type="getStatusTagType(summary.factor_collinearity?.status)">
    {{ summary.factor_collinearity?.status || '缺失' }}
  </el-tag>
</el-descriptions-item>
```

`max_abs_corr`（核心指标）、`method`（方法徽章）、`matches[]`（相似因子表）、缓存状态提示等全部没有展示。本方案补齐这些。

---

## 二、改造范围（只动一个文件，纯新增）

只改 `ResultContent.vue`，且以**新增**为主，不改动现有其它逻辑：

1. **模板**：在「入库审核」卡片（`v-if="currentResearchMode === 'admission'"`，起始 `ResultContent.vue:347`）内、现有 `el-descriptions`（`382` 行）**之后**，新增一块「因子共线性详情」展开区。
2. **script**：新增 3 个 computed（`collinearity` 读取对象、`collinearityMatches` 数组兜底、`collinearityUnique` 唯一性判定）+ 6 个纯展示辅助函数（`collinearityMethodBadge` 方法徽章、`corrLevelType`/`corrIsOrange` 色阶、`riskLevelText`/`riskLevelTagType` 风险文案）。
3. **style**：新增该区块的样式类。

现有可复用的东西（无需新增）：
- `summary` computed（`ResultContent.vue:1191`）→ `summary.value.factor_collinearity`
- `getStatusTagType(status)`（`ResultContent.vue:1450`）→ 已有 ok/pass→success、warning→warning、fail/reject→danger 映射，可复用于 `status`
- `formatNumber(num, decimals)`（`ResultContent.vue:2161`）→ 数字格式化，NaN/null 返回 DASH

---

## 三、script 新增内容

在 `<script setup>` 里（建议紧挨 `admissionReport` 定义处，即 `ResultContent.vue:1198` 之后）新增：

```ts
// ============ v0.3.2 方案D 因子共线性报告 ============
// 入库审核 summary.factor_collinearity（结构见对接手册 §1.3.1）
const collinearity = computed<any>(() => summary.value?.factor_collinearity ?? null)

// matches[] 兜底为数组，供表格 v-for
const collinearityMatches = computed<any[]>(() => {
  const m = collinearity.value?.matches
  return Array.isArray(m) ? m : []
})

// 是否"无相似因子"（通过唯一性检查）：matches 为空 且 max_abs_corr 确实为 0
// 注意：只在 max_abs_corr 为有限数且 ===0 时才算唯一；若字段缺失(undefined/null)
// 不误判为唯一，改走核心指标区（值显示 —），语义更准。
const collinearityUnique = computed<boolean>(() => {
  const c = collinearity.value
  if (!c) return false
  const v = c.max_abs_corr
  return collinearityMatches.value.length === 0 && Number.isFinite(v) && v === 0
})

// method → 徽章文案与颜色（对接手册 §1.3.1）
// ann_projection_top30=方案D投影检索(绿)；single_stage_fallback/two_stage_retrieval_top3=回退(黄)
const collinearityMethodBadge = (method?: string): { text: string; type: string } => {
  switch (method) {
    case 'ann_projection_top30':
      return { text: '方案D投影检索', type: 'success' }
    case 'single_stage_fallback':
      return { text: '单阶段回退（建议重跑缓存）', type: 'warning' }
    case 'two_stage_retrieval_top3':
      return { text: '两阶段回退（建议重跑缓存）', type: 'warning' }
    default:
      return { text: method || '未知', type: 'info' }
  }
}

// max_abs_corr 色阶（对接手册 §1.3.1）：<0.6 绿 / 0.6-0.8 黄 / 0.8-0.9 橙 / >0.9 红
// 返回 el-tag 的 type；橙色 el-tag 无内建，用行内 class 'corr-orange' 处理（见 style）
const corrLevelType = (v?: number): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'info'
  if (v < 0.6) return 'success'
  // 0.6-0.9 统一 warning；其中 0.8-0.9 由 corrIsOrange 额外标橙（class corr-orange）
  if (v < 0.9) return 'warning'
  return 'danger'
}
const corrIsOrange = (v?: number): boolean =>
  Number.isFinite(v as number) && (v as number) >= 0.8 && (v as number) < 0.9

// risk_level → 中文文案（对接手册 §1.3.1）
const riskLevelText = (rl?: string): string => {
  const map: Record<string, string> = {
    pass_initial_uniqueness_check: '通过唯一性检查',
    moderate_overlap: '中度重叠',
    high_collinearity: '高共线性',
    critical_duplicate: '严重重复',
  }
  return rl ? (map[rl] ?? rl) : '-'
}
const riskLevelTagType = (rl?: string): string => {
  switch (rl) {
    case 'pass_initial_uniqueness_check': return 'success'
    case 'moderate_overlap': return 'warning'
    case 'high_collinearity': return 'warning'
    case 'critical_duplicate': return 'danger'
    default: return 'info'
  }
}
```

> 注：`corrLevelType` 里 0.6-0.8 和 0.8-0.9 都返回 `warning`，是因为 el-tag 没有内建橙色；用 `corrIsOrange` 配合 CSS class 区分 0.8-0.9 的橙色显示。若团队用了自定义主题色，可直接改 class。

---

## 四、模板新增内容

在 `ResultContent.vue:382-413` 那个 `el-descriptions`（含「库级共线性」等 6 项概览）**闭合标签 `</el-descriptions>` 之后**（即 `413` 行后、卡片 `div` 闭合 `414` 前）插入以下区块。

> 现有 `388-392` 的「库级共线性」概览 tag **保留不动**（作为一眼概览），下面新增的是点开后的详情。

```vue
<!-- v0.3.2 方案D：因子共线性详情 -->
<div v-if="collinearity" class="collinearity-detail">
  <div class="collinearity-header">
    <span class="collinearity-title">因子共线性检测</span>
    <!-- 方法徽章 -->
    <el-tag
      size="small"
      :type="collinearityMethodBadge(collinearity.method).type"
      effect="plain"
    >
      {{ collinearityMethodBadge(collinearity.method).text }}
    </el-tag>
    <!-- 缓存状态：hit 绿 / miss 红（需 DBA 重跑 factor_cluster_build） -->
    <el-tag
      v-if="collinearity.cache_status"
      size="small"
      :type="collinearity.cache_status === 'hit' ? 'success' : 'danger'"
      effect="plain"
    >
      缓存 {{ collinearity.cache_status === 'hit' ? '命中' : '未命中' }}
    </el-tag>
  </div>

  <!-- 缓存未命中提示 -->
  <el-alert
    v-if="collinearity.cache_status === 'miss'"
    type="warning"
    :closable="false"
    show-icon
    title="聚类缓存未命中，需 DBA 重跑 factor_cluster_build，当前为回退模式（功能正常但较慢）"
    style="margin-bottom: 8px"
  />

  <!-- 无相似因子（通过唯一性检查） -->
  <el-empty
    v-if="collinearityUnique"
    description="无相似因子（通过唯一性检查）"
    :image-size="60"
  />

  <template v-else>
    <!-- 核心指标：max_abs_corr 大字号 + 色阶 -->
    <div class="collinearity-core">
      <div class="core-metric">
        <span class="core-label">最大相似度 |corr|</span>
        <span
          class="core-value"
          :class="{
            'corr-green': corrLevelType(collinearity.max_abs_corr) === 'success',
            'corr-orange': corrIsOrange(collinearity.max_abs_corr),
            'corr-red': corrLevelType(collinearity.max_abs_corr) === 'danger',
            'corr-yellow': corrLevelType(collinearity.max_abs_corr) === 'warning' && !corrIsOrange(collinearity.max_abs_corr),
          }"
        >
          {{ formatNumber(collinearity.max_abs_corr, 4) }}
        </span>
      </div>
      <!-- 风险等级 -->
      <el-tag :type="riskLevelTagType(collinearity.risk_level)" effect="dark" size="small">
        {{ riskLevelText(collinearity.risk_level) }}
      </el-tag>
      <!-- topk 均值 -->
      <span class="core-sub">
        Top{{ collinearity.topk_n ?? '-' }} 均值 {{ formatNumber(collinearity.topk_mean_abs_corr, 4) }}
      </span>
    </div>

    <!-- 决策建议 -->
    <div v-if="collinearity.decision" class="collinearity-decision">
      <span class="label">决策建议</span>
      <span class="value">{{ collinearity.decision }}</span>
    </div>

    <!-- 候选数不足警示：应=30 -->
    <el-alert
      v-if="typeof collinearity.candidate_count === 'number' && collinearity.candidate_count < 30"
      type="info"
      :closable="false"
      show-icon
      :title="`候选数 ${collinearity.candidate_count}（<30），投影检索召回不足`"
      style="margin: 8px 0"
    />

    <!-- 相似因子表 matches[] -->
    <el-table
      v-if="collinearityMatches.length"
      :data="collinearityMatches"
      size="small"
      border
      style="margin-top: 8px"
    >
      <el-table-column label="因子编号" min-width="120">
        <template #default="{ row }">{{ row.factor_code ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="|corr|" min-width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="corrLevelType(row.abs_pearson_corr ?? Math.abs(row.pearson_corr))"
            :class="{ 'corr-orange-tag': corrIsOrange(row.abs_pearson_corr ?? Math.abs(row.pearson_corr)) }"
            effect="plain"
          >
            {{ formatNumber(row.abs_pearson_corr ?? Math.abs(row.pearson_corr), 4) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="重叠样本数" min-width="100">
        <template #default="{ row }">{{ row.overlap_count ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="风险等级" min-width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="riskLevelTagType(row.risk_level)" effect="plain">
            {{ riskLevelText(row.risk_level) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <!-- 辅助信息 -->
    <div class="collinearity-meta">
      <span>库内因子 {{ collinearity.library_factor_count ?? '-' }}</span>
      <span>候选 {{ collinearity.candidate_count ?? '-' }}</span>
      <span>样本数 {{ collinearity.current_sample_count ?? '-' }}</span>
      <!-- 网格覆盖：grid_match_count=新因子在全库网格上的有值点数；
           grid_total_count=全库网格观测点总数（百万级）。两者量纲差异极大，
           仅作中性信息展示，不做比率阈值警示（见"方案修订说明"）。 -->
      <span v-if="collinearity.grid_match_count != null">
        网格覆盖 {{ collinearity.grid_match_count }} / {{ collinearity.grid_total_count ?? '-' }}
      </span>
      <span v-if="collinearity.projection_dim">投影维度 {{ collinearity.projection_dim }}</span>
    </div>
  </template>
</div>
```

---

## 五、style 新增内容

在 `<style scoped>` 里新增（配色沿用页面既有语义色，可按团队变量微调）：

```css
.collinearity-detail {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.collinearity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.collinearity-title { font-weight: 600; }
.collinearity-core {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin: 8px 0;
}
.core-metric { display: flex; flex-direction: column; }
.core-label { font-size: 12px; color: var(--el-text-color-secondary); }
.core-value { font-size: 26px; font-weight: 700; line-height: 1.1; }
.core-value.corr-green  { color: var(--el-color-success); }
.core-value.corr-yellow { color: var(--el-color-warning); }
.core-value.corr-orange { color: #e6a23c; }   /* 0.8-0.9 橙 */
.core-value.corr-red    { color: var(--el-color-danger); }
.core-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.collinearity-decision {
  margin: 6px 0;
  font-size: 13px;
}
.collinearity-decision .label {
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}
.collinearity-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
/* 表格内 0.8-0.9 橙色 tag */
:deep(.corr-orange-tag) {
  color: #e6a23c;
  border-color: #e6a23c;
}
```

---

## 六、字段与展示映射（对照对接手册 §1.3.1，供自查）

| 字段 | 展示位置 | 规则 |
|---|---|---|
| `method` | 顶部徽章 | ann_projection_top30→绿「方案D投影检索」；fallback→黄提示重跑缓存 |
| `cache_status` | 顶部徽章 + alert | hit→绿；miss→红 + 警示条 |
| `max_abs_corr` | 核心大字号 | 色阶 <0.6绿/0.6-0.8黄/0.8-0.9橙/>0.9红 |
| `risk_level` | 核心区标签 | pass/moderate/high/critical 中文 + 色 |
| `decision` | 决策建议行 | 原文展示 |
| `topk_n`/`topk_mean_abs_corr` | 核心区副信息 | TopN 均值 |
| `matches[]` | 表格 | 因子编号 / \|corr\| / 重叠样本数 / 风险等级（各列均加 `?? '-'` 兜底） |
| `grid_match_count`/`grid_total_count` | meta 中性展示 | 「网格覆盖 X / Y」；**不做比率阈值警示**（两者量纲差异极大，见方案修订说明·问题5） |
| `candidate_count` | 警示条 + meta | <30 提示召回不足 |
| `library_factor_count`/`current_sample_count`/`projection_dim` | meta 辅助行 | 原文展示 |
| matches 空 + max_abs_corr=0 | el-empty | 「无相似因子（通过唯一性检查）」 |

---

## 七、注意事项

1. **只在 admission 模式出现**：整块在 `currentResearchMode === 'admission'` 卡片内，非入库审核模式不渲染，无需额外判空。
2. **降级安全**：`collinearity` 为 null（老任务/非方案D）时整块 `v-if` 不渲染，`388-392` 的概览 tag 仍显示 `status||'缺失'`，不影响存量任务。
3. **不改动网关/引擎**：`factor_collinearity` 由引擎放进 summary，网关 `TaskResult.Summary` 是 `map[string]interface{}` 全透传，前端直接从 `summary.value.factor_collinearity` 取即可，无需后端配合。
4. **回退模式仍可用**：`method` 为 fallback 时数据结构一致，只是慢，前端照常渲染并给「建议重跑缓存」提示即可，不要因 method 不是 ann_projection_top30 就隐藏。
5. **"无相似因子"空态的边界（预期行为，非 bug）**：仅 `matches` 空 **且** `max_abs_corr===0` 才显示空态。若 `matches` 空但 `max_abs_corr` 是小非零值（如 0.05），会走核心指标区显示该值 + "通过唯一性检查"标签、但不渲染表格——这是正确展示（有最相似度但未达入表阈值）。
6. **`matches[]` 表格列用 slot 而非 prop（知晓项）**：为加 `?? '-'` 兜底，因子编号/重叠样本数改用 `#default` slot。当前无排序需求（引擎已按 `abs` 降序返回，`main.rs:4197`）；**将来若给这两列加 `sortable`，slot 写法下需配 `sort-method` 否则默认排序失效**。

---

## 八、方案修订说明（基于评审 + 引擎源码复核）

以下 5 条按评审意见逐条处理，涉及"引擎实际返回值"的均已核对引擎源码 `backtest-engine/src/main.rs`：

| # | 评审意见 | 处理 | 引擎源码依据 |
|---|---|---|---|
| 1 | `collinearityUnique` 用 `!c.max_abs_corr` 会把 undefined/null 误判为唯一 | **已改**为 `Number.isFinite(v) && v === 0`；字段缺失时不判唯一，走核心指标区显示 `—` | — |
| 2 | `max_abs_corr` 是否非负，色阶是否需 `Math.abs` | **无需**。引擎三条路径均取 `.abs()` 后求 max（方案D `main.rs:4200`、legacy `main.rs:4624-4626`），返回值必然非负。前端不再额外包 `Math.abs`（表格列因用了 `pearson_corr` 原值 fallback，仍保留 `Math.abs` 兜底） | `main.rs:4200`、`4624` |
| 3 | §二自述"1 computed + 3 函数"与实际不符 | **已改**为"3 computed + 6 函数"，与 §三一致 | — |
| 4 | `matches[]` 各列缺失兜底不统一 | 引擎保证每项含 `factor_code`/`overlap_count`/`risk_level`/`abs_pearson_corr`（方案D `main.rs:4206-4212`、legacy `main.rs:4629-4638` 硬编码写入）。但仍**采纳防御性建议**，给三列加 `?? '-'` 兜底 | `main.rs:4206`、`4629` |
| 5 | 网格匹配率 <0.7 警示会长期常驻 | **确认为方案错误，已删除该警示**。`grid_total_count` 是**全库网格观测点总数**（`grid_df.height()`，百万级，`main.rs:4056`），`grid_match_count` 是**新因子在网格上的有值点数**（单因子样本量，几百~几千，`main.rs:4074`），两者量纲差 3 个数量级，比率必然 <1%，用 0.7 阈值警示完全错误。改为在 meta 行中性展示「网格覆盖 X / Y」，不做阈值判断 | `main.rs:4056`、`4074`、`4229-4230` |

> 结论：问题 5 是本方案的实质性错误（已修正）；问题 1/3/4 为改进项（已采纳）；问题 2 经源码确认无需改动。评审的 5 条全部闭环。

---

## 附录：factor_collinearity 完整结构（对接手册 §1.3.1）

```json
{
  "status": "ok",
  "method": "ann_projection_top30",
  "cache_status": "hit",
  "current_task_id": "task_xxx",
  "current_sample_count": 856,
  "grid_match_count": 856,
  "grid_total_count": 1080000,
  "topk_n": 5,
  "topk_mean_abs_corr": 0.4523,
  "max_abs_corr": 0.7821,
  "projection_dim": 256,
  "projection_seed": 42,
  "library_factor_count": 3859,
  "candidate_count": 30,
  "risk_level": "high_collinearity",
  "decision": "require_orthogonalization_and_residual_ic",
  "thresholds": {
    "critical_duplicate": 0.90,
    "high_collinearity": 0.80,
    "moderate_overlap": 0.60
  },
  "matches": [
    {
      "factor_code": "F00123",
      "pearson_corr": 0.7821,
      "abs_pearson_corr": 0.7821,
      "overlap_count": 856,
      "risk_level": "high_collinearity"
    }
  ],
  "notes": []
}
```
