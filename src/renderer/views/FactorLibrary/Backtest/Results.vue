<template>
  <div class="backtest-results">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2>回测结果</h2>
      <span class="subtitle">查看已完成的回测任务结果</span>
    </div>

    <!-- 结果列表 -->
    <el-card>
      <el-table 
        :data="tasks" 
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="任务名称" prop="task_name" min-width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="goToDetail(row.task_id)">
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
        
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.completed_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">
            {{ calcDuration(row.started_at, row.completed_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="primary"
              @click="goToDetail(row.task_id)"
            >
              查看结果
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 空状态 -->
      <el-empty 
        v-if="!loading && tasks.length === 0" 
        description="暂无已完成的回测任务"
      />
      
      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="total > 0">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

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

// 加载已完成的任务列表
const loadTasks = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.backtest.getTasks({
      page: currentPage.value,
      page_size: pageSize.value,
      status: 'completed'  // 只获取已完成的任务
    })
    
    if (result.success && result.data) {
      tasks.value = result.data.tasks || []
      total.value = result.data.total || 0
    } else {
      ElMessage.error(result.error || '获取回测结果失败')
    }
  } catch (error: any) {
    ElMessage.error('获取回测结果失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 跳转到结果详情
const goToDetail = (taskId: string) => {
  router.push(`/factor-library/backtest/result/${taskId}`)
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped lang="scss">
.backtest-results {
  .page-header {
    margin-bottom: 20px;
    
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
  
  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
