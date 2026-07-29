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

    <!-- 已初始化 -->
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

      <div class="content-card tabs-card">
      <el-tabs v-model="activeTab">
        <!-- ===== Tab 1：表管理 ===== -->
        <el-tab-pane label="表管理" name="tables">
        </el-tab-pane>

        <!-- ===== Tab 2：填充数据 ===== -->
        <el-tab-pane label="填充数据" name="fill">
        </el-tab-pane>
      </el-tabs>
      </div>

      <!-- Tab 1 内容 -->
      <div v-if="activeTab === 'tables'" class="content-card">
        <el-scrollbar>
          <el-table :data="tables" v-loading="tablesLoading" border>
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
        </el-scrollbar>
      </div>

      <!-- Tab 2 内容 -->
      <div v-if="activeTab === 'fill'" class="content-card">
          <div style="margin-bottom:12px; flex-shrink: 0;">
            <el-button type="primary" :icon="Plus" @click="openFillCreateDialog">新建填充配置</el-button>
            <el-button :icon="Refresh" @click="loadFillConfigs">刷新</el-button>
          </div>
        <el-scrollbar>
          <el-table :data="fillConfigs" v-loading="fillConfigsLoading" border>
            <el-table-column prop="config_name" label="配置名" min-width="140" />
            <el-table-column prop="target_table" label="目标表" width="140" />
            <el-table-column label="写入模式" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.write_mode === 'overwrite' ? 'warning' : 'success'">
                  {{ row.write_mode === 'overwrite' ? '全量覆盖' : '增量追加' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="schedule_cron" label="Cron" width="120" />
            <el-table-column label="调度" width="80">
              <template #default="{ row }">
                <el-switch size="small" :model-value="row.schedule_enabled" @change="(v: boolean) => handleToggleSchedule(row, v)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="handleExecuteFill(row)">执行</el-button>
                <el-button size="small" @click="openTaskDialog(row)">任务</el-button>
                <el-button size="small" type="danger" @click="handleDeleteFillConfig(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>暂无填充配置，点击「新建填充配置」创建</template>
          </el-table>
        </el-scrollbar>
      </div>

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

      <!-- ===== 新建填充配置弹窗 ===== -->
      <el-dialog v-model="fillCreateVisible" title="新建填充配置" width="820px" :close-on-click-modal="false">
        <el-form :model="fillForm" label-width="100px">
          <!-- Section 1：基本信息 -->
          <div class="section-title">基本信息</div>
          <el-form-item label="配置名称" required>
            <el-input v-model="fillForm.config_name" placeholder="如：每日行情同步" />
          </el-form-item>
          <el-form-item label="目标表" required>
            <el-select v-model="fillForm.target_table" placeholder="选择已建好的表" filterable style="width:100%">
              <el-option v-for="t in tables" :key="t.name" :label="t.name" :value="t.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="写入模式" required>
            <el-radio-group v-model="fillForm.write_mode">
              <el-radio value="append">增量追加</el-radio>
              <el-radio value="overwrite">全量覆盖（每次清空再写）</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- Section 2：数据源配置 -->
          <div class="section-title">数据源配置</div>
          <el-form-item label="来源类型">
            <el-tag>clickhouse</el-tag>
          </el-form-item>
          <el-form-item label="主数据源" required>
            <div class="cols">
              <div class="col-row">
                <el-input v-model="fillForm.source_config.sources[0].database" placeholder="数据库名" style="width:200px" />
                <el-input v-model="fillForm.source_config.sources[0].table" placeholder="表名" style="width:200px" />
                <el-input v-model="fillForm.source_config.sources[0].alias" placeholder="别名" style="width:100px" />
              </div>
            </div>
          </el-form-item>
          <el-form-item label="关联表">
            <div class="cols">
              <div class="col-row" v-for="(j, idx) in fillForm.source_config.joins" :key="idx">
                <el-select v-model="j.type" style="width:130px">
                  <el-option label="LEFT JOIN" value="LEFT JOIN" />
                  <el-option label="INNER JOIN" value="INNER JOIN" />
                  <el-option label="RIGHT JOIN" value="RIGHT JOIN" />
                </el-select>
                <el-input v-model="j.right_alias" placeholder="关联表别名" style="width:120px" />
                <el-input v-model="j.on" placeholder="ON 条件，如 a.id = b.id" style="flex:1" />
                <el-button :icon="Delete" text @click="fillForm.source_config.joins.splice(idx, 1)" />
              </div>
              <el-button :icon="Plus" text @click="addJoin">添加关联表</el-button>
            </div>
          </el-form-item>

          <!-- Section 3：列映射与过滤 -->
          <div class="section-title">列映射与过滤</div>
          <el-form-item label="列映射" required>
            <div class="cols">
              <div class="col-row" v-for="(c, idx) in fillForm.source_config.columns" :key="idx">
                <el-input v-model="c.source" placeholder="源表达式，如 a.close" style="width:200px" />
                <span style="color:#909399">→</span>
                <el-select v-model="c.target" placeholder="目标列" filterable style="width:200px">
                  <el-option v-for="col in targetTableColumns" :key="col" :label="col" :value="col" />
                </el-select>
                <el-button :icon="Delete" text @click="fillForm.source_config.columns.splice(idx, 1)" />
              </div>
              <el-button :icon="Plus" text @click="fillForm.source_config.columns.push({ source: '', target: '' })">添加映射</el-button>
            </div>
          </el-form-item>
          <el-form-item label="增量字段">
            <el-input v-model="fillForm.source_config.incremental_field" placeholder="如 a.trade_date（增量追加模式用）" />
          </el-form-item>
          <el-form-item label="过滤条件">
            <el-input
              v-model="fillForm.source_config.filters_raw"
              type="textarea"
              :rows="3"
              placeholder="每行一个 WHERE 条件，如&#10;a.trade_date >= '2020-01-01'"
            />
          </el-form-item>
          <el-form-item label="分组">
            <el-select v-model="fillForm.source_config.group_by" multiple filterable allow-create placeholder="如 a.stock_code" style="width:100%">
            </el-select>
          </el-form-item>

          <!-- Section 4：调度配置 -->
          <div class="section-title">调度配置</div>
          <el-form-item label="Cron 表达式">
            <el-input v-model="fillForm.schedule_cron" placeholder="0 2 * * *" style="width:200px" />
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              <el-tag v-for="p in cronPresets" :key="p.value" size="small" class="cron-preset" @click="fillForm.schedule_cron = p.value">
                {{ p.label }}
              </el-tag>
            </div>
          </el-form-item>
          <el-form-item label="启用调度">
            <el-switch v-model="fillForm.schedule_enabled" />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="fillCreateVisible = false">取消</el-button>
          <el-button type="primary" :loading="fillCreateLoading" @click="handleCreateFillConfig">创建</el-button>
        </template>
      </el-dialog>

      <!-- ===== 任务记录弹窗 ===== -->
      <el-dialog v-model="taskDialogVisible" :title="`填充任务记录 · ${taskDialogConfigName}`" width="960px" :close-on-click-modal="false">
        <el-table :data="fillTasks" v-loading="fillTasksLoading" border size="small" max-height="500">
          <el-table-column prop="task_id" label="任务ID" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="fillTaskStatusType(row.status)">{{ fillTaskStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="触发方式" width="80">
            <template #default="{ row }">{{ row.triggered_by === 'manual' ? '手动' : '定时' }}</template>
          </el-table-column>
          <el-table-column prop="rows_affected" label="影响行数" width="90" />
          <el-table-column prop="started_at" label="开始时间" width="160" />
          <el-table-column prop="completed_at" label="完成时间" width="160" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button v-if="row.generated_sql" size="small" text @click="viewSql(row)">查看SQL</el-button>
              <el-button v-if="row.error_message" size="small" text type="danger" @click="viewError(row)">查看错误</el-button>
              <el-button v-if="row.status === 'pending' || row.status === 'running'" size="small" text type="warning" @click="handleCancelFillTask(row)">取消</el-button>
            </template>
          </el-table-column>
          <template #empty>暂无任务记录</template>
        </el-table>
        <template #footer>
          <el-button @click="taskDialogVisible = false">关闭</el-button>
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

// —— Tab 切换 ——
const activeTab = ref('tables')

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

const removeColumn = (idx: number) => {
  form.value.columns.splice(idx, 1)
  const valid = new Set(namedColumns.value)
  form.value.order_by = form.value.order_by.filter(c => valid.has(c))
}

watch(() => form.value.order_by, (ob) => {
  form.value.primary_key = form.value.primary_key.filter(c => ob.includes(c))
})

const handleCreateTable = async () => {
  if (!form.value.table_name.trim()) return ElMessage.warning('请填写表名')
  if (form.value.columns.some(c => !c.name.trim() || !c.type)) return ElMessage.warning('请完整填写每一列的列名和类型')
  if (form.value.order_by.length === 0) return ElMessage.warning('请至少选择一个排序键')
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
  } catch { return }
  const result = await window.electronAPI.factor.myCHTruncateTable(row.name)
  if (result.success) {
    ElMessage.success(result.message || '数据已清空')
    await loadTables()
  } else {
    ElMessage.error(result.error || '清空失败')
  }
}

const handleDrop = async (row: CHTable) => {
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
    ElMessage.error(result.error || '删除失败')
  }
}

// —— 编辑表结构 ——
interface EditColumn { name: string; type: string; comment: string; in_sorting_key: boolean; in_primary_key: boolean; _origName?: string; _isNew?: boolean }
const editVisible = ref(false)
const editLoading = ref(false)
const editTableName = ref('')
const editColumns = ref<EditColumn[]>([])
let editOriginal: EditColumn[] = []

const openEditDialog = async (row: CHTable) => {
  const result = await window.electronAPI.factor.myCHTableSchema(row.name)
  if (!result.success || !result.data) return ElMessage.error(result.error || '读取表结构失败')
  editTableName.value = row.name
  editColumns.value = result.data.columns.map(c => ({ ...c, _origName: c.name }))
  editOriginal = JSON.parse(JSON.stringify(editColumns.value))
  editVisible.value = true
}
const addEditColumn = () =>
  editColumns.value.push({ name: '', type: '', comment: '', in_sorting_key: false, in_primary_key: false, _isNew: true })
const removeEditColumn = (idx: number) => editColumns.value.splice(idx, 1)

const buildAlterActions = () => {
  const actions: any[] = []
  const origByName = new Map(editOriginal.map(c => [c._origName || c.name, c]))
  const currentOrigNames = new Set<string>()

  for (const col of editColumns.value) {
    if (col._isNew) {
      if (!col.name.trim() || !col.type) throw new Error('新增列必须填列名和类型')
      actions.push({ action: 'add_column', name: col.name.trim(), type: col.type, comment: col.comment?.trim() || undefined })
      continue
    }
    const orig = origByName.get(col._origName!)!
    currentOrigNames.add(col._origName!)
    if (col.type !== orig.type) actions.push({ action: 'modify_type', name: col._origName, type: col.type })
    if ((col.comment || '') !== (orig.comment || '')) actions.push({ action: 'modify_comment', name: col._origName, comment: col.comment || '' })
    if (col.name.trim() && col.name.trim() !== col._origName) actions.push({ action: 'rename_column', name: col._origName, new_name: col.name.trim() })
  }
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

// ============ 填充数据（第三步）============
const fillConfigs = ref<FillConfig[]>([])
const fillConfigsLoading = ref(false)
const fillCreateVisible = ref(false)
const fillCreateLoading = ref(false)
const targetTableColumns = ref<string[]>([])

// Cron 快捷预设
const cronPresets = [
  { label: '每天凌晨2点', value: '0 2 * * *' },
  { label: '每天凌晨5点', value: '0 5 * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每周一凌晨3点', value: '0 3 * * 1' },
]

const fillForm = ref({
  config_name: '',
  target_table: '',
  source_type: 'clickhouse',
  source_config: {
    sources: [{ source_type: 'clickhouse', database: '', table: '', alias: 'a' }],
    joins: [] as { type: string; left_alias: string; right_alias: string; on: string }[],
    columns: [{ source: '', target: '' }],
    filters: [] as string[],
    filters_raw: '',
    group_by: [] as string[],
    incremental_field: '',
  },
  write_mode: 'append',
  schedule_cron: '',
  schedule_enabled: false,
})

const addJoin = () => {
  fillForm.value.source_config.joins.push({ type: 'LEFT JOIN', left_alias: 'a', right_alias: '', on: '' })
}

const openFillCreateDialog = () => {
  fillForm.value = {
    config_name: '',
    target_table: '',
    source_type: 'clickhouse',
    source_config: {
      sources: [{ source_type: 'clickhouse', database: '', table: '', alias: 'a' }],
      joins: [],
      columns: [{ source: '', target: '' }],
      filters: [],
      filters_raw: '',
      group_by: [],
      incremental_field: '',
    },
    write_mode: 'append',
    schedule_cron: '',
    schedule_enabled: false,
  }
  targetTableColumns.value = []
  fillCreateVisible.value = true
}

// 选完目标表 → 自动拉 schema 填目标列下拉
watch(() => fillForm.value.target_table, async (tableName) => {
  targetTableColumns.value = []
  if (!tableName) return
  const result = await window.electronAPI.factor.myCHTableSchema(tableName)
  if (result.success && result.data) {
    targetTableColumns.value = result.data.columns.map(c => c.name)
  }
})

const loadFillConfigs = async () => {
  fillConfigsLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHFillListConfigs()
    if (result.success) fillConfigs.value = result.data || []
    else ElMessage.error(result.error || '获取填充配置失败')
  } catch (e: any) {
    ElMessage.error(e.message || '获取填充配置失败')
  } finally {
    fillConfigsLoading.value = false
  }
}

const handleCreateFillConfig = async () => {
  // 基础校验
  if (!fillForm.value.config_name.trim()) return ElMessage.warning('请填写配置名称')
  if (!fillForm.value.target_table) return ElMessage.warning('请选择目标表')
  if (fillForm.value.source_config.sources[0].database.trim() === '' || fillForm.value.source_config.sources[0].table.trim() === '') {
    return ElMessage.warning('请填写主数据源的库名和表名')
  }
  if (fillForm.value.source_config.columns.length === 0 || fillForm.value.source_config.columns.some(c => !c.source.trim() || !c.target)) {
    return ElMessage.warning('请完整填写列映射')
  }

  // 组装 filters：textarea 按行拆分
  const filters = fillForm.value.source_config.filters_raw
    .split('\n')
    .map(s => s.trim())
    .filter(s => s)

  fillCreateLoading.value = true
  try {
    const payload = {
      config_name: fillForm.value.config_name.trim(),
      target_table: fillForm.value.target_table,
      source_type: fillForm.value.source_type,
      source_config: {
        sources: [...fillForm.value.source_config.sources.map(s => ({ ...s }))],
        joins: [...fillForm.value.source_config.joins.map(j => ({ ...j }))],
        columns: [...fillForm.value.source_config.columns.map(c => ({ ...c }))],
        filters,
        group_by: [...fillForm.value.source_config.group_by],
        incremental_field: fillForm.value.source_config.incremental_field.trim(),
      },
      write_mode: fillForm.value.write_mode,
      schedule_cron: fillForm.value.schedule_cron.trim(),
    }
    const result = await window.electronAPI.factor.myCHFillCreateConfig(payload)
    if (result.success) {
      ElMessage.success(result.message || '填充配置创建成功')
      fillCreateVisible.value = false
      await loadFillConfigs()
    } else {
      ElMessage.error(result.error || '创建失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    fillCreateLoading.value = false
  }
}

const handleDeleteFillConfig = async (row: FillConfig) => {
  try {
    await ElMessageBox.confirm(`确认删除配置「${row.config_name}」？关联的定时调度也会移除。`, '删除配置', { type: 'warning' })
  } catch { return }
  const result = await window.electronAPI.factor.myCHFillDeleteConfig(row.id)
  if (result.success) {
    ElMessage.success(result.message || '配置已删除')
    await loadFillConfigs()
  } else {
    ElMessage.error(result.error || '删除失败')
  }
}

const handleExecuteFill = async (row: FillConfig) => {
  const warn = row.write_mode === 'overwrite' ? '此配置为全量覆盖模式，执行会先清空目标表再写入。' : ''
  try {
    await ElMessageBox.confirm(`确认执行填充配置「${row.config_name}」？${warn}`, '确认执行', { type: 'warning' })
  } catch { return }
  const result = await window.electronAPI.factor.myCHFillExecute(row.id)
  if (result.success) {
    ElMessage.success(result.message || '填充任务已提交')
  } else {
    ElMessage.error(result.error || '执行失败')
  }
}

const handleToggleSchedule = async (row: FillConfig, enabled: boolean) => {
  const result = await window.electronAPI.factor.myCHFillToggleSchedule({ config_id: row.id, enabled })
  if (result.success) {
    ElMessage.success(result.message || (enabled ? '调度已开启' : '调度已关闭'))
    row.schedule_enabled = enabled
  } else {
    ElMessage.error(result.error || '操作失败')
  }
}

// —— 任务记录弹窗 ——
const taskDialogVisible = ref(false)
const taskDialogConfigName = ref('')
const fillTasks = ref<FillTask[]>([])
const fillTasksLoading = ref(false)

const openTaskDialog = async (row: FillConfig) => {
  taskDialogConfigName.value = row.config_name
  taskDialogVisible.value = true
  fillTasksLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHFillListTasks(row.id)
    if (result.success) fillTasks.value = result.data || []
    else fillTasks.value = []
  } catch {
    fillTasks.value = []
  } finally {
    fillTasksLoading.value = false
  }
}

const handleCancelFillTask = async (row: FillTask) => {
  try {
    await ElMessageBox.confirm('确认取消该填充任务？', '确认取消', { type: 'warning' })
  } catch { return }
  const result = await window.electronAPI.factor.myCHFillCancelTask(row.task_id)
  if (result.success) {
    ElMessage.success(result.message || '任务已取消')
    row.status = 'cancelled'
  } else {
    ElMessage.error(result.error || '取消失败')
  }
}

const fillTaskStatusLabel = (s: string) => {
  const map: Record<string, string> = { pending: '排队中', running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' }
  return map[s] ?? s
}
const fillTaskStatusType = (s: string) => {
  const map: Record<string, string> = { pending: 'info', running: 'primary', completed: 'success', failed: 'danger', cancelled: 'warning' }
  return map[s] ?? 'info'
}

const viewSql = (row: FillTask) => {
  ElMessageBox.alert(row.generated_sql, '生成的 SQL', { customClass: 'sql-viewer' })
}
const viewError = (row: FillTask) => {
  ElMessageBox.alert(row.error_message, '错误信息', { type: 'error' })
}

// —— 初始化与状态检查 ——
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
        loadFillConfigs()
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
      await checkStatus()
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
.private-warehouse { height: calc(100vh - 60px - 24px - 40px); display: flex; flex-direction: column; background: #f5f7fa; overflow: hidden; }
.loading-wrap, .init-container { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.init-card { text-align: center; max-width: 480px; }
.init-icon { color: #67C23A; margin-bottom: 16px; }
.init-desc { color: #606266; line-height: 1.8; margin: 12px 0 20px; }
.init-info { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
.ready-container { padding-top: 10px; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header-bar { display: flex; justify-content: space-between; align-items: center; margin: 0 10px; }
.db-label { color: #606266; }
.content-card {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  padding: 0 20px;
  margin: 10px 10px 0 10px;
  flex-shrink: 0;

  :deep(.el-tabs) { padding: 0; margin: 0; }
  :deep(.el-tabs__header) { margin: 0; border: none; padding: 0; }
  :deep(.el-tabs__nav) { margin: 0; padding: 0; border: none; }
  :deep(.el-tabs__nav-wrap) { padding: 0; margin: 0; }
  :deep(.el-tabs__nav-wrap::after) { display: none; }
  :deep(.el-tabs__item) { padding: 0 16px; height: 44px; line-height: 44px; font-size: 14px; }
  :deep(.el-tabs__content) { display: none !important; padding: 0 !important; margin: 0 !important; }
}

.tabs-card {
  padding: 0 20px 4px;
}

.content-card:not(.tabs-card) {
  padding: 16px 20px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.cols { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.col-row { display: flex; gap: 8px; align-items: center; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 8px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.cron-preset { cursor: pointer; }
</style>
