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
                <el-button size="small" text type="primary" @click="openPermEditor(row.username)">设置权限</el-button>
                <el-button size="small" text type="info" @click="viewUserGrants(row.username)">查看权限</el-button>
                <el-button size="small" text type="warning" @click="openChangePasswordDialog(row.username)">改密码</el-button>
                <el-button size="small" text type="danger" @click="confirmDeleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="权限矩阵" name="matrix">
          <div class="tab-toolbar">
            <el-select v-model="matrixUser" placeholder="选择用户" size="small" filterable style="width:180px" @change="loadMatrixGrants">
              <el-option v-for="u in allUsernames" :key="u" :label="u" :value="u" />
            </el-select>
            <el-radio-group v-model="matrixDbType" size="small" style="margin-left:12px" @change="onMatrixDbTypeChange">
              <el-radio-button value="postgresql">PostgreSQL</el-radio-button>
              <el-radio-button value="clickhouse">ClickHouse</el-radio-button>
            </el-radio-group>
            <el-select v-model="matrixDb" placeholder="选择数据库" size="small" filterable style="margin-left:12px;width:160px" @change="loadMatrixTables">
              <el-option v-for="d in matrixDbList" :key="d" :label="d" :value="d" />
            </el-select>
          </div>

          <el-table v-if="matrixUser && matrixDb" :data="matrixRows" stripe v-loading="matrixLoading" empty-text="暂无表" size="small" class="matrix-table">
            <el-table-column prop="table" label="表名" min-width="200" fixed />
            <el-table-column v-for="p in privilegeList" :key="p" :label="p" width="100" align="center">
              <template #default="{ row }">
                <el-checkbox v-model="row.privs[p]" />
              </template>
            </el-table-column>
          </el-table>
          <div v-if="matrixUser && matrixDb" class="matrix-actions">
            <el-button type="primary" size="small" :loading="matrixSaving" @click="saveMatrix">保存</el-button>
            <el-button type="danger" size="small" plain @click="revokeAllForDb">撤销本库所有权限</el-button>
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

    <!-- 用户权限编辑弹窗（库级别） -->
    <el-dialog v-model="permEditorVisible" :title="'设置权限 - ' + permEditorUser" width="900px" destroy-on-close top="5vh">
      <div v-loading="permEditorLoading" class="perm-editor">
        <div v-for="engine in permEditorEngines" :key="engine" class="perm-engine-section">
          <div class="perm-engine-header">
            <el-icon :size="16" style="margin-right:6px"><Coin v-if="engine === 'postgresql'" /><DataLine v-else /></el-icon>
            <span>{{ engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</span>
            <el-tag size="small" type="info" style="margin-left:8px">{{ permEditorDbRows[engine]?.length || 0 }} 个库</el-tag>
          </div>
          <div v-if="engine === 'clickhouse'" class="perm-global-row">
            <span class="perm-global-label">全局权限</span>
            <el-checkbox v-model="permEditorGlobal[engine]" @change="onGlobalShowChange(engine)">SHOW DATABASES</el-checkbox>
            <span class="perm-global-hint">允许查看数据库列表</span>
          </div>
          <el-table :data="permEditorDbRows[engine] || []" stripe size="small" empty-text="无数据库" class="perm-db-table">
            <el-table-column prop="database" label="数据库" min-width="160" fixed />
            <el-table-column v-for="p in getPrivilegeList(engine)" :key="p" :label="p" width="95" align="center">
              <template #header>
                <div class="priv-header" @click="toggleEngineColumnAll(engine, p)">{{ p }}</div>
              </template>
              <template #default="{ row }">
                <el-checkbox v-model="row.privs[p]" @change="onPrivChange(row, p)" />
              </template>
            </el-table-column>
            <el-table-column label="" width="60" align="center" fixed="right">
              <template #header>
                <span style="font-size:11px;color:#909399">全选</span>
              </template>
              <template #default="{ row }">
                <el-checkbox :model-value="isRowAllChecked(row)" @change="(v: any) => toggleRowAll(row, v)" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="permEditorVisible = false">关闭</el-button>
        <el-button type="primary" :loading="permEditorSaving" @click="savePermEditor">保存权限</el-button>
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
    activeTab.value = 'matrix'
    matrixDbType.value = node.engine
    matrixDb.value = node.dbName
    loadMatrixTables()
  }
}

