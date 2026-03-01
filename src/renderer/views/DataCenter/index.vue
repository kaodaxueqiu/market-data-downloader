<template>
  <div class="data-center">
    <!-- 顶部Tab切换 -->
    <el-tabs v-model="activeTab" class="data-tabs" @tab-change="handleTabChange">
      <el-tab-pane v-if="hasRedisPermission" label="行情数据" name="market">
        <template #label>
          <span class="tab-label">
            <el-icon><DataLine /></el-icon>
            行情数据 <el-tag size="small" type="primary">{{ marketSourceCount }}</el-tag>
            <span class="tab-db-name">Redis</span>
          </span>
        </template>
      </el-tab-pane>
      
      <el-tab-pane v-if="hasPostgresqlPermission" label="静态元数据" name="static">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            静态元数据 <el-tag size="small" type="success">{{ staticSourceCount }}</el-tag>
            <span class="tab-db-name">PG / finance_db</span>
          </span>
        </template>
      </el-tab-pane>
      
      <el-tab-pane v-if="hasClickhousePermission" label="加工数据" name="processed">
        <template #label>
          <span class="tab-label">
            <el-icon><Operation /></el-icon>
            加工数据 <el-tag size="small" type="warning">{{ processedSourceCount }}</el-tag>
            <span class="tab-db-name">CH / market_mart</span>
          </span>
        </template>
      </el-tab-pane>
      
      <el-tab-pane v-if="hasClickhouseDataPermission" label="行情镜像库" name="mirror">
        <template #label>
          <span class="tab-label">
            <el-icon><CopyDocument /></el-icon>
            行情镜像库 <el-tag size="small" type="info">{{ mirrorSourceCount }}</el-tag>
            <span class="tab-db-name">CH / market_data</span>
          </span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- 🆕 全局搜索框 -->
        <div class="global-search-wrapper">
          <el-input
            v-model="globalSearchKeyword"
            placeholder="全局搜索数据源、表名、字段..."
            clearable
            style="width: 450px"
            @input="handleGlobalSearch"
            @clear="handleSearchClear"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #suffix v-if="searchLoading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </template>
          </el-input>

          <!-- 搜索结果下拉框 -->
          <GlobalSearchDropdown
            :visible="showSearchResults"
            :results="searchResults"
            :loading="searchLoading"
            @select="handleSearchResultSelect"
            @close="showSearchResults = false"
          />
        </div>

        <el-button @click="handleRefresh" style="margin-left: 10px">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <el-button type="primary" @click="goToTasks">
        <el-icon><List /></el-icon>
        查看任务
      </el-button>
    </div>

    <!-- 市场分类标签（行情数据） - 🆕 改为动态加载 -->
    <div v-if="activeTab === 'market'" class="market-section">
      <div class="market-tags">
        <el-tag
          v-for="(market, index) in marketCategories"
          :key="market.market"
          :type="getMarketTagType(index)"
          :effect="marketFilter === market.market ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket(market.market)"
        >
          {{ market.market }} ({{ market.count }})
        </el-tag>
      </div>
    </div>

    <!-- 分类标签（静态元数据） -->
    <div v-if="activeTab === 'static'" class="category-section">
      <div class="category-tags">
        <el-tag
          v-for="cat in staticCategories"
          :key="cat.code"
          :type="cat.code === 'all' ? 'primary' : 'success'"
          :effect="categoryFilter === (cat.code === 'all' ? '' : cat.code) ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat.code === 'all' ? '' : cat.code)"
        >
          {{ cat.name }} ({{ cat.table_count }})
        </el-tag>
      </div>
    </div>

    <!-- 分类标签（加工数据） -->
    <div v-if="activeTab === 'processed'" class="category-section">
      <div class="category-tags">
        <el-tag
          v-for="cat in processedCategories"
          :key="cat.code"
          :type="cat.code === 'all' ? 'primary' : 'warning'"
          :effect="categoryFilter === (cat.code === 'all' ? '' : cat.code) ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat.code === 'all' ? '' : cat.code)"
        >
          {{ cat.name }} ({{ cat.table_count }})
        </el-tag>
      </div>
    </div>

    <!-- 分类标签（行情镜像库） -->
    <div v-if="activeTab === 'mirror'" class="category-section">
      <div class="category-tags">
        <el-tag
          v-for="(cat, index) in mirrorCategories"
          :key="cat.code === 'all' ? 'all' : `mirror-${index}`"
          :type="getMirrorCategoryType(cat)"
          :effect="categoryFilter === (cat.code === 'all' ? '' : cat.name) ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat.code === 'all' ? '' : cat.name)"
        >
          {{ cat.name }} ({{ cat.table_count }})
        </el-tag>
      </div>
    </div>

    <!-- 三栏布局 -->
    <div class="content-layout">
      <!-- 左侧：数据源列表 -->
      <div v-if="showLeftPanel" class="left-panel">
        <DataSourceList
          :data-sources="filteredDataSources"
          :selected-source="selectedSource"
          :active-tab="activeTab"
          @select="handleSourceSelect"
        />
      </div>

      <!-- 折叠/展开按钮 -->
      <div class="toggle-button" :class="{ 'button-collapsed': !showLeftPanel }" @click="toggleLeftPanel">
        <el-icon><DArrowLeft v-if="showLeftPanel" /><DArrowRight v-else /></el-icon>
      </div>

      <!-- 中间：详情展示 -->
      <div class="middle-panel" :class="{ 'panel-expanded': !showLeftPanel }">
        <component
          :is="detailComponent"
          :source="selectedSource"
          :selected-fields="selectedFields"
          :datasource="getDatasourceParam"
          @fields-change="handleFieldsChange"
        />
      </div>

      <!-- 右侧：下载配置 -->
      <div class="right-panel">
        <DownloadConfigPanel
          :source="selectedSource"
          :selected-fields="selectedFields"
          :active-tab="activeTab"
          @download="handleDownload"
          @preview="handlePreview"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataLine, Document, Operation, CopyDocument, Search, Refresh, List, DArrowLeft, DArrowRight, Loading } from '@element-plus/icons-vue'
