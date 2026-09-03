# 分年度统计表 - 前端渲染补齐方案（v0.26.13 · 跟随风险剥离切换）

> 关联引擎版本：**v0.26.13**（`979ceb7`，已构建部署上线）
> 适用前端仓库：`market-data-downloader`（当前 HEAD `ce6dbe0` / V2.7.8）
> 负责人：前端工程师
> 优先级：中（功能缺口，不改则「详细报告」新任务看不到分年度表）
> ⚠️ 本文档基于 v0.26.13 契约，**取代**此前基于 v0.26.12 的 `overviewTables` 方案（见文末「版本变更」）。

---

## 0. 一句话背景

引擎新增分年度统计表（`yearly_*`）。v0.26.13 起，分年度表**已按风险剥离 variant 分别产出**，注入到
`summary.variant_reports[variant].report.tables[]`（**含 `raw` 原始因子档**）。
前端「详细报告」走 `ReportV03View.vue`，需补一个「分年度统计」区，**跟随页面顶部「风险剥离」切换器**展示对应档位的分年度表。

---

## 1. 数据契约（v0.26.13，务必按此取值）

分年度表位置（每个档位一份，key 前缀 `yearly_`）：

```
summary.variant_reports["raw"].report.tables[]                 ← 原始因子
summary.variant_reports["neutral_selected"].report.tables[]    ← 剥离所选
summary.variant_reports["neutral_all"].report.tables[]         ← 剥离全部
summary.variant_reports["neutral_each_<style>"].report.tables[] ← 剥离单风格（如有）
```

- **`raw` 也在 `variant_reports` 里**（引擎统一注入，取值路径统一）。
- 引擎**未**向主 `summary.report_v03.report` 注入 `tables`；主口径的分年度表要从 `variant_reports["raw"]` 取（见 §3 的坑）。
- 旧全局 `summary.report.tables` 仍存在（内容 = raw 口径），但**本方案不用它**，统一走 `variant_reports`。

### TableData 结构

```jsonc
{
  "key": "yearly_core_p1",
  "title": "分年度核心指标（period=1D）",
  "columns": ["年度","样本天数","RankIC均值","RankIC_IR","考核组收益","年化波动","年度夏普","平均换手","中证1000收益","中证1000超额"],
  "rows": [
    ["2022","243","0.052","0.87","12.34%","18.90%","0.61","15.20%","-8.10%","22.25%"],
    ["2023","242","0.048","0.79","9.87%","17.33%","0.51","14.80%","-3.50%","13.84%"]
  ],
  "metadata": { "horizon_days": 1 }
}
```

key 前缀约定（每个预测周期一组三类；周期为交易日天数，正则 `_p(\d+)`）：
- `yearly_core_p{period}`：分年度核心指标（含年度 RankIC 均值 / RankIC_IR）
- `yearly_layers_p{period}`：分年度分组收益
- `yearly_layer_excess_p{period}_b{idx}`：分年度分组超额收益（每基准一张，`title` 已含基准名）

`rows` 均为已格式化字符串（收益 `12.34%` / 比率 `0.052` / 无数据 `—`），**直接展示，无需二次格式化**。

---

## 2. 关键设计：跟随「风险剥离」切换器

`ReportV03View` 已有全局切换器状态 `selectedRiskFactor`（[ReportV03View.vue:251](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L251)）：
- `''` = 原始因子（raw）
- 其他 = variant 名（`neutral_selected` / `neutral_all` / `neutral_each_*`）

已有 `activeReport`（[ReportV03View.vue:278-283](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L278-L283)）在选中 variant 时返回 `variantReports[selectedRiskFactor].report`，未选时返回主 `report`。
分年度表要**跟随同一个 `selectedRiskFactor`**，所以新增一个 `activeVariantKey` 归一化（把 `''` 映射成 `'raw'`），再取 `variantReports[key].report.tables`。

---

## 3. ⚠️ 必读的坑：主口径（raw）取值

`activeReport` 在 `selectedRiskFactor === ''` 时取的是 `props.report`（主 `reportV03.report`），
但引擎**没有**往主 `report_v03` 注入 `tables`——raw 的分年度表在 `variantReports['raw']`。
因此**不能直接用 `activeReport.tables`**（原始因子档会取空）。正确做法是单独按归一化 key 从 `variantReports` 取：

```
key = selectedRiskFactor || 'raw'
tables = variantReports[key]?.report?.tables ?? []
```

这样原始因子档命中 `variantReports['raw']`，各剥离档命中对应 variant，逻辑统一。

---

## 4. 改动清单（共 3 处，2 个文件）

### 4.1 `ResultContent.vue` — 传入 variantReports（多半已传，确认即可）