// ========== 用户列表 ==========
const usersLoading = ref(false)
const userSearch = ref('')
const rawUsers = ref<any>({ postgresql: { users: [] }, clickhouse: { users: [] }, apikey_bindings: [] })

const mergedUsers = computed(() => {
  const map = new Map<string, { username: string; hasPg: boolean; hasCh: boolean; binding: any }>()
  for (const u of rawUsers.value.postgresql?.users || []) {
    map.set(u.username, { username: u.username, hasPg: true, hasCh: false, binding: null })
  }
  for (const u of rawUsers.value.clickhouse?.users || []) {
    const existing = map.get(u.username)
    if (existing) existing.hasCh = true
    else map.set(u.username, { username: u.username, hasPg: false, hasCh: true, binding: null })
  }
  for (const b of rawUsers.value.apikey_bindings || []) {
    const pg = b.postgresql_username
    const ch = b.clickhouse_username
    if (pg && map.has(pg)) map.get(pg)!.binding = b
    if (ch && map.has(ch) && ch !== pg) map.get(ch)!.binding = b
  }
  return Array.from(map.values())
})

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return mergedUsers.value
  return mergedUsers.value.filter(u => u.username.toLowerCase().includes(q))
})

const allUsernames = computed(() => mergedUsers.value.map(u => u.username))

