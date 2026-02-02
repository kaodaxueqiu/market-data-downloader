<template>
  <div class="factor-plaza-page">
    <div class="page-header">
      <h2>📚 因子广场</h2>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索因子代码、名称..."
          clearable
          style="width: 300px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :icon="Refresh" @click="handleSearch">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 二级Tab：视图切换 -->
    <el-tabs v-model="activeViewTab" class="view-tabs" @tab-change="handleViewTabChange">
      <el-tab-pane name="category">
        <template #label>
          <span>📊 按分类浏览 ({{ totalCount }})</span>
        </template>
      </el-tab-pane>
      <el-tab-pane name="tags">
        <template #label>
          <span>🏷️ 按标签筛选</span>
        </template>
      </el-tab-pane>
      <el-tab-pane name="performance">
        <template #label>
          <span>📈 按性能排序</span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 主内容区：左中右三栏 -->
    <div class="content-layout">
      <!-- 左侧面板：根据Tab显示不同内容 -->
      
      <!-- Tab1: 分类树 -->
      <div v-if="activeViewTab === 'category'" class="left-panel">
        <div class="panel-header">
          <span>因子分类</span>
          <el-button text @click="expandAll">
            <el-icon><Expand /></el-icon>
            {{ allExpanded ? '全部收起' : '全部展开' }}
          </el-button>
        </div>
        <div class="category-tree" v-loading="loadingCategories">
          <el-tree
            ref="treeRef"
            :data="treeDataWithUniqueKeys"
            :props="treeProps"
            :expand-on-click-node="false"
            node-key="uniqueKey"
            highlight-current
            @node-click="handleNodeClick"
          >
            <template #default="{ data }">
              <div class="tree-node">
                <span class="node-label">{{ data.name }}</span>
                <span class="node-count" v-if="data.factor_count !== undefined">
                  ({{ data.factor_count }})
                </span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
      
      <!-- Tab2: 标签列表 -->
      <div v-else-if="activeViewTab === 'tags'" class="left-panel">
        <div class="panel-header">
          <span>因子标签</span>
          <el-button text size="small" @click="clearAllTags">
            <el-icon><Refresh /></el-icon>
            清空
          </el-button>
        </div>
        <div class="tags-container" v-loading="loadingTags">
          <div v-for="(tags, tagType) in tagGroups" :key="tagType" class="tag-group">
            <div class="tag-group-title">{{ getTagTypeLabel(tagType) }}</div>
            <div class="tag-items">
              <el-check-tag
                v-for="tag in tags"
                :key="tag.id"
                :checked="selectedTags.includes(tag.tag_value)"
                @change="toggleTag(tag.tag_value)"
                class="tag-item"
              >
                {{ tag.tag_name }}
              </el-check-tag>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Tab3: 性能排序（占位） -->
      <div v-else class="left-panel">
        <div class="panel-header">
          <span>性能指标</span>
        </div>
        <div class="empty-state">
          <el-empty description="功能开发中..." :image-size="80" />
        </div>
      </div>

      <!-- 中间：因子列表 -->
      <div class="middle-panel">
        <div class="panel-header">
          <span>因子列表</span>
          <el-select v-model="selectedStatus" size="small" style="width: 130px" @change="loadFactors">
            <el-option
              v-for="status in statusOptions"
              :key="status.value"
              :label="status.icon + ' ' + status.label"
              :value="status.value"
            />
          </el-select>
        </div>
        <div class="factor-list" v-loading="loadingFactors">
          <div
            v-for="factor in displayedFactors"
            :key="factor.factor_id"
            class="factor-card"
            :class="{ active: selectedFactor?.factor_id === factor.factor_id }"
            @click="selectFactor(factor)"
          >
            <div class="factor-header">
              <div class="factor-code">{{ factor.factor_code }}</div>
              <el-tag size="small" :type="getStatusColor(factor.status)">
                {{ getStatusLabel(factor.status) }}
              </el-tag>
            </div>
            <div class="factor-name">{{ factor.factor_name }}</div>
            <div class="factor-category">
              {{ factor.category_l1_name }} / {{ factor.category_l2_name }} / {{ factor.category_l3_name }}
            </div>
            <div class="factor-metrics">
              <el-tag size="small" type="success" effect="plain">
                Rank IC IR: {{ factor.rank_ic_ir?.toFixed(2) || '-' }}
              </el-tag>
            </div>
          </div>
          
          <!-- 空状态 -->
          <el-empty 
            v-if="!loadingFactors && displayedFactors.length === 0" 
            description="该分类下暂无因子"
            :image-size="100"
          />
          
          <!-- 分页 -->
          <div v-if="pagination.total > pagination.page_size" class="pagination-wrapper">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.page_size"
              :total="pagination.total"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              small
              @current-change="loadFactors"
              @size-change="loadFactors"
            />
          </div>
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
            <h3>{{ selectedFactorDetail?.factor_name || selectedFactor.factor_name }}</h3>
            <el-tag :type="getStatusColor(selectedFactorDetail?.status || selectedFactor.status)">
              {{ getStatusLabel(selectedFactorDetail?.status || selectedFactor.status) }}
            </el-tag>
          </div>

          <!-- 基本信息 -->
          <el-card shadow="never" class="info-section">
            <template #header>
              <span>基本信息</span>
            </template>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="因子代码">
                <el-text style="font-family: monospace; font-weight: 500;">
                  {{ selectedFactorDetail?.factor_code }}
                </el-text>
              </el-descriptions-item>
              <el-descriptions-item label="英文名称">
                {{ selectedFactorDetail?.factor_name_en || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="分类">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <el-tag size="small">{{ selectedFactorDetail?.category_l1_name }}</el-tag>
                  <el-tag size="small" type="success">{{ selectedFactorDetail?.category_l2_name }}</el-tag>
                  <el-tag size="small" type="warning">{{ selectedFactorDetail?.category_l3_name }}</el-tag>
                </div>
              </el-descriptions-item>
              <el-descriptions-item label="数据类型">
                {{ selectedFactorDetail?.data_type || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="单位">
                {{ selectedFactorDetail?.unit || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="回看周期">
                {{ selectedFactorDetail?.lookback_period || '-' }} 天
              </el-descriptions-item>
              <el-descriptions-item label="因子描述">
                {{ selectedFactorDetail?.description || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="计算公式">
                <el-text style="font-family: monospace; font-size: 12px; word-break: break-all;">
                  {{ selectedFactorDetail?.formula || '-' }}
                </el-text>
              </el-descriptions-item>
            </el-descriptions>

            <!-- 标签 -->
            <div v-if="selectedFactorDetail?.tags && selectedFactorDetail.tags.length > 0" class="tags-section">
              <div class="section-title">标签</div>
              <el-tag
                v-for="tag in selectedFactorDetail.tags"
                :key="tag.id"
                size="small"
                class="factor-tag"
              >
                {{ tag.tag_name }}
              </el-tag>
            </div>
          </el-card>

          <!-- 性能指标 -->
          <el-card shadow="never" class="info-section">
            <template #header>
              <div class="section-header">
                <span>性能指标</span>
                <el-button size="small" text @click="viewPerformanceTrend">
                  <el-icon><TrendCharts /></el-icon>
                  查看趋势
                </el-button>
              </div>
            </template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="Rank IC均值">
                <el-text :type="getICColor(selectedFactorDetail?.rank_ic_mean)">
                  {{ selectedFactorDetail?.rank_ic_mean?.toFixed(4) || '-' }}
                </el-text>
              </el-descriptions-item>
              <el-descriptions-item label="Rank IC IR">
                <el-text type="success" style="font-weight: bold;">
                  {{ selectedFactorDetail?.rank_ic_ir?.toFixed(2) || '-' }}
                </el-text>
              </el-descriptions-item>
              <el-descriptions-item label="换手率">
                {{ (selectedFactorDetail?.turnover * 100)?.toFixed(2) || '-' }}%
              </el-descriptions-item>
              <el-descriptions-item label="夏普比率">
                {{ selectedFactorDetail?.sharpe_ratio?.toFixed(2) || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="最大回撤">
                <el-text type="danger">
                  {{ (selectedFactorDetail?.max_drawdown * 100)?.toFixed(2) || '-' }}%
                </el-text>
              </el-descriptions-item>
              <el-descriptions-item label="覆盖率">
                {{ (selectedFactorDetail?.coverage_rate * 100)?.toFixed(2) || '-' }}%
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 数据范围 -->
          <el-card shadow="never" class="info-section">
            <template #header>
              <span>数据范围</span>
            </template>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="数据起始">
                {{ selectedFactorDetail?.data_start_date || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="数据结束">
                {{ selectedFactorDetail?.data_end_date || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="最后更新">
                {{ selectedFactorDetail?.last_performance_date || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <el-button type="primary" size="large" :icon="Download" @click="showDownloadDialog">
              下载因子数据
            </el-button>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- 下载对话框 -->
    <el-dialog
      v-model="downloadDialogVisible"
      title="下载因子数据"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="downloadForm" label-width="100px">
        <el-form-item label="因子">
          <el-tag type="primary" size="large">
            {{ selectedFactorDetail?.factor_name }}
          </el-tag>
        </el-form-item>
        <el-form-item label="日期范围" required>
          <el-date-picker
            v-model="downloadForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="股票池">
          <el-select v-model="downloadForm.stock_pool" style="width: 100%">
            <el-option label="全市场" value="all" />
            <el-option label="沪深300" value="hs300" />
            <el-option label="中证500" value="zz500" />
            <el-option label="中证1000" value="zz1000" />
            <el-option label="科创50" value="kc50" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="downloadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDownload" :loading="downloading">
          创建下载任务
        </el-button>
      </template>
    </el-dialog>

    <!-- 性能趋势对话框 -->
    <el-dialog
      v-model="performanceDialogVisible"
      title="因子性能趋势"
      width="90%"
      top="5vh"
    >
      <div v-loading="loadingPerformance" style="min-height: 400px;">
        <div v-if="performanceData.length > 0">
          <el-alert type="info" :closable="false" style="margin-bottom: 20px;">
            <template #title>
              共 {{ performanceData.length }} 天数据 | 
              平均IC: {{ avgIC }} | 
              平均Rank IC: {{ avgRankIC }} | 
              平均换手: {{ avgTurnover }}
            </template>
          </el-alert>
          
          <div class="performance-placeholder">
            <el-text type="info">性能趋势图表展示区域（未来可集成图表库）</el-text>
          </div>
        </div>
        <el-empty v-else description="暂无性能数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Download, TrendCharts, Expand } from '@element-plus/icons-vue'

// Tab状态
const activeViewTab = ref('category')

// 数据状态
const loadingCategories = ref(false)
const loadingFactors = ref(false)
const loadingDetail = ref(false)
const loadingPerformance = ref(false)
const loadingTags = ref(false)
const downloading = ref(false)

// 数据
const searchKeyword = ref('')
const categoryTree = ref<any[]>([])
const factors = ref<any[]>([])
const selectedFactor = ref<any>(null)
const selectedFactorDetail = ref<any>(null)
const selectedStatus = ref('all')
const selectedCategoryId = ref<number | null>(null)
const selectedCategoryData = ref<any>(null)
const performanceData = ref<any[]>([])
const totalCount = ref(0)
const allExpanded = ref(false)
const tagGroups = ref<Record<string, any[]>>({})
const selectedTags = ref<string[]>([])

// 状态选项
const statusOptions = [
  { value: 'all', label: '全部', icon: '📊' },
  { value: 'testing', label: '测试中', icon: '✏️' },
  { value: 'pending', label: '待审核', icon: '⏳' },
  { value: 'production', label: '生产环境', icon: '✅' },
  { value: 'deprecated', label: '已废弃', icon: '⚠️' }
]

// 树配置
const treeRef = ref()
const treeProps = {
  children: 'children',
  label: 'name'
}

// 为树节点生成唯一Key
const treeDataWithUniqueKeys = computed(() => {
  const addUniqueKeys = (nodes: any[], level: number = 1, parentKey: string = ''): any[] => {
    return nodes.map((node) => {
      const uniqueKey = parentKey ? `${parentKey}-${node.id}` : `l${level}-${node.id}`
      
      const newNode = {
        ...node,
        uniqueKey,
        level
      }
      
      if (node.children && node.children.length > 0) {
        newNode.children = addUniqueKeys(node.children, level + 1, uniqueKey)
      }
      
      return newNode
    })
  }
  
  return addUniqueKeys(categoryTree.value)
})

// 分页
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0
})

// 对话框
const downloadDialogVisible = ref(false)
const performanceDialogVisible = ref(false)

// 下载表单
const downloadForm = ref({
  dateRange: [] as string[],
  stock_pool: 'all'
})

// 显示的因子列表
const displayedFactors = computed(() => factors.value)

// 性能统计
const avgIC = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.ic_value, 0)
  return (sum / performanceData.value.length).toFixed(4)
})

const avgRankIC = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.rank_ic_value, 0)
  return (sum / performanceData.value.length).toFixed(4)
})

const avgTurnover = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.turnover, 0)
  return ((sum / performanceData.value.length) * 100).toFixed(2) + '%'
})

// 加载分类树
const loadCategories = async () => {
  loadingCategories.value = true
  try {
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (!defaultKey) {
      ElMessage.error('请先在系统设置中配置API Key')
      return
    }
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('获取API Key失败')
      return
    }
    await window.electronAPI.factor.setApiKey(fullApiKey)
    
    const result = await window.electronAPI.factor.getCategories()
    if (result.code === 200) {
      categoryTree.value = result.data
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
    ElMessage.error('加载分类失败: ' + error.message)
  } finally {
    loadingCategories.value = false
  }
}

// 加载标签列表
const loadTags = async () => {
  loadingTags.value = true
  try {
    const result = await window.electronAPI.factor.getTags()
    if (result.code === 200) {
      tagGroups.value = result.data
    }
  } catch (error: any) {
    console.error('加载标签失败:', error)
    ElMessage.error('加载标签失败: ' + error.message)
  } finally {
    loadingTags.value = false
  }
}

// 加载因子列表
const loadFactors = async () => {
  loadingFactors.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      page_size: pagination.value.page_size
    }
    
    if (selectedStatus.value !== 'all') {
      params.status = selectedStatus.value
    }
    
    if (activeViewTab.value === 'category' && selectedCategoryData.value) {
      const level = selectedCategoryData.value.level
      const categoryId = selectedCategoryData.value.id
      
      if (level === 1) {
        params.category_l1_id = categoryId
      } else if (level === 2) {
        params.category_l2_id = categoryId
      } else if (level === 3) {
        params.category_l3_id = categoryId
      }
    }
    
    if (activeViewTab.value === 'tags' && selectedTags.value.length > 0) {
      params.tags = selectedTags.value.join(',')
    }
    
    const result = await window.electronAPI.factor.getFactorList(params)
    if (result.code === 200) {
      factors.value = result.data.factors || []
      pagination.value.total = result.data.total
      
      if (!selectedCategoryId.value && selectedStatus.value === 'all' && !searchKeyword.value && selectedTags.value.length === 0) {
        totalCount.value = result.data.total
      }
    }
  } catch (error: any) {
    console.error('加载因子列表失败:', error)
    ElMessage.error('加载因子列表失败: ' + error.message)
  } finally {
    loadingFactors.value = false
  }
}

// 树节点点击
const handleNodeClick = (data: any) => {
  selectedCategoryId.value = data.id
  selectedCategoryData.value = data
  pagination.value.page = 1
  loadFactors()
}

// 收集所有有子节点的uniqueKey
const collectNodeKeys = (nodes: any[]): string[] => {
  let keys: string[] = []
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      keys.push(node.uniqueKey)
      keys = keys.concat(collectNodeKeys(node.children))
    }
  })
  return keys
}

