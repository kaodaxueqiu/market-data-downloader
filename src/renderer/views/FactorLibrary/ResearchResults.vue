<template>
  <div class="research-results-page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_tasks || 0 }}</div>
        <div class="stat-label">全部任务</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.total_completed || 0 }}</div>
        <div class="stat-label">执行完成</div>
      </div>
      <div class="stat-card researchers">
        <div class="stat-value">{{ researchers.length || 0 }}</div>
        <div class="stat-label">研究员数</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="content-card">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select
          v-model="filters.researcher"
          placeholder="研究员"
          clearable
          style="width: 130px;"
          @change="handleFilterChange"
        >
          <el-option v-for="r in researchers" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select
          v-model="filters.status"
          placeholder="状态"
          clearable
          style="width: 110px;"
          @change="handleFilterChange"
        >
          <el-option label="等待执行" value="pending" />
          <el-option label="正在执行" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="执行失败" value="failed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-select
          v-model="filters.researchMode"
          placeholder="运行类型"
          clearable
          style="width: 120px;"
          @change="handleFilterChange"
        >
          <el-option label="研究" value="research" />
          <el-option label="快速初筛" value="quick" />
          <el-option label="深度研究" value="deep" />
          <el-option label="入库审核" value="admission" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="搜索任务名称/因子ID"
          clearable
          style="width: 180px;"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
      </div>
      <div class="toolbar-right">
        <el-button @click="resetFilters" :disabled="!hasActiveFilters">清除筛选</el-button>
        <el-button :icon="Refresh" @click="loadList" :loading="loading">刷新</el-button>
      </div>
    </div>
    </div>

    <!-- 任务列表 -->
    <div class="content-card table-card">
    <el-table
      :data="tasks"
      v-loading="loading"
      class="modern-table"
      stripe
      size="small"
      :header-cell-style="{
        background: '#f8fafc',
        color: '#64748b',
        fontWeight: 500,
        fontSize: '12px',
        padding: '10px 0',
        textAlign: 'center',
        borderBottom: '1px solid #e2e8f0'
      }"
      :cell-style="{ padding: '8px 10px', color: '#475569', fontSize: '12px' }"
      @sort-change="handleSortChange"
    >
      <el-table-column type="index" label="#" width="55" align="center" />

      <el-table-column prop="task_name" label="任务名称" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="task-name-text">{{ row.task_name }}</span>
        </template>
      </el-table-column>

      <el-table-column label="任务ID" width="100" align="center" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="id-cell" @click="copyText(row.task_id)" title="点击复制">
            {{ row.task_id || '-' }}
          </span>
        </template>
      </el-table-column>

      <el-table-column label="因子ID" width="90" align="center" show-overflow-tooltip>
        <template #default="{ row }">
          <span
            v-if="row.factor_id"
            class="factor-id-link"
            @click="goToFactor(row.factor_id)"
            title="点击跳转到因子库"
          >{{ row.factor_id }}</span>
          <span v-else style="color: #cbd5e1;">-</span>
        </template>
      </el-table-column>

      <el-table-column label="运行类型" align="center" width="112">
        <template #default="{ row }">
          <span :class="['run-mode', row.research_mode]">
            {{ getResearchModeName(row.research_mode) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column label="引擎版本" align="center" width="90">
        <template #default="{ row }">
          <span v-if="row.engine_version" style="color: #94a3b8; font-size: 11px;">v{{ row.engine_version }}</span>
          <span v-else style="color: #cbd5e1;">-</span>
        </template>
      </el-table-column>

      <el-table-column prop="researcher" label="研究员" align="center" />

      <el-table-column prop="universe" label="股票池" align="center" />

      <el-table-column label="5日RankIC" align="center">
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 5))">
            {{ formatRankIc(getPeriodRankIc(row, 5)) }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column label="10日RankIC" align="center">
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 10))">
            {{ formatRankIc(getPeriodRankIc(row, 10)) }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" align="center" min-width="90">
        <template #default="{ row }">
          <div class="status-wrapper">
            <span :class="['status-text', row.status]">
              {{ getStatusName(row.status) }}
            </span>
            <template v-if="row.status === 'running'">
              <div class="progress-info">
                <el-progress
                  :percentage="row.progress || 0"
                  :stroke-width="4"
                  :show-text="false"
                  style="width: 80px;"
                />
                <span class="progress-percent">{{ row.progress || 0 }}%</span>
              </div>
            </template>
            <el-tooltip
              v-else-if="row.status === 'failed' && row.error_message"
              effect="dark"
              placement="top"
              :content="row.error_message"
            >
              <span class="error-brief">
                {{ row.error_message.length > 40 ? row.error_message.slice(0, 40) + '…' : row.error_message }}
              </span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>

      <el-table-column
        prop="completed_at"
        label="运行时间"
        align="center"
        sortable="custom"
        width="135"
      >
        <template #default="{ row }">
          {{ row.completed_at ? formatDate(row.completed_at) : '-' }}
        </template>
      </el-table-column>

      <el-table-column label="操作" min-width="130" align="center">
        <template #default="{ row }">
          <div class="action-cell">
            <button class="action-btn primary" @click="viewDetail(row)">详情</button>
            <button
              v-if="row.status === 'completed'"
              class="action-btn success"
              @click="viewResult(row)"
            >结果</button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && tasks.length === 0"
      description="暂无研究成果数据"
      :image-size="120"
    >
      <template #image>
        <el-icon :size="80" color="#c0c4cc"><Document /></el-icon>
      </template>
    </el-empty>

    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="total > 0">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        @size-change="loadList"
        @current-change="loadList"
      />
    </div>
    </div>

    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详情"
      width="960px"
      :close-on-click-modal="false"
      class="detail-dialog"
    >
      <div v-loading="detailLoading" class="detail-content">
        <template v-if="taskDetail">
          <!-- 基本信息 -->
          <div class="detail-section">
            <div class="section-title">
              <el-icon><Document /></el-icon>
              基本信息
            </div>
            <div class="section-body">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="任务ID">
                  <code>{{ taskDetail.task_id }}</code>
                </el-descriptions-item>
                <el-descriptions-item label="任务名称">{{ taskDetail.task_name }}</el-descriptions-item>
                <el-descriptions-item label="任务类型">{{ getTaskTypeName(taskDetail.task_type) }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="getStatusType(taskDetail.status)" size="small">
                    {{ getStatusName(taskDetail.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="执行人">{{ taskDetail.user_id || currentTask?.researcher || '-' }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatFullDate(taskDetail.created_at) }}</el-descriptions-item>
                <el-descriptions-item label="完成时间" :span="2">{{ formatFullDate(taskDetail.completed_at) || '-' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 阶段错误（结构化 stage_errors 优先） -->
          <div class="detail-section" v-if="taskDetail.stage_errors?.length">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              阶段错误
            </div>
            <div class="section-body">
              <StageErrors :errors="taskDetail.stage_errors" />
            </div>
          </div>

          <!-- 错误信息兜底（无 stage_errors 时） -->
          <div class="detail-section" v-else-if="taskDetail.error_message">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              错误信息
            </div>
            <div class="section-body">
              <el-alert type="error" :title="taskDetail.error_message" :closable="false" show-icon />
            </div>
          </div>

          <!-- 回测配置 -->
          <div class="detail-section" v-if="taskDetail.task_config">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              回测配置
            </div>
            <div class="section-body">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="开始日期">{{ taskDetail.task_config.start_date }}</el-descriptions-item>
                <el-descriptions-item label="结束日期">{{ taskDetail.task_config.end_date }}</el-descriptions-item>
                <el-descriptions-item label="股票池" :span="2">
                  {{ getUniverseDisplay(taskDetail.task_config.universe) }}
                </el-descriptions-item>
                <el-descriptions-item label="比较基准" :span="2" v-if="taskDetail.task_config.backtest_params?.benchmarks?.length">
                  {{ getBenchmarkDisplay(taskDetail.task_config.backtest_params.benchmarks) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 因子配置 -->
          <div class="detail-section" v-if="taskDetail.task_config">
            <div class="section-title">
              <el-icon><DataAnalysis /></el-icon>
              因子配置
            </div>
            <div class="section-body">
              <div v-if="taskDetail.task_config.factor_expression" class="factor-block">
                <div class="factor-label">因子表达式</div>
                <code class="factor-code">{{ taskDetail.task_config.factor_expression }}</code>
              </div>
              <div v-else-if="taskDetail.task_config.factor_code" class="factor-block">
                <div class="factor-label">Python代码</div>
                <pre class="factor-code-block">{{ taskDetail.task_config.factor_code }}</pre>
              </div>
            </div>
          </div>

          <!-- 数据源配置 -->
          <div class="detail-section" v-if="taskDetail.task_config?.data_sources?.length">
            <div class="section-title">
              <el-icon><Connection /></el-icon>
              数据源 ({{ taskDetail.task_config.data_sources.length }})
            </div>
            <div class="section-body">
              <div class="datasource-list">
                <div
                  v-for="(ds, idx) in taskDetail.task_config.data_sources"
                  :key="idx"
                  class="datasource-item"
                >
                  <div class="ds-header">
                    <span class="ds-name">{{ ds.name || ds.table }}</span>
                    <el-tag size="small" type="info">{{ ds.database }}</el-tag>
                  </div>
                  <div class="ds-body">
                    <div class="ds-row">
                      <span class="ds-label">表名:</span>
                      <code>{{ ds.table }}</code>
                    </div>
                    <div class="ds-row">
                      <span class="ds-label">字段:</span>
                      <span class="ds-fields">
                        <el-tag v-for="f in ds.fields" :key="f" size="small" effect="plain">{{ f }}</el-tag>
                      </span>
                    </div>
                    <div class="ds-row">
                      <span class="ds-label">日期字段:</span>
                      <code>{{ ds.date_field }}</code>
                      <span class="ds-label" style="margin-left: 16px;">代码字段:</span>
                      <code>{{ ds.code_field }}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 回测参数 -->
          <div class="detail-section" v-if="taskDetail.task_config?.backtest_params">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              回测参数
            </div>
            <div class="section-body">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="分组数">{{ taskDetail.task_config.backtest_params.num_groups }}</el-descriptions-item>
                <el-descriptions-item label="因子方向">{{ getDirectionName(taskDetail.task_config.backtest_params.factor_direction) }}</el-descriptions-item>
                <el-descriptions-item label="IC 周期">
                  {{ (taskDetail.task_config.backtest_params.ic_periods ?? taskDetail.task_config.backtest_params.forward_periods)?.join(', ') || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="收益周期">
                  {{ (taskDetail.task_config.backtest_params.return_periods ?? taskDetail.task_config.backtest_params.forward_periods)?.join(', ') || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="买入价格" v-if="taskDetail.task_config.backtest_params.buy_price_type">
                  {{ getBuyPriceTypeName(taskDetail.task_config.backtest_params.buy_price_type) }}
                </el-descriptions-item>
                <el-descriptions-item label="卖出价格" v-if="taskDetail.task_config.backtest_params.sell_price_type">
                  {{ getSellPriceTypeName(taskDetail.task_config.backtest_params.sell_price_type) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 错误信息 -->
          <div class="detail-section error" v-if="taskDetail.error_message">
            <div class="section-title">
              <el-icon><Warning /></el-icon>
              错误信息
              <el-button link size="small" @click="copyError(taskDetail.error_message)">复制</el-button>
            </div>
            <div class="section-body">
              <pre class="error-message">{{ taskDetail.error_message }}</pre>
            </div>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="taskDetail?.status === 'completed'"
          type="primary"
          @click="viewResult(currentTask)"
        >
          查看结果
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Refresh, Document, Setting, DataAnalysis, Connection, Warning
} from '@element-plus/icons-vue'
import StageErrors from '@/components/StageErrors.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const stats = ref<any>({})
const researchers = ref<string[]>([])

// 筛选
const filters = ref({
  researcher: '',
  status: '',
  keyword: '',
  researchMode: '',
  dateRange: [] as string[]
})

// 是否有激活的筛选
const hasActiveFilters = computed(() => {
  return filters.value.researcher || filters.value.status || filters.value.keyword ||
    filters.value.researchMode || (filters.value.dateRange && filters.value.dateRange.length > 0)
})

// 分页
const pagination = ref({
  page: 1,
  page_size: 20
})

// 排序
const sort = ref({
  sort_by: 'completed_at',
  sort_order: 'desc'
})

// 详情弹窗
const detailDialogVisible = ref(false)
const detailLoading = ref(false)
const currentTask = ref<any>(null)
const taskDetail = ref<any>(null)

// 加载统计信息
const loadStats = async () => {
  try {
    const res = await window.electronAPI.research.getStats()
    if (res.success) {
      stats.value = res.data || {}
    }
  } catch (error: any) {
    console.error('加载统计信息失败:', error)
  }
}

// 加载研究员列表
const loadResearchers = async () => {
  try {
    const res = await window.electronAPI.research.getResearchers()
    if (res.success) {
      researchers.value = res.researchers || []
    }
  } catch (error: any) {
    console.error('加载研究员列表失败:', error)
  }
}

// 加载任务列表
const loadList = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.research.getList({
      page: pagination.value.page,
      page_size: pagination.value.page_size,
      researcher: filters.value.researcher || undefined,
      status: filters.value.status || undefined,
      keyword: filters.value.keyword || undefined,
      research_mode: filters.value.researchMode || undefined,
      start_date: filters.value.dateRange?.[0] || undefined,
      end_date: filters.value.dateRange?.[1] || undefined,
      sort_by: sort.value.sort_by,
      sort_order: sort.value.sort_order
    })

    if (res.success) {
      tasks.value = res.data?.tasks || res.data?.factors || []
      total.value = res.data?.total || 0
    } else {
      ElMessage.error(res.error || '获取研究成果列表失败')
    }
  } catch (error: any) {
    ElMessage.error('获取研究成果列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 筛选变更
const handleFilterChange = () => {
  pagination.value.page = 1
  loadList()
}

// 重置筛选
const resetFilters = () => {
  filters.value = {
    researcher: '',
    status: '',
    keyword: '',
    researchMode: '',
    dateRange: []
  }
  sort.value = {
    sort_by: 'completed_at',
    sort_order: 'desc'
  }
  pagination.value.page = 1
  loadList()
}

// 排序变更
const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  if (!order) {
    sort.value.sort_by = 'completed_at'
    sort.value.sort_order = 'desc'
  } else {
    sort.value.sort_by = prop
    sort.value.sort_order = order === 'ascending' ? 'asc' : 'desc'
  }
  loadList()
}

// 查看任务详情
const viewDetail = async (row: any) => {
  currentTask.value = row
  detailDialogVisible.value = true
  detailLoading.value = true
  taskDetail.value = null

  try {
    const result = await window.electronAPI.backtest.getTaskDetail(row.task_id)
    if (result.success && result.data?.task) {
      taskDetail.value = result.data.task
    } else {
      ElMessage.error(result.error || '获取任务详情失败')
      detailDialogVisible.value = false
    }
  } catch (error: any) {
    ElMessage.error('获取任务详情失败: ' + error.message)
    detailDialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// 查看回测结果
const viewResult = (row: any) => {
  if (row.status === 'completed' && row.task_id) {
    detailDialogVisible.value = false
    router.push({
      path: `/factor-library/backtest/result/${row.task_id}`,
      query: { from: 'research' }
    })
  }
}

// 点击因子ID跳转到因子库
const goToFactor = (factorId?: string) => {
  if (!factorId) return
  router.push({ path: '/factor-library/my-factors', query: { factorId } })
}

// 获取指定周期的 Rank IC
const getPeriodRankIc = (row: any, period: number): number | null => {
  const periodStats = row.period_ic_stats || row.factor_result?.period_ic_stats
  if (!Array.isArray(periodStats)) return null
  const stat = periodStats.find((p: any) => p.period === period)
  return stat?.rank_ic_mean ?? null
}

const DASH = '—'

// 格式化 Rank IC 显示
const formatRankIc = (value: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return value.toFixed(4)
}

// 根据 Rank IC 值返回样式类
const getRankIcClass = (value: number | null): string => {
  if (value === null || value === undefined) return ''
  if (value > 0.03) return 'rank-ic-good'
  if (value < -0.03) return 'rank-ic-bad'
  return 'rank-ic-neutral'
}

// 获取状态名称
const getStatusName = (status: string) => {
  const map: Record<string, string> = {
    'pending': '等待执行',
    'running': '正在执行',
    'deferred': '排队中',
    'completed': '执行完成',
    'failed': '执行失败',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    'pending': 'warning',
    'running': 'primary',
    'completed': 'success',
    'failed': 'danger',
    'cancelled': 'info'
  }
  return map[status] || 'info'
}

const getTaskTypeName = (type: string) => {
  const map: Record<string, string> = {
    'single_factor': '单因子',
    'multi_factor': '多因子',
    'factor_compare': '因子对比',
    'daily_update': '每日更新'
  }
  return map[type] || type
}

// 运行类型（研究模式）中文名
const getResearchModeName = (mode?: string) => {
  const map: Record<string, string> = {
    'research': '研究',
    'quick': '快速初筛',
    'deep': '深度研究',
    'admission': '入库审核'
  }
  return mode ? (map[mode] || mode) : '-'
}

// 股票池显示
const getUniverseDisplay = (universe: any) => {
  if (!universe) return '-'
  if (universe.type === 'preset') {
    const names: Record<string, string> = {
      'all': '全市场',
      'hs300': '沪深300',
      'zz500': '中证500',
      'zz1000': '中证1000',
      'sz50': '上证50',
      'zz2000': '中证2000'
    }
    return names[universe.preset_name] || universe.preset_name
  }
  return '自定义股票池'
}

// 比较基准显示
const getBenchmarkDisplay = (benchmarks: string[]) => {
  if (!benchmarks?.length) return '-'
  return benchmarks.map(code => {
    const standardMap: Record<string, string> = {
      'sh000001': '上证指数',
      'sh000300': '沪深300',
      'sh000905': '中证500',
      'sh000852': '中证1000',
      'sh000016': '上证50',
      'sz399001': '深证成指',
      'sz399006': '创业板指',
      'sh000688': '科创50',
      'csi2000': '中证2000',
      'SH.000300': '沪深300',
      'SH.000905': '中证500',
      'SH.000852': '中证1000',
      'SH.000688': '科创50'
    }
    if (standardMap[code]) return standardMap[code]
    if (code.includes('_')) {
      const [indexCode, industry] = code.split('_')
      const indexNames: Record<string, string> = {
        'SSE50': '上证50',
        'CSI300': '沪深300',
        'CSI500': '中证500',
        'CSI1000': '中证1000',
        'CSI2000': '中证2000'
      }
      return `${indexNames[indexCode] || indexCode}-${industry}`
    }
    return code
  }).join('、')
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

const formatFullDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 点击复制 ID
const copyText = (text?: string) => {
  if (!text) return
  navigator.clipboard?.writeText(text)
    .then(() => ElMessage.success('已复制'))
    .catch(() => ElMessage.warning('复制失败'))
}

// 复制错误信息
const copyError = (msg: string) => {
  navigator.clipboard?.writeText(msg)
    .then(() => ElMessage.success('已复制'))
    .catch(() => ElMessage.warning('复制失败，请手动选择'))
}

onMounted(() => {
  loadStats()
  loadResearchers()
  loadList()
})
</script>

<style scoped lang="scss">
.research-results-page {
  height: calc(100vh - 60px - 24px - 40px);
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;

  .content-card {
    background: #ffffff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    padding: 8px 20px;
    margin: 10px 10px 0 10px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    :deep(.el-button) {
      border-radius: 10px;
      transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1),
                  box-shadow 0.4s cubic-bezier(0.32, 0.72, 0, 1),
                  border-color 0.2s ease;
      &:hover:not(.is-disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px -8px rgba(15, 23, 42, 0.25);
      }
      &:active:not(.is-disabled) {
        transform: translateY(0) scale(0.98);
      }
    }
    :deep(.el-date-editor),
    :deep(.el-select),
    :deep(.el-input) {
      border-radius: 10px;
    }
  }

  // 统计卡片
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin: 0 10px 0 10px;

    .stat-card {
      position: relative;
      background: linear-gradient(180deg, #ffffff 0%, #fcfdfe 100%);
      border: 1px solid #eef2f7;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -16px rgba(15, 23, 42, 0.12);
      transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                  box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);

      &::after {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      }
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 14px;
        bottom: 14px;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: #cbd5e1;
        transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
      }

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 18px 40px -20px rgba(15, 23, 42, 0.25);
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      &.completed {
        background: linear-gradient(180deg, #ffffff 0%, #f4fdf7 100%);
        &::before { background: #22c55e; }
        .stat-value { color: #16a34a; }
      }
      &.researchers {
        background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
        &::before { background: #3b82f6; }
        .stat-value { color: #2563eb; }
      }
    }
  }
  @media (max-width: 640px) {
    .stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .table-card {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  // 现代表格
  .modern-table {
    border-radius: 0;
    overflow: hidden;
    border: none;
    background: #ffffff;
    flex: 1;

    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }

    :deep(.el-table__header-wrapper) {
      th {
        text-align: center;
        .cell { justify-content: center; }
        &.is-sortable .cell,
        &.is-leaf .cell {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
      }
    }

    :deep(.el-table__row--striped) {
      td {
        background: #f8fafc !important;
      }
    }

    :deep(.el-table__row) {
      td {
        border: none !important;
        border-bottom: 1px solid #f1f5f9 !important;
      }
    }

    :deep(.el-table__body tr:hover > td) {
      background: #eff6ff !important;
    }
  }

  .pagination-wrapper {
    margin-top: 0;
    padding: 8px 16px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #e4e7ed;
    flex-shrink: 0;

    :deep(.el-pagination) {
      --el-pagination-font-size: 12px;
      --el-pagination-button-width: 24px;
      --el-pagination-button-height: 24px;
      --el-pagination-button-color: #606266;
      font-size: 12px;

      .el-pager li,
      .btn-prev,
      .btn-next {
        border-radius: 4px;
        font-size: 12px;
        min-width: 24px;
        height: 24px;
        line-height: 24px;
      }

      .el-pagination__total {
        font-size: 12px;
        line-height: 24px;
      }

      .el-pagination__sizes {
        font-size: 12px;
        .el-select {
          .el-input__inner {
            font-size: 12px;
          }
          .el-input__icon {
            font-size: 12px;
          }
        }
        .el-select__placeholder {
          font-size: 12px;
        }
      }

      .el-select__popper {
        .el-select-dropdown__item {
          font-size: 12px;
          height: 28px;
          line-height: 28px;
        }
      }
    }
  }

  // 任务名称
  .task-name-text {
    font-size: 12px;
    color: #334155;
    font-weight: 500;
  }

  // ID 单元格
  .id-cell {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px;
    color: #64748b;
    cursor: pointer;
    transition: color 0.2s ease;
    &:hover { color: #2563eb; }
  }

  // 因子ID链接
  .factor-id-link {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px;
    color: #3b82f6;
    cursor: pointer;
    transition: color 0.2s ease;
    &:hover { color: #2563eb; text-decoration: underline; }
  }

  // 运行类型标签
  .run-mode {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    background: #f1f5f9;
    color: #64748b;
    &.quick { background: #eff6ff; color: #2563eb; }
    &.deep { background: #f5f3ff; color: #7c3aed; }
    &.admission { background: #fdf4ff; color: #c026d3; }
  }

  // 状态
  .status-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    .status-text {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;

      &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
      }

      &.pending { color: #d97706; background: #fef3c7; }
      &.running { color: #2563eb; background: #dbeafe; &::before { animation: pulse 1.5s infinite; } }
      &.deferred { color: #d97706; background: #fef3c7; }
      &.completed { color: #16a34a; background: #dcfce7; }
      &.failed { color: #dc2626; background: #fee2e2; }
      &.cancelled { color: #64748b; background: #f1f5f9; }
    }

    .progress-info {
      display: flex;
      align-items: center;
      gap: 6px;
      .progress-percent {
        font-size: 11px;
        color: #64748b;
        font-variant-numeric: tabular-nums;
      }
    }

    .error-brief {
      font-size: 11px;
      color: #dc2626;
      cursor: help;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .running-text {
    color: #2563eb;
    font-size: 11px;
  }

  // 操作列
  .action-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .action-btn {
    appearance: none;
    border: 1px solid transparent;
    padding: 3px 11px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    border-radius: 7px;
    cursor: pointer;
    background: #f1f5f9;
    color: #475569;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                background 0.2s ease, color 0.2s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px -4px rgba(15, 23, 42, 0.28);
    }
    &:active { transform: translateY(0) scale(0.97); }
    &.primary { background: #eff6ff; color: #2563eb; &:hover { background: #dbeafe; } }
    &.success { background: #f0fdf4; color: #16a34a; &:hover { background: #dcfce7; } }
  }

  // Rank IC 数值样式
  .rank-ic-good {
    color: #16a34a;
    font-weight: 600;
  }
  .rank-ic-bad {
    color: #dc2626;
    font-weight: 600;
  }
  .rank-ic-neutral {
    color: #64748b;
  }
}

// 详情弹窗（el-dialog teleport 到 body，scoped 选择器无法命中，必须用 :global）
:global(.detail-dialog.el-dialog .el-dialog__body) {
  padding: 0;
  height: 62vh;
  overflow-y: auto;
}

.detail-dialog {
  .detail-content {
    min-height: 200px;

    .detail-section {
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }

      &.error {
        .section-title {
          background: #fef0f0;
          color: #f56c6c;
        }
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: #f5f7fa;
        font-size: 14px;
        font-weight: 600;
        color: #303133;

        .el-icon {
          font-size: 16px;
          color: #409eff;
        }
      }

      .section-body {
        padding: 16px 20px;

        code {
          background: #f5f7fa;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 13px;
          color: #606266;
        }

        .factor-block {
          .factor-label {
            font-size: 13px;
            color: #909399;
            margin-bottom: 8px;
          }

          .factor-code {
            display: block;
            background: #f5f7fa;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 13px;
          }

          .factor-code-block {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 14px;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.6;
            overflow-x: auto;
            max-height: 200px;
            margin: 0;
          }
        }

        .datasource-list {
          display: flex;
          flex-direction: column;
          gap: 12px;

          .datasource-item {
            background: #fafafa;
            border: 1px solid #ebeef5;
            border-radius: 6px;
            overflow: hidden;

            .ds-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 14px;
              background: #f5f7fa;
              border-bottom: 1px solid #ebeef5;

              .ds-name {
                font-weight: 500;
                color: #303133;
              }
            }

            .ds-body {
              padding: 12px 14px;

              .ds-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 8px;

                &:last-child {
                  margin-bottom: 0;
                }

                .ds-label {
                  font-size: 13px;
                  color: #909399;
                }

                .ds-fields {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 4px;
                }
              }
            }
          }
        }

        .error-message {
          background: #fef0f0;
          color: #f56c6c;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          font-family: 'SF Mono', 'Consolas', monospace;
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
