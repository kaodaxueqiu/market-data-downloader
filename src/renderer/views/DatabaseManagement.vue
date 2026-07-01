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
            <el-table-column label="操作" width="320" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="info" @click="viewUserGrants(row.username)">查看权限</el-button>
                <el-button size="small" text type="warning" @click="openChangePasswordDialog(row.username)">改密码</el-button>
                <el-button size="small" text type="danger" @click="confirmDeleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="按库表授权" name="resource" class="res-tab-pane">
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

          <!-- 已加载：精简摘要 + 重新选择 -->
          <div v-if="resRows.length" class="res-loaded-bar">
            <el-icon><DataLine /></el-icon>
            <span>已加载：{{ resEngine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }} / {{ resDb }} /
              {{ isLoadedAllTables ? `全库（${resAllTables.length} 张表）` : `${resLoadedTables.length} 张表` }}
            </span>
            <el-button link size="small" style="margin-left:auto" @click="reSelectTables">重新选择</el-button>
          </div>

          <!-- 表选择器 / 未选库占位（无数据时展示） -->
          <div v-else class="res-table-selector">
            <template v-if="resDb">
              <div class="res-table-toolbar">
                <el-checkbox
                  :model-value="isAllTablesSelected"
                  :indeterminate="isSomeTablesSelected"
                  @change="(v: any) => toggleAllTables(v)"
                >全库（共 {{ resAllTables.length }} 张表）</el-checkbox>
                <span v-if="resSelectedTables.length && !isAllTablesSelected" class="res-selected-count">
                  已选 {{ resSelectedTables.length }} 张
                </span>
                <el-button
                  size="small"
                  type="primary"
                  style="margin-left:auto"
                  :disabled="!resSelectedTables.length"
                  @click="confirmAndLoad"
                >加载{{ resSelectedTables.length ? `（${resSelectedTables.length} 张）` : '' }}</el-button>
              </div>
              <div class="res-table-chips">
                <span
                  v-for="t in resTablePageList"
                  :key="t"
                  class="res-table-chip"
                  :class="{ 'is-selected': resSelectedTables.includes(t) }"
                  @click="toggleTable(t)"
                >{{ t }}</span>
              </div>
              <div class="res-table-pagination">
                <el-pagination
                  v-model:current-page="resTablePage"
                  :page-size="resTablePageSize"
                  :total="resAllTables.length"
                  layout="prev, pager, next, jumper, total"
                  size="small"
                  background
                />
              </div>
            </template>
            <div v-else class="res-guide">
              <el-empty description="请先选择数据库" :image-size="60" />
            </div>
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

          <!-- 权限矩阵表格（flex:1 填满剩余高度） -->
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

        </el-tab-pane>

        <el-tab-pane label="库表管理" name="schema" class="schema-tab-pane">
          <div class="schema-toolbar">
            <el-radio-group v-model="schemaEngine" size="small" @change="onSchemaEngineChange">
              <el-radio-button value="postgresql">PostgreSQL</el-radio-button>
              <el-radio-button value="clickhouse">ClickHouse</el-radio-button>
            </el-radio-group>
            <el-select v-model="schemaDb" placeholder="选择数据库" size="small" filterable style="margin-left:12px;width:180px" @change="onSchemaDbChange" :disabled="!schemaDbList.length">
              <el-option v-for="d in schemaDbList" :key="d" :label="d" :value="d" />
            </el-select>
            <el-button size="small" type="primary" @click="openCreateDbDialog(schemaEngine)" style="margin-left:8px">+ 新建库</el-button>
            <el-button size="small" type="success" plain :disabled="!schemaDb" @click="openCreateTableDialog(schemaEngine, schemaDb)">+ 新建表</el-button>
            <el-button size="small" type="danger" plain :disabled="!schemaDb" @click="confirmDropDb(schemaEngine, schemaDb)">删除库</el-button>
          </div>

          <el-table :data="schemaTables" stripe size="small" v-loading="schemaLoading" empty-text="请选择数据库">
            <el-table-column prop="name" label="表名" min-width="200" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="openMoveTableDialog(row.name)">{{ schemaEngine === 'clickhouse' ? '移动/重命名' : '重命名' }}</el-button>
                <el-button size="small" text type="danger" @click="confirmDropTable(row.name)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
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

    <!-- 建库弹窗 -->
    <el-dialog v-model="createDbDialogVisible" title="新建数据库" width="420px" destroy-on-close>
      <el-form label-width="80px" size="small">
        <el-form-item label="引擎">
          <el-tag>{{ createDbForm.engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</el-tag>
        </el-form-item>
        <el-form-item label="数据库名">
          <el-input v-model="createDbForm.name" placeholder="字母开头，可含字母/数字/下划线" @keyup.enter="doCreateDb" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDbDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createDbLoading" @click="doCreateDb">创建</el-button>
      </template>
    </el-dialog>

    <!-- 建表弹窗（可视化） -->
    <el-dialog v-model="createTableDialogVisible" title="新建表" width="780px" destroy-on-close :close-on-click-modal="false">
      <el-form label-width="80px" size="small">
        <el-form-item label="引擎">
          <el-tag>{{ createTableForm.engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</el-tag>
        </el-form-item>
        <el-form-item label="数据库">
          <el-tag>{{ createTableForm.dbName }}</el-tag>
        </el-form-item>
        <el-form-item label="表名">
          <el-input v-model="createTableForm.table_name" placeholder="字母开头，可含字母/数字/下划线" style="width:240px" />
        </el-form-item>
        <el-form-item label="表注释">
          <el-input v-model="createTableForm.comment" placeholder="可选" style="width:360px" />
        </el-form-item>
      </el-form>

      <div class="ct-columns-header">
        <span>列定义</span>
        <el-button size="small" type="primary" plain @click="addColumn">+ 添加列</el-button>
      </div>
      <el-table :data="createTableForm.columns" border size="small" empty-text="请添加列" style="margin-bottom:12px">
        <el-table-column label="#" width="40" type="index" />
        <el-table-column label="列名" width="150">
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" placeholder="列名" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="180">
          <template #default="{ row }">
            <el-select v-model="row.type" size="small" filterable allow-create default-first-option placeholder="选择或输入">
              <el-option v-for="t in getTypeList(createTableForm.engine)" :key="t" :label="t" :value="t" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="可空" width="60" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.nullable" :disabled="row.primary_key" />
          </template>
        </el-table-column>
        <el-table-column v-if="createTableForm.engine === 'postgresql'" label="PK" width="60" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.primary_key" @change="onPkChange(row)" />
          </template>
        </el-table-column>
        <el-table-column label="默认值" width="150">
          <template #default="{ row }">
            <el-input v-model="row.default" size="small" placeholder="表达式" />
          </template>
        </el-table-column>
        <el-table-column label="注释" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.comment" size="small" placeholder="注释" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60" align="center">
          <template #default="{ $index }">
            <el-button link size="small" type="danger" @click="removeColumn($index)">删</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- CH 专属区域 -->
      <div v-if="createTableForm.engine === 'clickhouse'" class="ct-ch-section">
        <el-form label-width="100px" size="small">
          <el-form-item label="引擎">
            <el-select v-model="createTableForm.engine_ch" filterable allow-create default-first-option placeholder="选择引擎" style="width:240px">
              <el-option v-for="e in chEngineList" :key="e.value" :label="e.label" :value="e.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="ORDER BY">
            <el-input v-model="createTableForm.order_by" placeholder="(id) 或 (date, id)" style="width:240px" />
          </el-form-item>
          <el-form-item label="PARTITION BY">
            <el-input v-model="createTableForm.partition_by" placeholder="可选，如 toYYYYMM(date)" style="width:240px" />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="createTableDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createTableLoading" @click="doCreateTable">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重命名/移动表弹窗 -->
    <el-dialog v-model="moveTableDialogVisible" title="表操作" width="500px" destroy-on-close>
      <div style="margin-bottom:12px;font-size:13px;color:#606266">
        当前：{{ moveTableForm.dbName }}.{{ moveTableForm.tableName }}
      </div>

      <!-- PG 只有重命名 -->
      <el-form v-if="moveTableForm.engine !== 'clickhouse'" label-width="80px" size="small">
        <el-form-item label="新表名">
          <el-input v-model="moveTableForm.target_table" placeholder="新表名" style="width:240px" @keyup.enter="doMoveTable" />
        </el-form-item>
      </el-form>

      <!-- CH 用 Tab 区分 -->
      <el-tabs v-else v-model="moveActiveTab">
        <el-tab-pane label="重命名" name="rename">
          <el-form label-width="80px" size="small">
            <el-form-item label="新表名">
              <el-input v-model="moveTableForm.target_table" placeholder="新表名" style="width:240px" @keyup.enter="doMoveTable" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="移动到其他库" name="move">
          <el-form label-width="80px" size="small">
            <el-form-item label="目标库">
              <el-select v-model="moveTableForm.target_database" placeholder="选择目标库" filterable style="width:240px">
                <el-option v-for="d in moveTargetDbList" :key="d" :label="d" :value="d" :disabled="d === moveTableForm.dbName" />
              </el-select>
            </el-form-item>
            <div v-if="!moveTableForm.target_database" style="font-size:12px;color:#e6a23c;margin-left:80px">请选择目标库（不能是当前库）</div>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="moveTableDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="moveTableLoading" :disabled="!canMoveSubmit" @click="doMoveTable">确认</el-button>
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
const chPrivilegeList = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP']

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

const resTablePage = ref(1)
const resTablePageSize = 60

const resTablePageList = computed(() => {
  const start = (resTablePage.value - 1) * resTablePageSize
  return resAllTables.value.slice(start, start + resTablePageSize)
})

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
    resTablePage.value = 1
    resRows.value = []
    resSnapshot.value = {}
    resSelectedUsers.value = []
    batchPrivs.value = []
    if (!resDb.value) return
    const res = await api.listTables(resEngine.value, resDb.value)
    const tables = (res.success && res.data?.tables) ? res.data.tables.map((t: any) => t.name) : []
    resAllTables.value = tables
    resSelectedTables.value = [...tables]  // 默认全选
  })
}

function toggleAllTables(checked: boolean) {
  resSelectedTables.value = checked ? [...resAllTables.value] : []
}

function toggleTable(t: string) {
  const idx = resSelectedTables.value.indexOf(t)
  if (idx >= 0) resSelectedTables.value.splice(idx, 1)
  else resSelectedTables.value.push(t)
}

function reSelectTables() {
  resRows.value = []
  resSnapshot.value = {}
  resSelectedUsers.value = []
  batchPrivs.value = []
}

async function confirmAndLoad() {
  try {
    await checkUnsavedThenRun(loadResourceGrants)
  } catch (err: any) {
    console.error('[confirmAndLoad]', err)
    ElMessage.error('加载出错：' + (err?.message || String(err)))
  }
}

async function loadResourceGrants() {
  console.log('[loadResourceGrants] db=', resDb.value, 'tables=', resSelectedTables.value.length)
  if (!resDb.value || !resSelectedTables.value.length) {
    ElMessage.warning('请先选择数据库和表')
    return
  }
  resLoading.value = true
  resRows.value = []
  resSnapshot.value = {}
  resSelectedUsers.value = []
  batchPrivs.value = []
  resLoadedTables.value = [...resSelectedTables.value]
  try {
    const tables = isAllTablesSelected.value ? ['*'] : [...resSelectedTables.value]
    console.log('[loadResourceGrants] calling API, tables=', tables.length > 1 ? tables.slice(0, 3) + '...' : tables)
    const res = await api.listResourceGrants(resEngine.value, resDb.value, tables)
    console.log('[loadResourceGrants] response:', res?.success, res?.error)
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
  } catch (err: any) {
    console.error('[loadResourceGrants] error:', err)
    ElMessage.error('加载出错：' + (err?.message || String(err)))
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

  const tables = isLoadedAllTables.value ? ['*'] : [...resLoadedTables.value]
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
  const tables = isLoadedAllTables.value ? ['*'] : [...resLoadedTables.value]
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

// ========== 库表管理 Tab ==========
const schemaEngine = ref<'postgresql' | 'clickhouse'>('postgresql')
const schemaDb = ref('')
const schemaTables = ref<any[]>([])
const schemaLoading = ref(false)

const schemaDbList = computed(() => {
  const info = dbTreeRaw.value[schemaEngine.value]
  return (info?.databases || []).map((d: any) => d.name)
})

function onSchemaEngineChange() {
  schemaDb.value = ''
  schemaTables.value = []
}

async function onSchemaDbChange() {
  schemaTables.value = []
  if (!schemaDb.value) return
  schemaLoading.value = true
  try {
    const res = await api.listTables(schemaEngine.value, schemaDb.value)
    if (res.success && res.data?.tables) {
      schemaTables.value = res.data.tables
    }
  } finally {
    schemaLoading.value = false
  }
}

// ========== 建库 ==========
const createDbDialogVisible = ref(false)
const createDbLoading = ref(false)
const createDbForm = ref({ engine: 'postgresql' as string, name: '' })

function openCreateDbDialog(engine: string) {
  createDbForm.value = { engine, name: '' }
  createDbDialogVisible.value = true
}

async function doCreateDb() {
  const name = createDbForm.value.name.trim()
  if (!name) return ElMessage.warning('请输入数据库名')
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return ElMessage.warning('名称须以字母开头，仅含字母/数字/下划线')
  createDbLoading.value = true
  try {
    const res = await api.createDatabase({ db_type: createDbForm.value.engine, name })
    if (res.success) {
      ElMessage.success(res.message || '数据库创建成功')
      createDbDialogVisible.value = false
      await loadDatabases()
    } else {
      ElMessage.error(res.error || '创建失败')
    }
  } finally {
    createDbLoading.value = false
  }
}

// ========== 删库 ==========
async function confirmDropDb(engine: string, dbName: string) {
  try {
    const { value } = await ElMessageBox.prompt(
      `此操作不可恢复！\n\n将删除数据库: ${dbName}\n类型: ${engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse'}\n\n请输入 "确认删除" 以继续:`,
      '删除数据库',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', inputPlaceholder: '请输入 确认删除', inputValidator: (v) => v === '确认删除' || '请输入"确认删除"' }
    )
    if (value !== '确认删除') return
  } catch { return }
  const res = await api.dropDatabase(engine, dbName)
  if (res.success) {
    ElMessage.success(res.message || '数据库删除成功')
    await loadDatabases()
    if (schemaEngine.value === engine && schemaDb.value === dbName) {
      schemaDb.value = ''
      schemaTables.value = []
    }
    if (resEngine.value === engine && resDb.value === dbName) {
      resDb.value = ''
      resAllTables.value = []
      resRows.value = []
    }
  } else {
    ElMessage.error(res.error || '删除失败')
  }
}

// ========== 建表 ==========
const pgTypeList = ['smallint', 'integer', 'bigint', 'serial', 'bigserial', 'real', 'double precision', 'numeric(18,4)', 'char(10)', 'varchar(20)', 'text', 'date', 'time', 'timestamp', 'timestamptz', 'boolean', 'json', 'jsonb', 'uuid', 'bytea']
const chTypeList = ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64', 'Decimal(18,4)', 'String', 'FixedString(16)', 'Date', 'DateTime', 'DateTime64(3)', 'UUID', 'Enum8(...)', 'Enum16(...)', 'Array(String)']
const chEngineList = [
  { label: 'MergeTree', value: 'MergeTree' },
  { label: 'ReplacingMergeTree', value: 'ReplacingMergeTree' },
  { label: 'SummingMergeTree', value: 'SummingMergeTree' },
  { label: 'AggregatingMergeTree', value: 'AggregatingMergeTree' },
  { label: 'CollapsingMergeTree', value: 'CollapsingMergeTree' },
  { label: 'ReplicatedMergeTree', value: 'ReplicatedMergeTree' },
]

function getTypeList(engine: string) {
  return engine === 'postgresql' ? pgTypeList : chTypeList
}

const createTableDialogVisible = ref(false)
const createTableLoading = ref(false)
const createTableForm = ref({
  engine: 'postgresql' as string,
  dbName: '',
  table_name: '',
  comment: '',
  columns: [] as any[],
  engine_ch: 'MergeTree',
  order_by: '',
  partition_by: '',
})

function openCreateTableDialog(engine: string, dbName: string) {
  createTableForm.value = {
    engine,
    dbName,
    table_name: '',
    comment: '',
    columns: [{ name: '', type: engine === 'postgresql' ? 'bigserial' : 'Int64', nullable: false, primary_key: true, default: '', comment: '' }],
    engine_ch: 'MergeTree',
    order_by: '',
    partition_by: '',
  }
  createTableDialogVisible.value = true
}

function addColumn() {
  createTableForm.value.columns.push({ name: '', type: '', nullable: true, primary_key: false, default: '', comment: '' })
}

function removeColumn(index: number) {
  createTableForm.value.columns.splice(index, 1)
}

function onPkChange(row: any) {
  if (row.primary_key) row.nullable = false
}

async function doCreateTable() {
  const f = createTableForm.value
  if (!f.table_name.trim()) return ElMessage.warning('请输入表名')
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.table_name.trim())) return ElMessage.warning('表名须以字母开头，仅含字母/数字/下划线')
  if (!f.columns.length) return ElMessage.warning('请至少添加一列')
  for (const col of f.columns) {
    if (!col.name.trim()) return ElMessage.warning('每列必须有列名')
    if (!col.type) return ElMessage.warning(`列「${col.name}」未选择类型`)
  }
  if (f.engine === 'clickhouse') {
    if (!f.engine_ch) return ElMessage.warning('请选择 CH 引擎')
    if (!f.order_by.trim()) return ElMessage.warning('请填写 ORDER BY')
  }
  createTableLoading.value = true
  try {
    const body: any = {
      table_name: f.table_name.trim(),
      columns: f.columns.map(c => ({
        name: c.name.trim(),
        type: c.type,
        nullable: c.nullable,
        primary_key: c.primary_key,
        default: c.default,
        comment: c.comment,
      })),
      comment: f.comment,
    }
    if (f.engine === 'clickhouse') {
      body.engine = f.engine_ch
      body.order_by = f.order_by.trim()
      body.partition_by = f.partition_by.trim()
    }
    const res = await api.createTable(f.engine, f.dbName, body)
    if (res.success) {
      ElMessage.success(res.message || '表创建成功')
      createTableDialogVisible.value = false
      // 刷新库表管理 Tab
      if (schemaEngine.value === f.engine && schemaDb.value === f.dbName) {
        await onSchemaDbChange()
      }
      // 刷新授权 Tab
      if (resEngine.value === f.engine && resDb.value === f.dbName) {
        await onResDbChange()
      }
    } else {
      ElMessage.error(res.error || '创建失败')
    }
  } finally {
    createTableLoading.value = false
  }
}

// ========== 删表 ==========
async function confirmDropTable(tableName: string) {
  try {
    const { value } = await ElMessageBox.prompt(
      `此操作不可恢复！\n\n将删除表: ${schemaDb.value}.${tableName}\n\n请输入 "确认删除" 以继续:`,
      '删除表',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', inputPlaceholder: '请输入 确认删除', inputValidator: (v) => v === '确认删除' || '请输入"确认删除"' }
    )
    if (value !== '确认删除') return
  } catch { return }
  const res = await api.dropTable(schemaEngine.value, schemaDb.value, tableName)
  if (res.success) {
    ElMessage.success(res.message || '表删除成功')
    await onSchemaDbChange()
  } else {
    ElMessage.error(res.error || '删除失败')
  }
}

// ========== 移动/重命名表 ==========
const moveTableDialogVisible = ref(false)
const moveTableLoading = ref(false)
const moveActiveTab = ref('rename')
const moveTableForm = ref({
  engine: 'postgresql' as string,
  dbName: '',
  tableName: '',
  target_database: '',
  target_table: '',
})

const moveTargetDbList = computed(() => {
  const info = dbTreeRaw.value[moveTableForm.value.engine]
  return (info?.databases || []).map((d: any) => d.name)
})

const canMoveSubmit = computed(() => {
  const f = moveTableForm.value
  if (f.engine !== 'clickhouse') {
    // PG 只有重命名
    return f.target_table.trim() && f.target_table.trim() !== f.tableName
  }
  if (moveActiveTab.value === 'rename') {
    return f.target_table.trim() && f.target_table.trim() !== f.tableName
  }
  // move tab：必须选了目标库（不能是当前库）
  return !!f.target_database && f.target_database !== f.dbName
})

function openMoveTableDialog(tableName: string) {
  moveTableForm.value = {
    engine: schemaEngine.value,
    dbName: schemaDb.value,
    tableName,
    target_database: '',
    target_table: tableName,
  }
  moveActiveTab.value = 'rename'
  moveTableDialogVisible.value = true
}

async function doMoveTable() {
  const f = moveTableForm.value
  const isMove = f.engine === 'clickhouse' && moveActiveTab.value === 'move'
  if (isMove) {
    if (!f.target_database || f.target_database === f.dbName) return ElMessage.warning('请选择目标库')
    moveTableLoading.value = true
    try {
      const res = await api.moveTable(f.engine, f.dbName, f.tableName, {
        target_database: f.target_database,
        target_table: f.tableName,
      })
      if (res.success) {
        ElMessage.success(res.message || '移动成功')
        moveTableDialogVisible.value = false
        await onSchemaDbChange()
      } else {
        ElMessage.error(res.error || '操作失败')
      }
    } finally {
      moveTableLoading.value = false
    }
    return
  }
  // 重命名（PG 或 CH rename tab）
  if (!f.target_table.trim()) return ElMessage.warning('请输入新表名')
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.target_table.trim())) return ElMessage.warning('表名须以字母开头，仅含字母/数字/下划线')
  moveTableLoading.value = true
  try {
    const res = await api.moveTable(f.engine, f.dbName, f.tableName, {
      target_table: f.target_table.trim(),
    })
    if (res.success) {
      ElMessage.success(res.message || '重命名成功')
      moveTableDialogVisible.value = false
      await onSchemaDbChange()
    } else {
      ElMessage.error(res.error || '操作失败')
    }
  } finally {
    moveTableLoading.value = false
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
  flex: 1; min-width: 0; padding: 8px 16px;
  display: flex; flex-direction: column; overflow: hidden;
  :deep(.el-tabs) { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  :deep(.el-tabs__content) { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  :deep(.el-tab-pane) { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
}
.tab-toolbar {
  display: flex; align-items: center; margin-bottom: 12px;
}
.binding-tag { font-size: 12px; color: #67c23a; }
.no-binding { font-size: 12px; color: #c0c4cc; }

.priv-header { cursor: pointer; user-select: none; &:hover { color: #409eff; } }

.res-tab-pane {
  overflow: hidden !important;
}

.res-loaded-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #f0f7ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  font-size: 13px;
  color: #409eff;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.res-table-selector {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 0;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.res-table-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.res-selected-count {
  font-size: 12px;
  color: #409eff;
}

.res-table-chips {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 12px 14px;
  flex: 1;
  overflow-y: auto;
  align-content: flex-start;
}

.res-table-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  color: #606266;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;

  &:hover {
    border-color: #409eff;
    color: #409eff;
  }

  &.is-selected {
    background: #409eff;
    border-color: #409eff;
    color: #fff;
  }
}

.res-table-pagination {
  padding: 8px 14px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
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

.res-matrix-table { margin-top: 8px; flex: 1; }

.res-actions { margin-top: 12px; display: flex; gap: 10px; }

.res-guide { padding: 40px 0; }

.schema-tab-pane {
  overflow: hidden !important;
}
.schema-toolbar {
  display: flex; align-items: center; margin-bottom: 12px;
}

.ct-columns-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.ct-ch-section {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 16px 0;
  margin-bottom: 12px;
  background: #f9fafc;
}
</style>
