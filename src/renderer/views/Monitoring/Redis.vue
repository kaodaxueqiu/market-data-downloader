<template>
  <div class="redis-monitoring-overview">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>内存数据库</h2>
      <div class="header-info">
        <el-tag :type="loading ? 'warning' : 'success'" size="large">
          {{ loading ? '加载中...' : '实时监控' }}
        </el-tag>
        <span class="update-time">最后更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    />

    <!-- 市场汇总卡片网格 -->
    <div class="market-cards-grid">
      <div
        v-for="market in marketSummaries"
        :key="market.key"
        class="market-card"
        @click="goToMarketDetail(market.key)"
      >
        <div class="card-header">
          <div class="market-info">
            <span class="market-icon">{{ market.icon }}</span>
            <div class="market-title">
              <h3>{{ market.name }}</h3>
              <span class="instance-count">共 {{ market.totalInstances }} 个Redis实例</span>
            </div>
          </div>
          <div class="status-indicator" :class="getOverallStatusClass(market)"></div>
        </div>

        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">实例状态</span>
            <span class="metric-value">
              <span class="healthy-count">{{ market.healthyInstances }}</span>
              /{{ market.totalInstances }}
            </span>
          </div>

          <div class="metric-row">
            <span class="metric-label">总内存占用</span>
            <span class="metric-value">{{ market.totalMemory }} GB</span>
          </div>

          <div class="metric-row">
            <span class="metric-label">总连接数</span>
            <span class="metric-value">{{ market.totalConnections }} <span class="unit">个</span></span>
          </div>

          <div class="metric-row">
            <span class="metric-label">总操作速率</span>
            <span class="metric-value">{{ market.totalOps }} <span class="unit">ops</span></span>
          </div>
        </div>

        <div class="card-footer">
          <span class="detail-link">点击查看详细信息 →</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && marketSummaries.length === 0"
      description="暂无 Redis 监控数据"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { prometheusService } from '@/services/prometheus.service'
import { REDIS_INSTANCES, MARKET_INFO } from '@/config/redisInstances'

interface MarketSummary {
  key: string
  name: string
  icon: string
  totalInstances: number
  healthyInstances: number
  totalMemory: string
  totalConnections: number
  totalOps: number
}

const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const marketSummaries = ref<MarketSummary[]>([])
const lastUpdateTime = ref('--:--:--')
let refreshTimer: NodeJS.Timeout | null = null

// 格式化内存为 GB
const formatMemoryToGB = (bytes: number): string => {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2)
}

// 获取整体状态样式
const getOverallStatusClass = (market: MarketSummary) => {
  const ratio = market.healthyInstances / market.totalInstances
  if (ratio === 1) return 'status-healthy'
  if (ratio >= 0.8) return 'status-warning'
  return 'status-error'
}

// 跳转到市场详情页
const goToMarketDetail = (marketKey: string) => {
  router.push(`/monitoring/redis/${marketKey}`)
}

// 获取市场汇总数据
const fetchMarketSummaries = async () => {
  try {
    error.value = null
    
    // 按市场分组统计
    const summaries: MarketSummary[] = []
    
    for (const [marketKey, marketInfo] of Object.entries(MARKET_INFO)) {
      const marketInstances = REDIS_INSTANCES.filter(i => i.market === marketKey)
      
      let healthyCount = 0
      let totalMemoryBytes = 0
      let totalConnections = 0
      let totalOps = 0
      
      // 查询该市场所有实例的数据
      const promises = marketInstances.map(async (instance) => {
        try {
          const [upResult, clientsResult, memoryResult, opsResult] = await Promise.all([
            prometheusService.query(`redis_up{instance="${instance.name}"}`),
            prometheusService.query(`redis_connected_clients{instance="${instance.name}"}`),
            prometheusService.query(`redis_memory_used_bytes{instance="${instance.name}"}`),
            prometheusService.query(`rate(redis_commands_processed_total{instance="${instance.name}"}[1m])`)
          ])
          
          const isUp = upResult[0]?.value[1] === '1'
          const clients = parseInt(clientsResult[0]?.value[1] || '0')
          const memory = parseInt(memoryResult[0]?.value[1] || '0')
          const ops = Math.round(parseFloat(opsResult[0]?.value[1] || '0'))
          
          return { isUp, clients, memory, ops }
        } catch (err) {
          return { isUp: false, clients: 0, memory: 0, ops: 0 }
        }
      })
      
      const results = await Promise.all(promises)
      
      // 汇总该市场的数据
      results.forEach(result => {
        if (result.isUp) healthyCount++
        totalMemoryBytes += result.memory
        totalConnections += result.clients
        totalOps += result.ops
      })
      
      summaries.push({
        key: marketKey,
        name: marketInfo.name,
        icon: marketInfo.icon,
        totalInstances: marketInstances.length,
        healthyInstances: healthyCount,
        totalMemory: formatMemoryToGB(totalMemoryBytes),
        totalConnections,
        totalOps
      })
    }
    
    marketSummaries.value = summaries
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    loading.value = false
  } catch (err: any) {
    console.error('获取市场汇总数据失败:', err)
    error.value = err.message || '获取 Redis 监控数据失败'
    loading.value = false
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchMarketSummaries()
  refreshTimer = setInterval(fetchMarketSummaries, 10000) // 每10秒刷新一次
}

// 停止定时刷新
const stopRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  startRefresh()
})

onUnmounted(() => {
  stopRefresh()
})
</script>

<style scoped lang="scss">
.redis-monitoring-overview {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1f2e 0%, #2a3447 100%);
  padding: 24px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 22px;
      color: #4facfe;
      font-weight: 600;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .update-time {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);
      }
    }
  }

  .market-cards-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .market-card {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 12px;
    padding: 18px 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);

    &:hover {
      transform: translateY(-4px);
      background: rgba(55, 68, 95, 0.7);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
      border-color: rgba(79, 172, 254, 0.4);

      .detail-link {
        color: #4facfe;
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .market-info {
        display: flex;
        gap: 10px;
        align-items: center;

        .market-icon {
          font-size: 28px;
        }

        .market-title {
          h3 {
            margin: 0 0 3px 0;
            font-size: 17px;
            color: #4facfe;
            font-weight: 600;
          }

          .instance-count {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.55);
          }
        }
      }

      .status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        animation: pulse 2s infinite;

        &.status-healthy {
          background: #67C23A;
          box-shadow: 0 0 8px #67C23A;
        }

        &.status-warning {
          background: #E6A23C;
          box-shadow: 0 0 8px #E6A23C;
        }

        &.status-error {
          background: #F56C6C;
          box-shadow: 0 0 8px #F56C6C;
        }
      }
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 14px;

      .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .metric-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }

        .metric-value {
          font-size: 16px;
          font-weight: 600;
          color: #67C23A;

          .healthy-count {
            color: #67C23A;
          }

          .unit {
            font-size: 12px;
            font-weight: normal;
            color: rgba(255, 255, 255, 0.45);
            margin-left: 3px;
          }
        }
      }
    }

    .card-footer {
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);

      .detail-link {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        transition: color 0.3s ease;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
