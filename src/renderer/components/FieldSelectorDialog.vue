<template>
  <el-dialog
    v-model="visible"
    title="字段选择"
    width="800px"
    :close-on-click-modal="false"
  >
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索字段名称..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div class="toolbar-actions">
        <el-button size="small" @click="selectAll">
          <el-icon><Select /></el-icon>
          全选
        </el-button>
        <el-button size="small" @click="clearAll">
          <el-icon><Close /></el-icon>
          清空
        </el-button>
        <el-button size="small" @click="invertSelection">
          <el-icon><RefreshLeft /></el-icon>
          反选
        </el-button>
      </div>
    </div>

    <!-- 快捷选择 -->
    <div class="quick-select">
      <span class="label">快捷选择:</span>
      <el-button size="small" type="primary" plain @click="selectPriceFields">
        价格字段
      </el-button>
      <el-button size="small" type="success" plain @click="selectVolumeFields">
        成交字段
      </el-button>
      <el-button size="small" type="warning" plain @click="selectTimeFields">
        时间字段
      </el-button>
      <el-button size="small" type="info" plain @click="selectBasicFields">
        基础字段
      </el-button>
    </div>

    <!-- 字段列表 -->
    <el-checkbox-group v-model="selectedFieldsLocal">
      <div class="fields-container">
        <div
          v-for="field in filteredFields"
          :key="field.name"
          class="field-item"
        >
          <el-checkbox :label="field.name">
            <div class="field-content">
              <span class="field-name">{{ field.name }}</span>
              <span class="field-cn-name">{{ field.cn_name || '无中文名' }}</span>
            </div>
          </el-checkbox>
        </div>

        <el-empty v-if="filteredFields.length === 0" description="未找到匹配的字段" :image-size="80" />
      </div>
    </el-checkbox-group>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="footer-content">
        <span class="selected-count">
          已选择: <el-tag type="success" size="small">{{ selectedFieldsLocal.length }}</el-tag> / {{ fields.length }}
        </span>
        <div>
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" @click="handleConfirm">
            确定 ({{ selectedFieldsLocal.length }} 个字段)
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, Select, Close, RefreshLeft } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  fields: any[]
  selectedFields: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [fields: string[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 本地字段选择状态
const selectedFieldsLocal = ref<string[]>([])
const searchKeyword = ref('')

// 监听外部选择变化
watch(() => props.selectedFields, (newFields) => {
  selectedFieldsLocal.value = [...newFields]
}, { immediate: true })

// 监听对话框打开
watch(() => props.modelValue, (val) => {
  if (val) {
    // 对话框打开时，同步当前选择
    selectedFieldsLocal.value = [...props.selectedFields]
    searchKeyword.value = ''
  }
})

// 过滤后的字段
const filteredFields = computed(() => {
  if (!searchKeyword.value) {
    return props.fields
  }
  
  const keyword = searchKeyword.value.toLowerCase()
  return props.fields.filter(f => 
    (f.name || '').toLowerCase().includes(keyword) ||
    (f.cn_name || '').toLowerCase().includes(keyword)
  )
})

// 全选
const selectAll = () => {
  selectedFieldsLocal.value = filteredFields.value.map(f => f.name)
}

// 清空
const clearAll = () => {
  selectedFieldsLocal.value = []
}

// 反选
const invertSelection = () => {
  const currentSet = new Set(selectedFieldsLocal.value)
  selectedFieldsLocal.value = filteredFields.value
    .filter(f => !currentSet.has(f.name))
    .map(f => f.name)
}

// 快捷选择：价格字段
const selectPriceFields = () => {
  const priceKeywords = ['price', '价', '价格', 'px']
  const priceFields = props.fields.filter(f => 
    priceKeywords.some(keyword => 
      (f.name || '').toLowerCase().includes(keyword) ||
      (f.cn_name || '').includes(keyword)
    )
  ).map(f => f.name)
  
  // 合并到现有选择
  selectedFieldsLocal.value = [...new Set([...selectedFieldsLocal.value, ...priceFields])]
}

// 快捷选择：成交字段
const selectVolumeFields = () => {
  const volumeKeywords = ['volume', 'turnover', '成交', '量', '额', 'qty', 'amount']
  const volumeFields = props.fields.filter(f => 
    volumeKeywords.some(keyword => 
      (f.name || '').toLowerCase().includes(keyword) ||
      (f.cn_name || '').includes(keyword)
    )
  ).map(f => f.name)
  
  selectedFieldsLocal.value = [...new Set([...selectedFieldsLocal.value, ...volumeFields])]
}

// 快捷选择：时间字段
const selectTimeFields = () => {
  const timeKeywords = ['time', 'date', '时间', '日期']
  const timeFields = props.fields.filter(f => 
    timeKeywords.some(keyword => 
      (f.name || '').toLowerCase().includes(keyword) ||
      (f.cn_name || '').includes(keyword)
    )
  ).map(f => f.name)
  
  selectedFieldsLocal.value = [...new Set([...selectedFieldsLocal.value, ...timeFields])]
}

// 快捷选择：基础字段
const selectBasicFields = () => {
  const basicKeywords = ['symbol', 'code', 'security', '代码', '证券', 'stock']
  const basicFields = props.fields.filter(f => 
    basicKeywords.some(keyword => 
      (f.name || '').toLowerCase().includes(keyword) ||
      (f.cn_name || '').includes(keyword)
    )
  ).map(f => f.name)
  
  selectedFieldsLocal.value = [...new Set([...selectedFieldsLocal.value, ...basicFields])]
}

// 确定
const handleConfirm = () => {
  emit('confirm', selectedFieldsLocal.value)
  visible.value = false
}

// 取消
const handleCancel = () => {
  // 恢复原始选择
  selectedFieldsLocal.value = [...props.selectedFields]
  visible.value = false
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }
}

.quick-select {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;

  .label {
    font-size: 14px;
    color: #606266;
    font-weight: 500;
  }
}

.fields-container {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;

  .field-item {
    margin-bottom: 12px;
    padding: 8px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    .field-content {
      display: flex;
      align-items: center;
      gap: 10px;

      .field-name {
        font-family: 'Consolas', monospace;
        font-size: 13px;
        color: #303133;
        font-weight: 500;
        min-width: 150px;
      }

      .field-cn-name {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .selected-count {
    font-size: 14px;
    color: #606266;
  }
}
</style>

