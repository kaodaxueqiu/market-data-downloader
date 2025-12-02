<template>
  <div class="opensearch-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="title-area">
          <h2>OpenSearch 搜索引擎监控</h2>
          <p class="subtitle">{{ getSubtitleText() }}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="status-info">
          <div class="status-dot" :class="getStatusClass()"></div>
          <span>{{ getStatusText() }} · {{ lastUpdateTime }}</span>
        </div>
      </div>
    </div>

    <!-- 视图选择器 -->
    <div class="view-selector">
      <el-radio-group v-model="viewType" size="large">
        <el-radio-button label="overview">📊 整体概览</el-radio-button>
        <el-radio-button label="indices">📁 索引管理</el-radio-button>
        <el-radio-button label="performance">⚡ 性能分析</el-radio-button>
        <el-radio-button label="queries">🔍 查询统计</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 整体概览视图 -->
    <div v-if="viewType === 'overview'">
      <!-- 集群健康卡片 -->
      <div class="cluster-health-grid">
        <div class="health-card">
          <div class="card-label">集群名称</div>
          <div class="card-value">{{ clusterData.clusterName }}</div>
          <div class="card-sub">UUID: {{ clusterData.clusterUuid?.substring(0, 8) }}...</div>
        </div>
        <div class="health-card">
          <div class="card-label">节点数量</div>
          <div class="card-value">
            {{ clusterData.nodesCount }}
            <span class="value-sub">/ {{ clusterData.dataNodesCount }} 数据节点</span>
          </div>
        </div>
        <div class="health-card">
          <div class="card-label">分片状态</div>
          <div class="card-value healthy">{{ clusterData.activeShards }}</div>
          <div class="card-sub">
            <span class="warning-text">{{ clusterData.relocatingShards }} 迁移中</span>
            <span v-if="clusterData.unassignedShards > 0" class="critical-text">
              {{ clusterData.unassignedShards }} 未分配
            </span>
          </div>
        </div>
        <div class="health-card">
          <div class="card-label">待处理任务</div>
          <div class="card-value" :class="clusterData.pendingTasks === 0 ? 'healthy' : 'warning'">
            {{ clusterData.pendingTasks }}
          </div>
        </div>
      </div>

      <!-- 详细信息面板 -->
      <div class="detail-panels">
        <!-- 存储信息 -->
        <div class="panel">
          <h3>💾 存储信息</h3>
          <div class="panel-body">
            <div class="info-row">
              <span class="label">索引数量</span>
              <span class="value">{{ clusterData.indicesCount }}</span>
            </div>
            <div class="info-row">
              <span class="label">文档总数</span>
              <span class="value">{{ formatNumber(clusterData.docsCount) }}</span>
            </div>
            <div class="info-row">
              <span class="label">已删除文档</span>
              <span class="value">{{ formatNumber(clusterData.docsDeleted) }}</span>
            </div>
            <div class="info-row">
              <span class="label">存储大小</span>
              <span class="value">{{ formatBytes(clusterData.storeSize) }}</span>
            </div>
            <div class="info-row">
              <span class="label">段(Segments)数量</span>
              <span class="value">{{ clusterData.segmentsCount }}</span>
            </div>
          </div>
        </div>

        <!-- 节点状态 -->
        <div class="panel">
          <h3>🖥️ 节点状态</h3>
          <div class="node-list">
            <div v-for="node in clusterData.nodes" :key="node.name" class="node-item">
              <div class="node-header">
                <span class="node-name">{{ node.name }}</span>
                <span class="node-type">节点</span>
              </div>
              <div class="node-metrics">
                <div class="node-metric">
                  <span class="metric-label">JVM 堆内存</span>
                  <div class="progress-wrapper">
                    <div class="progress-bar">
                      <div class="progress-fill" :class="getJVMClass(node.jvmHeapPercent)" 
                           :style="{ width: node.jvmHeapPercent + '%' }"></div>
                    </div>
                    <span class="progress-text">{{ node.jvmHeapPercent }}%</span>
                  </div>
                </div>
                <div class="node-metric">
                  <span class="metric-label">CPU 使用率</span>
                  <span class="metric-value" :class="getCPUClass(node.cpuPercent)">
                    {{ node.cpuPercent }}%
                  </span>
                </div>
                <div class="node-metric">
                  <span class="metric-label">磁盘使用</span>
                  <span class="metric-value">
                    {{ formatBytes(node.diskTotal - node.diskAvailable) }} / {{ formatBytes(node.diskTotal) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 索引管理视图 -->
    <div v-if="viewType === 'indices'" class="indices-table">
      <el-table :data="clusterData.indices" style="width: 100%">
        <el-table-column prop="name" label="索引名称" min-width="200">
          <template #default="{ row }">
            <span class="index-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="docsCount" label="文档数" width="120" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.docsCount) }}
          </template>
        </el-table-column>
        <el-table-column prop="docsDeleted" label="已删除" width="100" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.docsDeleted) }}
          </template>
        </el-table-column>
        <el-table-column prop="storeSize" label="存储大小" width="120" align="right">
          <template #default="{ row }">
            {{ formatBytes(row.storeSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="searchTime" label="查询耗时" width="120" align="right">
          <template #default="{ row }">
            {{ row.searchTime }} ms
          </template>
        </el-table-column>
        <el-table-column prop="indexingTime" label="索引耗时" width="120" align="right">
          <template #default="{ row }">
            {{ row.indexingTime }} ms
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 性能分析视图 -->
    <div v-if="viewType === 'performance'" class="performance-view">
      <div class="performance-panels">
        <div class="panel">
          <h3>JVM 内存</h3>
          <div class="jvm-list">
            <div v-for="node in clusterData.nodes" :key="node.name" class="jvm-item">
              <div class="jvm-header">
                <span class="node-name">{{ node.name }}</span>
                <span class="jvm-percent">{{ node.jvmHeapPercent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getJVMClass(node.jvmHeapPercent)"
                     :style="{ width: node.jvmHeapPercent + '%' }"></div>
              </div>
              <div class="jvm-detail">
                {{ formatBytes(node.jvmHeapUsed) }} / {{ formatBytes(node.jvmHeapMax) }}
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>CPU 使用率</h3>
          <div class="cpu-list">
            <div v-for="node in clusterData.nodes" :key="node.name" class="cpu-item">
              <span class="node-name">{{ node.name }}</span>
              <span class="cpu-value" :class="getCPUClass(node.cpuPercent)">
                {{ node.cpuPercent }}%
              </span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>磁盘空间</h3>
          <div class="disk-list">
            <div v-for="node in clusterData.nodes" :key="node.name" class="disk-item">
              <div class="disk-header">
                <span class="node-name">{{ node.name }}</span>
                <span class="disk-percent">{{ ((1 - node.diskAvailable / node.diskTotal) * 100).toFixed(1) }}%</span>
              </div>
              <div class="disk-detail">可用: {{ formatBytes(node.diskAvailable) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 查询统计视图 -->
    <div v-if="viewType === 'queries'" class="queries-view">
      <div class="query-panels">
        <div class="panel">
          <h3>🔍 查询统计</h3>
          <div class="panel-body">
            <div class="info-row">
              <span class="label">总查询次数</span>
              <span class="value">-</span>
            </div>
            <div class="info-row">
              <span class="label">平均查询延迟</span>
              <span class="value">-</span>
            </div>
            <div class="info-row">
              <span class="label">查询缓存命中率</span>
              <span class="value">-</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>✍️ 索引统计</h3>
          <div class="panel-body">
            <div class="info-row">
              <span class="label">总索引操作</span>
              <span class="value">-</span>
            </div>
            <div class="info-row">
              <span class="label">平均索引延迟</span>
              <span class="value">-</span>
            </div>
            <div class="info-row">
              <span class="label">批量索引速率</span>
              <span class="value">-</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 热门查询 -->
      <div class="hot-queries-panel">
        <h3>🔥 热门查询模式</h3>
        <div class="empty-state">查询分析功能开发中...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { prometheusService } from '@/services/prometheus.service'

interface NodeInfo {
  name: string
  jvmHeapUsed: number
  jvmHeapMax: number
  jvmHeapPercent: number
  cpuPercent: number
  diskTotal: number
  diskAvailable: number
}

interface IndexInfo {
  name: string
  docsCount: number
  docsDeleted: number
  storeSize: number
  searchTime: number
  indexingTime: number
}

const router = useRouter()
const viewType = ref('overview')
const lastUpdateTime = ref('--:--:--')
const clusterData = ref({
  clusterName: 'financial-data-cluster',
  clusterUuid: 'unknown',
  clusterStatus: 0,
  nodesCount: 0,
  dataNodesCount: 0,
  activeShards: 0,
  activePrimaryShards: 0,
  relocatingShards: 0,
  initializingShards: 0,
  unassignedShards: 0,
  pendingTasks: 0,
  indicesCount: 0,
  docsCount: 0,
  docsDeleted: 0,
  storeSize: 0,
  segmentsCount: 0,
  nodes: [] as NodeInfo[],
  indices: [] as IndexInfo[]
})
let refreshTimer: NodeJS.Timeout | null = null

const formatNumber = (num: number): string => {
  if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num > 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${bytes} B`
}

const getSubtitleText = () => {
  const texts: Record<string, string> = {
    overview: '集群整体状态和健康度',
    indices: `索引管理 - 共 ${clusterData.value.indicesCount} 个索引`,
    performance: '性能指标和资源使用',
    queries: '查询统计和分析'
  }
  return texts[viewType.value] || ''
}

const getStatusClass = () => {
  const status = clusterData.value.clusterStatus
  if (status === 2) return 'active'
  if (status === 1) return 'warning'
  return 'inactive'
}

const getStatusText = () => {
  const status = clusterData.value.clusterStatus
  if (status === 2) return '集群状态: 健康'
  if (status === 1) return '集群状态: 警告'
  return '集群状态: 错误'
}

const getJVMClass = (percent: number) => {
  if (percent < 60) return 'jvm-good'
  if (percent < 80) return 'jvm-warning'
  return 'jvm-critical'
}

const getCPUClass = (percent: number) => {
  if (percent < 50) return 'cpu-good'
  if (percent < 80) return 'cpu-warning'
  return 'cpu-critical'
}

const goBack = () => {
  router.push('/monitoring/services')
}

// 获取 OpenSearch 数据
const fetchOpenSearchData = async () => {
  try {
    const [statusResult, nodesResult, shardsResult, pendingResult,
           indicesResult, docsResult, storeSizeResult, segmentsResult,
           heapResult, cpuResult, diskTotalResult, diskAvailResult] = await Promise.all([
      prometheusService.query('opensearch_cluster_status'),
      prometheusService.query('opensearch_cluster_nodes'),
      prometheusService.query('opensearch_cluster_shards_active'),
      prometheusService.query('opensearch_cluster_pending_tasks'),
      prometheusService.query('opensearch_indices_count'),
      prometheusService.query('opensearch_indices_docs_count'),
      prometheusService.query('opensearch_indices_store_size_bytes'),
      prometheusService.query('opensearch_indices_segments_count'),
      prometheusService.query('opensearch_node_jvm_heap_used_percent'),
      prometheusService.query('opensearch_node_process_cpu_percent'),
      prometheusService.query('opensearch_node_disk_total_bytes'),
      prometheusService.query('opensearch_node_disk_available_bytes')
    ])
    
    clusterData.value = {
      clusterName: 'financial-data-cluster',
      clusterUuid: 'auto-generated',
      clusterStatus: parseFloat(statusResult[0]?.value[1] || '0'),
      nodesCount: parseFloat(nodesResult[0]?.value[1] || '0'),
      dataNodesCount: parseFloat(nodesResult[0]?.value[1] || '0'),
      activeShards: parseFloat(shardsResult[0]?.value[1] || '0'),
      activePrimaryShards: 0,
      relocatingShards: 0,
      initializingShards: 0,
      unassignedShards: 0,
      pendingTasks: parseFloat(pendingResult[0]?.value[1] || '0'),
      indicesCount: parseFloat(indicesResult[0]?.value[1] || '0'),
      docsCount: parseFloat(docsResult[0]?.value[1] || '0'),
      docsDeleted: 0,
      storeSize: parseFloat(storeSizeResult[0]?.value[1] || '0'),
      segmentsCount: parseFloat(segmentsResult[0]?.value[1] || '0'),
      nodes: heapResult.map((item: any, idx: number) => ({
        name: item.metric.node || `node-${idx + 1}`,
        jvmHeapUsed: 0,
        jvmHeapMax: 0,
        jvmHeapPercent: parseFloat(item.value[1] || '0'),
        cpuPercent: parseFloat(cpuResult[idx]?.value[1] || '0'),
        diskTotal: parseFloat(diskTotalResult[idx]?.value[1] || '0'),
        diskAvailable: parseFloat(diskAvailResult[idx]?.value[1] || '0')
      })),
      indices: []
    }
    
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    console.error('获取 OpenSearch 数据失败:', err)
  }
}

const startRefresh = () => {
  fetchOpenSearchData()
  refreshTimer = setInterval(fetchOpenSearchData, 10000)
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
.opensearch-detail-page {
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

          &.warning {
            background: #E6A23C;
            box-shadow: 0 0 6px #E6A23C;
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

  .cluster-health-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .health-card {
      background: rgba(50, 62, 85, 0.6);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);

      .card-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 8px;
      }

      .card-value {
        font-size: 20px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 4px;

        &.healthy {
          color: #67C23A;
        }

        &.warning {
          color: #E6A23C;
        }

        .value-sub {
          font-size: 13px;
          font-weight: normal;
          color: rgba(255, 255, 255, 0.55);
        }
      }

      .card-sub {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);

        .warning-text {
          color: #E6A23C;
        }

        .critical-text {
          color: #F56C6C;
          margin-left: 8px;
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
        }
      }
    }

    .node-list {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .node-item {
        .node-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .node-name {
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.85);
          }

          .node-type {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.45);
          }
        }

        .node-metrics {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .node-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;

            .metric-label {
              color: rgba(255, 255, 255, 0.55);
            }

            .metric-value {
              color: rgba(255, 255, 255, 0.85);
            }

            .progress-wrapper {
              display: flex;
              align-items: center;
              gap: 8px;
              flex: 1;
              justify-content: flex-end;

              .progress-bar {
                width: 100px;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                overflow: hidden;

                .progress-fill {
                  height: 100%;
                  transition: width 0.3s ease;

                  &.jvm-good {
                    background: #67C23A;
                  }

                  &.jvm-warning {
                    background: #E6A23C;
                  }

                  &.jvm-critical {
                    background: #F56C6C;
                  }
                }
              }

              .progress-text {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.85);
                min-width: 40px;
                text-align: right;
              }
            }
          }
        }
      }
    }
  }

  .performance-panels {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .jvm-list,
  .cpu-list,
  .disk-list {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .jvm-item,
    .cpu-item,
    .disk-item {
      .jvm-header,
      .disk-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;

        .node-name {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.65);
        }

        .jvm-percent,
        .disk-percent {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
        }
      }

      .node-name {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
      }

      .cpu-value {
        font-size: 13px;
        font-weight: 600;

        &.cpu-good {
          color: #67C23A;
        }

        &.cpu-warning {
          color: #E6A23C;
        }

        &.cpu-critical {
          color: #F56C6C;
        }
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 6px;

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;

          &.jvm-good {
            background: #67C23A;
          }

          &.jvm-warning {
            background: #E6A23C;
          }

          &.jvm-critical {
            background: #F56C6C;
          }
        }
      }

      .jvm-detail,
      .disk-detail {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
      }
    }

    .cpu-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .indices-table {
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

    .index-name {
      font-family: 'Courier New', monospace;
      color: #4facfe;
    }
  }

  .query-panels {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 20px;
  }

  .hot-queries-panel {
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

    .empty-state {
      text-align: center;
      padding: 40px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.45);
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











