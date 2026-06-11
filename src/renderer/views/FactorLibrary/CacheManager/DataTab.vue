<template>
  <div class="data-tab">
    <div class="panel">
      <!-- 工具栏 -->
      <div class="panel-head">
        <div class="panel-title">
          <span class="dot" />
          缓存数据（按 实例 + db）
          <el-tag type="info" size="small" effect="plain" round>{{ slots.length }} 个 db</el-tag>
        </div>
        <div class="panel-actions">
          <el-button :icon="MagicStick" round @click="openManualFlush">手动清空指定 db</el-button>
          <el-button :icon="Refresh" round @click="loadAll" :loading="loading">刷新</el-button>
        </div>
      </div>

      <div class="tab-intro">
        <el-icon><InfoFilled /></el-icon>
        <span>
          数据与配置解耦：这里按「实例 + db」管理实际写入 Redis 的缓存数据。
          <strong>清空（FLUSHDB）会整库清掉该 db 的全部数据，高危且不可恢复</strong>；即使配置已删除，残留数据也可在此清理。
        </span>
      </div>

      <!-- 数据列表（来自配置占用的 db） -->
      <el-table
        :data="slots"
        v-loading="loading"
        class="soft-table"
        size="default"
        :header-cell-style="headerCellStyle"
        :cell-style="cellStyle"
      >
        <el-table-column label="Redis 实例" min-width="150">
          <template #default="{ row }">
            <div class="ins-cell">
              <el-icon class="ins-icon"><Coin /></el-icon>
              <span>{{ row.instanceName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="db" align="center" width="90">
          <template #default="{ row }">
            <span class="db-chip">db{{ row.db }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Key 数" align="center" width="110">
          <template #default="{ row }">
            <span class="key-count">{{ formatNumber(row.keyCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="占用配置" min-width="150">
          <template #default="{ row }">
            <span v-if="!row.orphan" class="cfg-name">{{ row.name }}</span>
            <span v-else class="orphan">孤儿数据（无配置）</span>
          </template>
        </el-table-column>
        <el-table-column label="写入形态" align="center" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.shape" size="small" effect="plain" round
              :style="{ color: row.shape === 'array' ? '#8b5cf6' : '#3b82f6', border: 'none', background: row.shape === 'array' ? '#f5f3ff' : '#eff6ff' }">
              {{ row.shape === 'array' ? '聚合数组' : '逐行' }}
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="数据源" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <code v-if="row.source">{{ row.source }}</code>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="280">
          <template #default="{ row }">
            <div class="op-cell">
              <el-button size="small" round plain :icon="View" @click="openPreview(row)">预览</el-button>
              <el-tooltip v-if="row.orphan" content="无配置，不适用日历" placement="top">
                <span><el-button size="small" round plain :icon="Calendar" disabled>日历</el-button></span>
              </el-tooltip>
              <el-button v-else size="small" round plain :icon="Calendar" @click="openCalendar(row)">日历</el-button>
              <el-button size="small" round type="danger" plain :icon="Delete" @click="flushSlot(row)">清空</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && slots.length === 0" description="暂无缓存数据 db" :image-size="110" />
    </div>

    <!-- 手动清空指定 db 弹窗 -->
    <el-dialog
      v-model="manualVisible"
      width="460px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header danger">
          <el-icon><MagicStick /></el-icon>
          <span>手动清空指定 db</span>
        </div>
      </template>
      <el-form label-width="92px">
        <el-form-item label="Redis 实例">
          <el-select v-model="manualInstanceId" placeholder="选择实例" style="width: 100%;">
            <el-option
              v-for="ins in instances"
              :key="ins.id"
              :label="`${ins.name}（db ${ins.reserved_db_range}）`"
              :value="ins.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标 db">
          <el-input-number v-model="manualDb" :min="0" :max="999" controls-position="right" style="width: 100%;" />
        </el-form-item>
        <div v-if="manualDbRange" class="range-hint">
          可用范围：<strong>{{ manualDbRange }}</strong>
        </div>
        <div class="manual-warn">
          <el-icon><WarningFilled /></el-icon>
          将对所选实例的 db{{ manualDb ?? '?' }} 执行 FLUSHDB，清空全部数据，不可恢复。
        </div>
      </el-form>
      <template #footer>
        <el-button round @click="manualVisible = false">取消</el-button>
        <el-button type="danger" round :loading="manualSubmitting" @click="submitManualFlush">确定清空</el-button>
      </template>
    </el-dialog>

    <!-- 数据预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      width="760px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><View /></el-icon>
          <span>数据预览 · {{ previewSlot?.instanceName }} / db{{ previewSlot?.db }}</span>
        </div>
      </template>

      <!-- 统计卡 -->
      <div v-loading="statsLoading" class="stat-cards">
        <div class="stat-card">
          <div class="stat-label">Key 总数</div>
          <div class="stat-value">{{ stats ? formatNumber(stats.key_count) : '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">内存{{ stats?.memory_scope === 'instance' ? '（实例级）' : '' }}</div>
          <div class="stat-value">{{ stats?.memory_human || '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">TTL 抽样</div>
          <div class="stat-value sm">
            <span>永久 {{ stats?.sample?.no_ttl ?? '—' }}</span>
            <span>有期 {{ stats?.sample?.with_ttl ?? '—' }}</span>
          </div>
        </div>
      </div>

      <!-- key 浏览 -->
      <div class="key-browser">
        <div class="browser-bar">
          <el-input
            v-model="match"
            placeholder="匹配模式，如 600000:*"
            style="width: 260px;"
            @keyup.enter="reloadKeys"
          >
            <template #prepend>match</template>
          </el-input>
          <el-button :icon="Refresh" round @click="reloadKeys" :loading="keysLoading">查询</el-button>
        </div>

        <el-table
          :data="keyList"
          v-loading="keysLoading"
          class="soft-table"
          size="small"
          max-height="300"
          :header-cell-style="headerCellStyle"
          :cell-style="cellStyle"
        >
          <el-table-column label="Key" min-width="220" show-overflow-tooltip>
            <template #default="{ row }"><code>{{ row.key }}</code></template>
          </el-table-column>
          <el-table-column label="类型" align="center" width="90">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.type }}</el-tag></template>
          </el-table-column>
          <el-table-column label="TTL" align="center" width="90">
            <template #default="{ row }">{{ formatTtl(row.ttl) }}</template>
          </el-table-column>
          <el-table-column label="大小" align="center" width="90">
            <template #default="{ row }">{{ formatBytes(row.size_bytes) }}</template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="80">
            <template #default="{ row }">
              <el-link type="primary" :underline="false" @click="viewValue(row.key)">查看值</el-link>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!keysLoading && keyList.length === 0" description="无匹配的 key" :image-size="80" />

        <div class="browser-foot">
          <span class="muted">已加载 {{ keyList.length }} 个 key</span>
          <el-button
            v-if="hasMore"
            size="small"
            round
            :loading="keysLoading"
            @click="loadMoreKeys"
          >加载更多</el-button>
          <span v-else-if="keyList.length" class="muted">已全部加载</span>
        </div>
      </div>
    </el-dialog>

    <!-- 单个 key 的值 -->
    <el-dialog
      v-model="valueVisible"
      width="600px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><Document /></el-icon>
          <span>Key 值</span>
        </div>
      </template>
      <div v-loading="valueLoading" class="value-content">
        <template v-if="valueData">
          <div class="value-meta">
            <code class="vkey">{{ valueData.key }}</code>
            <div class="value-tags">
              <el-tag size="small" effect="plain">{{ valueData.type }}</el-tag>
              <el-tag size="small" effect="plain" type="info">TTL {{ formatTtl(valueData.ttl) }}</el-tag>
              <el-tag size="small" effect="plain" type="info">{{ formatBytes(valueData.size_bytes) }}</el-tag>
              <el-tag v-if="valueData.truncated" size="small" type="warning">已截断</el-tag>
            </div>
          </div>
          <pre class="json-block">{{ prettyValue(valueData.value) }}</pre>
        </template>
      </div>
    </el-dialog>

    <!-- 数据日历弹窗（按自然日，围绕该 db）-->
    <el-dialog
      v-model="calVisible"
      width="720px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><Calendar /></el-icon>
          <span>数据日历 · {{ calSlot?.name }}（db{{ calSlot?.db }}）</span>
        </div>
      </template>

      <div class="cal-bar">
        <el-date-picker
          v-model="calMonth"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          :clearable="false"
          style="width: 160px;"
          @change="loadCalendar"
        />
        <div v-if="calDatePartitioned !== false && calSummary.total_days" class="cal-summary">
          <span>自然日 <b>{{ calSummary.total_days }}</b></span>
          <span class="ok">有数据 <b>{{ calSummary.ok }}</b></span>
          <span class="gap">缺失 <b>{{ calSummary.missing }}</b></span>
        </div>
        <el-button
          v-if="missingDates.length > 0"
          type="warning"
          round
          size="small"
          :icon="MagicStick"
          :loading="backfilling"
          @click="backfillGaps"
        >补数缺口</el-button>
      </div>

      <div v-loading="calLoading" class="cal-body">
        <div v-if="calDatePartitioned === false" class="cal-na">
          <el-icon><WarningFilled /></el-icon>
          该配置的 key 无日期维度，不适用数据日历
        </div>
        <template v-else>
          <div class="cal-weekdays">
            <span v-for="w in WEEK_LABELS" :key="w">{{ w }}</span>
          </div>
          <div class="cal-grid">
            <div v-for="(cell, idx) in grid" :key="idx" class="cal-cell-wrap">
              <div v-if="cell.blank" class="cal-cell blank" />
              <div
                v-else
                class="cal-cell"
                :class="cell.status"
                @click="cell.status === 'missing' ? backfillDay(cell.date) : undefined"
              >
                <div class="cell-day">{{ cell.day }}</div>
                <div class="cell-info">
                  <span v-if="cell.status === 'ok'" class="cell-count">{{ formatNumber(cell.keyCount) }}</span>
                  <span v-else-if="cell.status === 'missing'" class="cell-missing">缺</span>
                </div>
              </div>
            </div>
          </div>
          <div class="cal-legend">
            <span class="lg"><i class="dot ok" />有数据</span>
            <span class="lg"><i class="dot missing" />缺失（点格子补数）</span>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Coin, Delete, MagicStick, InfoFilled, WarningFilled, View, Document, Calendar } from '@element-plus/icons-vue'

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
const instances = ref<any[]>([])
const definitions = ref<any[]>([])
const slots = ref<any[]>([])

const instanceName = (id: number) => {
  const ins = instances.value.find(i => i.id === id)
  return ins ? ins.name : `实例#${id}`
}

const parseRange = (range: string): [number, number] | null => {
  const m = String(range || '').match(/^(\d+)\s*-\s*(\d+)$/)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

// 以真实 Redis 占用的 db 为准列出，再用配置信息补充；无配置的 db 标为孤儿
const loadAll = async () => {
  loading.value = true
  try {
    const [insRes, defRes] = await Promise.all([
      window.electronAPI.marketData.listInstances(),
      window.electronAPI.marketData.listDefinitions()
    ])
    instances.value = insRes.success && insRes.data ? (insRes.data.instances || []) : []
    definitions.value = defRes.success && defRes.data ? (defRes.data.definitions || []) : []

    // 配置查找表：实例+db → 配置
    const defMap = new Map<string, any>()
    definitions.value.forEach(d => defMap.set(`${d.redis_instance_id}:${d.target_db}`, d))

    // 并行查每个实例实际非空的 db
    const perInstance = await Promise.all(
      instances.value.map(async (ins) => {
        const res = await window.electronAPI.marketData.instanceDbs(ins.id)
        const dbs = res.success && res.data ? (res.data.dbs || []) : []
        return dbs.map((entry: any) => {
          const def = defMap.get(`${ins.id}:${entry.db}`)
          return {
            instanceId: ins.id,
            instanceName: ins.name,
            db: entry.db,
            keyCount: entry.key_count,
            defId: def?.id ?? null,
            name: def?.name || '',
            shape: def?.shape || '',
            source: def ? (def.source_database ? `${def.source_database}.${def.source_table}` : def.source_table) : '',
            keyTemplate: def?.key_template || '',
            orphan: !def
          }
        })
      })
    )
    slots.value = perInstance.flat().sort((a, b) => (a.instanceId - b.instanceId) || (a.db - b.db))
  } catch (error: any) {
    ElMessage.error('加载数据失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const doFlush = async (instanceId: number, db: number, label: string) => {
  try {
    const res = await window.electronAPI.marketData.flushDb(instanceId, db)
    if (res.success) {
      ElMessage.success(res.data?.message || `已清空 ${label}`)
      return true
    }
    ElMessage.error(res.error || '清空数据失败')
    return false
  } catch (error: any) {
    ElMessage.error('清空数据失败: ' + error.message)
    return false
  }
}

const flushSlot = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `将清空实例「${row.instanceName}」的 db${row.db}${row.name ? `（配置：${row.name}）` : ''} 全部缓存数据（FLUSHDB，不可恢复）。确定继续？`,
      '清空数据确认',
      { confirmButtonText: '确定清空', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  await doFlush(row.instanceId, row.db, `db${row.db}`)
}

// 手动清空（用于孤儿数据）
const manualVisible = ref(false)
const manualSubmitting = ref(false)
const manualInstanceId = ref<number | undefined>(undefined)
const manualDb = ref<number | undefined>(undefined)

const manualDbRange = computed(() => {
  const ins = instances.value.find(i => i.id === manualInstanceId.value)
  return ins?.reserved_db_range || ''
})

const openManualFlush = () => {
  manualInstanceId.value = undefined
  manualDb.value = undefined
  manualVisible.value = true
}

const submitManualFlush = async () => {
  if (manualInstanceId.value === undefined) {
    ElMessage.warning('请选择 Redis 实例')
    return
  }
  if (manualDb.value === undefined || manualDb.value === null) {
    ElMessage.warning('请填写目标 db')
    return
  }
  const range = parseRange(manualDbRange.value)
  if (range && (manualDb.value < range[0] || manualDb.value > range[1])) {
    ElMessage.warning(`db 需在 ${range[0]}-${range[1]} 范围内`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `将对实例「${instanceName(manualInstanceId.value)}」的 db${manualDb.value} 执行 FLUSHDB，清空全部数据，不可恢复。确定继续？`,
      '清空数据确认',
      { confirmButtonText: '确定清空', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  manualSubmitting.value = true
  const ok = await doFlush(manualInstanceId.value, manualDb.value, `db${manualDb.value}`)
  manualSubmitting.value = false
  if (ok) manualVisible.value = false
}

// ===== 数据预览 =====
const formatNumber = (n: number) => (n ?? 0).toLocaleString('en-US')

const formatTtl = (ttl: number) => {
  if (ttl === -1 || ttl === undefined || ttl === null) return '永久'
  if (ttl === -2) return '不存在'
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`
  return `${Math.floor(ttl / 86400)}d`
}

const formatBytes = (b: number) => {
  if (!b && b !== 0) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const prettyValue = (val: any) => {
  if (val === null || val === undefined) return '(nil)'
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

const previewVisible = ref(false)
const previewSlot = ref<any>(null)
const stats = ref<any>(null)
const statsLoading = ref(false)
const match = ref('*')
const keyList = ref<any[]>([])
const cursor = ref('0')
const hasMore = ref(false)
const keysLoading = ref(false)

// 由 key_template 推导默认匹配前缀（取第一个 { 之前的固定段）
const deriveMatch = (keyTemplate: string) => {
  if (!keyTemplate) return '*'
  const prefix = keyTemplate.split('{')[0]
  return prefix ? `${prefix}*` : '*'
}

const openPreview = (row: any) => {
  previewSlot.value = row
  match.value = deriveMatch(row.keyTemplate)
  stats.value = null
  keyList.value = []
  cursor.value = '0'
  hasMore.value = false
  previewVisible.value = true
  loadStats()
  reloadKeys()
}

const loadStats = async () => {
  if (!previewSlot.value) return
  statsLoading.value = true
  try {
    const res = await window.electronAPI.marketData.dbStats(previewSlot.value.instanceId, previewSlot.value.db)
    if (res.success && res.data) {
      stats.value = res.data
    } else {
      ElMessage.error(res.error || '获取统计失败')
    }
  } catch (error: any) {
    ElMessage.error('获取统计失败: ' + error.message)
  } finally {
    statsLoading.value = false
  }
}

const fetchKeys = async (reset: boolean) => {
  if (!previewSlot.value) return
  keysLoading.value = true
  try {
    const res = await window.electronAPI.marketData.keys(previewSlot.value.instanceId, {
      db: previewSlot.value.db,
      match: match.value || '*',
      cursor: reset ? '0' : cursor.value,
      count: 50
    })
    if (res.success && res.data) {
      const batch = res.data.keys || []
      keyList.value = reset ? batch : keyList.value.concat(batch)
      cursor.value = String(res.data.cursor ?? '0')
      hasMore.value = cursor.value !== '0'
    } else {
      ElMessage.error(res.error || '浏览 key 失败')
    }
  } catch (error: any) {
    ElMessage.error('浏览 key 失败: ' + error.message)
  } finally {
    keysLoading.value = false
  }
}

const reloadKeys = () => fetchKeys(true)
const loadMoreKeys = () => fetchKeys(false)

// 单个 key 的值
const valueVisible = ref(false)
const valueLoading = ref(false)
const valueData = ref<any>(null)

const viewValue = async (key: string) => {
  if (!previewSlot.value) return
  valueVisible.value = true
  valueLoading.value = true
  valueData.value = null
  try {
    const res = await window.electronAPI.marketData.value(previewSlot.value.instanceId, previewSlot.value.db, key)
    if (res.success && res.data) {
      valueData.value = res.data
    } else {
      ElMessage.error(res.error || '取值失败')
      valueVisible.value = false
    }
  } catch (error: any) {
    ElMessage.error('取值失败: ' + error.message)
    valueVisible.value = false
  } finally {
    valueLoading.value = false
  }
}

// ===== 数据日历（按自然日，围绕该 db 对应的配置）=====
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const calVisible = ref(false)
const calLoading = ref(false)
const backfilling = ref(false)
const calSlot = ref<any>(null)
const calMonth = ref<string>(defaultMonth())
const calDatePartitioned = ref<boolean | null>(null)
const calDays = ref<any[]>([])
const calSummary = ref<{ total_days: number; ok: number; missing: number }>({ total_days: 0, ok: 0, missing: 0 })

function defaultMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const dayMap = computed(() => {
  const m = new Map<string, any>()
  calDays.value.forEach(d => m.set(d.date, d))
  return m
})

const missingDates = computed(() => calDays.value.filter(d => d.status === 'missing').map(d => d.date).sort())

const grid = computed(() => {
  if (!calMonth.value) return []
  const [y, m] = calMonth.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: any[] = []
  for (let i = 0; i < offset; i++) cells.push({ blank: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const entry = dayMap.value.get(date)
    cells.push({ day: d, date, status: entry?.status, keyCount: entry?.key_count })
  }
  return cells
})

const monthRange = () => {
  const [y, m] = calMonth.value.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

const openCalendar = (row: any) => {
  calSlot.value = row
  calMonth.value = defaultMonth()
  calDatePartitioned.value = null
  calDays.value = []
  calSummary.value = { total_days: 0, ok: 0, missing: 0 }
  calVisible.value = true
  loadCalendar()
}

const loadCalendar = async () => {
  if (!calSlot.value?.defId || !calMonth.value) return
  calLoading.value = true
  try {
    const { from, to } = monthRange()
    const res = await window.electronAPI.marketData.calendar(calSlot.value.defId, from, to)
    if (res.success && res.data) {
      calDatePartitioned.value = res.data.date_partitioned !== false
      calDays.value = res.data.days || []
      calSummary.value = res.data.summary || { total_days: 0, ok: 0, missing: 0 }
    } else {
      ElMessage.error(res.error || '获取数据日历失败')
    }
  } catch (error: any) {
    ElMessage.error('获取数据日历失败: ' + error.message)
  } finally {
    calLoading.value = false
  }
}

const triggerBackfill = async (from: string, to: string) => {
  if (!calSlot.value?.defId) return
  backfilling.value = true
  try {
    const res = await window.electronAPI.marketData.triggerSync(calSlot.value.defId, { mode: 'backfill', from, to })
    if (res.success) {
      ElMessage.success(res.data?.message || '已触发补数同步，请到「同步记录」查看进度')
    } else {
      ElMessage.error(res.error || '触发补数失败')
    }
  } catch (error: any) {
    ElMessage.error('触发补数失败: ' + error.message)
  } finally {
    backfilling.value = false
  }
}

const backfillDay = async (date: string) => {
  try {
    await ElMessageBox.confirm(`确定对 ${date} 触发补数同步？`, '补数确认', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return
  }
  await triggerBackfill(date, date)
}

const backfillGaps = async () => {
  if (missingDates.value.length === 0) return
  const from = missingDates.value[0]
  const to = missingDates.value[missingDates.value.length - 1]
  try {
    await ElMessageBox.confirm(
      `将对区间 ${from} ~ ${to} 触发补数同步（覆盖 ${missingDates.value.length} 个缺失日），确定继续？`,
      '补数确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await triggerBackfill(from, to)
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped lang="scss">
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
  }

  .panel-actions {
    display: flex;
    gap: 10px;
  }
}

.tab-intro {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2660c;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12px;
  margin: 0 2px 16px;

  strong { color: #b45309; }
  .el-icon { font-size: 16px; flex-shrink: 0; }
}

.muted { color: #94a3b8; }

.soft-table {
  --el-table-border-color: transparent;
  width: 100%;

  :deep(.el-table__inner-wrapper::before) { display: none; }
  :deep(td.el-table__cell) { border-bottom: 1px solid #f4f7fb; }
  :deep(.el-table__row:hover > td.el-table__cell) { background: #f7faff !important; }

  code {
    background: #f1f5f9;
    padding: 3px 8px;
    border-radius: 6px;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 12px;
    color: #475569;
  }

  .ins-cell {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    .ins-icon { color: #f59e0b; font-size: 16px; }
  }

  .db-chip {
    background: #eef2ff;
    color: #4f6ef0;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .cfg-name { font-weight: 600; color: #1e293b; }
  .orphan { color: #dc2626; font-size: 12px; }
  .key-count { font-weight: 600; color: #0f766e; font-family: 'SF Mono', 'Consolas', monospace; }
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;

  .el-icon { color: #3b82f6; font-size: 18px; }
  &.danger .el-icon { color: #ef4444; }
}

.range-hint {
  margin: -8px 0 12px 92px;
  font-size: 12px;
  color: #94a3b8;
  strong { color: #4f6ef0; }
}

.manual-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12px;

  .el-icon { color: #ef4444; flex-shrink: 0; }
}

.op-cell {
  display: inline-flex;
  gap: 8px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 18px;

  .stat-card {
    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    border-radius: 12px;
    padding: 14px 16px;

    .stat-label { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #1e293b;

      &.sm {
        font-size: 13px;
        font-weight: 500;
        color: #475569;
        display: flex;
        gap: 12px;
      }
    }
  }
}

.key-browser {
  .browser-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .browser-foot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 12px;

    .muted { color: #94a3b8; font-size: 12px; }
  }

  code {
    background: #f1f5f9;
    padding: 2px 7px;
    border-radius: 6px;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 12px;
    color: #475569;
  }
}

.cal-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  .cal-summary {
    display: flex;
    gap: 14px;
    font-size: 13px;
    color: #64748b;
    b { color: #1e293b; }
    .ok b { color: #16a34a; }
    .gap b { color: #dc2626; }
  }
}

.cal-body {
  min-height: 120px;

  .cal-na {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #d97706;
    background: #fffbeb;
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 13px;
  }

  .cal-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-bottom: 8px;
    span { text-align: center; font-size: 12px; font-weight: 600; color: #94a3b8; }
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }

  .cal-cell {
    aspect-ratio: 1 / 0.78;
    border-radius: 9px;
    border: 1px solid #eef2f7;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.15s;

    &.blank { border: none; background: transparent; }
    .cell-day { font-size: 12px; font-weight: 600; color: #475569; }
    .cell-count { font-size: 11px; font-family: 'SF Mono', 'Consolas', monospace; color: #16a34a; font-weight: 600; }
    .cell-missing { font-size: 11px; color: #dc2626; font-weight: 600; }

    &.ok { background: #f0fdf4; border-color: #bbf7d0; .cell-day { color: #166534; } }
    &.missing {
      background: #fef2f2; border-color: #fecaca; cursor: pointer;
      .cell-day { color: #b91c1c; }
      &:hover { background: #fee2e2; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(220,38,38,0.15); }
    }
  }

  .cal-legend {
    display: flex;
    gap: 20px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
    .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
    .dot { width: 12px; height: 12px; border-radius: 4px; }
    .dot.ok { background: #bbf7d0; border: 1px solid #86efac; }
    .dot.missing { background: #fecaca; border: 1px solid #fca5a5; }
  }
}

.value-content {
  min-height: 100px;

  .value-meta {
    margin-bottom: 12px;

    .vkey {
      display: block;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
      color: #334155;
      margin-bottom: 10px;
      word-break: break-all;
    }

    .value-tags { display: flex; gap: 8px; flex-wrap: wrap; }
  }

  .json-block {
    background: #0f172a;
    color: #e2e8f0;
    padding: 15px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    overflow: auto;
    max-height: 360px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
