<template>
  <div class="admitted-factors-page">
    <div class="page-header">
      <div>
        <h2>已入库因子</h2>
        <p>仅展示当前账号名下因子；迭代因子请使用升级模式</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <el-alert
      v-if="loadError"
      class="load-error"
      type="error"
      :title="loadError"
      :closable="false"
      show-icon
    />

    <div class="card main-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="已入库因子" name="factors">
          <div class="toolbar">
            <el-select v-model="admissionPool" style="width: 180px" @change="loadData">
              <el-option
                v-for="pool in poolOptions"
                :key="pool.value"
                :label="pool.label"
                :value="pool.value"
              />
            </el-select>
            <el-input
              v-model="keyword"
              clearable
              :prefix-icon="Search"
              placeholder="搜索因子名称或 ID"
              class="search-input"
            />
            <span class="muted">共 {{ filteredFactors.length }} 个</span>
          </div>
          <el-table v-loading="loading" :data="filteredFactors" stripe size="small">
            <el-table-column label="名称 / ID" min-width="190" fixed="left">
              <template #default="{ row }">
                <div class="factor-name">{{ row.factor_name }}</div>
                <div class="factor-id">{{ row.factor_id }}</div>
              </template>
            </el-table-column>
            <el-table-column label="池" min-width="110">
              <template #default="{ row }">
                <el-tag size="small" type="info" effect="plain">{{ poolLabel(row.pool) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="版本" min-width="100">
              <template #default="{ row }">
                <div>v{{ row.current_version ?? '-' }}</div>
                <div v-if="row.version_count" class="factor-id">历史 {{ row.version_count }} 版</div>
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="90">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'superseded'" size="small" type="info">已升级</el-tag>
                <el-tag v-else-if="row.status === 'failed'" size="small" type="danger">失败</el-tag>
                <el-tag v-else size="small" type="success">生效中</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="入库时间" min-width="150">
              <template #default="{ row }">{{ formatDate(row.admitted_at) }}</template>
            </el-table-column>
            <el-table-column label="覆盖区间" min-width="180">
              <template #default="{ row }">{{ row.date_from || '-' }} 至 {{ row.date_to || '-' }}</template>
            </el-table-column>
            <el-table-column label="行数" min-width="100" align="right">
              <template #default="{ row }">{{ formatInteger(row.row_count) }}</template>
            </el-table-column>
            <el-table-column label="股票数" min-width="90" align="right">
              <template #default="{ row }">{{ formatInteger(row.stock_count) }}</template>
            </el-table-column>
            <el-table-column label="超额夏普" min-width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.metrics?.excess_sharpe) }}</template>
            </el-table-column>
            <el-table-column label="年化超额" min-width="100" align="right">
              <template #default="{ row }">{{ formatPercent(row.metrics?.excess_annual_return) }}</template>
            </el-table-column>
            <el-table-column label="年化换手" min-width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.metrics?.turnover_annual) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row.factor_id)">详情</el-button>
                <el-button link type="primary" @click="goUpgrade(row)">升级因子</el-button>
                <el-button link type="primary" @click="viewResult(row.admitted_task_id)">查看回测结果</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="keyword ? '没有匹配的因子' : '暂无已入库因子'" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-drawer v-model="detailVisible" title="因子详情" size="680px">
      <div v-loading="detailLoading" class="detail-body">
        <el-alert v-if="detailError" type="error" :title="detailError" :closable="false" show-icon />
        <template v-if="detail">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="因子名称">{{ detail.factor_name }}</el-descriptions-item>
            <el-descriptions-item label="因子 ID">{{ detail.factor_id }}</el-descriptions-item>
            <el-descriptions-item label="所属账号">{{ detail.owner_id }}</el-descriptions-item>
            <el-descriptions-item label="审核池">{{ poolLabel(detail.pool) }}</el-descriptions-item>
            <el-descriptions-item label="当前版本">v{{ detail.current_version ?? '-' }}（历史 {{ detail.version_count ?? '-' }} 版）</el-descriptions-item>
            <el-descriptions-item label="owner_source">{{ detail.owner_source || '-' }}</el-descriptions-item>
            <el-descriptions-item label="入库任务 ID">{{ detail.admitted_task_id }}</el-descriptions-item>
            <el-descriptions-item label="入库时间">{{ formatDate(detail.admitted_at) }}</el-descriptions-item>
            <el-descriptions-item label="开始日期">{{ detail.date_from || '-' }}</el-descriptions-item>
            <el-descriptions-item label="结束日期">{{ detail.date_to || '-' }}</el-descriptions-item>
            <el-descriptions-item label="行数">{{ formatInteger(detail.row_count) }}</el-descriptions-item>
            <el-descriptions-item label="股票数">{{ formatInteger(detail.stock_count) }}</el-descriptions-item>
            <el-descriptions-item label="超额夏普">{{ formatNumber(detail.metrics?.excess_sharpe) }}</el-descriptions-item>
            <el-descriptions-item label="年化超额">{{ formatPercent(detail.metrics?.excess_annual_return) }}</el-descriptions-item>
            <el-descriptions-item label="年化换手">{{ formatNumber(detail.metrics?.turnover_annual) }}</el-descriptions-item>
            <el-descriptions-item label="RankIC 均值">{{ formatNumber(detail.metrics?.rank_ic_mean) }}</el-descriptions-item>
            <el-descriptions-item label="IC 均值">{{ formatNumber(detail.metrics?.ic_mean) }}</el-descriptions-item>
          </el-descriptions>

          <el-collapse v-if="detailVersions.length || detailEvents.length" class="detail-collapse">
            <el-collapse-item v-if="detailVersions.length" :title="`版本时间线（${detailVersions.length}）`" name="versions">
              <el-timeline>
                <el-timeline-item
                  v-for="ver in detailVersions"
                  :key="ver.version"
                  :type="ver.status === 'active' ? 'success' : 'info'"
                  :timestamp="formatDate(ver.admitted_at)"
                >
                  <div class="timeline-title">
                    <strong>v{{ ver.version }}</strong>
                    <el-tag v-if="ver.status === 'active'" size="small" type="success">生效中</el-tag>
                    <el-tag v-else-if="ver.status === 'superseded'" size="small" type="info">已升级</el-tag>
                    <el-tag v-else size="small" type="danger">失败</el-tag>
                    <span v-if="ver.parent_version != null" class="muted">由 v{{ ver.parent_version }} 升级</span>
                  </div>
                  <div class="timeline-meta">
                    判定 {{ ver.decision }} · 配置 {{ ver.config_version || '-' }}
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="viewResult(ver.task_id)"
                    >任务 {{ ver.task_id }}</el-button>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </el-collapse-item>
            <el-collapse-item v-if="detailEvents.length" :title="`事件时间线（${detailEvents.length}）`" name="events">
              <el-timeline>
                <el-timeline-item
                  v-for="(evt, idx) in detailEvents"
                  :key="idx"
                  :timestamp="formatDate(evt.created_at)"
                >
                  <div class="timeline-title">
                    <strong>{{ eventLabel(evt.event) }}</strong>
                    <span v-if="evt.from_version != null || evt.to_version != null" class="muted">
                      v{{ evt.from_version ?? '-' }} → v{{ evt.to_version ?? '-' }}
                    </span>
                  </div>
                  <div v-if="evt.task_id" class="timeline-meta">任务 {{ evt.task_id }}</div>
                  <div v-if="evt.detail?.reject_reasons?.length" class="timeline-meta">
                    <div v-for="(reason, ridx) in evt.detail.reject_reasons" :key="ridx" class="reject-reason">- {{ reason }}</div>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </el-collapse-item>
          </el-collapse>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import type {
  AdmittedFactorListResponse,
  AdmittedFactor,
  AdmittedFactorVersion,
  AdmittedFactorEvent
} from '@/types/backtest'

