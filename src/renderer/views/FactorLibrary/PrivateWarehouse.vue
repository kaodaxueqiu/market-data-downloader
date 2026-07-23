<template>
  <div class="private-warehouse">
    <!-- 加载中 -->
    <div v-if="pageLoading" class="loading-wrap">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <!-- 未初始化：引导页 -->
    <div v-else-if="!isInitialized" class="init-container">
      <div class="init-card">
        <div class="init-icon">
          <el-icon :size="80"><Coin /></el-icon>
        </div>
        <h2>创建您的私有数据仓库</h2>
        <p class="init-desc">
          在 ClickHouse 中为您创建独立的专属库，<br>
          用于存放您自己计算的因子中间值。
        </p>
        <div class="init-info" v-if="dbStatus">
          <el-tag type="warning">{{ dbStatus.database }}</el-tag>
        </div>
        <el-button type="primary" size="large" :loading="initLoading" @click="handleInit">
          <el-icon><Plus /></el-icon>
          初始化专属库
        </el-button>
      </div>
    </div>

    <!-- 已初始化：建表管理 -->
    <div v-else class="ready-container">
      <div class="header-bar">
        <div>
          <span class="db-label">专属库：</span>
          <el-tag type="success">{{ dbStatus?.database }}</el-tag>
        </div>
        <div>
          <el-button :icon="Refresh" @click="loadTables">刷新</el-button>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建表</el-button>
        </div>
      </div>

      <el-table :data="tables" v-loading="tablesLoading" border style="margin-top:16px">
        <el-table-column prop="name" label="表名" />
        <el-table-column prop="engine" label="引擎" width="200" />
        <el-table-column prop="total_rows" label="行数" width="100" />
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button size="small" @click="openPreviewDialog(row)">预览</el-button>
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" @click="handleTruncate(row)" :disabled="row.total_rows === 0">清空</el-button>
            <el-button size="small" type="danger" @click="handleDrop(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无表，点击右上角「新建表」创建</template>
      </el-table>

      <!-- 新建表弹窗 -->
      <el-dialog v-model="createVisible" title="新建表" width="720px" :close-on-click-modal="false">
        <el-form :model="form" label-width="90px">
          <el-form-item label="表名" required>
            <el-input v-model="form.table_name" placeholder="仅字母、数字、下划线" />
          </el-form-item>

          <el-form-item label="列定义" required>
            <div class="cols">
              <div class="col-row" v-for="(col, idx) in form.columns" :key="idx">
                <el-input v-model="col.name" placeholder="列名" style="width:180px" />
                <el-select v-model="col.type" placeholder="类型" style="width:180px" filterable>
                  <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
                </el-select>
                <el-input v-model="col.comment" placeholder="注释（选填）" style="width:200px" />
                <el-button :icon="Delete" text @click="removeColumn(idx)" :disabled="form.columns.length <= 1" />
              </div>
              <el-button :icon="Plus" text @click="addColumn">添加列</el-button>
            </div>
          </el-form-item>

          <el-form-item label="引擎" required>
            <el-select v-model="form.engine" style="width:280px">
              <el-option v-for="e in engineOptions" :key="e" :label="e" :value="e" />
            </el-select>
          </el-form-item>

          <el-form-item label="排序键" required>
            <el-select v-model="form.order_by" multiple placeholder="从已填列中选择（MergeTree 必填）" style="width:100%">
              <el-option v-for="c in namedColumns" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>

          <el-form-item label="主键">
            <el-select v-model="form.primary_key" multiple placeholder="可选，只能从已选排序键里按顺序选" style="width:100%">
              <!-- 主键必须是排序键的前缀，所以选项只来自已选的排序键 -->
              <el-option v-for="c in form.order_by" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="createVisible = false">取消</el-button>
          <el-button type="primary" :loading="createLoading" @click="handleCreateTable">创建</el-button>
        </template>
      </el-dialog>

      <!-- 编辑表结构弹窗 -->
      <el-dialog v-model="editVisible" :title="`编辑表结构 · ${editTableName}`" width="820px" :close-on-click-modal="false">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px"
          title="排序键 / 主键 / 引擎为建表时确定，属于物理存储基础，不可修改。要改这些请删表重建。" />
        <el-table :data="editColumns" border size="small">
          <el-table-column label="列名" width="200">
            <template #default="{ row }">
              <!-- 排序键/主键列不允许改名，置灰并提示 -->
              <el-input v-model="row.name" size="small"
                :disabled="row.in_sorting_key || row.in_primary_key"
                :title="(row.in_sorting_key || row.in_primary_key) ? '排序键/主键列不可改名' : ''" />
            </template>
          </el-table-column>
          <el-table-column label="类型" width="200">
            <template #default="{ row }">
              <el-select v-model="row.type" size="small" filterable
                :disabled="row.in_sorting_key || row.in_primary_key"
                :title="(row.in_sorting_key || row.in_primary_key) ? '排序键/主键列不可改类型' : ''">
                <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="注释">
            <template #default="{ row }">
              <el-input v-model="row.comment" size="small" placeholder="选填" />
            </template>
          </el-table-column>
          <el-table-column label="属性" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.in_primary_key" size="small" type="warning">主键</el-tag>
              <el-tag v-else-if="row.in_sorting_key" size="small" type="success">排序键</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row, $index }">
              <!-- 排序键/主键列不允许删除 -->
              <el-button :icon="Delete" size="small" text type="danger"
                :disabled="row.in_sorting_key || row.in_primary_key"
                :title="(row.in_sorting_key || row.in_primary_key) ? '排序键/主键列不可删除' : ''"
                @click="removeEditColumn($index)" />
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top:10px">
          <el-button :icon="Plus" size="small" @click="addEditColumn">添加列</el-button>
        </div>

        <template #footer>
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" :loading="editLoading" @click="handleAlterTable">保存修改</el-button>
        </template>
      </el-dialog>

      <!-- 数据预览弹窗 -->
      <el-dialog v-model="previewVisible" :title="`数据预览 · ${previewTableName}`" width="900px" :close-on-click-modal="false">
        <div v-if="previewTotal > previewRows.length" style="margin-bottom:10px">
          <el-alert type="info" :closable="false" show-icon
            :title="`仅显示前 ${previewRows.length} 行，共 ${previewTotal} 行`" />
        </div>
        <div v-else-if="previewTotal > 0" style="margin-bottom:10px;color:#909399">
          共 {{ previewTotal }} 行
        </div>
        <el-table :data="previewRows" v-loading="previewLoading" border size="small" max-height="500" style="width:100%">
          <el-table-column v-for="col in previewColumns" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />
          <template #empty>暂无数据</template>
        </el-table>
        <template #footer>
          <el-button @click="previewVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, Plus, Loading, Refresh, Delete } from '@element-plus/icons-vue'

