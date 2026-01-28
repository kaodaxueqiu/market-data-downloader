<template>
  <div class="tasks-content">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select 
          v-model="filterStatus" 
          placeholder="全部状态" 
          clearable
          style="width: 140px;"
          @change="loadTasks"
        >
          <el-option label="全部状态" value="" />
          <el-option label="等待执行" value="pending">
            <el-icon class="status-icon warning"><Clock /></el-icon>
            等待执行
          </el-option>
          <el-option label="正在执行" value="running">
            <el-icon class="status-icon primary"><Loading /></el-icon>
            正在执行
          </el-option>
          <el-option label="执行完成" value="completed">
            <el-icon class="status-icon success"><CircleCheck /></el-icon>
            执行完成
          </el-option>
          <el-option label="执行失败" value="failed">
            <el-icon class="status-icon danger"><CircleClose /></el-icon>
            执行失败
          </el-option>
          <el-option label="已取消" value="cancelled">
            <el-icon class="status-icon info"><Remove /></el-icon>
            已取消
          </el-option>
        </el-select>
      </div>
      <div class="toolbar-right">
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

    <!-- 任务列表 -->
    <el-table 
      :data="tasks" 
      v-loading="loading"
      class="task-table"
      :header-cell-style="{ background: '#f5f7fa', color: '#606266', fontWeight: 600 }"
    >
      <el-table-column label="任务信息" min-width="200">
        <template #default="{ row }">
          <div class="task-info">
            <div class="task-name">
              <el-link 
                :type="row.status === 'completed' ? 'primary' : 'default'"
                :underline="false"
                @click="handleViewResult(row)"
                :disabled="row.status !== 'completed'"
              >
                {{ row.task_name }}
              </el-link>
            </div>
            <div class="task-meta">
              <el-tag size="small" effect="plain">
                {{ getTaskTypeName(row.task_type) }}
              </el-tag>
              <span class="task-id">ID: {{ row.task_id?.slice(0, 8) }}...</span>
            </div>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="执行人" min-width="100">
        <template #default="{ row }">
          <div class="user-info">
            <el-icon><User /></el-icon>
            <span>{{ row.user_id || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="状态" min-width="200">
        <template #default="{ row }">
          <div class="status-wrapper">
            <div class="status-badge" :class="row.status">
              <el-icon v-if="row.status === 'pending'"><Clock /></el-icon>
              <el-icon v-else-if="row.status === 'running'" class="is-loading"><Loading /></el-icon>
              <el-icon v-else-if="row.status === 'completed'"><CircleCheck /></el-icon>
              <el-icon v-else-if="row.status === 'failed'"><CircleClose /></el-icon>
              <el-icon v-else><Remove /></el-icon>
              <span>{{ getStatusName(row.status) }}</span>
              <span v-if="row.status === 'running' && row.progress" class="progress-percent">({{ row.progress }}%)</span>
            </div>
            <el-progress 
              v-if="row.status === 'running'" 
              :percentage="row.progress || 0" 
              :stroke-width="4"
              :show-text="false"
              class="task-progress"
            />
            <!-- 详细进度信息 -->
            <div v-if="row.status === 'running' && row.progress_detail" class="progress-detail">
              <div class="detail-row">
                <span class="detail-label">{{ getStageName(row.progress_detail.stage) }}:</span>
                <span class="detail-value">{{ row.progress_detail.step }}</span>
              </div>
              <div class="detail-row" v-if="row.progress_detail.rows_loaded">
                <span class="detail-label">已加载:</span>
                <span class="detail-value">{{ formatRows(row.progress_detail.rows_loaded) }}</span>
              </div>
              <div class="detail-row" v-if="row.progress_detail.memory_mb">
                <span class="detail-label">内存:</span>
                <span class="detail-value">{{ formatMemory(row.progress_detail.memory_mb) }}</span>
              </div>
              <div class="detail-row" v-if="row.progress_detail.elapsed_secs || row.progress_detail.estimated_remaining_secs">
                <span class="detail-label">时间:</span>
                <span class="detail-value">
                  {{ formatSeconds(row.progress_detail.elapsed_secs) }}
                  <span v-if="row.progress_detail.estimated_remaining_secs" class="remaining-time">
                    / 剩余 {{ formatSeconds(row.progress_detail.estimated_remaining_secs) }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="5日 Rank IC" min-width="100" align="center">
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 5))">
            {{ formatRankIc(getPeriodRankIc(row, 5)) }}
          </span>
          <span v-else class="na-value">-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="10日 Rank IC" min-width="100" align="center">
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 10))">
            {{ formatRankIc(getPeriodRankIc(row, 10)) }}
          </span>
          <span v-else class="na-value">-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="时间" min-width="150">
        <template #default="{ row }">
          <div class="time-info">
            <div class="time-row">
              <span class="time-label">创建:</span>
              <span>{{ formatDate(row.created_at) }}</span>
            </div>
            <div v-if="row.completed_at" class="time-row">
              <span class="time-label">耗时:</span>
              <span class="duration">{{ calcDuration(row.started_at, row.completed_at) }}</span>
            </div>
            <div v-else-if="row.status === 'running'" class="time-row">
              <span class="running-indicator">运行中...</span>
            </div>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" min-width="180">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button 
              size="small"
              @click="viewTaskDetail(row)"
            >
              详情
            </el-button>
            <el-button 
              v-if="row.status === 'completed'"
              type="primary"
              size="small"
              @click="handleViewResult(row)"
            >
              <el-icon><View /></el-icon>
              结果
            </el-button>
            <el-button 
              v-if="row.status === 'pending'"
              type="danger"
              size="small"
              plain
              @click="cancelTask(row)"
            >
              取消
            </el-button>
            <el-button 
              v-if="row.status === 'failed'"
              type="info"
              size="small"
              plain
              @click="viewError(row)"
            >
              错误
            </el-button>
          </div>
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
        @size-change="loadTasks"
        @current-change="loadTasks"
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
  Refresh, Clock, Loading, CircleCheck, CircleClose, 
  Remove, View, Document, Setting, DataAnalysis, Connection, Warning, User
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