import DataSourceList from './components/DataSourceList.vue'
import MarketDataDetail from './components/MarketDataDetail.vue'
import StaticDataDetail from './components/StaticDataDetail.vue'
import DownloadConfigPanel from './components/DownloadConfigPanel.vue'
import GlobalSearchDropdown from '../../components/GlobalSearchDropdown.vue'

const router = useRouter()

// Tab状态
const activeTab = ref<'market' | 'static' | 'processed' | 'mirror'>('market')

// 左侧面板显示状态
const showLeftPanel = ref(true)

// 🆕 全局搜索相关状态
const globalSearchKeyword = ref('')
const searchResults = ref<any>(null)
const searchLoading = ref(false)
const showSearchResults = ref(false)
let searchTimer: NodeJS.Timeout | null = null

// 🆕 数据源权限控制
const userDataSourcePermissions = ref<string[]>([])  // 用户可访问的数据源列表
const datasourcePermissionLoaded = ref(false)  // 权限是否已加载
const dataSourceTabMapping: Record<string, string> = {
  'redis': 'market',
  'postgresql': 'static',
  'clickhouse': 'processed',
  'clickhouse_data': 'mirror'
}

// 搜索和筛选
const searchKeyword = ref('')
const marketFilter = ref('')
const categoryFilter = ref('')

// 数据源
const marketSources = ref<any[]>([])
const staticSources = ref<any[]>([])
const processedSources = ref<any[]>([])  // 加工数据源（ClickHouse）
const mirrorSources = ref<any[]>([])      // 行情镜像库（ClickHouse）
const selectedSource = ref<any>(null)
const selectedFields = ref<string[]>([])

// 🆕 行情数据市场分类（动态加载）
const marketCategories = ref<any[]>([])
// 静态元数据分类（包含 'all' 分类）
const staticCategories = ref<any[]>([])
// 加工数据分类（包含 'all' 分类）
const processedCategories = ref<any[]>([])
// 行情镜像库分类（包含 'all' 分类）
const mirrorCategories = ref<any[]>([])

// 数据源数量
const marketSourceCount = computed(() => {
  // 从 marketCategories 中查找 '全部' 分类
  const allCat = marketCategories.value.find((c: any) => c.market === '全部')
  return allCat ? allCat.count : 0
})
const staticSourceCount = computed(() => {
  // 从 staticCategories 中查找 code='all' 的分类
  const allCat = staticCategories.value.find((c: any) => c.code === 'all')
  return allCat ? allCat.table_count : 0
})
const processedSourceCount = computed(() => {
  // 从 processedCategories 中查找 code='all' 的分类
  const allCat = processedCategories.value.find((c: any) => c.code === 'all')
  return allCat ? allCat.table_count : 0
})
const mirrorSourceCount = computed(() => {
  // 从 mirrorCategories 中查找 code='all' 的分类
  const allCat = mirrorCategories.value.find((c: any) => c.code === 'all')
  return allCat ? allCat.table_count : 0
})

