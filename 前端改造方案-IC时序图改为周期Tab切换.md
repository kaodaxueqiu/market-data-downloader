# 前端改造方案：IC 时序图改为周期 Tab 切换

## 背景

回测结果页「图表分析」中，第三项「IC 时序」目前是**按周期平铺**：用户回测时选了几个预测周期（forward_period），这里就平铺几张图（如周期 1/5/10/20 共 4 张），占用大量纵向空间。

**目标**：改为「一个周期选择器（radio 按钮组）+ 只显示当前选中周期的那一张图」，节省空间。其余图表（分层净值、超额净值、因子覆盖数）保持不变。

## 涉及文件

`src/renderer/views/FactorLibrary/Backtest/ReportV03View.vue`

## 影响范围

- 仅影响 **research 模式**的 IC 时序图。
- admission 模式的 CNE6 剥离控件、样本内外净值图**不动**。
- **不涉及后端**：`ic_pages` 数据结构不变，纯前端展示层改造。

---

> **修订说明（依据前端工程师 code review）**：改用 `selectedIcIdx`（存下标，而非 period 值），并把默认值兜底逻辑放进 `chartSpecs` 的 computed 里，**不新增 watch**。原因：
> - 实例与 `id` 本来就按数组下标 `idx` 走，存 idx 最稳，可天然规避 `page.period` 类型不一致或重复的问题。
> - 避免新增 `immediate` watch 与已有 `watch(props.report)`（374 行）、`watch(chartSpecs)`（380 行）初始化顺序交叉，消除首屏多渲染一轮的闪烁。

## 改动点 1：新增响应式变量（选中的下标）

在 `<script setup>` 里，`icPages` 定义（约 156 行）附近新增一行，**不加任何 watch**：

```ts
// 当前选中的 IC 周期下标（默认第一个）
const selectedIcIdx = ref(0)
```

## 改动点 2：chartSpecs 里，把 IC 平铺改成只推选中的一张（含兜底）

把当前约 258-271 行的 `icPages.value.forEach(...)` 整段（“3. IC 多页”）替换为“按下标取选中的那一页，取不到就兜底到第 0 张”：

```ts
// 3. IC 时序（改为按选中下标只渲染一张；兜底到第 0 张）
const page = icPages.value[selectedIcIdx.value] ?? icPages.value[0]
if (page) {
  specs.push({
    id: `ic-page-${selectedIcIdx.value}`,
    title: `IC 时序（周期 ${page.period}）`,
    option: {
      tooltip: { trigger: 'axis' },
      legend: { data: ['IC', 'Rank IC'], type: 'scroll', bottom: 0 },
      grid: baseGrid,
      xAxis: { type: 'category', data: page.dates || [] },
      yAxis: { type: 'value' },
      series: [
        { name: 'IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.ic_series) },
        { name: 'Rank IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.rank_ic_series) }
      ]
    }
  })
}
```

> 说明：`chartSpecs` 是 computed，依赖 `selectedIcIdx`，切换时重算 → 已有的 `watch(chartSpecs, ...)`（约 380 行）会自动 dispose 旧图并重渲染，无需额外处理。首屏 `selectedIcIdx` 已是 0，`?? icPages.value[0]` 保证有值，不会先渲染空再补一轮。

## 改动点 3：模板里加周期选择器（radio 按钮组）

「图表分析」标题在约 85 行，其后 86-103 行已有一个 **admission 专用**的 `rv-strip-controls`。把新的 research 选择器插在该 admission 控件**之后**、`v-for="(spec, i) in chartSpecs"`（约 104 行）**之前**，用 `v-if` 隔开模式，互不影响。**单周期不显示**（`icPages.length > 1`）：

```html
<div class="rv-ic-controls" v-if="mode === 'research' && icPages.length > 1">
  <span class="rv-ic-label">IC 周期：</span>
  <el-radio-group v-model="selectedIcIdx" size="small">
    <el-radio-button
      v-for="(p, idx) in icPages"
      :key="idx"
      :label="idx"
    >周期 {{ p.period }}</el-radio-button>
  </el-radio-group>
</div>
```

## 改动点 4：样式（可选，对齐现有风格）

在 `<style>` 里新增（参考现有 `.rv-strip-controls`）：

```css
.rv-ic-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.rv-ic-label {
  font-size: 13px;
  color: #666;
}
```

---

## 注意事项

1. **selectedIcIdx 存的是数组下标（number），不是 period 值**：`v-model="selectedIcIdx"`、`:label="idx"` 都用下标，与 chartSpecs 里的取值 `icPages.value[selectedIcIdx.value]` 完全对齐。这样不依赖 `page.period` 的类型，也不怕 period 重复。
2. **不新增 watch**：默认值由 `ref(0)` + computed 内 `?? icPages.value[0]` 兜底，避免与已有 watch 初始化顺序交叉，消除首屏闪烁。
3. **单周期 / 无数据自动收敛**：选择器 `v-if="icPages.length > 1"`，只有一个周期时不显示按钮组，仍渲染那一张图；无 IC 数据时整段不 push，选择器也不显示。
4. **只影响 research 模式的 IC 图**；admission 模式的 CNE6 剥离控件、样本内外图都不动。
5. **默认显示第一个周期**（下标 0，通常是周期 1）。若产品希望默认某个周期，改 `ref(0)` 的初值即可。
6. **不涉及后端**：`ic_pages` 数据结构不变。

## 验收要点

- research 报告页「图表分析」中，IC 时序由多张变为 1 张，上方出现「IC 周期：周期1 | 周期5 | ...」按钮组。
- 点击不同周期，下方 IC 图切换为对应周期的数据，标题同步显示「IC 时序（周期 X）」。
- 切换有多个周期 / 单个周期 / 无 IC 数据三种情况均正常（单周期时只有一个按钮；无数据时不显示选择器）。
- 分层净值、超额净值、因子覆盖数三张图位置与内容不变。
- admission 模式报告页不受影响。
