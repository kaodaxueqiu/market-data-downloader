<template>
  <div class="redis-db-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-button @click="goBack" size="large" :icon="ArrowLeft">返回系统概览</el-button>
    </div>

    <div class="page-title">
      <span class="redis-icon">🗄️</span>
      <h2>Redis {{ instanceInfo?.purpose }} - 端口 {{ port }}</h2>
    </div>
    <p class="page-subtitle">解码后的行情数据存储</p>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-content">
          <div class="stat-label">活跃DB</div>
          <div class="stat-value">{{ overview.activeDBs }}/{{ overview.totalDBs }}</div>
          <div class="stat-sub">{{ ((overview.activeDBs / overview.totalDBs) * 100).toFixed(1) }}% 使用率</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🔑</div>
        <div class="stat-content">
          <div class="stat-label">总Key数</div>
          <div class="stat-value">{{ overview.totalKeys.toLocaleString() }}</div>
          <div class="stat-sub">平均每DB {{ Math.round(overview.totalKeys / Math.max(overview.activeDBs, 1)).toLocaleString() }} 个</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">内存使用</div>
          <div class="stat-value">{{ formatMemory(overview.totalMemory) }}</div>
          <div class="stat-sub">{{ ((overview.totalMemory / overview.memoryLimit) * 100).toFixed(1) }}% / {{ formatMemory(overview.memoryLimit) }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <div class="stat-label">操作速率</div>
          <div class="stat-value">{{ overview.opsPerSec > 1000 ? `${(overview.opsPerSec / 1000).toFixed(1)}K` : Math.round(overview.opsPerSec) }}</div>
          <div class="stat-sub">ops/s · 命中率 {{ overview.hitRate.toFixed(1) }}%</div>
        </div>
      </div>
    </div>

    <!-- 搜索和筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchTerm"
        placeholder="搜索 DB 编号或消息类型..."
        clearable
        class="search-input"
      />
      <el-select v-model="filterType" placeholder="全部类型" class="filter-select">
        <el-option label="全部类型" value="all" />
        <el-option label="DECODED 数据" value="DECODED" />
        <el-option label="RAW 数据" value="RAW" />
        <el-option label="系统 DB" value="SYSTEM" />
      </el-select>
      <el-select v-model="sortBy" placeholder="按 DB 编号" class="filter-select">
        <el-option label="按 DB 编号" value="db" />
        <el-option label="按 Key 数量" value="keys" />
      </el-select>
    </div>

    <!-- DB 列表表格 -->
    <div class="db-table">
      <el-table
        :data="filteredDBs"
        style="width: 100%"
        :header-cell-style="{ 
          background: 'rgba(50, 62, 85, 0.6)', 
          color: 'rgba(255, 255, 255, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }"
        :row-style="{ background: 'transparent' }"
        :cell-style="{ 
          color: 'rgba(255, 255, 255, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }"
      >
        <el-table-column prop="dbIndex" label="DB" width="100">
          <template #default="{ row }">
            <span class="db-index">DB{{ row.dbIndex }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="dataType" label="类型" width="150">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.dataType)" size="small">
              {{ row.dataType }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="messageType" label="消息类型" min-width="200">
          <template #default="{ row }">
            <span class="message-type">{{ row.messageType || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="keys" label="Key 数量" width="150" align="right">
          <template #default="{ row }">
            <span class="key-count">{{ row.keys.toLocaleString() }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <div class="status-indicator" :class="row.keys > 0 ? 'active' : 'inactive'"></div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 底部信息 -->
    <div class="footer-info">
      显示 {{ filteredDBs.length }} / {{ databases.length }} 个数据库 · 
      连接数: {{ overview.connections }} · 
      运行时间: {{ formatUptime(overview.uptime) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'
import { getInstanceByPort } from '@/config/redisInstances'

interface RedisDB {
  db: string
  dbIndex: number
  keys: number
  expires: number
  avgTTL: number
  dataType: 'RAW' | 'DECODED' | 'SYSTEM' | 'UNKNOWN'
  messageType?: string
}

interface RedisOverview {
  totalDBs: number
  activeDBs: number
  totalKeys: number
  totalMemory: number
  memoryLimit: number
  opsPerSec: number
  hitRate: number
  connections: number
  uptime: number
}

const route = useRoute()
const router = useRouter()
const port = computed(() => route.params.port as string)
const market = computed(() => route.params.market as string)
const instanceInfo = computed(() => getInstanceByPort(parseInt(port.value)))

const databases = ref<RedisDB[]>([])
const overview = ref<RedisOverview>({
  totalDBs: 256,
  activeDBs: 0,
  totalKeys: 0,
  totalMemory: 0,
  memoryLimit: 0,
  opsPerSec: 0,
  hitRate: 0,
  connections: 0,
  uptime: 0
})

const searchTerm = ref('')
const filterType = ref('all')
const sortBy = ref('db')
let refreshTimer: NodeJS.Timeout | null = null

// 过滤和排序
const filteredDBs = computed(() => {
  return databases.value
    .filter(db => {
      // 只显示有数据的DB或系统DB
      if (db.keys === 0 && db.dbIndex > 2) return false
      
      // 类型过滤
      if (filterType.value !== 'all' && db.dataType !== filterType.value) return false
      
      // 搜索过滤
      if (searchTerm.value) {
        return db.db.includes(searchTerm.value) || 
               db.messageType?.includes(searchTerm.value) ||
               db.dbIndex.toString().includes(searchTerm.value)
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy.value === 'keys') {
        return b.keys - a.keys
      }
      return a.dbIndex - b.dbIndex
    })
})

// 返回上一页
const goBack = () => {
  router.push(`/monitoring/redis/${market.value}`)
}

// 格式化内存
const formatMemory = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${bytes} B`
}

// 格式化运行时间
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

// 获取类型标签样式
const getTypeTagType = (type: string) => {
  const types: Record<string, any> = {
    RAW: 'primary',
    DECODED: 'success',
    SYSTEM: 'warning',
    UNKNOWN: 'info'
  }
  return types[type] || 'info'
}

// 获取 Redis DB 数据
const fetchDBData = async () => {
  try {
    const instance = `redis-${port.value}`
    
    const [dbKeysResult, memoryResult, memoryMaxResult, opsResult, clientsResult, uptimeResult, hitsResult, missesResult] = await Promise.all([
      prometheusService.query(`redis_db_keys{instance="${instance}"}`),
      prometheusService.query(`redis_memory_used_bytes{instance="${instance}"}`),
      prometheusService.query(`redis_memory_max_bytes{instance="${instance}"}`),
      prometheusService.query(`rate(redis_commands_processed_total{instance="${instance}"}[1m])`),
      prometheusService.query(`redis_connected_clients{instance="${instance}"}`),
      prometheusService.query(`redis_uptime_in_seconds{instance="${instance}"}`),
      prometheusService.query(`rate(redis_keyspace_hits_total{instance="${instance}"}[1m])`),
      prometheusService.query(`rate(redis_keyspace_misses_total{instance="${instance}"}[1m])`)
    ])
    
    // 处理DB数据
    const dbMap = new Map<string, RedisDB>()
    
    dbKeysResult.forEach((item: any) => {
      const db = item.metric.db
      const keys = parseInt(item.value[1])
      const dbIndex = parseInt(db.replace('db', ''))
      
      let dataType: 'RAW' | 'DECODED' | 'SYSTEM' | 'UNKNOWN' = 'UNKNOWN'
      let messageType = instanceInfo.value?.purpose || ''
      
      if (dbIndex === 0) {
        dataType = 'DECODED'
      } else if (dbIndex === 1) {
        dataType = 'RAW'
      } else if (dbIndex === 2) {
        dataType = 'SYSTEM'
      }
      
      dbMap.set(db, {
        db,
        dbIndex,
        keys,
        expires: 0,
        avgTTL: 0,
        dataType,
        messageType
      })
    })
    
    databases.value = Array.from(dbMap.values()).sort((a, b) => a.dbIndex - b.dbIndex)
    
    // 更新概览数据
    const totalMemory = parseFloat(memoryResult[0]?.value[1] || '0')
    const memoryLimit = parseFloat(memoryMaxResult[0]?.value[1] || '0') || 1760 * 1024 * 1024 * 1024
    const opsPerSec = parseFloat(opsResult[0]?.value[1] || '0')
    const connections = parseInt(clientsResult[0]?.value[1] || '0')
    const uptime = parseInt(uptimeResult[0]?.value[1] || '0')
    const hits = parseFloat(hitsResult[0]?.value[1] || '0')
    const misses = parseFloat(missesResult[0]?.value[1] || '0')
    const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0
    
    overview.value = {
      totalDBs: dbMap.size,
      activeDBs: Array.from(dbMap.values()).filter(db => db.keys > 0).length,
      totalKeys: Array.from(dbMap.values()).reduce((sum, db) => sum + db.keys, 0),
      totalMemory,
      memoryLimit,
      opsPerSec,
      hitRate,
      connections,
      uptime
    }
  } catch (err) {
    console.error('获取 Redis DB 数据失败:', err)
  }
}

// 启动定时刷新
const startRefresh = () => {
  fetchDBData()
  refreshTimer = setInterval(fetchDBData, 10000)
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
.redis-db-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1f2e 0%, #2a3447 100%);
  padding: 24px;

  .page-header {
    margin-bottom: 20px;
  }

  .page-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .redis-icon {
      font-size: 24px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      color: #4facfe;
      font-weight: 600;
    }
  }

  .page-subtitle {
    margin: 0 0 20px 34px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    .stat-card {
      background: rgba(50, 62, 85, 0.6);
      border-radius: 10px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      gap: 14px;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;

      &:hover {
        background: rgba(55, 68, 95, 0.7);
        transform: translateY(-2px);
      }

      .stat-icon {
        font-size: 32px;
        display: flex;
        align-items: center;
      }

      .stat-content {
        flex: 1;

        .stat-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          margin-bottom: 6px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #67C23A;
          margin-bottom: 3px;
        }

        .stat-sub {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
        }
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .search-input {
      flex: 1;
      
      :deep(.el-input__wrapper) {
        background: rgba(50, 62, 85, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: none;
      }
      
      :deep(.el-input__inner) {
        color: #ffffff;
      }
    }

    .filter-select {
      width: 160px;
      
      :deep(.el-input__wrapper) {
        background: rgba(50, 62, 85, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: none;
      }
      
      :deep(.el-input__inner) {
        color: #ffffff;
      }
    }
  }

  .db-table {
    background: rgba(50, 62, 85, 0.4);
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;

    // 强制覆盖 Element Plus 表格的白色背景
    :deep(.el-table) {
      background-color: transparent !important;
      
      &::before {
        display: none !important;
      }
      
      .el-table__inner-wrapper {
        background-color: transparent !important;
      }
    }
    
    :deep(.el-table__body-wrapper) {
      background-color: transparent !important;
    }
    
    :deep(.el-table tr) {
      background-color: transparent !important;
    }
    
    :deep(.el-table td.el-table__cell) {
      background-color: transparent !important;
      border-bottom: none !important;
    }
    
    :deep(.el-table th.el-table__cell) {
      background-color: rgba(50, 62, 85, 0.6) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    }
    
    :deep(.el-table__body) {
      border-bottom: none !important;
    }
    
    :deep(.el-table__footer-wrapper) {
      display: none !important;
    }
    
    :deep(.el-table__append-wrapper) {
      border-top: none !important;
    }

    .db-index {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #4facfe;
    }

    .message-type {
      color: rgba(255, 255, 255, 0.75);
    }

    .key-count {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #67C23A;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin: 0 auto;

      &.active {
        background: #67C23A;
        box-shadow: 0 0 6px #67C23A;
        animation: pulse 2s infinite;
      }

      &.inactive {
        background: #606266;
      }
    }
    
    // 覆盖类型标签的样式
    :deep(.el-tag) {
      background: transparent !important;
      border: 1px solid !important;
      
      &.el-tag--success {
        color: #67C23A !important;
        border-color: rgba(103, 194, 58, 0.3) !important;
      }
      
      &.el-tag--primary {
        color: #409EFF !important;
        border-color: rgba(64, 158, 255, 0.3) !important;
      }
      
      &.el-tag--warning {
        color: #E6A23C !important;
        border-color: rgba(230, 162, 60, 0.3) !important;
      }
      
      &.el-tag--info {
        color: #909399 !important;
        border-color: rgba(144, 147, 153, 0.3) !important;
      }
    }
  }

  .footer-info {
    text-align: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
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

