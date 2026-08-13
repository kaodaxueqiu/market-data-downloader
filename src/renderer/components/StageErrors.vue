<template>
  <div class="stage-errors" v-if="errors?.length">
    <el-alert
      v-for="(err, i) in errors"
      :key="i"
      :type="alertType(err.severity)"
      :title="err.message"
      :closable="false"
      show-icon
      class="stage-error-item"
    >
      <template #default>
        <div class="error-meta">
          <el-tag size="small" type="info">{{ err.stage }}</el-tag>
          <el-tag size="small" type="info">{{ err.code }}</el-tag>
        </div>
        <p v-if="err.suggestion" class="error-suggestion">
          建议：{{ err.suggestion }}
        </p>
        <el-collapse v-if="err.detail" class="error-detail-collapse">
          <el-collapse-item title="技术详情" name="detail">
            <pre class="error-detail">{{ err.detail }}</pre>
          </el-collapse-item>
        </el-collapse>
        <el-descriptions
          v-if="err.context && Object.keys(err.context).length"
          :column="1"
          size="small"
          border
          class="error-context"
        >
          <el-descriptions-item
            v-for="(v, k) in err.context"
            :key="k"
            :label="k"
          >
            <pre class="ctx-val">{{ renderCtx(v) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
defineProps<{ errors: any[] | null }>()

const alertType = (severity: string) => {
  if (severity === 'fatal') return 'error'
  if (severity === 'error') return 'warning'
  return 'info'
}

// context 的 value 类型是任意 JSON（引擎侧 context: Option<serde_json::Value>），
// 可能是嵌套对象/数组。直接插值会显示 [object Object]，非字符串一律 JSON.stringify。
const renderCtx = (v: any): string =>
  v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2)
</script>

<style scoped>
.stage-error-item { margin-bottom: 12px; }
.error-meta { display: flex; gap: 8px; margin-bottom: 8px; }
.error-suggestion { margin: 8px 0; color: #606266; }
.error-detail { font-size: 12px; background: #f5f7fa; padding: 8px; border-radius: 4px; overflow-x: auto; }
.error-context { margin-top: 8px; }
.ctx-val { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
</style>
