<template>
  <div class="report-view" v-if="report">
    <!-- 入库审核看板（仅 admission 模式） -->
    <div class="report-section" v-if="admission">
      <h4 class="report-section-title">入库审核看板</h4>
      <div class="admission-score" :class="`wq-${admissionLevel}`">
        <span class="score-label">WQ 综合评分</span>
        <span class="score-value">
          {{ admission.wq_score !== null && admission.wq_score !== undefined ? Number(admission.wq_score).toFixed(4) : '样本不足' }}
        </span>
        <span class="score-hint">
          {{ admissionLevel === 'pass' ? '通过' : admissionLevel === 'reject' ? '拒绝' : admissionLevel === 'pending' ? '待复核' : '—' }}
        </span>
      </div>

      <!-- 引擎判定结果（R7：直接读 decision/reject_reasons，不再前端预判） -->
      <div v-if="admission.decision" class="admission-decision" :class="`decision-${admission.decision}`">
        <div class="decision-header">
          <span class="decision-icon">
            {{ admission.decision === 'pass' ? '✓' : admission.decision === 'reject' ? '✗' : '!' }}
          </span>
          <span class="decision-title">
            {{ admission.decision === 'pass' ? '引擎判定：通过' : admission.decision === 'reject' ? '引擎判定：拒绝' : '引擎判定：待人工复核' }}
          </span>
        </div>
        <ul v-if="admission.decision === 'reject' && admission.reject_reasons?.length" class="reject-reasons">
          <li v-for="(reason, i) in admission.reject_reasons" :key="i">{{ reason }}</li>
        </ul>
        <p v-else-if="admission.decision === 'pending'" class="pending-hint">
          样本数据不足，无法自动判定，建议人工复核因子质量。
        </p>
      </div>

      <div class="admission-meta">
        <el-tag size="small" type="info">股票池：{{ admission.pool || '—' }}</el-tag>
        <el-tag size="small" type="info">IC周期：{{ admission.ic_period ?? '—' }}日</el-tag>
        <el-tag size="small" type="info">切分日：{{ admission.split_date || '—' }}</el-tag>
        <el-tag v-if="admission.pool_override" size="small" type="warning">
          用户股票池已被强制覆盖为中证1000
        </el-tag>
      </div>

      <el-table :data="sampleMetrics" size="small" border class="admission-table">
        <el-table-column prop="label" label="指标" width="140" />
        <el-table-column label="样本内">
          <template #default="{ row }">
            {{ fmtMetric(admission.in_sample?.[row.key], row.fmt) }}
          </template>
        </el-table-column>
        <el-table-column label="样本外">
          <template #default="{ row }">
            {{ fmtMetric(admission.out_of_sample?.[row.key], row.fmt) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 指标卡片 -->
    <div class="report-section" v-if="cards.length">
      <h4 class="report-section-title">核心指标</h4>
      <div class="report-cards">
        <div
          v-for="card in cards"
          :key="card.key"
          class="report-card"
          :class="card.grade ? `grade-${card.grade}` : ''"
        >
          <div class="card-label">
            {{ card.label }}
            <el-tooltip v-if="card.reference" :content="String(card.reference)" placement="top">
              <el-icon class="card-ref-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <div class="card-value">{{ formatCardValue(card.value, card.unit) }}</div>
        </div>
      </div>
    </div>

    <!-- 警告 -->
    <div class="report-section" v-if="sortedWarnings.length">
      <h4 class="report-section-title">提示与警告</h4>
      <el-alert
        v-for="(w, i) in sortedWarnings"
        :key="w.code + i"
        :type="severityToType(w.severity)"
        :closable="false"
        show-icon
        class="report-warning"
      >
        <template #title>
          <span class="warning-message">{{ w.message }}</span>
        </template>
        <div v-if="w.suggestion" class="warning-suggestion">建议：{{ w.suggestion }}</div>
      </el-alert>
    </div>

    <!-- 图表 -->
    <div class="report-section" v-if="charts.length">
      <h4 class="report-section-title">图表分析</h4>
      <div
        v-for="(chart, i) in charts"
        :key="chart.type + i"
        class="report-chart-block"
        v-show="isSupported(chart.type)"
      >
        <div class="chart-title" v-if="chart.title">{{ chart.title }}</div>
        <div class="chart-canvas" :ref="el => setChartRef(i, el)"></div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="report-section" v-if="tables.length">
      <h4 class="report-section-title">明细表</h4>
      <div v-for="tb in tables" :key="tb.key" class="report-table-block">
        <div class="chart-title" v-if="tb.title">{{ tb.title }}</div>
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
  </div>

  <el-empty v-else description="暂无 v0.2.6 详细报告数据" :image-size="80" />
</template>

<script setup lang="ts">
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const props = defineProps<{
  report: any
  admissionReport?: any
  active?: boolean
}>()

const cards = computed<any[]>(() => props.report?.summary_cards ?? [])
const charts = computed<any[]>(() => props.report?.charts ?? [])
const tables = computed<any[]>(() => props.report?.tables ?? [])

// ========== 入库审核看板 ==========
const admission = computed<any>(() => props.admissionReport ?? null)

// R7：直接读引擎 decision（pass/reject/pending），不再前端预判
const admissionLevel = computed<'pass' | 'reject' | 'pending' | 'na'>(() => {
  const d = admission.value?.decision
  if (d === 'pass' || d === 'reject' || d === 'pending') return d
  return 'na'
})

// 样本内外指标对比行（null → 样本不足）
const sampleMetrics = [
  { key: 'ic_mean', label: 'IC 均值', fmt: 'ratio' },
  { key: 'icir', label: 'ICIR', fmt: 'ratio' },
  { key: 'rank_ic_mean', label: 'Rank IC 均值', fmt: 'ratio' },
  { key: 'excess_annual_return', label: '超额年化', fmt: 'pct' },
  { key: 'turnover_mean', label: '平均换手', fmt: 'ratio' },
  { key: 'sharpe', label: 'Sharpe', fmt: 'ratio' },
  { key: 'max_drawdown', label: '最大回撤', fmt: 'pct' },
  { key: 'n_days', label: '样本天数', fmt: 'count' }
]

const fmtMetric = (val: any, fmt: string): string => {
  if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return '样本不足'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (fmt === 'pct') return (n * 100).toFixed(2) + '%'
  if (fmt === 'count') return String(Math.round(n))
  return n.toFixed(3)
}

// severity 排序：critical > warning > info
const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
const sortedWarnings = computed<any[]>(() => {
  const ws = props.report?.warnings ?? []
  return [...ws].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
})

const severityToType = (sev: string): 'success' | 'warning' | 'info' | 'error' => {
  if (sev === 'critical') return 'error'
  if (sev === 'warning') return 'warning'
  return 'info'
}

// value 按 unit 格式化
const formatCardValue = (value: any, unit: string): string => {
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) return '—'
  const num = Number(value)
  if (isNaN(num)) return String(value)
  switch (unit) {
    case 'pct':
      return (num * 100).toFixed(2) + '%'
    case 'ratio':
      return num.toFixed(2)
    case 'days':
    case 'count':
      return String(Math.round(num))
    default:
      return num.toFixed(4)
  }
}

// tables：columns + rows[][] → el-table 需要对象数组
const toTableRows = (tb: any): any[] => {
  const rows = tb?.rows ?? []
  return rows.map((row: any[]) => {
    const obj: Record<string, any> = {}
    row.forEach((cell, ci) => { obj[String(ci)] = cell })
    return obj
  })
}

// ========== 图表分发 ==========
// 已验证真实字段的图表（quick 7 种 + admission 补充 7 种）
const SUPPORTED_CHARTS = new Set([
  'ic_time_series',
  'rolling_ic',
  'nav_and_drawdown',
  'quantile_cumulative_nav',
  'annual_monthly_heatmap',
  'turnover_and_cost',
  'data_quality_coverage',
  'cost_sensitivity',
  'capacity_curve',
  'bucket_ic_heatmap',
  'alpha_decay',
  'autocorrelation_curve',
  'nonlinear_response',
  'turnover_heatmap'
])
const isSupported = (type: string) => SUPPORTED_CHARTS.has(type)

const chartRefs: Record<number, HTMLElement | null> = {}
const chartInstances: Record<number, echarts.ECharts> = {}
const setChartRef = (i: number, el: any) => {
  chartRefs[i] = el as HTMLElement | null
}

const baseGrid = { left: '3%', right: '4%', top: 50, bottom: '8%', containLabel: true }

// 各 chart type → ECharts option（字段严格按真实 JSON）
const buildOption = (chart: any): echarts.EChartsOption | null => {
  switch (chart.type) {
    case 'ic_time_series':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['IC', 'Rank IC'] },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: { type: 'value' },
        series: [
          { name: 'IC', type: 'line', showSymbol: false, data: chart.ic || [] },
          { name: 'Rank IC', type: 'line', showSymbol: false, data: chart.rank_ic || [] }
        ]
      }
    case 'rolling_ic':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['60日', '120日', '252日'] },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: { type: 'value' },
        series: [
          { name: '60日', type: 'line', showSymbol: false, connectNulls: true, data: chart.rolling_60d || [] },
          { name: '120日', type: 'line', showSymbol: false, connectNulls: true, data: chart.rolling_120d || [] },
          { name: '252日', type: 'line', showSymbol: false, connectNulls: true, data: chart.rolling_252d || [] }
        ]
      }
    case 'nav_and_drawdown': {
      const series: any[] = [
        { name: '净值(Gross)', type: 'line', showSymbol: false, data: chart.nav_gross || [] },
        { name: '净值(Net)', type: 'line', showSymbol: false, data: chart.nav_net || [] }
      ]
      const legend = ['净值(Gross)', '净值(Net)']
      // nav_benchmark 有才画（quick 下为 null）
      if (Array.isArray(chart.nav_benchmark)) {
        series.push({ name: '基准', type: 'line', showSymbol: false, data: chart.nav_benchmark })
        legend.push('基准')
      }
      series.push({
        name: '回撤',
        type: 'line', yAxisIndex: 1, showSymbol: false, areaStyle: {},
        lineStyle: { opacity: 0.3 }, data: chart.drawdown_net || []
      })
      legend.push('回撤')
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: legend },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: [
          { type: 'value', scale: true },
          { type: 'value', name: '回撤', max: 0, position: 'right' }
        ],
        series
      }
    }
    case 'quantile_cumulative_nav': {
      // nav_by_group 是二维数组 [组][日期]，group_labels 与外层对应
      const groups: number[][] = chart.nav_by_group || []
      const labels: string[] = chart.group_labels || []
      const series = groups.map((arr, gi) => ({
        name: labels[gi] || `Q${gi + 1}`,
        type: 'line' as const, showSymbol: false, data: arr
      }))
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: labels, type: 'scroll' },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: { type: 'value', scale: true },
        series
      }
    }
    case 'annual_monthly_heatmap': {
      // matrix[年][月]，years 外层，months 数字数组
      const years: number[] = chart.years || []
      const months: number[] = chart.months || []
      const matrix: (number | null)[][] = chart.matrix || []
      const data: [number, number, number][] = []
      let min = 0, max = 0
      matrix.forEach((row, yi) => {
        row.forEach((val, mi) => {
          if (val !== null && val !== undefined) {
            data.push([mi, yi, val])
            if (val < min) min = val
            if (val > max) max = val
          }
        })
      })
      const absMax = Math.max(Math.abs(min), Math.abs(max)) || 1
      return {
        tooltip: { position: 'top' },
        grid: { ...baseGrid, bottom: 60 },
        xAxis: { type: 'category', data: months.map(m => `${m}月`) },
        yAxis: { type: 'category', data: years.map(y => String(y)) },
        visualMap: {
          min: -absMax, max: absMax, calculable: true, orient: 'horizontal',
          left: 'center', bottom: 0,
          inRange: { color: ['#f56c6c', '#ffffff', '#67c23a'] }
        },
        series: [{
          type: 'heatmap',
          data,
          label: { show: true, formatter: (p: any) => (p.value[2] * 100).toFixed(1) + '%' }
        }]
      }
    }
    case 'turnover_and_cost':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['换手率', '成本(bps)'] },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: [
          { type: 'value', name: '换手率' },
          { type: 'value', name: 'bps', position: 'right' }
        ],
        series: [
          { name: '换手率', type: 'line', showSymbol: false, data: chart.turnover || [] },
          { name: '成本(bps)', type: 'line', yAxisIndex: 1, showSymbol: false, data: chart.cost_bps || [] }
        ]
      }
    case 'data_quality_coverage':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['覆盖率', '缺失率', '极值裁剪率'] },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.dates || [] },
        yAxis: { type: 'value' },
        series: [
          { name: '覆盖率', type: 'line', showSymbol: false, data: chart.coverage_ratio || [] },
          { name: '缺失率', type: 'line', showSymbol: false, data: chart.missing_ratio || [] },
          { name: '极值裁剪率', type: 'line', showSymbol: false, data: chart.extreme_clipped_ratio || [] }
        ]
      }
    case 'cost_sensitivity':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['年化净收益', 'Sharpe(净)'] },
        grid: baseGrid,
        xAxis: { type: 'category', name: 'bps', data: (chart.cost_bps_levels || []).map((v: number) => String(v)) },
        yAxis: [
          { type: 'value', name: '年化净收益' },
          { type: 'value', name: 'Sharpe', position: 'right' }
        ],
        series: [
          { name: '年化净收益', type: 'line', data: chart.annual_return_net || [] },
          { name: 'Sharpe(净)', type: 'line', yAxisIndex: 1, data: chart.sharpe_net || [] }
        ]
      }
    case 'capacity_curve':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['年化净收益', 'Sharpe(净)', '平均参与率'] },
        grid: baseGrid,
        xAxis: { type: 'category', name: 'AUM(元)', data: (chart.aum_yuan || []).map((v: number) => String(v)) },
        yAxis: [
          { type: 'value', name: '收益/Sharpe' },
          { type: 'value', name: '参与率', position: 'right' }
        ],
        series: [
          { name: '年化净收益', type: 'line', data: chart.annual_return_net || [] },
          { name: 'Sharpe(净)', type: 'line', data: chart.sharpe_net || [] },
          { name: '平均参与率', type: 'line', yAxisIndex: 1, data: chart.avg_participation_rate || [] }
        ]
      }
    case 'bucket_ic_heatmap': {
      // matrix[bucket][year]，bucket_labels 外层，years 内层
      const buckets: string[] = chart.bucket_labels || []
      const years: number[] = chart.years || []
      const matrix: (number | null)[][] = chart.matrix || []
      const data: [number, number, number][] = []
      let absMax = 0
      matrix.forEach((row, bi) => {
        row.forEach((val, yi) => {
          if (val !== null && val !== undefined) {
            data.push([yi, bi, val])
            absMax = Math.max(absMax, Math.abs(val))
          }
        })
      })
      absMax = absMax || 1
      return {
        tooltip: { position: 'top' },
        grid: { ...baseGrid, bottom: 60 },
        xAxis: { type: 'category', data: years.map(y => String(y)) },
        yAxis: { type: 'category', data: buckets },
        visualMap: {
          min: -absMax, max: absMax, calculable: true, orient: 'horizontal',
          left: 'center', bottom: 0,
          inRange: { color: ['#f56c6c', '#ffffff', '#67c23a'] }
        },
        series: [{
          type: 'heatmap', data,
          label: { show: true, formatter: (p: any) => p.value[2].toFixed(3) }
        }]
      }
    }
    case 'alpha_decay':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['Rank IC', '多空年化'] },
        grid: baseGrid,
        xAxis: { type: 'category', name: '持有期', data: (chart.horizons || []).map((v: number) => `${v}日`) },
        yAxis: { type: 'value' },
        series: [
          { name: 'Rank IC', type: 'bar', data: chart.rank_ic_mean || [] },
          { name: '多空年化', type: 'line', connectNulls: true, data: chart.long_short_annual_return || [] }
        ]
      }
    case 'autocorrelation_curve':
      return {
        tooltip: { trigger: 'axis' },
        grid: baseGrid,
        xAxis: { type: 'category', name: 'lag', data: (chart.lags || []).map((v: number) => String(v)) },
        yAxis: { type: 'value' },
        series: [
          { name: '自相关', type: 'line', data: chart.values || [] }
        ]
      }
    case 'nonlinear_response':
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['平均因子值', '平均未来收益'] },
        grid: baseGrid,
        xAxis: { type: 'category', data: chart.bucket_labels || [] },
        yAxis: [
          { type: 'value', name: '因子值' },
          { type: 'value', name: '收益', position: 'right' }
        ],
        series: [
          { name: '平均因子值', type: 'bar', data: chart.mean_factor || [] },
          { name: '平均未来收益', type: 'line', yAxisIndex: 1, data: chart.mean_return || [] }
        ]
      }
    case 'turnover_heatmap': {
      // matrix[year][month]，years 外层，months 数字
      const years: number[] = chart.years || []
      const months: number[] = chart.months || []
      const matrix: (number | null)[][] = chart.matrix || []
      const data: [number, number, number][] = []
      let maxV = 0
      matrix.forEach((row, yi) => {
        row.forEach((val, mi) => {
          if (val !== null && val !== undefined) {
            data.push([mi, yi, val])
            maxV = Math.max(maxV, val)
          }
        })
      })
      return {
        tooltip: { position: 'top' },
        grid: { ...baseGrid, bottom: 60 },
        xAxis: { type: 'category', data: months.map(m => `${m}月`) },
        yAxis: { type: 'category', data: years.map(y => String(y)) },
        visualMap: {
          min: 0, max: maxV || 1, calculable: true, orient: 'horizontal',
          left: 'center', bottom: 0,
          inRange: { color: ['#ffffff', '#409eff'] }
        },
        series: [{
          type: 'heatmap', data,
          label: { show: true, formatter: (p: any) => (p.value[2] * 100).toFixed(0) + '%' }
        }]
      }
    }
    default:
      // 未识别 type：静默跳过
      return null
  }
}

