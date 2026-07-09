<template>
  <div class="report-v03" v-if="report">
    <!-- ============ research 模式 ============ -->
    <template v-if="mode === 'research'">
      <!-- meta -->
      <div class="rv-section" v-if="meta">
        <div class="rv-meta">
          <el-tag size="small" type="info" v-if="meta.engine_version">引擎 {{ meta.engine_version }}</el-tag>
          <el-tag size="small" type="info" v-if="meta.task_id">任务 {{ meta.task_id }}</el-tag>
        </div>
      </div>

      <!-- 因子分布快照 -->
      <div class="rv-section" v-if="distribution">
        <h4 class="rv-title">因子分布快照</h4>
        <el-table :data="distributionRows" size="small" border>
          <el-table-column prop="label" label="统计量" width="120" />
          <el-table-column prop="value" label="数值" />
        </el-table>
      </div>

      <!-- 考核组指标 -->
      <div class="rv-section" v-if="assessmentMetricRows.length">
        <h4 class="rv-title">考核组指标（第 {{ assessmentGroup }} 组）</h4>
        <el-table :data="assessmentMetricRows" size="small" border stripe>
          <el-table-column prop="label" label="指标" width="160" />
          <el-table-column prop="value" label="数值" />
        </el-table>
      </div>
    </template>

    <!-- ============ admission 模式 ============ -->
    <template v-else-if="mode === 'admission'">
      <!-- 结论横幅 -->
      <div class="rv-section" v-if="conclusion">
        <div class="rv-conclusion" :class="conclusionClass">
          <span class="rv-conclusion-result">{{ conclusion.result || '—' }}</span>
          <el-tag v-if="conclusion.tier != null" size="small" type="success">第 {{ conclusion.tier }} 档</el-tag>
        </div>
      </div>

      <!-- checks 逐条 -->
      <div class="rv-section" v-if="checks.length">
        <h4 class="rv-title">审核项</h4>
        <el-table :data="checks" size="small" border stripe>
          <el-table-column prop="item" label="项目" width="180" />
          <el-table-column prop="threshold" label="阈值" width="140" />
          <el-table-column label="实际值" width="120">
            <template #default="{ row }">{{ row.value == null ? '—' : formatNum(row.value, 4) }}</template>
          </el-table-column>
          <el-table-column label="结果" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.pass === true ? 'success' : row.pass === false ? 'danger' : 'info'">
                {{ row.pass === true ? '通过' : row.pass === false ? '未通过' : '未执行' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注">
            <template #default="{ row }">{{ row.note || '' }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- CNE6 相关性表 -->
      <div class="rv-section" v-if="cne6Rows.length">
        <h4 class="rv-title">CNE6 风格相关性（阈值 {{ cne6Threshold ?? '—' }}）</h4>
        <el-table :data="cne6Rows" size="small" border stripe>
          <el-table-column prop="factor" label="风格因子" width="180" />
          <el-table-column label="Pearson 均值" width="160">
            <template #default="{ row }">{{ formatNum(row.pearson_mean, 4) }}</template>
          </el-table-column>
          <el-table-column label="超阈值">
            <template #default="{ row }">
              <el-tag size="small" :type="row.exceeds_threshold ? 'danger' : 'success'">
                {{ row.exceeds_threshold ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- ============ 图表区（两种模式共用动态渲染）============ -->
    <div class="rv-section" v-if="chartSpecs.length">
      <h4 class="rv-title">图表分析</h4>
      <div
        v-for="(spec, i) in chartSpecs"
        :key="spec.id"
        class="rv-chart-block"
      >
        <div class="rv-chart-title" v-if="spec.title">{{ spec.title }}</div>
        <div class="rv-chart-canvas" :ref="el => setChartRef(i, el)"></div>
      </div>
    </div>

    <!-- 警告 -->
    <div class="rv-section" v-if="warnings.length">
      <h4 class="rv-title">提示与警告</h4>
      <el-alert
        v-for="(w, i) in warnings"
        :key="i"
        :title="w"
        type="warning"
        :closable="false"
        show-icon
        class="rv-warning"
      />
    </div>
  </div>

  <el-empty v-else description="暂无 v0.3.1 详细报告数据" :image-size="80" />
</template>

<script setup lang="ts">
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  report: any
  mode: string | null // 'research' | 'admission'
  active?: boolean
}>()

// NaN / 非有限值 → null，供 ECharts connectNulls
const nz = (arr: any): (number | null)[] =>
  Array.isArray(arr) ? arr.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null)) : []

const formatNum = (v: any, digits = 4): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—'

const report = computed<any>(() => props.report ?? null)
const mode = computed<string | null>(() => props.mode ?? null)
const meta = computed<any>(() => report.value?.meta ?? null)
const warnings = computed<string[]>(() => report.value?.warnings ?? [])

// ---------- research ----------
const layers = computed<any>(() => report.value?.layers ?? null)
const icPages = computed<any[]>(() => report.value?.ic_pages ?? [])
const distribution = computed<any>(() => report.value?.factor?.distribution_snapshot ?? null)
const coverageSeries = computed<any>(() => report.value?.factor?.coverage_series ?? null)
const assessmentGroup = computed<number | null>(() => layers.value?.assessment_group ?? null)

const distributionRows = computed(() => {
  const d = distribution.value
  if (!d) return []
  const keys = [
    ['n', 'N'], ['mean', '均值'], ['std', '标准差'], ['min', '最小'],
    ['p25', 'P25'], ['median', '中位数'], ['p75', 'P75'], ['max', '最大']
  ]
  return keys.filter(([k]) => d[k] != null).map(([k, label]) => ({ label, value: formatNum(d[k]) }))
})

const assessmentMetricRows = computed(() => {
  const g = assessmentGroup.value
  const groups = layers.value?.groups
  if (!g || !Array.isArray(groups)) return []
  const m = groups[g - 1]?.metrics
  if (!m) return []
  const keys: [string, string][] = [
    ['interval_return', '区间收益'], ['ann_return', '年化收益'],
    ['interval_excess_return', '区间超额'], ['ann_excess_return', '年化超额'],
    ['excess_sharpe', '超额夏普'], ['ir', 'IR'],
    ['max_drawdown', '最大回撤'], ['excess_max_drawdown', '超额最大回撤'],
    ['ann_volatility', '年化波动'], ['ann_turnover', '年化换手'], ['n_days', '天数']
  ]
  return keys.filter(([k]) => m[k] != null).map(([k, label]) => ({ label, value: formatNum(m[k]) }))
})

// ---------- admission ----------
const conclusion = computed<any>(() => report.value?.conclusion ?? null)
const checks = computed<any[]>(() => conclusion.value?.checks ?? [])
const conclusionClass = computed(() => {
  const r: string = conclusion.value?.result || ''
  if (r.includes('未通过') || r.includes('拒绝')) return 'rv-conclusion-fail'
  if (r.includes('通过')) return 'rv-conclusion-pass'
  return 'rv-conclusion-na'
})
const mainResult = computed<any>(() => report.value?.main_result ?? null)
const cne6Rows = computed<any[]>(() => report.value?.cne6_correlation_page?.rows ?? [])
const cne6Threshold = computed<any>(() => report.value?.cne6_correlation_page?.threshold ?? null)

// ---------- 动态图表规格 ----------
// 每个 spec: { id, title, option }
const chartSpecs = computed<Array<{ id: string; title: string; option: echarts.EChartsOption }>>(() => {
  const specs: Array<{ id: string; title: string; option: echarts.EChartsOption }> = []
  const baseGrid = { left: 48, right: 24, top: 40, bottom: 80, containLabel: true }

  if (mode.value === 'research' && layers.value) {
    const dates = layers.value.dates || []
    const groups = layers.value.groups || []

    // 1. 分层净值曲线
    if (groups.length) {
      const series: any[] = groups.map((g: any) => ({
        name: `第${g.group}组`, type: 'line', showSymbol: false, connectNulls: true, data: nz(g.nav)
      }))
      if (Array.isArray(layers.value.benchmark_nav)) {
        series.push({
          name: '基准', type: 'line', showSymbol: false, connectNulls: true,
          lineStyle: { type: 'dashed' }, data: nz(layers.value.benchmark_nav)
        })
      }
      specs.push({
        id: 'layers-nav',
        title: '分层净值曲线',
        option: {
          tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 }, grid: baseGrid,
          xAxis: { type: 'category', data: dates }, yAxis: { type: 'value', scale: true },
          series
        }
      })
    }

    // 2. 超额净值曲线（考核组）
    const g = assessmentGroup.value
    if (g && groups[g - 1]?.excess_nav_series) {
      specs.push({
        id: 'excess-nav',
        title: `超额净值曲线（第${g}组）`,
        option: {
          tooltip: { trigger: 'axis' }, grid: baseGrid,
          xAxis: { type: 'category', data: dates }, yAxis: { type: 'value', scale: true },
          series: [{ name: '超额净值', type: 'line', showSymbol: false, connectNulls: true, data: nz(groups[g - 1].excess_nav_series) }]
        }
      })
    }

    // 3. IC 多页
    icPages.value.forEach((page: any, idx: number) => {
      specs.push({
        id: `ic-page-${idx}`,
        title: `IC 时序（周期 ${page.period}）`,
        option: {
          tooltip: { trigger: 'axis' }, legend: { data: ['IC', 'Rank IC'], type: 'scroll', bottom: 0 }, grid: baseGrid,
          xAxis: { type: 'category', data: page.dates || [] }, yAxis: { type: 'value' },
          series: [
            { name: 'IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.ic_series) },
            { name: 'Rank IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.rank_ic_series) }
          ]
        }
      })
    })

    // 4. 因子覆盖时序
    if (coverageSeries.value?.dates && coverageSeries.value?.counts) {
      specs.push({
        id: 'coverage',
        title: '因子覆盖数时序',
        option: {
          tooltip: { trigger: 'axis' }, grid: baseGrid,
          xAxis: { type: 'category', data: coverageSeries.value.dates },
          yAxis: { type: 'value' },
          series: [{ name: '覆盖数', type: 'line', showSymbol: false, connectNulls: true, data: nz(coverageSeries.value.counts) }]
        }
      })
    }
  }

  if (mode.value === 'admission' && mainResult.value) {
    // 样本内外净值对比：in / out 各一张
    for (const seg of ['in', 'out'] as const) {
      const s = mainResult.value[seg]
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
        id: `main-${seg}`,
        title: seg === 'in' ? '样本内净值' : '样本外净值',
        option: {
          tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 }, grid: baseGrid,
          xAxis: { type: 'category', data: s.dates }, yAxis: { type: 'value', scale: true }, series
        }
      })
    }
  }

  return specs
})

