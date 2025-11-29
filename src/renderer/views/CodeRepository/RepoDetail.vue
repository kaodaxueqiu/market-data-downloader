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

        <!-- 本地管理 -->
        <el-tab-pane name="local">
          <template #label>
            <span>
              本地管理
              <el-badge v-if="hasChanges" :value="changedFiles.length" type="warning" style="margin-left: 5px;" />
            </span>
          </template>
          
          <div class="local-management">
            <!-- 关联状态卡片 -->
            <div class="local-card">
              <div class="card-header">
                <h4>📍 本地关联</h4>
              </div>
              <div class="card-body">
                <template v-if="localPath">
                  <div class="linked-info">
                    <el-icon color="#67c23a" size="20"><SuccessFilled /></el-icon>
                    <div class="linked-detail">
                      <span class="linked-label">已关联本地目录</span>
                      <span class="linked-path">{{ localPath }}</span>
                    </div>
                  </div>
                  <div class="linked-actions">
                    <el-button size="small" @click="openLocalFolder">
                      <el-icon><FolderOpened /></el-icon>
                      打开目录
                    </el-button>
                    <el-button size="small" type="danger" plain @click="unlinkLocal">
                      解除关联
                    </el-button>
                  </div>
                </template>
                <template v-else>
                  <div class="unlinked-info">
                    <el-icon color="#909399" size="20"><Warning /></el-icon>
                    <span>未关联本地目录</span>
                  </div>
                  <el-button type="primary" @click="linkLocalFolder">
                    <el-icon><Link /></el-icon>
                    关联本地目录
                  </el-button>
                </template>
              </div>
            </div>

            <!-- 下载代码卡片 -->
            <div class="local-card">
              <div class="card-header">
                <h4>📥 下载代码</h4>
              </div>
              <div class="card-body">
                <p class="card-desc">将仓库代码下载到指定位置（不建立关联）</p>
                <el-button type="success" @click="downloadCode" :loading="cloning">
                  <el-icon><Download /></el-icon>
                  下载代码
                </el-button>
              </div>
            </div>

            <!-- 本地 Git 仓库变更卡片（仅关联后显示） -->
            <template v-if="localPath">
              <div class="local-card changes-card">
                <div class="card-header">
                  <h4>📄 本地 Git 仓库变更</h4>
                  <el-button size="small" @click="refreshChanges" :loading="loadingChanges">
                    刷新
                  </el-button>
                </div>
                <div class="card-body">
                  <template v-if="changedFiles.length > 0">
                    <div class="changes-summary">
                      <el-tag type="warning">{{ changedFiles.length }} 个文件与本地 Git 仓库不一致</el-tag>
                    </div>
                    <div class="files-list-mini">
                      <div 
                        v-for="file in changedFiles.slice(0, 5)" 
                        :key="file.file"
                        class="file-item-mini"
                      >
                        <span class="file-status-mini" :class="file.type">
                          {{ file.type === 'added' ? 'A' : file.type === 'deleted' ? 'D' : file.type === 'untracked' ? '?' : 'M' }}
                        </span>
                        <span class="file-name-mini">{{ file.file }}</span>
                      </div>
                      <div v-if="changedFiles.length > 5" class="more-files">
                        还有 {{ changedFiles.length - 5 }} 个文件...
                      </div>
                    </div>
                    <el-button type="warning" @click="showChangesDialog = true">
                      比对 / 提交到本地 Git 仓库
                    </el-button>
                  </template>
                  <template v-else>
                    <div class="no-changes-info">
                      <el-icon color="#67c23a"><SuccessFilled /></el-icon>
                      <span>本地 Git 仓库没有待提交的修改</span>
                    </div>
                  </template>
                </div>
              </div>

              <div class="local-card">
                <div class="card-header">
                  <h4>⬆️ 推送代码</h4>
                </div>
                <div class="card-body">
                  <template v-if="changedFiles.length > 0">
                    <div class="push-disabled-info">
                      <el-icon color="#e6a23c"><Warning /></el-icon>
                      <span>请先提交到本地 Git 仓库</span>
                    </div>
                    <el-button type="primary" disabled>
                      <el-icon><Upload /></el-icon>
                      推送到远程
                    </el-button>
                  </template>
                  <template v-else>
                    <p class="card-desc">将已提交的代码推送到远程仓库</p>
                    <el-button type="primary" @click="showPushDialog = true">
                      <el-icon><Upload /></el-icon>
                      推送到远程
                    </el-button>
                  </template>
                </div>
              </div>
            </template>
          </div>
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

    <!-- 变更文件对话框 -->
    <el-dialog
      v-model="showChangesDialog"
      title="本地 Git 仓库变更"
      width="900px"
      :close-on-click-modal="false"
    >
      <div class="changes-container">
        <!-- 变更文件列表 -->
        <div class="files-list">
          <div class="files-header">
            <span>变更文件 ({{ changedFiles.length }})</span>
            <el-checkbox 
              v-model="selectAll" 
              @change="toggleSelectAll"
              :indeterminate="isIndeterminate"
            >
              全选
            </el-checkbox>
          </div>
          <el-scrollbar height="300px">
            <div 
              v-for="file in changedFiles" 
              :key="file.file"
              class="file-item"
              :class="{ active: selectedFile === file.file }"
              @click="selectFile(file)"
            >
              <el-checkbox 
                v-model="file.selected" 
                @click.stop
                @change="updateSelectAll"
              />
              <span class="file-status" :class="file.type">
                {{ file.type === 'added' ? 'A' : file.type === 'deleted' ? 'D' : file.type === 'untracked' ? '?' : 'M' }}
              </span>
              <span class="file-name">{{ file.file }}</span>
            </div>
          </el-scrollbar>
        </div>

        <!-- Diff 预览 -->
        <div class="diff-preview">
          <div class="diff-header">
            <span>{{ selectedFile || '选择文件查看差异' }}</span>
          </div>
          <el-scrollbar height="300px">
            <pre v-if="currentDiff" class="diff-content" v-html="formatDiff(currentDiff)"></pre>
            <el-empty v-else description="选择文件查看差异" />
          </el-scrollbar>
        </div>
      </div>

      <!-- 提交表单 -->
      <div class="commit-form">
        <el-input
          v-model="commitMessage"
          type="textarea"
          :rows="2"
          placeholder="提交说明（可选，默认：更新代码）"
          maxlength="200"
          show-word-limit
        />
        
        <!-- 版本标签（必填，强制小写 v 前缀） -->
        <div class="tag-option">
          <div class="tag-input-row">
            <span class="tag-label">版本标签 <span style="color: #f56c6c;">*</span></span>
            <div class="tag-input-wrapper">
              <span class="tag-prefix">v</span>
              <el-input
                v-model="tagVersion"
                placeholder="如 1.7.7"
                style="width: 150px;"
                size="small"
                @input="onTagVersionInput"
              />
            </div>
          </div>
          <div class="tag-info">
            <span v-if="latestTag" class="latest-tag">
              📌 当前最新标签：<el-tag size="small" type="info">{{ latestTag }}</el-tag>
              <span v-if="suggestedNextVersion" class="suggested-version">
                → 建议下一个：<el-tag size="small" type="success">v{{ suggestedNextVersion }}</el-tag>
              </span>
            </span>
            <span v-else class="latest-tag">
              📌 暂无标签，这将是第一个版本标签
            </span>
            <span class="tag-tip">版本号格式：v主版本.次版本.修订号（如 v1.7.7）</span>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showChangesDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="commitChanges"
          :loading="committing"
          :disabled="!hasSelectedFiles || !tagVersion.trim()"
        >
          提交到本地 Git 仓库
        </el-button>
      </template>
    </el-dialog>

    <!-- 推送对话框 -->
    <el-dialog
      v-model="showPushDialog"
      title="推送代码"
      width="500px"
    >
      <div class="push-form">
        <el-alert type="info" :closable="false">
          将本地已提交的代码和标签推送到远程仓库
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="showPushDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="confirmPush"
          :loading="pushing"
        >
          确认推送
        </el-button>
      </template>
    </el-dialog>

    <!-- 下载对话框 -->
    <el-dialog
      v-model="showCloneDialog"
      title="下载代码"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="仓库">
          <el-input :value="`zizhou/${repoName}`" disabled />
        </el-form-item>
        <el-form-item label="保存位置">
          <el-input v-model="clonePath" placeholder="选择保存位置">
            <template #append>
              <el-button @click="selectClonePath">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" style="margin-top: 10px;">
        下载代码不会建立关联关系。如需同步代码，请在下载后手动关联本地目录。
      </el-alert>

      <template #footer>
        <el-button @click="showCloneDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmClone" :loading="cloning" :disabled="!clonePath">
          开始下载
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, FolderOpened, Refresh, Link, SuccessFilled, Warning, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import modelRunnerService, { type Repository, type Versions } from '@/services/modelRunner.service'