// 格式化数据行数
const formatRows = (rows: number) => {
  if (!rows) return '-'
  if (rows >= 100000000) return `${(rows / 100000000).toFixed(1)}亿行`
  if (rows >= 10000) return `${(rows / 10000).toFixed(1)}万行`
  return `${rows}行`
}

// 格式化内存使用
const formatMemory = (mb: number) => {
  if (!mb) return '-'
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

// 格式化秒数
const formatSeconds = (secs: number) => {
  if (!secs && secs !== 0) return '-'
  if (secs < 60) return `${Math.round(secs)}秒`
  if (secs < 3600) return `${Math.floor(secs / 60)}分${Math.round(secs % 60)}秒`
  return `${Math.floor(secs / 3600)}时${Math.floor((secs % 3600) / 60)}分`
}

const loadTasks = async () => {
  loading.value = true
  try {
    // 并行加载任务列表和统计数据
    const [result] = await Promise.all([
      window.electronAPI.backtest.getTasks({
        page: currentPage.value,
        page_size: pageSize.value,
        status: filterStatus.value || undefined
      }),
      loadStats()  // 同时加载统计数据
    ])
    
    if (result.success && result.data) {
      tasks.value = result.data.tasks || []
      total.value = result.data.total || 0
      
      // 调试：查看第一个已完成任务的数据结构
      const completedTask = tasks.value.find(t => t.status === 'completed')
      if (completedTask) {
        console.log('已完成任务数据:', completedTask)
        console.log('factor_result:', completedTask.factor_result)
      }
      
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

// 获取股票池显示
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

onMounted(() => loadTasks())
onUnmounted(() => stopPolling())
</script>

<style scoped lang="scss">
.tasks-content {
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .stats-row {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    
    .stat-card {
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s;
      
      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      
      .stat-value {
        font-size: 22px;
        font-weight: 700;
        color: #303133;
        line-height: 1;
      }
      
      .stat-label {
        font-size: 13px;
        color: #909399;
      }
      
      &.running {
        border-left: 3px solid #409eff;
        .stat-value { color: #409eff; }
      }
      
      &.completed {
        border-left: 3px solid #67c23a;
        .stat-value { color: #67c23a; }
      }
      
      &.failed {
        border-left: 3px solid #f56c6c;
        .stat-value { color: #f56c6c; }
      }
    }
  }
  
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