// 当前数据源列表
const currentDataSources = computed(() => {
  if (activeTab.value === 'market') {
    return marketSources.value
  } else if (activeTab.value === 'static') {
    return staticSources.value
  } else if (activeTab.value === 'processed') {
    return processedSources.value  // 加工数据
  } else {
    return mirrorSources.value  // 行情镜像库
  }
})

// 过滤后的数据源
const filteredDataSources = computed(() => {
  let sources = currentDataSources.value

  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    sources = sources.filter((source: any) => {
      const code = (source.code || source.table_name || '').toLowerCase()
      const name = (source.name || source.table_comment || '').toLowerCase()
      return code.includes(keyword) || name.includes(keyword)
    })
  }

  // 市场过滤（行情数据）
  if (activeTab.value === 'market' && marketFilter.value && marketFilter.value !== '全部') {
    sources = sources.filter((source: any) => 
      source.market === marketFilter.value
    )
  }

  // 静态元数据和加工数据的分类筛选已在后端完成，这里不需要再过滤

  return sources
})

// 详情组件
const detailComponent = computed(() => {
  // 行情数据用 MarketDataDetail，静态元数据、加工数据和行情镜像库都用 StaticDataDetail
  return activeTab.value === 'market' ? MarketDataDetail : StaticDataDetail
})

// 数据源参数
const getDatasourceParam = computed(() => {
  if (activeTab.value === 'processed') {
    return 'clickhouse'
  } else if (activeTab.value === 'mirror') {
    return 'clickhouse_data'
  }
  return undefined
})

// Tab切换
const handleTabChange = (tabName: string) => {
  console.log('切换到Tab:', tabName)
  selectedSource.value = null
  selectedFields.value = []
  searchKeyword.value = ''
  marketFilter.value = ''
  categoryFilter.value = ''
}

