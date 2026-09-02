<template>
  <div class="report-v03" v-if="activeReport">
    <!-- 风险 / 周期 / 年度 三组联合选择器（纵向每组一行，排内可换行）-->
    <div class="rv-neut-tabs">
      <div class="rv-selector-row">
        <span class="rv-selector-label">风险</span>
        <div class="rv-selector-tabs">
          <div
            class="rv-neut-tab"
            :class="{ active: selectedRiskFactor === '' }"
            @click="selectedRiskFactor = ''"
          >原始因子</div>
          <div
            v-for="opt in riskFactorOptions"
            :key="opt.variant"
            class="rv-neut-tab"
            :class="{ active: selectedRiskFactor === opt.variant }"
            @click="selectedRiskFactor = opt.variant"
          >{{ opt.label }}</div>
        </div>
      </div>
      <div class="rv-selector-row" v-if="yearlyPeriods.length">
        <span class="rv-selector-label">周期</span>
        <div class="rv-selector-tabs">
          <div
            v-for="p in yearlyPeriods"
            :key="p"
            class="rv-neut-tab"
            :class="{ active: selectedYearlyPeriod === p }"
            @click="selectedYearlyPeriod = p"
          >周期 {{ p }}</div>
        </div>
      </div>
      <div class="rv-selector-row" v-if="yearlyYears.length">
        <span class="rv-selector-label">年度</span>
        <div class="rv-selector-tabs">
          <div
            class="rv-neut-tab"
            :class="{ active: selectedYearlyYear === '' }"
            @click="selectedYearlyYear = ''"
          >整体</div>
          <div
            v-for="y in yearlyYears"
            :key="y"
            class="rv-neut-tab"
            :class="{ active: selectedYearlyYear === y }"
            @click="selectedYearlyYear = y"
          >{{ y }}</div>
        </div>
      </div>
    </div>

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
        <div class="rv-section-body">
          <el-table :data="distributionRows" size="small" border>
            <el-table-column prop="label" label="统计量" width="120" />
            <el-table-column prop="value" label="数值" />
          </el-table>
        </div>
      </div>

      <!-- 考核组指标 -->
      <div class="rv-section" v-if="assessmentMetricRows.length">
        <h4 class="rv-title">考核组指标（第 {{ assessmentGroup }} 组 · 周期 {{ metricLayer?.period }}）</h4>
        <div class="rv-section-body">
          <div class="rv-metric-controls">
            <div class="rv-control-row" v-if="metricLayer?.groups?.length">
              <span class="rv-ic-label">分组选择：</span>
              <el-radio-group v-model="selectedGroupIdx" size="small">
                <el-radio-button
                  v-for="(g, idx) in metricLayer.groups"
                  :key="idx"
                  :label="g.group"
                >第 {{ g.group }} 组</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          <el-table :data="assessmentMetricRows" size="small" border stripe>
            <el-table-column prop="label" label="指标" width="260" />
            <el-table-column prop="value" label="数值" />
          </el-table>
        </div>
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
      <div class="rv-strip-controls" v-if="mode === 'admission' && allStripFactors.length">
        <el-radio-group v-model="stripSeg" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="in">样本内</el-radio-button>
          <el-radio-button label="out">样本外</el-radio-button>
        </el-radio-group>
        <el-select
          v-model="stripFactors"
          multiple
          collapse-tags
          collapse-tags-tooltip
          size="small"
          placeholder="选择风险因子"
          class="rv-strip-select"
        >
          <el-option v-for="f in allStripFactors" :key="f" :label="f" :value="f" />
        </el-select>
      </div>
      <div class="rv-chart-list">
        <div
          v-for="(spec, i) in chartSpecs"
          :key="spec.id"
          class="rv-chart-block"
        >
          <div class="rv-chart-title" v-if="spec.title">{{ spec.title }}</div>
          <div class="rv-chart-canvas" :ref="el => setChartRef(i, el)"></div>
        </div>
      </div>
    </div>

    <!-- ============ 分年度统计（v0.26.12，来自 summary.report.tables 的 yearly_*）============ -->
    <!-- 风险/周期/年度三组选择器已上移至顶部联合选择器区，本区仅渲染表格 -->
    <div class="rv-section" v-if="yearlyTables.length">
      <h4 class="rv-title">分年度统计（{{ variantLabel(activeVariantKey) }}）</h4>
      <div v-for="tb in filteredYearlyTables" :key="tb.key" class="rv-yearly-block">
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

    <!-- 警告 -->
    <div class="rv-section" v-if="warnings.length">
      <h4 class="rv-title">提示与警告</h4>
      <StageErrors :errors="warnings" />
    </div>
  </div>

  <el-empty v-else description="暂无 v0.3.1 详细报告数据" :image-size="80" />
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import StageErrors from '@/components/StageErrors.vue'

