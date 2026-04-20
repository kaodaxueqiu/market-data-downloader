<template>
  <div class="market-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="market-title">
          <span class="market-icon">{{ marketInfo?.icon }}</span>
          <div class="market-title-text">
            <h2>{{ marketInfo?.name }}</h2>
            <span v-if="marketInfo?.zzRange" class="header-zz-range">{{ marketInfo.zzRange }}</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <el-tag :type="loading ? 'warning' : 'success'" size="large">
          {{ loading ? '加载中...' : '实时监控' }}
        </el-tag>
        <span class="update-time">最后更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">订阅组总数</span>
        <span class="stat-value">{{ totalGroups }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">活跃订阅组</span>
        <span class="stat-value healthy">{{ activeGroups }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总消息数</span>
        <span class="stat-value">{{ totalMessages.toLocaleString() }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">数据速率</span>
        <span class="stat-value">{{ totalRate.toLocaleString() }}<span class="unit">/s</span></span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="searchTerm"
        placeholder="搜索业务类型、消息号、ZZ 编号或进程名..."
        clearable
      />
    </div>

    <!-- 订阅组卡片网格 -->
    <div class="subscription-grid">
      <div
        v-for="sub in filteredSubscriptions"
        :key="sub.messageNo"
        class="subscription-card"
      >
        <!-- 左侧：订阅组信息 -->
        <div class="card-left">
          <div class="subscription-header">
            <span class="sub-label">订阅组</span>
            <h3 class="sub-name">{{ sub.description }}</h3>
            <span v-if="sub.zzCode" class="sub-zz-range">{{ sub.zzCode }}</span>
          </div>

          <div class="subscription-info">
            <div class="info-row">
              <span class="info-label">工作模式</span>
              <span class="info-value mode">{{ sub.mode }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">当前主</span>
              <span class="info-value">{{ sub.currentLeader }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">状态</span>
              <span class="info-value" :class="sub.overallStatus === '正常' ? 'status-normal' : 'status-standby'">
                {{ sub.overallStatus }}
              </span>
            </div>
          </div>
        </div>

        <!-- 右侧：两个进程状态 -->
        <div class="card-right">
          <!-- 进程1 -->
          <div v-if="sub.process1" class="process-block">
            <div class="process-header">
              <span class="process-name">{{ sub.process1.name }}</span>
              <span class="process-status" :class="`status-${sub.process1.statusClass}`">
                {{ sub.process1.statusText }}
              </span>
            </div>
            <div class="process-metrics">
              <div class="metric-line">
                <span class="metric-text">消息: {{ sub.process1.messageCount.toLocaleString() }}</span>
                <span class="metric-text">速率: {{ sub.process1.dataRate }}/s</span>
              </div>
              <div class="metric-line">
                <span class="metric-text">MDL: </span>
                <div class="mdl-indicator" :class="sub.process1.mdlConnected ? 'connected' : 'disconnected'"></div>
                <span class="metric-text port-text">端口:{{ sub.process1.port }}</span>
              </div>
            </div>
          </div>

          <!-- 进程2 -->
          <div v-if="sub.process2" class="process-block">
            <div class="process-header">
              <span class="process-name">{{ sub.process2.name }}</span>
              <span class="process-status" :class="`status-${sub.process2.statusClass}`">
                {{ sub.process2.statusText }}
              </span>
            </div>
            <div class="process-metrics">
              <div class="metric-line">
                <span class="metric-text">消息: {{ sub.process2.messageCount.toLocaleString() }}</span>
                <span class="metric-text">速率: {{ sub.process2.dataRate }}/s</span>
              </div>
              <div class="metric-line">
                <span class="metric-text">MDL: </span>
                <div class="mdl-indicator" :class="sub.process2.mdlConnected ? 'connected' : 'disconnected'"></div>
                <span class="metric-text port-text">端口:{{ sub.process2.port }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && filteredSubscriptions.length === 0"
      description="暂无订阅组数据"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'
import { MESSAGE_DESCRIPTIONS } from '@/config/messageDescriptions'
import { RECEIVER_MARKETS } from '@/config/marketMonitoringMarkets'
import { getZzCodeForReceiverMessageNo } from '@/config/marketReceiverMessageNoToZz'

interface ProcessInfo {
  name: string
  status: 'working' | 'online' | 'offline' | 'error'
  statusClass: string
  statusText: string
  port: number
  messageCount: number
  dataRate: number
  mdlConnected: boolean
  isLeader: boolean
}

interface SubscriptionGroup {
  messageNo: string
  /** 对应数据中心数据源编号 */
  zzCode?: string
  description: string
  mode: string
  currentLeader: string
  overallStatus: string
  process1: ProcessInfo | null
  process2: ProcessInfo | null
}

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const subscriptions = ref<SubscriptionGroup[]>([])
const lastUpdateTime = ref('--:--:--')
const searchTerm = ref('')
let refreshTimer: NodeJS.Timeout | null = null

const marketKey = computed(() => route.params.market as string)

const MARKET_INFO: Record<string, { name: string; icon: string; jobName: string; zzRange: string }> =
  Object.fromEntries(RECEIVER_MARKETS.map(m => [m.key, { name: m.name, icon: m.icon, jobName: m.jobName, zzRange: m.zzRange }]))

const marketInfo = computed(() => MARKET_INFO[marketKey.value])

// 汇总统计
const totalGroups = computed(() => subscriptions.value.length)
const activeGroups = computed(() => 
  subscriptions.value.filter(s => 
    (s.process1 && s.process1.status === 'working') || 
    (s.process2 && s.process2.status === 'working')
  ).length
)
const totalMessages = computed(() => 
  subscriptions.value.reduce((sum, s) => {
    const msg1 = s.process1?.messageCount || 0
    const msg2 = s.process2?.messageCount || 0
    return sum + msg1 + msg2
  }, 0)
)
const totalRate = computed(() => 
  subscriptions.value.reduce((sum, s) => {
    const rate1 = s.process1?.dataRate || 0
    const rate2 = s.process2?.dataRate || 0
    return sum + rate1 + rate2
  }, 0)
)

// 过滤订阅组
const filteredSubscriptions = computed(() => {
  if (!searchTerm.value) return subscriptions.value
  
  const lowerSearch = searchTerm.value.toLowerCase()
  return subscriptions.value.filter(sub => {
    const zz = sub.zzCode?.toLowerCase() ?? ''
    return sub.messageNo.includes(searchTerm.value) ||
           sub.description.toLowerCase().includes(lowerSearch) ||
           zz.includes(lowerSearch) ||
           sub.process1?.name.toLowerCase().includes(lowerSearch) ||
           sub.process2?.name.toLowerCase().includes(lowerSearch)
  })
})

// 返回上一页
const goBack = () => {
  router.push('/monitoring/markets')
}

// 获取订阅组数据
const fetchSubscriptionData = async () => {
  try {
    error.value = null
    const jobName = marketInfo.value.jobName
    
    // 查询多个指标
    const [upResult, isLeaderResult, messagesResult, rateResult, mdlResult] = await Promise.all([
      prometheusService.query(`up{job="${jobName}"}`),
      prometheusService.query(`receiver_is_leader{job="${jobName}"}`),
      prometheusService.query(`receiver_messages_total{job="${jobName}"}`),
      prometheusService.query(`rate(receiver_messages_total{job="${jobName}"}[1m])`),
      prometheusService.query(`receiver_mdl_connected{job="${jobName}"}`)
    ])
    
    // 构建进程映射
    const processMap = new Map<string, any>()
    
    upResult.forEach((item: any) => {
      const processName = item.metric.exported_process || item.metric.process
      const port = parseInt(item.metric.instance?.split(':')[1] || '0')
      
      processMap.set(processName, {
        name: processName,
        port,
        status: item.value[1] === '1' ? 'online' : 'offline',
        statusClass: 'online',
        statusText: '在线',
        messageCount: 0,
        dataRate: 0,
        mdlConnected: false,
        isLeader: false
      })
    })
    
    // 更新 is_leader 状态
    isLeaderResult.forEach((item: any) => {
      const processName = item.metric.exported_process || item.metric.process
      if (processMap.has(processName)) {
        processMap.get(processName).isLeader = item.value[1] === '1'
      }
    })
    
    // 更新消息总数
    messagesResult.forEach((item: any) => {
      const processName = item.metric.exported_process || item.metric.process
      if (processMap.has(processName)) {
        processMap.get(processName).messageCount = parseInt(item.value[1])
      }
    })
    
    // 更新消息速率
    rateResult.forEach((item: any) => {
      const processName = item.metric.exported_process || item.metric.process
      if (processMap.has(processName)) {
        processMap.get(processName).dataRate = Math.round(parseFloat(item.value[1]))
      }
    })
    
    // 更新 MDL 连接状态
    mdlResult.forEach((item: any) => {
      const processName = item.metric.exported_process || item.metric.process
      if (processMap.has(processName)) {
        const process = processMap.get(processName)
        process.mdlConnected = item.value[1] === '1'
        // 如果在线且MDL已连接，状态改为工作中
        if (process.status === 'online' && process.mdlConnected) {
          process.status = 'working'
          process.statusClass = 'working'
          process.statusText = '工作中'
        }
      }
    })
    
    // 按消息号分组
    const subscriptionGroups = new Map<string, any>()
    
    processMap.forEach((process, name) => {
      // 提取消息号，格式：市场前缀_消息号_进程序号
      const match = name.match(/^[a-z]+_(.+)_([12])$/)
      if (match) {
        const messageNo = match[1].replace(/_/g, '.')  // 将 4_4 转成 4.4
        const processNumber = match[2]
        
        if (!subscriptionGroups.has(messageNo)) {
          subscriptionGroups.set(messageNo, {
            messageNo,
            zzCode: getZzCodeForReceiverMessageNo(messageNo),
            description: MESSAGE_DESCRIPTIONS[messageNo] || `消息 ${messageNo}`,
            mode: '主备',
            currentLeader: '-',
            overallStatus: '待命',
            process1: null,
            process2: null
          })
        }
        
        const group = subscriptionGroups.get(messageNo)
        if (processNumber === '1') {
          group.process1 = process
        } else {
          group.process2 = process
        }
        
        // 更新当前主
        if (process.isLeader) {
          group.currentLeader = `进程${processNumber}`
        }
        
        // 更新整体状态
        if (process.status === 'working') {
          group.overallStatus = '正常'
        }
      }
    })
    
    subscriptions.value = Array.from(subscriptionGroups.values())
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    loading.value = false
  } catch (err: any) {
    console.error('获取订阅组数据失败:', err)
    error.value = err.message || '获取订阅组数据失败'
    loading.value = false
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchSubscriptionData()
  refreshTimer = setInterval(fetchSubscriptionData, 10000)
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
.market-detail-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1f2e 0%, #2a3447 100%);
  padding: 24px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;

      .market-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .market-icon {
          font-size: 24px;
        }

        .market-title-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }

        h2 {
          margin: 0;
          font-size: 20px;
          color: #4facfe;
          font-weight: 600;
        }

        .header-zz-range {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: rgba(79, 172, 254, 0.9);
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;

      .update-time {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);
      }
    }
  }

  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .stat-item {
      background: rgba(50, 62, 85, 0.6);
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);

      .stat-label {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 6px;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: #ffffff;

        &.healthy {
          color: #67C23A;
        }

        .unit {
          font-size: 12px;
          font-weight: normal;
          color: rgba(255, 255, 255, 0.45);
        }
      }
    }
  }

  .search-bar {
    margin-bottom: 20px;

    :deep(.el-input__wrapper) {
      background: rgba(50, 62, 85, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: none;
    }

    :deep(.el-input__inner) {
      color: #ffffff;
    }
  }

  .subscription-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .subscription-card {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    gap: 16px;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(55, 68, 95, 0.7);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    .card-left {
      width: 140px;
      padding-right: 16px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);

      .subscription-header {
        margin-bottom: 16px;

        .sub-label {
          display: block;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-bottom: 4px;
        }

        .sub-name {
          margin: 0 0 6px 0;
          font-size: 14px;
          color: #ffffff;
          font-weight: 600;
          line-height: 1.3;
        }

        .sub-zz-range {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: rgba(79, 172, 254, 0.9);
        }
      }

      .subscription-info {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;

          .info-label {
            color: rgba(255, 255, 255, 0.55);
          }

          .info-value {
            font-weight: 600;
            color: #ffffff;

            &.mode {
              color: #409EFF;
            }

            &.status-normal {
              color: #67C23A;
            }

            &.status-standby {
              color: #E6A23C;
            }
          }
        }
      }
    }

    .card-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .process-block {
        .process-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          .process-name {
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.85);
          }

          .process-status {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 4px;

            &.status-working {
              background: rgba(103, 194, 58, 0.15);
              color: #67C23A;
            }

            &.status-online {
              background: rgba(230, 162, 60, 0.15);
              color: #E6A23C;
            }

            &.status-offline {
              background: rgba(144, 147, 153, 0.15);
              color: #909399;
            }
          }
        }

        .process-metrics {
          .metric-line {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;

            .metric-text {
              font-size: 11px;
              color: rgba(255, 255, 255, 0.7);

              &.port-text {
                margin-left: auto;
              }
            }

            .mdl-indicator {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              
              &.connected {
                background: #67C23A;
                box-shadow: 0 0 6px #67C23A;
                animation: pulse 2s infinite;
              }

              &.disconnected {
                background: #F56C6C;
              }
            }
          }
        }
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