// 🆕 全局搜索（防抖）
const handleGlobalSearch = () => {
  // 清除之前的定时器
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  
  const keyword = globalSearchKeyword.value.trim()
  
  // 如果搜索词为空或太短，隐藏结果
  if (!keyword || keyword.length < 2) {
    showSearchResults.value = false
    searchResults.value = null
    return
  }
  
  // 防抖300ms后执行搜索
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    showSearchResults.value = true
    
    try {
      console.log('🔍 执行全局搜索:', keyword)
      const result = await window.electronAPI.search.global(keyword, 20)
      console.log('✅ 搜索结果:', result)
      searchResults.value = result
      
      if (result.total === 0) {
        ElMessage.info('未找到匹配结果')
      }
    } catch (error: any) {
      console.error('❌ 全局搜索失败:', error)
      ElMessage.error(error.message || '搜索失败')
      showSearchResults.value = false
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

// 🆕 清空搜索
const handleSearchClear = () => {
  showSearchResults.value = false
  searchResults.value = null
}

// 🆕 选择搜索结果
const handleSearchResultSelect = async (result: any, dataType: 'market' | 'static' | 'processed' | 'mirror') => {
  console.log('选择搜索结果:', result, dataType)
  
  // 1. 切换到对应的Tab
  activeTab.value = dataType
  
  // 2. 清除筛选条件，确保能看到搜索结果
  marketFilter.value = ''
  categoryFilter.value = ''
  
  // 3. 如果是静态/加工数据/行情镜像库，需要重新加载全部表（清除分类筛选）
  if (dataType === 'static') {
    await loadStaticSources() // 加载所有静态数据表
  } else if (dataType === 'processed') {
    await loadProcessedSources() // 加载所有加工数据表
  } else if (dataType === 'mirror') {
    await loadMirrorSources() // 加载所有行情镜像库表
  }
  
  // 4. 等待数据加载完成
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // 5. 根据数据类型选中对应的数据源/表
  if (dataType === 'market') {
    // 行情数据：根据 source_code 查找
    const source = marketSources.value.find((s: any) => s.code === result.source_code)
    if (source) {
      selectedSource.value = source
      console.log('✅ 已选中行情数据源:', source.code)
    } else {
      ElMessage.warning(`未找到数据源 ${result.source_code}`)
    }
  } else if (dataType === 'static') {
    // 静态元数据：根据 table_name 查找
    const table = staticSources.value.find((t: any) => t.table_name === result.table_name)
    if (table) {
      selectedSource.value = table
      console.log('✅ 已选中静态数据表:', table.table_name)
    } else {
      ElMessage.warning(`未找到数据表 ${result.table_name}`)
    }
  } else if (dataType === 'processed') {
    // 加工数据：根据 table_name 查找
    const table = processedSources.value.find((t: any) => t.table_name === result.table_name)
    if (table) {
      selectedSource.value = table
      console.log('✅ 已选中加工数据表:', table.table_name)
    } else {
      ElMessage.warning(`未找到数据表 ${result.table_name}`)
    }
  } else if (dataType === 'mirror') {
    // 行情镜像库：根据 table_name 查找
    const table = mirrorSources.value.find((t: any) => t.table_name === result.table_name)
    if (table) {
      selectedSource.value = table
      console.log('✅ 已选中加工数据表:', table.table_name)
    } else {
      ElMessage.warning(`未找到数据表 ${result.table_name}`)
    }
  }
  
  // 6. 关闭搜索下拉框并清空搜索词
  showSearchResults.value = false
  globalSearchKeyword.value = ''
  searchResults.value = null
}

// 选择市场
const selectMarket = (market: string) => {
  marketFilter.value = market
  searchKeyword.value = ''
  console.log('选择市场:', market)
}

// 🆕 获取市场标签颜色（循环使用不同颜色）
const getMarketTagType = (index: number) => {
  const types = ['primary', 'success', 'warning', 'danger', 'info']
  return types[index % types.length]
}

// 行情镜像库分类颜色
const getMirrorCategoryType = (cat: any) => {
  if (cat.code === 'all') return 'primary'
  
  // 根据分类名称设置颜色
  const colorMap: Record<string, string> = {
    '深圳市场': 'success',
    '上海市场': 'danger',
    '期货市场': 'warning',
    '其他': 'info'
  }
  
  return colorMap[cat.name] || 'info'
}

// 选择分类
const selectCategory = async (category: string) => {
  categoryFilter.value = category
  searchKeyword.value = ''
  console.log('🏷️ 选择分类 code:', category || '全部')
  
  // 根据当前Tab重新加载对应分类的表
  if (activeTab.value === 'static') {
    await loadStaticSources(category === '' ? undefined : category)
  } else if (activeTab.value === 'processed') {
    await loadProcessedSources(category === '' ? undefined : category)
  } else if (activeTab.value === 'mirror') {
    await loadMirrorSources(category === '' ? undefined : category)
  }
}

// 刷新
const handleRefresh = async () => {
  if (activeTab.value === 'market') {
    await loadMarketCategories()
    await loadMarketSources()
  } else if (activeTab.value === 'static') {
    await loadStaticCategories()
    await loadStaticSources(categoryFilter.value === '' ? undefined : categoryFilter.value)
  } else if (activeTab.value === 'processed') {
    await loadProcessedCategories()
    await loadProcessedSources(categoryFilter.value === '' ? undefined : categoryFilter.value)
  } else if (activeTab.value === 'mirror') {
    await loadMirrorCategories()
    await loadMirrorSources(categoryFilter.value === '' ? undefined : categoryFilter.value)
  }
  ElMessage.success('刷新成功')
}

// 选择数据源
const handleSourceSelect = (source: any) => {
  console.log('选择数据源:', source)
  selectedSource.value = source
  selectedFields.value = []
}

// 字段变化
const handleFieldsChange = (fields: string[]) => {
  console.log('字段变化:', fields)
  selectedFields.value = fields
}

// 预览数据
const handlePreview = async (params: any) => {
  try {
    console.log('预览数据:', params)
    ElMessage.info('预览功能开发中...')
  } catch (error: any) {
    ElMessage.error(error.message || '预览失败')
  }
}

// 下载数据（任务创建成功后跳转）
const handleDownload = async (result: any) => {
  if (result.success) {
    // 延迟跳转到任务管理
    setTimeout(() => {
      router.push('/tasks')
    }, 1500)
  }
}

// 跳转到任务管理
const goToTasks = () => {
  router.push('/tasks')
}

// 切换左侧面板显示/隐藏
const toggleLeftPanel = () => {
  showLeftPanel.value = !showLeftPanel.value
}

// 🆕 加载用户数据源权限
const loadUserDataSourcePermissions = async () => {
  try {
    console.log('📋 加载用户数据源权限...')
    const result = await window.electronAPI.dbdict.getDatasources()
    
    console.log('🔍 接口返回结果:', result)
    console.log('  - result.code:', result.code)
    console.log('  - result.data:', result.data)
    
    if (result.code === 200 && result.data) {
      // 提取有权限的数据源
      const datasources = result.data.datasources || []
      console.log('  - datasources数组:', datasources)
      console.log('  - datasources数量:', datasources.length)
      
      userDataSourcePermissions.value = datasources
        .filter((ds: any) => ds.has_permission)
        .map((ds: any) => ds.code)
      
      console.log('✅ 用户可访问的数据源:', userDataSourcePermissions.value)
      console.log('  - 权限数量:', userDataSourcePermissions.value.length)
      
      // 标记权限已加载
      datasourcePermissionLoaded.value = true
      console.log('  - 权限加载状态已设置为: true')
      
      // 如果当前Tab没有权限，切换到第一个有权限的Tab
      const currentTabDataSource = Object.keys(dataSourceTabMapping).find(
        key => dataSourceTabMapping[key] === activeTab.value
      )
      
      if (currentTabDataSource && !userDataSourcePermissions.value.includes(currentTabDataSource)) {
        // 当前Tab没权限，切换到第一个有权限的Tab
        const firstAvailableTab = Object.entries(dataSourceTabMapping).find(
          ([ds]) => userDataSourcePermissions.value.includes(ds)
        )
        
        if (firstAvailableTab) {
          activeTab.value = firstAvailableTab[1] as 'market' | 'static' | 'processed' | 'mirror'
          console.log('🔄 切换到有权限的Tab:', activeTab.value)
        } else {
          ElMessage.error('您没有访问任何数据源的权限')
        }
      }
    } else {
      // 接口失败，不允许访问任何数据源
      console.error('❌ 获取数据源权限失败')
      userDataSourcePermissions.value = []
      datasourcePermissionLoaded.value = true
      ElMessage.error('获取数据源权限失败，请重新登录或联系管理员')
    }
  } catch (error: any) {
    console.error('❌ 加载数据源权限失败:', error)
    // 出错时不允许访问任何数据源
    userDataSourcePermissions.value = []
    datasourcePermissionLoaded.value = true
    ElMessage.error('加载数据源权限失败，请重新登录或联系管理员')
  }
}

// 🆕 判断用户是否有某个数据源的权限 - 使用computed确保响应式
const hasRedisPermission = computed(() => userDataSourcePermissions.value.includes('redis'))
const hasPostgresqlPermission = computed(() => userDataSourcePermissions.value.includes('postgresql'))
const hasClickhousePermission = computed(() => userDataSourcePermissions.value.includes('clickhouse'))
const hasClickhouseDataPermission = computed(() => userDataSourcePermissions.value.includes('clickhouse_data'))

// 设置API Key
const setupApiKey = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    if (keys.length > 0) {
      const defaultKey = keys.find((k: any) => k.isDefault)
      if (defaultKey) {
        const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
        if (fullKey) {
          await window.electronAPI.dictionary.setApiKey(fullKey)
          await window.electronAPI.dbdict.setApiKey(fullKey)
          console.log('✅ API Key 已设置')
          return true
        }
      }
    }
    ElMessage.warning('请先在系统设置中配置API Key')
    return false
  } catch (error) {
    console.error('❌ 设置API Key失败:', error)
    return false
  }
}