// 展开/收起全部
const expandAll = () => {
  allExpanded.value = !allExpanded.value
  if (!treeRef.value) return
  
  const keys = collectNodeKeys(treeDataWithUniqueKeys.value)
  keys.forEach(key => {
    const node = treeRef.value.getNode(key)
    if (node) {
      node.expanded = allExpanded.value
    }
  })
}

// Tab切换
const handleViewTabChange = () => {
  selectedCategoryId.value = null
  selectedCategoryData.value = null
  selectedTags.value = []
  selectedStatus.value = 'all'
  pagination.value.page = 1
  loadFactors()
}

// 清空所有标签
const clearAllTags = () => {
  selectedTags.value = []
  pagination.value.page = 1
  loadFactors()
}

// 切换标签选择
const toggleTag = (tagValue: string) => {
  const index = selectedTags.value.indexOf(tagValue)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagValue)
  }
  pagination.value.page = 1
  loadFactors()
}

// 获取标签类型的中文名
const getTagTypeLabel = (tagType: string) => {
  const labels: Record<string, string> = {
    frequency: '更新频率',
    level: '因子级别',
    attribute: '因子属性',
    computation: '计算方式',
    data_source: '数据来源',
    data_quality: '数据质量',
    application: '应用场景',
    strategy: '策略类型',
    usage: '使用方式',
    holding_period: '持有周期',
    universe: '股票池',
    industry: '行业',
    market: '市场',
    asset_class: '资产类别',
    style: '风格',
    factor_type: '因子类型',
    investment_style: '投资风格',
    complexity: '复杂度',
    stability: '稳定性',
    region: '地域',
    period: '周期',
    target: '目标'
  }
  return labels[tagType] || tagType
}

