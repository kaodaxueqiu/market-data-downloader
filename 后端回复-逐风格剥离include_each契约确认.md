# 后端回复：前端放开逐风格剥离（include_each）契约确认

> 依据引擎 commit `46643b6`（origin/main）源码核实。所有结论来自 `src/risk_neutralization.rs`、`src/api/models.rs`、`src/diagnostics/cne6.rs`、`src/main.rs`。

## 1. 参数字段与位置

**字段名就是 `risk_neutralization.include_each`**，没有改。结构定义见 [models.rs:164-181](file:///opt/work/backtest-engine/src/api/models.rs#L164-L181)：

```rust
pub struct RiskNeutralizationConfig {
    pub enabled: Option<bool>,       // 是否启用中性化；None 按 research_mode 默认
    pub selected: Option<Vec<String>>,   // 用户勾选的风险因子
    pub include_all: Option<bool>,   // 额外输出"全风险一起剥"，默认 true
    pub include_each: Option<bool>,  // 额外输出"每个单风险因子逐个剥"，默认 false
    pub industry_level: Option<String>,
    pub beta_window: Option<usize>,
    pub fallback_policy: Option<String>,
}
```

**开启逐风格剥离的标准请求体 `risk_neutralization` 对象：**

```json
{
  "risk_neutralization": {
    "enabled": true,
    "selected": ["beta", "size"],
    "include_all": true,
    "include_each": true
  }
}
```

## 2. 与 selected / include_all 的关系

三个开关**互相独立、可叠加**，引擎按顺序分别产出 variant（见 [risk_neutralization.rs:65-90](file:///opt/work/backtest-engine/src/risk_neutralization.rs#L65-L90)）：

| 开关 | 产出 variant | 说明 |
|------|-------------|------|
| `selected` 非空 | `neutral_selected` | 按 selected 子集一起剥离，产出 1 个 |
| `include_all: true` | `neutral_all` | 全部 20 个 SW21 风格一起剥离，产出 1 个 |
| `include_each: true` | `neutral_each_{style}` × 20 | 每个风格单独剥离，产出 20 个 |

**关键结论：**
- `include_each: true` 后，`selected` 和 `include_all` **仍按各自语义独立生效**，含义不变。全传就是 raw + selected + all + 20 个 each。
- **逐风格剥离固定剥离全部 20 个 SW21 风格**，**不受 `selected` 影响**。代码里 `include_each` 分支直接遍历常量 `CNE6_STYLE_FACTORS_SW21`（20 个），跟 `selected` 无关。

## 3. 触发方式与模式约束

**`include_each` 不受任何模式门禁限制。** [risk_neutralization.rs:137-163](file:///opt/work/backtest-engine/src/risk_neutralization.rs#L137-L163) 的 policy 逻辑里，`include_each` 直接取用户传值（默认 false），没有对 quick/deep/admission 做任何拦截。

| 模式 | include_each 行为 |
|------|------------------|
| quick 快速初筛 | **允许**开启（传 true 就跑）。不禁止 |
| deep 深度研究 | 允许 |
| admission 入库审核 | **不强制、不禁止**，由前端/任务配置传入（[main.rs:1288](file:///opt/work/backtest-engine/src/main.rs#L1288) 注释明确："实际开关由前端/任务配置传入"） |

> 补充：`deep`/`research`/`admission`/`library`/`governance` 属于 `deep_like` 模式，它们即使不传 `include_each` 也会默认开启中性化主流程（`enabled=true`），但**逐风格 each 仍需显式传 `include_each: true`**。

## 4. 成本与限制

- **额外开销**：逐风格会额外产出 20 组残差 variant（OLS 逐日截面回归），确实增加计算量。**但引擎没有对 include_each 设耗时上限、并发限制或拒绝策略**——代码里没有针对 variant 数量的门禁或熔断。
- **样本不足处理**：不是"拒绝任务"，而是**逐日降级**。某日截面有效样本 < 列数+2 时，该日残差留 `None` 不参与计算（[core/neutralization.rs:16-47](file:///opt/work/backtest-engine/src/core/neutralization.rs#L16-L47)），不 panic、不失败。单个风格剥离失败也只 `warn` 跳过该 variant（[risk_neutralization.rs:87](file:///opt/work/backtest-engine/src/risk_neutralization.rs#L87)），不影响其他。
- **admission 最低样本**：admission 模式有样本天数门槛（样本内 ≥60 日、样本外 ≥20 日，见 [admission/mod.rs:85-86](file:///opt/work/backtest-engine/src/admission/mod.rs#L85-L86)），不足则 `decision=pending`。但这是 admission 判定逻辑，跟 include_each 无关。
- **UI 成本提示建议**：建议前端加提示——"开启逐风格剥离会额外计算 20 组风格残差，任务耗时会明显增加"。非强制，属体验优化。

## 5. 返回数据确认

**variant 取值**（`factor_results[].variant`）：

```
raw
neutral_selected      （当 selected 非空时才有）
neutral_all           （当 include_all=true 时才有）
neutral_each_beta
neutral_each_momentum
... （共 20 个 neutral_each_*）
neutral_each_strevrsl
```

即：`raw` + 可选 `neutral_selected` + 可选 `neutral_all` + 20 个 `neutral_each_{style}`。任务 `BT_20260722_98241b84` 返回 21 个 = `raw` + 20 个 `neutral_each_*`（说明它没开 include_all/selected）。

**20 个风格英文 key 权威列表**（来自 [cne6.rs:19-40](file:///opt/work/backtest-engine/src/diagnostics/cne6.rs#L19-L40) 常量 `CNE6_STYLE_FACTORS_SW21`，variant 名是 `to_lowercase()` 后的值）：

| # | 常量（大写） | variant key（小写） | 前端拼写核对 |
|---|-----------|------------------|------------|
| 1 | BETA | `beta` | ✅ |
| 2 | MOMENTUM | `momentum` | ✅ |
| 3 | SIZE | `size` | ✅ |
| 4 | EARNYILD | `earnyild` | ✅ 注意不是 earnyield |
| 5 | RESVOL | `resvol` | ✅ |
| 6 | GROWTH | `growth` | ✅ |
| 7 | BTOP | `btop` | ✅ |
| 8 | LEVERAGE | `leverage` | ✅ |
| 9 | LIQUIDTY | `liquidty` | ✅ 注意不是 liquidity |
| 10 | MIDCAP | `midcap` | ✅ |
| 11 | DIVYILD | `divyild` | ✅ 注意不是 divyield |
| 12 | EARNQLTY | `earnqlty` | ✅ |
| 13 | EARNVAR | `earnvar` | ✅ |
| 14 | INVSQLTY | `invsqlty` | ⚠️ **前端写的是 invsqlty，正确**（INVSQLTY，不是 invsqlty 之外的拼法） |
| 15 | LTREVRSL | `ltrevrsl` | ✅ |
| 16 | PROFIT | `profit` | ✅ |
| 17 | ANALSENTI | `analsenti` | ✅ |
| 18 | INDMOM | `indmom` | ✅ |
| 19 | SEASON | `season` | ✅ |
| 20 | STREVRSL | `strevrsl` | ✅ |

**前端提供的 20 个 key 拼写全部正确**，包括三个非常规缩写 `earnyild`/`liquidty`/`divyild` 都对。可直接用于中文映射。

## 6. 现有验证任务的来源

任务 `BT_20260722_98241b84` 返回 21 个变体 = `raw` + 20 个 `neutral_each_*`，反推它的请求体 `risk_neutralization` 是：

```json
{
  "risk_neutralization": {
    "enabled": true,
    "include_each": true,
    "include_all": false
  }
}
```

（因为没有 `neutral_all` 和 `neutral_selected`，说明 include_all=false、selected 为空。）

> 注：该任务的完整原始请求体需从任务库 `backtest_task.task_config` 字段查询确认。如需精确参照，可调 `GET /api/v1/backtest/task/BT_20260722_98241b84` 拿 `task_config` 字段。但从 variant 结果已可确定上述最小配置。

---

## 给前端的落地建议

1. **提交端**（SubmitContent.vue / MyFactors.vue）：把当前固定的 `include_each: false` 改为跟随用户开关。开启时 `risk_neutralization` 传 `{enabled: true, include_each: true, include_all: true/false, selected: [...]}`。
2. **展示端**（F4，ResultContent.vue）：已出方案，`getVariantLabel` 识别 `neutral_each_` 前缀 + 20 个中文映射。拼写已核对无误。
3. **成本提示**：开启逐风格的开关旁加一行说明"额外计算 20 组风格残差，耗时增加"。