async function loadUsers() {
  usersLoading.value = true
  try {
    const res = await api.listUsers()
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

// ========== 权限矩阵 ==========
const matrixUser = ref('')
const matrixDbType = ref('postgresql')
const matrixDb = ref('')
const matrixLoading = ref(false)
const matrixSaving = ref(false)
const matrixRows = ref<any[]>([])
const matrixTables = ref<string[]>([])

const privilegeList = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE']

const matrixDbList = computed(() => {
  const info = dbTreeRaw.value[matrixDbType.value]
  return (info?.databases || []).map((d: any) => d.name)
})

function onMatrixDbTypeChange() {
  matrixDb.value = ''
  matrixRows.value = []
}

async function loadMatrixTables() {
  if (!matrixDb.value || !matrixDbType.value) return
  matrixLoading.value = true
  try {
    const res = await api.listTables(matrixDbType.value, matrixDb.value)
    const tables = (res.success && res.data?.tables) ? res.data.tables.map((t: any) => t.name) : []
    matrixTables.value = tables
    await buildMatrixRows()
  } finally {
    matrixLoading.value = false
  }
}

async function loadMatrixGrants() {
  if (matrixDb.value) await buildMatrixRows()
}

async function buildMatrixRows() {
  if (!matrixUser.value || !matrixDb.value) return
  const res = await api.getUserGrants(matrixUser.value, matrixDbType.value)
  const grants: any[] = (res.success && res.data?.grants?.[matrixDbType.value]?.grants) || []

  const grantMap = new Map<string, Set<string>>()
  for (const g of grants) {
    if (g.database !== matrixDb.value && g.database !== '*') continue
    const tbl = g.table || '*'
    if (!grantMap.has(tbl)) grantMap.set(tbl, new Set())
    for (const p of g.privileges) grantMap.get(tbl)!.add(p)
  }

  const allTablePrivs = grantMap.get('*') || new Set()
  const rows: any[] = []

  const allPrivs: Record<string, boolean> = {}
  for (const p of privilegeList) allPrivs[p] = allTablePrivs.has(p)
  rows.push({ table: '*(全部表)', isAll: true, privs: { ...allPrivs } })

  for (const t of matrixTables.value) {
    const tblPrivs = grantMap.get(t) || new Set()
    const merged = new Set([...allTablePrivs, ...tblPrivs])
    const privs: Record<string, boolean> = {}
    for (const p of privilegeList) privs[p] = merged.has(p)
    rows.push({ table: t, isAll: false, privs })
  }

  matrixRows.value = rows
}

async function saveMatrix() {
  if (!matrixUser.value || !matrixDb.value) return
  matrixSaving.value = true
  try {
    const grants: any[] = []
    const allRow = matrixRows.value.find(r => r.isAll)
    if (allRow) {
      const privs = Object.entries(allRow.privs).filter(([, v]) => v).map(([k]) => k)
      if (privs.length) grants.push({ db_type: matrixDbType.value, database: matrixDb.value, tables: ['*'], privileges: privs })
    }
    for (const row of matrixRows.value) {
      if (row.isAll) continue
      const privs = Object.entries(row.privs).filter(([, v]) => v).map(([k]) => k)
      const allPrivs = allRow ? Object.entries(allRow.privs).filter(([, v]) => v).map(([k]) => k) : []
      const extra = privs.filter(p => !allPrivs.includes(p))
      if (extra.length) grants.push({ db_type: matrixDbType.value, database: matrixDb.value, tables: [row.table], privileges: extra })
    }

    await api.revokeAllPrivileges(matrixUser.value, { db_type: matrixDbType.value, database: matrixDb.value })

    if (grants.length) {
      const res = await api.batchGrant(matrixUser.value, { grants })
      if (res.success) ElMessage.success('权限保存成功')
      else ElMessage.error(res.error || '保存失败')
    } else {
      ElMessage.success('已清除该库所有权限')
    }
  } finally {
    matrixSaving.value = false
  }
}

async function revokeAllForDb() {
  if (!matrixUser.value || !matrixDb.value) return
  await ElMessageBox.confirm(`确定撤销用户「${matrixUser.value}」在「${matrixDb.value}」上的所有权限？`, '确认', { type: 'warning' })
  const res = await api.revokeAllPrivileges(matrixUser.value, { db_type: matrixDbType.value, database: matrixDb.value })
  if (res.success) {
    ElMessage.success('权限已撤销')
    buildMatrixRows()
  } else {
    ElMessage.error(res.error || '撤销失败')
  }
}

// ========== 用户维度 - 库级别权限编辑 ==========
const permEditorVisible = ref(false)
const permEditorUser = ref('')
const permEditorLoading = ref(false)
const permEditorSaving = ref(false)
const permEditorDbRows = ref<Record<string, any[]>>({})
const permEditorOriginal = ref<Record<string, any[]>>({})
const permEditorGlobal = ref<Record<string, boolean>>({})
const permEditorGlobalOrig = ref<Record<string, boolean>>({})

const pgPrivilegeList = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']
const chPrivilegeList = ['SHOW', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']

function getPrivilegeList(engine: string) {
  return engine === 'postgresql' ? pgPrivilegeList : chPrivilegeList
}

const permEditorEngines = computed(() => {
  const engines: string[] = []
  if (permEditorDbRows.value['postgresql']?.length) engines.push('postgresql')
  if (permEditorDbRows.value['clickhouse']?.length) engines.push('clickhouse')
  return engines
})

function isRowAllChecked(row: any): boolean {
  return getPrivilegeList(row.engine).every(p => row.privs[p])
}

function toggleRowAll(row: any, checked: any) {
  for (const p of getPrivilegeList(row.engine)) row.privs[p] = !!checked
}

function toggleEngineColumnAll(engine: string, priv: string) {
  const rows = permEditorDbRows.value[engine] || []
  const allChecked = rows.every(r => r.privs[priv])
  for (const r of rows) r.privs[priv] = !allChecked
}

function onPrivChange(_row: any, _priv: string) {
  // 不做联动，全局和分库权限独立控制
}

function onGlobalShowChange(_engine: string) {
  // 关闭全局 SHOW DATABASES 时不自动清库权限，只控制全局开关本身
}

async function openPermEditor(username: string) {
  permEditorUser.value = username
  permEditorVisible.value = true
  permEditorLoading.value = true
  permEditorDbRows.value = {}
  permEditorOriginal.value = {}
  permEditorGlobal.value = {}
  permEditorGlobalOrig.value = {}

  try {
    const [grantsRes] = await Promise.all([
      api.getUserGrants(username),
      dbTreeRaw.value.postgresql ? Promise.resolve() : loadDatabases(),
    ])

    const userGrants = grantsRes.success ? (grantsRes.data?.grants || {}) : {}
    console.log('📖 [权限编辑] 后端返回原始数据:', JSON.stringify(grantsRes.data, null, 2))

    for (const engine of ['postgresql', 'clickhouse']) {
      const dbs: string[] = (dbTreeRaw.value[engine]?.databases || []).map((d: any) => d.name)
      const engineGrants: any[] = userGrants[engine]?.grants || []
      console.log(`📖 [权限编辑] ${engine} grants:`, JSON.stringify(engineGrants, null, 2))

      const grantMap = new Map<string, Set<string>>()
      for (const g of engineGrants) {
        const db = g.database
        if (!grantMap.has(db)) grantMap.set(db, new Set())
        for (const p of g.privileges) grantMap.get(db)!.add(p)
      }
      const wildcard = grantMap.get('*') || new Set()

      const hasGlobalShow = wildcard.has('SHOW') ||
        engineGrants.some((g: any) => g.database === '*' && g.privileges?.includes('SHOW'))
      permEditorGlobal.value[engine] = hasGlobalShow
      permEditorGlobalOrig.value[engine] = hasGlobalShow

      const rows = dbs.map(db => {
        const dbSet = grantMap.get(db) || new Set()
        const privs: Record<string, boolean> = {}
        for (const p of getPrivilegeList(engine)) privs[p] = dbSet.has(p)
        return { database: db, engine, privs }
      })

      permEditorDbRows.value[engine] = rows
      permEditorOriginal.value[engine] = rows.map(r => ({ database: r.database, privs: { ...r.privs } }))
    }
  } finally {
    permEditorLoading.value = false
  }
}

async function savePermEditor() {
  permEditorSaving.value = true
  try {
    const grants: any[] = []
    const revokes: { engine: string; db: string }[] = []
    let hasChange = false

    for (const engine of ['postgresql', 'clickhouse']) {
      // 全局 SHOW DATABASES 变更（仅 ClickHouse）
      if (engine === 'clickhouse') {
        const globalNow = permEditorGlobal.value[engine] ?? false
        const globalOrig = permEditorGlobalOrig.value[engine] ?? false
        if (globalNow !== globalOrig) {
          hasChange = true
          if (globalNow) {
            grants.push({ db_type: engine, database: '*', tables: ['*'], privileges: ['SHOW'] })
          } else {
            revokes.push({ engine, db: '*' })
          }
        }
      }

      // 分库权限变更
      const rows = permEditorDbRows.value[engine] || []
      const originals = permEditorOriginal.value[engine] || []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const orig = originals[i]
        const privList = getPrivilegeList(engine)
        const newPrivs = privList.filter(p => row.privs[p])
        const oldPrivs = orig ? privList.filter(p => orig.privs[p]) : []

        const same = newPrivs.length === oldPrivs.length && newPrivs.every(p => oldPrivs.includes(p))
        if (same) continue

        hasChange = true
        revokes.push({ engine, db: row.database })
        if (newPrivs.length) {
          grants.push({ db_type: engine, database: row.database, tables: ['*'], privileges: newPrivs })
        }
      }
    }

    if (!hasChange) {
      ElMessage.info('权限未变更')
      return
    }

    console.log('💾 [权限编辑] 即将撤销:', JSON.stringify(revokes, null, 2))
    console.log('💾 [权限编辑] 即将授予:', JSON.stringify(grants, null, 2))

    for (const r of revokes) {
      const revokeRes = await api.revokeAllPrivileges(permEditorUser.value, { db_type: r.engine, database: r.db })
      console.log(`💾 [权限编辑] 撤销 ${r.engine}/${r.db} 结果:`, JSON.stringify(revokeRes))
    }

    if (grants.length) {
      const res = await api.batchGrant(permEditorUser.value, { grants })
      console.log('💾 [权限编辑] 批量授权结果:', JSON.stringify(res))
      if (res.success) {
        ElMessage.success('权限保存成功')
      } else {
        ElMessage.error(res.error || '保存失败')
      }
    } else {
      ElMessage.success('已清除变更的权限')
    }

    // 更新快照
    for (const engine of ['postgresql', 'clickhouse']) {
      permEditorGlobalOrig.value[engine] = permEditorGlobal.value[engine] ?? false
      const rows = permEditorDbRows.value[engine] || []
      permEditorOriginal.value[engine] = rows.map(r => ({ database: r.database, privs: { ...r.privs } }))
    }
  } finally {
    permEditorSaving.value = false
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

.matrix-table { margin-top: 8px; }
.matrix-actions { margin-top: 12px; display: flex; gap: 10px; }

.perm-editor { max-height: 60vh; overflow-y: auto; }
.perm-engine-section { margin-bottom: 24px; &:last-child { margin-bottom: 0; } }
.perm-engine-header {
  display: flex; align-items: center; font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 8px;
}
.perm-global-row {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 8px;
  background: #f0f7ff; border-radius: 6px; border: 1px solid #d9ecff;
}
.perm-global-label {
  font-size: 12px; font-weight: 600; color: #409eff; white-space: nowrap;
}
.perm-global-hint {
  font-size: 11px; color: #909399; margin-left: auto;
}
.perm-db-table { width: 100%; }
.priv-header { cursor: pointer; user-select: none; &:hover { color: #409eff; } }
</style>
