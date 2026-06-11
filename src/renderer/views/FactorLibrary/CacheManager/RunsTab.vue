<template>
  <div class="runs-tab">
    <!-- 统计卡 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon all"><el-icon><List /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ runs.length }}</div>
          <div class="stat-label">记录总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon running"><el-icon><Loading /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ countBy('running') }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ countBy('success') }}</div>
          <div class="stat-label">成功</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon failed"><el-icon><CircleClose /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ countBy('failed') }}</div>
          <div class="stat-label">失败</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <!-- 工具栏 -->
      <div class="panel-head">
        <div class="panel-title">
          <span class="dot" />
          同步记录
          <el-tag v-if="polling" type="primary" size="small" effect="light" round class="poll-tag">
            <el-icon class="is-loading"><Loading /></el-icon>
            自动刷新中
          </el-tag>
        </div>
        <div class="panel-actions">
          <el-select
            v-model="filterDefinitionId"
            placeholder="按配置筛选"
            clearable
            filterable
            style="width: 200px;"
            @change="handleFilterChange"
          >
            <el-option v-for="def in definitions" :key="def.id" :label="def.name" :value="def.id" />
          </el-select>
          <el-button :icon="Refresh" round @click="loadRuns" :loading="loading">刷新</el-button>
        </div>
      </div>

      <!-- 运行记录列表 -->
      <el-table
        :data="runs"
        v-loading="loading"
        class="soft-table"
        size="default"
        :header-cell-style="headerCellStyle"
        :cell-style="cellStyle"
      >
        <el-table-column label="配置" min-width="130">
          <template #default="{ row }">
            <span class="def-name">{{ definitionName(row.definition_id) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="模式" align="center" width="100">
          <template #default="{ row }">
            <span class="mode-pill" :class="row.mode">{{ getModeName(row.mode) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="日期范围" align="center" min-width="170">
          <template #default="{ row }">
            <span class="date-range">{{ dateRangeText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="写入行数" align="center" width="120">
          <template #default="{ row }">
            <span v-if="row.rows !== null && row.rows !== undefined" class="rows-val">
              {{ formatNumber(row.rows) }}
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="120">
          <template #default="{ row }">
            <span class="status-badge" :class="row.status">
              <span class="status-dot" />
              {{ getStatusName(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" align="center" width="155">
          <template #default="{ row }"><span class="muted">{{ formatDate(row.started_at) }}</span></template>
        </el-table-column>
        <el-table-column label="结束时间" align="center" width="155">
          <template #default="{ row }"><span class="muted">{{ formatDate(row.finished_at) }}</span></template>
        </el-table-column>
        <el-table-column label="错误" min-width="110" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'failed' && row.error"
              size="small"
              text
              type="danger"
              @click="showError(row)"
            >查看错误</el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && runs.length === 0" description="暂无同步记录" :image-size="110" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Loading, List, CircleCheck, CircleClose } from '@element-plus/icons-vue'

const headerCellStyle = {
  background: 'transparent',
  color: '#94a3b8',
  fontWeight: 600,
  fontSize: '12px',
  padding: '14px 0',
  borderBottom: '1px solid #eef2f7'
}
const cellStyle = { padding: '14px 0', color: '#475569', fontSize: '13px' }

const loading = ref(false)
const runs = ref<any[]>([])
const definitions = ref<any[]>([])
const filterDefinitionId = ref<number | undefined>(undefined)
const polling = ref(false)
let pollTimer: number | null = null

const countBy = (status: string) => runs.value.filter(r => r.status === status).length

const MODE_MAP: Record<string, string> = { full: '全量', incr: '增量', backfill: '补数' }
const getModeName = (mode: string) => MODE_MAP[mode] || mode

const STATUS_MAP: Record<string, string> = {
  running: '运行中',
  success: '成功',
  failed: '失败'
}
const getStatusName = (status: string) => STATUS_MAP[status] || status

const definitionName = (id: number) => {
  const def = definitions.value.find(d => d.id === id)
  return def ? def.name : `配置#${id}`
}

const dateRangeText = (row: any) => {
  const from = row.date_from || ''
  const to = row.date_to || ''
  if (from && to) return from === to ? from : `${from} ~ ${to}`
  return to || from || '-'
}

const formatNumber = (n: number) => n.toLocaleString('en-US')

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const showError = (row: any) => {
  ElMessageBox.alert(row.error || '未知错误', '同步错误', {
    confirmButtonText: '确定',
    type: 'error'
  })
}

const loadDefinitions = async () => {
  try {
    const res = await window.electronAPI.marketData.listDefinitions()
    if (res.success && res.data) {
      definitions.value = res.data.definitions || []
    }
  } catch (e) {
    console.error('加载配置列表失败:', e)
  }
}

const loadRuns = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.marketData.listRuns({
      definition_id: filterDefinitionId.value || undefined,
      limit: 100
    })
    if (res.success && res.data) {
      runs.value = res.data.runs || []
      const hasRunning = runs.value.some(r => r.status === 'running')
      hasRunning ? startPolling() : stopPolling()
    } else {
      ElMessage.error(res.error || '获取同步记录失败')
    }
  } catch (error: any) {
    ElMessage.error('获取同步记录失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => {
  loadRuns()
}

const startPolling = () => {
  polling.value = true
  if (pollTimer) return
  pollTimer = window.setInterval(() => loadRuns(), 5000)
}

const stopPolling = () => {
  polling.value = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await loadDefinitions()
  loadRuns()
})
onUnmounted(() => stopPolling())
</script>

<style scoped lang="scss">
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;

  .stat-card {
    background: #fff;
    border-radius: 16px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 4px 24px rgba(15, 23, 42, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    }

    .stat-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: #fff;

      &.all { background: linear-gradient(135deg, #64748b, #94a3b8); }
      &.running { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
      &.success { background: linear-gradient(135deg, #16a34a, #4ade80); }
      &.failed { background: linear-gradient(135deg, #dc2626, #f87171); }
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1;
    }

    .stat-label {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 5px;
    }
  }
}

.panel {
  background: #fff;
  border-radius: 16px;
  padding: 6px 22px 18px;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.05);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 2px 10px;

  .panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
    }

    .poll-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.muted { color: #94a3b8; }

.soft-table {
  --el-table-border-color: transparent;
  width: 100%;

  :deep(.el-table__inner-wrapper::before) { display: none; }
  :deep(td.el-table__cell) { border-bottom: 1px solid #f4f7fb; }
  :deep(.el-table__row:hover > td.el-table__cell) { background: #f7faff !important; }

  .def-name { font-weight: 600; color: #1e293b; }

  .date-range { font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; color: #64748b; }

  .rows-val { font-weight: 700; color: #0f766e; font-family: 'SF Mono', 'Consolas', monospace; }

  .mode-pill {
    display: inline-block;
    padding: 3px 11px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;

    &.full { background: #fef2f2; color: #dc2626; }
    &.incr { background: #eff6ff; color: #2563eb; }
    &.backfill { background: #fffbeb; color: #d97706; }
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;

    .status-dot { width: 7px; height: 7px; border-radius: 50%; }

    &.running {
      background: #eff6ff; color: #2563eb;
      .status-dot { background: #3b82f6; animation: pulse 1.4s infinite; }
    }
    &.success {
      background: #ecfdf5; color: #16a34a;
      .status-dot { background: #22c55e; }
    }
    &.failed {
      background: #fef2f2; color: #dc2626;
      .status-dot { background: #ef4444; }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

@media (max-width: 900px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
