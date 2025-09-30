<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下载任务队列</span>
          <div class="header-actions">
            <el-button @click="refreshTasks" :icon="Refresh">刷新</el-button>
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
      >
        <el-table-column prop="id" label="任务ID" width="180" />
        <el-table-column prop="messageType" label="消息类型" width="120" />
        <el-table-column prop="dateRange" label="日期范围" width="200">
          <template #default="scope">
            {{ scope.row.startDate }} - {{ scope.row.endDate }}
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
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="scope">
            <el-button-group>
              <el-button
                v-if="scope.row.status === 'downloading'"
                size="small"
                @click="pauseTask(scope.row.id)"
                :icon="VideoPause"
              >
                暂停
              </el-button>
              <el-button
                v-if="scope.row.status === 'paused'"
                size="small"
                @click="resumeTask(scope.row.id)"
                :icon="VideoPlay"
              >
                继续
              </el-button>
              <el-button
                v-if="['downloading', 'paused'].includes(scope.row.status)"
                size="small"
                type="danger"
                @click="cancelTask(scope.row.id)"
                :icon="Close"
              >
                取消
              </el-button>
              <el-button
                v-if="scope.row.status === 'completed'"
                size="small"
                type="primary"
                @click="openFile(scope.row.savePath)"
                :icon="FolderOpened"
              >
                打开
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  Delete,
  VideoPause,
  VideoPlay,
  Close,
  FolderOpened
} from '@element-plus/icons-vue'

const loading = ref(false)
const tasks = ref<any[]>([])

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

const refreshTasks = async () => {
  loading.value = true
  try {
    // 获取所有任务
    const history = await window.electronAPI.download.getHistory()
    tasks.value = history
  } catch (error) {
    console.error('刷新任务失败:', error)
    ElMessage.error('刷新任务失败')
  } finally {
    loading.value = false
  }
}

const pauseTask = async (taskId: string) => {
  try {
    await window.electronAPI.download.pause(taskId)
    ElMessage.success('任务已暂停')
    refreshTasks()
  } catch (error) {
    ElMessage.error('暂停失败')
  }
}

const resumeTask = async (taskId: string) => {
  try {
    await window.electronAPI.download.resume(taskId)
    ElMessage.success('任务已恢复')
    refreshTasks()
  } catch (error) {
    ElMessage.error('恢复失败')
  }
}

const cancelTask = async (taskId: string) => {
  try {
    await ElMessageBox.confirm('确定要取消该任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await window.electronAPI.download.cancel(taskId)
    ElMessage.success('任务已取消')
    refreshTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('取消失败')
    }
  }
}

const openFile = async (filePath: string) => {
  if (filePath) {
    await window.electronAPI.shell.showItemInFolder(filePath)
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
    ElMessage.success(`已清理 ${count} 个任务`)
    refreshTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

onMounted(() => {
  refreshTasks()
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
