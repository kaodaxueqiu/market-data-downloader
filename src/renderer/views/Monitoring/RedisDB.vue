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
        <el-option
          v-for="opt in typeOptions"
          :key="opt"
          :label="opt === 'all' ? '全部类型' : opt"
          :value="opt"
        />
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
        height="100%"
        :header-cell-style="{ 
          background: '#f5f7fa', 
          color: '#606266',
          borderBottom: '1px solid #e4e7ed'
        }"
        :cell-style="{ 
          color: '#606266',
          borderBottom: '1px solid #e4e7ed'
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
            <span class="message-type">{{ row.messageType }}</span>
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
import { API_CONFIG } from '@/api/constants'

interface RedisDB {
  db: string
  dbIndex: number
  keys: number
  expires: number
  avgTTL: number
  dataType: string
  messageType?: string
}

// Redis DB 数据字典：{ 端口: { DB号: { type, messageType } } }
interface DBDictEntry {
  type?: string
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

// 数据字典：{ 端口: { DB号: { type, messageType } } }
let dbDict: Record<string, Record<string, DBDictEntry>> = {}

// 拉取 Redis DB 数据字典（相对稳定，无需随监控数据轮询）
const fetchDBDict = async () => {
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/redis-dbdict`)
    const json = await res.json()
    dbDict = json?.instances || {}
  } catch (e) {
    console.error('获取 Redis DB 数据字典失败:', e)
    dbDict = {}
  }
}

// 按端口 + DB号 查字典
const lookupDBDict = (portStr: string, dbIndex: number): DBDictEntry | null => {
  const inst = dbDict[portStr]
  if (!inst) return null
  return inst[String(dbIndex)] || null
}

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

// 动态类型选项：从当前 DB 列表提取所有 type 去重，前面加「全部」
const typeOptions = computed(() => [
  'all',
  ...Array.from(new Set(databases.value.map(d => d.dataType)))
])

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
    UNKNOWN: 'info',
    行情: 'success',
    基础数据: 'primary',
    未定义: 'info'
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
      
      const dict = lookupDBDict(port.value, dbIndex)
      const dataType = dict?.type || '未定义'
      const messageType = dict?.messageType || '未定义'
      
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
const startRefresh = async () => {
  await fetchDBDict()
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
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
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
      color: #303133;
      font-weight: 600;
    }
  }

  .page-subtitle {
    margin: 0 0 20px 34px;
    font-size: 13px;
    color: #909399;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    .stat-card {
      background: #fff;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e4e7ed;
      display: flex;
      gap: 14px;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
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
          color: #909399;
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
          color: #909399;
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
    }

    .filter-select {
      width: 160px;
    }
  }

  .db-table {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid #e4e7ed;
    overflow-y: auto;

    // 全局统一滚动条：默认隐藏，hover 显示
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;

    &:hover {
      scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
    }

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 2px;
    }
    &:hover::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
    }

    .db-index {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #409EFF;
    }

    .message-type {
      color: #606266;
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
        background: #909399;
      }
    }
  }

  .footer-info {
    text-align: center;
    font-size: 14px;
    color: #909399;
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