const props = defineProps<{
  report: any
  mode: string | null // 'research' | 'admission'
  active?: boolean
  variants?: any[]  // factor_results 数组，用于提取风险剥离 variant 列表
  variantReports?: Record<string, any>  // summary.variant_reports，key=variant名
}>()

// 风险剥离全局选择器（提前定义：yearlyTables computed 依赖它，且 watch immediate 会立即触发，避免 TDZ）
const selectedRiskFactor = ref('')  // '' = 原始因子（raw），否则为 variant 字符串

// 归一化当前档位：'' → 'raw'，与引擎 variant_reports 的键对齐（v0.26.13）
const activeVariantKey = computed<string>(() => selectedRiskFactor.value || 'raw')

// 当前档位的分年度表：统一从 variant_reports[key].report.tables 取（raw 也在其中，见方案 §3）
// 注意：引擎未往主 report_v03 注入 tables，不能用 activeReport.tables，否则原始因子档取空
const yearlyTables = computed<any[]>(() => {
  const tables = props.variantReports?.[activeVariantKey.value]?.report?.tables
  const list = Array.isArray(tables) ? tables : []
  return list.filter((t: any) => String(t?.key ?? '').startsWith('yearly_'))
})

// 从 key（如 yearly_core_p1 / yearly_layer_excess_p10_b0）解析预测周期数字
const yearlyPeriodOf = (key: any): number | null => {
  const m = String(key ?? '').match(/_p(\d+)/)
  return m ? Number(m[1]) : null
}

// 分年度表涉及的所有预测周期（升序、去重），用于渲染切换按钮组
const yearlyPeriods = computed<number[]>(() => {
  const set = new Set<number>()
  yearlyTables.value.forEach((t: any) => {
    const p = yearlyPeriodOf(t?.key)
    if (p != null) set.add(p)
  })
  return Array.from(set).sort((a, b) => a - b)
})

// 当前选中的分年度周期（默认第一个周期）
const selectedYearlyPeriod = ref<number | null>(null)
watch(yearlyPeriods, (periods) => {
  if (!periods.includes(selectedYearlyPeriod.value as number)) {
    selectedYearlyPeriod.value = periods[0] ?? null
  }
}, { immediate: true })

// 仅显示当前选中周期的分年度表
const filteredYearlyTables = computed<any[]>(() =>
  yearlyTables.value.filter((t: any) => yearlyPeriodOf(t?.key) === selectedYearlyPeriod.value)
)

// 当前周期下涉及的所有年份（取各表第一列「年度」，升序去重）
const yearlyYears = computed<string[]>(() => {
  const set = new Set<string>()
  filteredYearlyTables.value.forEach((t: any) => {
    (t?.rows ?? []).forEach((row: any[]) => {
      const y = row?.[0]
      if (y != null && String(y).trim()) set.add(String(y))
    })
  })
  return Array.from(set).sort()
})

// 当前选中年度：'' = 整体（全部年份），否则为具体年份字符串
const selectedYearlyYear = ref<string>('')

// TableData.rows（string[][]）转 el-table 行对象，并按选中年度过滤（整体则不过滤）
const toTableRows = (tb: any): any[] =>
  (tb?.rows ?? [])
    .filter((row: any[]) => !selectedYearlyYear.value || String(row?.[0]) === selectedYearlyYear.value)
    .map((row: any[]) => {
      const obj: Record<string, any> = {}
      row.forEach((cell, ci) => { obj[String(ci)] = cell })
      return obj
    })

// NaN / 非有限值 → null，供 ECharts connectNulls
const nz = (arr: any): (number | null)[] =>
  Array.isArray(arr) ? arr.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null)) : []

const formatNum = (v: any, digits = 4): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—'

const report = computed<any>(() => props.report ?? null)
const mode = computed<string | null>(() => props.mode ?? null)
const meta = computed<any>(() => activeReport.value?.meta ?? null)
const warnings = computed<any[]>(() => activeReport.value?.warnings ?? [])

