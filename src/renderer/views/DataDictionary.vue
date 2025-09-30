<template>
  <div class="data-dictionary-page">
    <div class="header">
      <div class="title-section">
        <h2>数据字典</h2>
        <p class="subtitle">查看所有可用数据类型的字段说明</p>
      </div>
      
      <!-- 搜索框 -->
      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索数据源..."
          clearable
          @input="handleSearch"
          style="width: 300px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 数据源列表 -->
    <div class="data-sources">
      <!-- 市场分类标签页 -->
      <el-tabs v-model="activeMarket" @tab-click="handleMarketChange">
        <el-tab-pane label="全部" name="all">
          <div class="source-count">共 {{ totalSources }} 个数据源</div>
        </el-tab-pane>
        <el-tab-pane label="深圳市场" name="深圳市场">
          <div class="source-count">共 {{ getMarketCount('深圳市场') }} 个数据源</div>
        </el-tab-pane>
        <el-tab-pane label="上海市场" name="上海市场">
          <div class="source-count">共 {{ getMarketCount('上海市场') }} 个数据源</div>
        </el-tab-pane>
        <el-tab-pane label="期货市场" name="期货市场">
          <div class="source-count">共 {{ getMarketCount('期货市场') }} 个数据源</div>
        </el-tab-pane>
        <el-tab-pane label="期权市场" name="期权市场">
          <div class="source-count">共 {{ getMarketCount('期权市场') }} 个数据源</div>
        </el-tab-pane>
        <el-tab-pane label="陆港通" name="陆港通">
          <div class="source-count">共 {{ getMarketCount('陆港通') }} 个数据源</div>
        </el-tab-pane>
      </el-tabs>

      <!-- 数据源卡片列表 -->
      <div v-loading="loading" class="source-list">
        <el-row :gutter="20">
          <el-col 
            v-for="source in displayedSources" 
            :key="source.code"
            :xs="24" :sm="12" :md="8" :lg="6"
          >
            <el-card 
              class="source-card" 
              :class="{ active: selectedSource?.code === source.code }"
              @click="selectSource(source)"
            >
              <div class="source-header">
                <div class="source-code">{{ source.code }}</div>
                <el-tag size="small" :type="getDataTypeTagType(source.data_type)">
                  {{ source.data_type }}
                </el-tag>
              </div>
              <div class="source-name">{{ source.name }}</div>
              <div class="source-info">
                <span>{{ source.exchange || source.market }}</span>
                <span class="separator">|</span>
                <span>{{ source.update_frequency }}</span>
              </div>
              <div class="source-stats">
                <el-tag type="info" size="small">字段: {{ source.field_count }}</el-tag>
                <el-tag type="success" size="small">启用: {{ source.enabled_count }}</el-tag>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 空状态 -->
        <el-empty v-if="!loading && displayedSources.length === 0" description="未找到数据源" />
      </div>
    </div>

    <!-- 数据源详情弹窗 -->
    <el-dialog
      v-model="showDetails"
      :title="selectedSource?.name || '数据源详情'"
      width="90%"
      top="5vh"
      class="detail-dialog"
      destroy-on-close
    >
      <DataDictionaryDetail
        v-if="selectedSource"
        :source="selectedSource"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import DataDictionaryDetail from '../components/DataDictionaryDetail.vue'

// 数据源接口
interface DataSource {
  code: string
  name: string
  market: string
  exchange: string
  data_type: string
  update_frequency: string
  redis_port: number
  raw_db: number
  decoded_db: number
  field_count: number
  enabled_count: number
}

// 状态
const loading = ref(false)
const activeMarket = ref('all')
const searchKeyword = ref('')
const selectedSource = ref<DataSource | null>(null)
const showDetails = ref(false)

// 数据
const allSources = ref<DataSource[]>([])

// 计算属性
const totalSources = computed(() => allSources.value.length)

const displayedSources = computed(() => {
  let sources = [...allSources.value]
  
  // 市场筛选
  if (activeMarket.value !== 'all') {
    sources = sources.filter(s => s.market === activeMarket.value)
  }
  
  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    sources = sources.filter(s => 
      s.code.toLowerCase().includes(keyword) ||
      s.name.toLowerCase().includes(keyword) ||
      s.market.toLowerCase().includes(keyword)
    )
  }
  
  return sources
})

// 获取市场数据源数量
const getMarketCount = (market: string) => {
  return allSources.value.filter(s => s.market === market).length
}

// 获取数据类型标签类型
const getDataTypeTagType = (dataType: string) => {
  const typeMap: Record<string, any> = {
    '快照': 'success',
    '逐笔': 'warning',
    '统计': 'info',
    '静态': 'primary'
  }
  return typeMap[dataType] || 'info'
}

// 加载数据源列表
const loadDataSources = async () => {
  loading.value = true
  try {
    // 先获取API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      ElMessage.error('请先在系统设置中配置API Key')
      return
    }
    
    // 获取完整的未加密API Key
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    
    if (!fullApiKey) {
      ElMessage.error('无法获取完整的API Key，请重新配置')
      return
    }
    
    // 设置API Key
    await window.electronAPI.dictionary.setApiKey(fullApiKey)
    
    // 获取数据源列表
    const result = await window.electronAPI.dictionary.getSources()
    if (result.code === 200) {
      allSources.value = result.data
      console.log(`加载了 ${result.total} 个数据源`)
    }
  } catch (error: any) {
    console.error('加载数据源失败:', error)
    ElMessage.error('数据字典服务不可用，请检查网络连接和API配置')
  } finally {
    loading.value = false
  }
}

// 选择数据源
const selectSource = async (source: DataSource) => {
  selectedSource.value = source
  showDetails.value = true
}

// 处理市场切换
const handleMarketChange = () => {
  // 市场切换时重置搜索
  searchKeyword.value = ''
}

// 处理搜索
const handleSearch = async () => {
  if (!searchKeyword.value) {
    return
  }
  
  // 可以调用搜索API
  try {
    const result = await window.electronAPI.dictionary.search(searchKeyword.value)
    if (result.code === 200) {
      console.log(`搜索到 ${result.total} 个数据源`)
    }
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

// 初始化
onMounted(() => {
  loadDataSources()
})
</script>

<style scoped lang="scss">
.data-dictionary-page {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .title-section {
      h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
      }
      
      .subtitle {
        margin-top: 8px;
        color: #909399;
        font-size: 14px;
      }
    }
  }

  .data-sources {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .source-count {
      padding: 10px 0;
      color: #606266;
      font-size: 14px;
    }

    .source-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px 0;
    }

    .source-card {
      cursor: pointer;
      margin-bottom: 20px;
      transition: all 0.3s;
      
      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }
      
      &.active {
        border-color: #409eff;
      }

      .source-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .source-code {
          font-weight: bold;
          font-size: 16px;
          color: #409eff;
        }
      }

      .source-name {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .source-info {
        font-size: 12px;
        color: #909399;
        margin-bottom: 10px;

        .separator {
          margin: 0 5px;
        }
      }

      .source-stats {
        display: flex;
        gap: 8px;
      }
    }
  }
}

.detail-dialog {
  :deep(.el-dialog__body) {
    max-height: 80vh;
    overflow-y: auto;
  }
}
</style>