const route = useRoute()
const router = useRouter()
const repoName = computed(() => route.params.repoName as string)
const repoFullName = computed(() => `zizhou/${repoName.value}`)

const loading = ref(false)
const error = ref<string | null>(null)
const repoDetail = ref<Repository | null>(null)
const versions = ref<Versions>({ branches: [], tags: [], commits: [] })
const activeTab = ref('branches')

// 执行相关
const showExecuteDialog = ref(false)
const executing = ref(false)
const executeForm = ref({
  version: '',
  version_type: 'branch' as 'branch' | 'tag' | 'commit'
})
const executeParamsText = ref('')

// Git 相关
const localPath = ref<string | null>(null)
const cloning = ref(false)
const pushing = ref(false)
const showCloneDialog = ref(false)
const clonePath = ref('')
const showPushDialog = ref(false)

// 变更相关
const showChangesDialog = ref(false)
const loadingChanges = ref(false)
const changedFiles = ref<Array<{
  status: string
  file: string
  staged: boolean
  type: string
  selected: boolean
}>>([])
const selectedFile = ref<string | null>(null)
const currentDiff = ref('')
const commitMessage = ref('')
const committing = ref(false)
const tagVersion = ref('')  // 用户输入的版本号（不含 v 前缀）
const latestTag = ref('')  // 当前最新标签

