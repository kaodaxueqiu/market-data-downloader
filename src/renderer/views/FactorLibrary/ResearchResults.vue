<template>
  <div class="research-results-page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card total">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">总任务数</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.completed || 0 }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card researchers">
        <div class="stat-value">{{ researchers.length || 0 }}</div>
        <div class="stat-label">研究员数</div>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-card">
      <el-form :inline="true" class="filter-form">
        <el-form-item label="研究员">
          <el-select 
            v-model="filters.researcher" 
            placeholder="全部" 
            clearable
            style="width: 140px;"
            @change="handleFilterChange"
          >
            <el-option v-for="r in researchers" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select 
            v-model="filters.status" 
            placeholder="全部" 
            clearable
            style="width: 120px;"
            @change="handleFilterChange"
          >
            <el-option label="等待执行" value="pending" />
            <el-option label="正在执行" value="running" />
            <el-option label="已完成" value="completed" />
            <el-option label="执行失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input 
            v-model="filters.keyword" 
            placeholder="搜索任务名称/因子ID" 
            clearable 
            style="width: 200px;"
            @keyup.enter="handleFilterChange"
            @clear="handleFilterChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleFilterChange">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 回测任务列表 -->
    <div class="table-card">
      <el-table 
        :data="tasks" 
        v-loading="loading"
        stripe
        size="small"
        class="modern-table"
        :header-cell-style="{ 
          background: '#f8fafc', 
          color: '#64748b', 
          fontWeight: 500,
          fontSize: '12px',
          padding: '10px 0',
          borderBottom: '1px solid #e2e8f0'
        }"
        :cell-style="{ padding: '8px 10px', color: '#475569', fontSize: '12px' }"
        @sort-change="handleSortChange"
      >
        <el-table-column prop="task_name" label="任务名称" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="viewDetail(row)" :underline="false" class="task-link">
              {{ row.task_name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="researcher" label="研究员" align="center" />
        <el-table-column label="回测区间" align="center">
          <template #default="{ row }">
            {{ row.start_date }} ~ {{ row.end_date }}
          </template>
        </el-table-column>
        <el-table-column prop="universe" label="股票池" align="center" />
        <el-table-column label="5日RankIC" align="center">
          <template #default="{ row }">
            <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 5))">
              {{ formatRankIc(getPeriodRankIc(row, 5)) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="10日RankIC" align="center">
          <template #default="{ row }">
            <span v-if="row.status === 'completed'" :class="getRankIcClass(getPeriodRankIc(row, 10))">
              {{ formatRankIc(getPeriodRankIc(row, 10)) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" align="center">
          <template #default="{ row }">
            <span :class="['status-tag', row.status]">{{ getStatusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="completed_at" label="完成时间" align="center" sortable="custom">
          <template #default="{ row }">
            {{ row.completed_at ? formatDate(row.completed_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="90" align="center">
          <template #default="{ row }">
            <span style="display: inline-flex; gap: 12px; white-space: nowrap; font-size: 12px;">
              <el-link type="primary" @click="viewDetail(row)" :underline="false">详情</el-link>
              <el-link 
                v-if="row.status === 'completed'" 
                type="success" 
                @click="viewResult(row)"
                :underline="false"
              >结果</el-link>
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="total > 0">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>

      <!-- 空状态 -->
      <el-empty v-if="!loading && tasks.length === 0" description="暂无研究成果数据" />
    </div>

    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详情"
      width="700px"
      :close-on-click-modal="false"
      class="detail-dialog"
    >
      <div v-loading="detailLoading" class="detail-content">
        <template v-if="taskDetail">
          <!-- 基本信息 -->
          <div class="detail-section">
            <div class="section-title">
              <el-icon><Document /></el-icon>
              基本信息
            </div>
            <div class="section-body">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="任务ID">
                  <code>{{ taskDetail.task_id }}</code>
                </el-descriptions-item>
                <el-descriptions-item label="任务名称">{{ taskDetail.task_name }}</el-descriptions-item>
                <el-descriptions-item label="任务类型">{{ getTaskTypeName(taskDetail.task_type) }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="getStatusType(taskDetail.status)" size="small">
                    {{ getStatusName(taskDetail.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="执行人">{{ taskDetail.user_id || currentTask?.researcher || '-' }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatFullDate(taskDetail.created_at) }}</el-descriptions-item>
                <el-descriptions-item label="完成时间" :span="2">{{ formatFullDate(taskDetail.completed_at) || '-' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 回测配置 -->
          <div class="detail-section" v-if="taskDetail.task_config">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              回测配置
            </div>
            <div class="section-body">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="开始日期">{{ taskDetail.task_config.start_date }}</el-descriptions-item>
                <el-descriptions-item label="结束日期">{{ taskDetail.task_config.end_date }}</el-descriptions-item>
                <el-descriptions-item label="股票池" :span="2">
                  {{ getUniverseDisplay(taskDetail.task_config.universe) }}
                </el-descriptions-item>
                <el-descriptions-item label="比较基准" :span="2" v-if="taskDetail.task_config.backtest_params?.benchmarks?.length">
                  {{ getBenchmarkDisplay(taskDetail.task_config.backtest_params.benchmarks) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 因子配置 -->
          <div class="detail-section" v-if="taskDetail.task_config">
            <div class="section-title">
              <el-icon><DataAnalysis /></el-icon>
              因子配置
            </div>
            <div class="section-body">
              <div v-if="taskDetail.task_config.factor_expression" class="factor-block">
                <div class="factor-label">因子表达式</div>
                <code class="factor-code">{{ taskDetail.task_config.factor_expression }}</code>
              </div>
              <div v-else-if="taskDetail.task_config.factor_code" class="factor-block">
                <div class="factor-label">Python代码</div>
                <pre class="factor-code-block">{{ taskDetail.task_config.factor_code }}</pre>
              </div>
            </div>
          </div>

          <!-- 数据源配置 -->
          <div class="detail-section" v-if="taskDetail.task_config?.data_sources?.length">
            <div class="section-title">
              <el-icon><Connection /></el-icon>
              数据源 ({{ taskDetail.task_config.data_sources.length }})
            </div>
            <div class="section-body">
              <div class="datasource-list">
                <div 
                  v-for="(ds, idx) in taskDetail.task_config.data_sources" 
                  :key="idx"
                  class="datasource-item"
                >
                  <div class="ds-header">
                    <span class="ds-name">{{ ds.name || ds.table }}</span>
                    <el-tag size="small" type="info">{{ ds.database }}</el-tag>
                  </div>
                  <div class="ds-body">
                    <div class="ds-row">
                      <span class="ds-label">表名:</span>
                      <code>{{ ds.table }}</code>
                    </div>
                    <div class="ds-row">
                      <span class="ds-label">字段:</span>
                      <span class="ds-fields">
                        <el-tag v-for="f in ds.fields" :key="f" size="small" effect="plain">{{ f }}</el-tag>
                      </span>
                    </div>
                    <div class="ds-row">
                      <span class="ds-label">日期字段:</span>
                      <code>{{ ds.date_field }}</code>
                      <span class="ds-label" style="margin-left: 16px;">代码字段:</span>
                      <code>{{ ds.code_field }}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 回测参数 -->
          <div class="detail-section" v-if="taskDetail.task_config?.backtest_params">
            <div class="section-title">
              <el-icon><Setting /></el-icon>
              回测参数
            </div>
            <div class="section-body">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="分组数">{{ taskDetail.task_config.backtest_params.num_groups }}</el-descriptions-item>
                <el-descriptions-item label="因子方向">{{ getDirectionName(taskDetail.task_config.backtest_params.factor_direction) }}</el-descriptions-item>
                <el-descriptions-item label="预测周期">
                  {{ taskDetail.task_config.backtest_params.forward_periods?.join(', ') || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="买入价格" v-if="taskDetail.task_config.backtest_params.buy_price_type">
                  {{ getBuyPriceTypeName(taskDetail.task_config.backtest_params.buy_price_type) }}
                </el-descriptions-item>
                <el-descriptions-item label="卖出价格" v-if="taskDetail.task_config.backtest_params.sell_price_type">
                  {{ getSellPriceTypeName(taskDetail.task_config.backtest_params.sell_price_type) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>

          <!-- 错误信息 -->
          <div class="detail-section error" v-if="taskDetail.error_message">
            <div class="section-title">
              <el-icon><Warning /></el-icon>
              错误信息
            </div>
            <div class="section-body">
              <div class="error-message">{{ taskDetail.error_message }}</div>
            </div>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button 
          v-if="taskDetail?.status === 'completed'" 
          type="primary" 
          @click="viewResult(currentTask)"
        >
          查看结果
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Search, Refresh, Document, Setting, DataAnalysis, Connection, Warning
} from '@element-plus/icons-vue'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const stats = ref<any>({})
const researchers = ref<string[]>([])

// 筛选
const filters = ref({
  researcher: '',
  status: '',
  keyword: ''
})

// 分页
const pagination = ref({
  page: 1,
  page_size: 20
})

// 排序
const sort = ref({
  sort_by: 'completed_at',
  sort_order: 'desc'
})

// 详情弹窗
const detailDialogVisible = ref(false)
const detailLoading = ref(false)
const currentTask = ref<any>(null)
const taskDetail = ref<any>(null)


// 加载统计信息
const loadStats = async () => {
  try {
    const res = await window.electronAPI.research.getStats()
    if (res.success) {
      stats.value = res.data || {}
    }
  } catch (error: any) {
    console.error('加载统计信息失败:', error)
  }
}

// 加载研究员列表
const loadResearchers = async () => {
  try {
    const res = await window.electronAPI.research.getResearchers()
    if (res.success) {
      researchers.value = res.researchers || []
    }
  } catch (error: any) {
    console.error('加载研究员列表失败:', error)
  }
}

// 加载任务列表
const loadList = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.research.getList({
      page: pagination.value.page,
      page_size: pagination.value.page_size,
      created_by: filters.value.researcher || undefined,
      status: filters.value.status || undefined,
      keyword: filters.value.keyword || undefined,
      sort_by: sort.value.sort_by,
      sort_order: sort.value.sort_order
    })
    
    if (res.success) {
      tasks.value = res.data?.tasks || res.data?.factors || []
      total.value = res.data?.total || 0
    } else {
      ElMessage.error(res.error || '获取研究成果列表失败')
    }
  } catch (error: any) {
    ElMessage.error('获取研究成果列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 筛选变更
const handleFilterChange = () => {
  pagination.value.page = 1
  loadList()
}

// 重置筛选
const resetFilters = () => {
  filters.value = {
    researcher: '',
    status: '',
    keyword: ''
  }
  sort.value = {
    sort_by: 'completed_at',
    sort_order: 'desc'
  }
  pagination.value.page = 1
  loadList()
}

// 排序变更
const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  if (!order) {
    sort.value.sort_by = 'completed_at'
    sort.value.sort_order = 'desc'
  } else {
    sort.value.sort_by = prop
    sort.value.sort_order = order === 'ascending' ? 'asc' : 'desc'
  }
  loadList()
}

// 查看任务详情
const viewDetail = async (row: any) => {
  currentTask.value = row
  detailDialogVisible.value = true
  detailLoading.value = true
  taskDetail.value = null

  try {
    const result = await window.electronAPI.backtest.getTaskDetail(row.task_id)
    if (result.success && result.data?.task) {
      taskDetail.value = result.data.task
    } else {
      ElMessage.error(result.error || '获取任务详情失败')
      detailDialogVisible.value = false
    }
  } catch (error: any) {
    ElMessage.error('获取任务详情失败: ' + error.message)
    detailDialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// 查看回测结果
const viewResult = (row: any) => {
  if (row.status === 'completed' && row.task_id) {
    detailDialogVisible.value = false
    router.push(`/factor-library/backtest/result/${row.task_id}`)
  }
}

// 获取指定周期的 Rank IC
const getPeriodRankIc = (row: any, period: number): number | null => {
  const periodStats = row.period_ic_stats || row.factor_result?.period_ic_stats
  if (!Array.isArray(periodStats)) return null
  const stat = periodStats.find((p: any) => p.period === period)
  return stat?.rank_ic_mean ?? null
}

// 格式化 Rank IC 显示
const formatRankIc = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  return value.toFixed(4)
}

// 根据 Rank IC 值返回样式类
const getRankIcClass = (value: number | null): string => {
  if (value === null || value === undefined) return ''
  if (value > 0.03) return 'rank-ic-good'
  if (value < -0.03) return 'rank-ic-bad'
  return 'rank-ic-neutral'
}

// 获取状态名称（完整）
const getStatusName = (status: string) => {
  const map: Record<string, string> = {
    'pending': '等待执行',
    'running': '正在执行',
    'completed': '已完成',
    'failed': '执行失败',
    'cancelled': '已取消'
  }
  return map[status] || status
}

// 获取状态文本（简短）
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    'pending': '等待',
    'running': '执行中',
    'completed': '完成',
    'failed': '失败',
    'cancelled': '取消'
  }
  return map[status] || status
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    'pending': 'warning',
    'running': 'primary',
    'completed': 'success',
    'failed': 'danger',
    'cancelled': 'info'
  }
  return map[status] || 'info'
}

const getTaskTypeName = (type: string) => {
  const map: Record<string, string> = {
    'single_factor': '单因子',
    'multi_factor': '多因子',
    'factor_compare': '因子对比',
    'daily_update': '每日更新'
  }
  return map[type] || type
}

// 股票池显示
const getUniverseDisplay = (universe: any) => {
  if (!universe) return '-'
  if (universe.type === 'preset') {
    const names: Record<string, string> = {
      'all': '全市场',
      'hs300': '沪深300',
      'zz500': '中证500',
      'zz1000': '中证1000',
      'sz50': '上证50',
      'zz2000': '中证2000'
    }
    return names[universe.preset_name] || universe.preset_name
  }
  return '自定义股票池'
}

// 比较基准显示
const getBenchmarkDisplay = (benchmarks: string[]) => {
  if (!benchmarks?.length) return '-'
  return benchmarks.map(code => {
    const standardMap: Record<string, string> = {
      'sh000001': '上证指数',
      'sh000300': '沪深300',
      'sh000905': '中证500',
      'sh000852': '中证1000',
      'sh000016': '上证50',
      'sz399001': '深证成指',
      'sz399006': '创业板指',
      'sh000688': '科创50',
      'csi2000': '中证2000',
      'SH.000300': '沪深300',
      'SH.000905': '中证500',
      'SH.000852': '中证1000',
      'SH.000688': '科创50'
    }
    if (standardMap[code]) return standardMap[code]
    if (code.includes('_')) {
      const [indexCode, industry] = code.split('_')
      const indexNames: Record<string, string> = {
        'SSE50': '上证50',
        'CSI300': '沪深300',
        'CSI500': '中证500',
        'CSI1000': '中证1000',
        'CSI2000': '中证2000'
      }
      return `${indexNames[indexCode] || indexCode}-${industry}`
    }
    return code
  }).join('、')
}

const getDirectionName = (direction: string) => {
  const map: Record<string, string> = {
    'positive': '正向',
    'negative': '负向',
    'auto': '自动'
  }
  return map[direction] || direction
}

const getBuyPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_open': '日线开盘价',
    'vwap_30min': '30分钟VWAP (9:30-10:00)',
    'vwap_60min': '60分钟VWAP (9:30-10:30)'
  }
  return map[type] || type
}

const getSellPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_close': '日线收盘价',
    'daily_vwap': '日线全天VWAP',
    'vwap_30min': '30分钟VWAP (14:30-15:00)',
    'vwap_60min': '60分钟VWAP (14:00-15:00)'
  }
  return map[type] || type
}

const formatFullDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化函数
const formatNumber = (num: number | undefined | null, decimals: number = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return num.toFixed(decimals)
}

const formatPercent = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return (num * 100).toFixed(2) + '%'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

const getValueClass = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  return value > 0 ? 'positive' : value < 0 ? 'negative' : ''
}

onMounted(() => {
  loadStats()
  loadResearchers()
  loadList()
})
</script>

<style scoped lang="scss">
.research-results-page {
  padding: 20px;
  
  // 统计卡片
  .stats-row {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    
    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px 30px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      
      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1;
      }
      
      .stat-label {
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
      }
      
      &.total {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      }
      
      &.completed {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        .stat-value { color: #16a34a; }
      }
      
      &.researchers {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        .stat-value { color: #2563eb; }
      }
    }
  }
  
  // 筛选卡片
  .filter-card {
    background: #fff;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    
    .filter-form {
      :deep(.el-form-item) {
        margin-bottom: 0;
        margin-right: 16px;
      }
      
      :deep(.el-form-item__label) {
        color: #64748b;
        font-size: 13px;
      }
    }
  }
  
  // 表格卡片
  .table-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    
    .modern-table {
      border-radius: 8px;
      overflow: hidden;
      
      :deep(.el-table__inner-wrapper::before) {
        display: none;
      }
      
      :deep(.el-table__row--striped) {
        td {
          background: #f8fafc !important;
        }
      }
      
      :deep(.el-table__row) {
        td {
          border: none !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }
      }
      
      :deep(.el-table__body tr:hover > td) {
        background: #eff6ff !important;
      }
    }
    
    .pagination-wrapper {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    
    .no-action {
      color: #c0c4cc;
    }
  }
  
  // 任务名称链接
  .task-link {
    font-weight: 400;
    color: #3b82f6;
    font-size: 12px;
    transition: all 0.2s;
    
    &:hover {
      color: #2563eb;
    }
  }
  
  // 状态标签
  .status-tag {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    
    &.pending { color: #d97706; background: #fef3c7; }
    &.running { color: #2563eb; background: #dbeafe; }
    &.completed { color: #16a34a; background: #dcfce7; }
    &.failed { color: #dc2626; background: #fee2e2; }
    &.cancelled { color: #64748b; background: #f1f5f9; }
  }
  
  // Rank IC 数值样式
  .rank-ic-good {
    color: #16a34a;
    font-weight: 600;
  }
  
  .rank-ic-bad {
    color: #dc2626;
    font-weight: 600;
  }
  
  .rank-ic-neutral {
    color: #64748b;
  }
  
  // 数值样式
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }
}

// 详情弹窗
.detail-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .detail-content {
    min-height: 200px;
    
    .detail-section {
      border-bottom: 1px solid #ebeef5;
      
      &:last-child {
        border-bottom: none;
      }
      
      &.error {
        .section-title {
          background: #fef0f0;
          color: #f56c6c;
        }
      }
      
      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: #f5f7fa;
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        
        .el-icon {
          font-size: 16px;
          color: #409eff;
        }
      }
      
      .section-body {
        padding: 16px 20px;
        
        code {
          background: #f5f7fa;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 13px;
          color: #606266;
        }
        
        .factor-block {
          .factor-label {
            font-size: 13px;
            color: #909399;
            margin-bottom: 8px;
          }
          
          .factor-code {
            display: block;
            background: #f5f7fa;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 13px;
          }
          
          .factor-code-block {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 14px;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.6;
            overflow-x: auto;
            max-height: 200px;
            margin: 0;
          }
        }
        
        .datasource-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          
          .datasource-item {
            background: #fafafa;
            border: 1px solid #ebeef5;
            border-radius: 6px;
            overflow: hidden;
            
            .ds-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 14px;
              background: #f5f7fa;
              border-bottom: 1px solid #ebeef5;
              
              .ds-name {
                font-weight: 500;
                color: #303133;
              }
            }
            
            .ds-body {
              padding: 12px 14px;
              
              .ds-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 8px;
                
                &:last-child {
                  margin-bottom: 0;
                }
                
                .ds-label {
                  font-size: 13px;
                  color: #909399;
                }
                
                .ds-fields {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 4px;
                }
              }
            }
          }
        }
        
        .error-message {
          background: #fef0f0;
          color: #f56c6c;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.6;
        }
      }
    }
    
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
  }
}
</style>
