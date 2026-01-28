<template>
  <div class="my-content">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div 
        class="stat-card" 
        v-for="stat in statsList" 
        :key="stat.key" 
        :class="[stat.key, { active: statusFilter === stat.filterValue }]"
        @click="handleStatClick(stat.filterValue)"
      >
        <div class="stat-icon">
          <el-icon :size="24">
            <component :is="stat.icon" />
          </el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats[stat.key] || 0 }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 列表卡片 -->
    <div class="list-card">
      <div class="card-header">
        <div class="header-left">
          <div class="header-title">
            <el-icon class="title-icon"><List /></el-icon>
            <span>我的申请</span>
          </div>
          <el-tag type="info" size="small" effect="plain">共 {{ total }} 条</el-tag>
        </div>
        <div class="header-right">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索字段名称..."
            clearable
            style="width: 200px"
            @clear="loadList"
            @keyup.enter="loadList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button :icon="Refresh" @click="handleRefresh" :loading="loading" circle />
        </div>
      </div>
      
      <div class="card-body">
        <!-- 加载中 -->
        <div v-if="loading && list.length === 0" class="loading-wrapper">
          <el-icon class="is-loading" :size="40"><Loading /></el-icon>
          <span>加载中...</span>
        </div>

        <!-- 空状态 -->
        <el-empty v-else-if="list.length === 0" description="暂无申请记录">
          <template #image>
            <el-icon :size="60" color="#c0c4cc"><Document /></el-icon>
          </template>
        </el-empty>

        <!-- 列表 -->
        <div v-else class="order-list">
          <div 
            v-for="item in list" 
            :key="item.id" 
            class="order-item"
            @click="handleViewDetail(item.id)"
          >
            <div class="order-main">
              <div class="order-header">
                <span class="order-id">#{{ item.id }}</span>
                <el-tag :type="getStatusType(item.status)" size="small" effect="light">
                  {{ getStatusLabel(item.status) }}
                </el-tag>
              </div>
              <div class="order-field">{{ item.field_name }}</div>
              <div class="order-desc">{{ item.field_desc || '暂无描述' }}</div>
            </div>
            <div class="order-meta">
              <div class="meta-item">
                <el-icon><Clock /></el-icon>
                <span>{{ formatTime(item.created_at) }}</span>
              </div>
              <div class="meta-item" v-if="item.processed_by">
                <el-icon><User /></el-icon>
                <span>{{ item.processed_by }}</span>
              </div>
            </div>
            <div class="order-arrow">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-wrapper" v-if="total > pageSize">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            background
            @current-change="loadList"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  List, Refresh, Loading, Document, Clock, User, ArrowRight, Search,
  Tickets, Clock as ClockIcon, CircleCheck, CircleClose, Grid
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'view-detail', id: number): void
}>()

interface WorkOrder {
  id: number
  user_id: string
  user_name: string
  field_name: string
  field_desc: string
  calc_logic: string
  status: string
  reject_reason: string
  admin_note: string
  created_at: string
  updated_at: string
  processed_by: string
  completed_at: string | null
}

const loading = ref(false)
const list = ref<WorkOrder[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const statusFilter = ref('all')
const searchKeyword = ref('')

const stats = reactive<Record<string, number>>({
  pending: 0,
  processing: 0,
  completed: 0,
  rejected: 0,
  total: 0
})

const statsList = [
  { key: 'total', label: '全部', filterValue: 'all', icon: Grid },
  { key: 'pending', label: '待处理', filterValue: 'pending', icon: ClockIcon },
  { key: 'processing', label: '处理中', filterValue: 'processing', icon: Tickets },
  { key: 'completed', label: '已完成', filterValue: 'completed', icon: CircleCheck },
  { key: 'rejected', label: '已拒绝', filterValue: 'rejected', icon: CircleClose }
]

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    processing: 'primary',
    completed: 'success',
    rejected: 'danger'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    rejected: '已拒绝'
  }
  return map[status] || status
}

const formatTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  
  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return `${days}天前`
  }
  
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const loadStats = async () => {
  try {
    const result = await window.electronAPI.workorder.getStats()
    if (result.success && result.data) {
      Object.assign(stats, result.data)
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const loadList = async () => {
  loading.value = true
  
  try {
    const result = await window.electronAPI.workorder.getMyList({
      page: page.value,
      page_size: pageSize.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value
    })
    
    if (result.success && result.data) {
      let items = result.data.list || []
      
      // 前端搜索过滤
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        items = items.filter((item: WorkOrder) => 
          item.field_name.toLowerCase().includes(keyword) ||
          (item.field_desc && item.field_desc.toLowerCase().includes(keyword))
        )
      }
      
      list.value = items
      total.value = result.data.total || 0
    } else {
      ElMessage.error(result.error || '加载失败')
    }
  } catch (error: any) {
    console.error('加载列表失败:', error)
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleStatClick = (filterValue: string) => {
  statusFilter.value = filterValue
  page.value = 1
  loadList()
}

const handleRefresh = () => {
  loadStats()
  loadList()
}

const handleViewDetail = (id: number) => {
  emit('view-detail', id)
}

onMounted(() => {
  loadStats()
  loadList()
})
</script>

<style scoped lang="scss">
.my-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
  
  &.active {
    border-color: currentColor;
    background: linear-gradient(135deg, rgba(var(--card-rgb), 0.1), rgba(var(--card-rgb), 0.05));
  }

  .stat-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .stat-info {
    flex: 1;
    
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-top: 4px;
    }
  }

  &.total {
    --card-rgb: 64, 158, 255;
    .stat-icon { background: linear-gradient(135deg, #409eff, #79bbff); }
    .stat-value { color: #409eff; }
  }
  &.pending {
    --card-rgb: 230, 162, 60;
    .stat-icon { background: linear-gradient(135deg, #e6a23c, #f3d19e); }
    .stat-value { color: #e6a23c; }
  }
  &.processing {
    --card-rgb: 64, 158, 255;
    .stat-icon { background: linear-gradient(135deg, #409eff, #79bbff); }
    .stat-value { color: #409eff; }
  }
  &.completed {
    --card-rgb: 103, 194, 58;
    .stat-icon { background: linear-gradient(135deg, #67c23a, #95d475); }
    .stat-value { color: #67c23a; }
  }
  &.rejected {
    --card-rgb: 245, 108, 108;
    .stat-icon { background: linear-gradient(135deg, #f56c6c, #fab6b6); }
    .stat-value { color: #f56c6c; }
  }
}

.list-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: #303133;

      .title-icon {
        font-size: 22px;
        color: #409eff;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.card-body {
  padding: 24px;
}

.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #909399;
  gap: 16px;
  
  .is-loading {
    color: #409eff;
  }
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  display: flex;
  align-items: center;
  padding: 20px 24px;
  background: #fafafa;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    background: #f0f7ff;
    border-color: #d9ecff;
    
    .order-arrow {
      transform: translateX(4px);
      color: #409eff;
    }
  }

  .order-main {
    flex: 1;
    min-width: 0;
    
    .order-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      
      .order-id {
        font-size: 13px;
        color: #909399;
        font-weight: 500;
      }
    }
    
    .order-field {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 6px;
    }
    
    .order-desc {
      font-size: 14px;
      color: #909399;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .order-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    margin-right: 20px;
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #909399;
      
      .el-icon {
        font-size: 14px;
      }
    }
  }

  .order-arrow {
    color: #c0c4cc;
    transition: all 0.2s ease;
    
    .el-icon {
      font-size: 18px;
    }
  }
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

@media (max-width: 1400px) {
  .stats-row {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .order-meta {
    display: none;
  }
}
</style>