// 计算完整的标签名（加上 v 前缀）
const tagName = computed(() => {
  const version = tagVersion.value.trim()
  if (!version) return ''
  return `v${version}`
})

// 计算建议的下一个版本号
const suggestedNextVersion = computed(() => {
  if (!latestTag.value) return '1.0.0'
  
  // 移除 v/V 前缀，解析版本号
  const version = latestTag.value.replace(/^[vV]/, '')
  const parts = version.split('.').map(n => parseInt(n) || 0)
  
  // 修订号 +1
  if (parts.length >= 3) {
    parts[2] = (parts[2] || 0) + 1
  } else if (parts.length === 2) {
    parts.push(1)
  } else {
    return '1.0.1'
  }
  
  return parts.join('.')
})

// 版本号输入处理（只允许数字和点）
const onTagVersionInput = (value: string) => {
  // 移除非法字符，只保留数字和点
  tagVersion.value = value.replace(/[^0-9.]/g, '')
}

// 计算属性
const hasChanges = computed(() => changedFiles.value.length > 0)
const hasSelectedFiles = computed(() => changedFiles.value.some(f => f.selected))
const selectAll = ref(false)
const isIndeterminate = computed(() => {
  const selected = changedFiles.value.filter(f => f.selected).length
  return selected > 0 && selected < changedFiles.value.length
})

// 监听路由变化
watch(repoName, () => {
  loadData()
  checkLocalPath()
})

// 加载数据
const loadData = async () => {
  loading.value = true
  error.value = null

  try {
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
    
    // 更新最新标签（从远程数据中获取）
    updateLatestTag()
  } catch (err: any) {
    console.error('加载失败:', err)
    error.value = err.message || '加载数据失败，请检查网络连接'
  } finally {
    loading.value = false
  }
}

// 检查本地路径
const checkLocalPath = async () => {
  try {
    const result = await window.electronAPI.git.getLocalPath(repoFullName.value)
    if (result.success && result.data) {
      localPath.value = result.data
      await refreshChanges()
      updateLatestTag()  // 更新最新标签显示
    } else {
      localPath.value = null
      latestTag.value = ''
    }
  } catch (e) {
    console.error('检查本地路径失败:', e)
  }
}

