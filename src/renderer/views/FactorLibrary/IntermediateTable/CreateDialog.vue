<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="isRebuild ? '重建中间统计表' : '新建中间统计表'"
    width="780px"
    top="6vh"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form :model="form" label-width="100px" ref="formRef">
      <el-form-item label="创建模式">
        <el-radio-group v-model="form.mode" @change="onModeChange">
          <el-radio value="python">Python 代码</el-radio>
          <el-radio value="ddl">DDL</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- Python 模式 -->
      <template v-if="form.mode === 'python'">
        <el-form-item label="函数代码" required>
          <div ref="pyEditorRef" class="code-editor"></div>
          <div class="form-hint">
            <el-icon><InfoFilled /></el-icon>
            定义 build_intermediate_table 函数（旧名 prepare_data 仍兼容）
          </div>
        </el-form-item>
        <el-form-item label="用户命名">
          <el-input
            v-model="form.table_name"
            placeholder="可选，如 my_zscore；不填则用指纹命名"
          />
          <div class="form-hint">
            <el-icon><InfoFilled /></el-icon>
            最终表名为 factor_workspace.it_&lt;用户命名&gt;
          </div>
        </el-form-item>
      </template>

      <!-- DDL 模式 -->
      <template v-else>
        <el-form-item label="表名" required>
          <el-input
            v-model="form.table_name"
            placeholder="完整表名，如 factor_workspace.it_my_zscore"
          />
        </el-form-item>
        <el-form-item label="DDL 语句" required>
          <div ref="ddlEditorRef" class="code-editor"></div>
        </el-form-item>
      </template>

      <!-- TTL 选择（两种模式共用） -->
      <el-form-item label="TTL 策略">
        <el-radio-group v-model="ttlMode">
          <el-radio value="permanent">永久保留</el-radio>
          <el-radio value="limited">有限时间</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="ttlMode === 'limited'" label="保留时长" required>
        <el-input-number v-model="ttlValue" :min="1" :step="1" controls-position="right" style="width: 140px;" />
        <el-select v-model="ttlUnit" style="width: 100px; margin-left: 8px;">
          <el-option label="分 (m)" value="m" />
          <el-option label="时 (h)" value="h" />
          <el-option label="天 (d)" value="d" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isRebuild ? '重建' : '创建' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { EditorView, basicSetup } from 'codemirror'
import { python as pythonLang } from '@codemirror/lang-python'
import { sql as sqlLang } from '@codemirror/lang-sql'
import type { IntermediateTableCreateRequest, IntermediateTableMeta } from '@/types/backtest'

const props = defineProps<{
  modelValue: boolean
  rebuildRow?: IntermediateTableMeta | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: []
}>()

const isRebuild = computed(() => !!props.rebuildRow)

const form = reactive<IntermediateTableCreateRequest>({
  mode: 'python',
  py_code: '',
  ddl: '',
  table_name: '',
  ttl: 'permanent'
})

const ttlMode = ref<'permanent' | 'limited'>('permanent')
const ttlValue = ref(30)
const ttlUnit = ref<'m' | 'h' | 'd'>('d')
const submitting = ref(false)

// CodeMirror 编辑器
const pyEditorRef = ref<HTMLElement>()
const ddlEditorRef = ref<HTMLElement>()
let pyEditor: EditorView | null = null
let ddlEditor: EditorView | null = null

const initPyEditor = () => {
  if (!pyEditorRef.value || pyEditor) return
  pyEditor = new EditorView({
    doc: form.py_code || '',
    extensions: [
      basicSetup,
      pythonLang(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          form.py_code = update.state.doc.toString()
        }
      })
    ],
    parent: pyEditorRef.value
  })
}

const initDdlEditor = () => {
  if (!ddlEditorRef.value || ddlEditor) return
  ddlEditor = new EditorView({
    doc: form.ddl || '',
    extensions: [
      basicSetup,
      sqlLang(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          form.ddl = update.state.doc.toString()
        }
      })
    ],
    parent: ddlEditorRef.value
  })
}