// 🆕 加载行情数据市场分类
const loadMarketCategories = async () => {
  try {
    console.log('📋 开始加载行情数据市场分类...')
    const result = await window.electronAPI.dictionary.getMarkets()
    console.log('✅ 市场分类返回结果:', result)
    
    if (result.code === 200) {
      // 添加"全部"分类
      const allCount = result.data.reduce((sum: number, m: any) => sum + m.count, 0)
      marketCategories.value = [
        { market: '全部', count: allCount, description: '所有市场' },
        ...result.data
      ]
      console.log(`✅ 加载市场分类成功: 总数据源 ${allCount}, ${result.data.length} 个市场`)
    } else {
      ElMessage.error(result.msg || '加载市场分类失败')
    }
  } catch (error: any) {
    console.error('❌ 加载市场分类失败:', error)
    if (error.message?.includes('403') || error.message?.includes('Permission denied')) {
      ElMessage.error('您没有访问实时行情库的权限，请联系管理员')
    } else {
      ElMessage.error('加载市场分类失败')
    }
  }
}

// 加载行情数据源
const loadMarketSources = async () => {
  try {
    const result = await window.electronAPI.dictionary.getSources()
    console.log('行情数据源返回结果:', result)
    if (result.code === 200) {
      // 按code排序（ZZ-01, ZZ-02...）
      marketSources.value = (result.data || []).sort((a: any, b: any) => {
        const codeA = a.code || ''
        const codeB = b.code || ''
        return codeA.localeCompare(codeB, undefined, { numeric: true })
      })
      console.log('✅ 加载行情数据源成功:', marketSources.value.length)
    } else {
      ElMessage.error(result.msg || '加载行情数据源失败')
    }
  } catch (error: any) {
    console.error('❌ 加载行情数据源失败:', error)
    ElMessage.error('数据字典服务不可用，请检查网络连接和API配置')
  }
}