const router = useRouter()
const loading = ref(false)
const loadError = ref('')
const factors = ref<AdmittedFactor[]>([])
const keyword = ref('')
const activeTab = ref('factors')

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detail = ref<AdmittedFactor | null>(null)
const detailVersions = ref<AdmittedFactorVersion[]>([])
const detailEvents = ref<AdmittedFactorEvent[]>([])

// ---- 审核池 ----
const admissionPool = ref('csi1000')
const poolOptions = ref<Array<{ value: string; label: string }>>([{ value: 'csi1000', label: '中证1000 (csi1000)' }])

const poolLabel = (pool?: string) => {
  if (!pool) return 'csi1000'
  const found = poolOptions.value.find(p => p.value === pool)
  return found ? found.label : pool
}

// 轻量解析 admission yaml 中的 pools 键（缩进两层：pools: 下每池 key: label: xx）
const parseAdmissionPools = (yaml: string) => {
  const pools: Array<{ value: string; label: string }> = []
  const lines = yaml.split(/\r?\n/)
  let inPools = false
  let poolsIndent = -1
  let currentPool = ''
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ')
    if (!line.trim() || line.trim().startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    const trimmed = line.trim()
    if (trimmed.startsWith('pools:')) {
      inPools = true
      poolsIndent = indent
      continue
    }
    if (inPools && indent <= poolsIndent) { inPools = false; continue }
    if (!inPools) continue
    // 池 key 行（缩进一层）
    if (indent > poolsIndent && /^[A-Za-z0-9_]+:\s*$/.test(trimmed)) {
      currentPool = trimmed.replace(/:$/, '')
      pools.push({ value: currentPool, label: currentPool })
    } else if (currentPool && /^label:\s*(.+)$/.test(trimmed)) {
      const label = trimmed.match(/^label:\s*(.+)$/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
      if (label) {
        const found = pools.find(p => p.value === currentPool)
        if (found) found.label = label
      }
    }
  }
  return pools
}

const loadPoolOptions = async () => {
  try {
    const result = await window.electronAPI.backtest.getAdmissionConfig()
    if (result.success && result.data?.yaml) {
      const pools = parseAdmissionPools(result.data.yaml)
      if (pools.length) {
        poolOptions.value = pools
        // 默认值 csi1000 不在 v3 池列表时，回退到第一个池
        if (!pools.some(p => p.value === admissionPool.value)) {
          admissionPool.value = pools[0].value
        }
      }
    }
  } catch {
    // 读��失败保持默认 csi1000
  }
}

const filteredFactors = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return factors.value
  return factors.value.filter(factor =>
    factor.factor_name.toLowerCase().includes(search) || factor.factor_id.toLowerCase().includes(search)
  )
})

