<template>
  <div class="api-gateway-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="small" :icon="ArrowLeft">返回</el-button>
        <div class="title-area">
          <h2>API 网关监控</h2>
          <p class="subtitle">纯数据管道架构 V2.0 - 提供 REST、WebSocket、gRPC 三种接入方式</p>
        </div>
      </div>
      <div class="header-right">
        <div class="status-info">
          <div class="status-dot" :class="apiStatus.health.rest ? 'active' : 'inactive'"></div>
          <span>最后更新: {{ lastUpdateTime }}</span>
        </div>
      </div>
    </div>

    <!-- 三个API服务卡片 -->
    <div class="api-services-grid">
      <!-- REST API -->
      <div class="api-card">
        <div class="api-header">
          <div class="api-info">
            <span class="api-icon">📡</span>
            <div>
              <h3>REST API</h3>
              <p>端口 8080 · 查询模式</p>
            </div>
          </div>
          <div class="status-dot" :class="apiStatus.health.rest ? 'active' : 'inactive'"></div>
        </div>

        <div class="api-body">
          <div class="metric-row">
            <span class="label">服务状态</span>
            <span class="value" :class="apiStatus.health.rest ? 'healthy' : 'error'">
              {{ apiStatus.health.rest ? '在线' : '离线' }}
            </span>
          </div>
          <div class="metric-row">
            <span class="label">协程数量</span>
            <span class="value">{{ apiStatus.metrics.goroutines }} <span class="unit">个</span></span>
          </div>
          <div class="metric-row">
            <span class="label">内存使用</span>
            <span class="value">{{ apiStatus.metrics.memoryMB.toFixed(1) }} <span class="unit">MB</span></span>
          </div>
          <div class="metric-row">
            <span class="label">GC次数</span>
            <span class="value">{{ apiStatus.metrics.gcCount }} <span class="unit">次</span></span>
          </div>
          <div class="metric-row">
            <span class="label">支持操作</span>
            <span class="value">查询/批量/扫描</span>
          </div>
        </div>

        <div class="api-footer">
          <div class="footer-title">数据覆盖:</div>
          <div class="footer-content">{{ apiStatus.catalog.markets.join('、') || '未知' }}</div>
        </div>

        <div class="api-tech">
          <div class="tech-item">
            <span class="tech-label">认证:</span>
            <span class="tech-value">API Key</span>
          </div>
          <div class="tech-item">
            <span class="tech-label">协议:</span>
            <span class="tech-value">HTTP/1.1</span>
          </div>
        </div>
      </div>

      <!-- WebSocket -->
      <div class="api-card">
        <div class="api-header">
          <div class="api-info">
            <span class="api-icon">🔌</span>
            <div>
              <h3>WebSocket</h3>
              <p>端口 8081 · 主推模式</p>
            </div>
          </div>
          <div class="status-dot" :class="apiStatus.health.websocket ? 'active' : 'inactive'"></div>
        </div>

        <div class="api-body">
          <div class="metric-row">
            <span class="label">服务状态</span>
            <span class="value" :class="apiStatus.health.websocket ? 'healthy' : 'unknown'">
              {{ apiStatus.health.websocket ? '在线' : '未知' }}
            </span>
          </div>
          <div class="metric-row">
            <span class="label">数据类型</span>
            <span class="value">{{ apiStatus.catalog.totalDataTypes }} <span class="unit">种</span></span>
          </div>
          <div class="metric-row">
            <span class="label">推送模式</span>
            <span class="value">Pattern订阅</span>
          </div>
          <div class="metric-row">
            <span class="label">连接限制</span>
            <span class="value">10000个</span>
          </div>
          <div class="metric-row">
            <span class="label">订阅限制</span>
            <span class="value">100个/连接</span>
          </div>
        </div>

        <div class="api-footer">
          <div class="footer-title">支持订阅:</div>
          <div class="footer-content code">decoded:*, raw:*</div>
        </div>

        <div class="api-tech">
          <div class="tech-item">
            <span class="tech-label">心跳:</span>
            <span class="tech-value">30s</span>
          </div>
          <div class="tech-item">
            <span class="tech-label">缓冲:</span>
            <span class="tech-value">4KB</span>
          </div>
        </div>
      </div>

      <!-- gRPC -->
      <div class="api-card">
        <div class="api-header">
          <div class="api-info">
            <span class="api-icon">⚡</span>
            <div>
              <h3>gRPC Service</h3>
              <p>端口 8082 · 双模式</p>
            </div>
          </div>
          <div class="status-dot" :class="apiStatus.health.grpc ? 'active' : 'inactive'"></div>
        </div>

        <div class="api-body">
          <div class="metric-row">
            <span class="label">服务状态</span>
            <span class="value" :class="apiStatus.health.grpc ? 'healthy' : 'unknown'">
              {{ apiStatus.health.grpc ? '在线' : '未知' }}
            </span>
          </div>
          <div class="metric-row">
            <span class="label">支持市场</span>
            <span class="value">{{ apiStatus.catalog.markets.length }} <span class="unit">个</span></span>
          </div>
          <div class="metric-row">
            <span class="label">RPC方法</span>
            <span class="value">6个</span>
          </div>
          <div class="metric-row">
            <span class="label">传输模式</span>
            <span class="value">流式/同步</span>
          </div>
          <div class="metric-row">
            <span class="label">消息限制</span>
            <span class="value">10MB</span>
          </div>
        </div>

        <div class="api-footer">
          <div class="footer-title">主要方法:</div>
          <div class="footer-content">Query, Subscribe, Scan</div>
        </div>

        <div class="api-tech">
          <div class="tech-item">
            <span class="tech-label">协议:</span>
            <span class="tech-value">HTTP/2</span>
          </div>
          <div class="tech-item">
            <span class="tech-label">编码:</span>
            <span class="tech-value">Protobuf</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时运行信息 -->
    <div class="runtime-panel">
      <h3>实时运行信息</h3>
      <div class="runtime-grid">
        <div class="runtime-item">
          <div class="runtime-label">进程状态</div>
          <div class="runtime-value healthy">
            {{ apiStatus.health.rest ? '运行中' : '未运行' }}
          </div>
        </div>
        <div class="runtime-item">
          <div class="runtime-label">Go协程</div>
          <div class="runtime-value">{{ apiStatus.metrics.goroutines }}</div>
        </div>
        <div class="runtime-item">
          <div class="runtime-label">内存占用</div>
          <div class="runtime-value">{{ apiStatus.metrics.memoryMB.toFixed(1) }} MB</div>
        </div>
        <div class="runtime-item">
          <div class="runtime-label">GC总次数</div>
          <div class="runtime-value">{{ apiStatus.metrics.gcCount }}</div>
        </div>
      </div>
    </div>

    <!-- API说明 -->
    <div class="api-description-panel">
      <h3>API网关说明</h3>
      <div class="description-grid">
        <div class="desc-item">
          <h4>REST API (8080)</h4>
          <ul>
            <li>• 标准HTTP接口，适合查询操作</li>
            <li>• 支持单个/批量查询和扫描</li>
            <li>• 同步请求-响应模式</li>
            <li>• 需要API Key认证</li>
          </ul>
        </div>
        <div class="desc-item">
          <h4>WebSocket (8081)</h4>
          <ul>
            <li>• 实时数据推送，低延迟</li>
            <li>• 支持订阅pattern模式</li>
            <li>• 双向通信，持久连接</li>
            <li>• 适合实时行情推送</li>
          </ul>
        </div>
        <div class="desc-item">
          <h4>gRPC (8082)</h4>
          <ul>
            <li>• 高性能RPC调用</li>
            <li>• 支持流式数据传输</li>
            <li>• 强类型接口定义</li>
            <li>• 适合系统间集成</li>
          </ul>
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
const lastUpdateTime = ref('--:--:--')
const apiStatus = ref({
  health: {
    rest: false,
    websocket: false,
    grpc: false
  },
  metrics: {
    goroutines: 0,
    memoryMB: 0,
    gcCount: 0
  },
  catalog: {
    totalDataTypes: 0,
    markets: [] as string[]
  }
})
let refreshTimer: NodeJS.Timeout | null = null

