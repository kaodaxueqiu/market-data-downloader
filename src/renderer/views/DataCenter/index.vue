<template>
  <div class="data-center">
    <!-- 顶部Tab切换 -->
    <el-tabs v-model="activeTab" class="data-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="行情数据" name="market">
        <template #label>
          <span class="tab-label">
            <el-icon><DataLine /></el-icon>
            行情数据 <el-tag size="small" type="primary">{{ marketSourceCount }}</el-tag>
          </span>
        </template>
      </el-tab-pane>
      
      <el-tab-pane label="静态元数据" name="static">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            静态元数据 <el-tag size="small" type="success">{{ staticSourceCount }}</el-tag>
          </span>
        </template>
      </el-tab-pane>
      
      <el-tab-pane label="加工数据" name="processed">
        <template #label>
          <span class="tab-label">
            <el-icon><Operation /></el-icon>
            加工数据 <el-tag size="small" type="warning">{{ processedSourceCount }}</el-tag>
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
          :datasource="activeTab === 'processed' ? 'clickhouse' : undefined"
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataLine, Document, Operation, Search, Refresh, List, DArrowLeft, DArrowRight, Loading } from '@element-plus/icons-vue'
import DataSourceList from './components/DataSourceList.vue'
import MarketDataDetail from './components/MarketDataDetail.vue'
import StaticDataDetail from './components/StaticDataDetail.vue'
import DownloadConfigPanel from './components/DownloadConfigPanel.vue'
import GlobalSearchDropdown from '../../components/GlobalSearchDropdown.vue'

const router = useRouter()

// Tab状态
const activeTab = ref<'market' | 'static' | 'processed'>('market')

// 左侧面板显示状态
const showLeftPanel = ref(true)

// 🆕 全局搜索相关状态
const globalSearchKeyword = ref('')
const searchResults = ref<any>(null)
const searchLoading = ref(false)
const showSearchResults = ref(false)
let searchTimer: NodeJS.Timeout | null = null

// 搜索和筛选
const searchKeyword = ref('')
const marketFilter = ref('')
const categoryFilter = ref('')

// 数据源
const marketSources = ref<any[]>([])
const staticSources = ref<any[]>([])
const processedSources = ref<any[]>([])  // 🆕 加工数据源（ClickHouse）
const selectedSource = ref<any>(null)
const selectedFields = ref<string[]>([])

// 🆕 行情数据市场分类（动态加载）
const marketCategories = ref<any[]>([])
// 静态元数据分类（包含 'all' 分类）
const staticCategories = ref<any[]>([])
// 加工数据分类（包含 'all' 分类）
const processedCategories = ref<any[]>([])

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

// 当前数据源列表
const currentDataSources = computed(() => {
  if (activeTab.value === 'market') {
    return marketSources.value
  } else if (activeTab.value === 'static') {
    return staticSources.value
  } else {
    return processedSources.value  // 加工数据
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
  // 行情数据用 MarketDataDetail，静态元数据和加工数据都用 StaticDataDetail
  return activeTab.value === 'market' ? MarketDataDetail : StaticDataDetail
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
const handleSearchResultSelect = async (result: any, dataType: 'market' | 'static' | 'processed') => {
  console.log('选择搜索结果:', result, dataType)
  
  // 1. 切换到对应的Tab
  activeTab.value = dataType
  
  // 2. 清除筛选条件，确保能看到搜索结果
  marketFilter.value = ''
  categoryFilter.value = ''
  
  // 3. 如果是静态/加工数据，需要重新加载全部表（清除分类筛选）
  if (dataType === 'static') {
    await loadStaticSources() // 加载所有静态数据表
  } else if (dataType === 'processed') {
    await loadProcessedSources() // 加载所有加工数据表
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
    ElMessage.error('加载市场分类失败')
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
    ElMessage.error('加载分类失败')
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
    ElMessage.error('加载加工数据分类失败')
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

// 初始化
onMounted(async () => {
  console.log('📊 数据中心组件已挂载')
  
  // 先设置API Key
  const hasApiKey = await setupApiKey()
  if (hasApiKey) {
    // 🆕 加载行情数据市场分类
    await loadMarketCategories()
    await loadMarketSources()
    await loadStaticCategories()
    await loadStaticSources()
    // 🆕 加载加工数据
    await loadProcessedCategories()
    await loadProcessedSources()
  }
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

