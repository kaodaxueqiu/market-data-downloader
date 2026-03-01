<template>
  <div class="factor-values-section">
    <!-- 标题栏 -->
    <div class="fv-header">
      <div class="fv-title">
        <el-icon><Histogram /></el-icon>
        <h3>因子值明细</h3>
      </div>
      <div class="fv-actions">
        <el-dropdown trigger="click" @command="handleDownload">
          <el-button type="primary" size="small" :loading="downloadLoading">
            <el-icon><Download /></el-icon>
            导出因子值
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="current">导出当天截面数据</el-dropdown-item>
              <el-dropdown-item command="all">导出全量数据</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 日期选择器 -->
    <div class="fv-toolbar">
      <div class="date-selector">
        <span class="toolbar-label">交易日期</span>
        <el-select
          v-model="selectedDate"
          placeholder="选择日期"
          filterable
          :loading="datesLoading"
          @change="onDateChange"
          style="width: 180px;"
        >
          <el-option
            v-for="d in dateList"
            :key="d"
            :label="d"
            :value="d"
          >
            <span>{{ d }}</span>
            <el-tag
              v-if="backtestStartDate && d < backtestStartDate"
              size="small"
              type="warning"
              style="margin-left: 8px;"
            >预热</el-tag>
          </el-option>
        </el-select>
        <el-tag
          v-if="backtestStartDate && selectedDate && selectedDate < backtestStartDate"
          type="warning"
          size="small"
          style="margin-left: 8px;"
        >预热期数据</el-tag>
        <span class="date-count" v-if="totalDates > 0">共 {{ totalDates }} 个交易日</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="datesLoading" class="fv-loading">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载因子值数据...</p>
    </div>

    <template v-else-if="selectedDate">
      <!-- 截面统计卡片 -->
      <div class="fv-stats" v-loading="statsLoading">
        <div class="stat-card">
          <div class="stat-value">{{ stats?.count ?? '-' }}</div>
          <div class="stat-label">股票数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatNum(stats?.mean, 4) }}</div>
          <div class="stat-label">均值</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatNum(stats?.std, 4) }}</div>
          <div class="stat-label">标准差</div>
        </div>
        <div class="stat-card">
          <div class="stat-value negative">{{ formatNum(stats?.min, 4) }}</div>
          <div class="stat-label">最小值</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatNum(stats?.percentiles?.p50, 4) }}</div>
          <div class="stat-label">中位数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value positive">{{ formatNum(stats?.max, 4) }}</div>
          <div class="stat-label">最大值</div>
        </div>
      </div>

      <!-- 分位数详情 -->
      <div class="fv-percentiles" v-if="stats?.percentiles">
        <span class="pct-item">P5: {{ formatNum(stats.percentiles.p5, 4) }}</span>
        <span class="pct-item">P25: {{ formatNum(stats.percentiles.p25, 4) }}</span>
        <span class="pct-item highlight">P50: {{ formatNum(stats.percentiles.p50, 4) }}</span>
        <span class="pct-item">P75: {{ formatNum(stats.percentiles.p75, 4) }}</span>
        <span class="pct-item">P95: {{ formatNum(stats.percentiles.p95, 4) }}</span>
      </div>

      <!-- 因子值分布图 -->
      <div class="fv-chart-wrapper" v-loading="distLoading">
        <div class="chart-title">因子值分布直方图</div>
        <div ref="distChartRef" class="fv-dist-chart"></div>
      </div>

      <!-- 截面排名 / 搜索表格 -->
      <div class="fv-table-section">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <span class="table-title">{{ isSearchMode ? '搜索结果' : '截面排名' }}</span>
            <el-tag v-if="isSearchMode" type="info" size="small" closable @close="clearSearch">
              {{ resolvedStockCode }} · 跨日期
            </el-tag>
          </div>
          <el-input
            v-model="searchStock"
            placeholder="输入股票代码，如 600519 或 SH.600519"
            clearable
            :prefix-icon="Search"
            style="width: 300px;"
            @clear="clearSearch"
            @keyup.enter="handleSearchStock"
          />
        </div>

        <el-table
          :data="records"
          size="small"
          stripe
          v-loading="tableLoading"
          max-height="420"
          @sort-change="handleSortChange"
          :default-sort="{ prop: isSearchMode ? 'trade_date' : 'factor_value', order: isSearchMode ? 'ascending' : 'descending' }"
          :key="isSearchMode ? 'search' : 'cross-section'"
        >
          <el-table-column type="index" label="#" width="60" :index="rankIndex" />
          <el-table-column prop="trade_date" label="日期" width="120" sortable="custom" />
          <el-table-column prop="stock_code" label="股票代码" width="130" sortable="custom">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showStockTimeSeries(row.stock_code)">
                {{ row.stock_code }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="factor_value" label="因子值" sortable="custom">
            <template #default="{ row }">
              <span :class="getValueClass(row.factor_value)">
                {{ formatNum(row.factor_value, 6) }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <div class="table-pagination">
          <el-pagination
            v-model:current-page="tablePage"
            v-model:page-size="tablePageSize"
            :total="tableTotal"
            :page-sizes="[50, 100, 200, 500]"
            layout="total, sizes, prev, pager, next"
            @size-change="loadFactorValues"
            @current-change="loadFactorValues"
            background
            small
          />
        </div>
      </div>
    </template>

    <!-- 股票因子值时序弹窗 -->
    <el-dialog
      v-model="stockDialogVisible"
      :title="`${stockDialogCode} 因子值走势`"
      width="70%"
      destroy-on-close
    >
      <div v-loading="stockTimeSeriesLoading">
        <div ref="stockChartRef" class="stock-ts-chart"></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Histogram, Download, ArrowDown, Loading, Search } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const props = defineProps<{
  taskId: string
}>()

const datesLoading = ref(false)
const statsLoading = ref(false)
const distLoading = ref(false)
const tableLoading = ref(false)
const downloadLoading = ref(false)

const dateList = ref<string[]>([])
const totalDates = ref(0)
const backtestStartDate = ref('')
const selectedDate = ref('')

const stats = ref<any>(null)

const distChartRef = ref<HTMLElement | null>(null)
let distChart: echarts.ECharts | null = null

const records = ref<any[]>([])
const tablePage = ref(1)
const tablePageSize = ref(50)
const tableTotal = ref(0)
const searchStock = ref('')
const tableSortBy = ref('factor_value')
const tableSortOrder = ref('desc')

const stockDialogVisible = ref(false)
const stockDialogCode = ref('')
const stockTimeSeriesLoading = ref(false)
const stockChartRef = ref<HTMLElement | null>(null)
let stockChart: echarts.ECharts | null = null

const formatNum = (num: number | undefined | null, decimals: number = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return num.toFixed(decimals)
}

const getValueClass = (value: number | undefined) => {
  if (value === undefined || value === null) return ''
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

const rankIndex = (index: number) => {
  return (tablePage.value - 1) * tablePageSize.value + index + 1
}

const loadDates = async () => {
  datesLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getFactorValueDates(props.taskId)
    if (res.success && res.data) {
      dateList.value = res.data.dates || []
      totalDates.value = res.data.total || 0
      backtestStartDate.value = res.data.backtest_start_date || ''

      if (dateList.value.length > 0) {
        selectedDate.value = dateList.value[dateList.value.length - 1]
        await loadDateData()
      }
    } else {
      ElMessage.warning(res.error || '暂无因子值数据')
    }
  } catch (e: any) {
    ElMessage.error('加载日期列表失败: ' + e.message)
  } finally {
    datesLoading.value = false
  }
}

const onDateChange = () => {
  tablePage.value = 1
  searchStock.value = ''
  loadDateData()
}

const loadDateData = async () => {
  if (!selectedDate.value) return
  await Promise.all([
    loadStats(),
    loadDistribution(),
    loadFactorValues()
  ])
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getFactorValueStats(props.taskId, selectedDate.value)
    if (res.success && res.data) {
      stats.value = res.data
    }
  } catch (e: any) {
    console.error('加载统计失败:', e)
  } finally {
    statsLoading.value = false
  }
}

