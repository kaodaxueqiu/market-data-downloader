<template>
  <div class="data-center">
    <!-- 顶部：引擎 Tab + 全局搜索 -->
    <div class="data-tabs-bar">
      <el-tabs v-model="activeEngine" class="data-tabs" @tab-change="handleEngineChange">
        <el-tab-pane v-for="eng in engines" :key="eng.code" :name="eng.code">
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

    <!-- 分类标签（后端返回真实分类才显示） -->
    <div v-if="activeDatabase && categories.length > 1" class="category-section">
      <div class="category-tags">
        <el-tag
          v-for="cat in categories"
          :key="cat.code"
          :type="cat.code === 'all' ? 'primary' : (activeEngine === 'postgresql' ? 'success' : 'warning')"
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
      <!-- 左侧：库列表 -->
      <div class="db-panel">
        <div class="db-panel-header">
          <span>数据库</span>
          <el-button link size="small" :loading="tablesLoading" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <el-scrollbar>
          <div
            v-for="db in currentEngineDatabases"
            :key="db.name"
            class="db-item"
            :class="{ active: activeDatabase === db.name }"
            @click="selectDatabase(db.name)"
          >
            <el-icon class="db-icon"><FolderOpened /></el-icon>
            <span class="db-name">{{ db.name }}</span>
            <span v-if="db.table_count !== undefined" class="db-count">{{ db.table_count }}</span>
          </div>
          <el-empty v-if="!currentEngineDatabases.length" :image-size="50" description="暂无数据库" />
        </el-scrollbar>

      </div>

      <!-- 中间：表列表 -->
      <div class="table-panel">
        <DataSourceList
          :data-sources="filteredTables"
          :selected-source="selectedTable"
          :engine="activeEngine"
          @select="handleTableSelect"
        />
      </div>

      <!-- 右侧：字段详情 -->
      <div class="detail-panel">
        <StaticDataDetail
          :source="selectedTable"
          :engine="activeEngine"
          :database="activeDatabase"
          @preview="showPreview = true"
        />
      </div>
    </div>

    <!-- 数据预览弹窗 -->
    <el-dialog
      v-model="showPreview"
      :title="`数据预览 — ${selectedTable?.table_comment || selectedTable?.table_name || ''}`"
      width="90%"
      top="4vh"
      destroy-on-close
    >
      <PreviewPanel
        v-if="showPreview"
        :source="selectedTable"
        :engine="activeEngine"
        :database="activeDatabase"
        inline
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin, DataLine, Search, Refresh, Loading, FolderOpened } from '@element-plus/icons-vue'
import DataSourceList from './components/DataSourceList.vue'
import StaticDataDetail from './components/StaticDataDetail.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import GlobalSearchDropdown from '../../components/GlobalSearchDropdown.vue'

const enginesLoading = ref(false)
const engines = ref<{ code: string; name: string; databases: { name: string }[] }[]>([])
const activeEngine = ref('postgresql')
const activeDatabase = ref('')
const showPreview = ref(false)

const currentEngineDatabases = computed(() => {
  const eng = engines.value.find(e => e.code === activeEngine.value)
  return eng?.databases || []
})

const categoryFilter = ref('')

// 从表数据推导分类，不依赖后端 getCategories（后端未改造前的可靠兜底）
const categories = computed(() => {
  if (!tables.value.length) return []
  const catMap = new Map<string, number>()
  for (const t of tables.value) {
    const cat = t.category || t.category_name
    if (cat) catMap.set(cat, (catMap.get(cat) || 0) + 1)
  }
  if (catMap.size < 2) return []   // 只有 0 或 1 个分类，无需展示
  const items = Array.from(catMap.entries())
    .map(([name, count]) => ({ code: name, name, table_count: count }))
    .sort((a, b) => b.table_count - a.table_count)
  return [
    { code: 'all', name: '全部', table_count: tables.value.length },
    ...items
  ]
})
const tablesLoading = ref(false)
const tables = ref<any[]>([])
const selectedTable = ref<any>(null)

