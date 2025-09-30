<template>
  <div class="home-page">
    <!-- 欢迎卡片 -->
    <el-card class="welcome-card">
      <div class="welcome-content">
        <div class="welcome-text">
          <h1>欢迎使用市场数据下载工具</h1>
          <p>专业的金融市场数据获取解决方案，支持53种消息类型，覆盖股票、期货、期权、港股通全市场</p>
          <div class="quick-actions">
            <el-button type="primary" size="large" @click="goToDownload">
              <el-icon><Download /></el-icon>
              开始下载
            </el-button>
            <el-button size="large" @click="goToSettings">
              <el-icon><Setting /></el-icon>
              系统设置
            </el-button>
          </div>
        </div>
        <div class="welcome-icon">
          <el-icon :size="120" color="#409EFF"><DataAnalysis /></el-icon>
        </div>
      </div>
    </el-card>
    
    <!-- 统计信息 -->
    <div class="stats-grid">
      <el-card v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-content">
          <el-icon :size="32" :color="stat.color">
            <component :is="stat.icon" />
          </el-icon>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- 市场覆盖 -->
    <el-card class="markets-card">
      <template #header>
        <span>支持的市场类型</span>
      </template>
      
      <div class="markets-grid">
        <div v-for="market in markets" :key="market.name" class="market-item">
          <div class="market-icon">
            <el-icon :size="40" :color="market.color">
              <component :is="market.icon" />
            </el-icon>
          </div>
          <div class="market-info">
            <div class="market-name">{{ market.name }}</div>
            <div class="market-count">{{ market.count }}种消息类型</div>
            <div class="market-types">
              <el-tag
                v-for="type in market.types.slice(0, 3)"
                :key="type"
                size="small"
                type="info"
              >
                {{ type }}
              </el-tag>
              <el-tag v-if="market.types.length > 3" size="small" type="info">
                +{{ market.types.length - 3 }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 最近下载 -->
    <el-card class="recent-card">
      <template #header>
        <div class="card-header">
          <span>最近下载记录</span>
          <el-button link type="primary" @click="goToHistory">
            查看全部
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </template>
      
      <el-table
        :data="recentDownloads"
        style="width: 100%"
        empty-text="暂无下载记录"
      >
        <el-table-column prop="messageType" label="消息类型" width="120" />
        <el-table-column prop="dateRange" label="日期范围" width="200" />
        <el-table-column prop="format" label="格式" width="80">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.format?.toUpperCase() || 'CSV' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录数" width="100" />
        <el-table-column prop="fileSize" label="文件大小" width="100">
          <template #default="scope">
            {{ formatFileSize(scope.row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="100">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed'"
              link
              type="primary"
              @click="openFile(scope.row.savePath)"
            >
              打开文件
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Download,
  Setting,
  DataAnalysis,
  ArrowRight,
  Files,
  // Clock,
  CircleCheck,
  TrendCharts,
  Coin,
  DataLine,
  Connection
} from '@element-plus/icons-vue'

const router = useRouter()

const stats = ref([
  { label: '支持消息类型', value: 53, icon: Files, color: '#409EFF' },
  { label: '今日下载', value: 0, icon: Download, color: '#67C23A' },
  { label: '总下载次数', value: 0, icon: CircleCheck, color: '#E6A23C' },
  { label: '总数据量', value: '0 GB', icon: DataAnalysis, color: '#F56C6C' }
])

const markets = ref([
  {
    name: '深圳市场',
    count: 14,
    color: '#409EFF',
    icon: TrendCharts,
    types: ['股票快照', '指数行情', '逐笔成交', '债券行情', 'ETF申赎']
  },
  {
    name: '上海市场',
    count: 9,
    color: '#67C23A',
    icon: DataLine,
    types: ['股票快照', '指数行情', '债券快照', '盘后交易']
  },
  {
    name: '期货市场',
    count: 13,
    color: '#E6A23C',
    icon: Coin,
    types: ['中金所', '上期所', '郑商所', '大商所', '广期所', '能源所']
  },
  {
    name: '期权市场',
    count: 13,
    color: '#F56C6C',
    icon: DataAnalysis,
    types: ['股票期权', '商品期权', '股指期权', '成交统计']
  },
  {
    name: '陆港通市场',
    count: 4,
    color: '#909399',
    icon: Connection,
    types: ['资金流向', '北向额度', '南向额度']
  }
])

const recentDownloads = ref<any[]>([])

const goToDownload = () => {
  router.push('/download')
}

const goToSettings = () => {
  router.push('/settings')
}

const goToHistory = () => {
  router.push('/history')
}

const openFile = async (filePath: string) => {
  if (filePath) {
    await window.electronAPI.shell.showItemInFolder(filePath)
  }
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const loadRecentDownloads = async () => {
  try {
    const history = await window.electronAPI.download.getHistory()
    recentDownloads.value = history.slice(0, 5)
    
    // 更新统计
    stats.value[2].value = history.length
    
    const today = new Date().toISOString().slice(0, 10)
    const todayDownloads = history.filter((h: any) => 
      h.startTime && h.startTime.startsWith(today)
    )
    stats.value[1].value = todayDownloads.length
    
    const totalSize = history.reduce((sum: number, h: any) => sum + (h.fileSize || 0), 0)
    stats.value[3].value = formatFileSize(totalSize)
  } catch (error) {
    console.error('加载下载历史失败:', error)
  }
}

onMounted(() => {
  loadRecentDownloads()
})
</script>

<style lang="scss" scoped>
.home-page {
  .welcome-card {
    margin-bottom: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    .welcome-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      
      .welcome-text {
        flex: 1;
        
        h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        
        p {
          margin: 0 0 20px 0;
          opacity: 0.9;
        }
        
        .quick-actions {
          display: flex;
          gap: 15px;
        }
      }
      
      .welcome-icon {
        padding: 0 40px;
        
        :deep(.el-icon) {
          color: rgba(255, 255, 255, 0.8) !important;
        }
      }
    }
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
    
    .stat-card {
      .stat-content {
        display: flex;
        align-items: center;
        gap: 15px;
        
        .stat-info {
          flex: 1;
          
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #303133;
          }
          
          .stat-label {
            font-size: 14px;
            color: #909399;
            margin-top: 5px;
          }
        }
      }
    }
  }
  
  .markets-card {
    margin-bottom: 20px;
    
    .markets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      
      .market-item {
        display: flex;
        gap: 15px;
        padding: 15px;
        border-radius: 8px;
        background: #f5f7fa;
        
        .market-info {
          flex: 1;
          
          .market-name {
            font-size: 16px;
            font-weight: bold;
            color: #303133;
            margin-bottom: 5px;
          }
          
          .market-count {
            font-size: 14px;
            color: #606266;
            margin-bottom: 10px;
          }
          
          .market-types {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
          }
        }
      }
    }
  }
  
  .recent-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }
}
</style>
