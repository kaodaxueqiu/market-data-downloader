<template>
  <div class="admitted-factors-page">
    <div class="page-header">
      <div>
        <h2>已入库因子</h2>
        <p>仅展示当前账号名下因子；替换不新增因子栏位</p>
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

    <section v-if="candidates.length" class="card candidates-section">
      <div class="section-title">待确认替换候选</div>
      <div
        v-for="candidate in candidates"
        :key="candidate.new_task_id"
        class="candidate-card"
        :class="{ highlighted: highlightedTaskId === candidate.new_task_id }"
      >
        <div class="candidate-heading">
          <div>
            <strong>{{ candidate.new_factor_name }}</strong>
            <span class="muted">新因子 ID：{{ candidate.new_factor_id }}</span>
            <span class="muted">任务 ID：{{ candidate.new_task_id }}</span>
          </div>
          <span class="muted">{{ formatDate(candidate.created_at) }}</span>
        </div>

        <el-descriptions :column="3" border size="small" class="candidate-info">
          <el-descriptions-item label="旧因子" :span="2">
            {{ candidate.offer.blocking_factor_display || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="相关性 / 阈值">
            {{ formatNumber(candidate.offer.blocking_abs_corr) }} / {{ formatNumber(candidate.offer.threshold) }}
          </el-descriptions-item>
          <el-descriptions-item label="新超额夏普">
            {{ formatNumber(candidate.offer.new_metrics?.excess_sharpe) }}
          </el-descriptions-item>
          <el-descriptions-item label="旧超额夏普">
            {{ formatNumber(candidate.offer.old_metrics?.excess_sharpe) }}
          </el-descriptions-item>
          <el-descriptions-item label="新 / 旧年化超额">
            {{ formatPercent(candidate.offer.new_metrics?.excess_annual_return) }} /
            {{ formatPercent(candidate.offer.old_metrics?.excess_annual_return) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="candidate.offer.message" label="说明" :span="3">
            {{ candidate.offer.message }}
          </el-descriptions-item>
          <el-descriptions-item v-if="candidate.offer.better_rule" label="判定规则" :span="3">
            {{ candidate.offer.better_rule }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="candidate-actions">
          <el-tag v-if="!isExecutable(candidate)" type="info" size="small">当前不可替换</el-tag>
          <el-button
            size="small"
            :disabled="executingTaskId === candidate.new_task_id"
            @click="viewResult(candidate.new_task_id)"
          >查看新因子结果</el-button>
          <el-button
            v-if="isExecutable(candidate)"
            type="primary"
            size="small"
            :loading="previewingTaskId === candidate.new_task_id"
            :disabled="executingTaskId === candidate.new_task_id"
            @click="previewReplacement(candidate)"
          >替换</el-button>
        </div>
      </div>
    </section>

    <div class="card main-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="已入库因子" name="factors">
          <div class="toolbar">
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
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row.factor_id)">详情</el-button>
                <el-button link type="primary" @click="viewResult(row.admitted_task_id)">查看回测结果</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="keyword ? '没有匹配的因子' : '暂无已入库因子'" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="替换台账" name="replacements">
          <el-table v-loading="loading" :data="replacements" stripe size="small">
            <el-table-column prop="replaced_at" label="替换时间" min-width="150">
              <template #default="{ row }">{{ formatDate(row.replaced_at) }}</template>
            </el-table-column>
            <el-table-column prop="old_factor_id" label="旧因子 ID" min-width="140" show-overflow-tooltip />
            <el-table-column prop="new_factor_id" label="新因子 ID" min-width="140" show-overflow-tooltip />
            <el-table-column prop="old_task_id" label="旧任务 ID" min-width="140" show-overflow-tooltip />
            <el-table-column prop="new_task_id" label="新任务 ID" min-width="140" show-overflow-tooltip />
            <el-table-column prop="max_abs_corr" label="最大绝对相关性" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.max_abs_corr) }}</template>
            </el-table-column>
            <el-table-column prop="threshold" label="阈值" min-width="80" align="right">
              <template #default="{ row }">{{ formatNumber(row.threshold) }}</template>
            </el-table-column>
            <el-table-column prop="old_excess_sharpe" label="旧超额夏普" min-width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.old_excess_sharpe) }}</template>
            </el-table-column>
            <el-table-column prop="new_excess_sharpe" label="新超额夏普" min-width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.new_excess_sharpe) }}</template>
            </el-table-column>
            <el-table-column prop="old_excess_annual_return" label="旧年化超额" min-width="100" align="right">
              <template #default="{ row }">{{ formatPercent(row.old_excess_annual_return) }}</template>
            </el-table-column>
            <el-table-column prop="new_excess_annual_return" label="新年化超额" min-width="100" align="right">
              <template #default="{ row }">{{ formatPercent(row.new_excess_annual_return) }}</template>
            </el-table-column>
            <el-table-column prop="operator_id" label="操作人" min-width="100">
              <template #default="{ row }">{{ row.operator_id || '-' }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无替换记录" :image-size="80" /></template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-drawer v-model="detailVisible" title="因子详情" size="560px">
      <div v-loading="detailLoading" class="detail-body">
        <el-alert v-if="detailError" type="error" :title="detailError" :closable="false" show-icon />
        <el-descriptions v-if="detail" :column="1" border size="small">
          <el-descriptions-item label="因子名称">{{ detail.factor_name }}</el-descriptions-item>
          <el-descriptions-item label="因子 ID">{{ detail.factor_id }}</el-descriptions-item>
          <el-descriptions-item label="所属账号">{{ detail.owner_id }}</el-descriptions-item>
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
      </div>
    </el-drawer>

    <el-dialog
      v-model="confirmVisible"
      title="确认替换因子"
      width="640px"
      :close-on-click-modal="false"
      :close-on-press-escape="!executingTaskId"
      :show-close="!executingTaskId"
    >
      <template v-if="confirmCandidate">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="新因子" :span="2">
            {{ confirmCandidate.new_factor_name }}（{{ confirmCandidate.new_factor_id }}）
          </el-descriptions-item>
          <el-descriptions-item label="旧因子" :span="2">
            {{ confirmCandidate.offer.blocking_factor_display || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="相关性">{{ formatNumber(confirmCandidate.offer.blocking_abs_corr) }}</el-descriptions-item>
          <el-descriptions-item label="阈值">{{ formatNumber(confirmCandidate.offer.threshold) }}</el-descriptions-item>
          <el-descriptions-item label="新超额夏普">{{ formatNumber(confirmCandidate.offer.new_metrics?.excess_sharpe) }}</el-descriptions-item>
          <el-descriptions-item label="旧超额夏普">{{ formatNumber(confirmCandidate.offer.old_metrics?.excess_sharpe) }}</el-descriptions-item>
          <el-descriptions-item label="新年化超额">{{ formatPercent(confirmCandidate.offer.new_metrics?.excess_annual_return) }}</el-descriptions-item>
          <el-descriptions-item label="旧年化超额">{{ formatPercent(confirmCandidate.offer.old_metrics?.excess_annual_return) }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          class="confirm-warning"
          type="warning"
          :closable="false"
          show-icon
          title="替换不新增因子栏位，旧因子的全部因子值将被删除，新因子值将写入，操作会记入替换台账。"
        />
      </template>
      <template #footer>
        <el-button :disabled="!!executingTaskId" @click="confirmVisible = false">取消</el-button>
        <el-button type="danger" :loading="!!executingTaskId" @click="executeReplacement">确认替换</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import type {
  AdmittedFactorListResponse,
  AdmittedFactor,
  ReplacementCandidate,
  AdmittedFactorReplacement,
  ReplaceAdmittedFactorResponse
} from '@/types/backtest'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const loadError = ref('')
const factors = ref<AdmittedFactor[]>([])
const candidates = ref<ReplacementCandidate[]>([])
const replacements = ref<AdmittedFactorReplacement[]>([])
const keyword = ref('')
const activeTab = ref('factors')

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detail = ref<AdmittedFactor | null>(null)

const previewingTaskId = ref('')
const executingTaskId = ref('')
const confirmVisible = ref(false)
const confirmCandidate = ref<ReplacementCandidate | null>(null)

const highlightedTaskId = computed(() => String(route.query.new_task_id || ''))
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
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const isExecutable = (candidate: ReplacementCandidate) =>
  candidate.offer.eligible === true && candidate.offer.status === 'eligible'
const viewResult = (taskId: string) => router.push(`/factor-library/backtest/result/${taskId}`)

const loadData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await window.electronAPI.backtest.listAdmittedFactors(true)
    if (!result.success || !result.data) throw new Error(result.error || '加载已入库因子失败')
    const data: AdmittedFactorListResponse = result.data
    factors.value = [...(data.factors || [])].sort((a, b) =>
      new Date(b.admitted_at || 0).getTime() - new Date(a.admitted_at || 0).getTime()
    )
    candidates.value = data.replacement_candidates || []
    replacements.value = data.replacements || []
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
  try {
    const result = await window.electronAPI.backtest.getAdmittedFactorDetail(factorId)
    if (!result.success || !result.data) {
      const message = result.error || '加载因子详情失败'
      throw new Error(/404/.test(message) ? '因子不存在或不属于当前账号' : message)
    }
    detail.value = result.data
  } catch (error) {
    const message = errorText(error)
    detailError.value = /404/.test(message) ? '因子不存在或不属于当前账号' : message
  } finally {
    detailLoading.value = false
  }
}

const previewReplacement = async (candidate: ReplacementCandidate) => {
  if (!isExecutable(candidate) || executingTaskId.value) return
  previewingTaskId.value = candidate.new_task_id
  try {
    const result = await window.electronAPI.backtest.replaceAdmittedFactor(
      candidate.new_task_id,
      candidate.offer.blocking_factor_id || '',
      true
    )
    if (!result.success || !result.data) throw new Error(result.error || '替换预检失败')
    if (result.data.status === 'rejected') {
      ElMessage.warning(result.data.message || result.data.reason || '当前候选不可替换')
      await loadData()
      return
    }
    if (result.data.status !== 'preview') {
      ElMessage.warning(result.data.message || result.data.reason || '当前候选不可替换，请刷新后重试')
      return
    }
    confirmCandidate.value = candidate
    confirmVisible.value = true
  } catch (error) {
    ElMessage.error(errorText(error))
  } finally {
    previewingTaskId.value = ''
  }
}

const executeReplacement = async () => {
  const candidate = confirmCandidate.value
  if (!candidate || executingTaskId.value) return
  executingTaskId.value = candidate.new_task_id
  try {
    const result = await window.electronAPI.backtest.replaceAdmittedFactor(
      candidate.new_task_id,
      candidate.offer.blocking_factor_id || '',
      false
    )
    if (!result.success || !result.data) throw new Error(result.error || '替换请求失败')
    const data: ReplaceAdmittedFactorResponse = result.data
    if (data.status === 'replaced') {
      confirmVisible.value = false
      confirmCandidate.value = null
      ElMessage.success(`替换成功：写入 ${formatInteger(data.rows_written)} 行，删除 ${formatInteger(data.rows_deleted)} 行`)
      await loadData()
    } else if (data.status === 'rejected') {
      confirmVisible.value = false
      confirmCandidate.value = null
      ElMessage.warning(data.message || data.reason || '替换已拒绝')
      await loadData()
    } else {
      ElMessage.warning(data.message || data.reason || `替换返回未知状态：${data.status}`)
    }
  } catch (error) {
    ElMessage.error(`${errorText(error)}，请刷新后确认替换结果`)
  } finally {
    executingTaskId.value = ''
  }
}

onMounted(loadData)
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
  .candidates-section { padding: 14px; margin-bottom: 14px; }
  .section-title { margin-bottom: 10px; font-size: 15px; font-weight: 600; }

  .candidate-card {
    padding: 12px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background: #fafafa;

    & + .candidate-card { margin-top: 10px; }
    &.highlighted { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12); }
  }

  .candidate-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    strong { margin-right: 12px; }
    .muted { margin-right: 12px; }
  }

  .candidate-info { margin-bottom: 10px; }
  .candidate-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .main-card { padding: 4px 14px 14px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .search-input { width: 280px; }
  .muted { color: #909399; font-size: 12px; }
  .factor-name { font-weight: 500; }
  .factor-id { margin-top: 3px; color: #909399; font-size: 12px; font-family: monospace; }
  .detail-body { min-height: 120px; }
  .confirm-warning { margin-top: 16px; line-height: 1.6; }
}
</style>
