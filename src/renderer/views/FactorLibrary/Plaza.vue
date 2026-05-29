<template>
  <div class="plaza-page">
    <div class="main-content">
      <!-- 顶栏：搜索 -->
      <div class="tabs-header">
        <div class="nav-tabs">
          <button class="nav-tab" :class="{ active: activeTab === 'plaza' }" @click="activeTab = 'plaza'">
            <el-icon><Grid /></el-icon>
            <span>因子广场 ({{ total }})</span>
          </button>
          <button class="nav-tab" :class="{ active: activeTab === 'submissions' }" @click="switchToSubmissions">
            <el-icon><Document /></el-icon>
            <span>提交记录 ({{ submissionsTotal }})</span>
          </button>
        </div>
        <div class="header-actions">
          <el-input
            v-if="activeTab === 'plaza'"
            v-model="searchKeyword"
            placeholder="搜索因子..."
            clearable
            style="width: 200px"
            @keyup.enter="loadFactors"
            @clear="loadFactors"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button :icon="Refresh" @click="activeTab === 'plaza' ? loadFactors() : loadSubmissions()">刷新</el-button>
        </div>
      </div>

      <!-- 三栏布局 -->
      <div v-show="activeTab === 'plaza'" class="content-layout">
        <!-- 左侧：分类树 -->
        <div class="left-panel">
          <div class="panel-header">
            <span>因子分类</span>
            <div class="header-actions">
              <el-button text size="small" @click="refreshCategories" :loading="loadingCategories">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="category-tree" v-loading="loadingCategories">
            <el-tree
              ref="treeRef"
              :data="categories"
              :props="{ children: 'children', label: 'name' }"
              :expand-on-click-node="false"
              node-key="_uid"
              highlight-current
              @node-click="handleCategoryClick"
            >
              <template #default="{ data }">
                <div class="tree-node">
                  <span class="node-label">{{ data.name }}</span>
                  <span class="node-count" v-if="data.factor_count > 0">
                    ({{ data.factor_count }})
                  </span>
                </div>
              </template>
            </el-tree>
          </div>
        </div>

        <!-- 中间：因子列表 -->
        <div class="middle-panel">
          <div class="panel-header">
            <div class="header-left">
              <span>因子列表</span>
              <span class="factor-count">共 {{ total }} 个</span>
            </div>
          </div>
          <div class="factor-list" v-loading="loading">
            <div
              v-for="factor in factors"
              :key="factor.factor_id"
              class="factor-card"
              :class="{ active: selectedFactor?.factor_id === factor.factor_id }"
              @click="selectFactor(factor)"
            >
              <div class="factor-header">
                <div class="factor-code">{{ factor.factor_code }}</div>
                <el-tag v-if="isPyFileFactor(factor)" size="small" type="warning" effect="plain">
                  Py
                </el-tag>
                <el-tag v-else size="small" type="info" effect="plain">
                  表达式
                </el-tag>
                <el-tag v-if="factor.version != null" size="small" effect="plain">
                  v{{ factor.version }}
                </el-tag>
              </div>
              <div class="factor-name">{{ factor.factor_name }}</div>
              <div class="factor-id" style="font-size: 11px; color: #999; font-family: monospace;">{{ factor.factor_id }}</div>
              <div class="factor-category">
                {{ factor.category_l1_name }} / {{ factor.category_l2_name }} / {{ factor.category_l3_name }}
              </div>
              <div class="factor-metrics" v-if="factor.rank_ic_ir">
                <el-tag size="small" type="success" effect="plain">
                  Rank IC IR: {{ factor.rank_ic_ir?.toFixed(2) || '-' }}
                </el-tag>
              </div>
              <div class="factor-footer">
                <span class="factor-submitter">{{ factor.created_by || factor.submitted_by || '-' }}</span>
                <span class="factor-time">{{ formatTime(factor.submitted_at || factor.updated_at) }}</span>
              </div>
            </div>

            <el-empty
              v-if="!loading && factors.length === 0"
              description="因子广场暂无提交"
              :image-size="100"
            />
          </div>

          <div v-if="total > pageSize" class="pagination-footer">
            <el-pagination
              v-model:current-page="page"
              :page-size="pageSize"
              :total="total"
              layout="total, prev, pager, next"
              small
              @current-change="loadFactors"
            />
          </div>
        </div>

        <!-- 右侧：详情面板 -->
        <div class="right-panel">
          <div class="panel-header">
            <span>因子详情</span>
          </div>
          <div class="panel-content">
            <div v-if="!selectedFactor" class="empty-state">
              <el-empty description="请从左侧选择一个因子查看详情" :image-size="120" />
            </div>

            <div v-else class="factor-detail" v-loading="loadingDetail">
              <!-- 详情头部 -->
              <div class="detail-header">
                <h3>{{ activeDetail?.factor_name || selectedFactor.factor_name }}</h3>
                <el-tag type="success" size="large">已提交</el-tag>
              </div>

              <!-- 基本信息 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>基本信息</span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="因子代码">
                    <el-text style="font-family: monospace; font-weight: 600; color: #409eff;">
                      {{ activeDetail?.factor_code || selectedFactor.factor_code }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="因子ID">
                    <span style="font-family: monospace; font-size: 12px; color: #909399;">
                      {{ activeDetail?.factor_id || selectedFactor.factor_id }}
                    </span>
                  </el-descriptions-item>
                  <el-descriptions-item label="英文名称">
                    {{ activeDetail?.factor_name_en || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="分类">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <el-tag size="small">{{ activeDetail?.category_l1_name || detailData?.category_l1_name || selectedFactor.category_l1_name }}</el-tag>
                      <el-tag size="small" type="success">{{ activeDetail?.category_l2_name || detailData?.category_l2_name || selectedFactor.category_l2_name }}</el-tag>
                      <el-tag size="small" type="warning">{{ activeDetail?.category_l3_name || detailData?.category_l3_name || selectedFactor.category_l3_name }}</el-tag>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="标签">
                    <div v-if="detailData?.tags && detailData.tags.length > 0" style="display: flex; flex-wrap: wrap; gap: 4px;">
                      <el-tag
                        v-for="tag in detailData.tags"
                        :key="tag.tag_id"
                        size="small"
                      >
                        {{ tag.tag_name }}
                      </el-tag>
                    </div>
                    <span v-else style="color: #909399;">-</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="提交人">
                    {{ detailData?.created_by || detailData?.submitted_by || selectedFactor.created_by || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="提交版本">
                    <el-tag size="small">v{{ activeDetail?.version || detailData?.version || selectedFactor.version }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="提交时间">
                    {{ formatFullTime(detailData?.submitted_at || selectedFactor.submitted_at) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="提交备注">
                    {{ activeDetail?.plaza_remark || detailData?.plaza_remark || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="描述">
                    {{ activeDetail?.description || '-' }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 版本历史 -->
              <el-card shadow="never" class="info-section" v-if="allVersions.length > 0">
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>版本历史 ({{ allVersions.length }})</span>
                    <el-button size="small" text @click="loadVersionHistory" :loading="loadingVersions">
                      <el-icon><Refresh /></el-icon>
                      刷新
                    </el-button>
                  </div>
                </template>
                <div v-loading="loadingVersions">
                  <el-timeline v-if="allVersions.length > 0">
                    <el-timeline-item
                      v-for="ver in allVersions"
                      :key="ver.version"
                      :timestamp="formatTime(ver.created_at)"
                      :type="(selectedVersion || detailData?.version) === ver.version ? 'primary' : ''"
                      :hollow="(selectedVersion || detailData?.version) !== ver.version"
                    >
                      <div 
                        class="version-item version-clickable" 
                        :class="{ 'version-selected': (selectedVersion || detailData?.version) === ver.version }"
                        @click="selectVersion(ver)"
                      >
                        <el-tag size="small" :type="ver.version === detailData?.version ? 'primary' : 'info'">
                          v{{ ver.version }}
                        </el-tag>
                        <span v-if="ver.version === detailData?.version" class="version-desc" style="color: #409eff;">最新版本</span>
                        <span class="version-desc" v-else-if="ver.description">{{ ver.description }}</span>
                        <el-tag v-if="ver.has_source === false && isPyFileFactor(detailData)" size="small" type="danger" effect="plain">
                          无源码
                        </el-tag>
                      </div>
                    </el-timeline-item>
                  </el-timeline>
                  <el-empty v-else description="暂无版本记录" :image-size="60" />
                </div>
              </el-card>

              <!-- 因子表达式 / Py文件源码 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>{{ isPyFileFactor(detailData || selectedFactor) ? 'Python 源码' : '因子表达式' }}</span>
                </template>
                <template v-if="isPyFileFactor(detailData || selectedFactor)">
                  <div class="py-source-actions">
                    <el-button type="primary" size="small" @click="viewSource" :loading="loadingSource">
                      <el-icon><Document /></el-icon>
                      查看 v{{ selectedVersion || detailData?.version }} 源码
                    </el-button>
                  </div>
                  <pre v-if="sourceContent" class="expression-code py-source-code">{{ sourceContent }}</pre>
                </template>
                <template v-else>
                  <pre class="expression-code">{{ activeDetail?.expression || '-' }}</pre>
                </template>
              </el-card>

              <!-- 数据依赖 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <div class="section-header-with-tip">
                    <span>数据依赖</span>
                    <el-tag v-if="selectedVersion" size="small" type="primary">v{{ selectedVersion }}</el-tag>
                  </div>
                </template>
                <div v-if="hasDataSources(activeDetail?.data_sources)" class="data-sources-display">
                  <div
                    v-for="(info, tableName) in parseDataSourcesForDisplay(activeDetail.data_sources)"
                    :key="tableName"
                    class="source-item"
                  >
                    <div class="table-name">{{ tableName }}</div>
                    <div v-if="info.date_field || info.code_field" class="key-fields">
                      <el-tag v-if="info.date_field" size="small" type="warning">
                        日期: {{ info.date_field }}
                      </el-tag>
                      <el-tag v-if="info.code_field" size="small" type="success">
                        代码: {{ info.code_field }}
                      </el-tag>
                    </div>
                    <div class="field-tags">
                      <el-tag
                        v-for="field in info.fields"
                        :key="field"
                        size="small"
                        type="info"
                      >
                        {{ field }}
                      </el-tag>
                    </div>
                  </div>
                </div>
                <div v-else class="no-data">暂无数据依赖</div>
              </el-card>

              <!-- 性能指标 -->
              <el-card v-if="hasPerformanceData(activeDetail)" shadow="never" class="info-section">
                <template #header>
                  <div class="section-header-with-tip">
                    <span>性能指标</span>
                    <el-tag v-if="selectedVersion" size="small" type="primary">v{{ selectedVersion }}</el-tag>
                  </div>
                </template>
                <el-descriptions :column="2" size="small" border>
                  <el-descriptions-item label="Rank IC均值">
                    {{ activeDetail?.rank_ic_mean?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC IR">
                    <el-text type="success" style="font-weight: bold;">
                      {{ activeDetail?.rank_ic_ir?.toFixed(2) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="夏普比率">
                    {{ activeDetail?.sharpe_ratio?.toFixed(2) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤">
                    <el-text type="danger">
                      {{ activeDetail?.max_drawdown ? (activeDetail.max_drawdown * 100).toFixed(2) + '%' : '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="年化收益">
                    <el-text :type="(activeDetail?.annual_return || 0) > 0 ? 'success' : 'danger'">
                      {{ activeDetail?.annual_return ? (activeDetail.annual_return * 100).toFixed(2) + '%' : '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="胜率">
                    {{ activeDetail?.win_rate ? (activeDetail.win_rate * 100).toFixed(2) + '%' : '-' }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 版本信息（联动版本历史选择） -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>版本信息 <el-tag v-if="selectedVersion" size="small" type="primary">v{{ selectedVersion }}</el-tag></span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="因子ID">
                    {{ activeDetail?.factor_id || selectedFactor.factor_id }}
                  </el-descriptions-item>
                  <el-descriptions-item label="版本">
                    {{ activeDetail?.version }}
                  </el-descriptions-item>
                  <el-descriptions-item label="描述">
                    {{ activeDetail?.description || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="IC均值">
                    {{ activeDetail?.ic_mean?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC IR">
                    {{ activeDetail?.rank_ic_ir?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="夏普比率">
                    {{ activeDetail?.sharpe_ratio?.toFixed(2) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="回测周期">
                    {{ activeDetail?.backtest_period || (activeDetail?.data_start_date && activeDetail?.data_end_date ? `${activeDetail.data_start_date} ~ ${activeDetail.data_end_date}` : '-') }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatFullTime(activeDetail?.created_at) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="提交时间">
                    {{ formatFullTime(activeDetail?.submitted_at || detailData?.submitted_at) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </div>
          </div>
        </div>
      </div>

      <!-- 提交记录流水 -->
      <div v-show="activeTab === 'submissions'" class="submissions-layout">
        <el-table
          :data="submissions"
          v-loading="loadingSubmissions"
          stripe
          height="100%"
          empty-text="暂无提交记录"
        >
          <el-table-column prop="submitted_at" label="提交时间" width="170" />
          <el-table-column prop="created_by" label="提交人" width="100" />
          <el-table-column label="因子名称" min-width="160">
            <template #default="{ row }">
              <el-link type="primary" @click="goToFactor(row)">{{ row.factor_name }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="factor_id" label="因子ID" min-width="120">
            <template #default="{ row }">
              <span style="font-family: monospace; color: #909399; font-size: 12px;">{{ row.factor_id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="版本" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">v{{ row.version }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.expression_type === 'py_file'" size="small" type="warning" effect="plain">Py</el-tag>
              <el-tag v-else size="small" type="info" effect="plain">表达式</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分类" min-width="180">
            <template #default="{ row }">
              <span style="font-size: 12px; color: #909399;">
                {{ row.category_l1_name }} / {{ row.category_l2_name }} / {{ row.category_l3_name }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="Rank IC IR" width="100" align="center">
            <template #default="{ row }">
              {{ row.rank_ic_ir != null ? row.rank_ic_ir.toFixed(2) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="夏普比率" width="100" align="center">
            <template #default="{ row }">
              {{ row.sharpe_ratio != null ? row.sharpe_ratio.toFixed(2) : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="plaza_remark" label="备注" min-width="120">
            <template #default="{ row }">
              {{ row.plaza_remark || '-' }}
            </template>
          </el-table-column>
        </el-table>

        <div v-if="submissionsTotal > submissionsPageSize" class="pagination-footer">
          <el-pagination
            v-model:current-page="submissionsPage"
            :page-size="submissionsPageSize"
            :total="submissionsTotal"
            layout="total, prev, pager, next"
            small
            @current-change="loadSubmissions"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Grid, Document } from '@element-plus/icons-vue'

const loading = ref(false)
const loadingDetail = ref(false)
const loadingCategories = ref(false)
const loadingSource = ref(false)
const loadingVersions = ref(false)
const searchKeyword = ref('')
const factors = ref<any[]>([])
const categories = ref<any[]>([])
const selectedFactor = ref<any>(null)
const detailData = ref<any>(null)
const activeDetail = ref<any>(null)
const sourceContent = ref('')
const treeRef = ref()

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const selectedCategoryL1 = ref<number | null>(null)
const selectedCategoryL2 = ref<number | null>(null)
const selectedCategoryL3 = ref<number | null>(null)
// 未分类筛选（自建分类）
const uncategorizedFilter = ref(false)
const selectedCategoryL1Name = ref<string | null>(null)
const selectedCategoryL2Name = ref<string | null>(null)
const selectedCategoryL3Name = ref<string | null>(null)

const versionHistory = ref<any[]>([])
const selectedVersion = ref<number | null>(null)

// 提交记录流水
const activeTab = ref<'plaza' | 'submissions'>('plaza')
const submissions = ref<any[]>([])
const loadingSubmissions = ref(false)
const submissionsPage = ref(1)
const submissionsPageSize = ref(20)
const submissionsTotal = ref(0)
const submissionsLoaded = ref(false)

const allVersions = computed(() => {
  return versionHistory.value
    .map((v: any) => ({ ...v, version: Number(v.version) }))
    .sort((a: any, b: any) => b.version - a.version)
})

function addCategoryUid(nodes: any[], level: number, parentUid = '', inUncategorized = false): any[] {
  return nodes.map((node, idx) => {
    const isUncategorizedRoot = node.code === '__uncategorized__' || node.id === -1
    const underUncategorized = inUncategorized || isUncategorizedRoot
    // 未分类子树里 id 都是 0，用 name+index 保证 uid 唯一
    const uid = underUncategorized
      ? `${parentUid}_u${level}_${idx}_${node.name}`
      : `l${level}_${node.id}`
    return {
      ...node,
      _uid: uid,
      _level: level,
      _isUncategorizedRoot: isUncategorizedRoot,
      _inUncategorized: underUncategorized && !isUncategorizedRoot,
      children: node.children ? addCategoryUid(node.children, level + 1, uid, underUncategorized) : []
    }
  })
}

const loadCategories = async () => {
  loadingCategories.value = true
  try {
    const result = await window.electronAPI.factor.plazaCategories()
    if (result.success && result.data) {
      categories.value = addCategoryUid(result.data, 1)
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
  } finally {
    loadingCategories.value = false
  }
}

const refreshCategories = () => {
  loadCategories()
}

const handleCategoryClick = (data: any) => {
  selectedCategoryL1.value = null
  selectedCategoryL2.value = null
  selectedCategoryL3.value = null
  selectedCategoryL1Name.value = null
  selectedCategoryL2Name.value = null
  selectedCategoryL3Name.value = null
  uncategorizedFilter.value = false

  if (data._isUncategorizedRoot) {
    // 点击"未分类"根节点：拉取所有自建分类的因子
    uncategorizedFilter.value = true
  } else if (data._inUncategorized) {
    // 点击"未分类"下的自建子分类：按分类名筛选（自建分类无独立id）
    if (data._level === 2) {
      selectedCategoryL1Name.value = data.name
    } else if (data._level === 3) {
      selectedCategoryL2Name.value = data.name
    } else if (data._level === 4) {
      selectedCategoryL3Name.value = data.name
    }
  } else {
    // 系统标准分类：按id筛选
    if (data._level === 1) {
      selectedCategoryL1.value = data.id
    } else if (data._level === 2) {
      selectedCategoryL2.value = data.id
    } else if (data._level === 3) {
      selectedCategoryL3.value = data.id
    }
  }

  page.value = 1
  loadFactors()
}

const loadFactors = async () => {
  loading.value = true
  try {
    const params: any = {
      page: page.value,
      page_size: pageSize.value
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (selectedCategoryL1.value) params.category_l1_id = selectedCategoryL1.value
    if (selectedCategoryL2.value) params.category_l2_id = selectedCategoryL2.value
    if (selectedCategoryL3.value) params.category_l3_id = selectedCategoryL3.value
    if (uncategorizedFilter.value) params.uncategorized = true
    if (selectedCategoryL1Name.value) params.category_l1_name = selectedCategoryL1Name.value
    if (selectedCategoryL2Name.value) params.category_l2_name = selectedCategoryL2Name.value
    if (selectedCategoryL3Name.value) params.category_l3_name = selectedCategoryL3Name.value

    const result = await window.electronAPI.factor.plazaList(params)
    if (result.success) {
      factors.value = result.data?.factors || result.data?.items || []
      total.value = result.data?.total || 0
    } else {
      ElMessage.error(result.error || '加载失败')
    }
  } catch (error: any) {
    ElMessage.error('加载广场列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const selectFactor = async (factor: any) => {
  selectedFactor.value = factor
  sourceContent.value = ''
  selectedVersion.value = null
  versionHistory.value = []
  loadingDetail.value = true
  try {
    const factorId = factor.factor_id
    const result = await window.electronAPI.factor.plazaDetail(factorId)
    if (result.success) {
      detailData.value = result.data
      activeDetail.value = result.data
    } else {
      detailData.value = null
      activeDetail.value = null
    }
    await loadVersionHistory()
  } catch {
    detailData.value = null
    activeDetail.value = null
  } finally {
    loadingDetail.value = false
  }
}

const loadSubmissions = async () => {
  loadingSubmissions.value = true
  try {
    const params: any = {
      page: submissionsPage.value,
      page_size: submissionsPageSize.value
    }
    const result = await window.electronAPI.factor.plazaSubmissions(params)
    if (result.success) {
      submissions.value = result.data?.submissions || []
      submissionsTotal.value = result.data?.total || 0
    } else {
      ElMessage.error(result.error || '加载提交记录失败')
    }
  } catch (error: any) {
    ElMessage.error('加载提交记录失败: ' + error.message)
  } finally {
    loadingSubmissions.value = false
    submissionsLoaded.value = true
  }
}

const switchToSubmissions = () => {
  activeTab.value = 'submissions'
  if (!submissionsLoaded.value) {
    loadSubmissions()
  }
}

const goToFactor = async (row: any) => {
  activeTab.value = 'plaza'
  await selectFactor({
    factor_id: row.factor_id,
    factor_name: row.factor_name,
    factor_code: row.factor_code
  })
  if (row.version != null) {
    const target = allVersions.value.find((v: any) => v.version === Number(row.version))
    if (target) selectVersion(target)
  }
}

const loadVersionHistory = async () => {
  const factorId = detailData.value?.factor_id || selectedFactor.value?.factor_id
  if (!factorId) return
  loadingVersions.value = true
  try {
    const result = await window.electronAPI.factor.plazaVersions(factorId)
    if (result.success && result.data) {
      versionHistory.value = Array.isArray(result.data) ? result.data : (result.data.versions || [])
    } else {
      versionHistory.value = []
    }
  } catch {
    versionHistory.value = []
  } finally {
    loadingVersions.value = false
  }
}

const selectVersion = (ver: any) => {
  selectedVersion.value = Number(ver.version)
  sourceContent.value = ''
  activeDetail.value = ver
}

const viewSource = async () => {
  if (!selectedFactor.value) return
  loadingSource.value = true
  try {
    const factorId = selectedFactor.value.factor_id
    const version = selectedVersion.value || detailData.value?.version
    const result = await window.electronAPI.factor.plazaSource(factorId, version)
    if (result.success) {
      sourceContent.value = result.data?.content || (result as any).content || '(空文件)'
    } else {
      ElMessage.warning(result.error || '获取源码失败')
    }
  } catch (error: any) {
    ElMessage.error('获取源码失败: ' + error.message)
  } finally {
    loadingSource.value = false
  }
}

const isPyFileFactor = (factor: any) => {
  if (!factor) return false
  return factor.expression === '__py_file__'
}

const hasDataSources = (ds: any) => {
  if (!ds) return false
  if (typeof ds === 'string') {
    try { ds = JSON.parse(ds) } catch { return false }
  }
  return Object.keys(ds).length > 0
}

const parseDataSourcesForDisplay = (ds: any) => {
  if (!ds) return {}
  if (typeof ds === 'string') {
    try { ds = JSON.parse(ds) } catch { return {} }
  }
  const result: Record<string, { fields: string[], date_field?: string, code_field?: string }> = {}
  for (const [tableName, config] of Object.entries(ds as Record<string, any>)) {
    result[tableName] = {
      fields: config.fields || [],
      date_field: config.date_field,
      code_field: config.code_field
    }
  }
  return result
}

const hasPerformanceData = (d: any) => {
  return d && (d.ic_mean || d.rank_ic_ir || d.sharpe_ratio || d.max_drawdown)
}

const formatTime = (t: string) => {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const formatFullTime = (t: string) => {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

onMounted(() => {
  loadCategories()
  loadFactors()
  loadSubmissions()
})
</script>

<style scoped lang="scss">
.plaza-page {
  height: calc(100vh - 100px);
  background: #f5f7fa;
  overflow: hidden;
  box-sizing: border-box;
}

.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.nav-tabs {
  display: inline-flex;
  background: #fff;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;

  .el-icon {
    font-size: 16px;
  }

  &.active {
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
  }
}

.content-layout {
  display: grid;
  grid-template-columns: 240px 1fr 500px;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.submissions-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;

  .pagination-footer {
    padding: 12px 15px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }
}

.left-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;

  .panel-header {
    padding: 10px 12px;
    background: #fafafa;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
    font-size: 13px;
  }

  .category-tree {
    padding: 10px;
    flex: 1;
    overflow-y: auto;

    .tree-node {
      display: flex;
      align-items: center;
      gap: 8px;

      .node-label {
        flex: 1;
      }

      .node-count {
        color: #909399;
        font-size: 12px;
      }
    }
  }

  .panel-header .header-actions {
    display: flex;
    gap: 4px;
  }
}

.middle-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;

  .panel-header {
    padding: 10px 15px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .factor-count {
      font-size: 12px;
      color: #909399;
      font-weight: normal;
    }
  }

  .factor-list {
    padding: 15px;
    flex: 1;
    overflow-y: auto;

    .factor-card {
      padding: 12px 15px;
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #409EFF;
        box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
      }

      &.active {
        border-color: #409EFF;
        background: #ecf5ff;
      }

      .factor-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;

        .factor-code {
          flex: 1;
          font-family: monospace;
          font-weight: 600;
          font-size: 14px;
          color: #409eff;
        }
      }

      .factor-name {
        font-size: 13px;
        color: #303133;
        margin-bottom: 6px;
      }

      .factor-category {
        font-size: 11px;
        color: #909399;
        margin-bottom: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .factor-metrics {
        display: flex;
        gap: 8px;
        margin-bottom: 6px;
      }

      .factor-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #c0c4cc;

        .factor-submitter {
          color: #909399;
        }
      }
    }
  }

  .pagination-footer {
    padding: 12px 15px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }
}

.right-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .panel-header {
    padding: 12px 15px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 500;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .empty-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .factor-detail {
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e4e7ed;

      h3 {
        margin: 0;
        font-size: 18px;
      }
    }

    .info-section {
      margin-bottom: 16px;

      :deep(.el-card__header) {
        padding: 10px 15px;
        background: #f5f7fa;
        font-size: 14px;
      }

      :deep(.el-card__body) {
        padding: 15px;
      }
    }

    .section-header-with-tip {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .expression-code {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      max-height: 150px;
      overflow-y: auto;
    }

    .py-source-actions {
      margin-bottom: 10px;
    }

    .py-source-code {
      max-height: 400px;
    }
  }
}

.data-sources-display {
  .source-item {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px dashed #e4e7ed;

    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .table-name {
      font-weight: 600;
      font-size: 13px;
      color: #303133;
      margin-bottom: 6px;
      font-family: monospace;
    }

    .key-fields {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    .field-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }
}

.no-data {
  color: #909399;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

// 版本历史
.version-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .version-desc {
    font-size: 12px;
    color: #606266;
  }
}

.version-clickable {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f0f9ff;
  }

  &.version-selected {
    background: #ecf5ff;
    border: 1px solid #b3d8ff;
  }
}
</style>
