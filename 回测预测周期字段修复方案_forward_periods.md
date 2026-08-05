# 回测「预测周期」字段修复方案（forward_periods → ic_periods / return_periods）

- 面向：前端工程师
- 核实基准：前端 `market-data-downloader` @ `44ca674`；引擎 `backtest-engine` v0.5.9
- 优先级：**高**（当前多周期回测被静默降级，用户无感知）

---

## 一、问题结论

引擎新版接收回测周期的字段已由 `forward_periods` 拆分为 **`ic_periods`（IC 回测周期）** 与 **`return_periods`（收益计算周期）** 两个字段，且**未保留 `forward_periods` 的 serde alias 兼容**。

而前端提交任务时仍在传老字段 `forward_periods`。

引擎侧证据：

- `config.rs` 的 `BacktestConfig` 仅定义 `ic_periods: Vec<i32>` / `return_periods: Vec<i32>`，默认均为 `[1]`。
- 对比同项目 `api/models.rs` 中 `intermediate_table_code` 明确写了 `#[serde(alias = "prepare_data_code")]` 做兼容——而 `ic_periods`/`return_periods` **没有**任何 alias。
- 引擎内部出现的 `forward_periods` 只是函数局部变量（由 `merge_periods(ic ∪ return)` 计算得到），**不是**反序列化入参。

### 后果

前端传的 `forward_periods` 会被 serde 当未知字段**静默忽略** → `ic_periods` / `return_periods` 取不到值，回退默认 `[1]`。

即：用户在界面选了 1 / 5 / 10 / 20 日，**引擎实际只跑 1 日，且不报错**。这是静默降级，界面无任何提示。

---

## 二、需要改的位置

共 **2 个提交路径** + **3 个展示读取**。

### A. 提交路径（必须改，否则多周期失效）

界面上「预测周期」只有一个多选框，因此提交时把它同时映射给 `ic_periods` 与 `return_periods` 即可（同一份选择）。

**A1. `src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue`**（约 2322 行，`backtest_params` 组装处）

去掉 `forward_periods`，改为提交 `ic_periods` / `return_periods`：

```js
backtest_params: {
  ...(({ forward_periods, ...rest }) => rest)(formData.backtest_params),
  // 预测周期单选映射为引擎的 IC 周期与收益周期（同一份选择）
  ic_periods: formData.backtest_params.forward_periods,
  return_periods: formData.backtest_params.forward_periods,
  benchmarks: selectedBenchmarks.value,
  risk_free_rate: formData.backtest_params.risk_free_rate ?? undefined,
  buy_cost_bps: formData.backtest_params.buy_cost_bps ?? undefined,
  sell_cost_bps: formData.backtest_params.sell_cost_bps ?? undefined
},
```

**A2. `src/renderer/views/FactorLibrary/MyFactors.vue`**（约 4647 行，`backtest_params` 组装处）

把 `forward_periods: [...backtestForm.forward_periods],` 替换为：

```js
ic_periods: [...backtestForm.forward_periods],
return_periods: [...backtestForm.forward_periods],
```

> 说明：两个文件里表单的 `v-model="...forward_periods"`（SubmitContent.vue 约 628 行、MyFactors.vue 约 1624 行）与 data 默认值 `forward_periods: [1,5,10,20]` **可保留原样**，作为前端内部状态；只需在提交组装那一步做字段映射，改动最小。

### B. 展示读取（改了 A 之后必须跟改，否则详情页「预测周期」显示为空）

改造后任务存储的是 `ic_periods` / `return_periods`，以下三处读 `forward_periods` 会取不到值。建议改为回退链 `ic_periods ?? forward_periods ?? []`（保留 `forward_periods` 兜底，可兼容改造前提交的历史任务）。

- **B1. `src/renderer/views/FactorLibrary/ResearchResults.vue`**（约 364 行）
- **B2. `src/renderer/views/FactorLibrary/Backtest/TasksContent.vue`**（约 448 行）
- **B3. `src/renderer/views/FactorLibrary/Backtest/ResultContent.vue`**（约 1592 行）

示例（以 B3 的 computed 为例，其它两处同理）：

```js
// admission 分支读 effective_forward_periods 保持不变
return task.value?.task_config?.backtest_params?.ic_periods
    ?? task.value?.task_config?.backtest_params?.forward_periods
    ?? []
```

> ResultContent.vue 中 admission 模式读 `summary.effective_forward_periods` 的分支**不用动**（那是引擎回显字段）。

---

## 三、验证方法

1. 提交一个多周期任务，界面「预测周期」选 1 / 5 / 10 / 20。
2. 确认引擎返回的 summary 中 `effective_forward_periods` 为 4 个周期（`[1,5,10,20]`），而非只有 `[1]`。
3. 打开任务详情页，确认「预测周期」正确回显 4 个周期。
4. 回归历史任务详情页，确认旧任务（仍存 `forward_periods`）经回退链仍能正常显示。

---

## 四、备注

- 若后续产品希望 IC 周期与收益周期可**分别配置**，则需在表单增加两个独立多选框，分别绑定 `ic_periods` / `return_periods`；当前方案按「单选框映射到两者」处理，行为与改造前一致。
- 本方案仅涉及前端字段映射，引擎侧无需改动。
