<template>
  <div class="friend-search">
    <div class="search-header">
      <h3>添加好友</h3>
      <p class="search-tip">输入手机号、用户ID或昵称搜索用户</p>
    </div>

    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="请输入手机号、用户ID或昵称"
        size="large"
        clearable
        @keyup.enter="doSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button :loading="searching" @click="doSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <div v-if="searched" class="search-result">
      <div v-if="resultList.length === 0" class="no-result">
        <el-empty description="未找到该用户" :image-size="80" />
      </div>

      <div v-for="user in resultList" :key="user.userID" class="user-card">
        <el-avatar :size="48" :src="user.faceURL || undefined">
          {{ (user.nickname || user.userID || '').charAt(0) }}
        </el-avatar>
        <div class="user-info">
          <span class="user-name">{{ user.nickname || user.userID }}</span>
          <span class="user-phone" v-if="user.phoneNumber">{{ user.phoneNumber }}</span>
        </div>
        <div class="user-actions">
          <el-tag v-if="isFriend(user.userID)" type="success" size="small">已是好友</el-tag>
          <el-tag v-else-if="isSelf(user.userID)" type="info" size="small">自己</el-tag>
          <el-button
            v-else
            type="primary"
            size="small"
            :loading="addingMap[user.userID]"
            @click="openAddDialog(user)"
          >
            添加好友
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="addDialogVisible" title="发送好友申请" width="400px">
      <div v-if="targetUser" class="add-dialog-content">
        <div class="target-info">
          <el-avatar :size="40" :src="targetUser.faceURL || undefined">
            {{ (targetUser.nickname || '').charAt(0) }}
          </el-avatar>
          <span>{{ targetUser.nickname || targetUser.userID }}</span>
        </div>
        <el-input
          v-model="reqMsg"
          type="textarea"
          :rows="3"
          placeholder="请输入验证消息（选填）"
          maxlength="100"
          show-word-limit
        />
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="sending" @click="doAddFriend">发送申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useIMStore } from '../../stores/imStore'

const imStore = useIMStore()

const keyword = ref('')
const searching = ref(false)
const searched = ref(false)
const resultList = ref<any[]>([])
const addingMap = reactive<Record<string, boolean>>({})

const addDialogVisible = ref(false)
const targetUser = ref<any>(null)
const reqMsg = ref('')
const sending = ref(false)

function isFriend(userID: string): boolean {
  return imStore.friends.some((f: any) => f.userID === userID)
}

function isSelf(userID: string): boolean {
  return userID === imStore.imUserID
}

async function doSearch() {
  const val = keyword.value.trim()
  if (!val) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  searching.value = true
  searched.value = false
  try {
    resultList.value = await imStore.searchUsers(val)
    searched.value = true
  } catch (e: any) {
    ElMessage.error('搜索失败: ' + (e.message || '未知错误'))
  } finally {
    searching.value = false
  }
}

function openAddDialog(user: any) {
  targetUser.value = user
  reqMsg.value = ''
  addDialogVisible.value = true
}

async function doAddFriend() {
  if (!targetUser.value) return
  sending.value = true
  const uid = targetUser.value.userID
  addingMap[uid] = true
  try {
    await imStore.addFriend(uid, reqMsg.value)
    ElMessage.success('好友申请已发送')
    addDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error('发送失败: ' + (e.message || '未知错误'))
  } finally {
    sending.value = false
    addingMap[uid] = false
  }
}
</script>

<style scoped lang="scss">
.friend-search {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.search-header {
  margin-bottom: 20px;

  h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }

  .search-tip {
    margin: 0;
    font-size: 13px;
    color: #909399;
  }
}

.search-bar {
  margin-bottom: 24px;
}

.search-result {
  .no-result {
    padding: 40px 0;
  }
}

.user-card {
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

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .user-name {
      font-size: 15px;
      font-weight: 500;
      color: #303133;
    }

    .user-phone {
      font-size: 12px;
      color: #909399;
    }
  }
}

.add-dialog-content {
  .target-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: 15px;
    font-weight: 500;
  }
}
</style>