const filteredTables = computed(() => {
  if (!categoryFilter.value) return tables.value
  return tables.value.filter((t: any) =>
    t.category === categoryFilter.value || t.category_name === categoryFilter.value
  )
})


const globalSearchKeyword = ref('')
const searchResults = ref<any>(null)
const searchLoading = ref(false)
const showSearchResults = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

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
  } catch { categories.value = [] }
}

const loadTables = async () => {
  if (!activeEngine.value || !activeDatabase.value) return
  tablesLoading.value = true
  try {
    const result = await window.electronAPI.dbdict.getTables(activeEngine.value, activeDatabase.value, { page: 1, size: 2000 })
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

const handleEngineChange = async (engine: string) => {
  activeEngine.value = engine
  activeDatabase.value = ''
  categories.value = []
  categoryFilter.value = ''
  tables.value = []
  selectedTable.value = null
  showPreview.value = false
  const eng = engines.value.find(e => e.code === engine)
  const firstDb = eng?.databases?.[0]?.name
  if (firstDb) {
    activeDatabase.value = firstDb
    await loadCategories()
    await loadTables()
  }
}

const selectDatabase = async (dbName: string) => {
  if (activeDatabase.value === dbName) return
  activeDatabase.value = dbName
  categories.value = []
  categoryFilter.value = ''
  tables.value = []
  selectedTable.value = null
  showPreview.value = false
  await loadCategories()
  await loadTables()
}

const selectCategory = (category: string) => {
  categoryFilter.value = category
  selectedTable.value = null
  showPreview.value = false
}

const handleRefresh = async () => {
  selectedTable.value = null
  showPreview.value = false
  await loadCategories()
  await loadTables()
  ElMessage.success('刷新成功')
}

const handleTableSelect = (table: any) => {
  selectedTable.value = table
  showPreview.value = false
}

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

const handleSearchResultSelect = async (result: any, engineCode: string, database: string) => {
  showSearchResults.value = false
  globalSearchKeyword.value = ''
  searchResults.value = null
  if (activeEngine.value !== engineCode) {
    activeEngine.value = engineCode
    categories.value = []
    categoryFilter.value = ''
    tables.value = []
    selectedTable.value = null
  }
  if (activeDatabase.value !== database) {
    activeDatabase.value = database
    await loadCategories()
    await loadTables()
  }
  await new Promise(r => setTimeout(r, 100))
  const table = tables.value.find((t: any) => t.table_name === result.table_name)
  if (table) selectedTable.value = table
  else ElMessage.warning(`未找到表 ${result.table_name}`)
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

  .tab-label { display: flex; align-items: center; gap: 6px; }

  .global-search-wrapper {
    position: relative;
    padding: 8px 0;
  }
}

.content-layout {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
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

/* 左侧库面板 */
.db-panel {
  flex: 0.6;
  min-width: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .db-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 8px;
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  .el-scrollbar { flex: 1; min-height: 0; }

  .db-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 14px;
    cursor: pointer;
    font-size: 13px;
    color: #606266;
    transition: background 0.15s;
    border-left: 3px solid transparent;

    &:hover { background: #f5f7fa; }

    &.active {
      background: #ecf5ff;
      border-left-color: #409eff;
      color: #409eff;
      font-weight: 600;
    }

    .db-icon { font-size: 14px; flex-shrink: 0; }
    .db-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .db-count {
      flex-shrink: 0;
      font-size: 11px;
      color: #409eff;
      font-variant-numeric: tabular-nums;
      opacity: 0.7;
    }
  }

}

/* 中间表列表 */
.table-panel {
  flex: 1;
  min-width: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  overflow: hidden;
}

/* 右侧字段详情 */
.detail-panel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  overflow: hidden;
}
</style>
