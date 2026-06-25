<template>
  <div class="db-mgmt">
    <div class="db-mgmt-left">
      <div class="db-tree-header">数据库导航</div>
      <el-scrollbar>
        <el-tree
          :data="dbTree"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          highlight-current
          default-expand-all
          @node-click="onTreeNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-icon v-if="data.type === 'engine'" :size="14" style="margin-right:4px">
                <Coin v-if="data.engine === 'postgresql'" />
                <DataLine v-else />
              </el-icon>
              <span>{{ data.label }}</span>
              <el-tag v-if="data.type === 'engine'" size="small" type="info" style="margin-left:6px">{{ data.count || 0 }}</el-tag>
            </span>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>

    <div class="db-mgmt-right">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="用户列表" name="users">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openCreateUserDialog">+ 创建用户</el-button>
            <el-input v-model="userSearch" placeholder="搜索用户名" size="small" clearable style="width:200px;margin-left:auto" />
          </div>
          <el-table :data="filteredUsers" stripe v-loading="usersLoading" empty-text="暂无用户" size="small">
            <el-table-column prop="username" label="用户名" min-width="140" />
            <el-table-column label="数据库类型" min-width="120">
              <template #default="{ row }">
                <el-tag v-if="row.hasPg" size="small" style="margin-right:4px">PG</el-tag>
                <el-tag v-if="row.hasCh" size="small" type="warning">CH</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="绑定 API Key" min-width="180">
              <template #default="{ row }">
                <span v-if="row.binding" class="binding-tag">{{ row.binding.api_key_name }} ({{ row.binding.api_key }})</span>
                <span v-else class="no-binding">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="320" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="info" @click="viewUserGrants(row.username)">查看权限</el-button>
                <el-button size="small" text type="warning" @click="openChangePasswordDialog(row.username)">改密码</el-button>
                <el-button size="small" text type="danger" @click="confirmDeleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="按库表授权" name="resource">
          <!-- 引擎 + 库选择 -->
          <div class="tab-toolbar">
            <el-radio-group v-model="resEngine" size="small" @change="onResEngineChange">
              <el-radio-button value="postgresql">PostgreSQL</el-radio-button>
              <el-radio-button value="clickhouse">ClickHouse</el-radio-button>
            </el-radio-group>
            <el-select v-model="resDb" placeholder="选择数据库" size="small" filterable style="margin-left:12px;width:160px" @change="onResDbChange" :disabled="!resDbList.length">
              <el-option v-for="d in resDbList" :key="d" :label="d" :value="d" />
            </el-select>
          </div>

          <!-- 表选择器 -->
          <div v-if="resDb" class="res-table-selector">
            <el-checkbox
              :model-value="isAllTablesSelected"
              :indeterminate="isSomeTablesSelected"
              @change="(v: any) => toggleAllTables(v)"
              style="font-weight:600;flex-shrink:0"
            >全库（所有表）</el-checkbox>
            <el-divider direction="vertical" />
            <el-checkbox-group v-model="resSelectedTables" style="display:inline-flex;flex-wrap:wrap;gap:4px">
              <el-checkbox v-for="t in resAllTables" :key="t" :value="t">{{ t }}</el-checkbox>
            </el-checkbox-group>
            <el-button size="small" type="primary" style="margin-left:auto;flex-shrink:0" :disabled="!resSelectedTables.length" @click="confirmAndLoad">加载</el-button>
          </div>

          <!-- 批量操作栏（有已选用户时显示） -->
          <div v-if="resRows.length && resSelectedUsers.length" class="res-batch-toolbar">
            <span>给选中 {{ resSelectedUsers.length }} 位用户批量：</span>
            <el-checkbox-group v-model="batchPrivs" size="small">
              <el-checkbox-button v-for="p in getPrivilegeList(resEngine)" :key="p" :value="p">{{ p }}</el-checkbox-button>
            </el-checkbox-group>
            <el-button size="small" type="success" :disabled="!batchPrivs.length" @click="applyToSelected('all')">授权</el-button>
            <el-button size="small" type="danger" plain :disabled="!batchPrivs.length" @click="applyToSelected('none')">撤权</el-button>
          </div>

          <!-- 权限矩阵表格 -->
          <el-table
            v-if="resRows.length"
            :data="resRows"
            stripe
            size="small"
            v-loading="resLoading"
            class="res-matrix-table"
            @selection-change="onResSelectionChange"
          >
            <el-table-column type="selection" width="45" />
            <el-table-column prop="username" label="用户名" min-width="140" fixed />
            <el-table-column label="绑定 API Key" min-width="160">
              <template #default="{ row }">
                <span v-if="row.binding" class="binding-tag">{{ row.binding.api_key_name }} ({{ row.binding.api_key }})</span>
                <span v-else class="no-binding">-</span>
              </template>
            </el-table-column>
            <el-table-column v-for="p in getPrivilegeList(resEngine)" :key="p" :label="p" width="95" align="center">
              <template #header>
                <div class="priv-header" @click="toggleResColumnAll(p)">{{ p }}</div>
              </template>
              <template #default="{ row }">
                <el-checkbox
                  :model-value="row.cells[p] === 'all'"
                  :indeterminate="row.cells[p] === 'partial'"
                  @change="cycleCell(row, p)"
                />
              </template>
            </el-table-column>
          </el-table>

          <div v-if="resRows.length" class="res-actions">
            <el-alert
              v-if="resTablesStale"
              type="warning"
              :closable="false"
              show-icon
              title="表选择已变化，请重新点击「加载」后再保存"
              style="margin-bottom:8px;width:100%"
            />
            <el-button type="primary" size="small" :loading="resSaving" :disabled="resTablesStale" @click="saveResource">保存</el-button>
            <el-button size="small" type="danger" plain :disabled="resTablesStale" @click="clearSelectedTables">清空选中表的所有用户权限</el-button>
          </div>

          <!-- 空态引导 -->
          <div v-else-if="!resLoading" class="res-guide">
            <el-empty :description="resDb && resSelectedTables.length ? '点击「加载」查看权限矩阵' : resDb ? '请勾选要操作的表' : '请先选择数据库'" :image-size="60" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 查看权限弹窗 -->
    <el-dialog v-model="grantsDialogVisible" :title="'权限详情 - ' + grantsDialogUser" width="700px" destroy-on-close>
      <div v-for="(engine, eidx) in ['postgresql', 'clickhouse']" :key="eidx">
        <h4 style="margin:12px 0 6px">{{ engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</h4>
        <el-table :data="grantsDialogData[engine] || []" size="small" empty-text="无权限" stripe>
          <el-table-column prop="database" label="数据库" width="140" />
          <el-table-column prop="table" label="表" width="180">
            <template #default="{ row }">{{ row.table === '*' ? '所有表' : row.table }}</template>
          </el-table-column>
          <el-table-column label="权限">
            <template #default="{ row }">
              <el-tag v-for="p in row.privileges" :key="p" size="small" style="margin:2px 4px 2px 0">{{ p }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 创建用户弹窗 -->
    <el-dialog v-model="createDialogVisible" title="创建数据库用户" width="440px" destroy-on-close>
      <el-form label-width="90px" size="small">
        <el-form-item label="数据库类型">
          <el-radio-group v-model="createForm.db_type">
            <el-radio value="both">两个都创建</el-radio>
            <el-radio value="postgresql">PostgreSQL</el-radio>
            <el-radio value="clickhouse">ClickHouse</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="字母开头，可含字母/数字/下划线" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="doCreateUser">创建</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="pwdDialogVisible" :title="'修改密码 - ' + pwdDialogUser" width="400px" destroy-on-close>
      <el-form label-width="90px" size="small">
        <el-form-item label="数据库类型">
          <el-radio-group v-model="pwdForm.db_type">
            <el-radio value="both">两个都改</el-radio>
            <el-radio value="postgresql">PostgreSQL</el-radio>
            <el-radio value="clickhouse">ClickHouse</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.password" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="doChangePassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, DataLine } from '@element-plus/icons-vue'

const api = window.electronAPI.dbPermissions

const activeTab = ref('users')

// ========== 数据库树 ==========
const dbTreeRaw = ref<any>({})
const dbTree = computed(() => {
  const nodes: any[] = []
  for (const engine of ['postgresql', 'clickhouse']) {
    const info = dbTreeRaw.value[engine]
    if (!info) continue
    const dbs = info.databases || []
    nodes.push({
      id: engine,
      label: engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse',
      type: 'engine',
      engine,
      count: dbs.length,
      children: dbs.map((d: any) => ({ id: `${engine}:${d.name}`, label: d.name, type: 'db', engine, dbName: d.name })),
    })
  }
  return nodes
})

async function loadDatabases() {
  const res = await api.listDatabases()
  if (res.success && res.data) dbTreeRaw.value = res.data
}

function onTreeNodeClick(node: any) {
  if (node.type === 'db') {
    activeTab.value = 'resource'
    resEngine.value = node.engine
    resDb.value = node.dbName
    onResDbChange()
  }
}

// ========== 用户列表 ==========
const usersLoading = ref(false)
const userSearch = ref('')
const rawUsers = ref<any>({ postgresql: { users: [] }, clickhouse: { users: [] } })

const mergedUsers = computed(() => {
  const map = new Map<string, { username: string; hasPg: boolean; hasCh: boolean; binding: any }>()
  for (const u of rawUsers.value.postgresql?.users || []) {
    map.set(u.username, { username: u.username, hasPg: true, hasCh: false, binding: u.bound_api_key || null })
  }
  for (const u of rawUsers.value.clickhouse?.users || []) {
    const existing = map.get(u.username)
    if (existing) {
      existing.hasCh = true
      if (!existing.binding && u.bound_api_key) existing.binding = u.bound_api_key
    } else {
      map.set(u.username, { username: u.username, hasPg: false, hasCh: true, binding: u.bound_api_key || null })
    }
  }
  return Array.from(map.values())
})

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return mergedUsers.value
  return mergedUsers.value.filter(u => u.username.toLowerCase().includes(q))
})

