<template>
  <div class="definitions-tab">
    <div class="panel">
      <!-- 工具栏 -->
      <div class="panel-head">
        <div class="panel-title">
          <span class="dot" />
          缓存配置
          <el-tag v-if="definitions.length" type="info" size="small" effect="plain" round>
            {{ definitions.length }} 条
          </el-tag>
        </div>
        <div class="panel-actions">
          <el-button v-if="canWrite" type="primary" :icon="Plus" round @click="openCreate">新建配置</el-button>
          <el-button :icon="Refresh" round @click="loadDefinitions" :loading="loading">刷新</el-button>
        </div>
      </div>

      <!-- 配置列表 -->
      <el-table
        :data="definitions"
        v-loading="loading"
        class="soft-table"
        size="default"
        :header-cell-style="headerCellStyle"
        :cell-style="cellStyle"
      >
        <el-table-column label="ID" align="center" width="72">
          <template #default="{ row }">
            <el-tooltip content="点击复制 ID（引擎按 ID 绑定缓存契约，永久不变）" placement="top">
              <span class="id-chip" @click="copyId(row.id)">{{ row.id }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="name" min-width="130">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="kind-bar" :style="{ background: getShapeColor(row.shape) }" />
              <span class="name-main">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="写入形态" align="center" width="110">
          <template #default="{ row }">
            <el-tooltip :content="SHAPE_DESC[row.shape || 'row']" placement="top">
              <el-tag size="small" effect="light" round
                :style="{ color: getShapeColor(row.shape), background: getShapeBg(row.shape), border: 'none' }">
                {{ getShapeName(row.shape || 'row') }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="启用" align="center" width="72">
          <template #default="{ row }">
            <el-tooltip
              :content="row.enabled ? '定时自动同步运行中' : '已停用定时同步；缓存数据不受影响，引擎照常读取'"
              placement="top"
            >
              <span class="enable-badge" :class="{ on: row.enabled }">
                <span class="enable-dot" />
                {{ row.enabled ? '启用' : '停用' }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="数据源" min-width="160">
          <template #default="{ row }">
            <div class="source-cell">
              <el-tag size="small" type="warning" effect="plain" round>{{ row.source_type }}</el-tag>
              <code>{{ sourceTablePath(row) }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="目标" align="center" width="90">
          <template #default="{ row }">
            <el-tooltip :content="instanceName(row.redis_instance_id)" placement="top">
              <span class="db-chip">db{{ row.target_db }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="key 模板" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="key-tpl">{{ row.key_template }}</code>
          </template>
        </el-table-column>
        <el-table-column label="同步时间" align="center" width="120">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.sync_schedule"
              :content="`cron: ${row.sync_schedule}`"
              placement="top"
            >
              <span class="cron-chip">
                <el-icon><Clock /></el-icon>{{ getScheduleText(row.sync_schedule) }}
              </span>
            </el-tooltip>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" align="center" width="118">
          <template #default="{ row }">
            <span class="muted">{{ formatDate(row.updated_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, row)">
              <el-button class="more-btn" circle plain :icon="MoreFilled" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :icon="View" command="detail">查看详情</el-dropdown-item>
                  <el-dropdown-item :icon="Refresh" command="sync">触发同步</el-dropdown-item>
                  <el-dropdown-item :icon="Edit" :disabled="!canWrite" command="edit" divided>编辑配置</el-dropdown-item>
                  <el-dropdown-item :icon="Delete" :disabled="!canWrite" command="delete" divided class="danger-item">删除配置</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && definitions.length === 0"
        description="暂无缓存配置"
        :image-size="110"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      width="700px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><Document /></el-icon>
          <span>缓存配置详情</span>
        </div>
      </template>
      <div v-loading="detailLoading" class="detail-content">
        <template v-if="detail">
          <div class="detail-hero">
            <span class="kind-bar lg" :style="{ background: getShapeColor(detail.shape) }" />
            <div class="hero-text">
              <div class="hero-name">{{ detail.name }}</div>
              <div class="hero-sub">
                <el-tag size="small" effect="light" round :style="{ color: getShapeColor(detail.shape), background: getShapeBg(detail.shape), border: 'none' }">
                  {{ getShapeName(detail.shape || 'row') }}
                </el-tag>
                <el-tooltip
                  :content="detail.enabled ? '定时自动同步运行中' : '已停用定时同步；缓存数据不受影响，引擎照常读取'"
                  placement="top"
                >
                  <span class="enable-badge" :class="{ on: detail.enabled }">
                    <span class="enable-dot" />{{ detail.enabled ? '启用' : '停用' }}
                  </span>
                </el-tooltip>
              </div>
            </div>
            <el-tooltip content="点击复制 ID（引擎按 ID 绑定缓存契约，永久不变）" placement="top">
              <span class="hero-id copyable" @click="copyId(detail.id)">#{{ detail.id }}</span>
            </el-tooltip>
          </div>

          <div class="info-grid">
            <div class="info-item span2">
              <label>写入形态</label>
              <div>{{ getShapeName(detail.shape || 'row') }} —— {{ SHAPE_DESC[detail.shape || 'row'] }}</div>
            </div>
            <div class="info-item">
              <label>数据源类型</label>
              <div>{{ detail.source_type }}</div>
            </div>
            <div class="info-item">
              <label>源表</label>
              <div><code>{{ sourceTablePath(detail) }}</code></div>
            </div>
            <div class="info-item">
              <label>日期字段</label>
              <div><code v-if="detail.date_field">{{ detail.date_field }}</code><span v-else class="muted">—</span></div>
            </div>
            <div class="info-item">
              <label>Redis 实例</label>
              <div>{{ instanceName(detail.redis_instance_id) }}</div>
            </div>
            <div class="info-item">
              <label>目标 db</label>
              <div><span class="db-chip">db{{ detail.target_db }}</span></div>
            </div>
            <div class="info-item span2">
              <label>key 模板</label>
              <div><code>{{ detail.key_template }}</code></div>
            </div>
            <div class="info-item span2" v-if="detail.shape === 'array'">
              <label>聚合字段</label>
              <div><code>{{ detail.filter?.agg_field || 'stock_code' }}</code></div>
            </div>
            <div class="info-item span2">
              <label>同步时间</label>
              <div v-if="detail.sync_schedule">
                {{ getScheduleText(detail.sync_schedule) }}
                <code style="margin-left: 8px;">{{ detail.sync_schedule }}</code>
              </div>
              <span v-else class="muted">手动（不自动同步）</span>
            </div>
            <div class="info-item span2">
              <label>更新时间</label>
              <div class="muted">{{ formatDate(detail.updated_at) }}</div>
            </div>
          </div>

          <!-- 选取列 -->
          <div class="detail-block">
            <div class="block-title">选取列 · field_mapping</div>
            <div v-if="isEmptyMapping(detail.field_mapping)" class="full-copy-note">
              <el-icon><MagicStick /></el-icon>
              留空 → 全量复制源表所有列
            </div>
            <pre v-else class="json-block">{{ prettyJson(detail.field_mapping) }}</pre>
          </div>
        </template>
      </div>
    </el-dialog>

    <!-- 触发同步弹窗 -->
    <el-dialog
      v-model="syncVisible"
      width="500px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><Refresh /></el-icon>
          <span>触发同步</span>
        </div>
      </template>
      <div v-if="syncTarget" class="sync-form">
        <div class="sync-target">
          <span class="kind-bar" :style="{ background: getShapeColor(syncTarget.shape) }" />
          目标配置：<strong>{{ syncTarget.name }}</strong>
        </div>

        <div class="mode-cards">
          <div
            v-for="m in modeOptions"
            :key="m.value"
            class="mode-card"
            :class="{ active: syncMode === m.value, danger: m.value === 'full' }"
            @click="syncMode = m.value as any"
          >
            <div class="mode-name">{{ m.label }}</div>
            <div class="mode-desc">{{ m.short }}</div>
          </div>
        </div>

        <div v-if="syncMode === 'incr'" class="field">
          <label>目标日期</label>
          <el-date-picker
            v-model="syncTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择单日（默认最新交易日）"
            style="width: 100%;"
          />
        </div>

        <div v-if="syncMode === 'backfill'" class="field">
          <label>日期范围</label>
          <el-date-picker
            v-model="syncRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </div>

        <div class="sync-tip" :class="{ warn: syncMode === 'full' }">
          <el-icon><WarningFilled v-if="syncMode === 'full'" /><InfoFilled v-else /></el-icon>
          {{ syncTipText }}
        </div>
      </div>
      <template #footer>
        <el-button round @click="syncVisible = false">取消</el-button>
        <el-button type="primary" round :loading="syncSubmitting" @click="submitSync">确定触发</el-button>
      </template>
    </el-dialog>

    <!-- 新建 / 编辑 配置弹窗 -->
    <el-dialog
      v-model="formVisible"
      width="640px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <el-icon><component :is="formMode === 'edit' ? Edit : Plus" /></el-icon>
          <span>{{ formTitle }}</span>
        </div>
      </template>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px" class="cfg-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" prop="name">
              <el-input v-model="form.name" placeholder="如：日线" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="写入形态" prop="shape">
              <el-select v-model="form.shape" style="width: 100%;">
                <el-option
                  v-for="(label, val) in SHAPE_MAP"
                  :key="val"
                  :label="label"
                  :value="val"
                >
                  <span style="font-weight: 600;">{{ label }}</span>
                  <span style="color: #94a3b8; font-size: 12px; margin-left: 6px;">{{ val }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="shape-hint">
          <el-icon><InfoFilled /></el-icon>
          {{ SHAPE_DESC[form.shape] }}
        </div>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="数据源类型" prop="source_type">
              <el-select v-model="form.source_type" style="width: 100%;" @change="onSourceTypeChange">
                <el-option label="ClickHouse" value="clickhouse" />
                <el-option label="PostgreSQL" value="postgresql" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="源库" prop="source_database">
              <el-select
                v-model="form.source_database"
                placeholder="选择源库"
                filterable
                style="width: 100%;"
                :loading="dbListLoading"
                @change="onSourceDatabaseChange"
              >
                <el-option v-for="db in sourceDatabases" :key="db" :label="db" :value="db" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="源表" prop="source_table">
          <el-select
            v-model="form.source_table"
            placeholder="先选源库，再选源表"
            filterable
            style="width: 100%;"
            :loading="tableListLoading"
            :disabled="!form.source_database"
            no-data-text="该库下无表"
            @change="onSourceTableChange"
          >
            <el-option v-for="t in sourceTables" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>

        <el-form-item label="日期字段" prop="date_field">
          <el-select
            v-model="form.date_field"
            placeholder="先选源表，再选日期字段"
            filterable
            style="width: 100%;"
            :loading="columnsLoading"
            :disabled="!form.source_table"
            no-data-text="该表无列信息"
            @change="onDateFieldChange"
          >
            <el-option v-for="c in sourceColumns" :key="c.name" :value="c.name" :label="c.name">
              <span>{{ c.name }}</span>
              <span style="color: #94a3b8; font-size: 12px; margin-left: 8px;">{{ c.type }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <div class="date-field-hint">
          增量同步与数据日历的轴；各表日期列名不同，必须显式选择
        </div>

        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="Redis 实例" prop="redis_instance_id">
              <el-select v-model="form.redis_instance_id" placeholder="选择实例" style="width: 100%;" @change="onInstanceChange">
                <el-option
                  v-for="ins in instances"
                  :key="ins.id"
                  :label="`${ins.name}（db ${ins.reserved_db_range}）`"
                  :value="ins.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="目标 db" prop="target_db">
              <el-select
                v-model="form.target_db"
                placeholder="选择可用 db"
                filterable
                style="width: 100%;"
                :disabled="!form.redis_instance_id"
                no-data-text="该实例无可用 db"
              >
                <el-option v-for="db in availableDbs" :key="db" :label="`db${db}`" :value="db" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <div v-if="selectedDbRange" class="db-range-hint">
          实例 db 范围 <strong>{{ selectedDbRange }}</strong>，已排除被占用的 db，当前可用 <strong>{{ availableDbs.length }}</strong> 个
        </div>

        <el-form-item label="key 模板" prop="key_template">
          <el-input v-model="form.key_template" placeholder="如：{stock_code}:{trade_date}" />
        </el-form-item>
        <div v-if="suggestedKeyTemplate" class="key-tpl-hint">
          已按表唯一键（{{ keyBasis.join('、') }}）自动生成建议模板，可按需修改
        </div>

        <el-form-item label="同步时间">
          <div class="sched-builder">
            <el-select v-model="sched.mode" style="width: 120px;">
              <el-option label="手动" value="none" />
              <el-option label="每天" value="daily" />
              <el-option label="每周" value="weekly" />
              <el-option label="每月" value="monthly" />
              <el-option label="高级 Cron" value="cron" />
            </el-select>

            <el-select
              v-if="sched.mode === 'weekly'"
              v-model="sched.weekdays"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择星期"
              style="width: 200px;"
            >
              <el-option v-for="w in WEEKDAY_OPTIONS" :key="w.value" :label="w.label" :value="w.value" />
            </el-select>

            <el-select
              v-if="sched.mode === 'monthly'"
              v-model="sched.monthDays"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择日期"
              style="width: 190px;"
            >
              <el-option v-for="d in 31" :key="d" :label="`${d} 号`" :value="d" />
            </el-select>

            <el-time-picker
              v-if="['daily', 'weekly', 'monthly'].includes(sched.mode)"
              v-model="sched.time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="时间"
              style="width: 130px;"
            />

            <el-input
              v-if="sched.mode === 'cron'"
              v-model="sched.raw"
              placeholder="如 3 15 * * *（分 时 日 月 周）"
              style="flex: 1; min-width: 180px;"
            />
          </div>
          <div class="sched-preview">
            <el-icon><Clock /></el-icon>
            <span>{{ schedulePreview }}</span>
          </div>
        </el-form-item>

        <el-form-item v-if="form.shape === 'array'" label="聚合字段" prop="agg_field">
          <el-input v-model="form.agg_field" placeholder="哪一列收进数组，默认 stock_code">
            <template #prepend>GROUP 后聚合</template>
          </el-input>
        </el-form-item>

        <el-form-item label="选取列">
          <div class="col-picker">
            <div class="col-picker-head">
              <el-switch v-model="fullCopy" @change="onFullCopyChange" />
              <span class="switch-label">{{ fullCopy ? '全量复制所有列' : '只取指定列' }}</span>
              <el-button
                v-if="!fullCopy"
                size="small"
                text
                :icon="Refresh"
                :loading="columnsLoading"
                :disabled="!form.source_table"
                @click="loadSourceColumns"
              >刷新列</el-button>
            </div>

            <template v-if="!fullCopy">
              <div v-if="!form.source_table" class="col-empty">请先选择源表</div>
              <div v-else-if="sourceColumns.length === 0 && !columnsLoading" class="col-empty">
                该表无列信息，点「刷新列」重试
              </div>
              <div v-else v-loading="columnsLoading" class="col-list">
                <div class="col-list-toolbar">
                  <el-checkbox
                    :model-value="allColumnsChecked"
                    :indeterminate="someColumnsChecked"
                    @change="toggleAllColumns"
                  >全选</el-checkbox>
                  <span class="col-count">已选 {{ selectedColumns.length }} / {{ sourceColumns.length }}</span>
                </div>
                <el-checkbox-group v-model="selectedColumns" class="col-grid">
                  <el-checkbox
                    v-for="c in sourceColumns"
                    :key="c.name"
                    :value="c.name"
                    :disabled="c.name === form.date_field"
                    class="col-item"
                  >
                    <span class="col-name">{{ c.name }}</span>
                    <span class="col-type">{{ c.type }}</span>
                    <el-tag v-if="c.name === form.date_field" size="small" effect="plain" round class="date-tag">日期字段</el-tag>
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </template>
            <div v-else class="col-hint">留空提交，同步时复制源表的全部列。</div>
          </div>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
          <span class="enabled-hint">仅控制定时自动同步是否运行；停用后已缓存数据不受影响，引擎照常读取</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="formVisible = false">取消</el-button>
        <el-button type="primary" round :loading="formSubmitting" @click="submitForm">
          {{ formMode === 'edit' ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 删除弹窗（可选同时清空数据）-->
    <el-dialog
      v-model="deleteVisible"
      width="460px"
      :close-on-click-modal="false"
      class="cm-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header danger">
          <el-icon><Delete /></el-icon>
          <span>删除配置</span>
        </div>
      </template>
      <div v-if="deleteTarget" class="delete-body">
        <p class="delete-text">
          确定删除缓存配置「<strong>{{ deleteTarget.name }}</strong>」？
          将一并删除其同步记录与覆盖度记录。
        </p>
        <div class="clear-hint">
          <el-icon><InfoFilled /></el-icon>
          仅删除配置，已写入 Redis 的数据保留；如需清理，请到「数据管理」Tab 清空对应 db。
        </div>
      </div>
      <template #footer>
        <el-button round @click="deleteVisible = false">取消</el-button>
        <el-button type="danger" round :loading="deleteSubmitting" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Refresh, Plus, InfoFilled, View, Document, Clock, MagicStick, WarningFilled,
  MoreFilled, Edit, Delete
} from '@element-plus/icons-vue'

defineProps<{ canWrite: boolean }>()
const emit = defineEmits<{ (e: 'synced'): void }>()

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
const definitions = ref<any[]>([])
const instances = ref<any[]>([])

// 写入形态：唯一影响同步算法、需要用户选择的维度
const SHAPE_MAP: Record<string, string> = {
  row: '逐行',
  array: '聚合数组'
}
const SHAPE_DESC: Record<string, string> = {
  row: '源表一行 → 一个 key，值为单条对象（价格、指数等绝大多数表）',
  array: '多行按字段聚合 → 一个 key，值为数组（行业成分、ST 名单等）'
}
const SHAPE_COLOR: Record<string, string> = {
  row: '#3b82f6',
  array: '#8b5cf6'
}
const SHAPE_BG: Record<string, string> = {
  row: '#eff6ff',
  array: '#f5f3ff'
}
const getShapeName = (shape: string) => SHAPE_MAP[shape] || shape || 'row'
const getShapeColor = (shape: string) => SHAPE_COLOR[shape] || '#64748b'
const getShapeBg = (shape: string) => SHAPE_BG[shape] || '#f1f5f9'

const modeOptions = [
  { value: 'full', label: '全量', short: '复制全部' },
  { value: 'incr', label: '增量', short: '指定单日' },
  { value: 'backfill', label: '补数', short: '区间补齐' }
]

// 把 cron 表达式翻译成人话（分 时 日 月 周），支持多星期/多日期
const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const getScheduleText = (cron: string): string => {
  if (!cron) return ''
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [min, hour, dom, mon, dow] = parts
  // 分、时必须是具体数字、月必须为 * 才好翻译，否则原样返回
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hour) || mon !== '*') return cron
  const hhmm = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
  // 每天
  if (dom === '*' && dow === '*') return `每天 ${hhmm}`
  // 每周某些天
  if (dom === '*' && /^\d+(,\d+)*$/.test(dow)) {
    const names = dow.split(',').map(d => WEEK_NAMES[Number(d) % 7]).join('、')
    return `每${names} ${hhmm}`
  }
  // 每月某些日
  if (dow === '*' && /^\d+(,\d+)*$/.test(dom)) {
    return `每月${dom.split(',').join('、')}号 ${hhmm}`
  }
  return cron
}

// 复制配置 ID（引擎按 ID 绑定缓存契约）
const copyId = async (id: number) => {
  try {
    await navigator.clipboard.writeText(String(id))
    ElMessage.success(`已复制配置 ID：${id}`)
  } catch {
    ElMessage.error('复制失败')
  }
}

const sourceTablePath = (row: any) => {
  if (!row) return '-'
  return row.source_database ? `${row.source_database}.${row.source_table}` : row.source_table
}

const instanceName = (id: number) => {
  const ins = instances.value.find(i => i.id === id)
  return ins ? ins.name : `实例#${id}`
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

const isEmptyMapping = (obj: any) => {
  if (obj === null || obj === undefined) return true
  if (typeof obj === 'string') return obj.trim() === ''
  if (Array.isArray(obj)) return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

const prettyJson = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

const loadInstances = async () => {
  try {
    const res = await window.electronAPI.marketData.listInstances()
    if (res.success && res.data) {
      instances.value = res.data.instances || []
    }
  } catch (e) {
    console.error('加载Redis实例失败:', e)
  }
}

const loadDefinitions = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.marketData.listDefinitions()
    if (res.success && res.data) {
      definitions.value = res.data.definitions || []
    } else {
      ElMessage.error(res.error || '获取缓存配置失败')
    }
  } catch (error: any) {
    ElMessage.error('获取缓存配置失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 详情弹窗
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)

const viewDetail = async (row: any) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await window.electronAPI.marketData.getDefinition(row.id)
    if (res.success && res.data) {
      detail.value = res.data.definition || res.data
    } else {
      ElMessage.error(res.error || '获取配置详情失败')
      detailVisible.value = false
    }
  } catch (error: any) {
    ElMessage.error('获取配置详情失败: ' + error.message)
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

// 触发同步弹窗
const syncVisible = ref(false)
const syncSubmitting = ref(false)
const syncTarget = ref<any>(null)
const syncMode = ref<'full' | 'incr' | 'backfill'>('incr')
const syncTo = ref<string>('')
const syncRange = ref<[string, string] | null>(null)

const syncTipText = computed(() => {
  if (syncMode.value === 'full') return '全量：清空并重新复制源表全部数据，写入量大，请谨慎操作。'
  if (syncMode.value === 'incr') return '增量：仅同步指定单日（留空则同步最新交易日）。'
  return '补数：同步选定日期范围内的数据，用于补齐覆盖缺口。'
})

const openSyncDialog = (row: any) => {
  syncTarget.value = row
  syncMode.value = 'incr'
  syncTo.value = ''
  syncRange.value = null
  syncVisible.value = true
}

// 操作菜单统一分发，新增功能只需在此加一个分支 + 一个菜单项
const handleAction = (command: string, row: any) => {
  switch (command) {
    case 'detail':
      viewDetail(row)
      break
    case 'sync':
      openSyncDialog(row)
      break
    case 'edit':
      openEdit(row)
      break
    case 'delete':
      openDelete(row)
      break
  }
}

// ===== 新建 / 编辑 / 克隆 表单 =====
const formVisible = ref(false)
const formSubmitting = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const emptyForm = () => ({
  name: '',
  shape: 'row',
  enabled: true,
  source_type: 'clickhouse',
  source_database: '',
  source_table: '',
  date_field: '',
  redis_instance_id: undefined as number | undefined,
  target_db: undefined as number | undefined,
  key_template: '',
  agg_field: 'stock_code'
})
const form = ref(emptyForm())

// ===== 友好调度选择器（底层生成 cron）=====
const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 }
]
type SchedMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'cron'
const sched = ref<{ mode: SchedMode; time: string; weekdays: number[]; monthDays: number[]; raw: string }>({
  mode: 'none', time: '09:00', weekdays: [], monthDays: [], raw: ''
})

// 把友好选择拼成 cron（分 时 日 月 周）
const buildScheduleCron = (): string => {
  const s = sched.value
  if (s.mode === 'none') return ''
  if (s.mode === 'cron') return s.raw.trim()
  const [hh, mm] = (s.time || '09:00').split(':')
  const h = String(Number(hh))
  const m = String(Number(mm))
  if (s.mode === 'daily') return `${m} ${h} * * *`
  if (s.mode === 'weekly') {
    const dow = s.weekdays.length ? [...s.weekdays].sort((a, b) => a - b).join(',') : '*'
    return `${m} ${h} * * ${dow}`
  }
  if (s.mode === 'monthly') {
    const dom = s.monthDays.length ? [...s.monthDays].sort((a, b) => a - b).join(',') : '*'
    return `${m} ${h} ${dom} * *`
  }
  return ''
}

const schedulePreview = computed(() => {
  const cron = buildScheduleCron()
  if (!cron) return '手动（不自动同步，需手动触发）'
  const human = getScheduleText(cron)
  return human === cron ? `cron: ${cron}` : `${human}（cron: ${cron}）`
})

// 把已有 cron 反解析回友好表单
const parseScheduleToForm = (cron: string) => {
  if (!cron || !cron.trim()) {
    sched.value = { mode: 'none', time: '09:00', weekdays: [], monthDays: [], raw: '' }
    return
  }
  const parts = cron.trim().split(/\s+/)
  const parseable = parts.length >= 5 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && parts[3] === '*'
  if (!parseable) {
    sched.value = { mode: 'cron', time: '09:00', weekdays: [], monthDays: [], raw: cron.trim() }
    return
  }
  const [min, hour, dom, , dow] = parts
  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
  if (dom === '*' && dow === '*') {
    sched.value = { mode: 'daily', time, weekdays: [], monthDays: [], raw: '' }
  } else if (dom === '*' && /^\d+(,\d+)*$/.test(dow)) {
    sched.value = { mode: 'weekly', time, weekdays: dow.split(',').map(Number), monthDays: [], raw: '' }
  } else if (dow === '*' && /^\d+(,\d+)*$/.test(dom)) {
    sched.value = { mode: 'monthly', time, weekdays: [], monthDays: dom.split(',').map(Number), raw: '' }
  } else {
    sched.value = { mode: 'cron', time: '09:00', weekdays: [], monthDays: [], raw: cron.trim() }
  }
}

const formTitle = computed(() => {
  if (formMode.value === 'edit') return '编辑缓存配置'
  return '新建缓存配置'
})

// 所选实例的可用 db 范围（如 "5-99"）
const selectedDbRange = computed(() => {
  const ins = instances.value.find(i => i.id === form.value.redis_instance_id)
  return ins?.reserved_db_range || ''
})

const parseRange = (range: string): [number, number] | null => {
  const m = String(range || '').match(/^(\d+)\s*-\s*(\d+)$/)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

// 同实例下已被其它配置占用的 db（编辑时排除自己当前的 db）
const usedDbs = computed(() => {
  const set = new Set<number>()
  definitions.value.forEach(d => {
    if (d.redis_instance_id === form.value.redis_instance_id
      && d.id !== editingId.value
      && typeof d.target_db === 'number') {
      set.add(d.target_db)
    }
  })
  return set
})

// 该实例可选的 db（范围内 - 已占用）
const availableDbs = computed(() => {
  const range = parseRange(selectedDbRange.value)
  if (!range) return [] as number[]
  const arr: number[] = []
  for (let i = range[0]; i <= range[1]; i++) {
    if (!usedDbs.value.has(i)) arr.push(i)
  }
  return arr
})

const onInstanceChange = () => {
  // 切换实例后，可用集合变了：当前 db 若不在可用集合内则清空，强制重选
  if (form.value.target_db !== undefined && !availableDbs.value.includes(form.value.target_db)) {
    form.value.target_db = undefined
  }
}

const targetDbValidator = (_rule: any, value: number, callback: any) => {
  if (value === undefined || value === null) return callback(new Error('请填写目标 db'))
  const range = parseRange(selectedDbRange.value)
  if (range && (value < range[0] || value > range[1])) {
    return callback(new Error(`需在 ${range[0]}-${range[1]} 范围内`))
  }
  callback()
}

const aggFieldValidator = (_rule: any, value: string, callback: any) => {
  if (form.value.shape === 'array' && (!value || !value.trim())) {
    return callback(new Error('聚合数组形态需填写聚合字段'))
  }
  callback()
}

const formRules: FormRules = {
  name: [{ required: true, message: '请填写名称', trigger: 'blur' }],
  shape: [{ required: true, message: '请选择写入形态', trigger: 'change' }],
  source_type: [{ required: true, message: '请选择数据源类型', trigger: 'change' }],
  source_database: [{ required: true, message: '请选择源库', trigger: 'change' }],
  source_table: [{ required: true, message: '请选择源表', trigger: 'change' }],
  date_field: [{ required: true, message: '请选择日期字段', trigger: 'change' }],
  redis_instance_id: [{ required: true, message: '请选择 Redis 实例', trigger: 'change' }],
  target_db: [{ validator: targetDbValidator, trigger: 'change' }],
  key_template: [{ required: true, message: '请填写 key 模板', trigger: 'blur' }],
  agg_field: [{ validator: aggFieldValidator, trigger: 'blur' }]
}

// ===== 源库 / 源表 穿透下拉 =====
const sourceDatabases = ref<string[]>([])
const sourceTables = ref<string[]>([])
const dbListLoading = ref(false)
const tableListLoading = ref(false)

const loadSourceDatabases = async () => {
  if (!form.value.source_type) return
  dbListLoading.value = true
  try {
    const res = await window.electronAPI.marketData.sourceDatabases(form.value.source_type)
    if (res.success && res.data) {
      sourceDatabases.value = res.data.databases || []
    } else {
      sourceDatabases.value = []
      ElMessage.error(res.error || '获取源库列表失败')
    }
  } catch (error: any) {
    sourceDatabases.value = []
    ElMessage.error('获取源库列表失败: ' + error.message)
  } finally {
    dbListLoading.value = false
  }
}

const loadSourceTables = async () => {
  if (!form.value.source_type || !form.value.source_database) {
    sourceTables.value = []
    return
  }
  tableListLoading.value = true
  try {
    const res = await window.electronAPI.marketData.sourceTables(form.value.source_type, form.value.source_database)
    if (res.success && res.data) {
      sourceTables.value = res.data.tables || []
    } else {
      sourceTables.value = []
      ElMessage.error(res.error || '获取源表列表失败')
    }
  } catch (error: any) {
    sourceTables.value = []
    ElMessage.error('获取源表列表失败: ' + error.message)
  } finally {
    tableListLoading.value = false
  }
}

// 改数据源类型 → 重置源库+源表+日期字段，重新拉库
const onSourceTypeChange = () => {
  form.value.source_database = ''
  form.value.source_table = ''
  form.value.date_field = ''
  sourceTables.value = []
  resetColumns()
  loadSourceDatabases()
}

// 改源库 → 重置源表+日期字段，重新拉表
const onSourceDatabaseChange = () => {
  form.value.source_table = ''
  form.value.date_field = ''
  resetColumns()
  loadSourceTables()
}

// ===== 选取列（穿透列 + 多选）=====
const fullCopy = ref(true)
const sourceColumns = ref<{ name: string; type: string }[]>([])
const selectedColumns = ref<string[]>([])
const columnsLoading = ref(false)
// 按表唯一键生成的 key 模板建议（来自 /source/columns，纯照搬零猜测）
const suggestedKeyTemplate = ref('')
const keyBasis = ref<string[]>([])

const allColumnsChecked = computed(() =>
  sourceColumns.value.length > 0 && selectedColumns.value.length === sourceColumns.value.length)
const someColumnsChecked = computed(() =>
  selectedColumns.value.length > 0 && selectedColumns.value.length < sourceColumns.value.length)

const toggleAllColumns = (val: any) => {
  if (val) {
    selectedColumns.value = sourceColumns.value.map(c => c.name)
  } else {
    // 取消全选时仍保留日期字段（必须包含）
    selectedColumns.value = form.value.date_field ? [form.value.date_field] : []
  }
}

const resetColumns = () => {
  sourceColumns.value = []
  selectedColumns.value = []
  suggestedKeyTemplate.value = ''
  keyBasis.value = []
}

// 选取列 → field_mapping（不重命名：{列:列}；全量则 {}）
const buildFieldMapping = (): Record<string, string> => {
  if (fullCopy.value) return {}
  const m: Record<string, string> = {}
  selectedColumns.value.forEach(c => { m[c] = c })
  return m
}

const loadSourceColumns = async () => {
  if (!form.value.source_type || !form.value.source_database || !form.value.source_table) {
    sourceColumns.value = []
    return
  }
  columnsLoading.value = true
  try {
    const res = await window.electronAPI.marketData.sourceColumns(
      form.value.source_type, form.value.source_database, form.value.source_table
    )
    if (res.success && res.data) {
      sourceColumns.value = res.data.columns || []
      suggestedKeyTemplate.value = res.data.suggested_key_template || ''
      keyBasis.value = res.data.key_basis || []
    } else {
      sourceColumns.value = []
      suggestedKeyTemplate.value = ''
      keyBasis.value = []
      ElMessage.error(res.error || '获取列信息失败')
    }
  } catch (error: any) {
    sourceColumns.value = []
    suggestedKeyTemplate.value = ''
    keyBasis.value = []
    ElMessage.error('获取列信息失败: ' + error.message)
  } finally {
    columnsLoading.value = false
  }
}

const onFullCopyChange = (val: any) => {
  if (!val) {
    // 切到"只取指定列"：拉列清单，并强制带上日期字段
    if (sourceColumns.value.length === 0) loadSourceColumns()
    ensureDateFieldSelected()
  }
}

// 改源表 → 重置已选列与日期字段，重新拉列（日期字段下拉依赖列清单）
const onSourceTableChange = async () => {
  selectedColumns.value = []
  form.value.date_field = ''
  sourceColumns.value = []
  await loadSourceColumns()
  // 按表唯一键自动预填 key 模板（可编辑）；表没声明唯一键则不预填
  if (suggestedKeyTemplate.value) {
    form.value.key_template = suggestedKeyTemplate.value
  }
}

// 选取列模式下，日期字段必须包含在已选列里（后端强校验）
const ensureDateFieldSelected = () => {
  const df = form.value.date_field
  if (!fullCopy.value && df && !selectedColumns.value.includes(df)) {
    selectedColumns.value = [...selectedColumns.value, df]
  }
}

// 改日期字段 → 选取列模式下强制勾选新日期字段
const onDateFieldChange = () => {
  ensureDateFieldSelected()
}

const fillFormFrom = (row: any) => {
  form.value = {
    name: row.name || '',
    shape: row.shape || 'row',
    enabled: row.enabled ?? true,
    source_type: row.source_type || 'clickhouse',
    source_database: row.source_database || '',
    source_table: row.source_table || '',
    date_field: row.date_field || '',
    redis_instance_id: row.redis_instance_id,
    target_db: row.target_db,
    key_template: row.key_template || '',
    agg_field: row.filter?.agg_field || 'stock_code'
  }
  parseScheduleToForm(row.sync_schedule || '')
  // 选取列：field_mapping 为空=全量；否则取其 key 作为已选列
  const fm = row.field_mapping
  if (fm && typeof fm === 'object' && Object.keys(fm).length > 0) {
    fullCopy.value = false
    selectedColumns.value = Object.keys(fm)
  } else {
    fullCopy.value = true
    selectedColumns.value = []
  }
  sourceColumns.value = []
}

const openCreate = () => {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  sched.value = { mode: 'none', time: '09:00', weekdays: [], monthDays: [], raw: '' }
  sourceDatabases.value = []
  sourceTables.value = []
  fullCopy.value = true
  resetColumns()
  formVisible.value = true
  formRef.value?.clearValidate()
  loadSourceDatabases()
}

const openEdit = (row: any) => {
  formMode.value = 'edit'
  editingId.value = row.id
  fillFormFrom(row)
  formVisible.value = true
  formRef.value?.clearValidate()
  loadSourceDatabases()
  loadSourceTables()
  // 日期字段下拉依赖列清单，编辑时始终拉取
  loadSourceColumns()
}

const buildPayload = () => {
  const f = form.value
  return {
    name: f.name.trim(),
    enabled: f.enabled,
    shape: f.shape,
    source_type: f.source_type,
    source_database: f.source_database?.trim() || '',
    source_table: f.source_table.trim(),
    date_field: f.date_field,
    redis_instance_id: f.redis_instance_id,
    target_db: f.target_db,
    key_template: f.key_template.trim(),
    field_mapping: buildFieldMapping(),
    filter: f.shape === 'array' ? { agg_field: f.agg_field?.trim() || 'stock_code' } : {},
    sync_schedule: buildScheduleCron()
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!fullCopy.value && selectedColumns.value.length === 0) {
      ElMessage.warning('「只取指定列」模式下请至少勾选一列，或切回全量复制')
      return
    }
    formSubmitting.value = true
    try {
      const payload = buildPayload()
      const res = formMode.value === 'edit' && editingId.value !== null
        ? await window.electronAPI.marketData.updateDefinition(editingId.value, payload)
        : await window.electronAPI.marketData.createDefinition(payload)
      if (res.success) {
        ElMessage.success(formMode.value === 'edit' ? '已保存' : '已创建')
        formVisible.value = false
        loadDefinitions()
      } else {
        ElMessage.error(res.error || '保存失败')
      }
    } catch (error: any) {
      ElMessage.error('保存失败: ' + error.message)
    } finally {
      formSubmitting.value = false
    }
  })
}

// 删除配置（只删配置，不动数据；数据清理在「数据管理」Tab）
const deleteVisible = ref(false)
const deleteSubmitting = ref(false)
const deleteTarget = ref<any>(null)

const openDelete = (row: any) => {
  deleteTarget.value = row
  deleteVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleteSubmitting.value = true
  try {
    const res = await window.electronAPI.marketData.deleteDefinition(deleteTarget.value.id)
    if (res.success) {
      ElMessage.success(res.data?.message || '已删除')
      deleteVisible.value = false
      loadDefinitions()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch (error: any) {
    ElMessage.error('删除失败: ' + error.message)
  } finally {
    deleteSubmitting.value = false
  }
}

const submitSync = async () => {
  if (!syncTarget.value) return

  const body: { mode: string; from?: string; to?: string } = { mode: syncMode.value }
  if (syncMode.value === 'incr') {
    body.to = syncTo.value || ''
    body.from = ''
  } else if (syncMode.value === 'backfill') {
    if (!syncRange.value || syncRange.value.length !== 2) {
      ElMessage.warning('请选择补数的日期范围')
      return
    }
    body.from = syncRange.value[0]
    body.to = syncRange.value[1]
  } else {
    body.from = ''
    body.to = ''
  }

  // 全量写入量大，二次确认
  if (syncMode.value === 'full') {
    try {
      await ElMessageBox.confirm(
        `全量同步会写入「${syncTarget.value.name}」源表的全部数据，数据量可能很大，确定继续？`,
        '全量同步确认',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }

  syncSubmitting.value = true
  try {
    const res = await window.electronAPI.marketData.triggerSync(syncTarget.value.id, body)
    if (res.success) {
      ElMessage.success(res.data?.message || '已触发同步')
      syncVisible.value = false
      emit('synced')
    } else {
      ElMessage.error(res.error || '触发同步失败')
    }
  } catch (error: any) {
    ElMessage.error('触发同步失败: ' + error.message)
  } finally {
    syncSubmitting.value = false
  }
}

onMounted(() => {
  loadInstances()
  loadDefinitions()
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

  .id-chip {
    display: inline-block;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 10px;
    border-radius: 6px;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: #eef2ff;
      color: #4f6ef0;
    }
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 12px;

    .kind-bar {
      width: 4px;
      height: 30px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .name-text {
      display: flex;
      flex-direction: column;
      gap: 5px;

      .name-main {
        font-weight: 600;
        color: #1e293b;
        font-size: 13px;
      }
    }
  }

  .enable-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;

    .enable-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #cbd5e1;
    }

    &.on {
      color: #16a34a;
      .enable-dot {
        background: #22c55e;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
      }
    }
  }

  .source-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .target-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #475569;

    .target-icon { color: #f59e0b; font-size: 15px; }

    .db-chip {
      background: #eef2ff;
      color: #4f6ef0;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
  }

  .key-tpl { color: #7c3aed !important; background: #f5f3ff !important; }

  .cron-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    color: #64748b;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 12px;
    font-family: 'SF Mono', 'Consolas', monospace;
  }

  .more-btn {
    color: #94a3b8;
    border-color: #e2e8f0;

    &:hover {
      color: #3b82f6;
      border-color: #bfdbfe;
      background: #eff6ff;
    }
  }
}

/* 弹窗通用 */
:deep(.cm-dialog) {
  border-radius: 18px;
  overflow: hidden;
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

.delete-body {
  .delete-text {
    margin: 0 0 14px;
    font-size: 14px;
    color: #475569;
    line-height: 1.6;
    strong { color: #1e293b; }
  }

  .clear-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f8fafc;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12px;
    color: #94a3b8;

    .el-icon { flex-shrink: 0; color: #94a3b8; }
  }
}

:deep(.danger-item) {
  color: #dc2626;
  &:not(.is-disabled):hover {
    background: #fef2f2;
    color: #dc2626;
  }
}

.detail-content {
  min-height: 120px;

  code {
    background: #f1f5f9;
    padding: 2px 7px;
    border-radius: 6px;
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 13px;
    color: #475569;
  }

  .detail-hero {
    display: flex;
    align-items: center;
    gap: 14px;
    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    border-radius: 12px;
    padding: 16px 18px;
    margin-bottom: 18px;

    .kind-bar.lg { width: 5px; height: 42px; border-radius: 5px; }

    .hero-text {
      flex: 1;
      .hero-name { font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
      .hero-sub { display: flex; align-items: center; gap: 10px; }
    }

    .hero-id {
      font-family: 'SF Mono', 'Consolas', monospace;
      color: #94a3b8;
      font-size: 13px;

      &.copyable {
        cursor: pointer;
        padding: 3px 9px;
        border-radius: 6px;
        background: #fff;
        transition: all 0.15s;

        &:hover {
          color: #4f6ef0;
          background: #eef2ff;
        }
      }
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: #eef2f7;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #eef2f7;

    .info-item {
      background: #fff;
      padding: 12px 16px;

      &.span2 { grid-column: span 2; }

      label {
        display: block;
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 5px;
      }

      div { font-size: 13px; color: #334155; }
    }
  }

  .detail-block {
    margin-top: 18px;

    .block-title {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 9px;
    }

    .full-copy-note {
      display: flex;
      align-items: center;
      gap: 7px;
      background: linear-gradient(135deg, #eff6ff, #e0e7ff);
      color: #4f6ef0;
      padding: 11px 15px;
      border-radius: 10px;
      font-size: 13px;

      &.muted-note { background: #f8fafc; color: #94a3b8; }
    }

    .json-block {
      background: #0f172a;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 240px;
      margin: 0;
    }
  }
}

.enable-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;

  .enable-dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; }
  &.on { color: #16a34a; .enable-dot { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.18); } }
}

.db-chip {
  background: #eef2ff;
  color: #4f6ef0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.cfg-form {
  .shape-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: -8px 0 16px 92px;
    font-size: 12px;
    color: #8b5cf6;
    background: #f5f3ff;
    border-radius: 8px;
    padding: 8px 12px;

    .el-icon { font-size: 14px; flex-shrink: 0; }
  }

  .db-range-hint {
    margin: -8px 0 14px 92px;
    font-size: 12px;
    color: #94a3b8;
    strong { color: #4f6ef0; }
  }

  .enabled-hint {
    margin-left: 12px;
    font-size: 12px;
    color: #94a3b8;
  }

  .date-field-hint {
    margin: -8px 0 14px 92px;
    font-size: 12px;
    color: #94a3b8;
  }

  .key-tpl-hint {
    margin: -8px 0 14px 92px;
    font-size: 12px;
    color: #4f6ef0;
  }

  .col-picker {
    width: 100%;

    .col-picker-head {
      display: flex;
      align-items: center;
      gap: 10px;

      .switch-label { font-size: 13px; color: #475569; }
    }

    .col-hint, .col-empty {
      margin-top: 8px;
      font-size: 12px;
      color: #94a3b8;
    }

    .col-list {
      margin-top: 10px;
      border: 1px solid #eef2f7;
      border-radius: 10px;
      padding: 10px 12px;

      .col-list-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        margin-bottom: 6px;
        border-bottom: 1px solid #f1f5f9;

        .col-count { font-size: 12px; color: #94a3b8; }
      }

      .col-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 16px;
        max-height: 220px;
        overflow-y: auto;
      }

      .col-item {
        margin-right: 0;
        :deep(.el-checkbox__label) {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          overflow: hidden;
        }
        .col-name { color: #334155; }
        .date-tag { color: #4f6ef0; border-color: #c7d2fe; }
        .col-type {
          font-size: 11px;
          color: #94a3b8;
          font-family: 'SF Mono', 'Consolas', monospace;
        }
      }
    }
  }

  .sched-builder {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    width: 100%;
  }

  .sched-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: #4f6ef0;

    .el-icon { font-size: 14px; }
  }
}

.sync-form {
  .sync-target {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    font-size: 14px;
    color: #64748b;

    .kind-bar { width: 4px; height: 20px; border-radius: 4px; }
    strong { color: #1e293b; }
  }

  .mode-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 18px;

    .mode-card {
      border: 1.5px solid #eef2f7;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;

      .mode-name { font-size: 14px; font-weight: 600; color: #334155; }
      .mode-desc { font-size: 11px; color: #94a3b8; margin-top: 3px; }

      &:hover { border-color: #c7d2fe; }

      &.active {
        border-color: #3b82f6;
        background: #eff6ff;
        .mode-name { color: #2563eb; }
      }
      &.active.danger {
        border-color: #ef4444;
        background: #fef2f2;
        .mode-name { color: #dc2626; }
      }
    }
  }

  .field {
    margin-bottom: 16px;
    label { display: block; font-size: 13px; color: #64748b; margin-bottom: 7px; }
  }

  .sync-tip {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: #64748b;
    background: #f8fafc;
    padding: 10px 14px;
    border-radius: 10px;
    line-height: 1.5;

    .el-icon { color: #94a3b8; }

    &.warn {
      background: #fef2f2;
      color: #dc2626;
      .el-icon { color: #ef4444; }
    }
  }
}
</style>
