<template>
  <div class="redis-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="market-title">
          <span class="market-icon">{{ marketInfo?.icon }}</span>
          <h2>{{ marketInfo?.name }}</h2>
        </div>
      </div>
      <div class="header-right">
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

    <!-- Redis 实例明细卡片 -->
    <div class="instances-grid">
      <div
        v-for="instance in instances"
        :key="instance.port"
        class="instance-card"
        :class="getStatusClass(instance.status)"
        @click="goToDBDetail(instance.port)"
      >
        <div class="card-header">
          <div class="instance-info">
            <span class="instance-name">{{ instance.displayName }}</span>
            <el-tag :type="getStatusType(instance.status)" size="small">
              {{ getStatusText(instance.status) }}
            </el-tag>
          </div>
          <div class="header-right">
            <div class="status-dot" :class="`status-${instance.status}`"></div>
            <span class="instance-port">:{{ instance.port }}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="instance-purpose">
            {{ instance.purpose }}
          </div>

          <div class="metrics-list">
            <div
              v-for="metric in instance.metrics"
              :key="metric.label"
              class="metric-item"
            >
              <span class="metric-label">{{ metric.label }}</span>
              <span class="metric-value">
                {{ metric.value }}
                <span v-if="metric.unit" class="metric-unit">{{ metric.unit }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span class="detail-link">点击查看DB详情 →</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && instances.length === 0"
      description="该市场暂无 Redis 实例"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'
import { MARKET_INFO, getInstancesByMarket } from '@/config/redisInstances'

interface RedisMetric {
  label: string
  value: string | number
  unit?: string
}

interface RedisInstance {
  port: number
  name: string
  displayName: string
  purpose: string
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  metrics: RedisMetric[]
}

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref<string | null>(null)
const instances = ref<RedisInstance[]>([])
const lastUpdateTime = ref('--:--:--')
let refreshTimer: NodeJS.Timeout | null = null

// 获取市场信息
const marketKey = computed(() => route.params.market as string)
const marketInfo = computed(() => {
  return MARKET_INFO[marketKey.value as keyof typeof MARKET_INFO]
})

// 返回上一页
const goBack = () => {
  router.push('/monitoring/redis')
}

// 跳转到DB详情页
const goToDBDetail = (port: number) => {
  console.log('点击实例卡片，跳转到DB详情页:', port)
  router.push(`/monitoring/redis/${marketKey.value}/${port}`)
}

// 获取状态样式
const getStatusClass = (status: string) => {
  return `status-${status}`
}

// 获取状态类型
const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    healthy: 'success',
    warning: 'warning',
    error: 'danger',
    unknown: 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    healthy: '健康',
    warning: '警告',
    error: '异常',
    unknown: '未知'
  }
  return texts[status] || '未知'
}

