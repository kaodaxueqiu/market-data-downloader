<template>
  <div class="tasks-content">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 240px;"
          @change="handleFilterChange"
          clearable
        />
      </div>
      <div class="toolbar-right">
        <el-button @click="clearAllFilters" :disabled="!hasActiveFilters">
          清除筛选
        </el-button>
        <el-button :icon="Refresh" @click="loadTasks" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">全部任务</div>
      </div>
      <div class="stat-card running">
        <div class="stat-value">{{ stats.running }}</div>
        <div class="stat-label">正在执行</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">执行完成</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-label">执行失败</div>
      </div>
    </div>

    <!-- 任务列表 - 现代风格 -->
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
        borderBottom: '1px solid #e2e8f0'
      }"
      :cell-style="{ padding: '8px 10px', color: '#475569', fontSize: '12px' }"
      @sort-change="handleTableSortChange"
      @filter-change="handleTableFilterChange"
    >
      <el-table-column type="index" label="#" width="55" align="center" />
      
      <el-table-column 
        label="任务名称" 
        prop="task_name"
        column-key="task_type"
        :filters="taskTypeFilters"
        :filter-multiple="false"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <el-link 
            :type="row.status === 'completed' ? 'primary' : 'default'"
            :underline="false"
            @click="handleViewResult(row)"
            :disabled="row.status !== 'completed'"
            class="task-link"
          >
            {{ row.task_name }}
          </el-link>
        </template>
      </el-table-column>
      
      <el-table-column label="执行人" align="center">
        <template #default="{ row }">
          {{ row.user_id || '-' }}
        </template>
      </el-table-column>
      
      <el-table-column 
        label="状态" 
        align="center"
        column-key="status"
        :filters="statusFilters"
        :filter-multiple="false"
        min-width="140"
      >
        <template #default="{ row }">
          <div class="status-wrapper">
            <span :class="['status-text', row.status]">
              {{ getStatusName(row.status) }}
            </span>
            <!-- 运行中显示详细进度 -->
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
              <div class="stage-info" v-if="row.current_stage">
                {{ getStageName(row.current_stage) }}
              </div>
            </template>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="5日RankIC" 
        align="center"
        prop="rank_ic_5"
        sortable="custom"
      >
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 5))">
            {{ formatRankIc(getPeriodRankIc(row, 5)) }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="10日RankIC" 
        align="center"
        prop="rank_ic_10"
        sortable="custom"
      >
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 10))">
            {{ formatRankIc(getPeriodRankIc(row, 10)) }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="创建时间" 
        align="center"
        prop="created_at"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      
      <el-table-column label="耗时" align="center">
        <template #default="{ row }">
          <span v-if="row.completed_at">{{ calcDuration(row.started_at, row.completed_at) }}</span>
          <span v-else-if="row.status === 'running'" class="running-text">运行中</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" min-width="90" align="center">
        <template #default="{ row }">
          <span style="display: inline-flex; gap: 12px; white-space: nowrap; font-size: 12px;">
            <el-link type="primary" @click="viewTaskDetail(row)" :underline="false">详情</el-link>
            <el-link 
              v-if="row.status === 'completed'" 
              type="success" 
              @click="handleViewResult(row)"
              :underline="false"
            >结果</el-link>
            <el-link 
              v-if="row.status === 'pending'" 
              type="danger" 
              @click="cancelTask(row)"
              :underline="false"
            >取消</el-link>
            <el-link 
              v-if="row.status === 'failed'" 
              type="warning" 
              @click="viewError(row)"
              :underline="false"
            >错误</el-link>
          </span>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 空状态 -->
    <el-empty 
      v-if="!loading && tasks.length === 0" 
      description="暂无回测任务"
      :image-size="120"
    >
      <template #image>
        <el-icon :size="80" color="#c0c4cc"><Document /></el-icon>
      </template>
    </el-empty>
    
    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="total > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
        background
      />
    </div>
    
    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详情"
      width="700px"
      :close-on-click-modal="false"
      class="task-detail-dialog"
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
                <el-descriptions-item label="执行人">{{ taskDetail.user_id || '-' }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatFullDate(taskDetail.created_at) }}</el-descriptions-item>
                <el-descriptions-item label="完成时间" :span="2">{{ formatFullDate(taskDetail.completed_at) || '-' }}</el-descriptions-item>
              </el-descriptions>
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
                <el-descriptions-item label="预测周期">
                  {{ taskDetail.task_config.backtest_params.forward_periods?.join(', ') || '-' }}
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
            </div>
            <div class="section-body">
              <div class="error-message">{{ taskDetail.error_message }}</div>
            </div>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Refresh, Document, Setting, DataAnalysis, Connection, Warning
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'view-result', taskId: string): void
}>()

