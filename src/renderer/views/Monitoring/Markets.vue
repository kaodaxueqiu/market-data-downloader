<template>
  <div class="market-monitoring-overview">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>行情接收服务</h2>
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

    <!-- 市场卡片网格 -->
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
              <span class="market-subtitle">市场数据接收</span>
            </div>
          </div>
          <div class="status-indicator" :class="getStatusClass(market)"></div>
        </div>

        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">进程状态</span>
            <span class="metric-value">
              <span class="healthy-count">{{ market.onlineProcesses }}</span>
              /{{ market.totalProcesses }}
            </span>
          </div>

          <div class="metric-row">
            <span class="metric-label">订阅组状态</span>
            <span class="metric-value">
              <span class="healthy-count">{{ market.activeGroups }}</span>
              /{{ market.totalGroups }}
            </span>
          </div>

          <div class="metric-row">
            <span class="metric-label">消息速率</span>
            <span class="metric-value">{{ market.messageRate.toFixed(1) }} <span class="unit">/s</span></span>
          </div>

          <div class="metric-row">
            <span class="metric-label">消息总量</span>
            <span class="metric-value">{{ market.totalMessages.toLocaleString() }}</span>
          </div>

          <div class="metric-row">
            <span class="metric-label">健康度</span>
            <span class="metric-value">{{ market.health }} <span class="unit">%</span></span>
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
      description="暂无市场监控数据"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { prometheusService } from '@/services/prometheus.service'

interface MarketSummary {
  key: string
  name: string
  icon: string
  totalProcesses: number
  onlineProcesses: number
  totalGroups: number
  activeGroups: number
  messageRate: number
  totalMessages: number
  health: number
}

const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const marketSummaries = ref<MarketSummary[]>([])
const lastUpdateTime = ref('--:--:--')
let refreshTimer: NodeJS.Timeout | null = null

// 市场配置
const MARKETS = [
  { key: 'sz', name: '深圳市场', icon: '🏢', jobName: 'market_receiver_sz' },
  { key: 'sh', name: '上海市场', icon: '🏛️', jobName: 'market_receiver_sh' },
  { key: 'futures', name: '期货市场', icon: '📊', jobName: 'market_receiver_futures' },
  { key: 'options', name: '期权市场', icon: '🎯', jobName: 'market_receiver_options' },
  { key: 'hk', name: '陆港通市场', icon: '🌉', jobName: 'market_receiver_hk' }
]

// 获取状态样式
const getStatusClass = (market: MarketSummary) => {
  if (market.health === 100) return 'status-healthy'
  if (market.health >= 80) return 'status-warning'
  return 'status-error'
}

// 跳转到市场详情
const goToMarketDetail = (marketKey: string) => {
  router.push(`/monitoring/markets/${marketKey}`)
}

// 获取市场汇总数据
const fetchMarketSummaries = async () => {
  try {
    error.value = null
    const summaries: MarketSummary[] = []
    
    for (const market of MARKETS) {
      try {
        // 查询该市场的指标
        const [upResult, messagesResult, rateResult, isLeaderResult] = await Promise.all([
          prometheusService.query(`up{job="${market.jobName}"}`),
          prometheusService.query(`receiver_messages_total{job="${market.jobName}"}`),
          prometheusService.query(`rate(receiver_messages_total{job="${market.jobName}"}[1m])`),
          prometheusService.query(`receiver_is_leader{job="${market.jobName}"}`)
        ])
        
        // 统计进程数
        const totalProcesses = upResult.length
        const onlineProcesses = upResult.filter(r => r.value[1] === '1').length
        
        // 统计订阅组数（每2个进程为1组）
        const totalGroups = Math.floor(totalProcesses / 2)
        const activeGroups = isLeaderResult.filter(r => r.value[1] === '1').length
        
        // 消息统计
        const totalMessages = messagesResult.reduce((sum, r) => sum + parseInt(r.value[1]), 0)
        const messageRate = rateResult.reduce((sum, r) => sum + parseFloat(r.value[1]), 0)
        
        // 健康度
        const health = totalProcesses > 0 ? Math.round((onlineProcesses / totalProcesses) * 100) : 0
        
        summaries.push({
          key: market.key,
          name: market.name,
          icon: market.icon,
          totalProcesses,
          onlineProcesses,
          totalGroups,
          activeGroups,
          messageRate,
          totalMessages,
          health
        })
      } catch (err) {
        console.error(`获取 ${market.name} 数据失败:`, err)
        summaries.push({
          key: market.key,
          name: market.name,
          icon: market.icon,
          totalProcesses: 0,
          onlineProcesses: 0,
          totalGroups: 0,
          activeGroups: 0,
          messageRate: 0,
          totalMessages: 0,
          health: 0
        })
      }
    }
    
    marketSummaries.value = summaries
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    loading.value = false
  } catch (err: any) {
    console.error('获取市场汇总数据失败:', err)
    error.value = err.message || '获取市场监控数据失败'
    loading.value = false
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchMarketSummaries()
  refreshTimer = setInterval(fetchMarketSummaries, 10000)
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
.market-monitoring-overview {
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

          .market-subtitle {
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
