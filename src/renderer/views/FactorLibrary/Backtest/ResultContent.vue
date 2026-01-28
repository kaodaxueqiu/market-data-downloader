<template>
  <div class="result-content">
    <!-- 没有选中任务时，显示已完成任务列表 -->
    <template v-if="!taskId">
      <!-- 标题 -->
      <div class="section-header">
        <h3>已完成的回测任务</h3>
        <el-button :icon="Refresh" @click="loadCompletedTasks" :loading="listLoading">刷新</el-button>
      </div>

      <!-- 任务卡片列表 -->
      <div class="task-cards" v-loading="listLoading">
        <div 
          v-for="task in completedTasks" 
          :key="task.task_id"
          class="task-card"
          @click="selectTask(task.task_id)"
        >
          <div class="card-header">
            <span class="task-name">{{ task.task_name }}</span>
            <el-tag size="small" effect="plain">{{ getTaskTypeName(task.task_type) }}</el-tag>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <el-icon><Calendar /></el-icon>
              <span>{{ formatDate(task.completed_at) }}</span>
            </div>
            <div class="card-meta">
              <el-icon><Timer /></el-icon>
              <span>耗时 {{ calcDuration(task.started_at, task.completed_at) }}</span>
            </div>
          </div>
          <div class="card-footer">
            <el-button type="primary" size="small" link>
              查看结果 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      
      <el-empty 
        v-if="!listLoading && completedTasks.length === 0" 
        description="暂无已完成的回测任务"
        :image-size="100"
      />
      
      <div class="pagination-wrapper" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, prev, pager, next"
          @size-change="loadCompletedTasks"
          @current-change="loadCompletedTasks"
          background
          small
        />
      </div>
    </template>

    <!-- 选中任务时，显示结果详情 -->
    <template v-else>
      <!-- 返回按钮 & 操作区 -->
      <div class="detail-header">
        <el-button :icon="ArrowLeft" @click="handleBack">返回列表</el-button>
        <div class="header-actions">
          <el-button :icon="Refresh" @click="loadResult" :loading="detailLoading">刷新</el-button>
          <!-- 下载按钮 -->
          <el-dropdown 
            v-if="task?.status === 'completed'" 
            trigger="click" 
            @command="handleDownload"
          >
            <el-button type="primary" :loading="downloading">
              <el-icon><Download /></el-icon>
              <span>下载结果</span>
              <el-icon class="el-icon--right"><ArrowRight /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="csv-summary">
                  <el-icon><Document /></el-icon>
                  汇总数据 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="csv-daily">
                  <el-icon><DataLine /></el-icon>
                  每日明细 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="csv-all">
                  <el-icon><Download /></el-icon>
                  全部数据 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-summary" divided>
                  <el-icon><Document /></el-icon>
                  汇总数据 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-daily">
                  <el-icon><DataLine /></el-icon>
                  每日明细 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-all">
                  <el-icon><Download /></el-icon>
                  全部数据 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <!-- 生成报告按钮 -->
          <el-button 
            v-if="task?.status === 'completed'"
            type="success" 
            :loading="generatingReport"
            @click="handleGenerateReport"
          >
            <el-icon><Tickets /></el-icon>
            <span>生成报告</span>
          </el-button>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="detailLoading && !task" class="loading-wrapper">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <!-- 任务详情 -->
      <template v-else-if="task">
        <!-- 任务信息卡片 -->
        <div class="info-banner">
          <div class="banner-main">
            <div class="banner-top">
              <h2>{{ task.task_name }}</h2>
              <div class="banner-meta">
                <div class="status-badge" :class="task.status">
                  <el-icon v-if="task.status === 'completed'"><CircleCheck /></el-icon>
                  <el-icon v-else-if="task.status === 'running'" class="is-loading"><Loading /></el-icon>
                  {{ getStatusName(task.status) }}
                </div>
                <span class="meta-divider">|</span>
                <span>{{ formatDate(task.created_at) }}</span>
                <span v-if="task.completed_at" class="meta-divider">|</span>
                <span v-if="task.completed_at">耗时 {{ calcDuration(task.started_at, task.completed_at) }}</span>
              </div>
            </div>
            <!-- 回测配置信息 -->
            <div class="banner-config" v-if="task.task_config">
              <div class="config-item">
                <span class="config-label">回测区间</span>
                <span class="config-value">{{ task.task_config.start_date }} ~ {{ task.task_config.end_date }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">股票池</span>
                <span class="config-value">{{ getUniverseName(task.task_config.universe) }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">分组数</span>
                <span class="config-value">{{ task.task_config.backtest_params?.num_groups || 10 }}组</span>
              </div>
              <div class="config-item">
                <span class="config-label">预测周期</span>
                <span class="config-value">{{ task.task_config.backtest_params?.forward_periods?.join('/') || '-' }}日</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.factor_direction">
                <span class="config-label">因子方向</span>
                <span class="config-value">{{ getDirectionName(task.task_config.backtest_params.factor_direction) }}</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.buy_price_type">
                <span class="config-label">买入价格</span>
                <span class="config-value">{{ getBuyPriceTypeName(task.task_config.backtest_params.buy_price_type) }}</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.sell_price_type">
                <span class="config-label">卖出价格</span>
                <span class="config-value">{{ getSellPriceTypeName(task.task_config.backtest_params.sell_price_type) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 失败原因 -->
        <div v-if="task.status === 'failed'" class="error-section">
          <el-alert
            title="任务执行失败"
            type="error"
            :closable="false"
            show-icon
          >
            <template #default>
              <div class="error-content">
                <p v-if="task.error_message">{{ task.error_message }}</p>
                <p v-else>未知错误，请联系管理员</p>
              </div>
            </template>
          </el-alert>
          
          <!-- 因子表达式 -->
          <div class="failed-factor-info" v-if="task.task_config">
            <div class="factor-expression-card" v-if="task.task_config.factor_expression">
              <div class="card-title">因子表达式</div>
              <div class="card-content">
                <code>{{ task.task_config.factor_expression }}</code>
              </div>
            </div>
            <div class="factor-expression-card" v-if="task.task_config.factor_code">
              <div class="card-title">因子代码</div>
              <div class="card-content">
                <pre>{{ task.task_config.factor_code }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 结果展示 -->
        <template v-if="task.status === 'completed' && result">
          <!-- 遍历因子结果 -->
          <div v-for="(factor, index) in result.factor_results" :key="index" class="factor-result-section">
            <!-- 因子标题 -->
            <div class="factor-header">
              <div class="factor-title-row">
                <h3>{{ factor.factor_name || `因子 ${index + 1}` }}</h3>
                <!-- 周期选择器 -->
                <div class="period-selector" v-if="factor.period_ic_stats?.length">
                  <span class="period-label">预测周期</span>
                  <div class="period-tabs">
                    <div 
                      v-for="p in factor.period_ic_stats" 
                      :key="p.period"
                      class="period-tab"
                      :class="{ active: selectedPeriods[index] === p.period }"
                      @click="selectedPeriods[index] = p.period"
                    >
                      {{ p.period }}日
                    </div>
                  </div>
                </div>
              </div>
              <div class="factor-code" v-if="factor.factor_code">
                <code>{{ factor.factor_code }}</code>
              </div>
            </div>

            <!-- 核心指标卡片 -->
            <div class="metrics-cards">
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.ic_mean)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.ic_mean, 4) }}
                </div>
                <div class="metric-label">IC均值</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.ic_std, 4) }}
                </div>
                <div class="metric-label">IC标准差</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.ic_ir)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.ic_ir, 3) }}
                </div>
                <div class="metric-label">IC_IR</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_mean)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_mean, 4) }}
                </div>
                <div class="metric-label">Rank IC</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_ir)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_ir, 3) }}
                </div>
                <div class="metric-label">Rank IC_IR</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.annual_return)">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.annual_return) }}
                </div>
                <div class="metric-label">年化收益</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.sharpe_ratio)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.sharpe_ratio, 2) }}
                </div>
                <div class="metric-label">夏普比率</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value negative">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.max_drawdown) }}
                </div>
                <div class="metric-label">最大回撤</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.win_rate) }}
                </div>
                <div class="metric-label">胜率</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getMonotonicityClass(getCurrentPeriodData(factor, index)?.monotonicity)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.monotonicity, 4) }}
                </div>
                <div class="metric-label">单调性</div>
              </div>
            </div>

            <!-- 详细指标面板 -->
            <div class="detail-panels">
              <!-- 多周期完整指标对比 -->
              <div class="detail-panel" v-if="factor.period_ic_stats?.length">
                <div class="panel-title">
                  <el-icon><TrendCharts /></el-icon>
                  多周期完整指标对比
                </div>
                <div class="panel-body">
                  <el-table 
                    :data="factor.period_ic_stats" 
                    size="small" 
                    stripe
                    :row-class-name="(data: any) => data.row.period === selectedPeriods[index] ? 'selected-row' : ''"
                    @row-click="(row: any) => selectedPeriods[index] = row.period"
                    style="cursor: pointer;"
                  >
                    <el-table-column prop="period" label="周期" width="70" fixed>
                      <template #default="{ row }">
                        <span :class="{ 'period-active': row.period === selectedPeriods[index] }">
                          {{ row.period }}日
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="ic_mean" label="IC均值" width="90">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.ic_mean)">{{ formatNumber(row.ic_mean, 4) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="ic_ir" label="IC_IR" width="80">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.ic_ir)">{{ formatNumber(row.ic_ir, 3) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="rank_ic_mean" label="Rank IC" width="90">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.rank_ic_mean)">{{ formatNumber(row.rank_ic_mean, 4) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="annual_return" label="年化收益" width="90">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.annual_return)">{{ formatPercent(row.annual_return) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="sharpe_ratio" label="夏普" width="70">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.sharpe_ratio)">{{ formatNumber(row.sharpe_ratio, 2) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="max_drawdown" label="最大回撤" width="90">
                      <template #default="{ row }">
                        <span class="negative">{{ formatPercent(row.max_drawdown) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="win_rate" label="胜率" width="70">
                      <template #default="{ row }">{{ formatPercent(row.win_rate) }}</template>
                    </el-table-column>
                    <el-table-column prop="monotonicity" label="单调性" width="80">
                      <template #default="{ row }">
                        <span :class="getMonotonicityClass(row.monotonicity)">{{ formatNumber(row.monotonicity, 2) }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="table-hint">点击行可切换周期，上方指标卡片和分层收益将联动更新</div>
                </div>
              </div>

              <!-- 分层收益 -->
              <div class="detail-panel" v-if="getCurrentPeriodData(factor, index)?.layer_returns?.length">
                <div class="panel-title">
                  <el-icon><Histogram /></el-icon>
                  分层收益 ({{ getCurrentPeriodData(factor, index)?.layer_returns?.length }}组)
                  <span class="period-tag">({{ selectedPeriods[index] }}日)</span>
                </div>
                <div class="panel-body">
                  <div class="layer-returns-chart">
                    <div 
                      v-for="(ret, idx) in getCurrentPeriodData(factor, index)?.layer_returns" 
                      :key="idx"
                      class="layer-bar-wrapper"
                    >
                      <div class="layer-label">组{{ idx + 1 }}</div>
                      <div class="layer-bar-container">
                        <div 
                          class="layer-bar"
                          :class="ret >= 0 ? 'positive' : 'negative'"
                          :style="getBarStyle(ret, getCurrentPeriodData(factor, index)?.layer_returns || [])"
                        ></div>
                      </div>
                      <div class="layer-value" :class="ret >= 0 ? 'positive' : 'negative'">
                        {{ formatPercent(ret) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 其他指标 -->
              <div class="detail-panel">
                <div class="panel-title">
                  <el-icon><DataLine /></el-icon>
                  其他指标 <span class="period-tag" v-if="selectedPeriods[index]">({{ selectedPeriods[index] }}日)</span>
                </div>
                <div class="panel-body">
                  <div class="other-metrics">
                    <div class="other-metric-item ic-related">
                      <span class="label">IC标准差</span>
                      <span class="value">{{ formatNumber(getCurrentPeriodData(factor, index)?.ic_std, 4) }}</span>
                    </div>
                    <div class="other-metric-item ic-related">
                      <span class="label">Rank IC标准差</span>
                      <span class="value">{{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_std, 4) }}</span>
                    </div>
                    <div class="other-metric-item ic-related">
                      <span class="label">Rank IC_IR</span>
                      <span class="value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_ir)">{{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_ir, 3) }}</span>
                    </div>
                    <div class="other-metric-item">
                      <span class="label">年化波动率</span>
                      <span class="value">{{ formatPercent(factor.annual_volatility) }}</span>
                    </div>
                    <div class="other-metric-item">
                      <span class="label">平均换手率</span>
                      <span class="value">{{ formatPercent(factor.turnover_mean) }}</span>
                    </div>
                    <div class="other-metric-item" v-if="dailyMetricsTotal > 0">
                      <span class="label">回测天数</span>
                      <span class="value">{{ dailyMetricsTotal }}天</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- 每日明细（独立区域，只显示一次） -->
          <el-collapse v-if="dailyMetrics.length > 0 || dailyMetricsLoading" class="daily-collapse">
            <el-collapse-item>
              <template #title>
                <div class="collapse-title">
                  <el-icon><Document /></el-icon>
                  每日明细 ({{ dailyMetricsTotal }}条记录)
                  <el-icon v-if="dailyMetricsLoading" class="is-loading" style="margin-left: 8px;"><Loading /></el-icon>
                </div>
              </template>
              <el-table 
                :data="dailyMetrics" 
                size="small" 
                stripe
                max-height="400"
                v-loading="dailyMetricsLoading && dailyMetrics.length === 0"
              >
                <el-table-column prop="date" label="日期" width="110" fixed />
                <el-table-column label="IC" width="90">
                  <template #header>
                    IC ({{ selectedPeriods[0] || '-' }}日)
                  </template>
                  <template #default="{ row }">
                    <span :class="getValueClass(getDailyPeriodIC(row, 0, 'ic'))">
                      {{ formatNumber(getDailyPeriodIC(row, 0, 'ic'), 4) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="Rank IC" width="100">
                  <template #header>
                    Rank IC ({{ selectedPeriods[0] || '-' }}日)
                  </template>
                  <template #default="{ row }">
                    <span :class="getValueClass(getDailyPeriodIC(row, 0, 'rank_ic'))">
                      {{ formatNumber(getDailyPeriodIC(row, 0, 'rank_ic'), 4) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="long_return" label="多头收益" width="100">
                  <template #default="{ row }">
                    <span :class="getValueClass(row.long_return)">{{ formatPercent(row.long_return) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="short_return" label="空头收益" width="100">
                  <template #default="{ row }">
                    <span :class="getValueClass(row.short_return)">{{ formatPercent(row.short_return) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="long_short_return" label="多空收益" width="100">
                  <template #default="{ row }">
                    <span :class="getValueClass(row.long_short_return)">{{ formatPercent(row.long_short_return) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="turnover" label="换手率" width="90">
                  <template #default="{ row }">{{ formatPercent(row.turnover) }}</template>
                </el-table-column>
                <el-table-column prop="num_stocks" label="股票数" width="80" />
              </el-table>
              <div class="daily-metrics-footer">
                <span class="loaded-info">已加载 {{ dailyMetrics.length }} / {{ dailyMetricsTotal }} 条</span>
                <el-button 
                  v-if="dailyMetrics.length < dailyMetricsTotal"
                  size="small"
                  type="primary"
                  link
                  :loading="dailyMetricsLoading"
                  @click="loadMoreDailyMetrics"
                >
                  加载更多
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>

          <el-empty v-if="!result.factor_results?.length" description="暂无回测结果数据" />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  ArrowLeft, ArrowRight, Refresh, Loading, Calendar, Timer, 
  CircleCheck, TrendCharts, Histogram, DataLine, Document, Download, Tickets
} from '@element-plus/icons-vue'

// 声明 electronAPI 类型
declare global {
  interface Window {
    electronAPI: {
      backtest: {
        getTasks: (params?: any) => Promise<any>
        getTaskDetail: (taskId: string) => Promise<any>
        getResult: (taskId: string) => Promise<any>
        getDailyMetrics: (taskId: string, params?: { page?: number; page_size?: number; start_date?: string; end_date?: string }) => Promise<any>
        cancelTask: (taskId: string) => Promise<any>
        getStockPools: () => Promise<any>
      }
    }
  }
}

const props = defineProps<{
  taskId?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const router = useRouter()

// 列表状态
const listLoading = ref(false)
const completedTasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)

// 详情状态
const detailLoading = ref(false)
const task = ref<any>(null)
const result = ref<any>(null)

// 下载状态
const downloading = ref(false)
const generatingReport = ref(false)

// 每日明细数据（独立加载）
const dailyMetrics = ref<any[]>([])
const dailyMetricsLoading = ref(false)
const dailyMetricsTotal = ref(0)
const dailyMetricsPage = ref(1)
const dailyMetricsPageSize = ref(100)

// 每个因子选中的周期
const selectedPeriods = ref<Record<number, number>>({})

// 获取周期选项
const getPeriodOptions = (factor: any) => {
  if (!factor.period_ic_stats?.length) return []
  return factor.period_ic_stats.map((p: any) => ({
    label: `${p.period}日`,
    value: p.period
  }))
}

// 获取当前选中周期的数据
const getCurrentPeriodData = (factor: any, index: number) => {
  const period = selectedPeriods.value[index]
  if (!period || !factor.period_ic_stats?.length) {
    // 返回默认周期数据（第一个）
    return factor.period_ic_stats?.[0] || null
  }
  return factor.period_ic_stats.find((p: any) => p.period === period) || factor.period_ic_stats[0]
}

// 获取每日明细中指定周期的IC数据
const getDailyPeriodIC = (row: any, index: number, field: 'ic' | 'rank_ic') => {
  const period = selectedPeriods.value[index]
  if (!period || !row.period_ics?.length) {
    return row[field] // 返回默认值
  }
  const periodData = row.period_ics.find((p: any) => p.period === period)
  return periodData ? periodData[field] : row[field]
}

// 初始化周期选择
const initPeriodSelections = () => {
  if (!result.value?.factor_results) return
  result.value.factor_results.forEach((factor: any, index: number) => {
    if (factor.period_ic_stats?.length && !selectedPeriods.value[index]) {
      selectedPeriods.value[index] = factor.period_ic_stats[0].period
    }
  })
}

const getTaskTypeName = (type: string) => {
  const map: Record<string, string> = {
    'single_factor': '单因子',
    'multi_factor': '多因子',
    'factor_compare': '因子对比'
  }
  return map[type] || type
}

const getStatusName = (status: string) => {
  const map: Record<string, string> = {
    'completed': '执行完成',
    'running': '正在执行',
    'pending': '等待执行',
    'failed': '执行失败'
  }
  return map[status] || status
}

const getUniverseName = (universe: any) => {
  if (!universe) return '全市场'
  if (universe.type === 'custom') return '自定义股票池'
  const presetMap: Record<string, string> = {
    'all': '全市场',
    'hs300': '沪深300',
    'zz500': '中证500',
    'zz1000': '中证1000',
    'sz50': '上证50',
    'zz2000': '中证2000'
  }
  return presetMap[universe.preset_name] || universe.preset_name || '全市场'
}

const getDirectionName = (direction: string) => {
  const map: Record<string, string> = {
    'positive': '正向',
    'negative': '负向',
    'auto': '自动'
  }
  return map[direction] || direction
}

const getBuyPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_open': '日线开盘价',
    'vwap_30min': '30分钟VWAP (9:30-10:00)',
    'vwap_60min': '60分钟VWAP (9:30-10:30)'
  }
  return map[type] || type
}

const getSellPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_close': '日线收盘价',
    'daily_vwap': '日线全天VWAP',
    'vwap_30min': '30分钟VWAP (14:30-15:00)',
    'vwap_60min': '60分钟VWAP (14:00-15:00)'
  }
  return map[type] || type
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const calcDuration = (start: string, end: string) => {
  if (!start || !end) return '-'
  const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (duration < 60) return `${duration}秒`
  if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`
  return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`
}

const formatNumber = (num: number | undefined, decimals: number = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return num.toFixed(decimals)
}

const formatPercent = (num: number | undefined) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return (num * 100).toFixed(2) + '%'
}

const getValueClass = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  return value > 0 ? 'positive' : value < 0 ? 'negative' : ''
}

const getMonotonicityClass = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  const abs = Math.abs(value)
  return abs > 0.5 ? 'positive' : abs < 0.3 ? 'negative' : ''
}

const getBarStyle = (value: number, allValues: number[]) => {
  const maxAbs = Math.max(...allValues.map(v => Math.abs(v)))
  if (maxAbs === 0) return { width: '0%' }
  const percent = Math.abs(value) / maxAbs * 100
  return { width: `${Math.min(percent, 100)}%` }
}

const loadCompletedTasks = async () => {
  listLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getTasks({
      page: currentPage.value,
      page_size: pageSize.value,
      status: 'completed'
    })
    
    if (res.success && res.data) {
      completedTasks.value = res.data.tasks || []
      total.value = res.data.total || 0
    } else {
      ElMessage.error(res.error || '获取回测结果失败')
    }
  } catch (error: any) {
    ElMessage.error('获取回测结果失败: ' + error.message)
  } finally {
    listLoading.value = false
  }
}

const selectTask = (taskId: string) => {
  router.push(`/factor-library/backtest/result/${taskId}`)
}

const handleBack = () => {
  emit('back')
}

// 处理下载
const handleDownload = async (command: string) => {
  if (!props.taskId) return
  
  const [format, type] = command.split('-') as ['csv' | 'xlsx', 'summary' | 'daily' | 'all']
  
  // 获取当前选中的周期
  const currentPeriod = selectedPeriods.value[0] || 1
  
  downloading.value = true
  
  try {
    const downloadOptions: { format: 'csv' | 'xlsx'; type: 'summary' | 'daily' | 'all'; period?: number } = { 
      format, 
      type,
      period: currentPeriod  // 所有类型都传递周期参数
    }
    
    const result = await window.electronAPI.backtest.download(props.taskId, downloadOptions)
    
    if (result.success) {
      ElMessage.success(`文件已保存到: ${result.filePath}`)
    } else if (result.error !== '用户取消') {
      ElMessage.error(result.error || '下载失败')
    }
  } catch (error: any) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败: ' + (error.message || '未知错误'))
  } finally {
    downloading.value = false
  }
}

// 生成因子报告（全量多周期报告）
const handleGenerateReport = async () => {
  if (!props.taskId) return
  
  generatingReport.value = true
  
  try {
    // 报告自动包含所有预测周期，无需传递 period 参数
    const result = await window.electronAPI.backtest.report(props.taskId, {})
    
    if (result.success) {
      ElMessage.success(`报告已保存到: ${result.filePath}`)
    } else if (result.error !== '用户取消') {
      ElMessage.error(result.error || '生成报告失败')
    }
  } catch (error: any) {
    console.error('生成报告失败:', error)
    ElMessage.error('生成报告失败: ' + (error.message || '未知错误'))
  } finally {
    generatingReport.value = false
  }
}

const loadResult = async () => {
  if (!props.taskId) return
  
  detailLoading.value = true
  
  try {
    const detailRes = await window.electronAPI.backtest.getTaskDetail(props.taskId)
    
    if (detailRes.success && detailRes.data?.task) {
      task.value = detailRes.data.task
      
      if (task.value.status === 'completed') {
        const resultRes = await window.electronAPI.backtest.getResult(props.taskId)
        if (resultRes.success && resultRes.data) {
          result.value = resultRes.data
          initPeriodSelections()
          // 单独加载每日明细数据
          loadDailyMetrics()
        }
      }
    } else {
      ElMessage.error(detailRes.error || '获取任务详情失败')
    }
  } catch (error: any) {
    ElMessage.error('获取数据失败: ' + error.message)
  } finally {
    detailLoading.value = false
  }
}

// 加载每日明细数据
const loadDailyMetrics = async () => {
  if (!props.taskId) return
  
  dailyMetricsLoading.value = true
  
  try {
    const res = await window.electronAPI.backtest.getDailyMetrics(props.taskId, {
      page: dailyMetricsPage.value,
      page_size: dailyMetricsPageSize.value
    })
    
    if (res.success && res.data) {
      dailyMetrics.value = res.data.metrics || []
      dailyMetricsTotal.value = res.data.total || 0
    }
  } catch (error: any) {
    console.error('加载每日明细失败:', error)
  } finally {
    dailyMetricsLoading.value = false
  }
}

// 加载更多每日明细
const loadMoreDailyMetrics = async () => {
  if (!props.taskId || dailyMetricsLoading.value) return
  if (dailyMetrics.value.length >= dailyMetricsTotal.value) return
  
  dailyMetricsPage.value++
  dailyMetricsLoading.value = true
  
  try {
    const res = await window.electronAPI.backtest.getDailyMetrics(props.taskId, {
      page: dailyMetricsPage.value,
      page_size: dailyMetricsPageSize.value
    })
    
    if (res.success && res.data?.metrics) {
      dailyMetrics.value = [...dailyMetrics.value, ...res.data.metrics]
    }
  } catch (error: any) {
    console.error('加载更多每日明细失败:', error)
  } finally {
    dailyMetricsLoading.value = false
  }
}

watch(() => props.taskId, (newId) => {
  if (newId) {
    // 重置每日明细状态
    dailyMetrics.value = []
    dailyMetricsTotal.value = 0
    dailyMetricsPage.value = 1
    loadResult()
  } else {
    task.value = null
    result.value = null
    dailyMetrics.value = []
    dailyMetricsTotal.value = 0
    dailyMetricsPage.value = 1
    loadCompletedTasks()
  }
}, { immediate: true })

onMounted(() => {
  if (!props.taskId) {
    loadCompletedTasks()
  }
})
</script>

<style scoped lang="scss">
.result-content {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  // 任务卡片列表
  .task-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    
    .task-card {
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.3s;
      
      &:hover {
        border-color: #409eff;
        box-shadow: 0 4px 16px rgba(64, 158, 255, 0.15);
        transform: translateY(-2px);
      }
      
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        
        .task-name {
          font-weight: 600;
          font-size: 14px;
          color: #303133;
          flex: 1;
          margin-right: 8px;
        }
      }
      
      .card-body {
        .card-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #909399;
          margin-bottom: 6px;
          
          .el-icon {
            font-size: 14px;
          }
        }
      }
      
      .card-footer {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
        text-align: right;
      }
    }
  }

  // 详情页
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  
  .loading-wrapper {
    text-align: center;
    padding: 80px;
    color: #909399;
    
    p { margin-top: 16px; }
  }
  
  .error-section {
    margin-bottom: 20px;
    
    .error-content {
      margin-top: 8px;
      
      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #c45656;
        word-break: break-all;
      }
    }
    
    :deep(.el-alert) {
      .el-alert__title {
        font-size: 16px;
        font-weight: 600;
      }
    }
    
    .failed-factor-info {
      margin-top: 20px;
      
      .factor-expression-card {
        background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
        border: none;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 16px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        
        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #303133;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          
          &::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 18px;
            background: linear-gradient(180deg, #409eff 0%, #667eea 100%);
            border-radius: 2px;
          }
        }
        
        .card-content {
          code {
            display: block;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3a 100%);
            border: none;
            border-radius: 8px;
            padding: 20px 24px;
            font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 15px;
            line-height: 1.8;
            color: #e2e8f0;
            word-break: break-all;
            white-space: pre-wrap;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
            letter-spacing: 0.5px;
          }
          
          pre {
            margin: 0;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3a 100%);
            border: none;
            border-radius: 8px;
            padding: 20px 24px;
            font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.8;
            color: #e2e8f0;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 400px;
            overflow-y: auto;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
            
            &::-webkit-scrollbar {
              width: 8px;
            }
            &::-webkit-scrollbar-track {
              background: #2d2d3a;
              border-radius: 4px;
            }
            &::-webkit-scrollbar-thumb {
              background: #4a4a5a;
              border-radius: 4px;
            }
          }
        }
      }
    }
  }
  
  .info-banner {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 24px;
    color: #fff;
    margin-bottom: 24px;
    
    .banner-main {
      .banner-top {
        margin-bottom: 16px;
        
        h2 {
          margin: 0 0 12px 0;
          font-size: 22px;
          font-weight: 600;
        }
      }
      
      .banner-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        opacity: 0.9;
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          font-weight: 500;
          
          &.completed { background: rgba(103, 194, 58, 0.3); }
          &.running { background: rgba(64, 158, 255, 0.3); }
        }
        
        .meta-divider {
          opacity: 0.5;
        }
      }
      
      .banner-config {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        
        .config-item {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .config-label {
            font-size: 13px;
            opacity: 0.7;
          }
          
          .config-value {
            font-size: 14px;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.15);
            padding: 4px 10px;
            border-radius: 4px;
          }
        }
      }
    }
  }

  // 因子结果区域
  .factor-result-section {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    
    .factor-header {
      margin-bottom: 20px;
      
      .factor-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 8px;
        
        h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #303133;
        }
        
        .period-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          
          .period-label {
            font-size: 13px;
            color: #909399;
            font-weight: 500;
          }
          
          .period-tabs {
            display: flex;
            background: #f0f2f5;
            border-radius: 8px;
            padding: 3px;
            
            .period-tab {
              padding: 6px 16px;
              font-size: 13px;
              color: #606266;
              cursor: pointer;
              border-radius: 6px;
              transition: all 0.2s;
              font-weight: 500;
              
              &:hover {
                color: #409eff;
              }
              
              &.active {
                background: #fff;
                color: #409eff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
            }
          }
        }
      }
      
      .factor-code {
        code {
          background: #f5f7fa;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          color: #606266;
          display: inline-block;
          max-width: 100%;
          overflow-x: auto;
          white-space: nowrap;
        }
      }
    }
  }

  // 核心指标卡片
  .metrics-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
    
    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      transition: all 0.3s;
      
      &.ic-metric {
        background: linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%);
        border: 1px solid #d4e8fc;
      }
      
      .metric-value {
        font-size: 20px;
        font-weight: 700;
        font-family: 'Monaco', 'Menlo', monospace;
        color: #303133;
        margin-bottom: 4px;
        
        &.positive { color: #67c23a; }
        &.negative { color: #f56c6c; }
      }
      
      .metric-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  // 详细面板
  .detail-panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
    
    .detail-panel {
      background: #fafafa;
      border-radius: 8px;
      overflow: hidden;
      
      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #f0f2f5;
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        
        .el-icon {
          color: #409eff;
        }
      }
      
      .panel-body {
        padding: 16px;
        
        .table-hint {
          text-align: center;
          font-size: 12px;
          color: #909399;
          margin-top: 8px;
        }
        
        :deep(.selected-row) {
          background-color: #ecf5ff !important;
          
          td {
            background-color: #ecf5ff !important;
          }
        }
        
        .period-active {
          color: #409eff;
          font-weight: 600;
        }
      }
    }
  }

  // 分层收益图表
  .layer-returns-chart {
    .layer-bar-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      
      .layer-label {
        width: 40px;
        font-size: 12px;
        color: #909399;
        text-align: right;
      }
      
      .layer-bar-container {
        flex: 1;
        height: 20px;
        background: #ebeef5;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .layer-bar {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s;
        
        &.positive {
          background: linear-gradient(90deg, #67c23a, #85ce61);
        }
        
        &.negative {
          background: linear-gradient(90deg, #f56c6c, #f89898);
        }
      }
      
      .layer-value {
        width: 70px;
        font-size: 12px;
        font-family: 'Monaco', 'Menlo', monospace;
        text-align: right;
        
        &.positive { color: #67c23a; }
        &.negative { color: #f56c6c; }
      }
    }
  }

  // 其他指标
  .other-metrics {
    .other-metric-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px dashed #e4e7ed;
      
      &:last-child {
        border-bottom: none;
      }
      
      &.ic-related {
        background: #f0f7ff;
        margin: 0 -12px;
        padding: 8px 12px;
        border-radius: 4px;
        border-bottom: none;
        margin-bottom: 4px;
      }
      
      .label {
        font-size: 13px;
        color: #909399;
      }
      
      .value {
        font-size: 14px;
        font-weight: 500;
        font-family: 'Monaco', 'Menlo', monospace;
        color: #303133;
        
        &.positive { color: #67c23a; }
        &.negative { color: #f56c6c; }
      }
    }
  }
  
  .period-tag {
    font-size: 12px;
    font-weight: normal;
    color: #409eff;
  }

  // 每日明细折叠
  .daily-collapse {
    margin-top: 20px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    overflow: hidden;
    
    :deep(.el-collapse-item__header) {
      padding: 0 20px;
      height: 52px;
      background: #fafbfc;
    }
    
    :deep(.el-collapse-item__content) {
      padding: 16px 20px 0;
    }
    
    .collapse-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      
      .el-icon {
        color: #409eff;
      }
    }
    
    .daily-metrics-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      margin: 16px -20px 0;
      background: #f5f7fa;
      border-top: 1px solid #ebeef5;
      
      .loaded-info {
        font-size: 13px;
        color: #909399;
      }
    }
    
    .more-hint {
      text-align: center;
      padding: 12px;
      font-size: 13px;
      color: #909399;
    }
  }
  
  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }
  
  // 全局样式
  .positive { color: #67c23a; }
  .negative { color: #f56c6c; }
}
</style>
