# 前端改造方案：单个「预测周期」拆分为「IC 回测周期」+「收益计算周期」两个独立多选框

> 状态：前端待改造（后端 v0.6 已就绪，网关/DBA 无需改动）
> 关联：引擎已废弃 `forward_periods`，改用 `ic_periods` / `return_periods` 两个独立多周期字段
> 核实基线：前端源码 `749af...`（本文档基于当前 main 最新提交核实）

---

## 1. 背景与现状

引擎回测参数已从单一 `forward_periods` 拆成两个独立字段：

| 后端字段 | 用途 | 默认值 |
|---------|------|--------|
| `ic_periods` | 多周期 Rank IC 曲线 / 统计按哪些周期展示 | `[1]` |
| `return_periods` | 多周期对比、超额收益曲线按哪些周期展示 | `[1]` |

**当前前端现状**（已核实）：UI 仍是**单个**「预测周期」多选框，绑定 `forward_periods`；提交时把同一份选择**同时**塞给 `ic_periods` 和 `return_periods`。

- 好处：字段对接没问题，引擎能正确收到 `ic_periods`/`return_periods`，不是废弃字段。
- 不足：用户无法**分别**配置 IC 周期和收益周期，两者被强制绑成同一份选择。

**本次目标**：把单个多选框拆成两个独立多选下拉框，让用户可分别配置。

---

## 2. 需要改的两个提交入口

两处逻辑完全一致，需同步改：

| 入口 | 文件 |
|------|------|
| 因子回测提交页 | `src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue` |
| 我的因子-发起回测 | `src/renderer/views/FactorLibrary/MyFactors.vue` |

---

## 3. SubmitContent.vue 改动

### 3.1 模板：拆成两个下拉框

原（约 L606-L613，单个「预测周期」）：

```vue
<el-form-item label="预测周期">
  <el-select v-model="formData.backtest_params.forward_periods" multiple style="width: 100%;">
    <el-option label="1日" :value="1" />
    <el-option label="5日" :value="5" />
    <el-option label="10日" :value="10" />
    <el-option label="20日" :value="20" />
    <el-option label="60日" :value="60" />
  </el-select>
</el-form-item>
```

改为两个（admission 模式禁用，因引擎强制 `[1]`）：

```vue
<el-form-item label="IC 回测周期">
  <el-select v-model="formData.backtest_params.ic_periods" multiple
             :disabled="isAdmissionMode" style="width: 100%;">
    <el-option label="1日" :value="1" />
    <el-option label="5日" :value="5" />
    <el-option label="10日" :value="10" />
    <el-option label="20日" :value="20" />
    <el-option label="60日" :value="60" />
  </el-select>
  <div class="form-tip">决定 Rank IC 曲线 / 统计按哪些周期展示</div>
</el-form-item>

<el-form-item label="收益计算周期">
  <el-select v-model="formData.backtest_params.return_periods" multiple
             :disabled="isAdmissionMode" style="width: 100%;">
    <el-option label="1日" :value="1" />
    <el-option label="5日" :value="5" />
    <el-option label="10日" :value="10" />
    <el-option label="20日" :value="20" />
    <el-option label="60日" :value="60" />
  </el-select>
  <div class="form-tip">决定多周期对比 / 超额收益曲线按哪些周期展示</div>
</el-form-item>
```

### 3.2 data 默认值（约 L1378-L1380）

原：

```js
backtest_params: {
  num_groups: 10,
  forward_periods: [1, 5, 10, 20],
  ...
```

改为两个字段，默认都 `[1, 5, 10, 20]`：

```js
backtest_params: {
  num_groups: 10,
  ic_periods: [1, 5, 10, 20],
  return_periods: [1, 5, 10, 20],
  ...
```

### 3.3 提交组装（约 L2291-L2295）

原（映射同一份选择）：

```js
backtest_params: {
  ...(({ forward_periods, ...rest }) => rest)(formData.backtest_params),
  // 预测周期单选映射为引擎的 IC 周期与收益周期（同一份选择）
  ic_periods: formData.backtest_params.forward_periods,
  return_periods: formData.backtest_params.forward_periods,
  benchmarks: selectedBenchmarks.value,
  ...
```

改为直接透传两个独立字段（不再需要 `forward_periods` 剥离与映射）：

```js
backtest_params: {
  ...formData.backtest_params,
  benchmarks: selectedBenchmarks.value,
  ...
```

> `ic_periods` / `return_periods` 已是 `formData.backtest_params` 的字段，展开即带上，无需再手动赋值。

### 3.4 注释更新（约 L1399）

`// admission 模式：universe / forward_periods / 费率会被引擎强制覆盖`
→ 改为 `// admission 模式：universe / ic_periods / return_periods / 费率会被引擎强制覆盖`

---

## 4. MyFactors.vue 改动（同构）

| 位置 | 原 | 改 |
|------|----|----|
| 模板 约 L1601-L1613 | 单个「预测周期」`v-model="backtestForm.forward_periods"` | 拆成「IC 回测周期」`ic_periods` +「收益计算周期」`return_periods`，`:disabled="isAdmissionMode"` |
| data 约 L4132 | `forward_periods: [1, 5, 10, 20]` | `ic_periods: [1,5,10,20]` + `return_periods: [1,5,10,20]` |
| 提交组装 约 L4614-L4616 | `ic_periods: [...backtestForm.forward_periods]` / `return_periods: [...backtestForm.forward_periods]` | `ic_periods: [...backtestForm.ic_periods]` / `return_periods: [...backtestForm.return_periods]` |
| 注释 约 L4167 | 同 SubmitContent | 同步更新 |

---

## 5. admission 模式处理

- 两个下拉框在 admission 模式下 `:disabled="isAdmissionMode"` 置灰锁定。
- 引擎在 admission 模式会强制 `ic_periods=[1]` / `return_periods=[1]`，前端传什么都会被覆盖，禁用只是避免误导用户。
- `isAdmissionMode` computed 已存在，直接复用。

---

## 6. 结果展示端（需一并核对）

任务详情/研究成果页此前读的是 `task_config.backtest_params.forward_periods` 来回显「预测周期」。涉及文件：
`TasksContent.vue`、`ResearchResults.vue`、`ResultContent.vue`。

改造后新任务不再有 `forward_periods`。展示端读取建议改为回退链，兼容历史任务：

```js
const icP = cfg.ic_periods ?? cfg.forward_periods ?? []
const retP = cfg.return_periods ?? cfg.forward_periods ?? []
```

展示可从单一「预测周期：X」改为两行「IC 周期：X / 收益周期：Y」，或按产品需要保留一行。保留 `forward_periods` 兜底即可正确显示改造前提交的历史任务。

---

## 7. 验证

1. 提交页选不同的 IC 周期（如 1/5/10）与收益周期（如 1/20），提交后确认请求体 `backtest_params.ic_periods` 与 `return_periods` 为两份**不同**数组。
2. admission 模式下两个下拉框置灰。
3. `npm run build` 类型检查通过（无 `forward_periods` 残留引用报错）。
4. 打开一个改造前的历史任务详情，「预测周期」仍能正确回显（走 `forward_periods` 兜底）。

---

## 8. 影响范围

| 角色 | 操作 |
|------|------|
| 前端 | 拆分两个提交入口的下拉框 + 展示端读取回退；见上 |
| 后端 | 无需改动（已就绪） |
| 网关 | 无需改动（透传） |
| DBA | 无需改动 |