// 搜索
const handleSearch = () => {
  pagination.value.page = 1
  loadFactors()
}

// 选择因子
const selectFactor = async (factor: any) => {
  selectedFactor.value = factor
  loadingDetail.value = true
  
  try {
    const result = await window.electronAPI.factor.getFactorDetail(factor.factor_id)
    if (result.code === 200) {
      selectedFactorDetail.value = result.data
    }
  } catch (error: any) {
    console.error('加载因子详情失败:', error)
    ElMessage.error('加载因子详情失败: ' + error.message)
  } finally {
    loadingDetail.value = false
  }
}

// 显示下载对话框
const showDownloadDialog = () => {
  downloadForm.value = {
    dateRange: [],
    stock_pool: 'all'
  }
  downloadDialogVisible.value = true
}

// 下载
const handleDownload = async () => {
  if (!downloadForm.value.dateRange || downloadForm.value.dateRange.length !== 2) {
    ElMessage.warning('请选择日期范围')
    return
  }
  
  downloading.value = true
  
  try {
    const result = await window.electronAPI.factor.downloadFactorData({
      factor_ids: [selectedFactorDetail.value.factor_id],
      start_date: downloadForm.value.dateRange[0],
      end_date: downloadForm.value.dateRange[1],
      stock_pool: downloadForm.value.stock_pool
    })
    
    if (result.code === 200) {
      ElMessage.success(`下载任务创建成功！任务ID: ${result.data.task_id}`)
      downloadDialogVisible.value = false
    }
  } catch (error: any) {
    console.error('创建下载任务失败:', error)
    ElMessage.error('创建下载任务失败: ' + error.message)
  } finally {
    downloading.value = false
  }
}