const formatNumber = (value?: number | null, digits = 4) => {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toFixed(digits).replace(/\.?0+$/, '')
}
const formatPercent = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${formatNumber(value * 100, 2)}%`
}
const formatInteger = (value?: number | null) =>
  value == null ? '-' : value.toLocaleString('zh-CN')
const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
const eventLabel = (event: string) => ({
  admitted: '首次入库',
  upgraded: '升级通过',
  upgrade_rejected: '升级被拒',
  upgrade_failed: '写库失败'
} as Record<string, string>)[event] || event

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const viewResult = (taskId: string) => router.push(`/factor-library/backtest/result/${taskId}`)

const goUpgrade = (row: AdmittedFactor) => {
  router.push({
    path: '/factor-library/backtest/submit',
    query: { mode: 'upgrade', pool: row.pool || admissionPool.value, target_factor_id: row.factor_id }
  })
}

const loadData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await window.electronAPI.backtest.listAdmittedFactors(admissionPool.value)
    if (!result.success || !result.data) throw new Error(result.error || '加载已入库因子失败')
    const data: AdmittedFactorListResponse = result.data
    factors.value = [...(data.factors || [])].sort((a, b) =>
      new Date(b.admitted_at || 0).getTime() - new Date(a.admitted_at || 0).getTime()
    )
  } catch (error) {
    loadError.value = `${errorText(error)}；已保留上次加载的数据`
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

const openDetail = async (factorId: string) => {
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  detailVersions.value = []
  detailEvents.value = []
  try {
    const result = await window.electronAPI.backtest.getAdmittedFactorDetail(factorId, admissionPool.value)
    if (!result.success || !result.data) {
      const message = result.error || '加载因子详情失败'
      throw new Error(/404/.test(message) ? '因子不存在或不属于当前账号' : message)
    }
    detail.value = result.data
    detailVersions.value = result.data.versions || []
    detailEvents.value = result.data.events || []
  } catch (error) {
    const message = errorText(error)
    detailError.value = /404/.test(message) ? '因子不存在或不属于当前账号' : message
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  await loadPoolOptions()
  await loadData()
})
</script>

<style scoped lang="scss">
.admitted-factors-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fa;
  color: #303133;

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

    h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
    p { margin: 0; color: #909399; font-size: 13px; }
  }

  .card {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .load-error { margin-bottom: 12px; }
  .main-card { padding: 4px 14px 14px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .search-input { width: 280px; }
  .muted { color: #909399; font-size: 12px; }
  .factor-name { font-weight: 500; }
  .factor-id { margin-top: 3px; color: #909399; font-size: 12px; font-family: monospace; }
  .detail-body { min-height: 120px; }
  .detail-collapse { margin-top: 14px; }
  .timeline-title {
    display: flex;
    align-items: center;
    gap: 8px;
    strong { font-size: 14px; }
  }
  .timeline-meta {
    margin-top: 4px;
    color: #909399;
    font-size: 12px;
  }
  .reject-reason { line-height: 1.6; }
}
</style>