// 加载静态元数据分类
const loadStaticCategories = async () => {
  try {
    const result = await window.electronAPI.dbdict.getCategories()
    console.log('静态元数据分类返回结果:', result)
    if (result.code === 200) {
      // 后端返回具体分类，前端累加得到总数
      const allCount = result.data.reduce((sum: number, cat: any) => sum + cat.table_count, 0)
      
      // 构建分类数组：'全部' + 具体分类
      staticCategories.value = [
        { code: 'all', name: '全部', table_count: allCount },
        ...result.data
      ]
      
      console.log(`✅ 加载静态元数据分类成功: 总表数 ${allCount}, ${result.data.length} 个分类`)
    } else {
      ElMessage.error(result.msg || '加载分类失败')
    }
  } catch (error: any) {
    console.error('❌ 加载静态元数据分类失败:', error)
    if (error.message?.includes('403') || error.message?.includes('Permission denied')) {
      ElMessage.error('您没有访问财务数据库的权限，请联系管理员')
    } else {
      ElMessage.error('加载分类失败')
    }
  }
}

// 加载静态元数据源（支持按分类筛选）
const loadStaticSources = async (category?: string) => {
  try {
    const params: any = {
      page: 1,
      size: 1000  // 加载所有表
    }
    
    // 如果指定了分类，则按分类筛选
    if (category) {
      params.category = category
      console.log('📋 加载分类数据，category参数:', category)
    } else {
      console.log('📋 加载所有表数据')
    }
    
    const result = await window.electronAPI.dbdict.getTables(params)
    console.log('✅ 静态元数据源返回结果:', result)
    if (result.code === 200) {
      // 按table_name排序
      staticSources.value = (result.data || []).sort((a: any, b: any) => {
        const nameA = a.table_name || ''
        const nameB = b.table_name || ''
        return nameA.localeCompare(nameB)
      })
      console.log('✅ 加载静态元数据源成功:', staticSources.value.length)
    } else {
      ElMessage.error(result.msg || '加载静态元数据源失败')
    }
  } catch (error: any) {
    console.error('❌ 加载静态元数据源失败:', error)
    ElMessage.error('数据库字典服务不可用，请检查网络连接和API配置')
  }
}

// 🆕 加载加工数据分类（ClickHouse）
const loadProcessedCategories = async () => {
  try {
    console.log('📋 [加工数据] 开始加载ClickHouse分类...')
    
    // 调用API时传入 datasource: 'clickhouse'
    const result = await window.electronAPI.dbdict.getCategories('clickhouse')
    console.log('✅ [加工数据] ClickHouse分类返回结果:', result)
    
    if (result.code === 200) {
      // 计算总表数
      const allCount = result.data.reduce((sum: number, cat: any) => sum + cat.table_count, 0)
      processedCategories.value = [
        { code: 'all', name: '全部', table_count: allCount },
        ...result.data
      ]
      
      console.log(`✅ [加工数据] 加载ClickHouse分类成功: 总表数 ${allCount}, ${result.data.length} 个分类`)
    } else {
      ElMessage.error(result.msg || '加载ClickHouse分类失败')
    }
  } catch (error: any) {
    console.error('❌ [加工数据] 加载ClickHouse分类失败:', error)
    if (error.message?.includes('403') || error.message?.includes('Permission denied')) {
      ElMessage.error('您没有访问数据加工库的权限，请联系管理员')
    } else {
      ElMessage.error('加载加工数据分类失败')
    }
  }
}

