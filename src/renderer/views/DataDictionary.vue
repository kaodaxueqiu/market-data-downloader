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
      <!-- 市场分类标签 -->
      <div class="market-section">
        <div class="market-header">
          <span>市场分类</span>
          <span class="total-count">共 {{ totalSources }} 个数据源</span>
        </div>
        <div class="market-tags">
          <el-tag
            type="primary"
            :effect="activeMarket === 'all' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('all')"
          >
            全部 ({{ totalSources }})
          </el-tag>
          <el-tag
            type="primary"
            :effect="activeMarket === '深圳市场' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('深圳市场')"
          >
            深圳市场 ({{ getMarketCount('深圳市场') }})
          </el-tag>
          <el-tag
            type="success"
            :effect="activeMarket === '上海市场' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('上海市场')"
          >
            上海市场 ({{ getMarketCount('上海市场') }})
          </el-tag>
          <el-tag
            type="warning"
            :effect="activeMarket === '期货市场' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('期货市场')"
          >
            期货市场 ({{ getMarketCount('期货市场') }})
          </el-tag>
          <el-tag
            type="danger"
            :effect="activeMarket === '期权市场' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('期权市场')"
          >
            期权市场 ({{ getMarketCount('期权市场') }})
          </el-tag>
          <el-tag
            type=""
            :effect="activeMarket === '陆港通' ? 'dark' : 'plain'"
            size="large"
            class="market-tag"
            @click="selectMarket('陆港通')"
          >
            陆港通 ({{ getMarketCount('陆港通') }})
          </el-tag>
        </div>
      </div>

      <!-- 数据源卡片列表 -->
      <div v-loading="loading" class="source-list">
        <div class="source-grid">
          <el-card 
            v-for="source in displayedSources" 
            :key="source.code"
            class="source-card" 
            :class="{ active: selectedSource?.code === source.code }"
            @click="selectSource(source)"
          >
            <div class="source-header">
              <el-tag size="small" :type="getMarketColorClass(source.market)" class="source-code-tag">
                {{ source.code }}
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
        </div>

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

// 获取市场颜色类名
const getMarketColorClass = (market: string) => {
  const colorMap: Record<string, string> = {
    '深圳市场': 'primary',
    '上海市场': 'success',
    '期货市场': 'warning',
    '期权市场': 'danger',
    '陆港通': 'info'
  }
  return colorMap[market] || 'primary'
}

// 获取数据类型标签类型（预留，暂未使用）
// const getDataTypeTagType = (dataType: string) => {
//   const typeMap: Record<string, any> = {
//     '快照': 'success',      // 绿色
//     '逐笔': 'warning',      // 橙色
//     '统计': 'danger',       // 红色
//     '静态': 'primary',      // 蓝色
//     '委托': 'warning',      // 橙色
//     '成交': 'success',      // 绿色
//     '行情': 'primary',      // 蓝色
//     '指数': 'danger',       // 红色
//     '债券': '',             // 灰色
//     '基金': 'success',      // 绿色
//     '期权': 'warning'       // 橙色
//   }
//   return typeMap[dataType] || 'info'
// }

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

// 选择市场标签
const selectMarket = (market: string) => {
  activeMarket.value = market
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

    .market-section {
      margin-bottom: 30px;
      
      .market-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        font-size: 16px;
        font-weight: 500;
        
        .total-count {
          color: #909399;
          font-size: 14px;
        }
      }
      
      .market-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        
        .market-tag {
          cursor: pointer;
          padding: 8px 16px;
          transition: all 0.3s;
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }

    .source-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px 0;
      
      .source-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 20px;
      }
    }

    .source-card {
      cursor: pointer !important;
      height: 100%;
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      border-radius: 16px;
      border: 1px solid #f0f0f0;
      background: #ffffff;
      overflow: hidden;
      
      :deep(.el-card__body) {
        padding: 24px;
      }
      
      &:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
        border-color: rgba(64, 158, 255, 0.3);
        
        .source-code {
          transform: scale(1.05);
        }
      }
      
      &.active {
        border-color: #409eff;
        box-shadow: 0 8px 24px rgba(64, 158, 255, 0.2);
        background: linear-gradient(135deg, #f6f9ff 0%, #ffffff 100%);
      }
      
      // 强制所有子元素也显示pointer
      * {
        cursor: pointer !important;
      }

      .source-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;

        .source-code-tag {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: -0.3px;
          border-radius: 8px;
          padding: 4px 12px;
        }
        
        .el-tag {
          border-radius: 8px;
          font-weight: 500;
          font-size: 11px;
        }
      }

      .source-name {
        font-size: 14px;
        font-weight: 500;
        color: #1d1d1f;
        margin-bottom: 10px;
        line-height: 1.4;
      }

      .source-info {
        font-size: 12px;
        color: #86868b;
        margin-bottom: 14px;
        font-weight: 400;

        .separator {
          margin: 0 6px;
          color: #d2d2d7;
        }
      }

      .source-stats {
        display: flex;
        gap: 8px;
        
        .el-tag {
          border-radius: 10px;
          font-weight: 500;
          padding: 4px 12px;
        }
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
