<template>
  <div class="friend-list">
    <div class="list-header">
      <h3>好友列表 <el-tag size="small" type="info" round>{{ imStore.friends.length }}</el-tag></h3>
    </div>

    <el-input
      v-model="keyword"
      placeholder="搜索好友"
      clearable
      size="small"
      class="filter-input"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <div v-if="filteredFriends.length === 0" class="empty-state">
      <el-empty :description="keyword ? '未找到匹配的好友' : '暂无好友'" :image-size="80" />
    </div>

    <div class="friends-grid">
      <div
        v-for="friend in filteredFriends"
        :key="friend.userID"
        class="friend-card"
        @click="$emit('chat', friend)"
      >
        <el-avatar :size="44" :src="friend.faceURL || undefined">
          {{ (friend.nickname || friend.userID || '').charAt(0) }}
        </el-avatar>
        <div class="friend-info">
          <span class="friend-name">{{ friend.remark || friend.nickname || friend.userID }}</span>
          <span class="friend-phone" v-if="friend.phoneNumber">{{ friend.phoneNumber }}</span>
        </div>
        <div class="friend-actions" @click.stop>
          <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, friend)">
            <el-button text size="small" class="more-btn">
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="chat">发消息</el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <span style="color: #f56c6c">删除好友</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, MoreFilled } from '@element-plus/icons-vue'
import { useIMStore } from '../../stores/imStore'

const emit = defineEmits<{
  chat: [friend: any]
}>()

const imStore = useIMStore()
const keyword = ref('')

const filteredFriends = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return imStore.friends
  return imStore.friends.filter((f: any) => {
    const name = (f.remark || f.nickname || f.userID || '').toLowerCase()
    const phone = (f.phoneNumber || '').toLowerCase()
    return name.includes(kw) || phone.includes(kw)
  })
})

async function handleCommand(cmd: string, friend: any) {
  if (cmd === 'chat') {
    emit('chat', friend)
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确定删除好友「${friend.remark || friend.nickname || friend.userID}」？`,
        '删除好友',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      await imStore.deleteFriend(friend.userID)
      ElMessage.success('已删除')
    } catch { /* cancelled */ }
  }
}
</script>

<style scoped lang="scss">
.friend-list {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.list-header {
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.filter-input {
  margin-bottom: 16px;
}

.empty-state {
  padding: 40px 0;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;

  :deep(.el-avatar) {
    background: #7c4dff;
    color: #fff;
    font-weight: 600;
    font-size: 15px;
  }

  &:hover {
    background: #f5f7fa;

    .more-btn {
      opacity: 1;
    }
  }

  .friend-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .friend-name {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }

    .friend-phone {
      font-size: 12px;
      color: #909399;
    }
  }

  .more-btn {
    opacity: 0;
    transition: opacity 0.2s;
  }
}
</style>
