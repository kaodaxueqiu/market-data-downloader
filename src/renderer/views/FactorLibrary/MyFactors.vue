<template>
  <div class="my-factors-page">
    <div class="page-header">
      <h2>📂 我的因子</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadMyRepos">刷新</el-button>
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
    <div v-else-if="repos.length > 0" class="repos-container">
      <div v-for="repo in repos" :key="repo.name" class="repo-section">
        <!-- 仓库卡片头部 -->
        <div class="repo-header" @click="toggleRepo(repo.name)">
          <div class="repo-info">
            <el-icon class="expand-icon" :class="{ expanded: expandedRepos.includes(repo.name) }">
              <ArrowRight />
            </el-icon>
            <span class="repo-icon">📁</span>
            <h3 class="repo-name">{{ repo.name }}</h3>
            <el-tag size="small" type="info">{{ repo.factor_count || 0 }} 个因子</el-tag>
            <!-- 优先显示 Tag，否则显示分支+commit -->
            <el-tag v-if="repo.latest_tag" size="small" type="danger">
              🏷️ {{ repo.latest_tag }}
            </el-tag>
            <el-tag v-else-if="repo.default_branch" size="small" type="success">
              <el-icon><Share /></el-icon>
              {{ repo.default_branch }} @ {{ repo.latest_commit || '' }}
            </el-tag>
          </div>
          <div class="repo-meta">
            <span class="meta-item">
              <el-icon><User /></el-icon>
              {{ repo.collaborator || getOwner(repo.full_name) }}
            </span>
            <span class="meta-item" v-if="repo.latest_commit_time">
              <el-icon><Clock /></el-icon>
              {{ formatTime(repo.latest_commit_time) }}
            </span>
            <span class="meta-item" v-else>
              <el-icon><Clock /></el-icon>
              {{ formatTime(repo.updated_at) }}
            </span>
          </div>
        </div>

        <!-- 因子面板（展开时显示） -->
        <div v-show="expandedRepos.includes(repo.name)" class="factors-panel">
          <div v-if="loadingFactors[repo.name]" class="loading-factors">
            <el-skeleton :rows="3" animated />
          </div>
          
          <div v-else-if="repoFactors[repo.name]" class="factors-content">
            <!-- 左侧：分类树 -->
            <div class="category-panel">
              <div class="panel-title">
                <span>因子分类</span>
                <el-input
                  v-model="searchKeyword[repo.name]"
                  placeholder="搜索..."
                  size="small"
                  clearable
                  :prefix-icon="Search"
                  style="width: 120px"
                />
              </div>
              <div class="category-tree">
                <el-tree
                  :data="getCategoryTree(repo.name)"
                  :props="{ children: 'children', label: 'name' }"
                  :expand-on-click-node="false"
                  node-key="path"
                  highlight-current
                  default-expand-all
                  @node-click="(data: any) => handleCategoryClick(repo.name, data)"
                >
                  <template #default="{ data }">
                    <div class="tree-node">
                      <span class="node-label">{{ data.name }}</span>
                      <span class="node-count">({{ data.count }})</span>
                    </div>
                  </template>
                </el-tree>
              </div>
            </div>

            <!-- 右侧：因子列表 -->
            <div class="factor-list-panel">
              <div class="panel-title">
                <span>{{ getSelectedCategoryName(repo.name) }}</span>
                <span class="factor-count">{{ getFilteredFactors(repo.name).length }} 个因子</span>
              </div>
              <div class="factor-table-wrapper">
                <el-table
                  :data="getPaginatedFactors(repo.name)"
                  style="width: 100%; flex: 1;"
                  size="small"
                  stripe
                  height="100%"
                  highlight-current-row
                  @row-click="(row: Factor) => viewFactorDetail(repo, row)"
                  class="clickable-table"
                >
                  <el-table-column prop="code" label="因子代码" width="120">
                    <template #default="scope">
                      <el-text style="font-family: monospace; font-weight: 600; color: #409EFF;">
                        {{ scope.row.code }}
                      </el-text>
                    </template>
                  </el-table-column>
                  <el-table-column prop="name" label="因子名称" width="120" />
                  <el-table-column prop="l3" label="分类" width="90">
                    <template #default="scope">
                      <el-tag size="small" type="info">{{ scope.row.l3 }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
                  <el-table-column prop="version" label="版本" width="70">
                    <template #default="scope">
                      <el-tag size="small" type="success">{{ scope.row.version || '-' }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="updated_at" label="更新时间" width="100">
                    <template #default="scope">
                      <el-text type="info" size="small">{{ scope.row.updated_at || '-' }}</el-text>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="80" fixed="right">
                    <template #default="scope">
                      <el-button size="small" type="primary" link @click.stop="goToSubmit(repo, scope.row)">
                        <el-icon><VideoPlay /></el-icon>
                        执行
                      </el-button>
                    </template>
                  </el-table-column>
                  
                  <!-- 空状态 -->
                  <template #empty>
                    <el-empty description="该仓库暂无因子，请先在 Git 仓库中添加因子" :image-size="100" />
                  </template>
                </el-table>

                <!-- 分页 -->
                <div class="pagination-wrapper" v-if="getFilteredFactors(repo.name).length > pageSize">
                  <el-pagination
                    v-model:current-page="currentPage[repo.name]"
                    :page-size="pageSize"
                    :total="getFilteredFactors(repo.name).length"
                    layout="prev, pager, next"
                    small
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-factors">
            <el-empty description="加载失败" :image-size="60" />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-empty description="暂无仓库" :image-size="200">
        <template #default>
          <p class="empty-tip">您还没有可用的因子仓库</p>
        </template>
      </el-empty>
    </div>

    <!-- 代码查看弹窗 -->
    <el-dialog
      v-model="codeDialogVisible"
      :title="`📄 ${selectedFactor?.code || ''} - ${selectedFactor?.name || ''}`"
      width="80%"
      top="5vh"
      destroy-on-close
      append-to-body
      :z-index="3000"
    >
      <div class="code-dialog-content" v-loading="loadingCode">
        <div v-if="factorCode" class="code-wrapper">
          <div class="code-toolbar">
            <el-tag type="info">{{ selectedFactor?.file }}</el-tag>
            <el-button size="small" @click="copyCode">
              <el-icon><CopyDocument /></el-icon>
              复制代码
            </el-button>
          </div>
          <pre class="code-block"><code>{{ factorCode }}</code></pre>
        </div>
        <el-empty v-else-if="!loadingCode" description="加载失败或文件为空" />
      </div>
    </el-dialog>

    <!-- 因子详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="因子详情"
      direction="rtl"
      size="480px"
    >
      <div v-if="selectedFactor" class="factor-detail">
        <!-- 头部：因子代码和名称 -->
        <div class="detail-header">
          <div class="factor-code">{{ selectedFactor.code }}</div>
          <div class="factor-name">{{ selectedFactor.name }}</div>
        </div>

        <!-- 基本信息 -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span>📋 基本信息</span>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="因子代码">
              <el-text copyable style="font-family: monospace; font-weight: 600;">
                {{ selectedFactor.code }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="因子名称">
              {{ selectedFactor.name }}
            </el-descriptions-item>
            <el-descriptions-item label="描述">
              {{ selectedFactor.description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 分类信息 -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span>📂 分类信息</span>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="一级分类">
              <el-tag>{{ selectedFactor.l1 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="二级分类">
              <el-tag type="success">{{ selectedFactor.l2 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="三级分类">
              <el-tag type="warning">{{ selectedFactor.l3 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="完整路径">
              <el-text type="info" size="small">
                {{ selectedFactor.l1 }} > {{ selectedFactor.l2 }} > {{ selectedFactor.l3 }}
              </el-text>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 代码信息 -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span>💻 代码信息</span>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="文件路径">
              <el-text style="font-family: monospace; font-size: 12px; word-break: break-all;">
                {{ selectedFactor.file }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="入口函数">
              <el-text style="font-family: monospace;">
                {{ selectedFactor.function }}()
              </el-text>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 版本信息 -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span>📦 版本信息</span>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="因子版本">
              <el-tag type="success" size="small">{{ selectedFactor.version || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="作者">
              {{ selectedFactor.author || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ selectedFactor.created_at || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ selectedFactor.updated_at || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Git 版本信息 -->
        <el-card v-if="selectedRepoInfo" shadow="never" class="detail-card">
          <template #header>
            <span>🔀 Git 版本</span>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item v-if="selectedRepoInfo.latest_tag" label="发布版本">
              <el-tag type="danger" size="small">
                🏷️ {{ selectedRepoInfo.latest_tag }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="分支">
              <el-tag type="success" size="small">
                <el-icon style="margin-right: 4px;"><Share /></el-icon>
                {{ selectedRepoInfo.default_branch || 'main' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最新提交">
              <el-tag type="warning" size="small" style="font-family: monospace;">
                {{ selectedRepoInfo.latest_commit || '-' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">
              {{ formatTime(selectedRepoInfo.latest_commit_time) || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="提交信息" :span="2">
              <el-text type="info" size="small">
                {{ selectedRepoInfo.latest_commit_msg || '-' }}
              </el-text>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 标签 -->
        <el-card v-if="selectedFactor.tags && selectedFactor.tags.length > 0" shadow="never" class="detail-card">
          <template #header>
            <span>🏷️ 标签</span>
          </template>
          <div class="tags-container">
            <el-tag
              v-for="tag in selectedFactor.tags"
              :key="tag"
              size="small"
              style="margin-right: 8px; margin-bottom: 8px;"
            >
              {{ tag }}
            </el-tag>
          </div>
        </el-card>

        <!-- 源代码按钮 -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span>📄 源代码</span>
          </template>
          <div class="code-action">
            <el-button type="primary" @click="openCodeDialog">
              <el-icon><Document /></el-icon>
              查看源代码
            </el-button>
          </div>
        </el-card>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <el-button type="primary" size="large" @click="goToSubmitFromDetail">
            <el-icon><VideoPlay /></el-icon>
            提交执行
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Clock, User, ArrowRight, VideoPlay, Search, Document, CopyDocument, Share } from '@element-plus/icons-vue'

interface Repo {
  id: number
  name: string
  full_name: string
  description?: string
  factor_count?: number
  updated_at?: string
  clone_url?: string
  html_url?: string
  collaborator?: string
  // Git 版本信息
  default_branch?: string
  latest_tag?: string
  latest_commit?: string
  latest_commit_time?: string
  latest_commit_msg?: string
}

interface FactorCategory {
  l1: string
  l2: string
  l3: string
}

interface Factor {
  code: string
  name: string
  file: string
  function: string
  description?: string
  category?: FactorCategory  // 三级分类对象
  version?: string
  author?: string
  created_at?: string
  updated_at?: string
  tags?: string[]
  params?: Record<string, any>
  // 扁平化的分类（方便筛选）
  l1?: string
  l2?: string
  l3?: string
}

interface CategoryNode {
  name: string
  path: string
  count: number
  children?: CategoryNode[]
}

const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)
const repos = ref<Repo[]>([])
const expandedRepos = ref<string[]>([])
const repoFactors = ref<Record<string, Factor[]>>({})
const loadingFactors = ref<Record<string, boolean>>({})

// 搜索和筛选
const searchKeyword = reactive<Record<string, string>>({})
const selectedCategory = reactive<Record<string, string>>({})  // 存储选中的分类路径
const currentPage = reactive<Record<string, number>>({})
const pageSize = 20

// 因子详情
const detailDrawerVisible = ref(false)
const selectedFactor = ref<Factor | null>(null)
const selectedRepo = ref<Repo | null>(null)

// 计算当前选中因子所在的仓库信息（包含 Git 版本）
const selectedRepoInfo = computed(() => {
  if (!selectedRepo.value) return null
  // 从 repos 列表中找到匹配的仓库，获取完整信息
  return repos.value.find(r => r.name === selectedRepo.value?.name) || selectedRepo.value
})

// 代码弹窗
const codeDialogVisible = ref(false)
const factorCode = ref<string>('')
const loadingCode = ref(false)

// 从 full_name 获取 owner
const getOwner = (fullName: string): string => {
  return fullName?.split('/')[0] || ''
}

// 从因子对象提取三级分类（优先使用 category 对象，兼容从文件路径解析）
const parseCategory = (factor: any): { l1: string; l2: string; l3: string } => {
  // 优先使用 category 对象
  if (factor.category && typeof factor.category === 'object') {
    return {
      l1: factor.category.l1 || '其他',
      l2: factor.category.l2 || '其他',
      l3: factor.category.l3 || '其他'
    }
  }
  
  // 兼容：从文件路径解析
  // 路径格式: factors/技术指标因子/形态类/K线形态/close0.py
  const filePath = factor.file || ''
  const parts = filePath.split('/')
  if (parts.length >= 4 && parts[0] === 'factors') {
    return {
      l1: parts[1] || '其他',
      l2: parts[2] || '其他',
      l3: parts[3] || '其他'
    }
  }
  return { l1: '其他', l2: '其他', l3: '其他' }
}

// 构建分类树
const getCategoryTree = (repoName: string): CategoryNode[] => {
  const factors = repoFactors.value[repoName] || []
  const keyword = searchKeyword[repoName]?.toLowerCase()
  
  // 先按搜索词过滤
  let filteredFactors = factors
  if (keyword) {
    filteredFactors = factors.filter(f => 
      f.code.toLowerCase().includes(keyword) || 
      f.name.toLowerCase().includes(keyword)
    )
  }
  
  // 构建三级分类树
  const tree: Record<string, Record<string, Record<string, Factor[]>>> = {}
  
  filteredFactors.forEach(factor => {
    const { l1, l2, l3 } = factor
    if (!l1 || !l2 || !l3) return
    
    if (!tree[l1]) tree[l1] = {}
    if (!tree[l1][l2]) tree[l1][l2] = {}
    if (!tree[l1][l2][l3]) tree[l1][l2][l3] = []
    tree[l1][l2][l3].push(factor)
  })
  
  // 转换为树形结构
  const result: CategoryNode[] = [
    {
      name: '全部因子',
      path: 'all',
      count: filteredFactors.length
    }
  ]
  
  Object.entries(tree).forEach(([l1Name, l2Map]) => {
    const l1Children: CategoryNode[] = []
    let l1Count = 0
    
    Object.entries(l2Map).forEach(([l2Name, l3Map]) => {
      const l2Children: CategoryNode[] = []
      let l2Count = 0
      
      Object.entries(l3Map).forEach(([l3Name, factorList]) => {
        l2Children.push({
          name: l3Name,
          path: `${l1Name}/${l2Name}/${l3Name}`,
          count: factorList.length
        })
        l2Count += factorList.length
      })
      
      l1Children.push({
        name: l2Name,
        path: `${l1Name}/${l2Name}`,
        count: l2Count,
        children: l2Children.length > 0 ? l2Children : undefined
      })
      l1Count += l2Count
    })
    
    result.push({
      name: l1Name,
      path: l1Name,
      count: l1Count,
      children: l1Children.length > 0 ? l1Children : undefined
    })
  })
  
  return result
}

// 获取选中分类的名称
const getSelectedCategoryName = (repoName: string): string => {
  const path = selectedCategory[repoName]
  if (!path || path === 'all') return '全部因子'
  const parts = path.split('/')
  return parts[parts.length - 1]
}

// 分类点击处理
const handleCategoryClick = (repoName: string, data: CategoryNode) => {
  selectedCategory[repoName] = data.path
  currentPage[repoName] = 1
}

// 获取筛选后的因子
const getFilteredFactors = (repoName: string): Factor[] => {
  let factors = repoFactors.value[repoName] || []
  
  // 按搜索词过滤
  const keyword = searchKeyword[repoName]?.toLowerCase()
  if (keyword) {
    factors = factors.filter(f => 
      f.code.toLowerCase().includes(keyword) || 
      f.name.toLowerCase().includes(keyword)
    )
  }
  
  // 按分类过滤
  const categoryPath = selectedCategory[repoName]
  if (categoryPath && categoryPath !== 'all') {
    const parts = categoryPath.split('/')
    factors = factors.filter(f => {
      if (parts.length === 1) return f.l1 === parts[0]
      if (parts.length === 2) return f.l1 === parts[0] && f.l2 === parts[1]
      if (parts.length === 3) return f.l1 === parts[0] && f.l2 === parts[1] && f.l3 === parts[2]
      return true
    })
  }
  
  return factors
}

// 获取分页后的因子
const getPaginatedFactors = (repoName: string): Factor[] => {
  const filtered = getFilteredFactors(repoName)
  const page = currentPage[repoName] || 1
  const start = (page - 1) * pageSize
  return filtered.slice(start, start + pageSize)
}

// 加载我的仓库列表
const loadMyRepos = async () => {
  loading.value = true
  error.value = null
  
  try {
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (!defaultKey) {
      error.value = '请先在系统设置中配置API Key'
      return
    }
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      error.value = '获取API Key失败'
      return
    }
    await window.electronAPI.factor.setApiKey(fullApiKey)
    
    const result = await window.electronAPI.factor.getMyRepos()
    if (result.code === 200) {
      repos.value = result.data?.repos || []
    }
  } catch (err: any) {
    console.error('加载仓库列表失败:', err)
    error.value = err.message || '加载仓库列表失败'
  } finally {
    loading.value = false
  }
}

// 展开/收起仓库
const toggleRepo = async (repoName: string) => {
  const index = expandedRepos.value.indexOf(repoName)
  if (index > -1) {
    expandedRepos.value.splice(index, 1)
  } else {
    expandedRepos.value.push(repoName)
    // 初始化
    if (!currentPage[repoName]) {
      currentPage[repoName] = 1
    }
    if (!selectedCategory[repoName]) {
      selectedCategory[repoName] = 'all'
    }
    if (!repoFactors.value[repoName]) {
      await loadRepoFactors(repoName)
    }
  }
}

// 加载仓库的因子列表
const loadRepoFactors = async (repoName: string) => {
  const repo = repos.value.find(r => r.name === repoName)
  if (!repo) return
  
  loadingFactors.value[repoName] = true
  
  try {
    const owner = getOwner(repo.full_name)
    const result = await window.electronAPI.factor.getRepoFactors(owner, repoName)
    if (result.code === 200) {
      const rawFactors = result.data?.factors || []
      // 解析三级分类（优先使用 category 对象）
      const factors = rawFactors.map((f: any) => {
        const parsed = parseCategory(f)
        return { ...f, ...parsed }
      })
      repoFactors.value[repoName] = factors
    }
  } catch (err: any) {
    console.error(`加载仓库 ${repoName} 的因子列表失败:`, err)
    ElMessage.error(`加载因子列表失败: ${err.message}`)
    repoFactors.value[repoName] = []
  } finally {
    loadingFactors.value[repoName] = false
  }
}

// 查看因子详情
const viewFactorDetail = (repo: Repo, factor: Factor) => {
  selectedRepo.value = repo
  selectedFactor.value = factor
  factorCode.value = ''  // 清空之前的代码
  detailDrawerVisible.value = true
}

// 打开代码弹窗
const openCodeDialog = async () => {
  console.log('=== openCodeDialog 被调用 ===')
  console.log('selectedRepo:', selectedRepo.value)
  console.log('selectedFactor:', selectedFactor.value)
  
  if (!selectedRepo.value || !selectedFactor.value) {
    console.log('selectedRepo 或 selectedFactor 为空，返回')
    ElMessage.warning('请先选择因子')
    return
  }
  
  console.log('准备打开弹窗')
  codeDialogVisible.value = true
  loadingCode.value = true
  factorCode.value = ''
  
  try {
    const owner = getOwner(selectedRepo.value.full_name)
    console.log('加载代码:', owner, selectedRepo.value.name, selectedFactor.value.file)
    
    const result = await window.electronAPI.factor.getFileContent(
      owner,
      selectedRepo.value.name,
      selectedFactor.value.file
    )
    
    console.log('加载结果:', result)
    
    if (result.code === 200 && result.data) {
      factorCode.value = result.data.content
    }
  } catch (err: any) {
    console.error('加载代码失败:', err)
    ElMessage.error('加载代码失败: ' + err.message)
  } finally {
    loadingCode.value = false
  }
}

// 复制代码
const copyCode = () => {
  if (factorCode.value) {
    navigator.clipboard.writeText(factorCode.value)
    ElMessage.success('代码已复制到剪贴板')
  }
}

// 跳转到因子提交页面
const goToSubmit = (repo: Repo, factor: Factor) => {
  router.push({
    path: '/factor-library/submit',
    query: {
      owner: getOwner(repo.full_name),
      repo: repo.name,
      factor_code: factor.code,
      factor_file: factor.file,
      factor_func: factor.function
    }
  })
}

// 从详情页跳转到提交页面
const goToSubmitFromDetail = () => {
  if (selectedRepo.value && selectedFactor.value) {
    detailDrawerVisible.value = false
    goToSubmit(selectedRepo.value, selectedFactor.value)
  }
}

// 格式化时间
const formatTime = (timeStr?: string): string => {
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

onMounted(() => {
  loadMyRepos()
})
</script>

<style scoped lang="scss">
.my-factors-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

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

  .repos-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .repo-section {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;

    .repo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      cursor: pointer;
      transition: background 0.3s;

      &:hover {
        background: #f5f7fa;
      }

      .repo-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .expand-icon {
          transition: transform 0.3s;
          color: #909399;

          &.expanded {
            transform: rotate(90deg);
          }
        }

        .repo-icon {
          font-size: 24px;
        }

        .repo-name {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #303133;
        }
      }

      .repo-meta {
        display: flex;
        gap: 20px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #909399;
        }
      }
    }

    .factors-panel {
      border-top: 1px solid #ebeef5;

      .loading-factors {
        padding: 20px;
      }

      .factors-content {
        display: flex;
        height: calc(100vh - 280px);
        min-height: 500px;

        .category-panel {
          width: 260px;
          min-width: 260px;
          border-right: 1px solid #ebeef5;
          display: flex;
          flex-direction: column;
          background: #fafbfc;

          .panel-title {
            padding: 12px 15px;
            background: #f0f2f5;
            border-bottom: 1px solid #ebeef5;
            font-weight: 500;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .category-tree {
            flex: 1;
            overflow-y: auto;
            padding: 12px;

            .tree-node {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 13px;

              .node-label {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .node-count {
                color: #909399;
                font-size: 12px;
              }
            }
          }
        }

        .factor-list-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;

          .panel-title {
            padding: 12px 20px;
            background: #f0f2f5;
            border-bottom: 1px solid #ebeef5;
            font-weight: 500;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .factor-count {
              font-weight: normal;
              color: #909399;
              font-size: 12px;
            }
          }

          .factor-table-wrapper {
            flex: 1;
            overflow: hidden;
            padding: 15px;
            display: flex;
            flex-direction: column;

            .clickable-table {
              :deep(.el-table__row) {
                cursor: pointer;
                
                &:hover {
                  background-color: #ecf5ff !important;
                }
              }
            }

            .pagination-wrapper {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px solid #ebeef5;
              display: flex;
              justify-content: center;
            }
          }
        }
      }

      .empty-factors {
        padding: 40px 0;
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

    .empty-tip {
      color: #909399;
      margin-bottom: 20px;
    }
  }

  // 因子详情抽屉样式
  .factor-detail {
    padding: 0 10px;

    .detail-header {
      text-align: center;
      padding: 20px 0;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;

      .factor-code {
        font-family: monospace;
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 8px;
      }

      .factor-name {
        font-size: 16px;
        opacity: 0.9;
      }
    }

    .detail-card {
      margin-bottom: 16px;

      :deep(.el-card__header) {
        padding: 12px 16px;
        background: #f5f7fa;
        font-weight: 500;
      }

      :deep(.el-card__body) {
        padding: 16px;
      }

      .tags-container {
        display: flex;
        flex-wrap: wrap;
      }

      .code-action {
        text-align: center;
        padding: 10px 0;
      }
    }

    .detail-actions {
      margin-top: 30px;
      padding: 20px 0;
      text-align: center;
      border-top: 1px solid #ebeef5;
    }
  }
}

// 代码弹窗样式
.code-dialog-content {
  min-height: 300px;

  .code-wrapper {
    .code-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 10px 15px;
      background: #f5f7fa;
      border-radius: 6px;
    }

    .code-block {
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      border-radius: 8px;
      max-height: 60vh;
      overflow: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.7;
      color: #d4d4d4;
      white-space: pre;

      code {
        font-family: inherit;
      }
    }
  }
}
</style>
