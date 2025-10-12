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
        <el-table-column label="类型" width="150">
          <template #default="scope">
            <el-tag v-if="scope.row.type === 'static_download'" type="success">
              静态数据
            </el-tag>
            <el-tag v-else type="primary">
              行情数据
            </el-tag>
            <div style="font-size: 12px; margin-top: 5px; color: #909399">
              {{ scope.row.messageType || scope.row.tableName }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="下载条件" width="280">
          <template #default="scope">
            <div style="font-size: 12px; line-height: 1.6">
              <!-- 行情数据条件 -->
              <template v-if="scope.row.type !== 'static_download'">
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
                <div v-if="!scope.row.symbols && !scope.row.startDate && !scope.row.startTime">
                  <el-tag size="small" type="">全部数据</el-tag>
                </div>
              </template>
              
              <!-- 静态数据条件 -->
              <template v-else>
                <div v-if="scope.row.request?.columns && scope.row.request.columns.length > 0" style="margin-bottom: 4px">
                  <el-tag size="small" type="primary">字段</el-tag> 
                  {{ scope.row.request.columns.length }} 个
                </div>
                <div v-if="scope.row.request?.date_range" style="margin-bottom: 4px">
                  <el-tag size="small" type="success">日期</el-tag> 
                  {{ scope.row.request.date_range.start_date || '不限' }} ~ {{ scope.row.request.date_range.end_date || '不限' }}
                </div>
                <div v-if="scope.row.request?.conditions" style="margin-bottom: 4px">
                  <el-tag size="small" type="warning">条件</el-tag> 
                  {{ Object.keys(scope.row.request.conditions).length }} 个
                </div>
                <div v-if="!scope.row.request?.columns && !scope.row.request?.date_range && !scope.row.request?.conditions">
                  <el-tag size="small" type="">全表数据</el-tag>
                </div>
              </template>
              
              <div style="margin-top: 4px">
                <el-tag size="small" type="info">格式</el-tag> 
                {{ scope.row.format?.toUpperCase() || 'CSV' }}
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
const staticTasks = ref<any[]>([])  // 静态数据任务列表
let refreshTimer: any = null
let staticRefreshTimer: any = null  // 静态任务刷新定时器

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

// 从localStorage加载静态任务列表
const loadStaticTasks = (): any[] => {
  try {
    const saved = localStorage.getItem('staticDownloadTasks')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// 保存静态任务列表到localStorage
const saveStaticTasks = (tasks: any[]) => {
  try {
    localStorage.setItem('staticDownloadTasks', JSON.stringify(tasks))
  } catch (error) {
    console.error('保存静态任务失败:', error)
  }
}

// 添加静态任务
const addStaticTask = (taskId: string, request: any, apiKey: string) => {
  const newTask = {
    id: taskId,
    type: 'static_download',
    tableName: request.table_name,
    status: 'pending',
    progress: 0,
    request: request,
    apiKey: apiKey,
    format: request.format,
    createdAt: new Date().toISOString()
  }
  
  staticTasks.value = [newTask, ...staticTasks.value]
  saveStaticTasks(staticTasks.value)
  
  // 启动轮询
  startStaticTaskPolling(taskId, apiKey)
}

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
    // 获取行情数据任务
    const marketTasks = await window.electronAPI.download.getHistory()
    
    // 获取静态数据任务（从本地）
    const localStaticTasks = loadStaticTasks()
    
    // 合并所有任务
    tasks.value = [...marketTasks, ...localStaticTasks]
    
    // 检查是否有进行中的任务，决定是否继续自动刷新
    const hasActiveTasks = tasks.value.some((t: any) => 
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

// 轮询单个静态任务状态
const startStaticTaskPolling = async (taskId: string, apiKey: string) => {
  console.log('🔄 开始轮询静态任务:', taskId)
  
  const poll = async () => {
    try {
      const taskData = await window.electronAPI.staticDownload.getTaskStatus(taskId, apiKey)
      console.log('📊 静态任务状态:', taskData.status, '进度:', taskData.progress)
      
      // 更新本地任务状态
      const taskIndex = staticTasks.value.findIndex(t => t.id === taskId)
      if (taskIndex !== -1) {
        staticTasks.value[taskIndex] = {
          ...staticTasks.value[taskIndex],
          status: taskData.status,
          progress: taskData.progress || 0,
          result: taskData.result,
          error: taskData.error,
          message: taskData.message,
          completedAt: taskData.completed_at
        }
        saveStaticTasks(staticTasks.value)
        
        // 刷新任务列表显示
        await refreshTasks(false)
      }
      
      // 如果任务完成或失败，停止轮询
      if (taskData.status === 'completed') {
        console.log('✅ 静态任务完成:', taskId)
        ElMessage.success(`任务完成！共 ${taskData.result?.record_count || 0} 条记录`)
      } else if (taskData.status === 'failed') {
        console.log('❌ 静态任务失败:', taskId, taskData.error)
        ElMessage.error(`任务失败: ${taskData.error}`)
      } else {
        // 继续轮询
        setTimeout(poll, 2000)  // 每2秒查询一次
      }
    } catch (error: any) {
      console.error('查询静态任务状态失败:', error)
      // 继续轮询，不中断
      setTimeout(poll, 3000)
    }
  }
  
  // 开始轮询
  poll()
}

// 下载任务文件到本地
const downloadTask = async (task: any) => {
  try {
    let defaultFileName: string
    
    // 根据任务类型构建默认文件名
    if (task.type === 'static_download') {
      // 静态数据：table_name_timestamp.format
      defaultFileName = task.result?.file_name || `${task.tableName}_${Date.now()}.${task.format || 'csv'}`
    } else {
      // 行情数据：DECODED_ZZ-01_20251010
      const datePart = task.startDate && task.endDate
        ? (task.startDate === task.endDate ? task.startDate : `${task.startDate}_${task.endDate}`)
        : 'alldate'
      defaultFileName = `DECODED_${task.messageType}_${datePart}.${task.format || 'csv'}`
    }
    
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
    
    // 根据任务类型下载文件
    if (task.type === 'static_download') {
      // 静态数据：调用 staticDownload API
      if (!task.result?.file_id) {
        ElMessage.error('任务未完成或文件不存在')
        return
      }
      
      const savePath = result.filePath.substring(0, result.filePath.lastIndexOf('\\') || result.filePath.lastIndexOf('/'))
      const fileName = result.filePath.substring((result.filePath.lastIndexOf('\\') || result.filePath.lastIndexOf('/')) + 1)
      
      await window.electronAPI.staticDownload.downloadFile(
        task.result.file_id,
        savePath,
        fileName,
        task.apiKey
      )
    } else {
      // 行情数据：调用 download API
      await window.electronAPI.download.downloadTaskFile(task.id, result.filePath)
    }
    
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
    
    // 清理行情数据任务
    const count = await window.electronAPI.download.clearHistory(0)
    
    // 清理静态数据任务（本地存储）
    staticTasks.value = staticTasks.value.filter(t => 
      t.status !== 'completed' && t.status !== 'failed'
    )
    saveStaticTasks(staticTasks.value)
    
    // 清理已下载任务的记录
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
  // 加载静态任务
  staticTasks.value = loadStaticTasks()
  
  // 恢复正在进行中的静态任务的轮询
  staticTasks.value.forEach(task => {
    if (task.status === 'pending' || task.status === 'processing') {
      console.log('🔄 恢复静态任务轮询:', task.id)
      startStaticTaskPolling(task.id, task.apiKey)
    }
  })
  
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