const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const filterTaskType = ref('')
const filterDateRange = ref<[string, string] | null>(null)
const sortField = ref('created_at')
const sortOrder = ref<'asc' | 'desc'>('desc')

// 表头筛选配置
const statusFilters = [
  { text: '等待执行', value: 'pending' },
  { text: '正在执行', value: 'running' },
  { text: '执行完成', value: 'completed' },
  { text: '执行失败', value: 'failed' },
  { text: '已取消', value: 'cancelled' }
]

const taskTypeFilters = [
  { text: '单因子', value: 'single_factor' },
  { text: '多因子', value: 'multi_factor' },
  { text: '因子对比', value: 'factor_compare' }
]

// 是否有激活的筛选
const hasActiveFilters = computed(() => {
  return filterStatus.value || filterTaskType.value || filterDateRange.value
})

// 详情弹窗
const detailDialogVisible = ref(false)
const detailLoading = ref(false)
const taskDetail = ref<any>(null)

let pollTimer: number | null = null

// 统计数据（从后端获取真实数量）
const statsData = ref({
  total: 0,
  running: 0,
  completed: 0,
  failed: 0
})

const stats = computed(() => statsData.value)

// 加载各状态的统计数据
const loadStats = async () => {
  try {
    // 并行请求各状态的数量（只请求 page_size=1 来获取 total）
    const [allRes, runningRes, pendingRes, completedRes, failedRes] = await Promise.all([
      window.electronAPI.backtest.getTasks({ page: 1, page_size: 1 }),
      window.electronAPI.backtest.getTasks({ page: 1, page_size: 1, status: 'running' }),
      window.electronAPI.backtest.getTasks({ page: 1, page_size: 1, status: 'pending' }),
      window.electronAPI.backtest.getTasks({ page: 1, page_size: 1, status: 'completed' }),
      window.electronAPI.backtest.getTasks({ page: 1, page_size: 1, status: 'failed' })
    ])
    
    statsData.value = {
      total: allRes.success ? allRes.data.total : 0,
      running: (runningRes.success ? runningRes.data.total : 0) + (pendingRes.success ? pendingRes.data.total : 0),
      completed: completedRes.success ? completedRes.data.total : 0,
      failed: failedRes.success ? failedRes.data.total : 0
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
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

const getStatusName = (status: string) => {
  const map: Record<string, string> = {
    'pending': '等待执行',
    'running': '正在执行',
    'completed': '执行完成',
    'failed': '执行失败',
    'cancelled': '已取消'
  }
  return map[status] || status
}

// 获取指定周期的 Rank IC
const getPeriodRankIc = (row: any, period: number): number | null => {
  // 优先从 period_ic_stats 取，兼容 factor_result.period_ic_stats
  const periodStats = row.period_ic_stats || row.factor_result?.period_ic_stats
  if (!Array.isArray(periodStats)) return null
  const stat = periodStats.find((p: any) => p.period === period)
  return stat?.rank_ic_mean ?? null
}

// 格式化 Rank IC 显示
const formatRankIc = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  return value.toFixed(4)
}

// 根据 Rank IC 值返回样式类
const getRankIcClass = (value: number | null): string => {
  if (value === null || value === undefined) return ''
  if (value > 0.03) return 'rank-ic-good'
  if (value < -0.03) return 'rank-ic-bad'
  return 'rank-ic-neutral'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const calcDuration = (start: string, end: string) => {
  if (!start || !end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '-'
  if (ms < 1000) return `${ms}毫秒`
  const duration = Math.floor(ms / 1000)
  if (duration < 60) return `${duration}秒`
  if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`
  return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`
}

// 获取阶段名称
const getStageName = (stage: string) => {
  const map: Record<string, string> = {
    'data_loading': '数据加载',
    'factor_calc': '因子计算',
    'backtest_analysis': '回测分析',
    'result_submission': '结果提交'
  }
  return map[stage] || stage
}

// 筛选变更处理
const handleFilterChange = () => {
  currentPage.value = 1
  loadTasks()
}

// 清除所有筛选
const clearAllFilters = () => {
  filterStatus.value = ''
  filterTaskType.value = ''
  filterDateRange.value = null
  sortField.value = 'created_at'
  sortOrder.value = 'desc'
  currentPage.value = 1
  loadTasks()
}

// 表格排序事件处理
const handleTableSortChange = ({ prop, order }: { prop: string, order: string | null }) => {
  if (!order) {
    // 取消排序，恢复默认
    sortField.value = 'created_at'
    sortOrder.value = 'desc'
  } else {
    sortField.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  loadTasks()
}

// 表格筛选事件处理
const handleTableFilterChange = (filters: Record<string, string[]>) => {
  if (filters.status) {
    filterStatus.value = filters.status[0] || ''
  }
  if (filters.task_type) {
    filterTaskType.value = filters.task_type[0] || ''
  }
  currentPage.value = 1
  loadTasks()
}

const loadTasks = async () => {
  loading.value = true
  try {
    // 构建请求参数
    const params: any = {
      page: currentPage.value,
      page_size: pageSize.value,
      status: filterStatus.value || undefined,
      task_type: filterTaskType.value || undefined,
      sort_field: sortField.value || undefined,
      sort_order: sortOrder.value || undefined
    }
    
    // 日期范围筛选
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      params.start_date = filterDateRange.value[0]
      params.end_date = filterDateRange.value[1]
    }
    
    // 并行加载任务列表和统计数据
    const [result] = await Promise.all([
      window.electronAPI.backtest.getTasks(params),
      loadStats()
    ])
    
    if (result.success && result.data) {
      tasks.value = result.data.tasks || []
      total.value = result.data.total || 0
      
      const hasRunning = tasks.value.some(t => t.status === 'running' || t.status === 'pending')
      hasRunning ? startPolling() : stopPolling()
    } else {
      ElMessage.error(result.error || '获取任务列表失败')
    }
  } catch (error: any) {
    ElMessage.error('获取任务列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(() => loadTasks(), 5000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 分页变化处理
const handlePageChange = () => {
  loadTasks()
}

// 每页数量变化处理
const handlePageSizeChange = () => {
  currentPage.value = 1
  loadTasks()
}

const handleViewResult = (task: any) => {
  if (task.status === 'completed') {
    emit('view-result', task.task_id)
  }
}

const cancelTask = async (task: any) => {
  try {
    await ElMessageBox.confirm(`确定要取消任务「${task.task_name}」吗？`, '确认取消', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const result = await window.electronAPI.backtest.cancelTask(task.task_id)
    
    if (result.success) {
      ElMessage.success('任务已取消')
      loadTasks()
    } else {
      ElMessage.error(result.error || '取消失败')
    }
  } catch (e) {}
}

const viewError = async (task: any) => {
  try {
    const result = await window.electronAPI.backtest.getTaskDetail(task.task_id)
    
    if (result.success && result.data?.task) {
      ElMessageBox.alert(result.data.task.error_message || '未知错误', '错误信息', {
        confirmButtonText: '确定',
        type: 'error'
      })
    } else {
      ElMessage.error('获取错误信息失败')
    }
  } catch (error: any) {
    ElMessage.error('获取错误信息失败: ' + error.message)
  }
}

// 查看任务详情
const viewTaskDetail = async (task: any) => {
  detailDialogVisible.value = true
  detailLoading.value = true
  taskDetail.value = null
  
  try {
    const result = await window.electronAPI.backtest.getTaskDetail(task.task_id)
    
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

// 格式化完整日期
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

// 获取状态类型
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

// 股票池和基准缓存
const stockPoolCache = ref<Map<string, string>>(new Map())
const benchmarkCache = ref<Map<string, string>>(new Map())

// 加载股票池映射
const loadStockPoolMapping = async () => {
  try {
    const result = await window.electronAPI.backtest.getStockPools()
    if (result.success && result.data) {
      const cache = new Map<string, string>()
      const data = result.data as any
      if (data.index?.pools) {
        data.index.pools.forEach((p: any) => cache.set(p.id, p.name))
      }
      if (data.industry?.pools) {
        data.industry.pools.forEach((p: any) => cache.set(p.id, `申万-${p.name}`))
      }
      if (data.citic?.pools) {
        data.citic.pools.forEach((p: any) => cache.set(p.id, `中信-${p.name}`))
      }
      if (Array.isArray(data)) {
        data.forEach((p: any) => cache.set(p.id, p.name))
      }
      stockPoolCache.value = cache
    }
  } catch (error) {
    console.error('加载股票池映射失败:', error)
  }
}

// 加载基准映射
const loadBenchmarkMapping = async () => {
  try {
    const result = await window.electronAPI.backtest.getPriceTypeOptions()
    if (result.success && result.data?.benchmarks) {
      const cache = new Map<string, string>()
      result.data.benchmarks.forEach((b: any) => cache.set(b.value, b.label))
      benchmarkCache.value = cache
    }
  } catch (error) {
    console.error('加载基准映射失败:', error)
  }
}

// 获取股票池显示
const getUniverseDisplay = (universe: any) => {
  if (!universe) return '-'
  if (universe.type === 'preset') {
    const presetName = universe.preset_name
    // 先从缓存查找
    if (stockPoolCache.value.has(presetName)) {
      return stockPoolCache.value.get(presetName)
    }
    // 兜底映射
    const names: Record<string, string> = {
      'all': '全市场',
      'hs300': '沪深300',
      'zz500': '中证500',
      'zz1000': '中证1000',
      'sz50': '上证50',
      'zz2000': '中证2000'
    }
    return names[presetName] || presetName
  }
  return '自定义股票池'
}

// 获取比较基准显示
const getBenchmarkDisplay = (benchmarks: string[]) => {
  if (!benchmarks?.length) return '-'
  return benchmarks.map(code => {
    if (benchmarkCache.value.has(code)) {
      return benchmarkCache.value.get(code)
    }
    // 标准指数映射
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
    // 指数行业格式：CSI500_医药生物 -> 中证500-医药生物
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

// 获取因子方向名称
const getDirectionName = (direction: string) => {
  const map: Record<string, string> = {
    'positive': '正向',
    'negative': '负向',
    'auto': '自动'
  }
  return map[direction] || direction
}

// 获取买入价格类型名称
const getBuyPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_open': '日线开盘价',
    'vwap_30min': '30分钟VWAP (9:30-10:00)',
    'vwap_60min': '60分钟VWAP (9:30-10:30)'
  }
  return map[type] || type
}

// 获取卖出价格类型名称
const getSellPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_close': '日线收盘价',
    'daily_vwap': '日线全天VWAP',
    'vwap_30min': '30分钟VWAP (14:30-15:00)',
    'vwap_60min': '60分钟VWAP (14:00-15:00)'
  }
  return map[type] || type
}

onMounted(() => {
  loadTasks()
  loadStockPoolMapping()
  loadBenchmarkMapping()
})
onUnmounted(() => stopPolling())
</script>

<style scoped lang="scss">
.tasks-content {
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
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
  }
  
  .stats-row {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    
    .stat-card {
      background: #fff;
      border: none;
      border-radius: 12px;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.3s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      
      .stat-value {
        font-size: 26px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1;
      }
      
      .stat-label {
        font-size: 13px;
        color: #64748b;
        font-weight: 500;
      }
      
      &.running {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        .stat-value { color: #2563eb; }
      }
      
      &.completed {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        .stat-value { color: #16a34a; }
      }
      
      &.failed {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        .stat-value { color: #dc2626; }
      }
    }
  }
  
  // 现代风格表格
  .modern-table {
    font-size: 12px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    
    // 去除默认边框
    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }
    
    // 表头样式
    :deep(.el-table__header-wrapper) {
      th {
        border: none !important;
        
        .cell {
          white-space: nowrap;
        }
        
        // 筛选图标样式
        .el-table__column-filter-trigger {
          color: #94a3b8;
          
          &:hover {
            color: #475569;
          }
        }
        
        // 排序图标样式
        .caret-wrapper {
          .sort-caret {
            border-bottom-color: #cbd5e1;
            border-top-color: #cbd5e1;
            
            &.ascending {
              border-bottom-color: #3b82f6;
            }
            
            &.descending {
              border-top-color: #3b82f6;
            }
          }
        }
      }
    }
    
    // 表格主体
    :deep(.el-table__body-wrapper) {
      .el-table__body {
        border-spacing: 0;
      }
    }
    
    // 斑马纹颜色 - 更柔和
    :deep(.el-table__row--striped) {
      td {
        background: #f8fafc !important;
      }
    }
    
    // 普通行
    :deep(.el-table__row) {
      td {
        border: none !important;
        border-bottom: 1px solid #f1f5f9 !important;
      }
    }
    
    // 鼠标悬停 - 柔和的蓝色
    :deep(.el-table__body tr:hover > td) {
      background: #eff6ff !important;
    }
    
    // 任务名称链接
    .task-link {
      font-weight: 400;
      color: #3b82f6;
      font-size: 12px;
      transition: all 0.2s;
      
      &:hover {
        color: #2563eb;
      }
    }
    
    // 状态包装器
    .status-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      
      .progress-info {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
        
        .progress-percent {
          font-size: 11px;
          color: #2563eb;
          font-weight: 500;
        }
      }
      
      .stage-info {
        font-size: 11px;
        color: #64748b;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 3px;
      }
    }
    
    // 状态文字 - 使用圆角标签样式
    .status-text {
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      
      &.pending { 
        color: #d97706; 
        background: #fef3c7;
      }
      &.running { 
        color: #2563eb; 
        background: #dbeafe;
      }
      &.completed { 
        color: #16a34a; 
        background: #dcfce7;
      }
      &.failed { 
        color: #dc2626; 
        background: #fee2e2;
      }
      &.cancelled { 
        color: #64748b; 
        background: #f1f5f9;
      }
    }
    
    // 运行中文字动画
    .running-text {
      color: #3b82f6;
      animation: pulse 1.5s infinite;
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
  
  // 兼容旧样式（保留部分）
  .task-table {
    border-radius: 8px;
    overflow: hidden;
    
    .task-info {
      .task-name {
        font-weight: 500;
        margin-bottom: 6px;
        
        :deep(.el-link) {
          font-size: 14px;
        }
      }
      
      .task-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        
        .task-id {
          font-size: 12px;
          color: #909399;
        }
      }
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #606266;
      
      .el-icon {
        font-size: 14px;
        color: #909399;
      }
    }
    
    .status-wrapper {
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        
        .progress-percent {
          font-weight: 400;
          margin-left: 2px;
        }
        
        &.pending {
          background: #fdf6ec;
          color: #e6a23c;
        }
        
        &.running {
          background: #ecf5ff;
          color: #409eff;
        }
        
        &.completed {
          background: #f0f9eb;
          color: #67c23a;
        }
        
        &.failed {
          background: #fef0f0;
          color: #f56c6c;
        }
        
        &.cancelled {
          background: #f4f4f5;
          color: #909399;
        }
      }
      
      .task-progress {
        margin-top: 6px;
        width: 140px;
      }
      
      .progress-detail {
        margin-top: 8px;
        padding: 8px 10px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 12px;
        
        .detail-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-bottom: 4px;
          line-height: 1.5;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .detail-label {
            color: #909399;
            flex-shrink: 0;
          }
          
          .detail-value {
            color: #606266;
            word-break: break-all;
            
            .remaining-time {
              color: #409eff;
              font-weight: 500;
            }
          }
        }
      }
    }
    
    .time-info {
      font-size: 13px;
      
      .time-row {
        margin-bottom: 4px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .time-label {
          color: #909399;
          margin-right: 4px;
        }
        
        .duration {
          color: #409eff;
          font-weight: 500;
        }
        
        .running-indicator {
          color: #409eff;
          animation: pulse 1.5s infinite;
        }
      }
    }
    
    .rank-ic-good {
      color: #67c23a;
      font-weight: 600;
    }
    
    .rank-ic-bad {
      color: #f56c6c;
      font-weight: 600;
    }
    
    .rank-ic-neutral {
      color: #606266;
    }
    
    .na-value {
      color: #c0c4cc;
    }
    
    .action-buttons {
      display: flex;
      gap: 8px;
    }
  }
  
  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
  
  .status-icon {
    margin-right: 6px;
    
    &.warning { color: #e6a23c; }
    &.primary { color: #409eff; }
    &.success { color: #67c23a; }
    &.danger { color: #f56c6c; }
    &.info { color: #909399; }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 详情弹窗样式
.task-detail-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    max-height: 70vh;
    overflow-y: auto;
  }
  
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
        }
      }
    }
  }
}
</style>
