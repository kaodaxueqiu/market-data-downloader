<template>
  <div class="indexer-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="title-area">
          <h2>Redis 索引服务监控</h2>
          <p class="subtitle">{{ getSubtitleText() }}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="status-info">
          <div class="status-dot" :class="indexerData.processUp ? 'active' : 'inactive'"></div>
          <span>{{ indexerData.processUp ? '服务运行中' : '服务已停止' }} · {{ lastUpdateTime }}</span>
        </div>
      </div>
    </div>

    <!-- 视图选择器 -->
    <div class="view-selector">
      <el-radio-group v-model="viewType" size="large">
        <el-radio-button label="overview">📊 整体概览</el-radio-button>
        <el-radio-button label="buffer">💾 缓冲池详情</el-radio-button>
        <el-radio-button label="performance">⚡ 性能分析</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 整体概览视图 -->
    <div v-if="viewType === 'overview'">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">服务状态</div>
          <div class="stat-value" :class="indexerData.processUp ? 'healthy' : 'error'">
            {{ indexerData.processUp ? '运行中' : '已停止' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">接收消息</div>
          <div class="stat-value">{{ formatNumber(indexerData.receivedTotal) }}</div>
          <div class="stat-sub">从 Redis Pub/Sub</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">写入磁盘</div>
          <div class="stat-value healthy">{{ formatNumber(indexerData.indexedTotal) }}</div>
          <div class="stat-sub">缓冲池文件数</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">缓冲池状态</div>
          <div class="stat-value" :class="getBufferStatusClass()">
            {{ indexerData.bufferFiles }} 文件
          </div>
          <div class="stat-sub">{{ indexerData.bufferSizeMB.toFixed(2) }} MB</div>
        </div>
      </div>

      <!-- 架构信息 -->
      <div class="architecture-panels">
        <!-- 订阅器信息 -->
        <div class="panel">
          <h3>📡 订阅器</h3>
          <div class="panel-body">
            <div class="info-row">
              <span class="label">订阅实例数</span>
              <span class="value">{{ indexerData.subscriberCount }} 个</span>
            </div>
            <div class="info-row">
              <span class="label">订阅频道</span>
              <span class="value code">opensearch:index</span>
            </div>
            <div class="info-row">
              <span class="label">去重数量</span>
              <span class="value">{{ formatNumber(indexerData.duplicateTotal) }}</span>
            </div>
            <div class="info-row">
              <span class="label">去重缓存</span>
              <span class="value">{{ indexerData.dedupCacheSize.toLocaleString() }} keys</span>
            </div>
          </div>
        </div>

        <!-- 消费者信息 -->
        <div class="panel">
          <h3>🔄 消费者</h3>
          <div class="panel-body">
            <div class="info-row">
              <span class="label">消费线程数</span>
              <span class="value">{{ indexerData.consumerCount }} 个</span>
            </div>
            <div class="info-row">
              <span class="label">批量大小</span>
              <span class="value">50,000 条</span>
            </div>
            <div class="info-row">
              <span class="label">刷新间隔</span>
              <span class="value">1 秒</span>
            </div>
            <div class="info-row">
              <span class="label">目标</span>
              <span class="value code">OpenSearch</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 缓冲池详情 -->
      <div class="buffer-panel">
        <h3>💾 磁盘缓冲池</h3>
        <div class="buffer-grid">
          <div class="buffer-item">
            <div class="buffer-label">缓冲池位置</div>
            <div class="buffer-value code">/cache/realtime/redis-index-buffer/</div>
            <div class="buffer-sub">P5800X 高速闪存</div>
          </div>
          <div class="buffer-item">
            <div class="buffer-label">文件数量</div>
            <div class="buffer-value large" :class="getBufferStatusClass()">
              {{ indexerData.bufferFiles }}
            </div>
            <div class="buffer-sub">{{ getBufferStatusText() }}</div>
          </div>
          <div class="buffer-item">
            <div class="buffer-label">总大小</div>
            <div class="buffer-value large">{{ indexerData.bufferSizeMB.toFixed(2) }} MB</div>
            <div class="buffer-sub">可用空间: 248 GB</div>
          </div>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-panel">
        <h3>📊 统计信息</h3>
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-label">接收总数</div>
            <div class="stat-value">{{ indexerData.receivedTotal.toLocaleString() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">写盘总数</div>
            <div class="stat-value healthy">{{ indexerData.indexedTotal.toLocaleString() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">去重总数</div>
            <div class="stat-value warning">{{ indexerData.duplicateTotal.toLocaleString() }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">错误总数</div>
            <div class="stat-value critical">{{ indexerData.errorTotal }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 缓冲池详情视图 -->
    <div v-if="viewType === 'buffer'">
      <!-- 缓冲池实时状态 -->
      <div class="buffer-status-panel">
        <h3>💾 缓冲池实时状态</h3>
        <div class="buffer-status-grid">
          <div class="status-item">
            <div class="status-label">文件数量</div>
            <div class="status-value" :class="getBufferStatusClass()">
              {{ indexerData.bufferFiles }}
            </div>
            <div class="status-sub">{{ getBufferStatusText() }}</div>
          </div>
          <div class="status-item">
            <div class="status-label">总大小</div>
            <div class="status-value">{{ indexerData.bufferSizeMB.toFixed(1) }}</div>
            <div class="status-sub">MB</div>
          </div>
          <div class="status-item">
            <div class="status-label">存储位置</div>
            <div class="status-value small code">/cache/realtime/<br/>redis-index-buffer/</div>
            <div class="status-sub">P5800X 闪存</div>
          </div>
        </div>
      </div>

      <!-- 缓冲策略 -->
      <div class="strategy-panel">
        <h3>⚙️ 缓冲策略</h3>
        <div class="strategy-grid">
          <div class="strategy-item">
            <div class="strategy-title">存储位置</div>
            <div class="strategy-content code">/cache/realtime/redis-index-buffer/</div>
            <div class="strategy-desc">
              • 存储介质: Intel Optane P5800X<br/>
              • 可用空间: 248 GB<br/>
              • 写入速度: 极快（微秒级）
            </div>
          </div>
          <div class="strategy-item">
            <div class="strategy-title">缓冲策略</div>
            <div class="strategy-content">
              • 批量大小: 5,000 条<br/>
              • 刷新间隔: 1 秒<br/>
              • 文件格式: JSON<br/>
              • 原子写入: 是（临时文件+重命名）
            </div>
          </div>
        </div>
      </div>

      <!-- 健康状态判断 -->
      <div class="health-panel">
        <h3>🏥 健康状态判断</h3>
        <div class="health-grid">
          <div class="health-item good">
            <div class="health-status">✅ 正常</div>
            <div class="health-desc">0-10 文件</div>
          </div>
          <div class="health-item warning">
            <div class="health-status">⚠️ 注意</div>
            <div class="health-desc">10-100 文件</div>
          </div>
          <div class="health-item critical">
            <div class="health-status">❌ 警告</div>
            <div class="health-desc">&gt; 100 文件</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能分析视图 -->
    <div v-if="viewType === 'performance'">
      <!-- 吞吐量分析 -->
      <div class="throughput-panel">
        <h3>📈 吞吐量分析</h3>
        <div class="throughput-grid">
          <div class="throughput-card">
            <div class="throughput-label">接收速率</div>
            <div class="throughput-value">{{ indexerData.receivedRate.toFixed(0) }}</div>
            <div class="throughput-unit">条/秒</div>
            <div class="throughput-desc">从 53 个 Redis 实例接收新 key 通知</div>
          </div>
          <div class="throughput-card">
            <div class="throughput-label">写盘速率</div>
            <div class="throughput-value healthy">{{ indexerData.indexedRate.toFixed(0) }}</div>
            <div class="throughput-unit">条/秒</div>
            <div class="throughput-desc">写入 P5800X 高速闪存</div>
          </div>
          <div class="throughput-card">
            <div class="throughput-label">去重效率</div>
            <div class="throughput-value warning">
              {{ indexerData.receivedTotal > 0 ? ((indexerData.duplicateTotal / indexerData.receivedTotal) * 100).toFixed(1) : 0 }}
            </div>
            <div class="throughput-unit">%</div>
            <div class="throughput-desc">避免重复索引同一 key</div>
          </div>
        </div>
      </div>

      <!-- 架构优势 -->
      <div class="advantages-panel">
        <h3>✨ 架构优势</h3>
        <div class="advantages-grid">
          <div class="advantage-card">
            <div class="advantage-title">✅ 绝对不丢数据</div>
            <ul>
              <li>• 数据立即写入高速闪存</li>
              <li>• 服务重启不丢数据</li>
              <li>• OpenSearch 故障也不丢数据</li>
            </ul>
          </div>
          <div class="advantage-card">
            <div class="advantage-title">📊 完全可观测</div>
            <ul>
              <li>• 实时查看缓冲池文件数</li>
              <li>• 清晰定位性能瓶颈</li>
              <li>• 详细的统计信息</li>
            </ul>
          </div>
          <div class="advantage-card">
            <div class="advantage-title">⚡ 高性能</div>
            <ul>
              <li>• 订阅器不阻塞（异步写盘）</li>
              <li>• 消费者独立工作</li>
              <li>• 榨干 OpenSearch 性能</li>
            </ul>
          </div>
          <div class="advantage-card">
            <div class="advantage-title">🛡️ 压力可控</div>
            <ul>
              <li>• 内存占用极小</li>
              <li>• OpenSearch 慢了只是积压</li>
              <li>• 不会导致服务崩溃</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 性能建议 -->
      <div v-if="indexerData.bufferFiles === 0" class="suggestion-panel good">
        <div class="suggestion-title">✅ 系统运行正常</div>
        <div class="suggestion-desc">缓冲池无积压，消费者处理能力充足</div>
      </div>
      <div v-else-if="indexerData.bufferFiles < 100" class="suggestion-panel warning">
        <div class="suggestion-title">⚠️ 轻微积压</div>
        <div class="suggestion-desc">建议：持续观察，如果文件数持续增长，考虑增加消费者线程</div>
      </div>
      <div v-else class="suggestion-panel critical">
        <div class="suggestion-title">❌ 严重积压</div>
        <div class="suggestion-desc">
          建议：<br/>
          1. 检查 OpenSearch 是否正常运行<br/>
          2. 增加消费者线程数（改配置：consumer_threads: 8）<br/>
          3. 检查 OpenSearch 性能瓶颈
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'

const router = useRouter()
const viewType = ref('overview')
const lastUpdateTime = ref('--:--:--')
const indexerData = ref({
  processUp: false,
  receivedTotal: 0,
  indexedTotal: 0,
  duplicateTotal: 0,
  errorTotal: 0,
  bufferFiles: 0,
  bufferSizeMB: 0,
  subscriberCount: 0,
  consumerCount: 0,
  dedupCacheSize: 0,
  receivedRate: 0,
  indexedRate: 0
})
let refreshTimer: NodeJS.Timeout | null = null
let lastReceived = 0
let lastIndexed = 0
let lastTime = Date.now()

const formatNumber = (num: number): string => {
  if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num > 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const getSubtitleText = () => {
  const texts: Record<string, string> = {
    overview: '实时索引服务整体状态',
    buffer: '磁盘缓冲池详细信息',
    performance: '性能指标和趋势分析'
  }
  return texts[viewType.value] || ''
}

const getBufferStatusClass = () => {
  const files = indexerData.value.bufferFiles
  if (files === 0) return 'healthy'
  if (files < 100) return 'warning'
  return 'critical'
}

const getBufferStatusText = () => {
  const files = indexerData.value.bufferFiles
  if (files === 0) return '无积压 ✅'
  if (files < 100) return '轻微积压 ⚠️'
  return '严重积压 ❌'
}

const goBack = () => {
  router.push('/monitoring/services')
}

// 获取数据
const fetchIndexerData = async () => {
  try {
    const [upResult, receivedResult, indexedResult, duplicateResult, errorResult,
           bufferFilesResult, bufferSizeResult, subscriberResult, consumerResult, dedupResult] = await Promise.all([
      prometheusService.query('redis_indexer_process_up'),
      prometheusService.query('redis_indexer_received_total'),
      prometheusService.query('redis_indexer_indexed_total'),
      prometheusService.query('redis_indexer_duplicate_total'),
      prometheusService.query('redis_indexer_error_total'),
      prometheusService.query('redis_indexer_buffer_files'),
      prometheusService.query('redis_indexer_buffer_size_mb'),
      prometheusService.query('redis_indexer_subscriber_count'),
      prometheusService.query('redis_indexer_consumer_count'),
      prometheusService.query('redis_indexer_dedup_cache_size')
    ])
    
    const receivedTotal = parseFloat(receivedResult[0]?.value[1] || '0')
    const indexedTotal = parseFloat(indexedResult[0]?.value[1] || '0')
    
    // 计算速率
    const now = Date.now()
    const timeDiff = (now - lastTime) / 1000
    const receivedRate = timeDiff > 0 ? (receivedTotal - lastReceived) / timeDiff : 0
    const indexedRate = timeDiff > 0 ? (indexedTotal - lastIndexed) / timeDiff : 0
    
    lastReceived = receivedTotal
    lastIndexed = indexedTotal
    lastTime = now
    
    indexerData.value = {
      processUp: upResult[0]?.value[1] === '1',
      receivedTotal,
      indexedTotal,
      duplicateTotal: parseFloat(duplicateResult[0]?.value[1] || '0'),
      errorTotal: parseFloat(errorResult[0]?.value[1] || '0'),
      bufferFiles: parseFloat(bufferFilesResult[0]?.value[1] || '0'),
      bufferSizeMB: parseFloat(bufferSizeResult[0]?.value[1] || '0'),
      subscriberCount: parseFloat(subscriberResult[0]?.value[1] || '0'),
      consumerCount: parseFloat(consumerResult[0]?.value[1] || '0'),
      dedupCacheSize: parseFloat(dedupResult[0]?.value[1] || '0'),
      receivedRate,
      indexedRate
    }
    
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    console.error('获取 Redis Indexer 数据失败:', err)
  }
}

const startRefresh = () => {
  fetchIndexerData()
  refreshTimer = setInterval(fetchIndexerData, 10000)
}

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
.indexer-detail-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1f2e 0%, #2a3447 100%);
  padding: 24px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      gap: 14px;

      .title-area {
        h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          color: #4facfe;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }
      }
    }

    .header-right {
      .status-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;

          &.active {
            background: #67C23A;
            box-shadow: 0 0 6px #67C23A;
            animation: pulse 2s infinite;
          }

          &.inactive {
            background: #F56C6C;
          }
        }
      }
    }
  }

  .view-selector {
    margin-bottom: 20px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .stat-card {
      background: rgba(50, 62, 85, 0.6);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);

      .stat-label {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: #ffffff;

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }

        &.error {
          color: #F56C6C;
        }

        &.critical {
          color: #F56C6C;
        }
      }

      .stat-sub {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        margin-top: 4px;
      }
    }
  }

  .architecture-panels {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 20px;
  }

  .panel {
    background: rgba(50, 62, 85, 0.6);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #ffffff;
      font-weight: 600;
    }

    .panel-body {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }

        .value {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;

          &.code {
            font-family: 'Courier New', monospace;
            color: #4facfe;
          }
        }
      }
    }
  }

  .buffer-panel,
  .stats-panel,
  .buffer-status-panel,
  .strategy-panel,
  .health-panel,
  .throughput-panel,
  .advantages-panel {
    background: rgba(50, 62, 85, 0.6);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 20px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #ffffff;
      font-weight: 600;
    }
  }

  .buffer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;

    .buffer-item {
      .buffer-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 8px;
      }

      .buffer-value {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 6px;

        &.code {
          font-family: 'Courier New', monospace;
          background: rgba(0, 0, 0, 0.2);
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        &.large {
          font-size: 32px;
          font-weight: 600;

          &.healthy {
            color: #67C23A;
          }

          &.warning {
            color: #E6A23C;
          }

          &.critical {
            color: #F56C6C;
          }
        }
      }

      .buffer-sub {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
      }
    }
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;

    .stat-item {
      text-align: center;

      .stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: #ffffff;

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }

        &.critical {
          color: #F56C6C;
        }
      }
    }
  }

  .buffer-status-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;

    .status-item {
      text-align: center;

      .status-label {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 12px;
      }

      .status-value {
        font-size: 48px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 8px;

        &.small {
          font-size: 14px;
          line-height: 1.5;
        }

        &.code {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          background: rgba(0, 0, 0, 0.3);
          padding: 12px;
          border-radius: 6px;
        }

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }

        &.critical {
          color: #F56C6C;
        }
      }

      .status-sub {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.45);
      }
    }
  }

  .strategy-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;

    .strategy-item {
      background: rgba(0, 0, 0, 0.2);
      padding: 16px;
      border-radius: 6px;

      .strategy-title {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.75);
        font-weight: 600;
        margin-bottom: 10px;
      }

      .strategy-content {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.6;

        &.code {
          font-family: 'Courier New', monospace;
          color: #67C23A;
        }
      }

      .strategy-desc {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 8px;
        line-height: 1.6;
      }
    }
  }

  .health-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    .health-item {
      text-align: center;
      padding: 16px;
      border-radius: 6px;

      &.good {
        background: rgba(103, 194, 58, 0.1);
        border: 1px solid rgba(103, 194, 58, 0.3);

        .health-status {
          color: #67C23A;
        }
      }

      &.warning {
        background: rgba(230, 162, 60, 0.1);
        border: 1px solid rgba(230, 162, 60, 0.3);

        .health-status {
          color: #E6A23C;
        }
      }

      &.critical {
        background: rgba(245, 108, 108, 0.1);
        border: 1px solid rgba(245, 108, 108, 0.3);

        .health-status {
          color: #F56C6C;
        }
      }

      .health-status {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .health-desc {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
      }
    }
  }

  .throughput-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;

    .throughput-card {
      background: rgba(0, 0, 0, 0.2);
      padding: 20px;
      border-radius: 8px;
      text-align: center;

      .throughput-label {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 12px;
      }

      .throughput-value {
        font-size: 36px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 4px;

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }
      }

      .throughput-unit {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.45);
        margin-bottom: 12px;
      }

      .throughput-desc {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
        line-height: 1.5;
      }
    }
  }

  .advantages-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .advantage-card {
      background: rgba(0, 0, 0, 0.2);
      padding: 16px;
      border-radius: 6px;

      .advantage-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 10px;

        &:first-child {
          color: #67C23A;
        }
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.8;
        }
      }
    }
  }

  .suggestion-panel {
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;

    &.good {
      background: rgba(103, 194, 58, 0.1);
      border: 1px solid rgba(103, 194, 58, 0.3);

      .suggestion-title {
        color: #67C23A;
      }
    }

    &.warning {
      background: rgba(230, 162, 60, 0.1);
      border: 1px solid rgba(230, 162, 60, 0.3);

      .suggestion-title {
        color: #E6A23C;
      }
    }

    &.critical {
      background: rgba(245, 108, 108, 0.1);
      border: 1px solid rgba(245, 108, 108, 0.3);

      .suggestion-title {
        color: #F56C6C;
      }
    }

    .suggestion-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .suggestion-desc {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
    }
  }

  .code {
    font-family: 'Courier New', monospace;
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