const destroyEditors = () => {
  pyEditor?.destroy()
  pyEditor = null
  ddlEditor?.destroy()
  ddlEditor = null
}

// 对话框打开时重置或预填
watch(() => props.modelValue, (v) => {
  if (!v) {
    destroyEditors()
    return
  }
  // 基础重置
  form.mode = 'python'
  form.py_code = ''
  form.ddl = ''
  form.table_name = ''
  form.ttl = 'permanent'
  ttlMode.value = 'permanent'
  ttlValue.value = 30
  ttlUnit.value = 'd'

  // 重建模式：根据当前行预填
  if (props.rebuildRow) {
    const row = props.rebuildRow
    // 预填用户命名：从 user_name 取（指纹命名时为 null，留空让用户填）
    if (row.user_name) {
      form.table_name = row.user_name
    } else {
      // 指纹命名时回填完整表名，方便 DDL 模式
      form.table_name = row.table_name
    }
    // 预填 TTL
    if (row.ttl_strategy === 'permanent' || !row.ttl_raw) {
      ttlMode.value = 'permanent'
    } else {
      ttlMode.value = 'limited'
      const m = row.ttl_raw.match(/^(\d+)([smhdw])$/)
      if (m) {
        ttlValue.value = Number(m[1])
        ttlUnit.value = m[2] as 'm' | 'h' | 'd'
      }
    }
  }

  // nextTick 后初始化当前模式的编辑器
  nextTick(() => {
    if (form.mode === 'python') {
      initPyEditor()
    } else {
      initDdlEditor()
    }
  })
})

// 模式切换时初始化对应编辑器
watch(() => form.mode, (mode) => {
  nextTick(() => {
    if (mode === 'python') {
      ddlEditor?.destroy()
      ddlEditor = null
      initPyEditor()
    } else {
      pyEditor?.destroy()
      pyEditor = null
      initDdlEditor()
    }
  })
})

onBeforeUnmount(() => {
  destroyEditors()
})

const onModeChange = () => {
  // 切换模式时清空表名，避免两种模式表名语义混淆
  form.table_name = ''
}

const handleSubmit = async () => {
  // 校验
  if (form.mode === 'python') {
    if (!form.py_code || !form.py_code.trim()) {
      ElMessage.warning('请输入函数代码')
      return
    }
    if (!form.py_code.includes('def build_intermediate_table') && !form.py_code.includes('def prepare_data')) {
      ElMessage.warning('代码需定义 build_intermediate_table（或 prepare_data）函数')
      return
    }
  } else {
    if (!form.table_name || !form.table_name.trim()) {
      ElMessage.warning('请输入完整表名')
      return
    }
    if (!form.ddl || !form.ddl.trim()) {
      ElMessage.warning('请输入 DDL 语句')
      return
    }
  }

  // 组装 ttl
  const ttl = ttlMode.value === 'permanent' ? 'permanent' : `${ttlValue.value}${ttlUnit.value}`

  const payload: IntermediateTableCreateRequest = {
    mode: form.mode,
    ttl
  }
  if (form.mode === 'python') {
    payload.py_code = form.py_code
    if (form.table_name) payload.table_name = form.table_name
  } else {
    payload.ddl = form.ddl
    payload.table_name = form.table_name
  }

  submitting.value = true
  try {
    let result
    if (isRebuild.value && props.rebuildRow) {
      // 重建：调 update，用完整表名
      result = await window.electronAPI.intermediateTable.update(props.rebuildRow.full_name || props.rebuildRow.table_name, payload)
    } else {
      result = await window.electronAPI.intermediateTable.create(payload)
    }
    if (result.success) {
      ElMessage.success(isRebuild.value ? '重建成功' : '创建成功')
      emit('created')
    } else {
      ElMessage.error(result.error || (isRebuild.value ? '重建失败' : '创建失败'))
    }
  } catch (e: any) {
    ElMessage.error((isRebuild.value ? '重建失败' : '创建失败') + ': ' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.code-editor {
  height: 280px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.code-editor :deep(.cm-editor) {
  height: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
</style>