// 更新最新标签（从远程仓库获取，因为这是团队共享的版本号）
const updateLatestTag = () => {
  // 从已加载的远程标签数据中获取
  if (versions.value.tags && versions.value.tags.length > 0) {
    // 按版本号排序，取最新的（忽略 v/V 前缀的大小写）
    const sortedTags = [...versions.value.tags].sort((a, b) => {
      // 移除 v/V 前缀，只比较数字部分
      const versionA = a.name.replace(/^[vV]/, '').split('.').map(n => parseInt(n) || 0)
      const versionB = b.name.replace(/^[vV]/, '').split('.').map(n => parseInt(n) || 0)
      
      // 逐位比较版本号
      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0
        const numB = versionB[i] || 0
        if (numA !== numB) return numB - numA  // 降序，大的在前
      }
      return 0
    })
    
    latestTag.value = sortedTags[0]?.name || ''
    console.log('最新标签:', latestTag.value, '（共', versions.value.tags.length, '个标签）')
  } else {
    latestTag.value = ''
  }
}

// 刷新变更列表
const refreshChanges = async () => {
  if (!localPath.value) return
  
  loadingChanges.value = true
  try {
    const result = await window.electronAPI.git.status(localPath.value)
    if (result.success && result.data) {
      changedFiles.value = result.data.map(f => ({ ...f, selected: false }))
    }
  } catch (e) {
    console.error('获取变更失败:', e)
  } finally {
    loadingChanges.value = false
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
  executeForm.value = { version, version_type: type }
  executeParamsText.value = ''
  showExecuteDialog.value = true
}

// 确认执行
const confirmExecute = async () => {
  executing.value = true
  try {
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

// 关联本地目录（智能检测 + 用户提示）
const linkLocalFolder = async () => {
  // 步骤1: 选择文件夹
  const selectedPath = await window.electronAPI.dialog.selectDirectory()
  if (!selectedPath) return
  
  try {
    // 步骤2: 检测文件夹状态
    const statusResult = await window.electronAPI.git.checkLocalStatus(selectedPath)
    if (!statusResult.success) {
      ElMessage.error(statusResult.error || '检测目录状态失败')
      return
    }
    
    const { isGitRepo, hasRemote, remoteUrl } = statusResult.data
    
    // 步骤3: 根据状态构建提示信息
    let confirmMessage = ''
    let confirmTitle = ''
    
    if (!isGitRepo) {
      // 情况1: 普通文件夹，需要初始化
      confirmTitle = '初始化 Git 仓库'
      confirmMessage = `
        <div style="line-height: 1.8;">
          <p><strong>检测结果：</strong>该目录尚未初始化为 Git 仓库</p>
          <p><strong>目录路径：</strong><code>${selectedPath}</code></p>
          <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
          <p><strong>系统将自动执行以下操作：</strong></p>
          <ol style="margin: 8px 0; padding-left: 20px;">
            <li>初始化 Git 仓库 <code>git init</code></li>
            <li>配置远程仓库地址</li>
            <li>建立本地关联</li>
          </ol>
          <p style="color: #67c23a;">✓ 完成后即可进行代码提交和版本管理</p>
        </div>
      `
    } else if (!hasRemote) {
      // 情况2: 已是 Git 仓库，但没有远程配置
      confirmTitle = '配置远程仓库'
      confirmMessage = `
        <div style="line-height: 1.8;">
          <p><strong>检测结果：</strong>该目录已是 Git 仓库，但未配置远程地址</p>
          <p><strong>目录路径：</strong><code>${selectedPath}</code></p>
          <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
          <p><strong>系统将自动执行以下操作：</strong></p>
          <ol style="margin: 8px 0; padding-left: 20px;">
            <li>配置远程仓库地址</li>
            <li>建立本地关联</li>
          </ol>
          <p style="color: #67c23a;">✓ 完成后即可进行代码提交和版本管理</p>
        </div>
      `
    } else {
      // 情况3: 已有 Git 仓库和远程配置
      const repoCloneUrl = repoDetail.value?.clone_url || ''
      if (remoteUrl.includes(repoName.value)) {
        // 远程地址匹配，直接关联
        confirmTitle = '确认关联'
        confirmMessage = `
          <div style="line-height: 1.8;">
            <p><strong>检测结果：</strong>该目录已是 Git 仓库，且远程地址匹配</p>
            <p><strong>目录路径：</strong><code>${selectedPath}</code></p>
            <p><strong>远程地址：</strong><code>${remoteUrl}</code></p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #67c23a;">✓ 将直接建立本地关联</p>
          </div>
        `
      } else {
        // 远程地址不匹配，询问是否覆盖
        confirmTitle = '⚠️ 远程地址不匹配'
        confirmMessage = `
          <div style="line-height: 1.8;">
            <p><strong>检测结果：</strong>该目录已关联其他远程仓库</p>
            <p><strong>目录路径：</strong><code>${selectedPath}</code></p>
            <p><strong>当前远程：</strong><code>${remoteUrl}</code></p>
            <p><strong>目标仓库：</strong><code>${repoCloneUrl}</code></p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #e6a23c;">⚠️ 继续操作将覆盖现有远程配置</p>
          </div>
        `
      }
    }
    
    // 步骤4: 用户确认
    await ElMessageBox.confirm(confirmMessage, confirmTitle, {
      confirmButtonText: '确认执行',
      cancelButtonText: '取消',
      dangerouslyUseHTMLString: true,
      type: isGitRepo && hasRemote && !remoteUrl.includes(repoName.value) ? 'warning' : 'info'
    })
    
    // 步骤5: 执行关联操作
    const remoteUrlToUse = repoDetail.value?.clone_url || `http://61.151.241.233:3030/zizhou/${repoName.value}.git`
    
    const initResult = await window.electronAPI.git.initAndLink(
      selectedPath,
      repoFullName.value,
      remoteUrlToUse
    )
    
    if (initResult.success) {
      localPath.value = selectedPath
      
      // 显示执行的步骤
      const stepsMsg = initResult.steps?.join(' → ') || '关联成功'
      ElMessage.success({
        message: `✅ ${stepsMsg}`,
        duration: 3000
      })
      
      await refreshChanges()
    } else {
      ElMessage.error(initResult.error || '关联失败')
    }
  } catch (e: any) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e.message || '操作失败')
    }
    // 用户取消，不提示
  }
}