// 🆕 加载加工数据源（ClickHouse）
const loadProcessedSources = async (category?: string) => {
  try {
    const params: any = {
      page: 1,
      size: 1000,  // 加载所有表
      datasource: 'clickhouse'  // 🔑 关键：指定ClickHouse数据源
    }
    
    // 如果指定了分类，则按分类筛选
    if (category && category !== 'all') {
      params.category = category
      console.log('📋 [加工数据] 加载ClickHouse数据，category参数:', category)
    } else {
      console.log('📋 [加工数据] 加载所有ClickHouse表数据')
    }
    
    console.log('🔍 [加工数据] 调用API，参数:', params)
    const result = await window.electronAPI.dbdict.getTables(params)
    console.log('✅ [加工数据] ClickHouse数据源返回结果:', result)
    console.log('📊 [加工数据] 返回表数量:', result.data?.length)
    
    if (result.code === 200) {
      // 按table_name排序
      processedSources.value = (result.data || []).sort((a: any, b: any) => {
        const nameA = a.table_name || ''
        const nameB = b.table_name || ''
        return nameA.localeCompare(nameB)
      })
      console.log('✅ [加工数据] 加载ClickHouse数据源成功:', processedSources.value.length)
    } else {
      ElMessage.error(result.msg || '加载ClickHouse数据源失败')
    }
  } catch (error: any) {
    console.error('❌ [加工数据] 加载ClickHouse数据源失败:', error)
    ElMessage.error('数据库字典服务不可用，请检查网络连接和API配置')
  }
}

// 🆕 加载行情镜像库分类（ClickHouse）
const loadMirrorCategories = async () => {
  try {
    console.log('📋 [行情镜像库] 开始加载ClickHouse分类...')
    
    // 调用API时传入 datasource: 'clickhouse_data'
    const result = await window.electronAPI.dbdict.getCategories('clickhouse_data')
    console.log('✅ [行情镜像库] ClickHouse分类返回结果:', result)
    
    if (result.code === 200) {
      // 计算总表数
      const allCount = result.data.reduce((sum: number, cat: any) => sum + cat.table_count, 0)
      mirrorCategories.value = [
        { code: 'all', name: '全部', table_count: allCount },
        ...result.data
      ]
      
      console.log(`✅ [行情镜像库] 加载ClickHouse分类成功: 总表数 ${allCount}, ${result.data.length} 个分类`)
    } else {
      ElMessage.error(result.msg || '加载行情镜像库分类失败')
    }
  } catch (error: any) {
    console.error('❌ [行情镜像库] 加载ClickHouse分类失败:', error)
    if (error.message?.includes('403') || error.message?.includes('Permission denied')) {
      ElMessage.error('您没有访问行情镜像库的权限，请联系管理员')
    } else {
      ElMessage.error('加载行情镜像库分类失败')
    }
  }
}

// 🆕 加载行情镜像库数据源（ClickHouse）
const loadMirrorSources = async (category?: string) => {
  try {
    const params: any = {
      page: 1,
      size: 1000,  // 加载所有表
      datasource: 'clickhouse_data'  // 🔑 关键：指定行情镜像库数据源
    }
    
    // 如果指定了分类，则按分类筛选
    if (category && category !== 'all') {
      params.category = category
      console.log('📋 [行情镜像库] 加载ClickHouse数据，category参数:', category)
    } else {
      console.log('📋 [行情镜像库] 加载所有ClickHouse表数据')
    }
    
    console.log('🔍 [行情镜像库] 调用API，参数:', params)
    const result = await window.electronAPI.dbdict.getTables(params)
    console.log('✅ [行情镜像库] ClickHouse数据源返回结果:', result)
    console.log('📊 [行情镜像库] 返回表数量:', result.data?.length)
    
    if (result.code === 200) {
      // 按table_name排序
      mirrorSources.value = (result.data || []).sort((a: any, b: any) => {
        const nameA = a.table_name || ''
        const nameB = b.table_name || ''
        return nameA.localeCompare(nameB)
      })
      console.log('✅ [行情镜像库] 加载ClickHouse数据源成功:', mirrorSources.value.length)
    } else {
      ElMessage.error(result.msg || '加载行情镜像库数据源失败')
    }
  } catch (error: any) {
    console.error('❌ [行情镜像库] 加载ClickHouse数据源失败:', error)
    ElMessage.error('数据库字典服务不可用，请检查网络连接和API配置')
  }
}