async function loadUsers() {
  usersLoading.value = true
  try {
    const res = await api.listUsers()
    console.log('📋 [listUsers] 接口返回:', JSON.stringify(res.data, null, 2))
    if (res.success && res.data) rawUsers.value = res.data
  } finally {
    usersLoading.value = false
  }
}

// ========== 创建用户 ==========
const createDialogVisible = ref(false)
const createLoading = ref(false)
const createForm = ref({ db_type: 'both', username: '', password: '' })

function openCreateUserDialog() {
  createForm.value = { db_type: 'both', username: '', password: '' }
  createDialogVisible.value = true
}

async function doCreateUser() {
  const { username, password, db_type } = createForm.value
  if (!username.trim()) return ElMessage.warning('请输入用户名')
  if (!password) return ElMessage.warning('请输入密码')
  createLoading.value = true
  try {
    const res = await api.createUser({ db_type, username: username.trim(), password })
    if (res.success) {
      ElMessage.success('用户创建成功')
      createDialogVisible.value = false
      loadUsers()
    } else {
      ElMessage.error(res.error || '创建失败')
    }
  } finally {
    createLoading.value = false
  }
}

// ========== 删除用户 ==========
async function confirmDeleteUser(row: any) {
  const bindingTip = row.binding ? `\n该用户已绑定 API Key [${row.binding.api_key_name}]，删除后 API Key 的数据库配置将失效。` : ''
  await ElMessageBox.confirm(
    `此操作将永久删除用户「${row.username}」及其所有权限，不可恢复。${bindingTip}`,
    '确认删除',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
  const res = await api.deleteUser(row.username, 'both')
  if (res.success) {
    ElMessage.success('用户已删除')
    loadUsers()
  } else {
    ElMessage.error(res.error || '删除失败')
  }
}

// ========== 修改密码 ==========
const pwdDialogVisible = ref(false)
const pwdDialogUser = ref('')
const pwdLoading = ref(false)
const pwdForm = ref({ db_type: 'both', password: '' })

function openChangePasswordDialog(username: string) {
  pwdDialogUser.value = username
  pwdForm.value = { db_type: 'both', password: '' }
  pwdDialogVisible.value = true
}

async function doChangePassword() {
  if (!pwdForm.value.password) return ElMessage.warning('请输入新密码')
  pwdLoading.value = true
  try {
    const res = await api.changePassword(pwdDialogUser.value, pwdForm.value)
    if (res.success) {
      ElMessage.success('密码修改成功')
      pwdDialogVisible.value = false
    } else {
      ElMessage.error(res.error || '修改失败')
    }
  } finally {
    pwdLoading.value = false
  }
}

// ========== 查看权限弹窗 ==========
const grantsDialogVisible = ref(false)
const grantsDialogUser = ref('')
const grantsDialogData = ref<Record<string, any[]>>({})

async function viewUserGrants(username: string) {
  grantsDialogUser.value = username
  grantsDialogData.value = {}
  grantsDialogVisible.value = true
  const res = await api.getUserGrants(username)
  if (res.success && res.data) {
    const grants = res.data.grants || {}
    grantsDialogData.value = {
      postgresql: grants.postgresql?.grants || [],
      clickhouse: grants.clickhouse?.grants || [],
    }
  }
}

const pgPrivilegeList = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']
const chPrivilegeList = ['SHOW', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']

function getPrivilegeList(engine: string) {
  return engine === 'postgresql' ? pgPrivilegeList : chPrivilegeList
}

// ========== 按库表授权（资源维度） ==========
type CellState = 'all' | 'none' | 'partial'

const resEngine = ref<'postgresql' | 'clickhouse'>('postgresql')
const resDb = ref('')
const resAllTables = ref<string[]>([])
const resSelectedTables = ref<string[]>([])
const resLoadedTables = ref<string[]>([])   // 最后一次加载时的表集合快照
const resRows = ref<any[]>([])
const resSnapshot = ref<Record<string, Record<string, CellState>>>({})
const resSelectedUsers = ref<string[]>([])
const resLoading = ref(false)
const resSaving = ref(false)
const batchPrivs = ref<string[]>([])

const resDbList = computed(() => {
  const info = dbTreeRaw.value[resEngine.value]
  return (info?.databases || []).map((d: any) => d.name)
})

const isAllTablesSelected = computed(() =>
  resAllTables.value.length > 0 && resSelectedTables.value.length === resAllTables.value.length
)

const isSomeTablesSelected = computed(() =>
  resSelectedTables.value.length > 0 && resSelectedTables.value.length < resAllTables.value.length
)

// 加载后用户改了表勾选但未重新加载 → 保存会作用到错误的表集合
const resTablesStale = computed(() => {
  if (!resRows.value.length) return false
  if (resLoadedTables.value.length !== resSelectedTables.value.length) return true
  const loadedSet = new Set(resLoadedTables.value)
  return resSelectedTables.value.some(t => !loadedSet.has(t))
})

// 加载时是否选了全库（用于 saveResource/clearSelectedTables 决定传 * 还是具体表名）
const isLoadedAllTables = computed(() =>
  resAllTables.value.length > 0 && resLoadedTables.value.length === resAllTables.value.length
)

const resHasUnsaved = computed(() => {
  if (!resRows.value.length) return false
  const privList = getPrivilegeList(resEngine.value)
  return resRows.value.some(row => {
    const snap = resSnapshot.value[row.username] || {}
    return privList.some(p => row.cells[p] !== snap[p])
  })
})

async function checkUnsavedThenRun(fn: () => void | Promise<void>) {
  if (resHasUnsaved.value) {
    try {
      await ElMessageBox.confirm('有未保存的改动，确定放弃并继续？', '提示', {
        type: 'warning', confirmButtonText: '放弃并继续', cancelButtonText: '取消'
      })
    } catch { return }
  }
  await fn()
}

async function onResEngineChange() {
  await checkUnsavedThenRun(() => {
    resDb.value = ''
    resAllTables.value = []
    resSelectedTables.value = []
    resRows.value = []
    resSnapshot.value = {}
    resSelectedUsers.value = []
    batchPrivs.value = []
  })
}

async function onResDbChange() {
  await checkUnsavedThenRun(async () => {
    resAllTables.value = []
    resSelectedTables.value = []
    resRows.value = []
    resSnapshot.value = {}
    resSelectedUsers.value = []
    batchPrivs.value = []
    if (!resDb.value) return
    const res = await api.listTables(resEngine.value, resDb.value)
    resAllTables.value = (res.success && res.data?.tables) ? res.data.tables.map((t: any) => t.name) : []
  })
}

function toggleAllTables(checked: boolean) {
  resSelectedTables.value = checked ? [...resAllTables.value] : []
}

async function confirmAndLoad() {
  await checkUnsavedThenRun(loadResourceGrants)
}

async function loadResourceGrants() {
  if (!resDb.value || !resSelectedTables.value.length) return
  resLoading.value = true
  resRows.value = []
  resSnapshot.value = {}
  resSelectedUsers.value = []
  batchPrivs.value = []
  resLoadedTables.value = [...resSelectedTables.value]  // 快照当前选中表
  try {
    const tables = isAllTablesSelected.value ? ['*'] : resSelectedTables.value
    const res = await api.listResourceGrants(resEngine.value, resDb.value, tables)
    if (res.success && res.data?.users) {
      resRows.value = res.data.users.map((u: any) => {
        const merged = mergedUsers.value.find(m => m.username === u.username)
        return {
          username: u.username,
          hasPg: u.has_pg ?? merged?.hasPg ?? false,
          hasCh: u.has_ch ?? merged?.hasCh ?? false,
          binding: merged?.binding || null,
          cells: { ...u.privs } as Record<string, CellState>
        }
      })
      resSnapshot.value = {}
      for (const row of resRows.value) {
        resSnapshot.value[row.username] = { ...row.cells }
      }
    } else {
      ElMessage.error(res.error || '加载失败')
    }
  } finally {
    resLoading.value = false
  }
}

function onResSelectionChange(rows: any[]) {
  resSelectedUsers.value = rows.map(r => r.username)
}

function cycleCell(row: any, priv: string) {
  row.cells[priv] = row.cells[priv] === 'all' ? 'none' : 'all'
}

function toggleResColumnAll(priv: string) {
  const allSet = resRows.value.every(r => r.cells[priv] === 'all')
  const newVal: CellState = allSet ? 'none' : 'all'
  for (const row of resRows.value) row.cells[priv] = newVal
}

function applyToSelected(value: 'all' | 'none') {
  for (const username of resSelectedUsers.value) {
    const row = resRows.value.find(r => r.username === username)
    if (!row) continue
    for (const p of batchPrivs.value) row.cells[p] = value
  }
}

async function saveResource() {
  const changes: { username: string; grant: string[]; revoke: string[] }[] = []
  const privList = getPrivilegeList(resEngine.value)
  for (const row of resRows.value) {
    const snap = resSnapshot.value[row.username] || {}
    const grant: string[] = []
    const revoke: string[] = []
    for (const p of privList) {
      const now = row.cells[p]
      const old = snap[p]
      if (now === old) continue
      if (now === 'all') grant.push(p)
      if (now === 'none') revoke.push(p)
    }
    if (grant.length || revoke.length) changes.push({ username: row.username, grant, revoke })
  }
  if (!changes.length) { ElMessage.info('权限未变更'); return }

  const tables = isLoadedAllTables.value ? ['*'] : resLoadedTables.value
  const tableCount = resLoadedTables.value.length
  const grantCount = changes.reduce((s, c) => s + c.grant.length, 0)
  const revokeCount = changes.reduce((s, c) => s + c.revoke.length, 0)

  try {
    await ElMessageBox.confirm(
      `将对 ${changes.length} 位用户、${tableCount} 张表进行变更：${grantCount} 处 GRANT、${revokeCount} 处 REVOKE`,
      '确认保存', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
    )
  } catch { return }

  resSaving.value = true
  try {
    const res = await api.batchGrantUsers({ db_type: resEngine.value, database: resDb.value, tables, changes })
    if (res.success) {
      ElMessage.success(res.message || '保存成功')
      await loadResourceGrants()
    } else {
      ElMessage.error(res.error || '保存失败')
    }
  } finally {
    resSaving.value = false
  }
}

async function clearSelectedTables() {
  const tables = isLoadedAllTables.value ? ['*'] : resLoadedTables.value
  const tableCount = resLoadedTables.value.length
  try {
    await ElMessageBox.confirm(
      `确定清空 ${tableCount} 张表上所有用户的权限？此操作不可撤销。`,
      '确认清空', { type: 'warning', confirmButtonText: '确认清空', cancelButtonText: '取消' }
    )
  } catch { return }

  const allPrivs = getPrivilegeList(resEngine.value)
  // 只对当前有任意权限的用户发 revoke，减少无效请求体
  const changes = resRows.value
    .filter(row => allPrivs.some(p => row.cells[p] !== 'none'))
    .map(row => ({ username: row.username, grant: [] as string[], revoke: allPrivs }))
  if (!changes.length) { ElMessage.info('所有用户在选中表上均无权限'); return }
  resSaving.value = true
  try {
    const res = await api.batchGrantUsers({ db_type: resEngine.value, database: resDb.value, tables, changes })
    if (res.success) {
      ElMessage.success('权限已清空')
      await loadResourceGrants()
    } else {
      ElMessage.error(res.error || '清空失败')
    }
  } finally {
    resSaving.value = false
  }
}

// ========== 初始化 ==========
onMounted(() => {
  loadDatabases()
  loadUsers()
})
</script>

<style scoped lang="scss">
.db-mgmt {
  display: flex; height: 100%; overflow: hidden;
}
.db-mgmt-left {
  width: 220px; flex-shrink: 0; border-right: 1px solid #e8e8e8; display: flex; flex-direction: column; background: #fafafa;
  .db-tree-header { padding: 14px 16px 10px; font-size: 14px; font-weight: 600; color: #303133; }
  .el-scrollbar { flex: 1; }
  .tree-node { display: flex; align-items: center; font-size: 13px; }
}
.db-mgmt-right {
  flex: 1; min-width: 0; padding: 16px 20px; overflow-y: auto;
}
.tab-toolbar {
  display: flex; align-items: center; margin-bottom: 12px;
}
.binding-tag { font-size: 12px; color: #67c23a; }
.no-binding { font-size: 12px; color: #c0c4cc; }

.priv-header { cursor: pointer; user-select: none; &:hover { color: #409eff; } }

.res-table-selector {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px;
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  margin-bottom: 12px;
  max-height: 130px;
  overflow-y: auto;
}

.res-batch-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #fff7e6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.res-matrix-table { margin-top: 8px; }

.res-actions { margin-top: 12px; display: flex; gap: 10px; }

.res-guide { padding: 40px 0; }
</style>
