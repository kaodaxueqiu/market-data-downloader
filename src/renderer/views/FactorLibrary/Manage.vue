<template>
  <div class="factor-manage-page">
    <div class="page-header">
      <h2>⚙️ 因子管理</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadJobs">刷新</el-button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-section">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="等待中" value="pending" />
            <el-option label="运行中" value="running" />
            <el-option label="成功" value="succeeded" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadJobs">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总任务数</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.succeeded }}</div>
        <div class="stat-label">成功</div>
      </div>
      <div class="stat-card running">
        <div class="stat-value">{{ stats.running }}</div>
        <div class="stat-label">运行中</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-label">失败</div>
      </div>
    </div>

    <!-- 任务列表表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="jobs"
        style="width: 100%"
        v-loading="loading"
        @row-click="viewDetail"
      >
        <el-table-column prop="id" label="任务ID" width="120">
          <template #default="scope">
            <el-text style="font-family: monospace; cursor: pointer;" type="primary">
              {{ scope.row.id?.toString().slice(-8) || '-' }}
            </el-text>
          </template>
        </el-table-column>
        <el-table-column prop="factor_code" label="因子代码" width="150">
          <template #default="scope">
            <el-text style="font-family: monospace; font-weight: 600;">
              {{ scope.row.factor_code }}
            </el-text>
          </template>
        </el-table-column>
        <el-table-column prop="repo_name" label="仓库" width="150">
          <template #default="scope">
            {{ scope.row.repo_owner }}/{{ scope.row.repo_name }}
          </template>
        </el-table-column>
        <el-table-column prop="calc_date" label="计算日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="scope">
            <el-button link type="primary" size="small" @click.stop="viewDetail(scope.row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button link type="primary" size="small" @click.stop="viewLogs(scope.row)">
              <el-icon><Document /></el-icon>
              日志
            </el-button>
            <el-button
              link
              type="success"
              size="small"
              @click.stop="downloadResult(scope.row)"
              v-if="scope.row.status === 'succeeded'"
            >
              <el-icon><Download /></el-icon>
              结果
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty v-if="!loading && jobs.length === 0" description="暂无任务记录" />

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadJobs"
          @size-change="loadJobs"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`任务详情`"
      width="800px"
    >
      <div v-if="selectedJob" class="job-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务ID">
            <el-text style="font-family: monospace;">{{ selectedJob.id }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(selectedJob.status)">
              {{ getStatusLabel(selectedJob.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="因子代码">
            <el-text style="font-family: monospace; font-weight: 600;">
              {{ selectedJob.factor_code }}
            </el-text>
          </el-descriptions-item>
          <el-descriptions-item label="仓库">
            {{ selectedJob.repo_owner }}/{{ selectedJob.repo_name }}
          </el-descriptions-item>
          <el-descriptions-item label="分支">{{ selectedJob.branch }}</el-descriptions-item>
          <el-descriptions-item label="计算日期">{{ selectedJob.calc_date }}</el-descriptions-item>
          <el-descriptions-item label="因子文件" :span="2">
            <el-text style="font-family: monospace; font-size: 12px;">
              {{ selectedJob.factor_file }}
            </el-text>
          </el-descriptions-item>
          <el-descriptions-item label="执行函数">{{ selectedJob.factor_func }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(selectedJob.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatTime(selectedJob.started_at) }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ formatTime(selectedJob.finished_at) }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedJob.error_message" class="error-section">
          <h4>错误信息</h4>
          <el-alert type="error" :title="selectedJob.error_message" :closable="false" />
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="viewLogs(selectedJob)">查看日志</el-button>
        <el-button
          type="success"
          @click="downloadResult(selectedJob)"
          v-if="selectedJob?.status === 'succeeded'"
        >
          下载结果
        </el-button>
      </template>
    </el-dialog>

    <!-- 日志对话框 -->
    <el-dialog
      v-model="logDialogVisible"
      :title="`执行日志 - ${selectedJob?.factor_code}`"
      width="900px"
      top="5vh"
    >
      <div class="log-container" v-loading="loadingLogs">
        <div class="log-toolbar">
          <el-button size="small" :icon="Refresh" @click="refreshLogs">刷新日志</el-button>
        </div>
        <pre class="log-content">{{ logContent || '暂无日志' }}</pre>
      </div>
      <template #footer>
        <el-button @click="logDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, View, Document, Download } from '@element-plus/icons-vue'

interface Job {
  id: string | number
  factor_code: string
  factor_file: string
  factor_func: string
  repo_owner: string
  repo_name: string
  branch: string
  calc_date: string
  status: string
  created_at: string
  started_at?: string
  finished_at?: string
  error_message?: string
}

// 加载状态
const loading = ref(false)
const loadingLogs = ref(false)

// 数据
const jobs = ref<Job[]>([])
const selectedJob = ref<Job | null>(null)
const logContent = ref('')

// 对话框
const detailDialogVisible = ref(false)
const logDialogVisible = ref(false)

// 筛选表单
const filterForm = reactive({
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 统计数据
const stats = computed(() => {
  return {
    total: jobs.value.length,
    succeeded: jobs.value.filter(j => j.status === 'succeeded').length,
    running: jobs.value.filter(j => j.status === 'running').length,
    failed: jobs.value.filter(j => j.status === 'failed').length
  }
})

// 加载任务列表
const loadJobs = async () => {
  loading.value = true
  try {
    // 设置API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (!defaultKey) {
      ElMessage.error('请先配置 API Key')
      return
    }
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('获取API Key失败')
      return
    }
    await window.electronAPI.factor.setApiKey(fullApiKey)
    
    const result = await window.electronAPI.factor.getMyJobs({
      status: filterForm.status || undefined,
      page: pagination.page,
      page_size: pagination.pageSize
    })
    
    if (result.code === 200) {
      jobs.value = result.data?.jobs || []
      pagination.total = result.data?.total || 0
    }
  } catch (error: any) {
    console.error('加载任务列表失败:', error)
    ElMessage.error('加载任务列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 重置筛选
const resetFilter = () => {
  filterForm.status = ''
  pagination.page = 1
  loadJobs()
}

// 查看详情
const viewDetail = (job: Job) => {
  selectedJob.value = job
  detailDialogVisible.value = true
}

// 查看日志
const viewLogs = async (job: Job | null) => {
  if (!job) return
  
  selectedJob.value = job
  logDialogVisible.value = true
  await refreshLogs()
}

// 刷新日志
const refreshLogs = async () => {
  if (!selectedJob.value) return
  
  loadingLogs.value = true
  try {
    const result = await window.electronAPI.factor.getJobLogs(String(selectedJob.value.id))
    if (result.code === 200) {
      logContent.value = result.data?.logs || '暂无日志'
    }
  } catch (error: any) {
    console.error('加载日志失败:', error)
    logContent.value = '加载日志失败: ' + error.message
  } finally {
    loadingLogs.value = false
  }
}

// 下载结果
const downloadResult = async (job: Job | null) => {
  if (!job) return
  
  try {
    const result = await window.electronAPI.factor.getJobResult(String(job.id))
    if (result.code === 200) {
      ElMessage.success('结果获取成功')
      // TODO: 处理下载逻辑
      console.log('下载结果:', result.data)
    }
  } catch (error: any) {
    console.error('获取结果失败:', error)
    ElMessage.error('获取结果失败: ' + error.message)
  }
}

// 格式化时间
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 获取状态类型
const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    pending: 'warning',
    running: 'primary',
    succeeded: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

// 获取状态标签
const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    succeeded: '成功',
    failed: '失败'
  }
  return labels[status] || status
}

onMounted(() => {
  loadJobs()
})
</script>

<style scoped lang="scss">
.factor-manage-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .filter-section {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 20px;

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

      .stat-value {
        font-size: 32px;
        font-weight: bold;
        color: #303133;
        margin-bottom: 8px;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
      }

      &.success {
        border-left: 4px solid #67C23A;
        .stat-value { color: #67C23A; }
      }

      &.running {
        border-left: 4px solid #409EFF;
        .stat-value { color: #409EFF; }
      }

      &.failed {
        border-left: 4px solid #F56C6C;
        .stat-value { color: #F56C6C; }
      }
    }
  }

  .table-card {
    .pagination-wrapper {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
  }

  .job-detail {
    .error-section {
      margin-top: 20px;

      h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #303133;
      }
    }
  }

  .log-container {
    .log-toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }

    .log-content {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      max-height: 500px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}
</style>
