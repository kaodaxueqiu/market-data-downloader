<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="列变更"
    width="680px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-if="row" class="alter-dialog-body">
      <div class="info-row">
        <span class="label">目标表：</span>
        <span class="value">{{ tableName }}</span>
      </div>

      <el-alert type="info" :closable="false" class="alter-tip">
        仅支持列级变更：ADD / DROP / MODIFY / RENAME COLUMN（秒级元数据操作）。
        变更后元数据指纹将被标记为「已手工变更」。
      </el-alert>

      <el-form label-position="top">
        <el-form-item label="ALTER SQL（alter_sql）">
          <el-input
            v-model="alterSql"
            type="textarea"
            :rows="4"
            :placeholder="`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS vwap Float64 DEFAULT 0`"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">执行列变更</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { IntermediateTableMeta } from '@/types/backtest'

const props = defineProps<{
  modelValue: boolean
  row: IntermediateTableMeta | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: []
}>()

const tableName = computed(() => props.row?.full_name || props.row?.table_name || '')
const submitting = ref(false)
const alterSql = ref('')

watch(() => props.modelValue, (v) => {
  if (v) alterSql.value = ''
})

const handleSubmit = async () => {
  const sql = alterSql.value.trim()
  if (!sql) { ElMessage.warning('请填写 ALTER SQL'); return }
  if (!props.row) return
  submitting.value = true
  try {
    const result = await window.electronAPI.intermediateTable.alter({
      table_name: tableName.value,
      alter_sql: sql
    })
    if (result.success) {
      ElMessage.success('列变更完成（秒级元数据操作）')
      emit('updated')
      emit('update:modelValue', false)
    } else {
      ElMessage.error(result.error || '列变更失败')
    }
  } catch (e: any) {
    ElMessage.error('列变更失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.alter-dialog-body { padding: 0 4px; }
.info-row { display: flex; align-items: center; margin-bottom: 12px; }
.info-row .label { color: #6b7280; font-size: 14px; }
.info-row .value { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; color: #1f2937; }
.alter-tip { margin-bottom: 14px; }
</style>
