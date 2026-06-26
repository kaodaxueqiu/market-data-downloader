<template>
  <div class="data-center">
    <!-- 顶部：引擎 Tab + 全局搜索 -->
    <div class="data-tabs-bar">
      <el-tabs v-model="activeEngine" class="data-tabs" @tab-change="handleEngineChange">
        <el-tab-pane
          v-for="eng in engines"
          :key="eng.code"
          :name="eng.code"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Coin v-if="eng.code === 'postgresql'" /><DataLine v-else /></el-icon>
              {{ eng.name }}
              <el-tag size="small" :type="eng.code === 'postgresql' ? 'success' : 'warning'">
                {{ eng.databases?.length || 0 }} 库
              </el-tag>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- 全局搜索 -->
      <div class="global-search-wrapper">
        <el-input
          v-model="globalSearchKeyword"
          placeholder="全局搜索表名、字段..."
          clearable
          style="width: 360px"
          @input="handleGlobalSearch"
          @clear="handleSearchClear"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
          <template #suffix v-if="searchLoading">
            <el-icon class="is-loading"><Loading /></el-icon>
          </template>
        </el-input>
        <GlobalSearchDropdown
          :visible="showSearchResults"
          :results="searchResults"
          :loading="searchLoading"
          @select="handleSearchResultSelect"
          @close="showSearchResults = false"
        />
      </div>
    </div>

    <!-- 库选择器 + 刷新 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-label">数据库：</span>
        <el-select
          v-model="activeDatabase"
          placeholder="选择数据库"
          style="width: 200px"
          @change="handleDatabaseChange"
          :loading="enginesLoading"
        >
          <el-option
            v-for="db in currentEngineDatabases"
            :key="db.name"
            :label="db.name"
            :value="db.name"
          />
        </el-select>
        <el-button @click="handleRefresh" style="margin-left: 10px" :loading="tablesLoading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
      <div v-if="activeDatabase" class="toolbar-right">
        <el-tag type="info" size="small">{{ filteredTables.length }} 张表</el-tag>
      </div>
    </div>

    <!-- 分类标签 -->
    <div v-if="activeDatabase && categories.length > 1" class="category-section">
      <div class="category-tags">
        <el-tag
          v-for="cat in categories"
          :key="cat.code"
          :type="cat.code === 'all' ? 'primary' : (activeEngine === 'postgresql' ? 'success' : 'warning')"
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
      <!-- 左侧：表列表 -->
      <div v-if="showLeftPanel" class="left-panel">
        <DataSourceList
          :data-sources="filteredTables"
          :selected-source="selectedTable"
          :engine="activeEngine"
          @select="handleTableSelect"
        />
      </div>

      <!-- 折叠/展开按钮 -->
      <div class="toggle-button" :class="{ 'button-collapsed': !showLeftPanel }" @click="toggleLeftPanel">
        <el-icon><DArrowLeft v-if="showLeftPanel" /><DArrowRight v-else /></el-icon>
      </div>

      <!-- 中间：表结构/字段 -->
      <div class="middle-panel" :class="{ 'panel-expanded': !showLeftPanel }">
        <StaticDataDetail
          :source="selectedTable"
          :engine="activeEngine"
          :database="activeDatabase"
        />
      </div>

      <!-- 右侧：增强预览 -->
      <div class="right-panel">
        <PreviewPanel
          :source="selectedTable"
          :engine="activeEngine"
          :database="activeDatabase"
        />
      </div>
    </div>

    <!-- 空态：未选库 -->
    <div v-if="!enginesLoading && !activeDatabase && engines.length > 0" class="no-db-tip">
      <el-empty description="请先在上方选择数据库" :image-size="100" />
    </div>
    <div v-if="!enginesLoading && engines.length === 0" class="no-db-tip">
      <el-empty description="未找到可访问的数据库，请检查 API Key 是否绑定了数据库账号" :image-size="100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin, DataLine, Search, Refresh, DArrowLeft, DArrowRight, Loading } from '@element-plus/icons-vue'
