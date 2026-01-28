<template>
  <div class="backtest-result">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack">
        <template #content>
          <span class="page-title">回测结果</span>
        </template>
      </el-page-header>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 任务不存在或失败 -->
    <el-result 
      v-else-if="!task" 
      icon="error" 
      title="任务不存在"
      sub-title="无法找到该回测任务"
    >
      <template #extra>
        <el-button type="primary" @click="goBack">返回列表</el-button>
      </template>
    </el-result>

    <!-- 任务详情 -->
    <template v-else>
      <!-- 任务信息卡片 -->
      <el-card class="info-card">
        <div class="task-info">
          <div class="info-main">
            <h3>{{ task.task_name }}</h3>
            <div class="info-meta">
              <el-tag :type="getStatusType(task.status)" size="small">
                {{ getStatusName(task.status) }}
              </el-tag>
              <span class="meta-item">
                <el-icon><Calendar /></el-icon>
                {{ formatDate(task.created_at) }}
              </span>
              <span v-if="task.completed_at" class="meta-item">
                <el-icon><Timer /></el-icon>
                耗时 {{ calcDuration(task.started_at, task.completed_at) }}
              </span>
            </div>
          </div>
          <div class="info-actions">
            <el-button @click="loadData" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
        
        <!-- 进度条（运行中显示） -->
        <div v-if="task.status === 'running'" class="progress-section">
          <el-progress 
            :percentage="task.progress || 0" 
            :stroke-width="12"
            status="primary"
          />
          <p class="progress-text">正在执行回测任务，请稍候...</p>
        </div>
        
        <!-- 错误信息（失败显示） -->
        <el-alert 
          v-if="task.status === 'failed'" 
          type="error" 
          :closable="false"
          style="margin-top: 16px;"
        >
          <template #title>
            <strong>任务执行失败</strong>
          </template>
          {{ task.error_message || '未知错误' }}
        </el-alert>
      </el-card>

      <!-- 结果展示（仅完成状态） -->
      <template v-if="task.status === 'completed' && result">
        <!-- 汇总信息 -->
        <el-card class="summary-card">
          <template #header>
            <span class="section-title">回测汇总</span>
          </template>
          <div class="summary-info">
            <div class="summary-item">
              <span class="label">回测因子数</span>
              <span class="value">{{ result.summary?.total_factors || 0 }}</span>
            </div>
            <div class="summary-item">
              <span class="label">回测天数</span>
              <span class="value">{{ result.summary?.backtest_days || 0 }}</span>
            </div>
            <div class="summary-item">
              <span class="label">开始日期</span>
              <span class="value">{{ result.summary?.start_date || '-' }}</span>
            </div>
            <div class="summary-item">
              <span class="label">结束日期</span>
              <span class="value">{{ result.summary?.end_date || '-' }}</span>
            </div>
          </div>
        </el-card>

        <!-- 指标卡片 -->
        <div class="metrics-grid" v-if="result.factor_results && result.factor_results.length > 0">
          <el-card 
            v-for="(factor, index) in result.factor_results" 
            :key="index"
            class="factor-card"
          >
            <template #header>
              <span class="factor-title">因子 #{{ factor.factor_id }}</span>
            </template>
            
            <div class="metrics-row">
              <!-- IC 指标 -->
              <div class="metric-group">
                <h4>IC 分析</h4>
                <div class="metric-item">
                  <span class="label">IC均值</span>
                  <span class="value" :class="getValueClass(factor.ic_mean)">
                    {{ formatNumber(factor.ic_mean, 4) }}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="label">IC标准差</span>
                  <span class="value">{{ formatNumber(factor.ic_std, 4) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">IC_IR</span>
                  <span class="value" :class="getValueClass(factor.ic_ir)">
                    {{ formatNumber(factor.ic_ir, 4) }}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="label">Rank IC均值</span>
                  <span class="value" :class="getValueClass(factor.rank_ic_mean)">
                    {{ formatNumber(factor.rank_ic_mean, 4) }}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="label">Rank IC_IR</span>
                  <span class="value" :class="getValueClass(factor.rank_ic_ir)">
                    {{ formatNumber(factor.rank_ic_ir, 4) }}
                  </span>
                </div>
              </div>
              
              <!-- 收益指标 -->
              <div class="metric-group">
                <h4>收益分析</h4>
                <div class="metric-item">
                  <span class="label">年化收益</span>
                  <span class="value" :class="getValueClass(factor.annual_return)">
                    {{ formatPercent(factor.annual_return) }}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="label">年化波动</span>
                  <span class="value">{{ formatPercent(factor.annual_volatility) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">夏普比率</span>
                  <span class="value" :class="getValueClass(factor.sharpe_ratio)">
                    {{ formatNumber(factor.sharpe_ratio, 2) }}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="label">最大回撤</span>
                  <span class="value negative">{{ formatPercent(factor.max_drawdown) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">胜率</span>
                  <span class="value">{{ formatPercent(factor.win_rate) }}</span>
                </div>
              </div>
              
              <!-- 其他指标 -->
              <div class="metric-group">
                <h4>其他指标</h4>
                <div class="metric-item">
                  <span class="label">平均换手率</span>
                  <span class="value">{{ formatPercent(factor.turnover_mean) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">单调性</span>
                  <span class="value" :class="getValueClass(factor.monotonicity - 0.5)">
                    {{ formatNumber(factor.monotonicity, 2) }}
                  </span>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 无结果 -->
        <el-empty 
          v-else 
          description="暂无回测结果数据"
        />
      </template>

      <!-- 等待执行 -->
      <el-card v-else-if="task.status === 'pending'" class="pending-card">
        <el-result 
          icon="info" 
          title="等待执行"
          sub-title="任务已提交，正在排队等待执行"
        />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Calendar, Timer, Refresh } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const task = ref<any>(null)
const result = ref<any>(null)

// 轮询定时器
let pollTimer: number | null = null

// 状态类型映射
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

// 状态名称映射
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

// 格式化日期
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

// 计算耗时
const calcDuration = (start: string, end: string) => {
  if (!start || !end) return '-'
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  const duration = Math.floor((endTime - startTime) / 1000)
  
  if (duration < 60) {
    return `${duration}秒`
  } else if (duration < 3600) {
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}分${seconds}秒`
  } else {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    return `${hours}时${minutes}分`
  }
}

// 格式化数字
const formatNumber = (num: number | undefined, decimals: number = 2) => {
  if (num === undefined || num === null) return '-'
  return num.toFixed(decimals)
}

// 格式化百分比
const formatPercent = (num: number | undefined) => {
  if (num === undefined || num === null) return '-'
  return (num * 100).toFixed(2) + '%'
}

// 获取数值颜色类
const getValueClass = (value: number | undefined) => {
  if (value === undefined || value === null) return ''
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

// 返回列表
const goBack = () => {
  router.push('/factor-library/backtest/result')
}

// 加载数据
const loadData = async () => {
  const taskId = route.params.taskId as string
  if (!taskId) {
    ElMessage.error('任务ID无效')
    return
  }
  
  loading.value = true
  
  try {
    // 获取任务详情
    const detailResult = await window.electronAPI.backtest.getTaskDetail(taskId)
    
    if (detailResult.success && detailResult.data?.task) {
      task.value = detailResult.data.task
      
      // 如果任务完成，获取结果
      if (task.value.status === 'completed') {
        const resultData = await window.electronAPI.backtest.getResult(taskId)
        if (resultData.success && resultData.data) {
          result.value = resultData.data
        }
        stopPolling()
      } else if (task.value.status === 'running' || task.value.status === 'pending') {
        // 运行中或等待中，启动轮询
        startPolling()
      } else {
        stopPolling()
      }
    } else {
      ElMessage.error(detailResult.error || '获取任务详情失败')
    }
  } catch (error: any) {
    ElMessage.error('获取数据失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 启动轮询
const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    loadData()
  }, 3000) // 3秒轮询一次
}

// 停止轮询
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.backtest-result {
  .page-header {
    margin-bottom: 20px;
    
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }
  
  .loading-wrapper {
    text-align: center;
    padding: 60px;
    
    p {
      margin-top: 16px;
      color: #909399;
    }
  }
  
  .info-card {
    margin-bottom: 20px;
    
    .task-info {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      
      .info-main {
        h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .info-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          
          .meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
            color: #909399;
            font-size: 14px;
          }
        }
      }
    }
    
    .progress-section {
      margin-top: 20px;
      
      .progress-text {
        margin-top: 8px;
        color: #909399;
        font-size: 14px;
        text-align: center;
      }
    }
  }
  
  .summary-card {
    margin-bottom: 20px;
    
    .section-title {
      font-size: 15px;
      font-weight: 600;
    }
    
    .summary-info {
      display: flex;
      gap: 40px;
      
      .summary-item {
        .label {
          color: #909399;
          font-size: 13px;
          display: block;
          margin-bottom: 4px;
        }
        
        .value {
          font-size: 16px;
          font-weight: 500;
        }
      }
    }
  }
  
  .metrics-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    
    .factor-card {
      .factor-title {
        font-size: 15px;
        font-weight: 600;
      }
      
      .metrics-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 30px;
        
        .metric-group {
          h4 {
            margin: 0 0 16px 0;
            font-size: 14px;
            font-weight: 600;
            color: #606266;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }
          
          .metric-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            
            .label {
              color: #909399;
              font-size: 13px;
            }
            
            .value {
              font-size: 15px;
              font-weight: 500;
              font-family: 'Monaco', 'Menlo', monospace;
              
              &.positive {
                color: #67c23a;
              }
              
              &.negative {
                color: #f56c6c;
              }
            }
          }
        }
      }
    }
  }
  
  .pending-card {
    :deep(.el-result) {
      padding: 40px 20px;
    }
  }
}
</style>