const loadDistribution = async () => {
  distLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getFactorValueDistribution(props.taskId, {
      trade_date: selectedDate.value,
      bins: 50
    })
    if (res.success && res.data) {
      await nextTick()
      renderDistChart(res.data.histogram || [])
    }
  } catch (e: any) {
    console.error('加载分布失败:', e)
  } finally {
    distLoading.value = false
  }
}

const renderDistChart = (histogram: Array<{ range_start: number; range_end: number; count: number }>) => {
  if (!distChartRef.value) return
  if (!distChart) {
    distChart = echarts.init(distChartRef.value)
  }

  const xData = histogram.map(h => {
    const mid = ((h.range_start + h.range_end) / 2).toFixed(2)
    return mid
  })
  const yData = histogram.map(h => h.count)

  const mean = stats.value?.mean
  const std = stats.value?.std
  let normalCurve: number[] = []
  if (mean !== undefined && std !== undefined && std > 0) {
    const totalCount = yData.reduce((a, b) => a + b, 0)
    const binWidth = histogram.length > 1 ? histogram[1].range_start - histogram[0].range_start : 1
    normalCurve = histogram.map(h => {
      const x = (h.range_start + h.range_end) / 2
      const z = (x - mean) / std
      const pdf = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
      return Math.round(pdf * totalCount * binWidth)
    })
  }

  const series: any[] = [
    {
      type: 'bar',
      data: yData,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#409EFF' },
          { offset: 1, color: '#79bbff' }
        ]),
        borderRadius: [2, 2, 0, 0]
      },
      barMaxWidth: 30
    }
  ]

  if (normalCurve.length > 0) {
    series.push({
      type: 'line',
      data: normalCurve,
      smooth: true,
      lineStyle: { color: '#E6A23C', width: 2, type: 'dashed' },
      symbol: 'none',
      z: 10
    })
  }

  distChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex
        if (idx === undefined || !histogram[idx]) return ''
        const h = histogram[idx]
        let tip = `区间: [${h.range_start.toFixed(4)}, ${h.range_end.toFixed(4)})<br/>股票数: ${h.count}`
        if (normalCurve.length > 0 && params[1]) {
          tip += `<br/>正态参考: ${params[1].value}`
        }
        return tip
      }
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: 45, fontSize: 10 },
      name: '因子值'
    },
    yAxis: {
      type: 'value',
      name: '股票数'
    },
    series
  }, true)
}