const goBack = () => {
  router.push('/monitoring/services')
}

// 获取 API Gateway 状态
const fetchAPIStatus = async () => {
  try {
    // 查询 API Gateway 的状态指标
    const upResult = await prometheusService.query('up{job="api_gateway"}')
    const isUp = upResult[0]?.value[1] === '1'
    
    apiStatus.value = {
      health: {
        rest: isUp,
        websocket: isUp,
        grpc: isUp
      },
      metrics: {
        goroutines: 156,  // 模拟数据
        memoryMB: 127.5,
        gcCount: 1234
      },
      catalog: {
        totalDataTypes: 59,
        markets: ['深圳市场', '上海市场', '期货市场', '期权市场']
      }
    }
    
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN')
  } catch (err) {
    console.error('获取 API Gateway 状态失败:', err)
  }
}

const startRefresh = () => {
  fetchAPIStatus()
  refreshTimer = setInterval(fetchAPIStatus, 10000)
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
.api-gateway-page {
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

  .api-services-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 24px;
  }

  .api-card {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 10px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);

    .api-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .api-info {
        display: flex;
        gap: 12px;

        .api-icon {
          font-size: 28px;
        }

        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #ffffff;
          font-weight: 600;
        }

        p {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
        }
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;

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

    .api-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;

      .metric-row {
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

          &.error {
            color: #F56C6C;
          }

          &.unknown {
            color: #909399;
          }

          .unit {
            font-size: 12px;
            font-weight: normal;
            color: rgba(255, 255, 255, 0.45);
          }
        }
      }
    }

    .api-footer {
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      margin-bottom: 12px;

      .footer-title {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        margin-bottom: 4px;
      }

      .footer-content {
        font-size: 12px;
        color: #4facfe;

        &.code {
          font-family: 'Courier New', monospace;
        }
      }
    }

    .api-tech {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;

      .tech-item {
        padding: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 11px;

        .tech-label {
          color: rgba(255, 255, 255, 0.45);
        }

        .tech-value {
          color: rgba(255, 255, 255, 0.85);
          margin-left: 4px;
        }
      }
    }
  }

  .runtime-panel {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 10px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 24px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #ffffff;
      font-weight: 600;
    }

    .runtime-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      .runtime-item {
        background: rgba(0, 0, 0, 0.2);
        padding: 14px;
        border-radius: 6px;

        .runtime-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-bottom: 8px;
        }

        .runtime-value {
          font-size: 18px;
          font-weight: 600;
          color: #ffffff;

          &.healthy {
            color: #67C23A;
          }
        }
      }
    }
  }

  .api-description-panel {
    background: rgba(50, 62, 85, 0.6);
    border-radius: 10px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #ffffff;
      font-weight: 600;
    }

    .description-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;

      .desc-item {
        h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
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