import DataSourceList from './components/DataSourceList.vue'
import StaticDataDetail from './components/StaticDataDetail.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import GlobalSearchDropdown from '../../components/GlobalSearchDropdown.vue'

// ========== 引擎 & 库 ==========
const enginesLoading = ref(false)
const engines = ref<{ code: string; name: string; databases: { name: string }[] }[]>([])
const activeEngine = ref('postgresql')
const activeDatabase = ref('')

const currentEngineDatabases = computed(() => {
  const eng = engines.value.find(e => e.code === activeEngine.value)
  return eng?.databases || []
})

// ========== 分类 ==========
const categories = ref<{ code: string; name: string; table_count: number }[]>([])
const categoryFilter = ref('')

// ========== 表列表 ==========
const tablesLoading = ref(false)
const tables = ref<any[]>([])
const selectedTable = ref<any>(null)

const filteredTables = computed(() => {
  if (!categoryFilter.value) return tables.value
  return tables.value.filter((t: any) => t.category === categoryFilter.value)
})

// ========== 左侧面板 ==========
const showLeftPanel = ref(true)
const toggleLeftPanel = () => { showLeftPanel.value = !showLeftPanel.value }

// ========== 全局搜索 ==========
const globalSearchKeyword = ref('')
const searchResults = ref<any>(null)
const searchLoading = ref(false)
const showSearchResults = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

// ========== 初始化 ==========
const setupApiKey = async (): Promise<boolean> => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    if (keys.length > 0) {
      const defaultKey = keys.find((k: any) => k.isDefault)
      if (defaultKey) {
        const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
        if (fullKey) {
          await window.electronAPI.dbdict.setApiKey(fullKey)
          return true
        }
      }
    }
    ElMessage.warning('请先在系统设置中配置 API Key')
    return false
  } catch { return false }
}