interface CHLibStatus {
  initialized: boolean
  database: string
  factor_user?: string
}

interface CHTable { name: string; engine: string; total_rows: number }

const pageLoading = ref(true)
const initLoading = ref(false)
const isInitialized = ref(false)
const dbStatus = ref<CHLibStatus | null>(null)

// —— 建表相关状态 ——
const tables = ref<CHTable[]>([])
const tablesLoading = ref(false)
const typeOptions = ref<string[]>([])
const engineOptions = ref<string[]>([])

const createVisible = ref(false)
const createLoading = ref(false)
const form = ref({
  table_name: '',
  columns: [{ name: '', type: '', comment: '' }],
  engine: 'MergeTree',
  order_by: [] as string[],
  primary_key: [] as string[]
})

// 已填了列名的列（供排序键/主键下拉）
const namedColumns = computed(() =>
  form.value.columns.map(c => c.name).filter(n => n && n.trim())
)

const loadTables = async () => {
  tablesLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHTables()
    if (result.success && result.data) tables.value = result.data.tables
    else ElMessage.error(result.error || '获取表列表失败')
  } catch (e: any) {
    ElMessage.error(e.message || '获取表列表失败')
  } finally {
    tablesLoading.value = false
  }
}

const loadTypes = async () => {
  const result = await window.electronAPI.factor.myCHTypes()
  if (result.success && result.data) {
    typeOptions.value = result.data.types
    engineOptions.value = result.data.engines
  }
}

const openCreateDialog = () => {
  form.value = { table_name: '', columns: [{ name: '', type: '', comment: '' }], engine: 'MergeTree', order_by: [], primary_key: [] }
  createVisible.value = true
}
const addColumn = () => form.value.columns.push({ name: '', type: '', comment: '' })