// ---------- research ----------
// v0.9.0+ layers 由单对象改为数组（每个预测周期一份）；旧报告仍是单对象，包成单元素数组做兼容
const layerList = computed<any[]>(() => {
  const l = activeReport.value?.layers
  if (!l) return []
  return Array.isArray(l) ? l : [l]
})
// 全局周期 → 在指定数组里按 period 匹配下标（找不到回退 0）。统一 4 处周期切换到顶部全局选择器
const idxByGlobalPeriod = (list: any[]): number => {
  if (selectedYearlyPeriod.value == null) return 0
  const i = list.findIndex((x: any) => Number(x?.period) === Number(selectedYearlyPeriod.value))
  return i >= 0 ? i : 0
}
// 分层周期下标：跟随顶部全局周期
const selectedLayerIdx = computed<number>(() => idxByGlobalPeriod(layerList.value))
const layers = computed<any>(() => layerList.value[selectedLayerIdx.value] ?? null)
// 超额净值周期下标：跟随顶部全局周期
const selectedExcessIdx = computed<number>(() => idxByGlobalPeriod(layerList.value))
const excessLayer = computed<any>(() => layerList.value[selectedExcessIdx.value] ?? null)
// 考核组指标周期下标：跟随顶部全局周期
const selectedMetricIdx = computed<number>(() => idxByGlobalPeriod(layerList.value))
const metricLayer = computed<any>(() => layerList.value[selectedMetricIdx.value] ?? null)
const selectedGroupIdx = ref(1)
const assessmentGroup = computed<number | null>(() => {
  return selectedGroupIdx.value
})
const icPages = computed<any[]>(() => activeReport.value?.ic_pages ?? [])
// IC 周期下标：跟随顶部全局周期
const selectedIcIdx = computed<number>(() => idxByGlobalPeriod(icPages.value))
const selectedNeutIcIdx = ref(0)
const distribution = computed<any>(() => activeReport.value?.factor?.distribution_snapshot ?? null)
const coverageSeries = computed<any>(() => activeReport.value?.factor?.coverage_series ?? null)

// 风险剥离全局选择器
const CNE6_STYLE_LABELS: Record<string, string> = {
  beta: 'Beta', momentum: '动量', size: '市值', earnyild: '盈利收益',
  resvol: '残差波动', growth: '成长', btop: '账面市值比', leverage: '杠杆',
  liquidty: '流动性', midcap: '中市值', divyild: '股息收益', earnqlty: '盈利质量',
  earnvar: '盈利波动', invsqlty: '投资质量', ltrevrsl: '长期反转', profit: '盈利能力',
  analsenti: '分析师情绪', indmom: '行业动量', season: '季节性', strevrsl: '短期反转'
}
// variant → 显示标签
const variantLabel = (v: string): string => {
  if (!v || v === 'raw') return '原始因子'
  if (v.startsWith('neutral_each_')) {
    const key = v.replace('neutral_each_', '')
    return CNE6_STYLE_LABELS[key] ? `剥离${CNE6_STYLE_LABELS[key]}` : `剥离${key}`
  }
  if (v === 'neutral_selected') return '剥离所选'
  if (v === 'neutral_all') return '剥离全部'
  return v
}
// 选项列表：{ label, variant } — 从 factor_results 动态提取
const riskFactorOptions = computed<Array<{ label: string; variant: string }>>(() => {
  const vrs = props.variants ?? []
  return vrs
    .filter((vr: any) => vr?.variant && vr.variant !== 'raw')
    .map((vr: any) => ({ label: variantLabel(vr.variant), variant: vr.variant }))
})
// 当前 report：选中 variant 时用 variantReports[variant].report，否则用原始 report
const activeReport = computed<any>(() => {
  if (selectedRiskFactor.value && props.variantReports?.[selectedRiskFactor.value]?.report) {
    return props.variantReports[selectedRiskFactor.value].report
  }
  return report.value
})

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
  const groups = metricLayer.value?.groups
  if (!g || !Array.isArray(groups)) return []
  const m = groups[g - 1]?.metrics
  if (!m) return []
  const keys: [string, string][] = [
    ['interval_return', '区间收益'], ['ann_return', '年化收益(纯多头几何年化)'],
    ['interval_excess_return', '区间超额'], ['ann_excess_return', '年化超额(纯多头几何年化口径)'],
    ['excess_sharpe', '超额夏普'], ['ir', 'IR'],
    ['max_drawdown', '最大回撤'], ['excess_max_drawdown', '超额最大回撤'],
    ['ann_volatility', '年化波动'], ['ann_turnover', '年化换手'], ['n_days', '天数']
  ]
  return keys.filter(([k]) => m[k] != null).map(([k, label]) => ({ label, value: formatNum(m[k]) }))
})

