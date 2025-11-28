<template>
  <div class="repo-detail-page">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回仓库列表</el-button>
        <div class="repo-title">
          <h2>{{ repoDetail?.name || repoName }}</h2>
          <p class="repo-desc">{{ repoDetail?.description || '-' }}</p>
        </div>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="executeLatest">执行最新版本</el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
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

    <!-- 版本列表 -->
    <div v-else class="versions-container">
      <!-- 标签页切换 -->
      <el-tabs v-model="activeTab">
        <!-- 分支 -->
        <el-tab-pane label="分支" name="branches">
          <div v-if="versions.branches && versions.branches.length > 0" class="version-list">
            <div
              v-for="branch in versions.branches"
              :key="branch.name"
              class="version-card"
            >
              <div class="version-header">
                <span class="version-icon">🌿</span>
                <div class="version-info">
                  <h4 class="version-name">{{ branch.name }}</h4>
                  <p class="version-commit">
                    提交: {{ branch.commit.short_sha }} - "{{ branch.commit.message }}"
                  </p>
                  <span class="version-time">{{ formatTime(branch.commit.date) }}</span>
                </div>
              </div>
              <div class="version-actions">
                <el-button type="primary" size="small" @click="executeVersion(branch.name, 'branch')">
                  执行此版本
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无分支" />
        </el-tab-pane>

        <!-- 标签 -->
        <el-tab-pane label="标签" name="tags">
          <div v-if="versions.tags && versions.tags.length > 0" class="version-list">
            <div
              v-for="tag in versions.tags"
              :key="tag.name"
              class="version-card"
            >
              <div class="version-header">
                <span class="version-icon">🏷️</span>
                <div class="version-info">
                  <h4 class="version-name">{{ tag.name }}</h4>
                  <p class="version-commit">
                    提交: {{ tag.commit.short_sha }} - "{{ tag.commit.message }}"
                  </p>
                  <span class="version-time">{{ formatTime(tag.commit.date) }}</span>
                </div>
              </div>
              <div class="version-actions">
                <el-button type="primary" size="small" @click="executeVersion(tag.name, 'tag')">
                  执行此版本
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无标签" />
        </el-tab-pane>

        <!-- 提交记录 -->
        <el-tab-pane label="提交记录" name="commits">
          <div v-if="versions.commits && versions.commits.length > 0" class="version-list">
            <div
              v-for="commit in versions.commits"
              :key="commit.sha"
              class="version-card"
            >
              <div class="version-header">
                <span class="version-icon">📝</span>
                <div class="version-info">
                  <h4 class="version-name">{{ commit.short_sha }}</h4>
                  <p class="version-commit">{{ commit.message }}</p>
                  <span class="version-author">{{ commit.author }}</span>
                  <span class="version-time">{{ formatTime(commit.date) }}</span>
                </div>
              </div>
              <div class="version-actions">
                <el-button type="primary" size="small" @click="executeVersion(commit.sha, 'commit')">
                  执行此版本
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无提交记录" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 执行确认对话框 -->
    <el-dialog
      v-model="showExecuteDialog"
      title="执行模型"
      width="500px"
    >
      <div class="execute-form">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="仓库">{{ repoName }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ executeForm.version }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag size="small">{{ executeForm.version_type }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 20px">
          <h4>执行参数（可选）</h4>
          <el-input
            v-model="executeParamsText"
            type="textarea"
            :rows="6"
            placeholder='{"start_date": "2025-01-01", "end_date": "2025-11-28"}'
          />
          <el-text type="info" size="small">请输入有效的 JSON 格式</el-text>
        </div>
      </div>

      <template #footer>
        <el-button @click="showExecuteDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmExecute" :loading="executing">
          确认执行
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import modelRunnerService, { type Repository, type Versions } from '@/services/modelRunner.service'

const route = useRoute()
const router = useRouter()
const repoName = computed(() => route.params.repoName as string)

const loading = ref(false)
const error = ref<string | null>(null)
const repoDetail = ref<Repository | null>(null)
const versions = ref<Versions>({ branches: [], tags: [], commits: [] })
const activeTab = ref('branches')

const showExecuteDialog = ref(false)
const executing = ref(false)
const executeForm = ref({
  version: '',
  version_type: 'branch' as 'branch' | 'tag' | 'commit'
})
const executeParamsText = ref('')

// 加载数据
const loadData = async () => {
  loading.value = true
  error.value = null

  try {
    // 并行获取仓库详情、分支、标签、提交记录
    const [repoData, branchesData, tagsData, commitsData] = await Promise.all([
      modelRunnerService.getRepoDetail('zizhou', repoName.value),
      modelRunnerService.getBranches('zizhou', repoName.value),
      modelRunnerService.getTags('zizhou', repoName.value),
      modelRunnerService.getCommits('zizhou', repoName.value, { limit: 20 })
    ])

    repoDetail.value = repoData
    versions.value = {
      branches: branchesData || [],
      tags: tagsData || [],
      commits: commitsData || []
    }
  } catch (err: any) {
    console.error('加载失败:', err)
    error.value = err.message || '加载数据失败，请检查网络连接'
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

// 返回
const goBack = () => {
  router.push('/code-repository/repos')
}

// 执行最新版本
const executeLatest = () => {
  if (repoDetail.value?.default_branch) {
    executeVersion(repoDetail.value.default_branch, 'branch')
  } else if (versions.value.branches.length > 0) {
    const mainBranch = versions.value.branches.find(b => b.name === 'main') || versions.value.branches[0]
    executeVersion(mainBranch.name, 'branch')
  } else {
    ElMessage.warning('没有可用的版本')
  }
}

// 执行指定版本
const executeVersion = (version: string, type: 'branch' | 'tag' | 'commit') => {
  executeForm.value = {
    version,
    version_type: type
  }
  executeParamsText.value = ''
  showExecuteDialog.value = true
}

// 确认执行
const confirmExecute = async () => {
  executing.value = true

  try {
    // 解析参数
    let params: Record<string, any> | undefined
    if (executeParamsText.value.trim()) {
      try {
        params = JSON.parse(executeParamsText.value)
      } catch (e) {
        ElMessage.error('参数格式错误，请输入有效的 JSON')
        executing.value = false
        return
      }
    }

    const result = await modelRunnerService.executeModel(repoName.value, {
      version: executeForm.value.version,
      version_type: executeForm.value.version_type,
      params
    })

    if (result.success) {
      ElMessage.success('任务已提交')
      showExecuteDialog.value = false
      // 跳转到执行记录查看任务
      router.push(`/code-repository/history/${result.data.task_id}`)
    } else {
      ElMessage.error('执行失败')
    }
  } catch (err: any) {
    console.error('执行失败:', err)
    ElMessage.error(err.message || '执行失败')
  } finally {
    executing.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.repo-detail-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;

    .header-left {
      display: flex;
      gap: 16px;
      align-items: flex-start;

      .repo-title {
        h2 {
          margin: 0 0 4px 0;
          font-size: 24px;
          color: #303133;
        }

        .repo-desc {
          margin: 0;
          font-size: 14px;
          color: #909399;
        }
      }
    }
  }

  .loading-state {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
  }

  .versions-container {
    background: #fff;
    padding: 20px;
    border-radius: 8px;

    .version-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .version-card {
      padding: 16px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.3s;

      &:hover {
        border-color: #409eff;
        box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
      }

      .version-header {
        display: flex;
        gap: 12px;
        flex: 1;

        .version-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .version-info {
          flex: 1;

          .version-name {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }

          .version-commit {
            margin: 0 0 4px 0;
            font-size: 13px;
            color: #606266;
            font-family: monospace;
          }

          .version-author,
          .version-time {
            display: inline-block;
            margin-right: 16px;
            font-size: 12px;
            color: #909399;
          }
        }
      }

      .version-actions {
        flex-shrink: 0;
      }
    }
  }

  .execute-form {
    h4 {
      margin: 16px 0 8px 0;
      font-size: 14px;
      color: #303133;
    }
  }
}
</style>

