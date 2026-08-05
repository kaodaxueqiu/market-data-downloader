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
  calc_long_short?: boolean
  calc_turnover?: boolean
  calc_drawdown?: boolean
  warmup_days?: number | null
  memory_limit_mb?: number | null
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
  data_sources: any[]
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
  py_code?: string      // Python 模式：prepare_data / build_intermediate_table 函数代码
  ddl?: string          // DDL 模式：完整 CREATE TABLE 语句
  table_name?: string   // 用户命名（Python 模式可选，DDL 模式必填）
  ttl?: string          // "permanent" / "30d" / "24h" 等
}

// 因子表达式类型
export type ExpressionType = 'expr' | 'py_file' | 'py_code'
