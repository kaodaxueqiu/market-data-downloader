<template>
  <div class="history-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下载历史记录</span>
          <el-button type="danger" @click="clearHistory" :icon="Delete">
            清理历史
          </el-button>
        </div>
      </template>
      
      <el-table
        :data="historyData"
        style="width: 100%"
        empty-text="暂无历史记录"
        v-loading="loading"
      >
        <el-table-column prop="startTime" label="下载时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.startTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="messageType" label="消息类型" width="120" />
        <el-table-column label="日期范围" width="200">
          <template #default="scope">
            {{ scope.row.startDate }} - {{ scope.row.endDate }}
          </template>
        </el-table-column>
        <el-table-column prop="format" label="格式" width="80">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.format?.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录数" width="100">
          <template #default="scope">
            {{ scope.row.totalRecords || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="文件大小" width="100">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed' && scope.row.savePath"
              link
              type="primary"
              @click="openFile(scope.row.savePath)"
            >
              打开文件
            </el-button>
            <el-button
              v-if="scope.row.status === 'failed'"
              link
              type="warning"
              @click="showError(scope.row)"
            >
              查看错误
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const loading = ref(false)
const historyData = ref<any[]>([])

const formatTime = (time: string | Date) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const openFile = async (filePath: string) => {
  if (filePath) {
    await window.electronAPI.shell.showItemInFolder(filePath)
  }
}

const showError = (task: any) => {
  ElMessageBox.alert(task.error || '未知错误', '错误详情', {
    confirmButtonText: '确定',
    type: 'error'
  })
}

const clearHistory = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      '清理多少天前的历史记录？',
      '清理历史',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^[1-9]\d*$/,
        inputErrorMessage: '请输入有效的天数',
        inputValue: '7'
      }
    )
    
    const days = parseInt(value)
    const count = await window.electronAPI.download.clearHistory(days)
    ElMessage.success(`已清理 ${count} 条历史记录`)
    loadHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

const loadHistory = async () => {
  loading.value = true
  try {
    historyData.value = await window.electronAPI.download.getHistory()
  } catch (error) {
    console.error('加载历史记录失败:', error)
    ElMessage.error('加载历史记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style lang="scss" scoped>
.history-page {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
