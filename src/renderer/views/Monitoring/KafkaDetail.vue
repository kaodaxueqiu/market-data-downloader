<template>
  <div class="kafka-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="title-area">
          <h2>Kafka 监控中心</h2>
          <p class="subtitle">{{ getSubtitleText() }}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="status-info">
          <div class="status-dot" :class="kafkaUp ? 'active' : 'inactive'"></div>
          <span>{{ kafkaUp ? '在线' : '离线' }} · {{ lastUpdateTime }}</span>
        </div>
      </div>
    </div>

    <!-- 视图选择器 -->
    <div class="view-selector">
      <el-radio-group v-model="viewType" size="large">
        <el-radio-button label="overview">📊 整体概览</el-radio-button>
        <el-radio-button label="topics">📋 Topics 列表</el-radio-button>
        <el-radio-button label="consumers">👥 消费者组</el-radio-button>
        <el-radio-button label="producers">📤 生产者统计</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 整体概览视图 -->
    <div v-if="viewType === 'overview'">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Broker 数量</div>
          <div class="stat-value">{{ stats.brokers }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Topic 数量</div>
          <div class="stat-value healthy">{{ stats.topics }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">消费者组</div>
          <div class="stat-value">{{ stats.consumerGroups }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">总消息量</div>
          <div class="stat-value">{{ formatNumber(stats.totalMessages) }}</div>
        </div>
      </div>

      <!-- 详细信息 -->
      <div class="detail-panels">
        <div class="panel">
          <h3>📊 活跃 Topics (Top 5)</h3>
          <div class="topic-list">
            <div v-for="topic in activeTopics.slice(0, 5)" :key="topic.name" class="topic-item">
              <span class="topic-name">{{ topic.name }}</span>
              <span class="topic-rate">{{ topic.messageRate }}/s</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>⚠️ 消费延迟 (Top 5)</h3>
          <div class="topic-list">
            <div v-for="topic in laggingTopics.slice(0, 5)" :key="topic.name" class="topic-item">
              <span class="topic-name">{{ topic.name }}</span>
              <span class="topic-lag">{{ formatNumber(topic.consumerLag) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Topics 列表视图 -->
    <div v-if="viewType === 'topics'">
      <!-- 统计和筛选 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">总 Topic 数</div>
          <div class="stat-value">{{ stats.topics }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">活跃 Topic</div>
          <div class="stat-value healthy">{{ stats.activeTopics }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">有积压 Topic</div>
          <div class="stat-value warning">{{ stats.laggingTopics }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">副本异常</div>
          <div class="stat-value critical">{{ stats.underReplicated }}</div>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-select v-model="filterType" placeholder="全部 Topics">
          <el-option label="全部 Topics" value="all" />
          <el-option label="活跃 Topics" value="active" />
          <el-option label="有积压 Topics" value="lagging" />
        </el-select>
        <el-input
          v-model="searchTerm"
          placeholder="搜索 Topic 名称..."
          clearable
        />
      </div>

      <!-- Topics 表格 -->
      <div class="topics-table">
        <el-table
          :data="filteredTopics"
          style="width: 100%"
        >
          <el-table-column prop="name" label="Topic 名称" min-width="200">
            <template #default="{ row }">
              <span class="topic-name-cell">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="partitions" label="分区数" width="100" />
          <el-table-column prop="messageCount" label="消息总数" width="150" align="right">
            <template #default="{ row }">
              <span>{{ formatNumber(row.messageCount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="messageRate" label="消息速率" width="120" align="right">
            <template #default="{ row }">
              <span :class="row.messageRate > 0 ? 'rate-active' : 'rate-inactive'">
                {{ row.messageRate > 0 ? `${row.messageRate}/s` : '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="consumerLag" label="消费延迟" width="120" align="right">
            <template #default="{ row }">
              <span :class="getLagClass(row.consumerLag)">
                {{ formatNumber(row.consumerLag) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="消费组" min-width="150">
            <template #default="{ row }">
              <div class="consumer-groups">
                <el-tag v-for="group in row.consumerGroups.slice(0, 2)" :key="group" size="small">
                  {{ group }}
                </el-tag>
                <el-tag v-if="row.consumerGroups.length > 2" size="small" type="info">
                  +{{ row.consumerGroups.length - 2 }}
                </el-tag>
                <span v-if="row.consumerGroups.length === 0" class="no-consumer">无消费者</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="180">
            <template #default="{ row }">
              <div class="status-tags">
                <el-tag v-if="row.underReplicated" type="danger" size="small">副本不足</el-tag>
                <el-tag v-if="row.messageRate > 0" type="success" size="small">活跃</el-tag>
                <el-tag v-if="row.consumerLag > 10000" type="warning" size="small">积压</el-tag>
                <el-tag v-if="!row.underReplicated && row.messageRate === 0 && row.consumerLag === 0" type="info" size="small">
                  空闲
                </el-tag>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 消费者组视图 -->
    <div v-if="viewType === 'consumers'" class="consumer-view">
      <div class="panel">
        <h3>👥 消费者组列表</h3>
        <div class="consumer-group-card">
          <div class="group-header">
            <h4>l2_cache_consumer</h4>
            <el-tag type="success" size="small">活跃</el-tag>
          </div>
          <div class="group-stats">
            <div class="stat-item">
              <span class="label">成员数:</span>
              <span class="value">1</span>
            </div>
            <div class="stat-item">
              <span class="label">消费 Topics:</span>
              <span class="value">{{ consumerTopicCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">总延迟:</span>
              <span class="value warning">{{ totalConsumerLag }}</span>
            </div>
          </div>
          <div class="group-topics">
            <div class="topics-label">消费的 Topics:</div>
            <div class="topics-tags">
              <el-tag v-for="topic in consumerTopics.slice(0, 5)" :key="topic" size="small">
                {{ topic }}
              </el-tag>
              <el-tag v-if="consumerTopics.length > 5" size="small" type="info">
                +{{ consumerTopics.length - 5 }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 生产者视图 -->
    <div v-if="viewType === 'producers'" class="producer-view">
      <div class="detail-panels">
        <div class="panel">
          <h3>📤 接收器生产统计</h3>
          <div class="producer-stats">
            <div class="stat-row">
              <span class="label">总发送消息</span>
              <span class="value">-</span>
            </div>
            <div class="stat-row">
              <span class="label">发送速率</span>
              <span class="value healthy">{{ totalMessageRate }}/s</span>
            </div>
            <div class="stat-row">
              <span class="label">失败消息</span>
              <span class="value critical">0</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>📊 Topic 生产分布</h3>
          <div class="distribution-list">
            <div v-for="topic in activeTopics.slice(0, 5)" :key="topic.name" class="distribution-item">
              <span class="topic-name">{{ topic.name }}</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: getProgressWidth(topic.messageRate) + '%' }"></div>
              </div>
              <span class="rate-value">{{ topic.messageRate }}/s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'

interface KafkaTopic {
  name: string
  partitions: number
  currentOffset: number
  oldestOffset: number
  messageCount: number
  consumerLag: number
  messageRate: number
  inSyncReplicas: number
  underReplicated: boolean
  consumerGroups: string[]
}

const router = useRouter()
const viewType = ref('overview')
const searchTerm = ref('')
const filterType = ref('all')
const topics = ref<KafkaTopic[]>([])
const lastUpdateTime = ref('--:--:--')
const kafkaUp = ref(false)
let refreshTimer: NodeJS.Timeout | null = null

// 统计数据
const stats = computed(() => ({
  brokers: 1,
  topics: topics.value.length,
  activeTopics: topics.value.filter(t => t.messageRate > 0).length,
  laggingTopics: topics.value.filter(t => t.consumerLag > 0).length,
  underReplicated: topics.value.filter(t => t.underReplicated).length,
  consumerGroups: 1,
  totalMessages: topics.value.reduce((sum, t) => sum + t.messageCount, 0)
}))

// 活跃 Topics
const activeTopics = computed(() => 
  topics.value.filter(t => t.messageRate > 0).sort((a, b) => b.messageRate - a.messageRate)
)

// 有延迟的 Topics
const laggingTopics = computed(() => 
  topics.value.filter(t => t.consumerLag > 0).sort((a, b) => b.consumerLag - a.consumerLag)
)

// 过滤 Topics
const filteredTopics = computed(() => {
  let filtered = topics.value
  
  if (filterType.value === 'active') {
    filtered = filtered.filter(t => t.messageRate > 0)
  } else if (filterType.value === 'lagging') {
    filtered = filtered.filter(t => t.consumerLag > 0)
  }
  
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase()
    filtered = filtered.filter(t => t.name.toLowerCase().includes(search))
  }
  
  return filtered
})

// 消费者相关
const consumerTopics = computed(() => 
  topics.value.filter(t => t.consumerGroups.includes('l2_cache_consumer')).map(t => t.name)
)
const consumerTopicCount = computed(() => consumerTopics.value.length)
const totalConsumerLag = computed(() => 
  topics.value.filter(t => t.consumerGroups.includes('l2_cache_consumer'))
    .reduce((sum, t) => sum + t.consumerLag, 0)
)

// 总消息速率
const totalMessageRate = computed(() => 
  topics.value.reduce((sum, t) => sum + t.messageRate, 0)
)

// 格式化数字
const formatNumber = (num: number): string => {
  if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num > 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// 获取副标题
const getSubtitleText = () => {
  const texts: Record<string, string> = {
    overview: '整体状态概览',
    topics: `共 ${stats.value.topics} 个 Topic`,
    consumers: '消费者组监控',
    producers: '生产者监控'
  }
  return texts[viewType.value] || ''
}

// 获取延迟样式
const getLagClass = (lag: number) => {
  if (lag === 0) return 'lag-good'
  if (lag < 1000) return 'lag-warning'
  return 'lag-critical'
}

// 获取进度条宽度
const getProgressWidth = (rate: number) => {
  const maxRate = Math.max(...activeTopics.value.map(t => t.messageRate))
  return maxRate > 0 ? (rate / maxRate) * 100 : 0
}

// 返回
const goBack = () => {
  router.push('/monitoring/services')
}

// 获取 Kafka 数据
const fetchKafkaData = async () => {
  try {
    const [partitionsResult, currentOffsetResult, oldestOffsetResult, lagResult, rateResult, 
           replicasResult, underReplicatedResult, consumerGroupResult] = await Promise.all([
      prometheusService.query('kafka_topic_partitions'),
      prometheusService.query('sum by (topic)(kafka_topic_partition_current_offset)'),
      prometheusService.query('sum by (topic)(kafka_topic_partition_oldest_offset)'),
      prometheusService.query('sum by (topic)(kafka_consumergroup_lag)'),
      prometheusService.query('sum by (topic)(rate(kafka_topic_partition_current_offset[1m]))'),
      prometheusService.query('sum by (topic)(kafka_topic_partition_in_sync_replica)'),
      prometheusService.query('sum by (topic)(kafka_topic_partition_under_replicated_partition)'),
      prometheusService.query('count by (topic, consumergroup)(kafka_consumergroup_current_offset)')
    ])
    
    const topicMap = new Map<string, KafkaTopic>()
    
    // 处理分区数
    partitionsResult.forEach((item: any) => {
      const topicName = item.metric.topic
      if (topicName) {
        topicMap.set(topicName, {
          name: topicName,
          partitions: parseInt(item.value[1]) || 0,
          currentOffset: 0,
          oldestOffset: 0,
          messageCount: 0,
          consumerLag: 0,
          messageRate: 0,
          inSyncReplicas: 0,
          underReplicated: false,
          consumerGroups: []
        })
      }
    })
    
    // 处理偏移量
    currentOffsetResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.currentOffset = parseInt(item.value[1]) || 0
      }
    })
    
    oldestOffsetResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.oldestOffset = parseInt(item.value[1]) || 0
      }
    })
    
    // 计算消息数量
    topicMap.forEach((topic) => {
      topic.messageCount = topic.currentOffset - topic.oldestOffset
    })
    
    // 处理延迟、速率等
    lagResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.consumerLag = parseInt(item.value[1]) || 0
      }
    })
    
    rateResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.messageRate = Math.round(parseFloat(item.value[1]) || 0)
      }
    })
    
    replicasResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.inSyncReplicas = parseInt(item.value[1]) || 0
      }
    })
    
    underReplicatedResult.forEach((item: any) => {
      const topic = item.metric.topic
      if (topic && topicMap.has(topic)) {
        topicMap.get(topic)!.underReplicated = parseInt(item.value[1]) > 0
      }
    })
    
    // 处理消费组
    const consumerGroupMap = new Map<string, Set<string>>()
    consumerGroupResult.forEach((item: any) => {
      const topic = item.metric.topic
      const group = item.metric.consumergroup
      if (topic && group) {
        if (!consumerGroupMap.has(topic)) {
          consumerGroupMap.set(topic, new Set())
        }
        consumerGroupMap.get(topic)!.add(group)
      }
    })
    
    consumerGroupMap.forEach((groups, topic) => {
      if (topicMap.has(topic)) {
        topicMap.get(topic)!.consumerGroups = Array.from(groups)
      }
    })
    
    topics.value = Array.from(topicMap.values()).sort((a, b) => {
      if (a.messageCount === 0 && b.messageCount > 0) return 1
      if (a.messageCount > 0 && b.messageCount === 0) return -1
      return a.name.localeCompare(b.name)
    })
    
    kafkaUp.value = topics.value.length > 0
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    console.error('获取 Kafka 数据失败:', err)
  }
}

// 启动刷新
const startRefresh = () => {
  fetchKafkaData()
  refreshTimer = setInterval(fetchKafkaData, 10000)
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
.kafka-detail-page {
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

      .title-area {
        h2 {
          margin: 0;
          font-size: 20px;
          color: #4facfe;
          font-weight: 600;
        }

        .subtitle {
          margin: 3px 0 0 0;
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
        font-size: 24px;
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

  .detail-panels {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
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

    .topic-list {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .topic-item {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .topic-name {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .topic-rate {
          font-size: 14px;
          font-weight: 600;
          color: #67C23A;
        }

        .topic-lag {
          font-size: 14px;
          font-weight: 600;
          color: #E6A23C;
        }
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;

    .el-select {
      width: 180px;
    }

    .el-input {
      flex: 1;
    }

    :deep(.el-input__wrapper),
    :deep(.el-select .el-input__wrapper) {
      background: rgba(50, 62, 85, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: none;
    }

    :deep(.el-input__inner) {
      color: #ffffff;
    }
  }

  .topics-table {
    background: rgba(50, 62, 85, 0.4);
    border-radius: 10px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);

    :deep(.el-table) {
      background-color: transparent !important;

      &::before {
        display: none !important;
      }
    }

    :deep(.el-table tr),
    :deep(.el-table td.el-table__cell),
    :deep(.el-table__body-wrapper) {
      background-color: transparent !important;
      border-bottom: none !important;
      color: rgba(255, 255, 255, 0.85);
    }

    :deep(.el-table th.el-table__cell) {
      background-color: rgba(50, 62, 85, 0.6) !important;
      color: rgba(255, 255, 255, 0.8) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    }

    :deep(.el-tag) {
      background: transparent !important;
      border: 1px solid !important;
    }

    .topic-name-cell {
      font-family: 'Courier New', monospace;
      color: #4facfe;
    }

    .rate-active {
      color: #67C23A;
      font-weight: 600;
    }

    .rate-inactive {
      color: #606266;
    }

    .lag-good {
      color: #67C23A;
    }

    .lag-warning {
      color: #E6A23C;
    }

    .lag-critical {
      color: #F56C6C;
    }

    .consumer-groups {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;

      .no-consumer {
        font-size: 12px;
        color: #909399;
      }
    }

    .status-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }

  .consumer-view,
  .producer-view {
    .consumer-group-card {
      background: rgba(50, 62, 85, 0.6);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);

      .group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        h4 {
          margin: 0;
          font-size: 16px;
          color: #ffffff;
        }
      }

      .group-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 16px;

        .stat-item {
          .label {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.55);
          }

          .value {
            margin-left: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;

            &.warning {
              color: #E6A23C;
            }
          }
        }
      }

      .group-topics {
        .topics-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
          margin-bottom: 8px;
        }

        .topics-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
      }
    }

    .producer-stats {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .stat-row {
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

          &.healthy {
            color: #67C23A;
          }

          &.critical {
            color: #F56C6C;
          }
        }
      }
    }

    .distribution-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .distribution-item {
        display: flex;
        align-items: center;
        gap: 12px;

        .topic-name {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          width: 120px;
          flex-shrink: 0;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: #67C23A;
            transition: width 0.3s ease;
          }
        }

        .rate-value {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          width: 80px;
          text-align: right;
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

