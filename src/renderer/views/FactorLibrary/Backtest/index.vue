<template>
  <div class="backtest-list">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>因子回测</h2>
        <span class="subtitle">提交因子回测任务，查看回测结果</span>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="goToSubmit">
          提交回测任务
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <el-select 
          v-model="filterStatus" 
          placeholder="全部状态" 
          clearable
          style="width: 150px;"
          @change="loadTasks"
        >
          <el-option label="全部状态" value="" />
          <el-option label="等待执行" value="pending" />
          <el-option label="正在执行" value="running" />
          <el-option label="执行完成" value="completed" />
          <el-option label="执行失败" value="failed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        
        <el-button :icon="Refresh" @click="loadTasks" :loading="loading">
          刷新
        </el-button>
      </div>
    </el-card>

    <!-- 任务列表 -->
    <el-card>
      <el-table 
        :data="tasks" 
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="任务名称" prop="task_name" min-width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="goToResult(row.task_id)">
              {{ row.task_name }}
            </el-link>
          </template>
        </el-table-column>
        
        <el-table-column label="任务类型" prop="task_type" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ getTaskTypeName(row.task_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusName(row.status) }}
              </el-tag>
              <el-progress 
                v-if="row.status === 'running'" 
                :percentage="row.progress || 0" 
                :stroke-width="6"
                style="width: 80px; margin-left: 8px;"
              />
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">
            <span v-if="row.completed_at && row.started_at">
              {{ calcDuration(row.started_at, row.completed_at) }}
            </span>
            <span v-else-if="row.status === 'running'" class="running-text">
              运行中...
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 'completed'"
              size="small" 
              type="primary"
              text
              @click="goToResult(row.task_id)"
            >
              查看结果
            </el-button>
            <el-button 
              v-if="row.status === 'pending'"
              size="small" 
              type="danger"
              text
              @click="cancelTask(row)"
            >
              取消
            </el-button>
            <el-button 
              v-if="row.status === 'failed'"
              size="small" 
              type="info"
              text
              @click="viewError(row)"
            >
              查看错误
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadTasks"
          @current-change="loadTasks"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')

// 轮询定时器
let pollTimer: number | null = null

// 任务类型映射
const getTaskTypeName = (type: string) => {
  const map: Record<string, string> = {
    'single_factor': '单因子',
    'multi_factor': '多因子',
    'factor_compare': '因子对比',
    'daily_update': '每日更新'
  }
  return map[type] || type
}

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

// 加载任务列表
const loadTasks = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.backtest.getTasks({
      page: currentPage.value,
      page_size: pageSize.value,
      status: filterStatus.value || undefined
    })
    
    if (result.success && result.data) {
      tasks.value = result.data.tasks || []
      total.value = result.data.total || 0
      
      // 如果有运行中的任务，启动轮询
      const hasRunning = tasks.value.some(t => t.status === 'running' || t.status === 'pending')
      if (hasRunning) {
        startPolling()
      } else {
        stopPolling()
      }
    } else {
      ElMessage.error(result.error || '获取任务列表失败')
    }
  } catch (error: any) {
    ElMessage.error('获取任务列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 启动轮询
const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    loadTasks()
  }, 5000) // 5秒轮询一次
}

// 停止轮询
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 跳转到提交页面
const goToSubmit = () => {
  router.push('/factor-library/backtest/submit')
}

// 跳转到结果页面
const goToResult = (taskId: string) => {
  router.push(`/factor-library/backtest/result/${taskId}`)
}

// 取消任务
const cancelTask = async (task: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消任务「${task.task_name}」吗？`,
      '确认取消',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const result = await window.electronAPI.backtest.cancelTask(task.task_id)
    
    if (result.success) {
      ElMessage.success('任务已取消')
      loadTasks()
    } else {
      ElMessage.error(result.error || '取消失败')
    }
  } catch (e) {
    // 用户取消操作
  }
}

// 查看错误信息
const viewError = async (task: any) => {
  try {
    const result = await window.electronAPI.backtest.getTaskDetail(task.task_id)
    
    if (result.success && result.data?.task) {
      const errorMsg = result.data.task.error_message || '未知错误'
      ElMessageBox.alert(errorMsg, '错误信息', {
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

onMounted(() => {
  loadTasks()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.backtest-list {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .header-left {
      h2 {
        margin: 0 0 4px 0;
        font-size: 20px;
        font-weight: 600;
      }
      
      .subtitle {
        color: #909399;
        font-size: 14px;
      }
    }
  }
  
  .filter-card {
    margin-bottom: 16px;
    
    :deep(.el-card__body) {
      padding: 16px;
    }
    
    .filter-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  
  .status-cell {
    display: flex;
    align-items: center;
  }
  
  .running-text {
    color: #409eff;
    font-size: 13px;
  }
  
  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
