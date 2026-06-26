<template>
  <div class="preview-panel">
    <!-- 空态 -->
    <div v-if="!source" class="empty-state">
      <el-empty description="选中左侧表后自动加载预览" :image-size="100" />
    </div>

    <template v-else>
      <!-- 顶部工具栏 -->
      <div class="preview-toolbar">
        <span class="preview-title">数据预览</span>
        <div class="toolbar-controls">
          <!-- 条数选择 -->
          <el-select v-model="pageSize" size="small" style="width:90px" @change="onParamChange">
            <el-option :value="10" label="10 条" />
            <el-option :value="50" label="50 条" />
            <el-option :value="100" label="100 条" />
            <el-option :value="500" label="500 条" />
          </el-select>

          <!-- 选字段 -->
          <el-popover placement="bottom-end" width="320" trigger="click">
            <template #reference>
              <el-button size="small">
                选字段 <el-tag size="small" type="primary" style="margin-left:4px">{{ selectedColumns.length || '全部' }}</el-tag>
              </el-button>
            </template>
            <div class="column-selector">
              <div class="col-selector-header">
                <el-checkbox :model-value="isAllColumnsSelected" :indeterminate="isSomeColumnsSelected" @change="toggleAllColumns">全选</el-checkbox>
                <el-input v-model="colSearch" placeholder="搜索字段" size="small" clearable style="width:140px" />
              </div>
              <el-scrollbar max-height="240px">
                <el-checkbox-group v-model="selectedColumns">
                  <div v-for="col in filteredColumnOptions" :key="col" class="col-item">
                    <el-checkbox :value="col">{{ col }}</el-checkbox>
                  </div>
                </el-checkbox-group>
              </el-scrollbar>
              <div class="col-selector-footer">
                <el-button size="small" type="primary" @click="applyColumns">应用</el-button>
                <el-button size="small" @click="resetColumns">重置</el-button>
              </div>
            </div>
          </el-popover>

          <!-- 刷新 -->
          <el-button size="small" :loading="loading" @click="loadPreview">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 简单筛选 -->
      <div class="filter-bar">
        <el-select v-model="filterField" placeholder="筛选字段" size="small" clearable style="width:140px" @change="filterValue = ''">
          <el-option v-for="col in allColumns" :key="col" :label="col" :value="col" />
        </el-select>
        <el-select v-if="filterField" v-model="filterOp" size="small" style="width:90px">
          <el-option value="=" label="=" />
          <el-option value="contains" label="包含" />
          <el-option value=">" label=">" />
          <el-option value="<" label="<" />
        </el-select>
        <el-input
          v-if="filterField"
          v-model="filterValue"
          placeholder="值"
          size="small"
          style="width:140px"
          @keyup.enter="onParamChange"
        />
        <el-button v-if="filterField" size="small" type="primary" @click="onParamChange">筛选</el-button>
        <el-button v-if="filterField" size="small" @click="clearFilter">清除</el-button>
      </div>

      <!-- 数据表格 -->
      <div class="preview-table-wrap" v-loading="loading">
        <el-table
          v-if="rows.length"
          :data="rows"
          border
          stripe
          size="small"
          height="100%"
        >
          <el-table-column type="index" label="#" width="50" />
          <el-table-column
            v-for="col in displayColumns"
            :key="col"
            :prop="extractFieldName(col)"
            :label="col"
            min-width="130"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span style="font-family: monospace; font-size: 12px">{{ formatVal(row[extractFieldName(col)]) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else-if="!loading" description="暂无数据" :image-size="60" />
      </div>

      <!-- 分页 -->
      <div class="preview-footer">
        <span class="preview-info">
          共 {{ total }} 条
          <span v-if="filterField" class="filter-hint">（已筛选）</span>
        </span>
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          size="small"
          background
          @current-change="loadPreview"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

const props = defineProps<{
  source: any
  engine: string
  database: string
}>()

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

// 字段列
const allColumns = ref<string[]>([])      // 全部字段（原始名）
const displayColumns = ref<string[]>([])  // 当前展示的列（中英文格式）
const selectedColumns = ref<string[]>([]) // 用户勾选的列（原始名）
const colSearch = ref('')

// 筛选
const filterField = ref('')
const filterOp = ref('=')
const filterValue = ref('')

// ========== 列选择器 ==========
const filteredColumnOptions = computed(() => {
  if (!colSearch.value) return allColumns.value
  return allColumns.value.filter(c => c.toLowerCase().includes(colSearch.value.toLowerCase()))
})

const isAllColumnsSelected = computed(() =>
  selectedColumns.value.length === allColumns.value.length
)
const isSomeColumnsSelected = computed(() =>
  selectedColumns.value.length > 0 && selectedColumns.value.length < allColumns.value.length
)

const toggleAllColumns = (v: any) => {
  selectedColumns.value = v ? [...allColumns.value] : []
}

const applyColumns = () => { onParamChange() }
const resetColumns = () => {
  selectedColumns.value = [...allColumns.value]
  onParamChange()
}

// ========== 筛选 ==========
const clearFilter = () => {
  filterField.value = ''
  filterOp.value = '='
  filterValue.value = ''
  onParamChange()
}

// ========== 加载数据 ==========
const loadPreview = async () => {
  if (!props.source?.table_name || !props.engine || !props.database) return
  loading.value = true
  try {
    const cols = selectedColumns.value.length && selectedColumns.value.length < allColumns.value.length
      ? selectedColumns.value.join(',')
      : undefined
    const filter = filterField.value && filterValue.value
      ? JSON.stringify({ field: filterField.value, op: filterOp.value, value: filterValue.value })
      : undefined

    const result = await window.electronAPI.dbdict.previewTable(
      props.engine,
      props.database,
      props.source.table_name,
      pageSize.value,
      currentPage.value,
      cols,
      filter
    )

    if (result.code === 200) {
      rows.value = result.data || []
      total.value = result.total ?? result.preview_count ?? rows.value.length
      displayColumns.value = result.columns || []
      // 初始化 allColumns（原始字段名）
      if (allColumns.value.length === 0 && result.columns?.length) {
        allColumns.value = result.columns.map((c: string) => extractFieldName(c))
        selectedColumns.value = [...allColumns.value]
      }
    } else {
      ElMessage.error(result.msg || '预览失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '预览失败')
  } finally {
    loading.value = false
  }
}

const onParamChange = () => {
  currentPage.value = 1
  loadPreview()
}

// 字段变化或切换表时重置并加载
watch(() => props.source, (val) => {
  rows.value = []
  total.value = 0
  currentPage.value = 1
  allColumns.value = []
  selectedColumns.value = []
  displayColumns.value = []
  filterField.value = ''
  filterValue.value = ''
  if (val) loadPreview()
}, { immediate: true })

// ========== 工具函数 ==========
const extractFieldName = (col: string) => {
  const m = col.match(/\(([^)]+)\)$/)
  return m ? m[1] : col
}

const formatVal = (v: any) => {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style lang="scss" scoped>
.preview-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .empty-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .preview-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .toolbar-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.preview-table-wrap {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
  background: #fafafa;

  .preview-info {
    font-size: 12px;
    color: #909399;
    .filter-hint { color: #409eff; margin-left: 4px; }
  }
}

.column-selector {
  .col-selector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 8px;
  }
  .col-item { padding: 4px 0; }
  .col-selector-footer {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
    margin-top: 8px;
    justify-content: flex-end;
  }
}
</style>
