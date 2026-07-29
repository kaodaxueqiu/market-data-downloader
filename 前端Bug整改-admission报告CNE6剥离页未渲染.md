# 前端 Bug 整改：admission 报告漏渲染 CNE6 剥离页（20 页净值图丢失）

> 面向：前端工程师
> 文件：`src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue`
> 严重度：中（报告核心内容缺失，非崩溃）
> 状态：已定位根因，待前端修复

---

## 一、现象

入库审核（admission）模式的详细报告，「图表分析」区**只显示 2 张图**（样本内净值、样本外净值）。
但后端 `report_v03.report` 里实际有 **20 页 CNE6 风险因子剥离净值图**（`cne6_strip_pages`），前端完全没渲染出来。

实测任务 `bt_yuyang_1783600951039`：
- `report.cne6_strip_pages` 数组长度 = **20**（后端数据完整）
- 前端页面只画了 2 张图 → 20 页剥离图全丢

---

## 二、根因（已定位到代码行）

`chartSpecs`（L259-282）的 admission 分支**只遍历了 `main_result` 的 in/out**，没有遍历 `cne6_strip_pages`：

```js
if (mode.value === 'admission' && mainResult.value) {
  // 样本内外净值对比：in / out 各一张   ← 只画了这 2 张
  for (const seg of ['in', 'out'] as const) { ... }
}
// ← 这里缺少 cne6_strip_pages 的渲染
```

结论：**前端渲染逻辑遗漏，非数据问题**。后端 `cne6_strip_pages` 数据齐全。

---

## 三、数据结构（后端实测）

`report.cne6_strip_pages` 是数组，每个元素结构与 `main_result` 的单段一致，额外带 `risk_factor`：

```
cne6_strip_pages: [
  {
    risk_factor: "BETA",          // 剥离的 CNE6 风险因子名（BETA/MOMENTUM/SIZE/...）
    in:  { nav, dates, benchmark_nav, excess_nav_series, turnover_series, metrics },
    out: { nav, dates, benchmark_nav, excess_nav_series, turnover_series, metrics }
  },
  { risk_factor: "MOMENTUM", in: {...}, out: {...} },
  ...  // 共 20 页
]
```

`in`/`out` 的字段与现有 `main_result[seg]` **完全相同**，可直接复用现有净值图渲染逻辑。

---

## 四、修复方案

在 `chartSpecs`（computed）的 admission 分支里，`main_result` 的 in/out 循环**之后**，补上对 `cne6_strip_pages` 的遍历。每页画 in/out 两张净值图（或按产品需要合并），title 带上 `risk_factor` 名。

### 4.1 新增 computed（取 cne6_strip_pages）

在 admission 相关 computed 区（L178 `mainResult` 附近）加：

```js
const cne6StripPages = computed<any[]>(() => report.value?.cne6_strip_pages ?? [])
```

### 4.2 chartSpecs admission 分支补充（L282 `}` 之前插入）

```js
  if (mode.value === 'admission' && cne6StripPages.value.length) {
    cne6StripPages.value.forEach((page: any, idx: number) => {
      const factor = page.risk_factor || `因子${idx + 1}`
      for (const seg of ['in', 'out'] as const) {
        const s = page[seg]
        if (!s?.dates) continue
        const series: any[] = [
          { name: '净值', type: 'line', showSymbol: false, connectNulls: true, data: nz(s.nav) }
        ]
        if (Array.isArray(s.benchmark_nav)) {
          series.push({ name: '基准', type: 'line', showSymbol: false, connectNulls: true, lineStyle: { type: 'dashed' }, data: nz(s.benchmark_nav) })
        }
        if (Array.isArray(s.excess_nav_series)) {
          series.push({ name: '超额', type: 'line', showSymbol: false, connectNulls: true, data: nz(s.excess_nav_series) })
        }
        specs.push({
          id: `cne6-strip-${idx}-${seg}`,
          title: `剥离 ${factor} · ${seg === 'in' ? '样本内' : '样本外'}净值`,
          option: {
            tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 }, grid: baseGrid,
            xAxis: { type: 'category', data: s.dates }, yAxis: { type: 'value', scale: true }, series
          }
        })
      }
    })
  }
```

> 说明：完全复用现有 `main_result` 净值图的渲染模式（nz 去 NaN、baseGrid、legend bottom:0），只是数据源换成每页的 `page.in/page.out`，title 带 `risk_factor`。

---

## 五、验收

用任务 `bt_yuyang_1783600951039`（admission，`cne6_strip_pages` 有 20 页）验证：

1. 「图表分析」区在样本内/外 2 张净值图之后，**新增 40 张剥离净值图**（20 因子 × in/out），每张标题形如「剥离 BETA · 样本内净值」。
   - 若产品希望每因子只 1 张（如只看样本外，或 in/out 合并），可相应调整——需产品确认展示粒度。
2. 图例（净值/基准/超额）落在图下方，不与 X 轴日期重叠（沿用已修复的 `legend bottom:0` + `baseGrid bottom:80`）。
3. 曲线连续无断裂（`nz` + `connectNulls` 生效）。

---

## 六、备注（可选优化，非必须）

- 20 因子 × 2 = 40 张图较多，建议前端后续可考虑：折叠面板按因子分组、或加"仅看超阈值因子"过滤（对齐 `cne6_correlation_page` 里 `exceeds_threshold` 的因子）。此为体验优化，先补齐渲染为主。
