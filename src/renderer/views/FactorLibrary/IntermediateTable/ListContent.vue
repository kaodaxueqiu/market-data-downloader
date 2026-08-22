<template>
  <div class="list-content">
    <!-- 加载中 -->
    <div v-if="pageLoading" class="loading-wrap">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <!-- 接口错误：重试页 -->
    <div v-else-if="initError" class="init-container">
      <div class="init-card">
        <p class="init-desc">无法连接服务器，请检查网络后重试</p>
        <el-button type="primary" @click="checkStatus">重新检查</el-button>
      </div>
    </div>

    <!-- 未初始化：引导页 -->
    <div v-else-if="!isInitialized" class="init-container">
      <div class="init-card">
        <div class="init-icon">
          <el-icon :size="80"><Coin /></el-icon>
        </div>
        <h2>初始化中间统计表工作区</h2>
        <p class="init-desc">
          在 ClickHouse 中为您创建独立的工作区库，<br>
          用于管理回测引擎物化的中间统计表。
        </p>
        <div class="init-info" v-if="dbStatus">
          <el-tag type="warning">{{ dbStatus.database }}</el-tag>
        </div>
        <el-button type="primary" size="large" :loading="initLoading" @click="handleInit">
          <el-icon><Plus /></el-icon>
          初始化工作区
        </el-button>
      </div>
    </div>

    <!-- 已初始化：原有列表内容 -->
    <template v-else>
    <div class="header-bar">
      <div class="header-left">
        <span class="page-title">中间统计表</span>
        <span class="page-subtitle">因子回测引擎物化的中间表管理</span>
      </div>
      <div class="header-right">
        <el-button :icon="Refresh" @click="loadList" :loading="loading">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建</el-button>
      </div>
    </div>

    <div class="content-card">
      <el-scrollbar>
        <el-table :data="tableData" v-loading="loading" border :row-class-name="rowClassName">
      <el-table-column prop="full_name" label="表名" min-width="220" show-overflow-tooltip />
      <el-table-column label="指纹" width="130">
        <template #default="{ row }">
          <el-tooltip :content="row.fingerprint" placement="top" :disabled="!row.fingerprint">
            <span class="fingerprint-cell">{{ row.fingerprint ? row.fingerprint.slice(0, 16) : '—' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="用户命名" width="120">
        <template #default="{ row }">
          <span v-if="row.user_name">{{ row.user_name }}</span>
          <span v-else style="color: #909399;">指纹命名</span>
        </template>
      </el-table-column>
      <el-table-column label="源表" min-width="180">
        <template #default="{ row }">
          <div v-if="row.source_tables && row.source_tables.length" class="source-tags">
            <el-tag v-for="t in row.source_tables" :key="t" size="small" type="info" class="src-tag">{{ t }}</el-tag>
          </div>
          <span v-else style="color: #909399;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="TTL 策略" width="140">
        <template #default="{ row }">
          <el-tag :type="ttlTagType(row.ttl_strategy)" size="small">{{ ttlStrategyLabel(row.ttl_strategy) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="TTL 值" width="100">
        <template #default="{ row }">
          <span v-if="row.ttl_raw">{{ row.ttl_raw }}</span>
          <span v-else style="color: #909399;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="到期时间" width="170">
        <template #default="{ row }">
          <span v-if="row.ttl_deadline">{{ formatTime(row.ttl_deadline) }}</span>
          <span v-else style="color: #909399;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="行数" width="100">
        <template #default="{ row }">
          {{ row.total_rows ?? '—' }}
        </template>
      </el-table-column>
      <el-table-column label="大小" width="100">
        <template #default="{ row }">
          {{ row.size ?? '—' }}
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatTime(row.updated_at) }}
        </template>
      </el-table-column>
      <!-- 建表进度列 -->
      <el-table-column label="建表进度" width="280" fixed="right">
        <template #default="{ row }">
          <div v-if="row._building" class="cell-building">
            <el-progress
              :percentage="row._building.progress"
              :status="row._building.status === 'failed' ? 'exception' : row._building.status === 'completed' ? 'success' : undefined"
              :stroke-width="8"
              :indeterminate="row._building.stage === 'queued'"
              :show-text="row._building.stage !== 'queued'"
            />
            <div class="cell-building-detail">
              <span class="cell-stage">{{ stageLabel(row._building.stage) }}</span>
              <span class="cell-detail-text">{{ row._building.detail }}</span>
            </div>
            <div v-if="row._building.read_rows || row._building.read_bytes || row._building.elapsed_secs" class="cell-stats">
              <span v-if="row._building.elapsed_secs">耗时 {{ row._building.elapsed_secs.toFixed(1) }}s</span>
              <span v-if="row._building.read_rows">已读 {{ formatRows(row._building.read_rows) }} 行</span>
              <span v-if="row._building.read_bytes">已读 {{ formatBytes(row._building.read_bytes) }}</span>
            </div>
          </div>
          <span v-else style="color: #c0c4cc;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, row)">
            <el-button size="small" :disabled="!!row._building">
              操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="dedup">去重元数据</el-dropdown-item>
                <el-dropdown-item command="ttl" :disabled="!!row._building">修改 TTL</el-dropdown-item>
                <el-dropdown-item command="rebuild" :disabled="!!row._building">重建</el-dropdown-item>
                <el-dropdown-item command="delete" :disabled="!!row._building" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
      <template #empty>
        <span>暂无中间统计表，点击右上角「新建」创建</span>
      </template>
    </el-table>
      </el-scrollbar>
    </div>

    <CreateDialog v-model="createVisible" :rebuild-row="rebuildRow" @created="onCreated" @building="onBuilding" />
    <TTLDialog v-model="ttlVisible" :row="ttlRow" @updated="loadList" />
    </template>
  </div>
</template>

<!-- 模块级 script：定义类型 + 跨实例存活的变量 -->
<script lang="ts">
export interface BuildingState {
  build_id: string
  status: string
  stage: string
  progress: number
  detail: string
  elapsed_secs: number | null
  read_rows: number | null
  read_bytes: number | null
}

interface BuildingEntry {
  build_id: string
  table_name: string
  is_rebuild: boolean
  state: BuildingState
  timer: ReturnType<typeof setInterval> | null
}

// 模块级 Map：组件卸载/重挂不丢失
const activeBuilds = new Map<string, BuildingEntry>()
</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Loading, Coin, ArrowDown } from '@element-plus/icons-vue'
import CreateDialog from './CreateDialog.vue'
import TTLDialog from './TTLDialog.vue'
import type { IntermediateTableMeta } from '@/types/backtest'

const tableData = ref<(IntermediateTableMeta & { _building?: BuildingState })[]>([])
const loading = ref(false)
const createVisible = ref(false)
const rebuildRow = ref<IntermediateTableMeta | null>(null)
const ttlVisible = ref(false)
const ttlRow = ref<IntermediateTableMeta | null>(null)

// 四态状态
const pageLoading = ref(true)
const initLoading = ref(false)
const isInitialized = ref(false)
const initError = ref(false)
const dbStatus = ref<{ initialized: boolean; database: string; factor_user?: string } | null>(null)

const stageLabels: Record<string, string> = {
  queued: '已排队',
  validating: '校验中',
  checking_existing: '检查表',
  executing_ddl: '执行 DDL',
  writing_metadata: '写入元数据',
  completed: '已完成'
}
const stageLabel = (stage: string) => stageLabels[stage] ?? stage

const formatRows = (n: number) => {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万'
  return n.toString()
}
const formatBytes = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

const rowClassName = ({ row }: { row: any }) => {
  if (row._building) return 'building-row'
  return ''
}

/** 启动轮询（通过 table_name 查找行，不依赖 rowIndex） */
const startPolling = (build_id: string) => {
  const entry = activeBuilds.get(build_id)
  if (!entry) return
  if (entry.timer) clearInterval(entry.timer)

  const timer = setInterval(async () => {
    const status = await window.electronAPI.intermediateTable.buildStatus(build_id)
    if (!status.success) return
    const s = status.data
    entry.state = {
      build_id,
      status: s.status,
      stage: s.stage,
      progress: s.progress ?? 0,
      detail: s.detail ?? '',
      elapsed_secs: s.elapsed_secs ?? null,
      read_rows: s.read_rows ?? null,
      read_bytes: s.read_bytes ?? null
    }
    // 同步到表格行
    const idx = tableData.value.findIndex(r =>
      r.full_name === entry.table_name || r.table_name === entry.table_name
    )
    if (idx >= 0) {
      tableData.value[idx]._building = { ...entry.state }
    }
    if (s.status === 'completed') {
      clearInterval(timer)
      entry.timer = null
      // 不立即刷新，保留已完成状态在临时行上让用户看到
      ElMessage.success('建表完成')
      // 延迟 3 秒再刷新列表，用户能看到绿色已完成
      setTimeout(() => loadList(), 3000)
    } else if (s.status === 'failed') {
      clearInterval(timer)
      entry.timer = null
      // 保留 failed 状态在临时行上，不刷新
      ElMessageBox.alert(s.error || s.detail || '建表失败', '建表失败', {
        confirmButtonText: '关闭',
        type: 'error'
      })
    }
  }, 1500)
  entry.timer = timer
}

const onBuilding = (payload: { build_id: string; table_name: string; is_rebuild: boolean }) => {
  createVisible.value = false
  rebuildRow.value = null

  const { build_id, table_name, is_rebuild } = payload
  const state: BuildingState = {
    build_id,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    detail: '已排队，等待开始',
    elapsed_secs: null,
    read_rows: null,
    read_bytes: null
  }

  const entry: BuildingEntry = { build_id, table_name, is_rebuild, state, timer: null }
  activeBuilds.set(build_id, entry)

  if (is_rebuild) {
    const idx = tableData.value.findIndex(r =>
      r.full_name === table_name || r.table_name === table_name
    )
    if (idx >= 0) {
      tableData.value[idx]._building = state
    }
  } else {
    const tempRow: any = {
      full_name: table_name,
      table_name: table_name,
      user_name: '',
      fingerprint: '',
      source_tables: [],
      ttl_strategy: 'permanent',
      ttl_raw: '',
      ttl_deadline: '',
      total_rows: null,
      size: null,
      updated_at: '',
      _building: state
    }
    tableData.value.unshift(tempRow)
  }
  startPolling(build_id)
}

/** 组件卸载时只停定时器，保留 activeBuilds 数据 */
const stopAllTimers = () => {
  activeBuilds.forEach((entry) => {
    if (entry.timer) {
      clearInterval(entry.timer)
      entry.timer = null
    }
  })
}

/** 按表名查找行：先精确匹配，再按后缀匹配（库名前缀可能不同） */
const findRowIdx = (tableName: string) => {
  let idx = tableData.value.findIndex(r =>
    r.full_name === tableName || r.table_name === tableName
  )
  if (idx >= 0) return idx
  const suffix = tableName.split('.').pop()
  if (suffix && suffix !== '生成中...') {
    idx = tableData.value.findIndex(r => {
      const rSuffix = (r.full_name || r.table_name || '').split('.').pop()
      return rSuffix === suffix && rSuffix
    })
  }
  return idx
}

/** 恢复建表状态到表格（loadList 后调用） */
const resumeBuilds = () => {
  const toDelete: string[] = []
  activeBuilds.forEach((entry) => {
    if (entry.state.status === 'completed' || entry.state.status === 'failed') {
      // 已完成/失败：标记真实行后删除
      const idx = findRowIdx(entry.table_name)
      if (idx >= 0) {
        tableData.value[idx]._building = { ...entry.state }
      }
      toDelete.push(entry.build_id)
      return
    }
    // 进行中：同步状态到表格 + 重启轮询
    const idx = findRowIdx(entry.table_name)
    if (idx >= 0) {
      tableData.value[idx]._building = { ...entry.state }
    } else {
      // 临时行被 loadList 覆盖了，重新插入
      const tempRow: any = {
        full_name: entry.table_name,
        table_name: entry.table_name,
        user_name: '',
        fingerprint: '',
        source_tables: [],
        ttl_strategy: 'permanent',
        ttl_raw: '',
        ttl_deadline: '',
        total_rows: null,
        size: null,
        updated_at: '',
        _building: { ...entry.state }
      }
      tableData.value.unshift(tempRow)
    }
    startPolling(entry.build_id)
  })
  toDelete.forEach(id => activeBuilds.delete(id))
}

onBeforeUnmount(() => {
  stopAllTimers()
})

const checkStatus = async () => {
  pageLoading.value = true
  initError.value = false
  try {
    const result = await window.electronAPI.intermediateTable.status()
    if (result.success && result.data) {
      dbStatus.value = result.data
      isInitialized.value = result.data.initialized
      if (isInitialized.value) {
        await loadList()
      }
    } else {
      initError.value = true
      ElMessage.error(result.error || '检查工作区状态失败')
    }
  } catch (e: any) {
    initError.value = true
    ElMessage.error(e.message || '检查工作区状态失败')
  } finally {
    pageLoading.value = false
  }
}

const handleInit = async () => {
  initLoading.value = true
  try {
    const result = await window.electronAPI.intermediateTable.init()
    if (result.success) {
      ElMessage.success(result.message || '初始化成功')
      await checkStatus()
    } else {
      ElMessage.error(result.error || '初始化失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '初始化失败')
  } finally {
    initLoading.value = false
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.intermediateTable.list()
    if (result.success) {
      const tables = result.data?.tables || []
      tableData.value = tables.map((t: any) => ({
        ...t.meta,
        full_name: t.full_name,
        engine: t.engine,
        size: t.size,
        total_rows: t.total_rows
      })) as IntermediateTableMeta[]
      // 刷新后恢复建表状态
      resumeBuilds()
    } else {
      ElMessage.error(result.error || '加载列表失败')
    }
  } catch (e: any) {
    ElMessage.error('加载列表失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  rebuildRow.value = null
  createVisible.value = true
}

const onCreated = () => {
  createVisible.value = false
  rebuildRow.value = null
  loadList()
}

const openTtlDialog = (row: IntermediateTableMeta) => {
  ttlRow.value = row
  ttlVisible.value = true
}

const handleAction = (cmd: string, row: IntermediateTableMeta) => {
  switch (cmd) {
    case 'dedup': handleDedup(); break
    case 'ttl': openTtlDialog(row); break
    case 'rebuild': handleRebuild(row); break
    case 'delete': handleDelete(row); break
  }
}

const handleDedup = async () => {
  const result = await window.electronAPI.intermediateTable.dedup()
  if (result.success) {
    ElMessage.success(result.data?.message || `已去重 ${result.data?.deduped?.length || 0} 个表名`)
    loadList()
  } else {
    ElMessage.error(result.error || '去重失败')
  }
}

const handleRebuild = (row: IntermediateTableMeta) => {
  rebuildRow.value = row
  createVisible.value = true
}

const handleDelete = async (row: IntermediateTableMeta) => {
  try {
    await ElMessageBox.confirm(
      `确认删除中间统计表「${row.full_name || row.table_name}」？删除后不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch { return }
  const result = await window.electronAPI.intermediateTable.delete(row.full_name || row.table_name)
  if (result.success) {
    ElMessage.success('已删除')
    await loadList()
  } else {
    ElMessage.error(result.error || '删除失败')
  }
}

const ttlTagType = (strategy: string): 'primary' | 'success' | 'warning' => {
  if (strategy === 'permanent') return 'primary'
  if (strategy === 'clickhouse_ttl') return 'success'
  if (strategy === 'metadata_driven') return 'warning'
  return 'primary'
}

const ttlStrategyLabel = (strategy: string): string => {
  const map: Record<string, string> = {
    permanent: '永久',
    clickhouse_ttl: 'TTL',
    metadata_driven: '元数据驱动'
  }
  return map[strategy] || strategy
}

const formatTime = (raw: string): string => {
  if (!raw) return '—'
  return raw.replace('T', ' ').slice(0, 19)
}

onMounted(() => {
  checkStatus()
})
</script>

<style scoped>
.list-content {
  padding-top: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 10px;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.page-subtitle {
  font-size: 13px;
  color: #909399;
}
.header-right {
  display: flex;
  gap: 8px;
}
.content-card {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  padding: 16px 20px;
  margin: 10px 10px 0 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fingerprint-cell {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #6b7280;
}
.source-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.src-tag {
  margin: 0;
}
.loading-wrap, .init-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}
.init-card {
  text-align: center;
  max-width: 480px;
}
.init-icon {
  color: #67C23A;
  margin-bottom: 16px;
}
.init-desc {
  color: #606266;
  line-height: 1.8;
  margin: 12px 0 20px;
}
.init-info {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;
}

/* 建表进度列样式 */
.cell-building {
  padding: 4px 0;
}
.cell-building-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
}
.cell-stage {
  flex-shrink: 0;
  padding: 1px 6px;
  background: #e6f0ff;
  color: #409eff;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
}
.cell-detail-text {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-stats {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  font-size: 11px;
  color: #909399;
}
</style>

<style>
/* 建表中的行高亮 */
.el-table .building-row {
  background-color: #f0f9ff !important;
}
.el-table .building-row:hover > td {
  background-color: #e6f4ff !important;
}
</style>
