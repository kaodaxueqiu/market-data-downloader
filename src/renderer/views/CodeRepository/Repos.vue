<template>
  <div class="repos-page">
    <div class="page-header">
      <h2>我的仓库</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadRepos">刷新</el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    />

    <!-- 仓库列表 -->
    <div v-else-if="repos.length > 0" class="repos-grid">
      <div
        v-for="repo in repos"
        :key="repo.id"
        class="repo-card"
        @click="viewVersions(repo.name)"
      >
        <div class="repo-header">
          <div class="repo-icon">📁</div>
          <div class="repo-info">
            <h3 class="repo-name">{{ repo.name }}</h3>
            <p class="repo-description">{{ repo.description || '无描述' }}</p>
          </div>
          <el-icon class="arrow-icon"><ArrowRight /></el-icon>
        </div>

        <div class="repo-meta">
          <span class="meta-item">
            <el-icon><Clock /></el-icon>
            最后更新: {{ formatTime(repo.updated_at) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-empty description="暂无仓库" :image-size="200" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh, Clock, ArrowRight } from '@element-plus/icons-vue'
// import { ElMessage } from 'element-plus'
import modelRunnerService, { type Repository } from '@/services/modelRunner.service'

const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)
const repos = ref<Repository[]>([])

import { setCurrentUserPinyin } from '@/services/modelRunner.service'

// 中文转拼音映射表（根据实际用户添加）
const NAME_TO_PINYIN: Record<string, string> = {
  '于洋': 'yuyang',
  '刘英楠': 'liuyingnan',
  '宝家琪': 'baojiaqi',
  '张云迪': 'zhangyundi'
}

// 加载仓库列表
const loadRepos = async () => {
  loading.value = true
  error.value = null
  
  try {
    // 1. 获取当前用户的 API Key 信息
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      error.value = '请先配置 API Key'
      loading.value = false
      return
    }
    
    console.log('API Key 信息:', defaultKey)
    
    // 2. 获取中文姓名（从 databaseCredentials.accountName）
    const chineseName = defaultKey.databaseCredentials?.accountName || ''
    console.log('当前用户中文名:', chineseName)
    
    if (!chineseName) {
      error.value = 'API Key 中未找到用户名信息（databaseCredentials.accountName 为空）'
      loading.value = false
      return
    }
    
    // 3. 转拼音
    const pinyin = NAME_TO_PINYIN[chineseName]
    if (!pinyin) {
      error.value = `未找到用户 "${chineseName}" 的拼音映射，请联系管理员配置`
      loading.value = false
      return
    }
    
    console.log('用户拼音:', pinyin)
    setCurrentUserPinyin(pinyin)
    
    // 4. 调用 Gitea API 获取仓库（通过主进程，会自动过滤）
    const data = await modelRunnerService.getRepos()
    repos.value = data || []
    
    console.log('加载到仓库数量:', repos.value.length)
  } catch (err: any) {
    console.error('加载仓库失败:', err)
    if (err.response?.status === 401) {
      error.value = 'Gitea 认证失败，请配置正确的 Admin Token'
    } else if (err.response?.status === 404) {
      error.value = '未找到仓库'
    } else {
      error.value = err.message || '加载仓库列表失败'
    }
  } finally {
    loading.value = false
  }
}

// 格式化时间
const formatTime = (timeStr: string): string => {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 进入仓库详情
const viewVersions = (repoName: string) => {
  router.push(`/code-repository/repos/${repoName}`)
}

onMounted(() => {
  loadRepos()
})
</script>

<style scoped lang="scss">
.repos-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .loading-state {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
  }

  .repos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 20px;
  }

  .repo-card {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    transition: all 0.3s;
    cursor: pointer;

    &:hover {
      box-shadow: 0 4px 20px rgba(64, 158, 255, 0.2);
      transform: translateY(-2px);
      border-color: #409eff;

      .arrow-icon {
        color: #409eff;
        transform: translateX(4px);
      }
    }

    .repo-header {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: flex-start;

      .repo-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .repo-info {
        flex: 1;
        min-width: 0;

        .repo-name {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #303133;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .repo-description {
          margin: 0;
          font-size: 14px;
          color: #606266;
          line-height: 1.5;
        }
      }

      .arrow-icon {
        font-size: 20px;
        color: #c0c4cc;
        flex-shrink: 0;
        transition: all 0.3s;
        margin-top: 6px;
      }
    }

    .repo-meta {
      padding-top: 12px;
      border-top: 1px solid #ebeef5;

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #909399;

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }

  .empty-state {
    background: #fff;
    padding: 60px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>

