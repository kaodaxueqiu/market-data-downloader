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
      
      <el-tab-pane label="静态数据" name="static">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            静态数据 <el-tag size="small" type="success">{{ staticSourceCount }}</el-tag>
          </span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索数据源..."
          clearable
          style="width: 300px"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

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

    <!-- 市场分类标签（行情数据） -->
    <div v-if="activeTab === 'market'" class="market-section">
      <div class="market-tags">
        <el-tag
          type="primary"
          :effect="marketFilter === '' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('')"
        >
          全部 ({{ marketSources.length }})
        </el-tag>
        <el-tag
          type="primary"
          :effect="marketFilter === '深圳市场' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('深圳市场')"
        >
          深圳市场 ({{ getMarketCount('深圳市场') }})
        </el-tag>
        <el-tag
          type="success"
          :effect="marketFilter === '上海市场' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('上海市场')"
        >
          上海市场 ({{ getMarketCount('上海市场') }})
        </el-tag>
        <el-tag
          type="warning"
          :effect="marketFilter === '期货市场' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('期货市场')"
        >
          期货市场 ({{ getMarketCount('期货市场') }})
        </el-tag>
        <el-tag
          type="danger"
          :effect="marketFilter === '期权市场' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('期权市场')"
        >
          期权市场 ({{ getMarketCount('期权市场') }})
        </el-tag>
        <el-tag
          type="info"
          :effect="marketFilter === '陆港通' ? 'dark' : 'plain'"
          size="large"
          class="market-tag"
          @click="selectMarket('陆港通')"
        >
          陆港通 ({{ getMarketCount('陆港通') }})
        </el-tag>
      </div>
    </div>

    <!-- 分类标签（静态数据） -->
    <div v-if="activeTab === 'static'" class="category-section">
      <div class="category-tags">
        <el-tag
          type="primary"
          :effect="categoryFilter === '' ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory('')"
        >
          全部 ({{ staticSources.length }})
        </el-tag>
        <el-tag
          v-for="cat in categories"
          :key="cat"
          type="success"
          :effect="categoryFilter === cat ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat)"
        >
          {{ cat }} ({{ getCategoryCount(cat) }})
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
import { DataLine, Document, Search, Refresh, List, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import DataSourceList from './components/DataSourceList.vue'
import MarketDataDetail from './components/MarketDataDetail.vue'
import StaticDataDetail from './components/StaticDataDetail.vue'
import DownloadConfigPanel from './components/DownloadConfigPanel.vue'

const router = useRouter()

// Tab状态
const activeTab = ref<'market' | 'static'>('market')

// 左侧面板显示状态
const showLeftPanel = ref(true)

// 搜索和筛选
const searchKeyword = ref('')
const marketFilter = ref('')
const categoryFilter = ref('')
const categories = ref<string[]>([])

// 数据源
const marketSources = ref<any[]>([])
const staticSources = ref<any[]>([])
const selectedSource = ref<any>(null)
const selectedFields = ref<string[]>([])

// 数据源数量
const marketSourceCount = computed(() => marketSources.value.length)
const staticSourceCount = computed(() => staticSources.value.length)

// 当前数据源列表
const currentDataSources = computed(() => {
  return activeTab.value === 'market' ? marketSources.value : staticSources.value
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
  if (activeTab.value === 'market' && marketFilter.value) {
    sources = sources.filter((source: any) => 
      source.market === marketFilter.value
    )
  }

  // 分类过滤（静态数据）
  if (activeTab.value === 'static' && categoryFilter.value) {
    sources = sources.filter((source: any) => 
      source.category === categoryFilter.value
    )
  }

  return sources
})

// 详情组件
const detailComponent = computed(() => {
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

// 搜索
const handleSearch = () => {
  console.log('搜索:', searchKeyword.value)
}

// 选择市场
const selectMarket = (market: string) => {
  marketFilter.value = market
  searchKeyword.value = ''
  console.log('选择市场:', market)
}

// 获取市场数量
const getMarketCount = (market: string) => {
  return marketSources.value.filter((s: any) => s.market === market).length
}

// 选择分类
const selectCategory = (category: string) => {
  categoryFilter.value = category
  searchKeyword.value = ''
  console.log('选择分类:', category)
}

// 获取分类数量
const getCategoryCount = (category: string) => {
  return staticSources.value.filter((s: any) => s.category === category).length
}

// 刷新
const handleRefresh = async () => {
  if (activeTab.value === 'market') {
    await loadMarketSources()
  } else {
    await loadStaticSources()
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

// 加载静态数据源
const loadStaticSources = async () => {
  try {
    const result = await window.electronAPI.dbdict.getTables({
      page: 1,
      size: 1000  // 加载所有表
    })
    console.log('静态数据源返回结果:', result)
    if (result.code === 200) {
      // 按table_name排序
      staticSources.value = (result.data || []).sort((a: any, b: any) => {
        const nameA = a.table_name || ''
        const nameB = b.table_name || ''
        return nameA.localeCompare(nameB)
      })
      console.log('✅ 加载静态数据源成功:', staticSources.value.length)
      
      // 提取分类并排序
      const cats = new Set(staticSources.value.map((s: any) => s.category).filter(Boolean))
      categories.value = Array.from(cats).sort()
    } else {
      ElMessage.error(result.msg || '加载静态数据源失败')
    }
  } catch (error: any) {
    console.error('❌ 加载静态数据源失败:', error)
    ElMessage.error('数据库字典服务不可用，请检查网络连接和API配置')
  }
}

// 初始化
onMounted(async () => {
  console.log('📊 数据中心组件已挂载')
  
  // 先设置API Key
  const hasApiKey = await setupApiKey()
  if (hasApiKey) {
    await loadMarketSources()
    await loadStaticSources()
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

