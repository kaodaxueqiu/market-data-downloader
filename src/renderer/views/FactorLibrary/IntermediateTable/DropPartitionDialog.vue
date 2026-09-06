<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="按分区清除"
    width="480px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-if="row" class="dp-dialog-body">
      <div class="info-row">
        <span class="label">目标表：</span>
        <span class="value">{{ tableName }}</span>
      </div>

      <el-form label-position="top">
        <el-form-item label="要清除的分区（按月份）">
          <el-date-picker
            v-model="month"
            type="month"
            placeholder="选择月份"
            format="YYYY-MM"
            value-format="YYYYMM"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>

      <el-alert type="warning" :closable="false">
        确认清除表 {{ tableName }} 的分区 <b>{{ month || '—' }}</b>？
        仅该月数据被删除，其余分区不受影响，清除后可重新「追加数据」该月恢复。
      </el-alert>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="danger" :disabled="!month" :loading="submitting" @click="handleSubmit">清除该分区</el-button>
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
const month = ref('')

watch(() => props.modelValue, (v) => {
  if (v) month.value = ''
})

const handleSubmit = async () => {
  if (!month.value) { ElMessage.warning('请选择要清除的分区月份'); return }
  if (!props.row) return
  submitting.value = true
  try {
    const result = await window.electronAPI.intermediateTable.dropPartition({
      table_name: tableName.value,
      partition_id: month.value
    })
    if (result.success) {
      ElMessage.success(`已清除分区 ${month.value}`)
      emit('updated')
      emit('update:modelValue', false)
    } else {
      ElMessage.error(result.error || '清除分区失败')
    }
  } catch (e: any) {
    ElMessage.error('清除分区失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.dp-dialog-body { padding: 0 4px; }
.info-row { display: flex; align-items: center; margin-bottom: 12px; }
.info-row .label { color: #6b7280; font-size: 14px; }
.info-row .value { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; color: #1f2937; }
</style>