`<ReportV03View>`（[ResultContent.vue:1387-1394](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ResultContent.vue#L1387-L1394)）需带 `:variant-reports="summary?.variant_reports ?? {}"`。
若已存在（现有切换器已依赖它）则**无需改动**；若无则补上。

> v0.26.12 方案里的 `:overview-tables` **不再需要**，可不加/移除。

### 4.2 `ReportV03View.vue` — 模板追加「分年度统计」区

插入位置：图表区 `rv-section`（[ReportV03View.vue:126-186](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L126-L186)）**之后**、「提示与警告」区（[ReportV03View.vue:189](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L189)）**之前**。

```vue
    <!-- ============ 分年度统计（v0.26.13，跟随风险剥离切换）============ -->
    <div class="rv-section" v-if="yearlyTables.length">
      <h4 class="rv-title">分年度统计（{{ variantLabel(activeVariantKey) }}）</h4>
      <div v-for="tb in yearlyTables" :key="tb.key" class="rv-yearly-block">
        <div class="rv-yearly-title" v-if="tb.title">{{ tb.title }}</div>
        <el-table :data="toTableRows(tb)" size="small" border stripe>
          <el-table-column
            v-for="(col, ci) in (tb.columns || [])"
            :key="ci"
            :prop="String(ci)"
            :label="col"
          />
        </el-table>
      </div>
    </div>
```

> `el-table` / `el-table-column`、`variantLabel()`（[ReportV03View.vue:260](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue#L260)）本文件已有，无需额外引入。

### 4.3 `ReportV03View.vue` — script 增加归一化 key、计算与工具

`variantReports` prop、`selectedRiskFactor`、`variantLabel`、`computed` 均已存在，只需新增：

```ts
// 归一化当前档位：'' → 'raw'，与引擎 variant_reports 的键对齐
const activeVariantKey = computed<string>(() => selectedRiskFactor.value || 'raw')

// 当前档位的分年度表：从 variant_reports[key].report.tables 里筛 yearly_*
// 注意：raw 也在 variant_reports 里（引擎 v0.26.13 统一注入），不要用 activeReport.tables
const yearlyTables = computed<any[]>(() => {
  const rep = props.variantReports?.[activeVariantKey.value]?.report
  const tables: any[] = rep?.tables ?? []
  return tables.filter((t: any) => String(t?.key ?? '').startsWith('yearly_'))
})

// TableData.rows（string[][]）转 el-table 行对象：[c0,c1] → { '0':c0, '1':c1 }
const toTableRows = (tb: any): any[] =>
  (tb?.rows ?? []).map((row: any[]) => {
    const obj: Record<string, any> = {}
    row.forEach((cell, ci) => { obj[String(ci)] = cell })
    return obj
  })
```

### 4.4（可选）样式

```css
.rv-yearly-block { margin-bottom: 16px; }
.rv-yearly-title { font-size: 13px; color: #606266; margin: 8px 0 6px; }
```

---

## 5. 口径说明（展示无需计算，仅供理解）

- 收益 / 波动 / 夏普：从该档位 NAV 曲线按年几何推导（`NAV(年末)/NAV(年首前一天)-1`），**不年化**。
- 首年 / 末年只统计实际覆盖天数，**该年必然出现**。
- 年度 Rank IC 按年统计平均（均值 / 标准差 / IC_IR）。
- 分组超额 = `组NAV/基准NAV` 几何超额曲线的年度收益。
- 未配置基准：`yearly_layer_excess_*` 与核心表基准列不出现（按现有列自适应即可）。
- 仅有 IC、无对应 return 周期：该周期不产出分年度表（前端不会收到，无需处理）。
- **各 variant 的分年度表基于各自回填后的日度明细独立计算**，与该 variant 的详细报告口径一致。

---

## 6. 自测清单

- [ ] 详细报告出现「分年度统计」区，标题含当前档位名（如「分年度统计（原始因子）」）。
- [ ] 切换顶部「风险剥离」（原始因子 / 剥离所选 / 剥离全部 / 剥离单风格）：分年度表**随之切换**为对应档位数据。
- [ ] 原始因子档（`selectedRiskFactor=''`）能正确显示（命中 `variant_reports['raw']`，不为空）。
- [ ] 多周期任务（1D/5D/10D）：每档每周期各一组表，`title` 周期正确。
- [ ] 未配基准任务：只出现核心指标（无基准列）+ 分组收益，无 `layer_excess` 表，不报错。
- [ ] 旧任务（无 `variant_reports` 或无 `report.tables`）：`yearlyTables` 为空，「分年度统计」区不出现，不报错。
- [ ] 无风险剥离 variant 的任务（只有 raw）：切换器可能只有原始因子档，分年度表正常显示 raw。

---

## 7. 与费率默认值的关系（不变）

费率默认值 2/7 部分**无需前端改动**：两个提交入口费率初始值本就是 `null`（留空）——
[SubmitContent.vue:1382-1383](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue#L1382-L1383)、
[MyFactors.vue:4363-4364](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L4363-L4364)，
提交时 `?? undefined`，留空即交引擎回退，引擎新默认即 2/7。
（可选）研究模式费率输入框 placeholder「留空默认」可点明为「留空默认 2bp / 7bp」，审核模式仍 5/10。

---

## 8. 版本变更（相对 v0.26.12 旧方案）

| 项 | v0.26.12 旧方案（已废弃） | v0.26.13 本方案 |
|---|---|---|
| 数据源 | 全局 `summary.report.tables` | `summary.variant_reports[key].report.tables` |
| 是否跟随风险剥离 | 否（只有主口径一份） | **是**（每档独立） |
| 传参 | 新增 `overviewTables` prop | 复用已有 `variantReports` prop |
| raw 取值 | 直接取全局 | 取 `variant_reports['raw']`（注意 §3 坑） |
