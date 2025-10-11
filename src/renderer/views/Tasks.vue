<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下载任务队列</span>
          <div class="header-actions">
            <el-button @click="() => refreshTasks(true)" :icon="Refresh">刷新</el-button>
            <el-button type="danger" @click="clearCompletedTasks" :icon="Delete">
              清理已完成
            </el-button>
          </div>
        </div>
      </template>
      
      <el-table
        :data="tasks"
        style="width: 100%"
        empty-text="暂无任务"
        v-loading="loading"
        :show-overflow-tooltip="false"
      >
        <el-table-column prop="id" label="任务ID" width="180" />
        <el-table-column prop="messageType" label="消息类型" width="120" />
        <el-table-column label="下载条件" width="280">
          <template #default="scope">
            <div style="font-size: 12px; line-height: 1.6">
              <div v-if="scope.row.symbols && scope.row.symbols.length > 0" style="margin-bottom: 4px">
                <el-tag size="small" type="primary">代码</el-tag> 
                {{ scope.row.symbols.join(', ') }}
              </div>
              <div v-if="scope.row.startDate || scope.row.endDate" style="margin-bottom: 4px">
                <el-tag size="small" type="success">日期</el-tag> 
                {{ scope.row.startDate || '不限' }} ~ {{ scope.row.endDate || '不限' }}
              </div>
              <div v-if="scope.row.startTime || scope.row.endTime" style="margin-bottom: 4px">
                <el-tag size="small" type="warning">时间</el-tag> 
                {{ scope.row.startTime || '不限' }} ~ {{ scope.row.endTime || '不限' }}
              </div>
              <div style="margin-bottom: 4px">
                <el-tag size="small" type="info">格式</el-tag> 
                {{ scope.row.format?.toUpperCase() || 'CSV' }}
              </div>
              <div v-if="!scope.row.symbols && !scope.row.startDate && !scope.row.startTime">
                <el-tag size="small" type="">全部条件</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="进度" width="200">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.progress"
              :status="scope.row.status === 'completed' ? 'success' : undefined"
            />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="200">
          <template #default="scope">
            <div>
              <el-tag :type="getStatusType(scope.row.status)">
                {{ getStatusText(scope.row.status) }}
              </el-tag>
              <div v-if="scope.row.errorMessage" style="color: #f56c6c; font-size: 12px; margin-top: 5px">
                {{ scope.row.errorMessage }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed'"
              size="small"
              :type="downloadedTasks.has(scope.row.id) ? 'success' : 'primary'"
              @click="downloadTask(scope.row)"
              :icon="Download"
            >
              {{ downloadedTasks.has(scope.row.id) ? '已下载' : '下载' }}
            </el-button>
            <el-button
              v-if="['downloading', 'processing'].includes(scope.row.status)"
              size="small"
              type="danger"
              @click="cancelTask(scope.row.id)"
              :icon="Close"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  Delete,
  Close,
  Download
} from '@element-plus/icons-vue'

const loading = ref(false)
const tasks = ref<any[]>([])
let refreshTimer: any = null

// 从localStorage加载已下载的任务ID
const loadDownloadedTasks = (): Set<string> => {
  try {
    const saved = localStorage.getItem('downloadedTasks')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch {
    return new Set()
  }
}

// 保存已下载的任务ID到localStorage
const saveDownloadedTasks = (tasks: Set<string>) => {
  try {
    localStorage.setItem('downloadedTasks', JSON.stringify([...tasks]))
  } catch (error) {
    console.error('保存已下载任务失败:', error)
  }
}

const downloadedTasks = ref<Set<string>>(loadDownloadedTasks())

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'info',
    downloading: '',
    paused: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const refreshTasks = async (showLoading = false) => {
  if (showLoading) {
    loading.value = true
  }
  
  try {
    // 获取所有任务
    const history = await window.electronAPI.download.getHistory()
    tasks.value = history
    
    // 检查是否有进行中的任务，决定是否继续自动刷新
    const hasActiveTasks = history.some((t: any) => 
      ['pending', 'downloading', 'processing'].includes(t.status)
    )
    
    if (!hasActiveTasks && refreshTimer) {
      // 如果没有进行中的任务，停止自动刷新
      stopAutoRefresh()
    } else if (hasActiveTasks && !refreshTimer) {
      // 如果有进行中的任务但没有定时器，启动自动刷新
      startAutoRefreshTimer()
    }
  } catch (error) {
    console.error('刷新任务失败:', error)
    if (showLoading) {
      ElMessage.error('刷新任务失败')
    }
  } finally {
    if (showLoading) {
      loading.value = false
    }
  }
}

// 下载任务文件到本地
const downloadTask = async (task: any) => {
  try {
    // 构建默认文件名：DECODED_ZZ-01_20251010 或 DECODED_ZZ-01_20251010_20251011
    const datePart = task.startDate && task.endDate
      ? (task.startDate === task.endDate ? task.startDate : `${task.startDate}_${task.endDate}`)
      : 'alldate'
    
    const defaultFileName = `DECODED_${task.messageType}_${datePart}.${task.format || 'csv'}`
    
    // 弹出保存对话框让用户选择保存位置
    const result = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [
        { name: `${task.format?.toUpperCase() || 'CSV'} 文件`, extensions: [task.format || 'csv'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled || !result.filePath) {
      return
    }
    
    // 下载任务文件到指定位置
    await window.electronAPI.download.downloadTaskFile(task.id, result.filePath)
    
    // 标记为已下载并持久化保存
    downloadedTasks.value.add(task.id)
    saveDownloadedTasks(downloadedTasks.value)
    
    ElMessage.success('文件已保存')
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(error.message || '下载文件失败')
  }
}

const cancelTask = async (taskId: string) => {
  try {
    await ElMessageBox.confirm('确定要取消该任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await window.electronAPI.download.cancelTask(taskId)
    ElMessage.success('任务已取消')
    refreshTasks(true)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('取消失败')
    }
  }
}

const clearCompletedTasks = async () => {
  try {
    await ElMessageBox.confirm('确定要清理所有已完成的任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    // 清理7天前的任务
    const count = await window.electronAPI.download.clearHistory(0)
    
    // 清理已下载任务的记录（清理所有，因为任务都被删除了）
    downloadedTasks.value.clear()
    saveDownloadedTasks(downloadedTasks.value)
    
    ElMessage.success(`已清理 ${count} 个任务`)
    refreshTasks(true)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

// 启动定时器
const startAutoRefreshTimer = () => {
  if (refreshTimer) return
  
  // 每500毫秒自动刷新一次
  refreshTimer = setInterval(() => {
    refreshTasks()
  }, 500)
}

// 启动自动刷新
const startAutoRefresh = () => {
  // 立即刷新一次
  refreshTasks()
  
  // refreshTasks内部会判断是否需要启动定时器
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  startAutoRefresh()
  
  // 监听任务事件
  window.electronAPI.on('download:task-updated', () => {
    refreshTasks()
  })
  
  window.electronAPI.on('download:completed', () => {
    refreshTasks()
  })
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style lang="scss" scoped>
.tasks-page {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      gap: 10px;
    }
  }
}
</style>
