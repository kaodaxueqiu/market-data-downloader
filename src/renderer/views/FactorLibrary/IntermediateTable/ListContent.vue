<template>
  <div class="list-content">
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
        <el-table :data="tableData" v-loading="loading" border>
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
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openTtlDialog(row)">修改 TTL</el-button>
          <el-button size="small" @click="handleRebuild(row)">重建</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span>暂无中间统计表，点击右上角「新建」创建</span>
      </template>
    </el-table>
      </el-scrollbar>
    </div>

    <CreateDialog v-model="createVisible" :rebuild-row="rebuildRow" @created="onCreated" />
    <TTLDialog v-model="ttlVisible" :row="ttlRow" @updated="loadList" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import CreateDialog from './CreateDialog.vue'
import TTLDialog from './TTLDialog.vue'
import type { IntermediateTableMeta } from '@/types/backtest'

const tableData = ref<IntermediateTableMeta[]>([])
const loading = ref(false)
const createVisible = ref(false)
const rebuildRow = ref<IntermediateTableMeta | null>(null)
const ttlVisible = ref(false)
const ttlRow = ref<IntermediateTableMeta | null>(null)

const loadList = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.intermediateTable.list()
    if (result.success) {
      // 后端响应：{ database, tables: [{ name, full_name, engine, size, total_rows, meta }] }
      const tables = result.data?.tables || []
      tableData.value = tables.map((t: any) => ({
        ...t.meta,
        full_name: t.full_name,
        engine: t.engine,
        size: t.size,
        total_rows: t.total_rows
      })) as IntermediateTableMeta[]
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
  // 后端返回 "2026-07-31 10:00:00" 或 ISO，统一替换 T 为空格
  return raw.replace('T', ' ').slice(0, 19)
}

onMounted(() => {
  loadList()
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
</style>