// ---------- echarts 生命周期（沿用 ReportView 模式）----------
const chartRefs: Record<number, HTMLElement | null> = {}
const chartInstances: Record<number, echarts.ECharts> = {}

const setChartRef = (i: number, el: any) => {
  chartRefs[i] = el as HTMLElement | null
}

const renderCharts = async () => {
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => r(null)))
  chartSpecs.value.forEach((spec, i) => {
    const el = chartRefs[i]
    if (!el || el.clientWidth === 0) return
    let inst = chartInstances[i]
    if (!inst) {
      inst = echarts.init(el)
      chartInstances[i] = inst
    }
    inst.setOption(spec.option, true)
    inst.resize()
  })
}

const disposeCharts = () => {
  Object.values(chartInstances).forEach(inst => inst.dispose())
  Object.keys(chartInstances).forEach(k => delete chartInstances[Number(k)])
}

watch([() => props.report, () => props.mode, () => props.active], ([, , active], [oldReport]) => {
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

<style scoped>
.report-v03 {
  padding: 8px 4px;
}
.rv-section {
  margin-bottom: 20px;
}
.rv-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.rv-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rv-conclusion {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
}
.rv-conclusion-pass {
  background: #f0f9eb;
  color: #529b2e;
}
.rv-conclusion-fail {
  background: #fef0f0;
  color: #c45656;
}
.rv-conclusion-na {
  background: #f4f4f5;
  color: #909399;
}
.rv-chart-block {
  margin-bottom: 16px;
}
.rv-chart-title {
  margin-bottom: 6px;
  font-size: 13px;
  color: #606266;
}
.rv-chart-canvas {
  width: 100%;
  height: 320px;
}
.rv-warning {
  margin-bottom: 8px;
}
</style>
