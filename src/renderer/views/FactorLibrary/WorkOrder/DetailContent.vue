<template>
  <div class="detail-content">
    <!-- 顶部操作栏 -->
    <div class="action-bar">
      <el-button @click="handleBack" :icon="ArrowLeft">返回列表</el-button>
      <el-button @click="loadDetail" :icon="Refresh" :loading="loading">刷新</el-button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 详情内容 -->
    <template v-else-if="detail">
      <!-- 头部卡片 -->
      <div class="header-card" :class="detail.status">
        <div class="header-main">
          <div class="header-left">
            <div class="order-id">#{{ detail.id }}</div>
            <h2 class="field-name">{{ detail.field_name }}</h2>
            <p class="field-desc">{{ detail.field_desc || '暂无描述' }}</p>
          </div>
          <div class="header-right">
            <div class="status-badge" :class="detail.status">
              <el-icon v-if="detail.status === 'pending'"><Clock /></el-icon>
              <el-icon v-else-if="detail.status === 'processing'"><Loading /></el-icon>
              <el-icon v-else-if="detail.status === 'completed'"><CircleCheck /></el-icon>
              <el-icon v-else-if="detail.status === 'rejected'"><CircleClose /></el-icon>
              <span>{{ getStatusLabel(detail.status) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <!-- 左侧：基本信息 -->
        <div class="info-card">
          <div class="card-title">
            <el-icon><InfoFilled /></el-icon>
            <span>基本信息</span>
          </div>
          <div class="info-list">
            <div class="info-row">
              <div class="info-item">
                <span class="label">申请人</span>
                <span class="value">
                  <el-icon><User /></el-icon>
                  {{ detail.user_name }}
                </span>
              </div>
              <div class="info-item">
                <span class="label">提交时间</span>
                <span class="value">{{ formatTime(detail.created_at) }}</span>
              </div>
            </div>
            <div class="info-row" v-if="detail.processed_by || detail.completed_at">
              <div class="info-item" v-if="detail.processed_by">
                <span class="label">处理人</span>
                <span class="value">
                  <el-icon><User /></el-icon>
                  {{ detail.processed_by }}
                </span>
              </div>
              <div class="info-item" v-if="detail.completed_at">
                <span class="label">完成时间</span>
                <span class="value">{{ formatTime(detail.completed_at) }}</span>
              </div>
            </div>
          </div>
          
          <!-- 计算逻辑 -->
          <div class="calc-section" v-if="detail.calc_logic">
            <div class="section-title">计算逻辑</div>
            <pre class="calc-code">{{ detail.calc_logic }}</pre>
          </div>
          
          <!-- 管理员备注 -->
          <div class="note-section success" v-if="detail.admin_note">
            <div class="note-icon">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="note-content">
              <div class="note-title">管理员备注</div>
              <div class="note-text">{{ detail.admin_note }}</div>
            </div>
          </div>
          
          <!-- 拒绝原因 -->
          <div class="note-section danger" v-if="detail.reject_reason">
            <div class="note-icon">
              <el-icon><WarningFilled /></el-icon>
            </div>
            <div class="note-content">
              <div class="note-title">拒绝原因</div>
              <div class="note-text">{{ detail.reject_reason }}</div>
            </div>
          </div>
        </div>

        <!-- 右侧：状态时间线 -->
        <div class="timeline-card">
          <div class="card-title">
            <el-icon><Timer /></el-icon>
            <span>处理进度</span>
          </div>
          <el-timeline>
            <el-timeline-item
              :timestamp="formatTime(detail.created_at)"
              placement="top"
              type="primary"
              :hollow="false"
            >
              <div class="timeline-content">
                <div class="timeline-title">提交申请</div>
                <div class="timeline-desc">{{ detail.user_name }} 提交了字段申请</div>
              </div>
            </el-timeline-item>
            
            <el-timeline-item
              v-if="detail.status === 'processing' || detail.status === 'completed'"
              :timestamp="detail.processed_by ? '已接单' : ''"
              placement="top"
              type="primary"
              :hollow="false"
            >
              <div class="timeline-content">
                <div class="timeline-title">开始处理</div>
                <div class="timeline-desc" v-if="detail.processed_by">
                  {{ detail.processed_by }} 接单处理
                </div>
              </div>
            </el-timeline-item>
            
            <el-timeline-item
              v-if="detail.status === 'completed'"
              :timestamp="formatTime(detail.completed_at)"
              placement="top"
              type="success"
              :hollow="false"
            >
              <div class="timeline-content">
                <div class="timeline-title success">已完成</div>
                <div class="timeline-desc">字段已添加到 zz_384 表中</div>
              </div>
            </el-timeline-item>
            
            <el-timeline-item
              v-if="detail.status === 'rejected'"
              :timestamp="formatTime(detail.updated_at)"
              placement="top"
              type="danger"
              :hollow="false"
            >
              <div class="timeline-content">
                <div class="timeline-title danger">已拒绝</div>
                <div class="timeline-desc">申请被拒绝</div>
              </div>
            </el-timeline-item>
            
            <el-timeline-item
              v-if="detail.status === 'pending'"
              timestamp="等待中..."
              placement="top"
              type="info"
              :hollow="true"
            >
              <div class="timeline-content">
                <div class="timeline-title muted">等待处理</div>
                <div class="timeline-desc">工单正在等待 IT 人员处理</div>
              </div>
            </el-timeline-item>
            
            <el-timeline-item
              v-if="detail.status === 'processing'"
              timestamp="进行中..."
              placement="top"
              type="info"
              :hollow="true"
            >
              <div class="timeline-content">
                <div class="timeline-title muted">等待完成</div>
                <div class="timeline-desc">IT 人员正在处理中</div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </template>

    <!-- 错误状态 -->
    <el-empty v-else description="工单不存在或加载失败">
      <template #image>
        <el-icon :size="80" color="#c0c4cc"><Document /></el-icon>
      </template>
      <el-button type="primary" @click="handleBack">返回列表</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { 
  ArrowLeft, Refresh, Loading, Clock, CircleCheck, CircleClose,
  InfoFilled, User, Timer, ChatDotRound, WarningFilled, Document
} from '@element-plus/icons-vue'

const props = defineProps<{
  id: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

interface WorkOrderDetail {
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
const detail = ref<WorkOrderDetail | null>(null)

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    rejected: '已拒绝'
  }
  return map[status] || status
}

const formatTime = (time: string | null) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadDetail = async () => {
  if (!props.id) return
  
  loading.value = true
  
  try {
    const result = await window.electronAPI.workorder.getDetail(props.id)
    
    if (result.success && result.data) {
      detail.value = result.data
    } else {
      detail.value = null
    }
  } catch (error) {
    console.error('加载详情失败:', error)
    detail.value = null
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  emit('back')
}

watch(() => props.id, () => {
  if (props.id) {
    loadDetail()
  }
}, { immediate: true })

onMounted(() => {
  if (props.id) {
    loadDetail()
  }
})
</script>

<style scoped lang="scss">
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.action-bar {
  display: flex;
  gap: 12px;
}

.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;
  color: #909399;
  gap: 20px;
  
  .is-loading {
    color: #409eff;
  }
}

// 头部卡片
.header-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border-left: 6px solid #409eff;
  
  &.pending { border-left-color: #e6a23c; }
  &.processing { border-left-color: #409eff; }
  &.completed { border-left-color: #67c23a; }
  &.rejected { border-left-color: #f56c6c; }
  
  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .header-left {
    .order-id {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }
    
    .field-name {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 28px;
      font-weight: 700;
      color: #303133;
      margin: 0 0 12px 0;
    }
    
    .field-desc {
      font-size: 16px;
      color: #606266;
      margin: 0;
    }
  }
  
  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 16px;
    font-weight: 600;
    
    .el-icon {
      font-size: 20px;
    }
    
    &.pending {
      background: linear-gradient(135deg, #fdf6ec, #faecd8);
      color: #e6a23c;
    }
    &.processing {
      background: linear-gradient(135deg, #ecf5ff, #d9ecff);
      color: #409eff;
    }
    &.completed {
      background: linear-gradient(135deg, #f0f9eb, #e1f3d8);
      color: #67c23a;
    }
    &.rejected {
      background: linear-gradient(135deg, #fef0f0, #fde2e2);
      color: #f56c6c;
    }
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}

// 信息卡片
.info-card,
.timeline-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
  
  .el-icon {
    font-size: 18px;
    color: #409eff;
  }
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.info-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  .label {
    display: block;
    font-size: 13px;
    color: #909399;
    margin-bottom: 6px;
  }
  
  .value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    color: #303133;
    font-weight: 500;
    
    .el-icon {
      font-size: 16px;
      color: #909399;
    }
  }
}

.calc-section {
  margin-bottom: 24px;
  
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #606266;
    margin-bottom: 12px;
  }
}

.calc-code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 20px;
  border-radius: 12px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 300px;
  overflow: auto;
}

.note-section {
  display: flex;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 12px;
  margin-top: 16px;
  
  &.success {
    background: linear-gradient(135deg, #f0f9eb, #e1f3d8);
    
    .note-icon { color: #67c23a; }
    .note-title { color: #67c23a; }
  }
  
  &.danger {
    background: linear-gradient(135deg, #fef0f0, #fde2e2);
    
    .note-icon { color: #f56c6c; }
    .note-title { color: #f56c6c; }
  }
  
  .note-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  .note-content {
    flex: 1;
    
    .note-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    
    .note-text {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
    }
  }
}

// 时间线
.timeline-card {
  :deep(.el-timeline) {
    padding-left: 0;
  }
  
  :deep(.el-timeline-item__wrapper) {
    padding-left: 20px;
  }
  
  :deep(.el-timeline-item__timestamp) {
    color: #909399;
    font-size: 13px;
  }
}

.timeline-content {
  .timeline-title {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 4px;
    
    &.success { color: #67c23a; }
    &.danger { color: #f56c6c; }
    &.muted { color: #c0c4cc; }
  }
  
  .timeline-desc {
    font-size: 13px;
    color: #909399;
  }
}

@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .header-card .header-main {
    flex-direction: column;
    gap: 20px;
  }
  
  .info-row {
    grid-template-columns: 1fr;
  }
}
</style>