// 格式化内存
const formatMemory = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}`
  }
  return `${bytes}`
}

// 获取内存单位
const getMemoryUnit = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return 'GB'
  if (bytes >= 1024 * 1024) return 'MB'
  if (bytes >= 1024) return 'KB'
  return 'B'
}

// 缓存数据
const lastValidData: Record<string, any> = {}

// 获取实例详细数据
const fetchInstancesData = async () => {
  try {
    error.value = null
    
    // 获取该市场的所有实例配置
    const marketInstances = getInstancesByMarket(marketKey.value)
    
    // 并行查询所有实例的数据
    const promises = marketInstances.map(async (config) => {
      try {
        const [upResult, clientsResult, memoryResult, opsResult, dbsResult] = await Promise.all([
          prometheusService.query(`redis_up{instance="${config.name}"}`),
          prometheusService.query(`redis_connected_clients{instance="${config.name}"}`),
          prometheusService.query(`redis_memory_used_bytes{instance="${config.name}"}`),
          prometheusService.query(`rate(redis_commands_processed_total{instance="${config.name}"}[1m])`),
          prometheusService.query(`count(count by (db)(redis_db_keys{instance="${config.name}"}))`)
        ])
        
        const up = upResult[0]?.value[1] === '1'
        const clients = parseInt(clientsResult[0]?.value[1] || '0')
        const memoryBytes = parseInt(memoryResult[0]?.value[1] || '0')
        const ops = Math.round(parseFloat(opsResult[0]?.value[1] || '0'))
        const dbs = parseInt(dbsResult[0]?.value[1] || '0')
        
        // 缓存数据
        lastValidData[config.key] = { clients, memoryBytes, ops, dbs }
        
        const memoryValue = formatMemory(memoryBytes)
        const memoryUnit = getMemoryUnit(memoryBytes)
        
        let status: 'healthy' | 'warning' | 'error' | 'unknown' = 'unknown'
        if (!up) {
          status = 'error'
        } else {
          status = 'healthy'
        }
        
        return {
          port: config.port,
          name: config.name,
          displayName: config.displayName,
          purpose: config.purpose,
          status,
          metrics: [
            { label: '连接数', value: clients, unit: '个' },
            { label: '内存占用', value: memoryValue, unit: memoryUnit },
            { label: '操作速率', value: ops, unit: 'ops/s' },
            { label: '数据库数', value: dbs, unit: '个' }
          ]
        }
      } catch (err) {
        // 使用缓存数据
        const cached = lastValidData[config.key] || { clients: 0, memoryBytes: 0, ops: 0, dbs: 0 }
        const memoryValue = formatMemory(cached.memoryBytes)
        const memoryUnit = getMemoryUnit(cached.memoryBytes)
        
        return {
          port: config.port,
          name: config.name,
          displayName: config.displayName,
          purpose: config.purpose,
          status: 'unknown' as const,
          metrics: [
            { label: '连接数', value: cached.clients, unit: '个' },
            { label: '内存占用', value: memoryValue, unit: memoryUnit },
            { label: '操作速率', value: cached.ops, unit: 'ops/s' },
            { label: '数据库数', value: cached.dbs, unit: '个' }
          ]
        }
      }
    })
    
    instances.value = await Promise.all(promises)
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
    loading.value = false
  } catch (err: any) {
    console.error('获取实例数据失败:', err)
    error.value = err.message || '获取 Redis 实例数据失败'
    loading.value = false
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchInstancesData()
  refreshTimer = setInterval(fetchInstancesData, 10000)
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
.redis-detail-page {
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

        h2 {
          margin: 0;
          font-size: 20px;
          color: #4facfe;
          font-weight: 600;
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

    .instances-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

  .instance-card {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 8px;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;
    cursor: pointer;
    backdrop-filter: blur(10px);

    &:hover {
      transform: translateY(-2px);
      background: rgba(55, 68, 95, 0.7);
      border-color: rgba(79, 172, 254, 0.4);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);

      .detail-link {
        color: #4facfe;
      }
    }

    &.status-healthy .instance-name {
      color: #67C23A;
    }

    &.status-warning .instance-name {
      color: #E6A23C;
    }

    &.status-error .instance-name {
      color: #F56C6C;
    }

    &.status-unknown .instance-name {
      color: #909399;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .instance-info {
        display: flex;
        align-items: center;
        gap: 6px;

        .instance-name {
          font-size: 15px;
          font-weight: 600;
          color: #4facfe;
        }
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          
          &.status-healthy {
            background: #67C23A;
            box-shadow: 0 0 6px #67C23A;
            animation: pulse 2s infinite;
          }

          &.status-warning {
            background: #E6A23C;
            box-shadow: 0 0 6px #E6A23C;
          }

          &.status-error {
            background: #F56C6C;
            box-shadow: 0 0 6px #F56C6C;
          }

          &.status-unknown {
            background: #909399;
          }
        }

        .instance-port {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
      }
    }

    .card-body {
      .instance-purpose {
        padding: 6px 10px;
        background: rgba(79, 172, 254, 0.08);
        border-radius: 4px;
        margin-bottom: 10px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.4;
      }

      .metrics-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .metric-label {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.55);
          }

          .metric-value {
            font-size: 14px;
            font-weight: 600;
            color: #67C23A;

            .metric-unit {
              font-size: 11px;
              font-weight: normal;
              color: rgba(255, 255, 255, 0.45);
              margin-left: 3px;
            }
          }
        }
      }
    }

    .card-footer {
      padding-top: 10px;
      margin-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);

      .detail-link {
        font-size: 11px;
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

