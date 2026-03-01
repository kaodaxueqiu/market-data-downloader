<template>
  <div class="im-container">
    <!-- 加载中 -->
    <div v-if="pageLoading" class="im-status-page">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <span>{{ loadingText }}</span>
    </div>

    <!-- 连接出错（网络等问题） -->
    <div v-else-if="apiError" class="im-status-page">
      <div class="status-card error-card">
        <div class="status-icon error-icon">
          <el-icon :size="80"><CircleCloseFilled /></el-icon>
        </div>
        <h2>连接失败</h2>
        <p class="status-desc">{{ apiError }}</p>
        <el-button type="primary" @click="checkAndConnect">
          <el-icon><Refresh /></el-icon>
          重试
        </el-button>
      </div>
    </div>

    <!-- 未开通：im-token 返回失败 -->
    <div v-else-if="notActivated" class="im-status-page">
      <div class="status-card">
        <div class="status-icon">
          <el-icon :size="80"><ChatDotRound /></el-icon>
        </div>
        <h2>智能助手</h2>
        <p class="status-desc">
          与 AI 智能体对话，获取量化研究支持。<br>
          开通后即可与智能助手实时交流。
        </p>
        <p class="status-hint" v-if="notActivatedMsg">{{ notActivatedMsg }}</p>
        <el-button
          type="primary"
          size="large"
          @click="activateIM"
          :loading="connecting"
        >
          <el-icon><ChatDotRound /></el-icon>
          开通智能助手
        </el-button>
      </div>
    </div>

    <!-- 已连接：左右分栏 -->
    <template v-else-if="imStore.isConnected">
      <div class="im-sidebar">
        <!-- 侧边栏顶部 tab -->
        <div class="sidebar-tabs">
          <div
            class="tab-item"
            :class="{ active: sidebarTab === 'chat' }"
            @click="sidebarTab = 'chat'"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>消息</span>
            <el-badge v-if="imStore.unreadTotal > 0" :value="imStore.unreadTotal" :max="99" class="tab-badge" />
          </div>
          <div
            class="tab-item"
            :class="{ active: sidebarTab === 'friends' }"
            @click="sidebarTab = 'friends'"
          >
            <el-icon><User /></el-icon>
            <span>联系人</span>
            <el-badge v-if="friendTabBadge > 0" :value="friendTabBadge" :max="99" class="tab-badge" />
          </div>
        </div>

        <!-- 侧边栏功能按钮 -->
        <div class="sidebar-actions">
          <el-button text size="small" @click="mainView = 'search'" title="添加好友">
            <el-icon :size="16"><Plus /></el-icon>
          </el-button>
          <el-button text size="small" @click="mainView = 'profile'" title="个人资料">
            <el-icon :size="16"><Setting /></el-icon>
          </el-button>
        </div>

        <!-- 侧边栏内容 -->
        <div class="sidebar-content">
          <ConversationList v-if="sidebarTab === 'chat'" @select="onSelectConversation" />
          <template v-else>
            <!-- 好友申请入口 -->
            <div class="friend-requests-entry" @click="mainView = 'requests'; imStore.clearFriendEventUnread()">
              <el-icon :size="18"><Bell /></el-icon>
              <span>好友申请</span>
              <el-badge v-if="friendTabBadge > 0" :value="friendTabBadge" :max="99" />
              <el-icon class="entry-arrow"><ArrowRight /></el-icon>
            </div>
            <FriendList @chat="onFriendChat" />
          </template>
        </div>
      </div>

      <div class="im-main">
        <!-- 聊天窗口 -->
        <ChatWindow v-if="mainView === 'chat' && imStore.currentConversation" />
        <!-- 添加好友 -->
        <FriendSearch v-else-if="mainView === 'search'" />
        <!-- 好友申请 -->
        <FriendRequests v-else-if="mainView === 'requests'" />
        <!-- 个人资料 -->
        <UserProfile v-else-if="mainView === 'profile'" />
        <!-- 欢迎页 -->
        <div v-else class="im-welcome">
          <Welcome
            :prompts="welcomePrompts"
            title="智能助手"
            description="选择左侧会话或联系人开始聊天"
            @prompt-click="onPromptClick"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, Refresh, ChatDotRound, CircleCloseFilled, User, Plus, Setting, Bell, ArrowRight } from '@element-plus/icons-vue'
import { Welcome } from 'vue-element-plus-x'
import 'vue-element-plus-x/css'
import { useIMStore } from '../../stores/imStore'
import ConversationList from './ConversationList.vue'
import ChatWindow from './ChatWindow.vue'
import FriendList from './FriendList.vue'
import FriendSearch from './FriendSearch.vue'
import FriendRequests from './FriendRequests.vue'
import UserProfile from './UserProfile.vue'

