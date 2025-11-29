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

        <!-- 仓库管理 -->
        <el-tab-pane name="local">
          <template #label>
            <span>
              仓库管理
              <el-badge v-if="hasChanges" :value="changedFiles.length" type="warning" style="margin-left: 5px;" />
            </span>
          </template>
          
          <div class="local-management">
            <!-- ==================== 仓库配置区域 ==================== -->
            <div class="section-group">
              <div class="section-header">
                <span class="section-icon">⚙️</span>
                <h3>仓库配置</h3>
                <span class="section-desc">关联项目文件夹、初始化 Git 仓库</span>
              </div>
              
              <div class="section-cards">
                <!-- 关联状态卡片 -->
                <div class="local-card">
                  <div class="card-header">
                    <h4>📁 关联项目文件夹</h4>
                  </div>
                  <div class="card-body">
                    <template v-if="isLinked">
                      <div class="linked-info">
                        <el-icon color="#67c23a" size="20"><SuccessFilled /></el-icon>
                        <div class="linked-detail">
                          <span class="linked-label">
                            {{ linkType === 'local' ? '已关联本地文件夹' : '已关联远程文件夹 (SSH)' }}
                          </span>
                          <span class="linked-path">{{ linkedPath }}</span>
                        </div>
                      </div>
                      <div class="linked-actions">
                        <template v-if="linkType === 'local'">
                          <el-button size="small" @click="openLocalFolder">
                            <el-icon><FolderOpened /></el-icon>
                            打开目录
                          </el-button>
                          <el-button size="small" @click="openGitFolder">
                            <el-icon><Folder /></el-icon>
                            打开 .git 文件夹
                          </el-button>
                        </template>
                        <template v-else-if="linkType === 'ssh'">
                          <el-button size="small" @click="openSSHTerminal">
                            <el-icon><FolderOpened /></el-icon>
                            打开目录
                          </el-button>
                          <el-button size="small" @click="openSSHTerminalGit">
                            <el-icon><Folder /></el-icon>
                            打开 .git 文件夹
                          </el-button>
                        </template>
                        <el-button size="small" type="danger" plain @click="unlinkLocal">
                          解除关联
                        </el-button>
                      </div>
                      
                      <!-- .gitignore 配置状态 -->
                      <div class="gitignore-status" @click="openIgnoreConfig">
                        <template v-if="hasGitignore">
                          <el-icon color="#67c23a"><SuccessFilled /></el-icon>
                          <span class="status-text success">忽略规则已配置</span>
                          <el-button type="primary" link size="small">编辑</el-button>
                        </template>
                        <template v-else>
                          <el-icon color="#909399"><Warning /></el-icon>
                          <span class="status-text">忽略规则未配置</span>
                          <el-button type="primary" link size="small">添加</el-button>
                        </template>
                      </div>
                    </template>
                    <template v-else>
                      <div class="link-options">
                        <div class="link-option-card" @click="linkLocalFolder">
                          <div class="option-icon local">
                            <el-icon size="28"><FolderOpened /></el-icon>
                          </div>
                          <div class="option-content">
                            <h5>本地文件夹</h5>
                            <p>关联电脑上的项目目录</p>
                          </div>
                          <el-icon class="option-arrow"><ArrowRight /></el-icon>
                        </div>
                        <div class="link-option-card" @click="linkRemoteFolder">
                          <div class="option-icon remote">
                            <el-icon size="28"><Link /></el-icon>
                          </div>
                          <div class="option-content">
                            <h5>远程文件夹 (SSH)</h5>
                            <p>通过 SSH 连接服务器目录</p>
                          </div>
                          <el-icon class="option-arrow"><ArrowRight /></el-icon>
                        </div>
                      </div>
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
              </div>
            </div>

            <!-- ==================== 代码同步区域 ==================== -->
            <template v-if="isLinked">
              <div class="section-group sync-section">
                <div class="section-header">
                  <span class="section-icon">🔄</span>
                  <h3>代码同步</h3>
                  <span class="section-desc">提交变更、推送到远程仓库</span>
                </div>
                
                <div class="section-cards">
                  <!-- 本地 Git 仓库变更卡片 -->
                  <div class="local-card changes-card">
                    <div class="card-header">
                      <h4>📄 本地变更</h4>
                      <el-button size="small" @click="refreshChanges" :loading="loadingChanges">
                        刷新
                      </el-button>
                    </div>
                    <div class="card-body">
                      <template v-if="changedFiles.length > 0">
                        <div class="changes-summary">
                          <el-tag type="warning">{{ changedFiles.length }} 个文件有变更</el-tag>
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
                          比对 / 提交到本地
                        </el-button>
                      </template>
                      <template v-else>
                        <div class="no-changes-info">
                          <el-icon color="#67c23a"><SuccessFilled /></el-icon>
                          <span>暂无待提交的变更</span>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- 推送代码卡片 -->
                  <div class="local-card">
                    <div class="card-header">
                      <h4>⬆️ 推送到远程</h4>
                    </div>
                    <div class="card-body">
                      <template v-if="changedFiles.length > 0">
                        <div class="push-disabled-info">
                          <el-icon color="#e6a23c"><Warning /></el-icon>
                          <span>请先提交本地变更</span>
                        </div>
                        <el-button type="primary" disabled>
                          <el-icon><Upload /></el-icon>
                          推送到远程
                        </el-button>
                      </template>
                      <template v-else>
                        <p class="card-desc">将已提交的代码和标签推送到远程仓库</p>
                        <el-button type="primary" @click="showPushDialog = true">
                          <el-icon><Upload /></el-icon>
                          推送到远程
                        </el-button>
                      </template>
                    </div>
                  </div>
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

        <!-- Diff 预览（GitHub Desktop 风格） -->
        <div class="diff-preview">
          <div class="diff-header">
            <span>{{ selectedFile || '选择文件查看差异' }}</span>
          </div>
          <el-scrollbar height="300px">
            <div v-if="currentDiff" class="diff-content-wrapper">
              <table class="diff-table">
                <tbody>
                  <tr 
                    v-for="(line, idx) in parseDiffLines(currentDiff)" 
                    :key="idx"
                    :class="['diff-line', line.type]"
                  >
                    <td class="line-num old">{{ line.oldNum || '' }}</td>
                    <td class="line-num new">{{ line.newNum || '' }}</td>
                    <td class="line-sign">{{ line.sign }}</td>
                    <td class="line-content">{{ line.content }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
        下载代码不会建立关联关系。如需同步代码，请在下载后手动关联项目文件夹。
      </el-alert>

      <template #footer>
        <el-button @click="showCloneDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmClone" :loading="cloning" :disabled="!clonePath">
          开始下载
        </el-button>
      </template>
    </el-dialog>

    <!-- SSH 远程连接对话框 -->
    <el-dialog
      v-model="showSSHDialog"
      title="关联远程文件夹 (SSH)"
      width="650px"
      :close-on-click-modal="false"
    >
      <!-- 步骤 1：连接信息 -->
      <div v-if="sshStep === 1">
        <el-form :model="sshForm" label-width="100px">
          <el-form-item label="服务器地址" required>
            <el-input v-model="sshForm.host" placeholder="如 192.168.1.100 或 example.com" />
          </el-form-item>
          <el-form-item label="端口" required>
            <el-input-number v-model="sshForm.port" :min="1" :max="65535" style="width: 100%;" />
          </el-form-item>
          <el-form-item label="用户名" required>
            <el-input v-model="sshForm.username" placeholder="SSH 登录用户名" />
          </el-form-item>
          <el-form-item label="密码" required>
            <el-input v-model="sshForm.password" type="password" placeholder="SSH 登录密码" show-password />
          </el-form-item>
        </el-form>

        <div v-if="sshTestResult" class="ssh-test-result" :class="sshTestResult.success ? 'success' : 'error'">
          <el-icon v-if="sshTestResult.success"><SuccessFilled /></el-icon>
          <el-icon v-else><Warning /></el-icon>
          <span>{{ sshTestResult.message }}</span>
        </div>
      </div>

      <!-- 步骤 2：选择文件夹 -->
      <div v-else-if="sshStep === 2" class="ssh-folder-browser">
        <div class="browser-header">
          <el-button size="small" @click="sshStep = 1" :icon="ArrowLeft">返回</el-button>
          <span class="current-path">📁 {{ sshCurrentPath || '/' }}</span>
        </div>
        
        <div class="browser-tip">
          💡 单击选择文件夹，双击进入文件夹
        </div>
        
        <div class="folder-list" v-loading="sshLoadingFolders">
          <!-- 上级目录 -->
          <div v-if="sshCurrentPath !== '/' && sshCurrentPath !== ''" class="folder-item parent-folder" @click="sshNavigateUp">
            <el-icon><FolderOpened /></el-icon>
            <span>.. (返回上级)</span>
          </div>
          <!-- 文件夹列表 -->
          <div 
            v-for="folder in sshFolders" 
            :key="folder.name" 
            class="folder-item"
            :class="{ selected: sshSelectedFolder === folder.path, 'is-git': folder.isGit }"
            @click="sshSelectFolder(folder)"
            @dblclick="sshEnterFolder(folder)"
          >
            <el-icon><Folder /></el-icon>
            <span>{{ folder.name }}</span>
            <el-tag v-if="folder.isGit" size="small" type="success">✓ Git 仓库</el-tag>
          </div>
          <div v-if="sshFolders.length === 0 && !sshLoadingFolders" class="empty-hint">
            此目录下没有子文件夹
          </div>
        </div>

        <div v-if="sshSelectedFolder" class="selected-info">
          <el-icon><SuccessFilled /></el-icon>
          <span>已选择：{{ sshSelectedFolder }}</span>
        </div>
      </div>

      <template #footer>
        <template v-if="sshStep === 1">
          <el-button @click="showSSHDialog = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="testSSHConnection" 
            :loading="sshTesting"
            :disabled="!sshForm.host || !sshForm.username || !sshForm.password"
          >
            测试连接
          </el-button>
        </template>
        <template v-else>
          <el-button @click="showSSHDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmSSHConnect" :loading="sshConnecting" :disabled="!sshSelectedFolder">
            确认关联
          </el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 忽略规则配置对话框 -->
    <el-dialog
      v-model="showIgnoreDialog"
      title="选择不需要同步的文件类型"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="ignore-config">
        <el-alert type="info" :closable="false" style="margin-bottom: 20px;">
          <template #title>
            勾选不需要同步到远程仓库的文件类型
          </template>
        </el-alert>
        
        <!-- 文件类型列表 -->
        <div class="file-type-list">
          <div 
            v-for="type in fileTypeOptions" 
            :key="type.id"
            class="file-type-item"
            :class="{ 'is-selected': type.selected }"
            @click="type.selected = !type.selected"
          >
            <el-checkbox v-model="type.selected" @click.stop />
            <span class="type-icon">{{ type.icon }}</span>
            <div class="type-info">
              <span class="type-name">{{ type.name }}</span>
              <span class="type-desc">{{ type.desc }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="skipIgnoreConfig">跳过</el-button>
        <el-button type="primary" @click="saveFileTypeSelection" :loading="savingIgnore">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Download, FolderOpened, Folder, Link, SuccessFilled, Warning, Upload } from '@element-plus/icons-vue'
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

// SSH 远程连接相关
const showSSHDialog = ref(false)
const sshStep = ref(1)  // 1=连接信息, 2=选择文件夹
const sshTesting = ref(false)
const sshConnecting = ref(false)
const sshForm = ref({
  host: '',
  port: 22,
  username: '',
  password: ''
})
const sshTestResult = ref<{ success: boolean; message: string; osType?: string } | null>(null)
// 文件夹浏览相关
const sshCurrentPath = ref('')
const sshFolders = ref<Array<{ name: string; path: string; isGit: boolean }>>([])
const sshSelectedFolder = ref('')
const sshLoadingFolders = ref(false)
const sshDetectedOS = ref<'linux' | 'windows'>('linux')
// 远程连接信息
const remoteSSHConfig = ref<any>(null)

// 忽略规则配置相关
const showIgnoreDialog = ref(false)
const savingIgnore = ref(false)
const ignoreConfigType = ref<'local' | 'ssh'>('local')
const pendingLinkPath = ref('')
const loadingIgnoreFiles = ref(false)
const hasGitignore = ref(false)  // 是否有 .gitignore 文件

// 文件类型选项（通俗易懂）
const fileTypeOptions = ref([
  { id: 'log', name: '日志文件', desc: '*.log, logs/', icon: '📝', selected: true, patterns: ['*.log', 'logs/'] },
  { id: 'tmp', name: '临时文件', desc: '*.tmp, *.temp, tmp/', icon: '🗑️', selected: true, patterns: ['*.tmp', '*.temp', 'tmp/', 'temp/'] },
  { id: 'cache', name: '缓存文件', desc: '*.cache, __pycache__/', icon: '💾', selected: true, patterns: ['*.cache', '__pycache__/', '.cache/'] },
  { id: 'build', name: '编译产物', desc: 'build/, bin/, dist/', icon: '🔨', selected: false, patterns: ['build/', 'bin/', 'dist/', 'out/', 'target/'] },
  { id: 'deps', name: '依赖包', desc: 'node_modules/, venv/', icon: '📦', selected: false, patterns: ['node_modules/', 'venv/', '.venv/', 'vendor/'] },
  { id: 'ide', name: '编辑器配置', desc: '.idea/, .vscode/', icon: '⚙️', selected: false, patterns: ['.idea/', '.vscode/', '*.swp', '*.swo'] },
  { id: 'env', name: '环境配置', desc: '.env, *.local', icon: '🔐', selected: false, patterns: ['.env', '.env.*', '*.local'] },
  { id: 'backup', name: '备份文件', desc: '*.bak, *.backup', icon: '📋', selected: false, patterns: ['*.bak', '*.backup', '*~'] },
])

// 是否已关联（本地或远程）
const isLinked = computed(() => !!localPath.value || !!remoteSSHConfig.value)
// 关联类型
const linkType = computed(() => {
  if (localPath.value) return 'local'
  if (remoteSSHConfig.value) return 'ssh'
  return null
})
// 关联路径显示
const linkedPath = computed(() => {
  if (localPath.value) return localPath.value
  if (remoteSSHConfig.value) return `${remoteSSHConfig.value.host}:${remoteSSHConfig.value.remotePath}`
  return ''
})

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
    // 先检查本地路径
    const result = await window.electronAPI.git.getLocalPath(repoFullName.value)
    if (result.success && result.data) {
      localPath.value = result.data
      await refreshChanges()
      updateLatestTag()
      await checkGitignoreExists()
      return
    }
    
    // 再检查 SSH 配置
    const sshResult = await window.electronAPI.ssh.getRepoConfig(repoFullName.value)
    if (sshResult.success && sshResult.data) {
      remoteSSHConfig.value = sshResult.data
      // 重新连接并刷新变更
      await window.electronAPI.ssh.connect(sshResult.data)
      await refreshChanges()
      updateLatestTag()
      await checkGitignoreExists()
      return
    }
    
    // 都没有，清空状态
    localPath.value = null
    remoteSSHConfig.value = null
    latestTag.value = ''
    hasGitignore.value = false
  } catch (e) {
    console.error('检查关联状态失败:', e)
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
  // 本地关联
  if (localPath.value) {
    loadingChanges.value = true
    try {
      const result = await window.electronAPI.git.status(localPath.value)
      if (result.success && result.data) {
        changedFiles.value = result.data.map(f => ({ ...f, selected: false }))
      }
    } catch (e) {
      console.error('获取本地变更失败:', e)
    } finally {
      loadingChanges.value = false
    }
    return
  }
  
  // SSH 远程关联
  if (remoteSSHConfig.value) {
    loadingChanges.value = true
    try {
      const result = await window.electronAPI.ssh.gitStatus(remoteSSHConfig.value.id)
      if (result.success && result.data) {
        changedFiles.value = result.data.map((f: any) => ({ ...f, selected: false }))
      } else {
        // 如果连接失效，尝试重新连接
        const reconnect = await window.electronAPI.ssh.connect(remoteSSHConfig.value)
        if (reconnect.success) {
          const retryResult = await window.electronAPI.ssh.gitStatus(remoteSSHConfig.value.id)
          if (retryResult.success && retryResult.data) {
            changedFiles.value = retryResult.data.map((f: any) => ({ ...f, selected: false }))
          }
        }
      }
    } catch (e) {
      console.error('获取远程变更失败:', e)
    } finally {
      loadingChanges.value = false
    }
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

// 关联项目文件夹（智能检测 + 用户提示）
const linkLocalFolder = async () => {
  // 步骤1: 选择文件夹
  const selectedPath = await window.electronAPI.dialog.selectDirectory()
  if (!selectedPath) return
  
  try {
    // 步骤2: 检测文件夹状态
    const statusResult = await window.electronAPI.git.checkLocalStatus(selectedPath)
    if (!statusResult.success || !statusResult.data) {
      ElMessage.error(statusResult.error || '检测目录状态失败')
      return
    }
    
    const { isGitRepo, hasRemote, remoteUrl } = statusResult.data!
    
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
            <li>建立项目关联</li>
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
            <li>建立项目关联</li>
          </ol>
          <p style="color: #67c23a;">✓ 完成后即可进行代码提交和版本管理</p>
        </div>
      `
    } else {
      // 情况3: 已有 Git 仓库和远程配置
      const repoCloneUrl = repoDetail.value?.clone_url || ''
      if (remoteUrl?.includes(repoName.value)) {
        // 远程地址匹配，直接关联
        confirmTitle = '确认关联'
        confirmMessage = `
          <div style="line-height: 1.8;">
            <p><strong>检测结果：</strong>该目录已是 Git 仓库，且远程地址匹配</p>
            <p><strong>目录路径：</strong><code>${selectedPath}</code></p>
            <p><strong>远程地址：</strong><code>${remoteUrl}</code></p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #67c23a;">✓ 将直接建立项目关联</p>
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
      type: isGitRepo && hasRemote && !remoteUrl?.includes(repoName.value) ? 'warning' : 'info'
    })
    
    // 步骤5: 执行关联操作
    const remoteUrlToUse = repoDetail.value?.clone_url || `http://61.151.241.233:3030/zizhou/${repoName.value}.git`
    
    const initResult = await window.electronAPI.git.initAndLink(
      selectedPath,
      repoFullName.value,
      remoteUrlToUse
    )
    
    if (initResult.success) {
      // 检查是否是新初始化的 Git 仓库
      const wasNewRepo = initResult.steps?.includes('初始化 Git 仓库')
      
      if (wasNewRepo) {
        // 新初始化的仓库，询问是否配置忽略规则
        await askIgnoreConfigLocal(selectedPath)
      } else {
        // 已有仓库，直接完成关联
        localPath.value = selectedPath
        const stepsMsg = initResult.steps?.join(' → ') || '关联成功'
        ElMessage.success({
          message: `✅ ${stepsMsg}`,
          duration: 3000
        })
        await refreshChanges()
        updateLatestTag()
      }
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
    const isSSH = linkType.value === 'ssh'
    await ElMessageBox.confirm(
      isSSH ? '确定要解除远程 SSH 关联吗？' : '确定要解除本地目录关联吗？', 
      '确认', 
      { type: 'warning' }
    )
    
    if (isSSH) {
      // 解除 SSH 关联
      if (remoteSSHConfig.value?.id) {
        await window.electronAPI.ssh.disconnect(remoteSSHConfig.value.id)
        await window.electronAPI.ssh.deleteConfig(remoteSSHConfig.value.id)
      }
      // 删除持久化配置
      await window.electronAPI.ssh.removeRepoConfig(repoFullName.value)
      remoteSSHConfig.value = null
    } else {
      // 解除本地关联
      await window.electronAPI.git.removeLocalPath(repoFullName.value)
      localPath.value = null
    }
    
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

// 打开 .git 文件夹
const openGitFolder = async () => {
  if (localPath.value) {
    const gitPath = `${localPath.value}\\.git`
    await window.electronAPI.shell.openPath(gitPath)
  }
}

// ==================== 忽略规则配置 ====================

// 检查 .gitignore 是否存在
const checkGitignoreExists = async () => {
  try {
    if (localPath.value) {
      const result = await window.electronAPI.git.readGitignore(localPath.value)
      hasGitignore.value = result.success && (result.exists ?? false)
    } else if (remoteSSHConfig.value) {
      const config = remoteSSHConfig.value
      const result = await window.electronAPI.ssh.readGitignore(
        { host: config.host, port: config.port, username: config.username, password: config.password },
        config.remotePath,
        config.osType || 'linux'
      )
      hasGitignore.value = result.success && (result.exists ?? false)
    } else {
      hasGitignore.value = false
    }
  } catch {
    hasGitignore.value = false
  }
}

// 打开忽略规则配置
const openIgnoreConfig = async () => {
  loadingIgnoreFiles.value = true
  
  if (localPath.value) {
    ignoreConfigType.value = 'local'
    pendingLinkPath.value = localPath.value
  } else if (remoteSSHConfig.value) {
    ignoreConfigType.value = 'ssh'
    pendingLinkPath.value = remoteSSHConfig.value.remotePath
  }
  
  // 先重置所有选项
  fileTypeOptions.value.forEach(opt => opt.selected = false)
  
  // 读取已有的 .gitignore 内容
  try {
    let content = ''
    if (ignoreConfigType.value === 'local') {
      const result = await window.electronAPI.git.readGitignore(pendingLinkPath.value)
      if (result.success && result.exists) {
        content = result.content || ''
      }
    } else {
      const config = remoteSSHConfig.value
      if (config) {
        const result = await window.electronAPI.ssh.readGitignore(
          { host: config.host, port: config.port, username: config.username, password: config.password },
          config.remotePath,
          config.osType || 'linux'
        )
        if (result.success && result.exists) {
          content = result.content || ''
        }
      }
    }
    
    // 根据内容匹配选中对应的类型
    if (content) {
      for (const opt of fileTypeOptions.value) {
        // 检查是否有任何一个 pattern 在内容中
        const hasMatch = opt.patterns.some(pattern => content.includes(pattern))
        opt.selected = hasMatch
      }
    } else {
      // 没有内容，使用默认选中
      resetFileTypeOptions()
    }
  } catch (e) {
    console.error('读取 .gitignore 失败:', e)
    resetFileTypeOptions()
  }
  
  loadingIgnoreFiles.value = false
  showIgnoreDialog.value = true
}

// 重置文件类型选项
const resetFileTypeOptions = () => {
  fileTypeOptions.value.forEach(opt => {
    // 默认选中日志、临时文件、缓存
    opt.selected = ['log', 'tmp', 'cache'].includes(opt.id)
  })
}

// 生成 .gitignore 内容
const generateGitignoreFromTypes = () => {
  const lines = ['# 自动生成的忽略规则', '']
  const selectedTypes = fileTypeOptions.value.filter(t => t.selected)
  
  for (const type of selectedTypes) {
    lines.push(`# ${type.name}`)
    lines.push(...type.patterns)
    lines.push('')
  }
  
  return lines.join('\n')
}

// 保存文件类型选择
const saveFileTypeSelection = async () => {
  console.log('[前端] saveFileTypeSelection 开始')
  const selectedTypes = fileTypeOptions.value.filter(t => t.selected)
  
  if (selectedTypes.length === 0) {
    console.log('[前端] 没有选择，跳过')
    await skipIgnoreConfig()
    return
  }
  
  savingIgnore.value = true
  try {
    const content = generateGitignoreFromTypes()
    console.log('[前端] 生成内容:', content)
    console.log('[前端] 类型:', ignoreConfigType.value, '路径:', pendingLinkPath.value)
    
    if (ignoreConfigType.value === 'local') {
      console.log('[前端] 写入本地...')
      await window.electronAPI.git.writeGitignore(pendingLinkPath.value, content)
      console.log('[前端] 本地写入完成')
    } else {
      const config = remoteSSHConfig.value
      console.log('[前端] SSH 配置:', config)
      if (!config) {
        ElMessage.error('SSH 配置丢失')
        savingIgnore.value = false
        return
      }
      console.log('[前端] 写入远程...')
      const result = await window.electronAPI.ssh.writeGitignore(
        { host: config.host, port: config.port, username: config.username, password: config.password },
        pendingLinkPath.value,
        content,
        config.osType || 'linux'
      )
      console.log('[前端] 远程写入结果:', result)
    }
    
    showIgnoreDialog.value = false
    hasGitignore.value = true  // 保存成功，更新状态
    ElMessage.success('忽略规则已保存')
    
    // 如果是从关联流程来的，完成关联
    if (!isLinked.value) {
      if (ignoreConfigType.value === 'local') {
        await finishLocalLink(pendingLinkPath.value)
      } else {
        await finishSSHLink(pendingLinkPath.value)
      }
    }
  } catch (e: any) {
    console.error('[前端] 保存失败:', e)
    ElMessage.error('保存失败：' + e.message)
  } finally {
    savingIgnore.value = false
  }
}

// 询问是否配置忽略规则（本地）
const askIgnoreConfigLocal = async (dirPath: string) => {
  try {
    await ElMessageBox.confirm(
      '是否需要配置文件忽略规则？\n\n可以选择哪些类型的文件不需要同步（如日志、临时文件等）',
      '关联成功',
      { confirmButtonText: '配置', cancelButtonText: '跳过', type: 'success' }
    )
    ignoreConfigType.value = 'local'
    pendingLinkPath.value = dirPath
    resetFileTypeOptions()
    showIgnoreDialog.value = true
  } catch {
    await finishLocalLink(dirPath)
  }
}

// 询问是否配置忽略规则（SSH）
const askIgnoreConfigSSH = async (remotePath: string) => {
  try {
    await ElMessageBox.confirm(
      '是否需要配置文件忽略规则？\n\n可以选择哪些类型的文件不需要同步（如日志、临时文件等）',
      '关联成功',
      { confirmButtonText: '配置', cancelButtonText: '跳过', type: 'success' }
    )
    ignoreConfigType.value = 'ssh'
    pendingLinkPath.value = remotePath
    resetFileTypeOptions()
    showIgnoreDialog.value = true
  } catch {
    await finishSSHLink(remotePath)
  }
}

// 跳过
const skipIgnoreConfig = async () => {
  showIgnoreDialog.value = false
  if (ignoreConfigType.value === 'local') {
    await finishLocalLink(pendingLinkPath.value)
  } else {
    await finishSSHLink(pendingLinkPath.value)
  }
}

// 完成本地关联
const finishLocalLink = async (dirPath: string) => {
  localPath.value = dirPath
  await refreshChanges()
  updateLatestTag()
  await checkGitignoreExists()
  ElMessage.success('关联成功！')
}

// 完成 SSH 关联
const finishSSHLink = async (_remotePath: string) => {
  // 已经在 confirmSSHConnect 中保存了配置
  ElMessage.success('远程关联成功！')
  await refreshChanges()
  updateLatestTag()
  await checkGitignoreExists()
}

// 打开远程目录（文件管理器）
const openSSHTerminal = async () => {
  if (!remoteSSHConfig.value) return
  
  const { host, port, username, remotePath } = remoteSSHConfig.value
  try {
    const result = await window.electronAPI.ssh.openTerminal(host, port, username, remotePath) as { success: boolean; message?: string; sftpUrl?: string; error?: string }
    if (result.success) {
      ElMessage.success('已打开远程目录')
    } else {
      // 打开失败，复制 SFTP 地址
      const sftpUrl = result.sftpUrl || `sftp://${username}@${host}:${port}${remotePath}`
      navigator.clipboard.writeText(sftpUrl)
      ElMessage.info('已复制 SFTP 地址，可在文件管理器或 WinSCP 中打开')
    }
  } catch (e: any) {
    ElMessage.error('打开失败：' + e.message)
  }
}

// 打开远程 .git 目录（文件管理器）
const openSSHTerminalGit = async () => {
  if (!remoteSSHConfig.value) return
  
  const { host, port, username, remotePath, osType } = remoteSSHConfig.value
  const gitPath = osType === 'windows' 
    ? `${remotePath}\\.git`
    : `${remotePath}/.git`
  
  try {
    const result = await window.electronAPI.ssh.openTerminal(host, port, username, gitPath) as { success: boolean; message?: string; sftpUrl?: string; error?: string }
    if (result.success) {
      ElMessage.success('已打开 .git 目录')
    } else {
      const sftpUrl = result.sftpUrl || `sftp://${username}@${host}:${port}${gitPath}`
      navigator.clipboard.writeText(sftpUrl)
      ElMessage.info('已复制 SFTP 地址，可在文件管理器或 WinSCP 中打开')
    }
  } catch (e: any) {
    ElMessage.error('打开失败：' + e.message)
  }
}

// 关联远程文件夹（SSH）
const linkRemoteFolder = () => {
  // 重置状态
  sshStep.value = 1
  sshForm.value = {
    host: '',
    port: 22,
    username: '',
    password: ''
  }
  sshTestResult.value = null
  sshCurrentPath.value = ''
  sshFolders.value = []
  sshSelectedFolder.value = ''
  showSSHDialog.value = true
}

// 测试 SSH 连接
const testSSHConnection = async () => {
  sshTesting.value = true
  sshTestResult.value = null
  
  try {
    const result = await window.electronAPI.ssh.testConnection({
      host: sshForm.value.host,
      port: sshForm.value.port,
      username: sshForm.value.username,
      password: sshForm.value.password
    })
    
    if (result.success) {
      sshDetectedOS.value = (result.osType || 'linux') as 'linux' | 'windows'
      sshTestResult.value = {
        success: true,
        message: `✅ 连接成功！检测到：${result.osType === 'windows' ? 'Windows' : 'Linux'} 服务器`,
        osType: result.osType
      }
      
      // 自动进入第二步，选择文件夹
      setTimeout(() => {
        sshStep.value = 2
        // 加载起始目录
        const startPath = result.osType === 'windows' ? 'C:\\' : '/home'
        sshNavigateTo(startPath)
      }, 300)
    } else {
      sshTestResult.value = {
        success: false,
        message: `连接失败：${result.error}`
      }
    }
  } catch (e: any) {
    sshTestResult.value = {
      success: false,
      message: `连接失败：${e.message}`
    }
  } finally {
    sshTesting.value = false
  }
}

// 浏览远程目录
const sshNavigateTo = async (path: string) => {
  sshLoadingFolders.value = true
  sshCurrentPath.value = path
  sshFolders.value = []
  
  try {
    const result = await window.electronAPI.ssh.listDirectory(
      {
        host: sshForm.value.host,
        port: sshForm.value.port,
        username: sshForm.value.username,
        password: sshForm.value.password
      },
      path,
      sshDetectedOS.value
    )
    
    if (result.success) {
      sshFolders.value = result.data || []
    } else {
      ElMessage.error('浏览目录失败：' + result.error)
    }
  } catch (e: any) {
    console.error('浏览目录失败:', e)
    ElMessage.error('浏览目录失败：' + e.message)
  } finally {
    sshLoadingFolders.value = false
  }
}

// 进入上级目录
const sshNavigateUp = () => {
  let parentPath: string
  if (sshDetectedOS.value === 'windows') {
    const parts = sshCurrentPath.value.split('\\').filter(Boolean)
    parts.pop()
    parentPath = parts.length > 0 ? parts.join('\\') : 'C:\\'
    if (parentPath.length === 2 && parentPath[1] === ':') parentPath += '\\'
  } else {
    const parts = sshCurrentPath.value.split('/').filter(Boolean)
    parts.pop()
    parentPath = '/' + parts.join('/')
  }
  sshNavigateTo(parentPath)
}

// 选择文件夹
const sshSelectFolder = (folder: { name: string; path: string; isGit: boolean }) => {
  sshSelectedFolder.value = folder.path
}

// 进入文件夹
const sshEnterFolder = (folder: { name: string; path: string; isGit: boolean }) => {
  sshNavigateTo(folder.path)
}

// 在远程服务器初始化 Git 仓库
const initRemoteGitRepo = async (remotePath: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await window.electronAPI.ssh.initGitRepo(
      {
        host: sshForm.value.host,
        port: sshForm.value.port,
        username: sshForm.value.username,
        password: sshForm.value.password
      },
      remotePath,
      sshDetectedOS.value,
      repoFullName.value  // 用于设置 remote origin
    )
    return result
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// 检查远程 Git 仓库的 remote 配置
const checkRemoteGitConfig = async (remotePath: string): Promise<{ success: boolean; hasRemote: boolean; remoteUrl?: string; error?: string }> => {
  try {
    const result = await window.electronAPI.ssh.checkGitRemote(
      {
        host: sshForm.value.host,
        port: sshForm.value.port,
        username: sshForm.value.username,
        password: sshForm.value.password
      },
      remotePath,
      sshDetectedOS.value
    )
    return { ...result, hasRemote: result.hasRemote ?? false }
  } catch (e: any) {
    return { success: false, hasRemote: false, error: e.message }
  }
}

// 配置远程 Git 仓库的 origin
const configRemoteGitOrigin = async (remotePath: string, remoteUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await window.electronAPI.ssh.setGitRemote(
      {
        host: sshForm.value.host,
        port: sshForm.value.port,
        username: sshForm.value.username,
        password: sshForm.value.password
      },
      remotePath,
      remoteUrl,
      sshDetectedOS.value
    )
    return result
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// 确认 SSH 关联
const confirmSSHConnect = async () => {
  if (!sshSelectedFolder.value) {
    ElMessage.warning('请选择一个文件夹')
    return
  }
  
  sshConnecting.value = true
  
  try {
    const expectedRemoteUrl = `http://61.151.241.233:3030/${repoFullName.value}.git`
    
    // 检查是否是 Git 仓库
    const selectedFolderInfo = sshFolders.value.find(f => f.path === sshSelectedFolder.value)
    if (!selectedFolderInfo?.isGit) {
      // 不是 Git 仓库，询问是否初始化
      const action = await ElMessageBox.confirm(
        '所选文件夹不是 Git 仓库。\n\n是否自动初始化 Git 仓库并配置远程地址？',
        '初始化 Git 仓库',
        { 
          type: 'warning', 
          confirmButtonText: '自动初始化', 
          cancelButtonText: '取消',
          distinguishCancelAndClose: true
        }
      ).catch(() => false)
      
      if (!action) {
        sshConnecting.value = false
        return
      }
      
      // 自动初始化 Git 仓库
      ElMessage.info('正在初始化 Git 仓库...')
      const initResult = await initRemoteGitRepo(sshSelectedFolder.value)
      if (!initResult.success) {
        ElMessage.error('初始化 Git 仓库失败：' + initResult.error)
        sshConnecting.value = false
        return
      }
      
      // 先保存 SSH 配置，然后询问忽略规则
      const configId = `ssh_${repoFullName.value}_${Date.now()}`
      const config = {
        id: configId,
        name: `${sshForm.value.host}:${sshSelectedFolder.value}`,
        host: sshForm.value.host,
        port: sshForm.value.port,
        username: sshForm.value.username,
        password: sshForm.value.password,
        remotePath: sshSelectedFolder.value,
        osType: sshDetectedOS.value
      }
      
      await window.electronAPI.ssh.connect(config)
      remoteSSHConfig.value = config
      await window.electronAPI.ssh.saveRepoConfig(repoFullName.value, config)
      
      showSSHDialog.value = false
      sshConnecting.value = false
      
      // 询问是否配置忽略规则
      await askIgnoreConfigSSH(sshSelectedFolder.value)
      return
    } else {
      // 是 Git 仓库，检查 remote origin 配置
      ElMessage.info('正在检查 Git 仓库配置...')
      const checkResult = await checkRemoteGitConfig(sshSelectedFolder.value)
      
      if (!checkResult.success) {
        ElMessage.error('检查 Git 配置失败：' + checkResult.error)
        sshConnecting.value = false
        return
      }
      
      if (!checkResult.hasRemote) {
        // 没有配置 remote，自动添加
        const addResult = await configRemoteGitOrigin(sshSelectedFolder.value, expectedRemoteUrl)
        if (!addResult.success) {
          ElMessage.error('配置远程地址失败：' + addResult.error)
          sshConnecting.value = false
          return
        }
        ElMessage.success('已自动配置远程仓库地址')
      } else if (checkResult.remoteUrl !== expectedRemoteUrl) {
        // remote URL 不匹配，询问是否修改
        const confirmChange = await ElMessageBox.confirm(
          `检测到该 Git 仓库已关联其他远程地址：\n\n当前：${checkResult.remoteUrl}\n\n是否修改为当前仓库地址？\n${expectedRemoteUrl}`,
          '远程地址不匹配',
          { 
            type: 'warning', 
            confirmButtonText: '修改地址', 
            cancelButtonText: '取消'
          }
        ).catch(() => false)
        
        if (!confirmChange) {
          sshConnecting.value = false
          return
        }
        
        const updateResult = await configRemoteGitOrigin(sshSelectedFolder.value, expectedRemoteUrl)
        if (!updateResult.success) {
          ElMessage.error('修改远程地址失败：' + updateResult.error)
          sshConnecting.value = false
          return
        }
        ElMessage.success('远程仓库地址已更新')
      } else {
        ElMessage.success('Git 仓库配置正确')
      }
    }
    
    // 生成正式的配置 ID
    const configId = `ssh_${repoFullName.value}_${Date.now()}`
    
    const config = {
      id: configId,
      name: `${sshForm.value.host}:${sshSelectedFolder.value}`,
      host: sshForm.value.host,
      port: sshForm.value.port,
      username: sshForm.value.username,
      password: sshForm.value.password,
      remotePath: sshSelectedFolder.value,
      osType: sshDetectedOS.value
    }
    
    // 连接
    const connectResult = await window.electronAPI.ssh.connect(config)
    if (!connectResult.success) {
      ElMessage.error(`连接失败：${connectResult.error}`)
      return
    }
    
    // 保存远程连接信息到内存
    remoteSSHConfig.value = config
    
    // 持久化保存到存储
    await window.electronAPI.ssh.saveRepoConfig(repoFullName.value, config)
    
    showSSHDialog.value = false
    sshConnecting.value = false
    
    // 检测并询问 .gitignore 配置
    await askIgnoreConfigSSH(sshSelectedFolder.value)
  } catch (e: any) {
    ElMessage.error(`关联失败：${e.message}`)
  } finally {
    sshConnecting.value = false
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

// 解析 diff 为带行号的行数组（GitHub Desktop 风格）
interface DiffLine {
  type: 'add' | 'del' | 'context' | 'info' | 'header'
  sign: string
  content: string
  oldNum: number | null
  newNum: number | null
}

const parseDiffLines = (diff: string): DiffLine[] => {
  const lines = diff.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  
  for (const line of lines) {
    // 解析 @@ -x,y +a,b @@ 行号信息
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]) - 1
      newLine = parseInt(hunkMatch[2]) - 1
      result.push({
        type: 'info',
        sign: '@@',
        content: line.replace(/^@@ .* @@/, '').trim(),
        oldNum: null,
        newNum: null
      })
      continue
    }
    
    // 文件头信息
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      result.push({
        type: 'header',
        sign: '',
        content: line,
        oldNum: null,
        newNum: null
      })
      continue
    }
    
    // 新增行
    if (line.startsWith('+')) {
      newLine++
      result.push({
        type: 'add',
        sign: '+',
        content: line.substring(1),
        oldNum: null,
        newNum: newLine
      })
      continue
    }
    
    // 删除行
    if (line.startsWith('-')) {
      oldLine++
      result.push({
        type: 'del',
        sign: '-',
        content: line.substring(1),
        oldNum: oldLine,
        newNum: null
      })
      continue
    }
    
    // 上下文（未变更）
    if (line.startsWith(' ') || line === '') {
      oldLine++
      newLine++
      result.push({
        type: 'context',
        sign: '',
        content: line.startsWith(' ') ? line.substring(1) : line,
        oldNum: oldLine,
        newNum: newLine
      })
    }
  }
  
  return result
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
    if (localTagsResult.success && localTagsResult.data && localTagsResult.data.length > 0) {
      const newTagLower = tagName.value.toLowerCase()
      const existingTag = localTagsResult.data!.find(
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
  display: flex;
  flex-direction: column;
  gap: 32px;

  .section-group {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    padding: 20px;
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
      
      .section-icon {
        font-size: 24px;
      }
      
      h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }
      
      .section-desc {
        margin-left: auto;
        font-size: 13px;
        color: #909399;
      }
    }
    
    .section-cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    &.sync-section {
      background: linear-gradient(135deg, #f6ffed 0%, #fff 50%);
      border-color: #d9f7be;
    }
  }

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
  
  .gitignore-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 10px 14px;
    background: #f8f9fa;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: #f0f2f5;
    }
    
    .status-text {
      flex: 1;
      font-size: 13px;
      color: #606266;
      
      &.success {
        color: #67c23a;
      }
    }
  }

  .unlinked-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: #909399;
  }
  
  .link-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .link-option-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      border-color: #409eff;
      background: #f0f7ff;
      
      .option-arrow {
        transform: translateX(4px);
      }
    }
    
    &.disabled {
      cursor: not-allowed;
      opacity: 0.6;
      
      &:hover {
        border-color: #e4e7ed;
        background: #f5f7fa;
      }
    }
    
    .option-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      
      &.local {
        background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
        color: white;
      }
      
      &.remote {
        background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
        color: white;
      }
    }
    
    .option-content {
      flex: 1;
      
      h5 {
        margin: 0 0 4px 0;
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }
      
      p {
        margin: 0;
        font-size: 13px;
        color: #909399;
      }
    }
    
    .option-arrow {
      color: #c0c4cc;
      transition: transform 0.2s ease;
    }
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
    overflow: hidden;
    
    .diff-header {
      padding: 12px 16px;
      border-bottom: 1px solid #ebeef5;
      font-weight: 600;
      background: #fafafa;
    }
    
    .diff-content-wrapper {
      background: #fff;
    }
    
    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      
      .diff-line {
        &.add {
          background: #e6ffec;
          .line-num { background: #ccffd8; color: #22863a; }
          .line-sign { color: #22863a; }
          .line-content { color: #22863a; }
        }
        
        &.del {
          background: #ffebe9;
          .line-num { background: #ffd7d5; color: #cb2431; }
          .line-sign { color: #cb2431; }
          .line-content { color: #cb2431; }
        }
        
        &.context {
          background: #fff;
          .line-num { background: #f6f8fa; color: #6e7781; }
        }
        
        &.info {
          background: #ddf4ff;
          .line-num { background: #ddf4ff; }
          .line-sign { color: #0969da; font-weight: 600; }
          .line-content { color: #0969da; font-weight: 600; }
        }
        
        &.header {
          background: #f6f8fa;
          .line-content { color: #6e7781; font-style: italic; }
        }
      }
      
      td {
        padding: 0 8px;
        vertical-align: top;
        white-space: pre;
        border: none;
      }
      
      .line-num {
        width: 40px;
        min-width: 40px;
        text-align: right;
        color: #6e7781;
        user-select: none;
        border-right: 1px solid #eaeef2;
        
        &.old { border-right: 1px solid #eaeef2; }
        &.new { border-right: 1px solid #eaeef2; }
      }
      
      .line-sign {
        width: 20px;
        min-width: 20px;
        text-align: center;
        user-select: none;
        font-weight: 600;
      }
      
      .line-content {
        width: 100%;
        word-break: break-all;
        white-space: pre-wrap;
      }
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

<!-- SSH 对话框样式（非 scoped，因为 el-dialog 渲染到 body） -->
<style lang="scss">
.ssh-test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 14px;
  
  &.success {
    background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
    color: #52c41a;
    border: 1px solid #b3e19d;
  }
  
  &.error {
    background: linear-gradient(135deg, #fff2f0 0%, #ffebe8 100%);
    color: #ff4d4f;
    border: 1px solid #ffccc7;
  }
}

.ssh-folder-browser {
  .browser-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    margin-bottom: 14px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    
    .el-button {
      background: rgba(255, 255, 255, 0.2) !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      color: #fff !important;
      
      &:hover {
        background: rgba(255, 255, 255, 0.35) !important;
      }
    }
    
    .current-path {
      flex: 1;
      font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #fff;
      background: rgba(255, 255, 255, 0.15);
      padding: 10px 16px;
      border-radius: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  
  .browser-tip {
    font-size: 13px;
    color: #909399;
    margin-bottom: 14px;
    padding: 0 4px;
  }
  
  .folder-list {
    max-height: 360px;
    overflow-y: auto;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    background: #f8f9fa;
    padding: 8px;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #c0c4cc;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .folder-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fff;
      margin-bottom: 6px;
      border-radius: 10px;
      border: 2px solid transparent;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      
      &:last-child {
        margin-bottom: 0;
      }
      
      &:hover {
        background: linear-gradient(135deg, #f0f5ff 0%, #e8f4fd 100%);
        transform: translateX(4px);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
      }
      
      &.parent-folder {
        background: #fafafa;
        border: 2px dashed #e0e0e0;
        
        .el-icon {
          color: #faad14 !important;
          font-size: 22px;
        }
        
        span {
          color: #8c8c8c;
          font-style: italic;
        }
        
        &:hover {
          background: #fff7e6;
          border-color: #faad14;
        }
      }
      
      &.selected {
        background: linear-gradient(135deg, #e6f7ff 0%, #d6ecff 100%);
        border-color: #1890ff;
        box-shadow: 0 3px 12px rgba(24, 144, 255, 0.2);
        
        .el-icon {
          color: #1890ff !important;
        }
      }
      
      &.is-git {
        background: linear-gradient(135deg, #f6ffed 0%, #e8f8e0 100%);
        border-color: #b7eb8f;
        
        .el-icon {
          color: #52c41a !important;
        }
        
        &:hover {
          background: linear-gradient(135deg, #e8f8e0 0%, #d9f7be 100%);
          box-shadow: 0 3px 12px rgba(82, 196, 26, 0.15);
        }
        
        &.selected {
          border-color: #52c41a;
          box-shadow: 0 3px 12px rgba(82, 196, 26, 0.25);
        }
      }
      
      .el-icon {
        font-size: 26px;
        color: #bfbfbf;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      
      span {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: #262626;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .el-tag {
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }
    }
    
    .empty-hint {
      padding: 50px 20px;
      text-align: center;
      color: #8c8c8c;
      font-size: 14px;
      
      &::before {
        content: '📂';
        display: block;
        font-size: 36px;
        margin-bottom: 10px;
        opacity: 0.6;
      }
    }
  }
  
  .selected-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 14px 18px;
    background: linear-gradient(135deg, #f6ffed 0%, #e8f8e0 100%);
    border: 1px solid #b7eb8f;
    border-radius: 10px;
    color: #389e0d;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(82, 196, 26, 0.12);
    
    .el-icon {
      font-size: 20px;
      color: #52c41a;
    }
    
    span {
      font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
      font-weight: 500;
      word-break: break-all;
    }
  }
}

/* 忽略规则配置对话框 */
.ignore-config {
  .file-type-list {
    max-height: 400px;
    overflow-y: auto;
    
    .file-type-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        background: #f5f7fa;
        border-color: #d0d0d0;
      }
      
      &.is-selected {
        background: linear-gradient(135deg, #ecf5ff 0%, #e8f4fd 100%);
        border-color: #409eff;
        
        .type-name {
          color: #409eff;
        }
      }
      
      .type-icon {
        font-size: 24px;
      }
      
      .type-info {
        flex: 1;
        
        .type-name {
          display: block;
          font-size: 15px;
          font-weight: 500;
          color: #303133;
          margin-bottom: 2px;
        }
        
        .type-desc {
          display: block;
          font-size: 12px;
          color: #909399;
          font-family: 'Consolas', 'Monaco', monospace;
        }
      }
    }
  }
}
</style>