// 监听数据源权限变更事件
const handleDatasourcePermissionChanged = async (event: any) => {
  const newPermissions = event.detail?.permissions || []
  console.log('📢 收到数据源权限变更通知:', newPermissions)
  
  // 更新权限列表
  userDataSourcePermissions.value = newPermissions
  
  // 根据新权限重新加载数据
  if (newPermissions.includes('redis') && marketSources.value.length === 0) {
    await loadMarketCategories()
    await loadMarketSources()
  }
  
  if (newPermissions.includes('postgresql') && staticSources.value.length === 0) {
    await loadStaticCategories()
    await loadStaticSources()
  }
  
  if (newPermissions.includes('clickhouse') && processedSources.value.length === 0) {
    await loadProcessedCategories()
    await loadProcessedSources()
  }
  
  if (newPermissions.includes('clickhouse_data') && mirrorSources.value.length === 0) {
    await loadMirrorCategories()
    await loadMirrorSources()
  }
}

// 初始化
onMounted(async () => {
  console.log('📊 数据中心组件已挂载')
  
  // 监听数据源权限变更
  window.addEventListener('datasource-permission-changed', handleDatasourcePermissionChanged)
  
  // 先设置API Key
  const hasApiKey = await setupApiKey()
  if (hasApiKey) {
    // 🆕 加载用户数据源权限
    await loadUserDataSourcePermissions()
    
    // 根据权限加载对应的数据
    if (userDataSourcePermissions.value.includes('redis')) {
      await loadMarketCategories()
      await loadMarketSources()
    }
    
    if (userDataSourcePermissions.value.includes('postgresql')) {
      await loadStaticCategories()
      await loadStaticSources()
    }
    
    if (userDataSourcePermissions.value.includes('clickhouse')) {
      await loadProcessedCategories()
      await loadProcessedSources()
    }
    
    if (userDataSourcePermissions.value.includes('clickhouse_data')) {
      await loadMirrorCategories()
      await loadMirrorSources()
    }
  }
})

// 清理
onUnmounted(() => {
  window.removeEventListener('datasource-permission-changed', handleDatasourcePermissionChanged)
})
</script>

<style lang="scss" scoped>
.data-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: #f5f7fa;

  .data-tabs {
    background: white;
    padding: 10px 20px 0;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .tab-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tab-db-name {
      width: 100%;
      font-size: 11px;
      color: #909399;
      font-weight: 400;
      line-height: 1;
      margin-top: -2px;
      margin-bottom: 2px;
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 20px;
    background: white;
    border-bottom: 1px solid #e4e7ed;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .toolbar-left {
      display: flex;
      align-items: center;
      
      .global-search-wrapper {
        position: relative;
      }
    }
  }

  .market-section,
  .category-section {
    background: white;
    padding: 12px 20px;
    border-bottom: 1px solid #e4e7ed;

    .market-tags,
    .category-tags {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;

      .market-tag,
      .category-tag {
        cursor: pointer;
        transition: all 0.3s;
        font-size: 14px;
        padding: 8px 16px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
      }
    }
  }

  .content-layout {
    flex: 1;
    display: flex;
    gap: 15px;
    margin-top: 10px;
    overflow: hidden;
    position: relative;

    .left-panel {
      width: 20%;
      min-width: 250px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transition: all 0.3s;
    }

    .toggle-button {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      width: 36px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 2px 2px 12px rgba(102, 126, 234, 0.4);
      color: white;
      transition: all 0.3s;
      left: calc(20% + 3px);

      &:hover {
        box-shadow: 3px 3px 16px rgba(102, 126, 234, 0.6);
        transform: translateY(-50%) scale(1.1);
      }

      &:active {
        transform: translateY(-50%) scale(0.95);
      }

      &.button-collapsed {
        left: 3px;
      }
    }

    .middle-panel {
      width: 45%;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transition: all 0.3s;

      &.panel-expanded {
        width: 60%;
      }
    }

    .right-panel {
      width: 35%;
      min-width: 300px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
  }
}
</style>

