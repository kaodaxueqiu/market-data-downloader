<template>
  <div class="task-list">
    <div class="task-header">
      <h3>导出任务列表</h3>
      <div>
        <el-button size="small" @click="refresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button size="small" @click="clearCompleted" :disabled="!hasCompletedTasks">
          清理已完成
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="tasks.length === 0" class="empty-container">
      <el-empty description="暂无导出任务" />
    </div>

    <div v-else class="task-items">
      <el-card
        v-for="task in tasks"
        :key="task.id"
        class="task-card"
        :class="`task-${task.status}`"
      >
        <div class="task-content">
          <div class="task-info">
            <div class="task-title">
              <el-tag :type="getStatusType(task.status)" size="small">
                {{ getStatusText(task.status) }}
              </el-tag>
              <span class="task-type">{{ task.messageType }}</span>
              <span class="task-format">{{ task.format?.toUpperCase() || 'CSV' }}</span>
            </div>
            
            <div class="task-details">
              <div class="detail-row">
                <span class="detail-label">消息类型:</span>
                <span>{{ task.messageType }} {{ getMessageTypeName(task.messageType) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">日期范围:</span>
                <span>{{ task.startDate }} - {{ task.endDate }}</span>
              </div>
              <div v-if="task.startTime || task.endTime" class="detail-row">
                <span class="detail-label">时间范围:</span>
                <span>{{ formatTimeRange(task.startTime) }} - {{ formatTimeRange(task.endTime) }}</span>
              </div>
              <div v-if="task.symbols && task.symbols.length > 0" class="detail-row">
                <span class="detail-label">股票代码:</span>
                <span>{{ task.symbols.join(', ') }}</span>
              </div>
              <div v-else class="detail-row">
                <span class="detail-label">股票代码:</span>
                <span>全部</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">导出格式:</span>
                <span>{{ task.format?.toUpperCase() || 'CSV' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">创建时间:</span>
                <span>{{ formatTime(task.createdAt) }}</span>
              </div>
              <div v-if="task.completedAt" class="detail-row">
                <span class="detail-label">完成时间:</span>
                <span>{{ formatTime(task.completedAt) }}</span>
              </div>
              <div v-if="task.totalRecords" class="detail-row">
                <span class="detail-label">记录数量:</span>
                <span>{{ task.totalRecords.toLocaleString() }} 条</span>
              </div>
              <div v-if="task.fileSize" class="detail-row">
                <span class="detail-label">文件大小:</span>
                <span>{{ formatFileSize(task.fileSize) }}</span>
              </div>
            </div>

            <div v-if="task.status === 'processing'" class="task-progress">
              <el-progress
                :percentage="task.progress"
                :stroke-width="8"
                :format="(percentage: number) => `${percentage}%`"
              />
            </div>

            <div v-if="task.errorMessage" class="task-error">
              <el-alert
                :title="task.errorMessage"
                type="error"
                :closable="false"
                show-icon
              />
            </div>
          </div>

          <div class="task-actions">
            <el-button
              v-if="task.status === 'completed'"
              type="primary"
              size="small"
              @click="openFile(task)"
            >
              <el-icon><FolderOpened /></el-icon>
              打开文件
            </el-button>
            
            <el-button
              v-if="task.status === 'completed'"
              size="small"
              @click="downloadFile(task)"
            >
              <el-icon><Download /></el-icon>
              另存为
            </el-button>
            
            <el-button
              v-if="task.status === 'processing'"
              type="danger"
              size="small"
              @click="cancelTask(task)"
            >
              <el-icon><Close /></el-icon>
              取消
            </el-button>
            
            <el-button
              v-if="task.status === 'failed'"
              type="warning"
              size="small"
              @click="retryTask(task)"
            >
              <el-icon><RefreshRight /></el-icon>
              重试
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  Loading,
  FolderOpened,
  Download,
  Close,
  RefreshRight
} from '@element-plus/icons-vue'

interface Task {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  messageType: string
  symbols?: string[]
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  format: 'csv' | 'json'
  savePath?: string
  createdAt: string
  completedAt?: string
  errorMessage?: string
  fileSize?: number
  totalRecords?: number
  fileName?: string
  downloadUrl?: string  // 添加下载链接字段
}

const tasks = ref<Task[]>([])
const loading = ref(false)
let refreshTimer: NodeJS.Timeout | null = null

const hasCompletedTasks = computed(() => {
  return tasks.value.some(t => t.status === 'completed' || t.status === 'failed')
})

// 获取状态类型
const getStatusType = (status: string) => {
  const map: Record<string, any> = {
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '等待中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

// 格式化时间
const formatTime = (timestamp: string) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// 格式化时间范围（如：093000 -> 09:30:00）
const formatTimeRange = (time: string | undefined) => {
  if (!time) return '--:--:--'
  if (time.length !== 6 && time.length !== 4) return time
  
  // 如果是4位（如0930），补充秒
  if (time.length === 4) {
    time = time + '00'
  }
  
  const h = time.substring(0, 2)
  const m = time.substring(2, 4)
  const s = time.substring(4, 6)
  return `${h}:${m}:${s}`
}

// 获取消息类型名称
const getMessageTypeName = (code: string) => {
  const messageTypes: Record<string, string> = {
    'ZZ-01': '深圳股票快照',
    'ZZ-02': '深圳指数行情',
    'ZZ-03': '深圳成交量统计',
    'ZZ-04': '深圳盘后定价交易',
    'ZZ-05': '深圳逐笔委托',
    'ZZ-06': '深圳逐笔成交',
    'ZZ-31': '上海股票快照',
    'ZZ-32': '上海指数行情',
    'ZZ-33': '上海盘后固定价格',
    'ZZ-61': '中金所期货',
    'ZZ-62': '上期所期货',
    'ZZ-63': '能源所期货',
    'ZZ-64': '郑商所期货',
    'ZZ-66': '大商所期货',
    'ZZ-70': '广期所期货',
    'ZZ-91': '上交所期权快照',
    'ZZ-93': '深交所期权快照',
    'ZZ-94': '中金所期权快照',
    'ZZ-104': '港股通市场资金流向',
    'ZZ-105': '港股通北向实时额度'
  }
  return messageTypes[code] || ''
}

// 刷新任务列表
const refresh = async () => {
  loading.value = true
  try {
    const allTasks = await window.electronAPI.download.getTasks()
    
    // 调试：检查任务的downloadUrl
    console.log('获取到的任务列表:')
    allTasks.forEach((task: any) => {
      if (task.status === 'completed') {
        console.log(`任务 ${task.id}:`, {
          status: task.status,
          downloadUrl: task.downloadUrl,
          fileName: task.fileName,
          fileSize: task.fileSize
        })
      }
    })
    
    tasks.value = allTasks.sort((a: Task, b: Task) => {
      // 按创建时间倒序
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  } catch (error: any) {
    console.error('获取任务列表失败:', error)
    ElMessage.error('获取任务列表失败')
  } finally {
    loading.value = false
  }
}

// 清理已完成的任务
const clearCompleted = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理所有已完成和失败的任务吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await window.electronAPI.download.clearCompleted()
    ElMessage.success('清理成功')
    refresh()
  } catch (error) {
    // 用户取消
  }
}

// 打开文件
const openFile = async (task: Task) => {
  if (task.savePath && task.fileName) {
    const filePath = `${task.savePath}\\${task.fileName}`
    await window.electronAPI.shell.showItemInFolder(filePath)
  }
}

// 下载文件
const downloadFile = async (task: Task) => {
  console.log('开始下载任务文件:', task)
  
  // 如果任务还没完成，不能下载
  if (task.status !== 'completed') {
    ElMessage.warning('任务尚未完成，请等待')
    return
  }
  
  // 检查是否有下载链接
  if (!task.downloadUrl) {
    console.error('任务缺少downloadUrl:', task)
    ElMessage.error('没有可下载的文件')
    
    // 尝试刷新任务列表获取最新信息
    await refresh()
    return
  }
  
  console.log('下载链接:', task.downloadUrl)
  
  try {
    // 让用户选择保存位置
    const result = await window.electronAPI.dialog.showSaveDialog({
      defaultPath: `${task.messageType}_${task.startDate}_${task.endDate}.${task.format || 'csv'}`,
      filters: [
        task.format === 'json' 
          ? { name: 'JSON文件', extensions: ['json'] }
          : { name: 'CSV文件', extensions: ['csv'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      console.log('保存文件到:', result.filePath)
      
      // 直接使用任务中保存的downloadUrl下载文件
      await window.electronAPI.download.downloadTaskFile(task.id, result.filePath)
      ElMessage.success('文件下载成功')
      
      // 可选：打开文件所在文件夹
      const openFolder = await ElMessageBox.confirm(
        '文件下载成功，是否打开所在文件夹？',
        '提示',
        {
          confirmButtonText: '打开文件夹',
          cancelButtonText: '关闭',
          type: 'success'
        }
      ).catch(() => false)
      
      if (openFolder) {
        await window.electronAPI.shell.showItemInFolder(result.filePath)
      }
    }
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(error.message || '下载文件失败')
  }
}

// 取消任务
const cancelTask = async (task: Task) => {
  try {
    await ElMessageBox.confirm(
      '确定要取消这个任务吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await window.electronAPI.download.cancelTask(task.id)
    ElMessage.success('任务已取消')
    refresh()
  } catch (error) {
    // 用户取消
  }
}

// 重试任务
const retryTask = async (_task: Task) => {
  // TODO: 实现重试功能
  ElMessage.info('重试功能开发中')
}

// 自动刷新（处理中的任务）
const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    // 如果有处理中的任务，自动刷新
    if (tasks.value.some(t => t.status === 'processing')) {
      refresh()
    }
  }, 2000) // 每2秒刷新一次
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 监听任务事件
const setupEventListeners = () => {
  window.electronAPI.on('download:task-created', () => {
    refresh()
  })
  
  window.electronAPI.on('download:task-updated', () => {
    refresh()
  })
  
  window.electronAPI.on('download:completed', () => {
    refresh()
  })
}

onMounted(() => {
  refresh()
  startAutoRefresh()
  setupEventListeners()
})

onUnmounted(() => {
  stopAutoRefresh()
})

// 暴露方法给父组件
defineExpose({
  refresh
})
</script>

<style scoped>
.task-list {
  padding: 20px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.task-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;
}

.loading-container .is-loading {
  font-size: 32px;
  margin-bottom: 10px;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.task-card {
  border-left: 4px solid transparent;
  transition: all 0.3s;
}

.task-card.task-pending {
  border-left-color: #909399;
}

.task-card.task-processing {
  border-left-color: #e6a23c;
}

.task-card.task-completed {
  border-left-color: #67c23a;
}

.task-card.task-failed {
  border-left-color: #f56c6c;
}

.task-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-info {
  flex: 1;
}

.task-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.task-type {
  font-weight: 600;
  font-size: 14px;
}

.task-format {
  color: #606266;
  font-size: 12px;
  padding: 2px 6px;
  background: #f0f2f5;
  border-radius: 3px;
}

.task-details {
  color: #606266;
  font-size: 13px;
  line-height: 1.8;
}

.task-progress {
  margin: 15px 0;
}

.task-error {
  margin-top: 15px;
}

.task-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 20px;
}

:deep(.el-card__body) {
  padding: 15px 20px;
}

:deep(.el-progress__text) {
  font-size: 12px !important;
}
</style>

