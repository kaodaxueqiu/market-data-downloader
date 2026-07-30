<template>
  <div class="cron-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="title-area">
          <h2>{{ jobDetail?.display_name || jobName }}</h2>
          <p class="subtitle">{{ jobDetail?.script_path }}</p>
        </div>
      </div>
      <div class="header-right">
        <el-tag :type="getStatusType(jobDetail?.last_status)" size="large">
          {{ getStatusText(jobDetail?.last_status) }}
        </el-tag>
      </div>
    </div>

    <!-- 当前运行状态（如果正在运行） -->
    <el-alert
      v-if="jobDetail?.last_status === 'running'"
      type="warning"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        <div class="running-alert">
          <span class="running-icon">▶️</span>
          <span class="running-text">任务正在运行中...</span>
        </div>
      </template>
      <div class="running-details">
        <div class="running-item">
          <span class="label">开始时间:</span>
          <span class="value">{{ jobDetail.last_start_time }}</span>
        </div>
        <div class="running-item">
          <span class="label">已运行:</span>
          <span class="value">{{ getRunningDuration(jobDetail.last_start_time) }}</span>
        </div>
        <div class="running-item">
          <span class="label">脚本路径:</span>
          <span class="value code">{{ jobDetail.script_path }}</span>
        </div>
      </div>
    </el-alert>

    <!-- 任务基本信息卡片 -->
    <div class="info-panel">
      <h3>📋 任务信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">任务名称</span>
          <span class="info-value">{{ jobDetail?.job_name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">分类</span>
          <el-tag size="small">{{ jobDetail?.category }}</el-tag>
        </div>
        <div class="info-item">
          <span class="info-label">调度周期</span>
          <span class="info-value">{{ jobDetail?.schedule_desc }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Cron表达式</span>
          <span class="info-value code">{{ jobDetail?.cron_schedule }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">超时时间</span>
          <span class="info-value">
            {{ jobDetail?.timeout_seconds ? `${jobDetail.timeout_seconds}秒` : '无限制' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">失败告警</span>
          <el-tag :type="jobDetail?.alert_on_failure ? 'warning' : 'info'" size="small">
            {{ jobDetail?.alert_on_failure ? '已启用' : '未启用' }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 30天统计 -->
    <div class="stats-section">
      <h3>📊 30天统计</h3>
      <div class="stats-cards">
        <div class="stats-card">
          <div class="stats-label">总执行次数</div>
          <div class="stats-value">{{ stats30days?.total_executions || 0 }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">成功次数</div>
          <div class="stats-value healthy">{{ stats30days?.success_count || 0 }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">失败次数</div>
          <div class="stats-value critical">{{ stats30days?.failed_count || 0 }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">成功率</div>
          <div class="stats-value" :class="getRateClass(stats30days?.success_rate || 0)">
            {{ (stats30days?.success_rate || 0).toFixed(1) }}%
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-label">平均耗时</div>
          <div class="stats-value">{{ formatDuration(stats30days?.avg_duration_seconds || 0) }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">最大耗时</div>
          <div class="stats-value warning">{{ formatDuration(stats30days?.max_duration_seconds || 0) }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">总处理行数</div>
          <div class="stats-value">{{ (stats30days?.total_rows_processed || 0).toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- 执行历史 -->
    <div class="history-panel">
      <div class="history-header">
        <h3>📜 执行历史</h3>
        <div class="history-filters">
          <el-select v-model="historyStatusFilter" placeholder="全部状态" clearable size="small" style="width: 120px">
            <el-option label="全部状态" value="" />
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
            <el-option label="运行中" value="running" />
            <el-option label="超时" value="timeout" />
          </el-select>
          <el-button size="small" @click="fetchHistory">刷新</el-button>
        </div>
      </div>
      <div class="history-table">
        <el-table :data="recentHistory" style="width: 100%" v-loading="historyLoading">
          <el-table-column prop="start_time" label="开始时间" width="160">
            <template #default="{ row }">
              <span class="time-text">{{ row.start_time }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="end_time" label="结束时间" width="160">
            <template #default="{ row }">
              <span class="time-text">{{ row.end_time || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="duration_seconds" label="耗时" width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.duration_seconds" class="duration-text">
                {{ formatDuration(row.duration_seconds) }}
              </span>
              <span v-else class="no-data">-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="rows_processed" label="处理行数" width="120" align="right">
            <template #default="{ row }">
              <span v-if="row.rows_processed" class="rows-text">
                {{ row.rows_processed.toLocaleString() }}
              </span>
              <span v-else class="no-data">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="error_message" label="错误信息" min-width="200">
            <template #default="{ row }">
              <span v-if="row.error_message" class="error-text">{{ row.error_message }}</span>
              <span v-else class="no-data">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 分页 -->
      <div class="history-pagination">
        <el-pagination
          v-model:current-page="historyPage"
          v-model:page-size="historyPageSize"
          :total="historyTotal"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchHistory"
          @current-change="fetchHistory"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import cronJobService, { setCronJobApiKey } from '@/services/cronjob.service'

const route = useRoute()
const router = useRouter()
const jobName = computed(() => route.params.jobName as string)
const jobDetail = ref<any>(null)
const recentHistory = ref<any[]>([])
const stats30days = ref<any>(null)

// 历史记录分页
const historyPage = ref(1)
const historyPageSize = ref(50)
const historyTotal = ref(0)
const historyStatusFilter = ref('')
const historyLoading = ref(false)

const goBack = () => {
  router.push('/monitoring/clickhouse-cron')
}

// 格式化耗时
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

// 获取状态类型
const getStatusType = (status: string | undefined) => {
  const types: Record<string, any> = {
    success: 'success',
    failed: 'danger',
    running: 'warning',
    timeout: 'danger',
    '': 'info'
  }
  return types[status || ''] || 'info'
}

// 获取状态文本
const getStatusText = (status: string | undefined) => {
  const texts: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    timeout: '超时',
    '': '未执行'
  }
  return texts[status || ''] || '未知'
}

// 获取成功率样式
const getRateClass = (rate: number) => {
  if (rate >= 95) return 'rate-good'
  if (rate >= 80) return 'rate-warning'
  return 'rate-critical'
}

// 计算已运行时长
const getRunningDuration = (startTime: string | null): string => {
  if (!startTime) return '-'
  
  try {
    const start = new Date(startTime).getTime()
    const now = new Date().getTime()
    const diffSeconds = Math.floor((now - start) / 1000)
    
    if (diffSeconds < 60) return `${diffSeconds}秒`
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分${diffSeconds % 60}秒`
    const hours = Math.floor(diffSeconds / 3600)
    const minutes = Math.floor((diffSeconds % 3600) / 60)
    return `${hours}小时${minutes}分`
  } catch (err) {
    return '-'
  }
}

// 获取执行历史
const fetchHistory = async () => {
  try {
    historyLoading.value = true
    
    const params: any = {
      page: historyPage.value,
      page_size: historyPageSize.value,
      job_name: jobName.value
    }
    
    if (historyStatusFilter.value) {
      params.status = historyStatusFilter.value
    }
    
    const result = await cronJobService.getHistory(params)
    
    if (result.success) {
      recentHistory.value = result.data || []
      historyTotal.value = result.total || 0
    }
  } catch (err) {
    console.error('获取执行历史失败:', err)
  } finally {
    historyLoading.value = false
  }
}

// 获取任务详情
const fetchJobDetail = async () => {
  try {
    // 获取 API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        setCronJobApiKey(fullKey)
      }
    }

    const result = await cronJobService.getJobDetail(jobName.value)
    
    if (result.success) {
      jobDetail.value = result.data
      stats30days.value = result.data.stats_30days || null
    }
    
    // 获取历史记录
    await fetchHistory()
  } catch (err) {
    console.error('获取任务详情失败:', err)
  }
}

onMounted(() => {
  fetchJobDetail()
})
</script>

<style scoped lang="scss">
.cron-detail-page {
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
    align-items: flex-start;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      gap: 14px;

      .title-area {
        h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          color: #303133;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          color: #909399;
        }
      }
    }
  }

  .info-panel,
  .stats-section,
  .history-panel {
    flex-shrink: 0;
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e4e7ed;
    margin-bottom: 20px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #303133;
      font-weight: 600;
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .info-label {
        font-size: 12px;
        color: #909399;
      }

      .info-value {
        font-size: 14px;
        font-weight: 600;
        color: #303133;

        &.code {
          font-family: 'Courier New', monospace;
          color: #409EFF;
        }
      }
    }
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;

    .stats-card {
      text-align: center;
      padding: 16px;
      background: #f5f7fa;
      border-radius: 6px;
      border: 1px solid #e4e7ed;

      .stats-label {
        font-size: 12px;
        color: #909399;
        margin-bottom: 8px;
      }

      .stats-value {
        font-size: 24px;
        font-weight: 600;
        color: #303133;

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }

        &.critical {
          color: #F56C6C;
        }

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
  }

  .history-table {
    .time-text {
      font-size: 13px;
      color: #606266;
    }

    .duration-text {
      font-size: 13px;
      font-weight: 600;
      color: #67C23A;
    }

    .rows-text {
      font-size: 13px;
      font-weight: 600;
      color: #409EFF;
    }

    .error-text {
      font-size: 12px;
      color: #F56C6C;
    }

    .no-data {
      font-size: 13px;
      color: #909399;
    }
  }

  .code {
    font-family: 'Courier New', monospace;
  }

  .running-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;

    .running-icon {
      font-size: 20px;
      animation: pulse 2s infinite;
    }

    .running-text {
      font-weight: 600;
    }
  }

  .running-details {
    display: flex;
    gap: 24px;
    margin-top: 12px;
    font-size: 13px;

    .running-item {
      .label {
        color: #909399;
      }

      .value {
        margin-left: 6px;
        font-weight: 600;
        color: #303133;

        &.code {
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }
      }
    }
  }

  .history-panel {
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h3 {
        margin: 0;
      }

      .history-filters {
        display: flex;
        gap: 10px;
        align-items: center;
      }
    }

    .history-pagination {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }
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

