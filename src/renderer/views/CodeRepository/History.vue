<template>
  <div class="history-page">
    <div class="page-header">
      <h2>执行记录</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadTasks">刷新</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="statusFilter" placeholder="全部状态" clearable @change="loadTasks">
        <el-option label="全部状态" value="" />
        <el-option label="等待中" value="pending" />
        <el-option label="运行中" value="running" />
        <el-option label="已完成" value="success" />
        <el-option label="已失败" value="failed" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-select v-model="repoFilter" placeholder="全部仓库" clearable @change="loadTasks">
        <el-option label="全部仓库" value="" />
        <el-option
          v-for="repo in uniqueRepos"
          :key="repo"
          :label="repo"
          :value="repo"
        />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        @change="loadTasks"
      />
    </div>

    <!-- 任务列表 -->
    <div class="tasks-table">
      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="task_id" label="任务ID" width="180" show-overflow-tooltip />
        <el-table-column prop="repo_name" label="仓库" width="150" />
        <el-table-column prop="version" label="版本" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small">{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="started_at" label="开始时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.started_at) }}
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="100" align="right">
          <template #default="{ row }">
            {{ formatDuration(row.duration_seconds) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row.task_id)">
              详情 →
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadTasks"
        @current-change="loadTasks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import modelRunnerService, { type Task, type TaskStatus } from '@/services/modelRunner.service'

const router = useRouter()
const loading = ref(false)
const tasks = ref<Task[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

// 筛选条件
const statusFilter = ref('')
const repoFilter = ref('')
const dateRange = ref<string[]>([])

// 获取唯一的仓库列表
const uniqueRepos = computed(() => {
  const repos = new Set(tasks.value.map(t => t.repo_name))
  return Array.from(repos)
})

// 加载任务列表
const loadTasks = async () => {
  loading.value = true

  try {
    const params: any = {
      page: page.value,
      page_size: pageSize.value
    }

    if (statusFilter.value) params.status = statusFilter.value
    if (repoFilter.value) params.repo = repoFilter.value
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }

    const result = await modelRunnerService.getTasks(params)

    if (result.success) {
      tasks.value = result.data.items || []
      total.value = result.data.total || 0
    }
  } catch (err: any) {
    console.error('加载任务列表失败:', err)
  } finally {
    loading.value = false
  }
}

// 获取状态标签类型
const getStatusType = (status: TaskStatus) => {
  const types: Record<TaskStatus, any> = {
    pending: 'info',
    running: 'warning',
    success: 'success',
    failed: 'danger',
    cancelled: ''
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: TaskStatus) => {
  const texts: Record<TaskStatus, string> = {
    pending: '等待中',
    running: '运行中',
    success: '已完成',
    failed: '已失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

// 格式化时间
const formatTime = (timeStr: string): string => {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化耗时
const formatDuration = (seconds?: number): string => {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${minutes}分`
}

// 查看详情
const viewDetail = (taskId: string) => {
  router.push(`/code-repository/history/${taskId}`)
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped lang="scss">
.history-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .el-select {
      width: 150px;
    }
  }

  .tasks-table {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .pagination-bar {
    display: flex;
    justify-content: center;
  }
}
</style>

