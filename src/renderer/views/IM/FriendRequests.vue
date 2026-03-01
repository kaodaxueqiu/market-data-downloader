<template>
  <div class="friend-requests">
    <div class="requests-header">
      <h3>好友申请</h3>
      <el-segmented v-model="activeTab" :options="tabOptions" size="small" />
    </div>

    <!-- 收到的申请 -->
    <div v-if="activeTab === 'received'" class="request-list">
      <div v-if="imStore.friendApplicationsRecv.length === 0" class="empty-state">
        <el-empty description="暂无好友申请" :image-size="80" />
      </div>
      <div
        v-for="app in imStore.friendApplicationsRecv"
        :key="app.fromUserID + '_' + app.createTime"
        class="request-card"
      >
        <el-avatar :size="44" :src="app.fromFaceURL || undefined">
          {{ (app.fromNickname || app.fromUserID || '').charAt(0) }}
        </el-avatar>
        <div class="request-info">
          <span class="request-name">{{ app.fromNickname || app.fromUserID }}</span>
          <span class="request-msg" v-if="app.reqMsg">{{ app.reqMsg }}</span>
          <span class="request-time">{{ formatTime(app.createTime) }}</span>
        </div>
        <div class="request-actions">
          <template v-if="app.handleResult === 0">
            <el-button type="primary" size="small" @click="accept(app)" :loading="processingMap[app.fromUserID]">
              同意
            </el-button>
            <el-button size="small" @click="refuse(app)" :loading="processingMap[app.fromUserID]">
              拒绝
            </el-button>
          </template>
          <el-tag v-else-if="app.handleResult === 1" type="success" size="small">已同意</el-tag>
          <el-tag v-else-if="app.handleResult === -1" type="info" size="small">已拒绝</el-tag>
        </div>
      </div>
    </div>

    <!-- 发出的申请 -->
    <div v-else class="request-list">
      <div v-if="imStore.friendApplicationsSent.length === 0" class="empty-state">
        <el-empty description="暂无发出的申请" :image-size="80" />
      </div>
      <div
        v-for="app in imStore.friendApplicationsSent"
        :key="app.toUserID + '_' + app.createTime"
        class="request-card"
      >
        <el-avatar :size="44" :src="app.toFaceURL || undefined">
          {{ (app.toNickname || app.toUserID || '').charAt(0) }}
        </el-avatar>
        <div class="request-info">
          <span class="request-name">{{ app.toNickname || app.toUserID }}</span>
          <span class="request-msg" v-if="app.reqMsg">{{ app.reqMsg }}</span>
          <span class="request-time">{{ formatTime(app.createTime) }}</span>
        </div>
        <div class="request-actions">
          <el-tag v-if="app.handleResult === 0" type="warning" size="small">等待验证</el-tag>
          <el-tag v-else-if="app.handleResult === 1" type="success" size="small">已通过</el-tag>
          <el-tag v-else-if="app.handleResult === -1" type="info" size="small">已拒绝</el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useIMStore } from '../../stores/imStore'

const imStore = useIMStore()

const activeTab = ref('received')
const tabOptions = [
  { label: '收到的', value: 'received' },
  { label: '发出的', value: 'sent' },
]
const processingMap = reactive<Record<string, boolean>>({})

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${Y}-${M}-${D} ${h}:${m}`
}

async function accept(app: any) {
  processingMap[app.fromUserID] = true
  try {
    await imStore.acceptFriendApplication(app.fromUserID)
    ElMessage.success('已同意好友申请')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + (e.message || '未知错误'))
  } finally {
    processingMap[app.fromUserID] = false
  }
}

async function refuse(app: any) {
  processingMap[app.fromUserID] = true
  try {
    await imStore.refuseFriendApplication(app.fromUserID)
    ElMessage.success('已拒绝好友申请')
  } catch (e: any) {
    ElMessage.error('操作失败: ' + (e.message || '未知错误'))
  } finally {
    processingMap[app.fromUserID] = false
  }
}

onMounted(() => {
  const tab = imStore.friendEventTab
  console.log('🔔 [FriendRequests] friendEventTab from store:', tab)
  if (tab) activeTab.value = tab
  imStore.loadFriendApplications()
})
</script>

<style scoped lang="scss">
.friend-requests {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.requests-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.request-list {
  .empty-state {
    padding: 40px 0;
  }
}

.request-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  margin-bottom: 10px;
  transition: background 0.2s;

  &:hover {
    background: #f5f7fa;
  }

  .request-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .request-name {
      font-size: 15px;
      font-weight: 500;
      color: #303133;
    }

    .request-msg {
      font-size: 12px;
      color: #606266;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .request-time {
      font-size: 11px;
      color: #c0c4cc;
    }
  }

  .request-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
}
</style>