// 解除关联
const unlinkLocal = async () => {
  try {
    await ElMessageBox.confirm('确定要解除本地目录关联吗？', '确认', {
      type: 'warning'
    })
    await window.electronAPI.git.removeLocalPath(repoFullName.value)
    localPath.value = null
    changedFiles.value = []
    ElMessage.success('已解除关联')
  } catch (e) {
    // 用户取消
  }
}

// 打开本地目录
const openLocalFolder = async () => {
  if (localPath.value) {
    await window.electronAPI.shell.openPath(localPath.value)
  }
}

// 下载代码
const downloadCode = async () => {
  try {
    const downloadsPath = await window.electronAPI.app.getPath('downloads')
    clonePath.value = `${downloadsPath}\\${repoName.value}`
  } catch (e) {
    clonePath.value = ''
  }
  showCloneDialog.value = true
}

// 选择下载路径
const selectClonePath = async () => {
  const result = await window.electronAPI.dialog.selectDirectory()
  if (result) {
    clonePath.value = `${result}\\${repoName.value}`
  }
}

// 确认下载
const confirmClone = async () => {
  if (!clonePath.value) {
    ElMessage.warning('请选择保存位置')
    return
  }
  
  cloning.value = true
  try {
    const repoUrl = `http://61.151.241.233:3030/zizhou/${repoName.value}.git`
    const result = await window.electronAPI.git.clone(repoUrl, clonePath.value, repoFullName.value)
    
    if (result.success) {
      showCloneDialog.value = false
      ElMessage.success(result.message || '下载成功')
    } else {
      ElMessage.error(result.error || '下载失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '下载失败')
  } finally {
    cloning.value = false
  }
}

// 确认推送
const confirmPush = async () => {
  if (!localPath.value) return
  
  pushing.value = true
  try {
    // 1. 推送代码
    const result = await window.electronAPI.git.push(localPath.value)
    if (!result.success) {
      ElMessage.error('推送代码失败：' + (result.error || '未知错误'))
      return
    }
    
    // 2. 推送标签
    const pushTagResult = await window.electronAPI.git.pushTags(localPath.value)
    if (!pushTagResult.success) {
      // 标签推送失败不阻断，可能没有新标签
      console.log('标签推送:', pushTagResult.error)
    }
    
    ElMessage.success('推送成功')
    showPushDialog.value = false
    
    await refreshChanges()
    await loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '推送失败')
  } finally {
    pushing.value = false
  }
}

// 选择文件查看 diff
const selectFile = async (file: { file: string; type: string; staged: boolean }) => {
  selectedFile.value = file.file
  
  if (!localPath.value) return
  
  try {
    if (file.type === 'untracked') {
      // 新文件，显示完整内容
      const result = await window.electronAPI.git.getFileContent(localPath.value, file.file)
      if (result.success) {
        currentDiff.value = `+++ ${file.file} (新文件)\n` + result.data?.split('\n').map(line => `+ ${line}`).join('\n')
      }
    } else {
      // 先尝试获取未暂存的 diff
      const diffResult = await window.electronAPI.git.diff(localPath.value, file.file)
      if (diffResult.success && diffResult.data && diffResult.data.trim()) {
        currentDiff.value = diffResult.data
        return
      }
      
      // 再尝试获取暂存区的 diff
      const stagedResult = await window.electronAPI.git.diffStaged(localPath.value, file.file)
      if (stagedResult.success && stagedResult.data && stagedResult.data.trim()) {
        currentDiff.value = stagedResult.data
        return
      }
      
      // 都没有差异
      currentDiff.value = '无内容差异（可能是权限或换行符变化）'
    }
  } catch (e) {
    console.error('获取差异失败:', e)
  }
}

// 格式化 diff 输出
const formatDiff = (diff: string): string => {
  return diff.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<span class="diff-add">${escapeHtml(line)}</span>`
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<span class="diff-del">${escapeHtml(line)}</span>`
    } else if (line.startsWith('@@')) {
      return `<span class="diff-info">${escapeHtml(line)}</span>`
    }
    return escapeHtml(line)
  }).join('\n')
}

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 全选/取消全选
const toggleSelectAll = (val: boolean) => {
  changedFiles.value.forEach(f => f.selected = val)
}

