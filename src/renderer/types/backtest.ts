// 调度提示（与引擎 TaskConfig.scheduling 对齐）
export interface SchedulingConfig {
  allow_long_running?: boolean
  preferred_lane?: 'quick' | 'standard' | 'slow' | 'highmem'
}

// Python 因子执行元信息
export interface FactorCodeMeta {
  entrypoint: 'calculate_factor' | 'factor'
  allow_pandas: boolean
  result_mode: 'dataframe' | 'series'
  factor_aggregation: 'mean' | 'last' | 'sum'
  requires: string[]
  isolation?: boolean
}

// 中间统计表物化配置（retention 已废弃）
export interface IntermediateTableConfig {
  workspace_db?: string
}

// 计算选项
export interface CalcOptions {
  calc_ic?: boolean
  calc_rank_ic?: boolean
  calc_layer_return?: boolean
  calc_turnover?: boolean
  calc_drawdown?: boolean
  warmup_days?: number | null
  memory_limit_mb?: number | null
}

// 数据源项
export interface DataSourceItem {
  name: string
  database: string
  table: string
  fields?: string[] | null
  date_field: string
  code_field: string
  field_mappings?: Record<string, string>
  time_field?: string
  time_start?: string
  time_end?: string
  mode?: 'normal' | 'intraday'
  auto_fields?: boolean
  role?: 'load' | 'intermediate_only'
}

// 回测提交请求
export interface BacktestSubmitRequest {
  task_name: string
  factor_expression?: string
  factor_code?: string
  factor_code_meta?: FactorCodeMeta
  expression_type: 'expr' | 'py_code' | 'py_file'
  intermediate_table_code?: string
  intermediate_table_config?: IntermediateTableConfig
  start_date: string
  end_date: string
  data_sources: DataSourceItem[]
  universe: any
  backtest_params: any
  calc_options?: CalcOptions
  research_mode?: 'research' | 'admission'
  walk_forward?: any
  lookahead_check?: any
  risk_neutralization?: any
  parameter_scan?: any
  udfs?: any[]
  scheduling?: SchedulingConfig
}

// 中间统计表元数据（列表页用，对齐后端 data.tables[].meta + 顶层字段）
export interface IntermediateTableMeta {
  table_name: string
  fingerprint: string
  user_name: string | null
  source_tables: string[]
  ttl_strategy: 'permanent' | 'clickhouse_ttl' | 'metadata_driven'
  ttl_raw: string | null
  ttl_deadline: string | null
  updated_at: string
  // 顶层字段（data.tables[] 上，非 meta）
  full_name?: string
  engine?: string
  size?: string
  total_rows?: number
}

// 中间统计表新建请求
export interface IntermediateTableCreateRequest {
  mode: 'python' | 'ddl'
  code?: string           // Python 模式：后端 create 端点期望的字段名
  py_code?: string        // 兼容旧字段（未使用）
  ddl?: string            // DDL 模式：完整 CREATE TABLE 语句
  table_name?: string     // DDL 模式必填（须 it_ 开头），Python 模式不传
  ttl?: string            // "permanent" / "30d" / "24h" 等
}

// 因子表达式类型
export type ExpressionType = 'expr' | 'py_file' | 'py_code'

// 回测结果 Summary（补充 v0.20.0 新增字段）
export interface BacktestSummary {
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
