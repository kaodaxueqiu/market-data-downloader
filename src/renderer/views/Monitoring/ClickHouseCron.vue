<template>
  <div class="clickhouse-cron-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>ClickHouse 定时任务监控</h2>
      <div class="header-info">
        <el-tag :type="loading ? 'warning' : 'success'" size="large">
          {{ loading ? '加载中...' : '实时监控' }}
        </el-tag>
        <span class="update-time">最后更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    />

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">总任务数</div>
          <div class="stat-value">{{ totalJobs }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">▶️</div>
        <div class="stat-content">
          <div class="stat-label">运行中</div>
          <div class="stat-value running">{{ runningJobs }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">成功率</div>
          <div class="stat-value healthy">{{ overallSuccessRate }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <div class="stat-label">失败任务</div>
          <div class="stat-value critical">{{ failedJobsCount }}</div>
        </div>
      </div>
    </div>

    <!-- 失败告警区域 -->
    <el-alert
      v-if="failedJobs.length > 0"
      type="error"
      :title="`⚠️ 有 ${failedJobs.length} 个任务最近执行失败`"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <div class="failed-jobs-list">
        <div v-for="job in failedJobs.slice(0, 3)" :key="job.id" class="failed-job-item">
          <span class="job-name">{{ job.job_name }}</span>
          <span class="job-time">{{ formatTime(job.start_time) }}</span>
          <span class="job-error">{{ job.error_message }}</span>
        </div>
        <el-link v-if="failedJobs.length > 3" type="danger" @click="showAllFailed">
          查看全部 {{ failedJobs.length }} 个失败任务 →
        </el-link>
      </div>
    </el-alert>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="categoryFilter" placeholder="全部分类" clearable>
        <el-option label="全部分类" value="" />
        <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="statusFilter" placeholder="全部状态" clearable>
        <el-option label="全部状态" value="" />
        <el-option label="成功" value="success" />
        <el-option label="失败" value="failed" />
        <el-option label="运行中" value="running" />
        <el-option label="超时" value="timeout" />
      </el-select>
      <el-input
        v-model="searchTerm"
        placeholder="搜索任务名称或脚本路径..."
        clearable
      />
      <el-button type="primary" :icon="Refresh" @click="refreshData">刷新</el-button>
    </div>

    <!-- 任务列表表格 -->
    <div class="jobs-table">
      <el-table :data="filteredJobs" style="width: 100%">
        <el-table-column prop="display_name" label="任务名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="job-name-cell">
              <div class="job-display-name">{{ row.display_name }}</div>
              <div class="job-id">{{ row.job_name }}</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="category" label="分类" min-width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="schedule_desc" label="调度周期" min-width="120" />

        <el-table-column label="最新状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.last_status)" size="small">
              {{ getStatusText(row.last_status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="last_start_time" label="最后执行时间" min-width="160">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.last_start_time) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="7日成功率" min-width="100" align="center">
          <template #default="{ row }">
            <span v-if="jobStats[row.job_name]" 
                  class="success-rate" 
                  :class="getRateClass(jobStats[row.job_name].success_rate)">
              {{ jobStats[row.job_name].success_rate.toFixed(1) }}%
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="90" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="viewDetail(row.job_name)">
              详情 →
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredJobs.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import cronJobService, { setCronJobApiKey, type CronJob, type JobStats } from '@/services/cronjob.service'

const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const jobs = ref<CronJob[]>([])
const failedJobs = ref<any[]>([])
const jobStats = ref<Record<string, JobStats>>({})
const lastUpdateTime = ref('--:--:--')

// 筛选条件
const categoryFilter = ref('')
const statusFilter = ref('')
const searchTerm = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

let refreshTimer: NodeJS.Timeout | null = null

// 所有分类
const categories = computed(() => {
  const cats = new Set(jobs.value.map(j => j.category))
  return Array.from(cats)
})

// 统计数据
const totalJobs = computed(() => jobs.value.length)
const runningJobs = computed(() => jobs.value.filter(j => j.last_status === 'running').length)
const failedJobsCount = computed(() => failedJobs.value.length)
const overallSuccessRate = computed(() => {
  const statsArray = Object.values(jobStats.value)
  if (statsArray.length === 0) return 0
  const avgRate = statsArray.reduce((sum, s) => sum + s.success_rate, 0) / statsArray.length
  return avgRate.toFixed(1)
})

// 过滤任务
const filteredJobs = computed(() => {
  let filtered = jobs.value

  if (categoryFilter.value) {
    filtered = filtered.filter(j => j.category === categoryFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(j => j.last_status === statusFilter.value)
  }

  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase()
    filtered = filtered.filter(j =>
      j.display_name.toLowerCase().includes(search) ||
      j.job_name.toLowerCase().includes(search) ||
      j.script_path.toLowerCase().includes(search)
    )
  }

  return filtered
})

// 格式化时间
const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return '-'
  return timeStr.replace(' ', ' ')
}

// 获取状态类型
const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    success: 'success',
    failed: 'danger',
    running: 'warning',
    timeout: 'danger',
    '': 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    timeout: '超时',
    '': '未执行'
  }
  return texts[status] || '未知'
}

// 获取成功率样式
const getRateClass = (rate: number) => {
  if (rate >= 95) return 'rate-good'
  if (rate >= 80) return 'rate-warning'
  return 'rate-critical'
}

// 查看详情
const viewDetail = (jobName: string) => {
  router.push(`/monitoring/clickhouse-cron/${jobName}`)
}

// 显示所有失败任务
const showAllFailed = () => {
  statusFilter.value = 'failed'
}

// 刷新数据
const refreshData = async () => {
  await fetchData()
  ElMessage.success('数据已刷新')
}

// 分页处理
const handleSizeChange = () => {
  currentPage.value = 1
}

const handlePageChange = () => {
  // 页面变化处理
}

// 获取数据
const fetchData = async () => {
  try {
    loading.value = true
    error.value = null

    // 获取 API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        setCronJobApiKey(fullKey)
      }
    }

    // 并行获取数据
    const [jobListResult, statsResult, failedResult] = await Promise.all([
      cronJobService.getJobList(),
      cronJobService.getStats(7),
      cronJobService.getFailedJobs(20)
    ])

    if (jobListResult.success) {
      jobs.value = jobListResult.data || []
    }

    if (statsResult.success && statsResult.data) {
      const statsMap: Record<string, JobStats> = {}
      if (Array.isArray(statsResult.data)) {
        statsResult.data.forEach(stat => {
          statsMap[stat.job_name] = stat
        })
      }
      jobStats.value = statsMap
    }

    if (failedResult.success) {
      failedJobs.value = failedResult.data || []
    }

    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    loading.value = false
  } catch (err: any) {
    console.error('获取定时任务数据失败:', err)
    error.value = err.message || '获取定时任务数据失败'
    loading.value = false
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchData()
  refreshTimer = setInterval(fetchData, 30000) // 每30秒刷新
}

// 停止定时刷新
const stopRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  startRefresh()
})