const updateSelectAll = () => {
  const selected = changedFiles.value.filter(f => f.selected).length
  selectAll.value = selected === changedFiles.value.length
}

// 提交变更（只提交到本地，不推送）
const commitChanges = async () => {
  if (!localPath.value) return
  
  const selectedFiles = changedFiles.value.filter(f => f.selected).map(f => f.file)
  if (selectedFiles.length === 0) {
    ElMessage.warning('请选择要提交的文件')
    return
  }
  
  // 版本标签必填
  if (!tagVersion.value.trim()) {
    ElMessage.warning('请输入版本号')
    return
  }
  
  // 验证版本号格式
  const versionPattern = /^\d+\.\d+\.\d+$/
  if (!versionPattern.test(tagVersion.value.trim())) {
    ElMessage.warning('版本号格式不正确，请使用 x.y.z 格式（如 1.7.7）')
    return
  }
  
  // 提交说明默认值
  const message = commitMessage.value.trim() || '更新代码'
  
  committing.value = true
  try {
    // 0. 检查标签是否已存在（忽略大小写，避免 v1.7.6 和 V1.7.6 重复）
    const localTagsResult = await window.electronAPI.git.getLocalTags(localPath.value)
    if (localTagsResult.success && localTagsResult.data) {
      const newTagLower = tagName.value.toLowerCase()
      const existingTag = localTagsResult.data.find(
        (t: string) => t.toLowerCase() === newTagLower
      )
      if (existingTag) {
        ElMessage.error(`版本 "${tagVersion.value}" 已存在（标签：${existingTag}），请使用其他版本号`)
        committing.value = false
        return
      }
    }
    
    // 1. 添加文件
    const addResult = await window.electronAPI.git.add(localPath.value, selectedFiles)
    if (!addResult.success) {
      ElMessage.error('添加文件失败：' + (addResult.error || '未知错误'))
      return
    }
    
    // 2. 提交
    const commitResult = await window.electronAPI.git.commit(localPath.value, message)
    if (!commitResult.success) {
      ElMessage.error('提交失败：' + (commitResult.error || '未知错误'))
      return
    }
    
    // 3. 创建版本标签（强制）
    const tagResult = await window.electronAPI.git.createTag(localPath.value, tagName.value.trim(), message)
    if (!tagResult.success) {
      ElMessage.error('创建标签失败：' + (tagResult.error || '未知错误'))
      return
    }
    
    ElMessage.success('提交成功，版本标签已创建（请点击"推送到远程"同步到服务器）')
    showChangesDialog.value = false
    commitMessage.value = ''
    tagVersion.value = ''
    
    // 刷新标签列表
    await loadData()
    await refreshChanges()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    committing.value = false
  }
}

onMounted(() => {
  loadData()
  checkLocalPath()
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
    }
  }
}

