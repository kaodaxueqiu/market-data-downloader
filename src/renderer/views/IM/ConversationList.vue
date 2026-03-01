<template>
  <div class="conversation-list">
    <div class="list-header">
      <h3>会话</h3>
      <el-button :icon="Refresh" circle size="small" @click="refresh" :loading="loading" />
    </div>

    <div class="list-search">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索会话"
        :prefix-icon="Search"
        clearable
        size="small"
      />
    </div>

    <div class="list-body" v-loading="loading">
      <div
        v-for="conv in filteredConversations"
        :key="conv.conversationID"
        class="conv-item"
        :class="{ active: imStore.currentConversation?.conversationID === conv.conversationID }"
        @click="handleSelect(conv)"
      >
        <div class="conv-avatar">
          <el-avatar :size="40" :src="conv.faceURL || undefined">
            {{ getAvatarText(conv) }}
          </el-avatar>
          <span v-if="conv.unreadCount > 0" class="unread-badge">
            {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
          </span>
        </div>
        <div class="conv-content">
          <div class="conv-top">
            <span class="conv-name">{{ conv.showName || '未知会话' }}</span>
            <span class="conv-time">{{ formatTime(conv.latestMsgSendTime) }}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-last-msg" v-if="imStore.isTyping(conv.conversationID)">
              <em>正在输入...</em>
            </span>
            <span class="conv-last-msg" v-else>{{ getLastMsg(conv) }}</span>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && filteredConversations.length === 0" description="暂无会话" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { useIMStore } from '../../stores/imStore'

const emit = defineEmits<{
  (e: 'select', conv: any): void
}>()

const imStore = useIMStore()
const loading = ref(false)
const searchKeyword = ref('')

const filteredConversations = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return imStore.conversations
  return imStore.conversations.filter((c: any) =>
    (c.showName || '').toLowerCase().includes(kw)
  )
})

function getAvatarText(conv: any) {
  const name = conv.showName || ''
  return name.slice(0, 1) || '?'
}

function getLastMsg(conv: any) {
  if (!conv.latestMsg) return ''
  try {
    const msg = JSON.parse(conv.latestMsg)
    if (msg.contentType === 101) {
      const content = JSON.parse(msg.content)
      return content.content?.slice(0, 40) || ''
    }
    if (msg.contentType === 102) return '[图片]'
    if (msg.contentType === 103) return '[语音]'
    if (msg.contentType === 104) return '[视频]'
    if (msg.contentType === 105) return '[文件]'
    return '[消息]'
  } catch {
    return ''
  }
}

function formatTime(ts: number) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

async function refresh() {
  loading.value = true
  try {
    await imStore.loadConversations()
  } finally {
    loading.value = false
  }
}

function handleSelect(conv: any) {
  emit('select', conv)
  imStore.selectConversation(conv)
}
</script>

<style scoped lang="scss">
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .list-search {
    padding: 8px 12px;
  }

  .list-body {
    flex: 1;
    overflow-y: auto;

    .conv-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover { background: #f5f7fa; }
      &.active { background: #ecf5ff; }

      .conv-avatar {
        position: relative;
        margin-right: 12px;
        flex-shrink: 0;

        :deep(.el-avatar) {
          background: #7c4dff;
          color: #fff;
          font-weight: 600;
          font-size: 15px;
        }

        .unread-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #f56c6c;
          color: #fff;
          font-size: 10px;
          min-width: 16px;
          height: 16px;
          line-height: 16px;
          text-align: center;
          border-radius: 8px;
          padding: 0 4px;
        }
      }

      .conv-content {
        flex: 1;
        min-width: 0;

        .conv-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          .conv-name {
            font-size: 14px;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .conv-time {
            font-size: 11px;
            color: #909399;
            flex-shrink: 0;
            margin-left: 8px;
          }
        }

        .conv-bottom {
          .conv-last-msg {
            font-size: 12px;
            color: #909399;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: block;

            em {
              color: #409eff;
              font-style: normal;
            }
          }
        }
      }
    }
  }
}
</style>
