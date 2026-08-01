<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="修改 TTL"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-if="row" class="ttl-dialog-body">
      <div class="current-ttl">
        <span class="label">当前表名：</span>
        <span class="value">{{ row.full_name || row.table_name }}</span>
      </div>
      <div class="current-ttl">
        <span class="label">当前 TTL 策略：</span>
        <el-tag :type="ttlTagType(row.ttl_strategy)" size="small">{{ strategyLabel(row.ttl_strategy) }}</el-tag>
        <span v-if="row.ttl_raw" class="current-raw">（{{ row.ttl_raw }}）</span>
      </div>

      <el-divider />

      <div class="new-ttl-section">
        <div class="section-title">新 TTL 策略</div>
        <el-radio-group v-model="newTtlMode" class="ttl-radio">
          <el-radio value="permanent">永久保留</el-radio>
          <el-radio value="limited">有限时间</el-radio>
        </el-radio-group>

        <div v-if="newTtlMode === 'limited'" class="ttl-input-row">
          <el-input-number v-model="ttlValue" :min="1" :step="1" controls-position="right" style="width: 140px;" />
          <el-select v-model="ttlUnit" style="width: 100px; margin-left: 8px;">
            <el-option label="分 (m)" value="m" />
            <el-option label="时 (h)" value="h" />
            <el-option label="天 (d)" value="d" />
          </el-select>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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

const newTtlMode = ref<'permanent' | 'limited'>('permanent')
const ttlValue = ref(30)
const ttlUnit = ref<'m' | 'h' | 'd'>('d')
const submitting = ref(false)

// 打开时根据当前行初始化
watch(() => props.modelValue, (v) => {
  if (v && props.row) {
    if (props.row.ttl_strategy === 'permanent' || !props.row.ttl_raw) {
      newTtlMode.value = 'permanent'
    } else {
      newTtlMode.value = 'limited'
      // 解析 "30d" / "24h" 等
      const m = props.row.ttl_raw.match(/^(\d+)([smhdw])$/)
      if (m) {
        ttlValue.value = Number(m[1])
        ttlUnit.value = m[2] as 'm' | 'h' | 'd'
      } else {
        ttlValue.value = 30
        ttlUnit.value = 'd'
      }
    }
  }
})

const handleSubmit = async () => {
  if (!props.row) return
  const ttl = newTtlMode.value === 'permanent' ? 'permanent' : `${ttlValue.value}${ttlUnit.value}`
  submitting.value = true
  try {
    const result = await window.electronAPI.intermediateTable.setTtl(props.row.full_name || props.row.table_name, ttl)
    if (result.success) {
      ElMessage.success('TTL 已更新')
      emit('updated')
      emit('update:modelValue', false)
    } else {
      ElMessage.error(result.error || '修改失败')
    }
  } catch (e: any) {
    ElMessage.error('修改失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}

const ttlTagType = (strategy: string): 'primary' | 'success' | 'warning' => {
  if (strategy === 'permanent') return 'primary'
  if (strategy === 'clickhouse_ttl') return 'success'
  if (strategy === 'metadata_driven') return 'warning'
  return 'primary'
}

const strategyLabel = (strategy: string): string => {
  const map: Record<string, string> = {
    permanent: '永久',
    clickhouse_ttl: 'TTL',
    metadata_driven: '元数据驱动'
  }
  return map[strategy] || strategy
}
</script>

<style scoped>
.ttl-dialog-body {
  padding: 0 4px;
}
.current-ttl {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.current-ttl .label {
  color: #6b7280;
  font-size: 14px;
}
.current-ttl .value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #1f2937;
}
.current-raw {
  margin-left: 8px;
  color: #6b7280;
  font-size: 13px;
}
.new-ttl-section {
  margin-top: 8px;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 12px;
}
.ttl-radio {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ttl-input-row {
  display: flex;
  align-items: center;
  margin-top: 12px;
}
</style>