onUnmounted(() => {
  stopRefresh()
})
</script>

<style scoped lang="scss">
.clickhouse-cron-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
  padding: 24px;

  .page-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 20px;
      color: #303133;
      font-weight: 600;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .update-time {
        font-size: 13px;
        color: #909399;
      }
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .stat-card {
      background: #fff;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e4e7ed;
      display: flex;
      gap: 14px;
      align-items: center;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }

      .stat-icon {
        font-size: 32px;
        display: flex;
        align-items: center;
      }

      .stat-content {
        flex: 1;

        .stat-label {
          font-size: 13px;
          color: #909399;
          margin-bottom: 6px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #303133;

          &.running {
            color: #E6A23C;
          }

          &.healthy {
            color: #67C23A;
          }

          &.critical {
            color: #F56C6C;
          }
        }
      }
    }
  }

  .failed-jobs-list {
    margin-top: 12px;

    .failed-job-item {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #e4e7ed;
      font-size: 13px;

      &:last-child {
        border-bottom: none;
      }

      .job-name {
        font-weight: 600;
        color: #303133;
        min-width: 120px;
      }

      .job-time {
        color: #909399;
        min-width: 140px;
      }

      .job-error {
        flex: 1;
        color: #606266;
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .el-select {
      width: 140px;
    }

    .el-input {
      flex: 1;
      max-width: 400px;
    }

    .el-button {
      min-width: 90px;
    }
  }

  .jobs-table {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e4e7ed;
    margin-bottom: 20px;
    overflow-y: auto;

    .job-name-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.4;

      .job-display-name {
        font-size: 14px;
        font-weight: 500;
        color: #409EFF;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .job-id {
        font-size: 11px;
        font-family: 'Courier New', monospace;
        color: #909399;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .time-text {
      font-size: 13px;
      color: #606266;
    }

    .no-data {
      font-size: 13px;
      color: #909399;
    }

    .success-rate {
      font-size: 13px;
      font-weight: 600;

      &.rate-good {
        color: #67C23A;
      }

      &.rate-warning {
        color: #E6A23C;
      }

      &.rate-critical {
        color: #F56C6C;
      }
    }
  }

  .pagination-bar {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