const isSearchMode = ref(false)
const resolvedStockCode = ref('')

const normalizeStockCode = (input: string): string => {
  const s = input.trim().toUpperCase()
  if (s.includes('.')) return s
  if (/^\d{6}$/.test(s)) {
    if (s.startsWith('6')) return `SH.${s}`
    if (s.startsWith('0') || s.startsWith('3')) return `SZ.${s}`
    if (s.startsWith('4') || s.startsWith('8')) return `BJ.${s}`
  }
  return s
}

const loadFactorValues = async () => {
  tableLoading.value = true
  try {
    const params: any = {
      sort_by: tableSortBy.value,
      sort_order: tableSortOrder.value,
      page: tablePage.value,
      page_size: tablePageSize.value
    }

    if (isSearchMode.value && resolvedStockCode.value) {
      params.stock_code = resolvedStockCode.value
    } else {
      params.trade_date = selectedDate.value
    }

    const res = await window.electronAPI.backtest.getFactorValues(props.taskId, params)
    if (res.success && res.data) {
      records.value = res.data.records || []
      tableTotal.value = res.data.total || 0
    }
  } catch (e: any) {
    console.error('加载因子值失败:', e)
  } finally {
    tableLoading.value = false
  }
}

const handleSearchStock = () => {
  const keyword = searchStock.value.trim()
  if (!keyword) {
    clearSearch()
    return
  }
  resolvedStockCode.value = normalizeStockCode(keyword)
  isSearchMode.value = true
  tablePage.value = 1
  tableSortBy.value = 'trade_date'
  tableSortOrder.value = 'asc'
  loadFactorValues()
}

const clearSearch = () => {
  searchStock.value = ''
  isSearchMode.value = false
  tablePage.value = 1
  tableSortBy.value = 'factor_value'
  tableSortOrder.value = 'desc'
  loadFactorValues()
}

const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  if (prop) {
    tableSortBy.value = prop
    tableSortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    tableSortBy.value = 'factor_value'
    tableSortOrder.value = 'desc'
  }
  tablePage.value = 1
  loadFactorValues()
}

const showStockTimeSeries = async (stockCode: string) => {
  stockDialogCode.value = stockCode
  stockDialogVisible.value = true
  stockTimeSeriesLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getFactorValues(props.taskId, {
      stock_code: stockCode,
      sort_by: 'trade_date',
      sort_order: 'asc',
      page_size: 500
    })
    if (res.success && res.data) {
      await nextTick()
      renderStockChart(res.data.records || [], stockCode)
    }
  } catch (e: any) {
    ElMessage.error('加载时序数据失败')
  } finally {
    stockTimeSeriesLoading.value = false
  }
}

