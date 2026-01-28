<template>
  <div class="admin-content">
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
        <div class="stat-badge" v-if="stat.key === 'pending' && stats.pending > 0">
          <span>需处理</span>
        </div>
      </div>
    </div>

    <!-- 管理列表 -->
    <div class="list-card">
      <div class="card-header">
        <div class="header-left">
          <div class="header-title">
            <el-icon class="title-icon"><Setting /></el-icon>
            <span>工单管理</span>
          </div>
          <el-tag type="info" size="small" effect="plain">共 {{ total }} 条</el-tag>
        </div>
        <div class="header-right">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索字段名称或申请人..."
            clearable
            style="width: 240px"
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
        <el-empty v-else-if="list.length === 0" description="暂无工单">
          <template #image>
            <el-icon :size="60" color="#c0c4cc"><Tickets /></el-icon>
          </template>
        </el-empty>

        <!-- 列表 -->
        <div v-else class="order-list">
          <div 
            v-for="item in filteredList" 
            :key="item.id" 
            class="order-item"
            :class="item.status"
          >
            <div class="order-main" @click="handleViewDetail(item)">
              <div class="order-header">
                <span class="order-id">#{{ item.id }}</span>
                <el-tag :type="getStatusType(item.status)" size="small" effect="light">
                  {{ getStatusLabel(item.status) }}
                </el-tag>
                <span class="order-user">
                  <el-icon><User /></el-icon>
                  {{ item.user_name }}
                </span>
              </div>
              <div class="order-field">{{ item.field_name }}</div>
              <div class="order-desc">{{ item.field_desc || '暂无描述' }}</div>
              <div class="order-time">
                <el-icon><Clock /></el-icon>
                {{ formatTime(item.created_at) }}
              </div>
            </div>
            <div class="order-actions">
              <el-button 
                v-if="item.status === 'pending'" 
                type="primary"
                @click="handleUpdateStatus(item, 'processing')"
                :loading="updating"
              >
                <el-icon><VideoPlay /></el-icon>
                接单
              </el-button>
              <el-button 
                v-if="item.status === 'processing'" 
                type="success"
                @click="handleComplete(item)"
              >
                <el-icon><CircleCheck /></el-icon>
                完成
              </el-button>
              <el-button 
                v-if="item.status === 'pending' || item.status === 'processing'" 
                type="danger"
                plain
                @click="handleReject(item)"
              >
                <el-icon><CircleClose /></el-icon>
                拒绝
              </el-button>
              <el-button 
                v-if="item.status === 'completed' || item.status === 'rejected'"
                type="info"
                plain
                @click="handleViewDetail(item)"
              >
                <el-icon><View /></el-icon>
                查看
              </el-button>
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

    <!-- 详情对话框 -->
    <el-dialog 
      v-model="showDetail" 
      title="工单详情" 
      width="650px"
      class="detail-dialog"
    >
      <div v-if="currentOrder" class="detail-content">
        <div class="detail-header">
          <div class="detail-id">#{{ currentOrder.id }}</div>
          <el-tag :type="getStatusType(currentOrder.status)" size="large">
            {{ getStatusLabel(currentOrder.status) }}
          </el-tag>
        </div>
        
        <div class="detail-section">
          <div class="section-title">基本信息</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">申请人</span>
              <span class="info-value">{{ currentOrder.user_name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">提交时间</span>
              <span class="info-value">{{ formatFullTime(currentOrder.created_at) }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.processed_by">
              <span class="info-label">处理人</span>
              <span class="info-value">{{ currentOrder.processed_by }}</span>
            </div>
            <div class="info-item" v-if="currentOrder.completed_at">
              <span class="info-label">完成时间</span>
              <span class="info-value">{{ formatFullTime(currentOrder.completed_at) }}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <div class="section-title">字段信息</div>
          <div class="field-box">
            <div class="field-name">{{ currentOrder.field_name }}</div>
            <div class="field-desc">{{ currentOrder.field_desc || '暂无描述' }}</div>
          </div>
        </div>
        
        <div class="detail-section" v-if="currentOrder.calc_logic">
          <div class="section-title">计算逻辑</div>
          <pre class="calc-logic">{{ currentOrder.calc_logic }}</pre>
        </div>
        
        <div class="detail-section" v-if="currentOrder.admin_note">
          <div class="section-title">管理员备注</div>
          <div class="admin-note">{{ currentOrder.admin_note }}</div>
        </div>
        
        <div class="detail-section" v-if="currentOrder.reject_reason">
          <div class="section-title">拒绝原因</div>
          <div class="reject-reason">{{ currentOrder.reject_reason }}</div>
        </div>
      </div>
    </el-dialog>

    <!-- 完成对话框 -->
    <el-dialog 
      v-model="showCompleteDialog" 
      title="完成工单" 
      width="500px"
      class="action-dialog"
    >
      <div class="dialog-tip">
        <el-icon color="#67c23a" :size="20"><CircleCheck /></el-icon>
        <span>确认将此工单标记为已完成？</span>
      </div>
      <el-form label-position="top">
        <el-form-item label="处理备注（选填）">
          <el-input 
            v-model="adminNote" 
            type="textarea" 
            :rows="4"
            placeholder="如：已添加到 zz_384 表，字段名为 xxx"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompleteDialog = false">取消</el-button>
        <el-button type="success" @click="confirmComplete" :loading="updating">
          <el-icon><CircleCheck /></el-icon>
          确认完成
        </el-button>
      </template>
    </el-dialog>

    <!-- 拒绝对话框 -->
    <el-dialog 
      v-model="showRejectDialog" 
      title="拒绝工单" 
      width="500px"
      class="action-dialog"
    >
      <div class="dialog-tip warning">
        <el-icon color="#f56c6c" :size="20"><CircleClose /></el-icon>
        <span>确认拒绝此工单？请填写拒绝原因。</span>
      </div>
      <el-form label-position="top">
        <el-form-item label="拒绝原因" required>
          <el-input 
            v-model="rejectReason" 
            type="textarea" 
            :rows="4"
            placeholder="请详细说明拒绝原因..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRejectDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmReject" :loading="updating">
          <el-icon><CircleClose /></el-icon>
          确认拒绝
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Setting, Refresh, Loading, Clock, User, Search, View,
  Tickets, CircleCheck, CircleClose, Grid, VideoPlay
} from '@element-plus/icons-vue'

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
const updating = ref(false)
const list = ref<WorkOrder[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const statusFilter = ref('pending')
const searchKeyword = ref('')

const showDetail = ref(false)
const showCompleteDialog = ref(false)
const showRejectDialog = ref(false)
const currentOrder = ref<WorkOrder | null>(null)
const adminNote = ref('')
const rejectReason = ref('')

const stats = reactive({
  pending: 0,
  processing: 0,
  completed: 0,
  rejected: 0,
  total: 0
})

const statsList = [
  { key: 'pending', label: '待处理', filterValue: 'pending', icon: Tickets },
  { key: 'processing', label: '处理中', filterValue: 'processing', icon: VideoPlay },
  { key: 'completed', label: '已完成', filterValue: 'completed', icon: CircleCheck },
  { key: 'rejected', label: '已拒绝', filterValue: 'rejected', icon: CircleClose },
  { key: 'total', label: '全部', filterValue: 'all', icon: Grid }
]

const filteredList = computed(() => {
  if (!searchKeyword.value) return list.value
  
  const keyword = searchKeyword.value.toLowerCase()
  return list.value.filter(item => 
    item.field_name.toLowerCase().includes(keyword) ||
    item.user_name.toLowerCase().includes(keyword) ||
    (item.field_desc && item.field_desc.toLowerCase().includes(keyword))
  )
})

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
    return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return `${days}天前`
  }
  
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const formatFullTime = (time: string) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
    const result = await window.electronAPI.workorder.getAllList({
      page: page.value,
      page_size: pageSize.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value
    })
    
    if (result.success && result.data) {
      list.value = result.data.list || []
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

const handleViewDetail = (order: WorkOrder) => {
  currentOrder.value = order
  showDetail.value = true
}

const handleUpdateStatus = async (order: WorkOrder, status: string) => {
  updating.value = true
  
  try {
    const result = await window.electronAPI.workorder.updateStatus(order.id, { status })
    
    if (result.success) {
      ElMessage.success('操作成功')
      loadList()
      loadStats()
    } else {
      ElMessage.error(result.error || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    updating.value = false
  }
}

const handleComplete = (order: WorkOrder) => {
  currentOrder.value = order
  adminNote.value = ''
  showCompleteDialog.value = true
}

const confirmComplete = async () => {
  if (!currentOrder.value) return
  
  updating.value = true
  
  try {
    const result = await window.electronAPI.workorder.updateStatus(currentOrder.value.id, {
      status: 'completed',
      admin_note: adminNote.value
    })
    
    if (result.success) {
      ElMessage.success('工单已完成')
      showCompleteDialog.value = false
      loadList()
      loadStats()
    } else {
      ElMessage.error(result.error || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    updating.value = false
  }
}

const handleReject = (order: WorkOrder) => {
  currentOrder.value = order
  rejectReason.value = ''
  showRejectDialog.value = true
}

const confirmReject = async () => {
  if (!currentOrder.value) return
  
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }
  
  updating.value = true
  
  try {
    const result = await window.electronAPI.workorder.updateStatus(currentOrder.value.id, {
      status: 'rejected',
      reject_reason: rejectReason.value
    })
    
    if (result.success) {
      ElMessage.success('工单已拒绝')
      showRejectDialog.value = false
      loadList()
      loadStats()
    } else {
      ElMessage.error(result.error || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    updating.value = false
  }
}

onMounted(() => {
  loadStats()
  loadList()
})
</script>

<style scoped lang="scss">
.admin-content {
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
  position: relative;
  overflow: hidden;

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
  
  .stat-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #f56c6c;
    color: #fff;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    animation: pulse 2s infinite;
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
  &.total {
    --card-rgb: 64, 158, 255;
    .stat-icon { background: linear-gradient(135deg, #909399, #c0c4cc); }
    .stat-value { color: #606266; }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
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
  transition: all 0.2s ease;
  border-left: 4px solid transparent;

  &:hover {
    background: #f5f7fa;
  }
  
  &.pending {
    border-left-color: #e6a23c;
    background: linear-gradient(90deg, rgba(230, 162, 60, 0.05), transparent);
  }
  &.processing {
    border-left-color: #409eff;
    background: linear-gradient(90deg, rgba(64, 158, 255, 0.05), transparent);
  }
  &.completed {
    border-left-color: #67c23a;
  }
  &.rejected {
    border-left-color: #f56c6c;
  }

  .order-main {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    
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
      
      .order-user {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #606266;
        margin-left: auto;
        
        .el-icon { font-size: 14px; }
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
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .order-time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #c0c4cc;
      
      .el-icon { font-size: 14px; }
    }
  }

  .order-actions {
    display: flex;
    gap: 8px;
    margin-left: 24px;
  }
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

// 详情对话框
.detail-content {
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 20px;
    
    .detail-id {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  .detail-section {
    margin-bottom: 24px;
    
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #909399;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    
    .info-item {
      .info-label {
        font-size: 13px;
        color: #909399;
        display: block;
        margin-bottom: 4px;
      }
      .info-value {
        font-size: 15px;
        color: #303133;
        font-weight: 500;
      }
    }
  }
  
  .field-box {
    background: #f5f7fa;
    border-radius: 12px;
    padding: 16px 20px;
    
    .field-name {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 18px;
      font-weight: 600;
      color: #409eff;
      margin-bottom: 8px;
    }
    
    .field-desc {
      font-size: 14px;
      color: #606266;
    }
  }
  
  .calc-logic {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px 20px;
    border-radius: 12px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    max-height: 200px;
    overflow: auto;
  }
  
  .admin-note {
    background: #f0f9ff;
    border-left: 4px solid #409eff;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    font-size: 14px;
    color: #303133;
  }
  
  .reject-reason {
    background: #fef0f0;
    border-left: 4px solid #f56c6c;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    font-size: 14px;
    color: #f56c6c;
  }
}

// 操作对话框
.dialog-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #f0f9eb;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  color: #67c23a;
  
  &.warning {
    background: #fef0f0;
    color: #f56c6c;
  }
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
  
  .order-actions {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