const loadEngines = async () => {
  enginesLoading.value = true
  try {
    const result = await window.electronAPI.dbdict.getDatasources()
    if (result.code === 200 && result.data?.engines) {
      engines.value = result.data.engines
      // 默认选第一个有库的引擎和第一个库
      if (engines.value.length > 0) {
        activeEngine.value = engines.value[0].code
        const firstDb = engines.value[0].databases?.[0]?.name
        if (firstDb) {
          activeDatabase.value = firstDb
          await loadCategories()
          await loadTables()
        }
      }
    } else {
      ElMessage.error('获取数据库列表失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '获取数据库列表失败')
  } finally {
    enginesLoading.value = false
  }
}

const loadCategories = async () => {
  if (!activeEngine.value || !activeDatabase.value) return
  try {
    const result = await window.electronAPI.dbdict.getCategories(activeEngine.value, activeDatabase.value)
    if (result.code === 200 && Array.isArray(result.data) && result.data.length > 0) {
      const allCount = result.data.reduce((s: number, c: any) => s + c.table_count, 0)
      categories.value = [
        { code: 'all', name: '全部', table_count: allCount },
        ...result.data
      ]
    } else {
      categories.value = []
    }
  } catch {
    categories.value = []
  }
}

const loadTables = async (category?: string) => {
  if (!activeEngine.value || !activeDatabase.value) return
  tablesLoading.value = true
  try {
    const params: any = { page: 1, size: 2000 }
    if (category) params.category = category
    const result = await window.electronAPI.dbdict.getTables(activeEngine.value, activeDatabase.value, params)
    if (result.code === 200) {
      tables.value = (result.data || []).sort((a: any, b: any) =>
        (a.table_name || '').localeCompare(b.table_name || '')
      )
    } else {
      ElMessage.error(result.msg || '加载表列表失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载表列表失败')
  } finally {
    tablesLoading.value = false
  }
}

// ========== 事件处理 ==========
const handleEngineChange = async (engine: string) => {
  activeEngine.value = engine
  activeDatabase.value = ''
  categories.value = []
  categoryFilter.value = ''
  tables.value = []
  selectedTable.value = null
  // 自动选第一个库
  const eng = engines.value.find(e => e.code === engine)
  const firstDb = eng?.databases?.[0]?.name
  if (firstDb) {
    activeDatabase.value = firstDb
    await loadCategories()
    await loadTables()
  }
}

const handleDatabaseChange = async () => {
  categories.value = []
  categoryFilter.value = ''
  tables.value = []
  selectedTable.value = null
  await loadCategories()
  await loadTables()
}

const selectCategory = async (category: string) => {
  categoryFilter.value = category
  selectedTable.value = null
  await loadTables(category || undefined)
}

const handleRefresh = async () => {
  selectedTable.value = null
  await loadCategories()
  await loadTables(categoryFilter.value || undefined)
  ElMessage.success('刷新成功')
}

const handleTableSelect = (table: any) => {
  selectedTable.value = table
}

// ========== 全局搜索 ==========
const handleGlobalSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  const keyword = globalSearchKeyword.value.trim()
  if (!keyword || keyword.length < 2) {
    showSearchResults.value = false
    searchResults.value = null
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    showSearchResults.value = true
    try {
      const result = await window.electronAPI.search.global(keyword, 20)
      searchResults.value = result
    } catch (e: any) {
      ElMessage.error(e.message || '搜索失败')
      showSearchResults.value = false
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

const handleSearchClear = () => {
  showSearchResults.value = false
  searchResults.value = null
}

// 搜索结果跳转：engine+database+table 状态驱动
const handleSearchResultSelect = async (result: any, engineCode: string, database: string) => {
  showSearchResults.value = false
  globalSearchKeyword.value = ''
  searchResults.value = null

  // 切换到对应引擎
  if (activeEngine.value !== engineCode) {
    activeEngine.value = engineCode
    categories.value = []
    categoryFilter.value = ''
    tables.value = []
    selectedTable.value = null
  }

  // 切换到对应库
  if (activeDatabase.value !== database) {
    activeDatabase.value = database
    await loadCategories()
    await loadTables()
  }

  // 选中对应表
  await new Promise(r => setTimeout(r, 100))
  const table = tables.value.find((t: any) => t.table_name === result.table_name)
  if (table) {
    selectedTable.value = table
  } else {
    ElMessage.warning(`未找到表 ${result.table_name}`)
  }
}

onMounted(async () => {
  const hasKey = await setupApiKey()
  if (hasKey) await loadEngines()
})
</script>

<style lang="scss" scoped>
.data-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #f5f7fa;
  overflow: hidden;
}

.data-tabs-bar {
  display: flex;
  align-items: center;
  background: white;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  flex-shrink: 0;

  .data-tabs {
    flex: 1;
    :deep(.el-tabs__header) { margin: 0; }
    :deep(.el-tabs__nav-wrap::after) { display: none; }
  }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .global-search-wrapper {
    position: relative;
    padding: 8px 0;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .toolbar-left {
    display: flex;
    align-items: center;
    .toolbar-label {
      font-size: 13px;
      color: #606266;
      margin-right: 8px;
    }
  }
}

.category-section {
  background: white;
  padding: 10px 20px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .category-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .category-tag {
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
      &:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
    }
  }
}

.content-layout {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
  position: relative;

  .left-panel {
    width: 20%;
    min-width: 240px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
    transition: all 0.3s;
  }

  .toggle-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 32px;
    height: 44px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 2px 2px 10px rgba(102,126,234,0.4);
    color: white;
    transition: all 0.3s;
    left: calc(20% + 15px);

    &:hover { box-shadow: 3px 3px 14px rgba(102,126,234,0.6); transform: translateY(-50%) scale(1.1); }
    &.button-collapsed { left: 15px; }
  }

  .middle-panel {
    width: 40%;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
    transition: all 0.3s;
    &.panel-expanded { width: 55%; }
  }

  .right-panel {
    flex: 1;
    min-width: 280px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
  }
}

.no-db-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