// 查看性能趋势
const viewPerformanceTrend = async () => {
  if (!selectedFactorDetail.value) return
  
  performanceDialogVisible.value = true
  loadingPerformance.value = true
  
  try {
    const result = await window.electronAPI.factor.getFactorPerformance(
      selectedFactorDetail.value.factor_id,
      60
    )
    if (result.code === 200) {
      performanceData.value = result.data.performances
    }
  } catch (error: any) {
    console.error('加载性能数据失败:', error)
    ElMessage.error('加载性能数据失败: ' + error.message)
  } finally {
    loadingPerformance.value = false
  }
}

// 工具函数
const getStatusColor = (status: string) => {
  const colors: any = {
    production: 'success',
    testing: 'warning',
    deprecated: 'info',
    pending: 'primary'
  }
  return colors[status] || ''
}

const getStatusLabel = (status: string) => {
  const labels: any = {
    all: '全部',
    production: '生产环境',
    testing: '测试中',
    deprecated: '已废弃',
    pending: '待审核'
  }
  return labels[status] || status
}

const getICColor = (value?: number) => {
  if (!value) return ''
  if (value > 0.05) return 'success'
  if (value > 0.02) return 'primary'
  if (value < 0) return 'danger'
  return ''
}

// 初始化
onMounted(async () => {
  await loadCategories()
  await loadTags()
  await loadFactors()
})
</script>