// 删列时联动：把已从列里消失的名字从排序键中剔除；主键的收敛交给 watch(order_by)
const removeColumn = (idx: number) => {
  form.value.columns.splice(idx, 1)
  const valid = new Set(namedColumns.value)
  form.value.order_by = form.value.order_by.filter(c => valid.has(c))
}

// 排序键变化时（含删列联动、手动取消某个排序键），同步剔除主键里不再属于排序键的项
watch(() => form.value.order_by, (ob) => {
  form.value.primary_key = form.value.primary_key.filter(c => ob.includes(c))
})

const handleCreateTable = async () => {
  // 基础前置校验（最终以后端为准）
  if (!form.value.table_name.trim()) return ElMessage.warning('请填写表名')
  if (form.value.columns.some(c => !c.name.trim() || !c.type)) return ElMessage.warning('请完整填写每一列的列名和类型')
  if (form.value.order_by.length === 0) return ElMessage.warning('请至少选择一个排序键')
  // 主键必须是排序键的前缀（同序、同值的连续前缀），前端先拦一道，体验更好
  const pk = form.value.primary_key
  if (pk.length > 0) {
    const ob = form.value.order_by
    if (pk.length > ob.length || pk.some((c, i) => c !== ob[i])) {
      return ElMessage.warning('主键必须是排序键的前缀（需与排序键从头开始、同顺序一致）')
    }
  }
  createLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHCreateTable({
      table_name: form.value.table_name.trim(),
      columns: form.value.columns.map(c => ({ name: c.name.trim(), type: c.type, comment: c.comment?.trim() || undefined })),
      engine: form.value.engine,
      order_by: [...form.value.order_by],
      primary_key: [...form.value.primary_key]
    })
    if (result.success) {
      ElMessage.success(result.message || '建表成功')
      createVisible.value = false
      await loadTables()
    } else {
      ElMessage.error(result.error || '建表失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '建表失败')
  } finally {
    createLoading.value = false
  }
}

// —— 清空 / 删除 ——
const handleTruncate = async (row: CHTable) => {
  try {
    await ElMessageBox.confirm(`确认清空表「${row.name}」的全部数据？此操作不可恢复。`, '清空数据', { type: 'warning' })
  } catch { return } // 用户取消
  const result = await window.electronAPI.factor.myCHTruncateTable(row.name)
  if (result.success) {
    ElMessage.success(result.message || '数据已清空')
    await loadTables()
  } else {
    ElMessage.error(result.error || '清空失败')
  }
}

const handleDrop = async (row: CHTable) => {
  // 前端先按行数提示（最终以后端为准：有数据后端会拒绝）
  if (row.total_rows > 0) {
    return ElMessage.warning(`表内有 ${row.total_rows} 行数据，请先「清空」再删除`)
  }
  try {
    await ElMessageBox.confirm(`确认删除表「${row.name}」？删除后不可恢复。`, '删除表', { type: 'warning' })
  } catch { return }
  const result = await window.electronAPI.factor.myCHDropTable(row.name)
  if (result.success) {
    ElMessage.success(result.message || '表已删除')
    await loadTables()
  } else {
    ElMessage.error(result.error || '删除失败') // 例如后端“表内有 N 行数据…”
  }
}

// —— 编辑表结构 ——
interface EditColumn { name: string; type: string; comment: string; in_sorting_key: boolean; in_primary_key: boolean; _origName?: string; _isNew?: boolean }
const editVisible = ref(false)
const editLoading = ref(false)
const editTableName = ref('')
const editColumns = ref<EditColumn[]>([])
let editOriginal: EditColumn[] = [] // 打开时的原始快照，用于 diff

const openEditDialog = async (row: CHTable) => {
  const result = await window.electronAPI.factor.myCHTableSchema(row.name)
  if (!result.success || !result.data) return ElMessage.error(result.error || '读取表结构失败')
  editTableName.value = row.name
  // _origName 记住原列名（用于识别改名 / 改类型 / 改注释）
  editColumns.value = result.data.columns.map(c => ({ ...c, _origName: c.name }))
  editOriginal = JSON.parse(JSON.stringify(editColumns.value))
  editVisible.value = true
}
const addEditColumn = () =>
  editColumns.value.push({ name: '', type: '', comment: '', in_sorting_key: false, in_primary_key: false, _isNew: true })
const removeEditColumn = (idx: number) => editColumns.value.splice(idx, 1)

// 把编辑弹窗的改动 diff 成 actions 数组
const buildAlterActions = () => {
  const actions: any[] = []
  const origByName = new Map(editOriginal.map(c => [c._origName || c.name, c]))
  const currentOrigNames = new Set<string>()

  for (const col of editColumns.value) {
    if (col._isNew) {
      // 新增列
      if (!col.name.trim() || !col.type) throw new Error('新增列必须填列名和类型')
      actions.push({ action: 'add_column', name: col.name.trim(), type: col.type, comment: col.comment?.trim() || undefined })
      continue
    }
    const orig = origByName.get(col._origName!)!
    currentOrigNames.add(col._origName!)
    // 改类型
    if (col.type !== orig.type) actions.push({ action: 'modify_type', name: col._origName, type: col.type })
    // 改注释
    if ((col.comment || '') !== (orig.comment || '')) actions.push({ action: 'modify_comment', name: col._origName, comment: col.comment || '' })
    // 改名（放最后，避免与上面基于原名的动作冲突）
    if (col.name.trim() && col.name.trim() !== col._origName) actions.push({ action: 'rename_column', name: col._origName, new_name: col.name.trim() })
  }
  // 删除：原来有、现在没了的列
  for (const orig of editOriginal) {
    if (!currentOrigNames.has(orig._origName!)) {
      actions.push({ action: 'drop_column', name: orig._origName })
    }
  }
  return actions
}

const handleAlterTable = async () => {
  let actions: any[]
  try {
    actions = buildAlterActions()
  } catch (e: any) {
    return ElMessage.warning(e.message)
  }
  if (actions.length === 0) return ElMessage.info('没有检测到任何修改')
  editLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHAlterTable({ table_name: editTableName.value, actions })
    if (result.success) {
      ElMessage.success(result.message || '表结构已更新')
      editVisible.value = false
      await loadTables()
    } else {
      // 后端可能返回部分成功（executed）
      const extra = result.executed?.length ? `（已成功 ${result.executed.length} 项，失败于：${result.failed}）` : ''
      ElMessage.error((result.error || '编辑失败') + extra)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '编辑失败')
  } finally {
    editLoading.value = false
  }
}