// 本地管理样式
.local-management {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  .local-card {
    background: #fafafa;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    overflow: hidden;

    .card-header {
      padding: 16px;
      border-bottom: 1px solid #ebeef5;
      display: flex;
      justify-content: space-between;
      align-items: center;

      h4 {
        margin: 0;
        font-size: 15px;
        color: #303133;
      }
    }

    .card-body {
      padding: 20px;

      .card-desc {
        margin: 0 0 16px 0;
        font-size: 13px;
        color: #909399;
      }
    }

    &.changes-card {
      grid-column: span 2;
    }
  }

  .linked-info {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;

    .linked-detail {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .linked-label {
        font-size: 14px;
        color: #67c23a;
        font-weight: 500;
      }

      .linked-path {
        font-size: 12px;
        color: #606266;
        word-break: break-all;
      }
    }
  }

  .linked-actions {
    display: flex;
    gap: 10px;
  }

  .unlinked-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: #909399;
  }

  .changes-summary {
    margin-bottom: 16px;
  }

  .files-list-mini {
    margin-bottom: 16px;
    padding: 12px;
    background: #fff;
    border-radius: 6px;

    .file-item-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 13px;

      .file-status-mini {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;

        &.added, &.untracked {
          background: #e1f3d8;
          color: #67c23a;
        }
        &.modified {
          background: #fdf6ec;
          color: #e6a23c;
        }
        &.deleted {
          background: #fef0f0;
          color: #f56c6c;
        }
      }

      .file-name-mini {
        color: #606266;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .more-files {
      padding-top: 8px;
      font-size: 12px;
      color: #909399;
    }
  }

  .no-changes-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #67c23a;
  }

  .push-disabled-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #e6a23c;
    margin-bottom: 12px;
    font-size: 13px;
  }
}

// 变更对话框样式
.changes-container {
  display: flex;
  gap: 20px;
  
  .files-list {
    width: 300px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    
    .files-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #ebeef5;
      font-weight: 600;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.2s;
      
      &:hover { background: #f5f7fa; }
      &.active { background: #ecf5ff; }
      
      .file-status {
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        font-size: 12px;
        font-weight: 600;
        
        &.added, &.untracked { background: #e1f3d8; color: #67c23a; }
        &.modified { background: #fdf6ec; color: #e6a23c; }
        &.deleted { background: #fef0f0; color: #f56c6c; }
      }
      
      .file-name {
        flex: 1;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
  
  .diff-preview {
    flex: 1;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    
    .diff-header {
      padding: 12px 16px;
      border-bottom: 1px solid #ebeef5;
      font-weight: 600;
    }
    
    .diff-content {
      padding: 16px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.6;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      
      :deep(.diff-add) { color: #67c23a; background: #e1f3d8; display: block; }
      :deep(.diff-del) { color: #f56c6c; background: #fef0f0; display: block; }
      :deep(.diff-info) { color: #409eff; background: #ecf5ff; display: block; }
    }
  }
}

.commit-form {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;

  .tag-option {
    margin-top: 16px;
    
    .tag-input-row {
      display: flex;
      align-items: center;
    }
    
    .tag-label {
      font-weight: 500;
      white-space: nowrap;
    }
    
    .tag-input-wrapper {
      display: flex;
      align-items: center;
      margin-left: 10px;
      
      .tag-prefix {
        background: #f0f2f5;
        border: 1px solid #dcdfe6;
        border-right: none;
        border-radius: 4px 0 0 4px;
        padding: 0 10px;
        height: 24px;
        line-height: 24px;
        font-family: monospace;
        font-weight: 600;
        color: #606266;
      }
      
      :deep(.el-input__wrapper) {
        border-radius: 0 4px 4px 0;
      }
    }
    
    .tag-info {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-left: 2px;
    }
    
    .latest-tag {
      font-size: 13px;
      color: #606266;
      
      .el-tag {
        margin-left: 6px;
      }
      
      .suggested-version {
        margin-left: 10px;
        color: #67c23a;
      }
    }
    
    .tag-tip {
      font-size: 12px;
      color: #909399;
    }
  }
}

.push-form {
  .tag-option-push {
    margin-bottom: 16px;
  }
  
  .tag-input-push {
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;
  }
}

.execute-form {
  h4 {
    margin: 16px 0 8px 0;
    font-size: 14px;
    color: #303133;
  }
}
</style>