const renderStockChart = (data: Array<{ trade_date: string; factor_value: number }>, stockCode: string) => {
  if (!stockChartRef.value) return
  if (!stockChart) {
    stockChart = echarts.init(stockChartRef.value)
  }

  const dates = data.map(d => d.trade_date)
  const values = data.map(d => d.factor_value)

  const markLineData: any[] = []
  if (backtestStartDate.value) {
    markLineData.push({
      xAxis: backtestStartDate.value,
      label: { formatter: '回测开始', position: 'end' },
      lineStyle: { color: '#E6A23C', type: 'dashed' }
    })
  }

  stockChart.setOption({
    title: {
      text: `${stockCode} 因子值走势`,
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>因子值: ${p.value?.toFixed(6) ?? '-'}`
      }
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 30, fontSize: 10 }
    },
    yAxis: { type: 'value', name: '因子值', scale: true },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      lineStyle: { width: 2, color: '#409EFF' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.3)' },
          { offset: 1, color: 'rgba(64,158,255,0.02)' }
        ])
      },
      symbol: 'none',
      markLine: markLineData.length > 0 ? { data: markLineData, silent: true } : undefined
    }],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 20, bottom: 5 }
    ]
  }, true)
}

const handleDownload = async (cmd: string) => {
  downloadLoading.value = true
  try {
    const tradeDate = cmd === 'current' ? selectedDate.value : undefined
    const res = await window.electronAPI.backtest.downloadFactorValues(props.taskId, tradeDate)
    if (res.success) {
      ElMessage.success('导出成功: ' + res.filePath)
    } else if (res.error !== '用户取消') {
      ElMessage.error(res.error || '导出失败')
    }
  } catch (e: any) {
    ElMessage.error('导出失败: ' + e.message)
  } finally {
    downloadLoading.value = false
  }
}

const handleResize = () => {
  distChart?.resize()
  stockChart?.resize()
}

watch(() => props.taskId, (newId) => {
  if (newId) {
    loadDates()
  }
})

onMounted(() => {
  loadDates()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  distChart?.dispose()
  stockChart?.dispose()
  distChart = null
  stockChart = null
})
</script>

<style scoped lang="scss">
.factor-values-section {
  margin-top: 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  padding: 20px;

  .fv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .fv-title {
      display: flex;
      align-items: center;
      gap: 8px;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .fv-toolbar {
    margin-bottom: 16px;

    .date-selector {
      display: flex;
      align-items: center;
      gap: 12px;

      .toolbar-label {
        font-size: 13px;
        color: #606266;
        white-space: nowrap;
      }

      .date-count {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .fv-loading {
    text-align: center;
    padding: 40px;

    p {
      margin-top: 12px;
      color: #909399;
    }
  }

  .fv-stats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
    margin-bottom: 12px;

    .stat-card {
      background: #f5f7fa;
      border-radius: 8px;
      padding: 14px 16px;
      text-align: center;

      .stat-value {
        font-size: 18px;
        font-weight: 600;
        font-family: 'Monaco', 'Menlo', monospace;
        margin-bottom: 4px;

        &.positive { color: #67c23a; }
        &.negative { color: #f56c6c; }
      }

      .stat-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .fv-percentiles {
    display: flex;
    gap: 20px;
    padding: 8px 16px;
    background: #fafafa;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 13px;

    .pct-item {
      color: #606266;
      font-family: 'Monaco', 'Menlo', monospace;

      &.highlight {
        font-weight: 600;
        color: #409eff;
      }
    }
  }

  .fv-chart-wrapper {
    margin-bottom: 20px;

    .chart-title {
      font-size: 13px;
      font-weight: 500;
      color: #606266;
      margin-bottom: 8px;
    }

    .fv-dist-chart {
      width: 100%;
      height: 300px;
    }
  }

  .fv-table-section {
    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .table-title {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }
    }

    .table-pagination {
      margin-top: 12px;
      display: flex;
      justify-content: flex-end;
    }

    .positive { color: #67c23a; }
    .negative { color: #f56c6c; }
  }

  .stock-ts-chart {
    width: 100%;
    height: 400px;
  }
}
</style>