const renderCharts = async () => {
  await nextTick()
  // 等待容器布局完成（Tab 切换后容器才有尺寸）
  await new Promise(r => requestAnimationFrame(() => r(null)))
  charts.value.forEach((chart, i) => {
    if (!isSupported(chart.type)) return
    const el = chartRefs[i]
    if (!el || el.clientWidth === 0) return
    const option = buildOption(chart)
    if (!option) return
    // 统一图例位置：固定顶部、可滚动，避免与坐标轴/数据点重叠
    if (option.legend && !Array.isArray(option.legend)) {
      option.legend = { ...option.legend, top: 0, left: 'center', type: 'scroll' }
    }
    let inst = chartInstances[i]
    if (!inst) {
      inst = echarts.init(el)
      chartInstances[i] = inst
    }
    inst.setOption(option, true)
    inst.resize()
  })
}

const disposeCharts = () => {
  Object.values(chartInstances).forEach(inst => inst.dispose())
  Object.keys(chartInstances).forEach(k => delete chartInstances[Number(k)])
}

// report 变化重建；active 变为 true（切到本 Tab、容器有尺寸）时渲染
watch([() => props.report, () => props.active], ([, active], [oldReport]) => {
  if (props.report !== oldReport) disposeCharts()
  if (active !== false) renderCharts()
}, { immediate: true })