<style scoped lang="scss">
.factor-plaza-page {
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

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .view-tabs {
    margin-bottom: 15px;
    background: white;
    padding: 10px 20px 0;
    border-radius: 8px 8px 0 0;
  }

  .content-layout {
    display: grid;
    grid-template-columns: 260px 1fr 420px;
    gap: 16px;
  }

  .left-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    height: calc(100vh - 220px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
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
    
    .tags-container {
      padding: 15px;
      flex: 1;
      overflow-y: auto;
      
      .tag-group {
        margin-bottom: 20px;
        
        .tag-group-title {
          font-weight: 500;
          font-size: 14px;
          color: #303133;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e4e7ed;
        }
        
        .tag-items {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .tag-item {
            cursor: pointer;
            font-size: 12px;
          }
        }
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .middle-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    height: calc(100vh - 220px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
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
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          
          .factor-code {
            font-family: monospace;
            font-weight: 600;
            font-size: 13px;
          }
        }
        
        .factor-name {
          font-size: 13px;
          color: #606266;
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
        }
      }
      
      .pagination-wrapper {
        margin-top: 20px;
        display: flex;
        justify-content: center;
      }
    }
  }

  .right-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    background: white;
    height: calc(100vh - 220px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
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
        margin-bottom: 20px;
        
        :deep(.el-card__header) {
          padding: 12px 15px;
          background: #f5f7fa;
        }
        
        :deep(.el-card__body) {
          padding: 15px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .section-title {
          font-weight: 500;
          margin-bottom: 10px;
          color: #606266;
        }
        
        .tags-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e4e7ed;
          
          .factor-tag {
            margin-right: 8px;
            margin-bottom: 8px;
          }
        }
      }
      
      .action-buttons {
        text-align: center;
        margin-top: 20px;
      }
    }
  }

  .performance-placeholder {
    min-height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    border-radius: 8px;
    border: 2px dashed #dcdfe6;
  }
}
</style>