// ---------- admission ----------
const conclusion = computed<any>(() => activeReport.value?.conclusion ?? null)
const checks = computed<any[]>(() => conclusion.value?.checks ?? [])
const conclusionClass = computed(() => {
  const r: string = conclusion.value?.result || ''
  if (r.includes('未通过') || r.includes('拒绝')) return 'rv-conclusion-fail'
  if (r.includes('通过')) return 'rv-conclusion-pass'
  return 'rv-conclusion-na'
})
const mainResult = computed<any>(() => activeReport.value?.main_result ?? null)
const cne6Rows = computed<any[]>(() => activeReport.value?.cne6_correlation_page?.rows ?? [])
const cne6Threshold = computed<any>(() => activeReport.value?.cne6_correlation_page?.threshold ?? null)
const cne6StripPages = computed<any[]>(() => activeReport.value?.cne6_strip_pages ?? [])

// CNE6 剥离图展示控制：样本切换 + 因子过滤
const allStripFactors = computed<string[]>(() =>
  cne6StripPages.value.map((p: any, i: number) => p.risk_factor || `因子${i + 1}`)
)
const stripSeg = ref<'all' | 'in' | 'out'>('all')
// 选中的因子；空数组视为"全部显示"（避免 immediate watch 的初始化时机问题）
const stripFactors = ref<string[]>([])
const isFactorVisible = (factor: string) =>
  stripFactors.value.length === 0 || stripFactors.value.includes(factor)

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
      const suffix = selectedRiskFactor.value ? ` - ${variantLabel(selectedRiskFactor.value)}` : ''
      specs.push({
        id: 'layers-nav',
        title: `分层净值曲线${suffix}（周期 ${layers.value?.period}）`,
        option: {
          tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 }, grid: baseGrid,
          xAxis: { type: 'category', data: dates }, yAxis: { type: 'value', scale: true },
          series
        }
      })
    }

    // 2. 超额净值曲线（考核组）—— 用独立的 excessLayer，与分层净值互不联动
    const exLayer = excessLayer.value
    const exDates = exLayer?.dates || []
    const exGroups = exLayer?.groups || []
    if (exGroups.length && exGroups.some((g: any) => Array.isArray(g.excess_nav_series))) {
      const excessSeries = exGroups
        .filter((g: any) => Array.isArray(g.excess_nav_series))
        .map((g: any) => ({
          name: `第${g.group}组超额`, type: 'line', showSymbol: false,
          connectNulls: true, data: nz(g.excess_nav_series)
        }))
      const suffix = selectedRiskFactor.value ? ` - ${variantLabel(selectedRiskFactor.value)}` : ''
      specs.push({
        id: 'excess-nav',
        title: `分层超额净值曲线${suffix}（周期 ${exLayer?.period}）`,
        option: {
          tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 },
          grid: baseGrid,
          xAxis: { type: 'category', data: exDates }, yAxis: { type: 'value', scale: true },
          series: excessSeries
        }
      })
    }

    // 3. IC 时序
    const page = icPages.value[selectedIcIdx.value] ?? icPages.value[0]
    if (page) {
      const suffix = selectedRiskFactor.value ? ` - ${variantLabel(selectedRiskFactor.value)}` : ''
      specs.push({
        id: `ic-page-${selectedIcIdx.value}`,
        title: `IC 时序${suffix}（周期 ${page.period}）`,
        option: {
          tooltip: { trigger: 'axis' }, legend: { data: ['IC', 'Rank IC'], type: 'scroll', bottom: 0 }, grid: baseGrid,
          xAxis: { type: 'category', data: page.dates || [] }, yAxis: { type: 'value' },
          series: [
            { name: 'IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.ic_series) },
            { name: 'Rank IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(page.rank_ic_series) }
          ]
        }
      })
    }

    // 4. 残差分层净值曲线
    const neutr = activeReport.value?.neutralization
    if (neutr?.residual_portfolio) {
      const resLayers = neutr.residual_portfolio[selectedLayerIdx.value]
      if (resLayers?.groups?.length) {
        const resSeries = resLayers.groups.map((g: any) => ({
          name: `残差·第${g.group}组`, type: 'line', showSymbol: false,
          connectNulls: true, data: nz(g.nav)
        }))
        specs.push({
          id: 'residual-nav',
          title: `残差分层净值曲线（周期 ${resLayers.period}）`,
          option: {
            tooltip: { trigger: 'axis' }, legend: { type: 'scroll', bottom: 0 },
            grid: baseGrid,
            xAxis: { type: 'category', data: resLayers.dates || [] }, yAxis: { type: 'value', scale: true },
            series: resSeries
          }
        })
      }
    }

    // 5. 残差 IC 时序
    if (neutr?.neutralized_ic_pages?.length) {
      const neutPage = neutr.neutralized_ic_pages[selectedNeutIcIdx.value] ?? neutr.neutralized_ic_pages[0]
      if (neutPage) {
        specs.push({
          id: `neut-ic-page-${selectedNeutIcIdx.value}`,
          title: `残差 IC 时序（周期 ${neutPage.period}）`,
          option: {
            tooltip: { trigger: 'axis' }, legend: { data: ['IC', 'Rank IC'], type: 'scroll', bottom: 0 },
            grid: baseGrid,
            xAxis: { type: 'category', data: neutPage.dates || [] }, yAxis: { type: 'value' },
            series: [
              { name: 'IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(neutPage.ic_series) },
              { name: 'Rank IC', type: 'line', showSymbol: false, connectNulls: true, data: nz(neutPage.rank_ic_series) }
            ]
          }
        })
      }
    }

    // 5. 因子覆盖时序
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

  if (mode.value === 'admission' && cne6StripPages.value.length) {
    cne6StripPages.value.forEach((page: any, idx: number) => {
      const factor = page.risk_factor || `因子${idx + 1}`
      if (!isFactorVisible(factor)) return
      for (const seg of ['in', 'out'] as const) {
        if (stripSeg.value !== 'all' && stripSeg.value !== seg) continue
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
    if (!el) return
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

watch([() => props.report, () => props.mode, () => props.active, selectedRiskFactor], ([, , active], [oldReport]) => {
  if (props.report !== oldReport) disposeCharts()
  if (active !== false) renderCharts()
}, { immediate: true })

// 筛选变化导致图表数量/内容变化时，重新渲染（先清掉旧实例避免错位）
watch(chartSpecs, () => {
  if (props.active !== false) {
    disposeCharts()
    renderCharts()
  }
})

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
  overflow: visible;
}
.rv-section {
  margin-bottom: 20px;
  padding-bottom: 20px;

  &:not(:last-child) {
    border-bottom: 1px dashed #dcdfe6;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background: #dcdfe6;
      border-radius: 50%;
    }
  }
}
.rv-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
/* section 内容缩进 */
.rv-section-body {
  margin-left: 24px;
  padding-left: 16px;
  border-left: 2px solid #ebeef5 !important;
}
.rv-yearly-block {
  margin-bottom: 16px;
}
.rv-yearly-title {
  font-size: 13px;
  color: #606266;
  margin: 8px 0 6px;
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
.rv-chart-list {
  margin-left: 24px;
  padding-left: 16px;
  border-left: 2px solid #ebeef5;
}
.rv-chart-block {
  margin-bottom: 16px;
  padding-bottom: 16px;

  &:not(:last-child) {
    border-bottom: 1px dashed #dcdfe6;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background: #dcdfe6;
      border-radius: 50%;
    }
  }
}
.rv-strip-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.rv-strip-select {
  min-width: 240px;
}
.rv-neut-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.rv-selector-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.rv-selector-label {
  flex: 0 0 auto;
  width: 40px;
  font-size: 13px;
  color: #909399;
  line-height: 30px;
}
.rv-selector-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.rv-neut-tab {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  background: #f4f5f7;
  border: 1px solid transparent;
  border-radius: 16px;
  white-space: nowrap;
  transition: all 0.2s;
}
.rv-neut-tab:hover {
  color: #409eff;
  background: #ecf5ff;
}
.rv-neut-tab.active {
  color: #fff;
  background: #409eff;
  font-weight: 600;
}
.rv-ic-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.rv-metric-controls {
  margin-bottom: 12px;
}
.rv-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}
.rv-ic-label {
  font-size: 13px;
  color: #666;
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
</style>