const onResize = () => {
  Object.values(chartInstances).forEach(inst => inst.resize())
}
window.addEventListener('resize', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  disposeCharts()
})
</script>

<style scoped lang="scss">
.report-view {
  padding: 4px 0;
}
.report-section {
  margin-bottom: 28px;
}
.report-section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
  padding-left: 10px;
  border-left: 4px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  line-height: 1.4;
}
.admission-score {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 18px 24px;
  border-radius: 10px;
  margin-bottom: 14px;
  border: 1px solid #eef0f4;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);

  &.wq-pass { background: rgba(103, 194, 58, 0.12); color: #529b2e; }
  &.wq-reject { background: rgba(245, 108, 108, 0.12); color: #c45656; }
  &.wq-pending { background: rgba(230, 162, 60, 0.12); color: #b88230; }
  &.wq-na { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
}
.score-label { font-size: 13px; }
.score-value { font-size: 28px; font-weight: 700; }
.score-hint { font-size: 14px; font-weight: 600; }

/* R7 引擎判定区块 */
.admission-decision {
  padding: 14px 18px;
  border-radius: 8px;
  margin-bottom: 14px;
  border: 1px solid transparent;

  &.decision-pass {
    background: rgba(103, 194, 58, 0.06);
    border-color: rgba(103, 194, 58, 0.3);
  }
  &.decision-reject {
    background: rgba(245, 108, 108, 0.06);
    border-color: rgba(245, 108, 108, 0.3);
  }
  &.decision-pending {
    background: rgba(230, 162, 60, 0.06);
    border-color: rgba(230, 162, 60, 0.3);
  }
}
.decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.decision-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  color: #fff;

  .decision-pass & { background: #67c23a; }
  .decision-reject & { background: #f56c6c; }
  .decision-pending & { background: #e6a23c; }
}
.reject-reasons {
  margin: 10px 0 0;
  padding-left: 30px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.8;

  li {
    list-style: disc;
  }
}
.pending-hint {
  margin: 8px 0 0 30px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.admission-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.admission-table {
  margin-bottom: 8px;
}
.report-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}
.report-card {
  padding: 14px 18px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef0f4;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  &.grade-excellent { border-color: #b3e19d; background: linear-gradient(135deg, #f6ffed 0%, #ffffff 100%); }
  &.grade-good { border-color: #a0cfff; background: linear-gradient(135deg, #ecf5ff 0%, #ffffff 100%); }
  &.grade-fair { border-color: #f3d19e; background: linear-gradient(135deg, #fdf6ec 0%, #ffffff 100%); }
  &.grade-poor { border-color: #f8c4c4; background: linear-gradient(135deg, #fef0f0 0%, #ffffff 100%); }
  &.grade-na { border-color: var(--el-border-color); }
}
.card-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.card-ref-icon {
  font-size: 12px;
  cursor: help;
}
.card-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.report-warning {
  margin-bottom: 8px;
}
.warning-suggestion {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.report-chart-block,
.report-table-block {
  margin-bottom: 16px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #eef0f4;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 16px 20px 12px;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  line-height: 1.4;
}
.chart-canvas {
  width: 100%;
  height: 320px;
  overflow: hidden;
  box-sizing: border-box;
}
</style>