const imStore = useIMStore()

const friendTabBadge = computed(() => {
  return Math.max(imStore.pendingFriendCount, imStore.friendEventUnread)
})

const pageLoading = ref(true)
const loadingText = ref('检查 IM 状态...')
const apiError = ref('')
const notActivated = ref(false)
const notActivatedMsg = ref('')
const connecting = ref(false)

const sidebarTab = ref<'chat' | 'friends'>('chat')
const mainView = ref<'chat' | 'search' | 'requests' | 'profile'>('chat')

watch(() => imStore.currentConversation, (val) => {
  if (val) mainView.value = 'chat'
})

const welcomePrompts = [
  { label: '查看我的会话', icon: '💬' },
  { label: '联系 AI 助手', icon: '🤖' },
]

async function checkAndConnect() {
  pageLoading.value = true
  loadingText.value = '正在连接智能助手...'
  apiError.value = ''
  notActivated.value = false

  try {
    if (imStore.isConnected) {
      if (imStore.isSyncFinished) {
        await imStore.loadAllData()
      }
      pageLoading.value = false
      return
    }

    const res = await window.electronAPI.im.getToken()
    if (res.success && res.userID && res.token) {
      await imStore.connect(res.userID, res.token, res.phoneNumber || '', res.email || '', res.company || '')
    } else {
      notActivated.value = true
      notActivatedMsg.value = res.error || '未开通智能助手'
    }
  } catch (e: any) {
    apiError.value = e.message || '无法连接 IM 服务'
  } finally {
    pageLoading.value = false
  }
}

async function activateIM() {
  connecting.value = true
  apiError.value = ''

  try {
    await ElMessageBox.confirm(
      '开通后将为您创建智能助手账号，确认开通？',
      '开通智能助手',
      { confirmButtonText: '确认开通', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    connecting.value = false
    return
  }

  try {
    const res = await window.electronAPI.im.getToken()
    if (!res.success || !res.userID || !res.token) {
      ElMessage.error(res.error || '开通失败，请稍后重试')
      connecting.value = false
      return
    }

    await imStore.connect(res.userID, res.token, res.phoneNumber || '', res.email || '', res.company || '')
    notActivated.value = false
    ElMessage.success('智能助手已开通')
  } catch (e: any) {
    ElMessage.error('连接失败: ' + (e.message || '未知错误'))
  } finally {
    connecting.value = false
  }
}

function onSelectConversation(conv: any) {
  imStore.selectConversation(conv)
  mainView.value = 'chat'
}

async function onFriendChat(friend: any) {
  try {
    await imStore.startChat(friend.userID)
    mainView.value = 'chat'
    sidebarTab.value = 'chat'
  } catch (e: any) {
    ElMessage.error('发起聊天失败: ' + (e.message || '未知错误'))
  }
}

function onPromptClick(_prompt: any) {
  // 未来可扩展
}

onMounted(() => {
  checkAndConnect()
})
</script>

<style scoped lang="scss">
.im-container {
  display: flex;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.im-status-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #909399;

  .status-card {
    text-align: center;
    max-width: 480px;
    padding: 40px;

    .status-icon {
      color: #8B5CF6;
      margin-bottom: 20px;

      &.error-icon {
        color: #f56c6c;
      }
    }

    h2 {
      margin: 0 0 12px 0;
      font-size: 22px;
      font-weight: 600;
      color: #303133;
    }

    .status-desc {
      color: #909399;
      font-size: 14px;
      line-height: 1.8;
      margin-bottom: 24px;
    }

    .status-hint {
      color: #E6A23C;
      font-size: 13px;
      margin-bottom: 16px;
      padding: 8px 16px;
      background: #fdf6ec;
      border-radius: 4px;
    }

    .status-info {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    &.error-card {
      h2 { color: #f56c6c; }
    }
  }
}

.im-sidebar {
  width: 300px;
  min-width: 260px;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .sidebar-tabs {
    display: flex;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;

    .tab-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 0;
      cursor: pointer;
      font-size: 13px;
      color: #909399;
      transition: all 0.2s;
      position: relative;

      &:hover {
        color: #606266;
        background: #f5f7fa;
      }

      &.active {
        color: #8B5CF6;
        font-weight: 500;

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: #8B5CF6;
          border-radius: 1px;
        }
      }

      .tab-badge {
        margin-left: 2px;
      }
    }
  }

  .sidebar-actions {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    gap: 2px;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
  }

  .friend-requests-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #303133;
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    .entry-arrow {
      margin-left: auto;
      color: #c0c4cc;
      font-size: 12px;
    }
  }
}

.im-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.im-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
</style>