// —— 数据预览 ——
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewTableName = ref('')
const previewColumns = ref<string[]>([])
const previewRows = ref<Record<string, any>[]>([])
const previewTotal = ref(0)

const openPreviewDialog = async (row: CHTable) => {
  previewTableName.value = row.name
  previewVisible.value = true
  previewLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHPreviewTable(row.name)
    if (result.success && result.data) {
      previewColumns.value = result.data.columns
      previewRows.value = result.data.rows
      previewTotal.value = result.data.total_rows
    } else {
      ElMessage.error(result.error || '获取数据失败')
      previewColumns.value = []
      previewRows.value = []
      previewTotal.value = 0
    }
  } catch (e: any) {
    ElMessage.error(e.message || '获取数据失败')
  } finally {
    previewLoading.value = false
  }
}

const checkStatus = async () => {
  pageLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHStatus()
    if (result.success && result.data) {
      dbStatus.value = result.data
      isInitialized.value = result.data.initialized
      if (isInitialized.value) {
        loadTables()
        loadTypes()
      }
    } else {
      ElMessage.error(result.error || '检查专属库状态失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '检查专属库状态失败')
  } finally {
    pageLoading.value = false
  }
}

const handleInit = async () => {
  initLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHInit()
    if (result.success) {
      ElMessage.success(result.message || '初始化成功')
      await checkStatus()   // 刷新状态 → 变为已就绪
    } else {
      ElMessage.error(result.error || '初始化失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '初始化失败')
  } finally {
    initLoading.value = false
  }
}

onMounted(checkStatus)
</script>

<style scoped>
.private-warehouse { padding: 24px; }
.loading-wrap, .init-container { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.init-card { text-align: center; max-width: 480px; }
.init-icon { color: #67C23A; margin-bottom: 16px; }
.init-desc { color: #606266; line-height: 1.8; margin: 12px 0 20px; }
.init-info { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
.ready-container { padding-top: 40px; }
.header-bar { display: flex; justify-content: space-between; align-items: center; }
.db-label { color: #606266; }
.cols { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.col-row { display: flex; gap: 8px; align-items: center; }
</style>
