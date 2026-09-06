<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="追加数据"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-if="row" class="append-dialog-body">
      <div class="info-row">
        <span class="label">目标表：</span>
        <span class="value">{{ tableName }}</span>
      </div>

      <el-alert type="info" :closable="false" class="append-tip">
        适用于 CTE / UNION / 子查询 / 窗口函数等复杂形态，或大数据量分批灌数。
        date_range 会由引擎自动注入 WHERE trade_date 过滤（左闭右开）。建议逐月追加。
      </el-alert>

      <el-form label-position="top">
        <el-form-item label="INSERT SQL（insert_sql）">
          <div ref="sqlEditorRef" class="code-editor"></div>
        </el-form-item>
        <el-form-item label="日期范围（date_range，可选，建议一个月）">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">追加数据</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { sql as sqlLang } from '@codemirror/lang-sql'
import type { IntermediateTableMeta } from '@/types/backtest'

const props = defineProps<{
  modelValue: boolean
  row: IntermediateTableMeta | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  building: [payload: { build_id: string; table_name: string; is_rebuild: boolean; kind: 'append' }]
}>()

const tableName = computed(() => props.row?.full_name || props.row?.table_name || '')

const submitting = ref(false)
const dateRange = ref<[string, string] | null>(null)

// CodeMirror SQL 编辑器
const sqlEditorRef = ref<HTMLElement>()
let sqlEditor: EditorView | null = null
const insertSql = ref('')

const initEditor = () => {
  if (!sqlEditorRef.value || sqlEditor) return
  sqlEditor = new EditorView({
    doc: insertSql.value,
    extensions: [
      basicSetup,
      sqlLang(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) insertSql.value = update.state.doc.toString()
      })
    ],
    parent: sqlEditorRef.value
  })
}

const destroyEditor = () => {
  sqlEditor?.destroy()
  sqlEditor = null
}

// 打开时默认填一个月（上月 1 号 ~ 上月末），提示逐月追加
const defaultLastMonth = (): [string, string] => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [fmt(start), fmt(end)]
}

watch(() => props.modelValue, async (v) => {
  if (!v) { destroyEditor(); return }
  insertSql.value = ''
  dateRange.value = defaultLastMonth()
  await nextTick()
  initEditor()
})

onBeforeUnmount(destroyEditor)

const handleSubmit = async () => {
  const sql = insertSql.value.trim()
  if (!sql) { ElMessage.warning('请填写 INSERT SQL'); return }
  if (!props.row) return
  submitting.value = true
  try {
    const payload: any = { table_name: tableName.value, insert_sql: sql }
    if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
      payload.date_range = [dateRange.value[0], dateRange.value[1]]
    }
    const result = await window.electronAPI.intermediateTable.append(payload)
    if (result.success && result.data?.build_id) {
      ElMessage.success('已提交追加任务')
      emit('building', {
        build_id: result.data.build_id,
        table_name: tableName.value,
        is_rebuild: true,
        kind: 'append'
      })
      emit('update:modelValue', false)
    } else {
      ElMessage.error(result.error || '追加数据失败')
    }
  } catch (e: any) {
    ElMessage.error('追加数据失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.append-dialog-body { padding: 0 4px; }
.info-row { display: flex; align-items: center; margin-bottom: 12px; }
.info-row .label { color: #6b7280; font-size: 14px; }
.info-row .value { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; color: #1f2937; }
.append-tip { margin-bottom: 14px; }
.code-editor {
  height: 240px;
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.code-editor :deep(.cm-editor) {
  height: 100%;
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
.code-editor :deep(.cm-scroller) { overflow: auto; }
</style>
