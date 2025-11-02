<template>
  <el-dialog
    v-model="visible"
    :title="`实时订阅 - ${sourceCode} ${sourceName}`"
    width="90%"
    top="5vh"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- WebSocket 未连接提示 -->
    <el-alert
      v-if="!wsConnected"
      type="warning"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        <span style="font-weight: 600">⚠️ WebSocket 未连接</span>
      </template>
      创建订阅任务前，请先在右上角"系统状态"面板中连接 WebSocket。
    </el-alert>

    <!-- 说明栏 -->
    <el-alert
      v-else
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        <span style="font-weight: 600">创建实时订阅任务</span>
      </template>
      配置订阅参数后点击"创建任务"，任务将在后台运行。任务状态可在"任务管理"页面查看和管理。
    </el-alert>

    <!-- 订阅配置 -->
    <el-card shadow="never" class="config-card">
      <template #header>
        <span class="card-title">订阅配置</span>
      </template>

      <!-- 股票代码输入 -->
      <div class="form-item">
        <label class="form-label">
          股票/期货代码
          <el-tooltip content="留空订阅全部，输入代码订阅指定标的" placement="top">
            <el-icon><QuestionFilled /></el-icon>
          </el-tooltip>
        </label>
        <el-input
          v-model="symbolsInput"
          type="textarea"
          :rows="3"
          placeholder="输入股票代码，如：000001, 600000（自动补全为 SZ.XXXXXX）&#10;留空表示订阅全部"
          :disabled="creating"
        />
        <div class="hint-text">
          💡 {{ symbolInputHint }}
        </div>
        <div v-if="validatedSymbols.length > 0" class="validated-symbols">
          已识别: 
          <el-tag
            v-for="symbol in validatedSymbols"
            :key="symbol"
            size="small"
            closable
            @close="removeSymbol(symbol)"
            style="margin: 2px"
          >
            {{ symbol }}
          </el-tag>
        </div>
      </div>

      <!-- 字段选择 -->
      <div class="form-item">
        <label class="form-label">字段选择</label>
        <el-button
          size="large"
          style="width: 100%"
          @click="showFieldSelector = true"
          :disabled="creating"
        >
          <el-icon><List /></el-icon>
          选择字段 (已选 {{ selectedFields.length }}/{{ availableFields.length }})
        </el-button>
        
        <!-- 已选字段预览 -->
        <div v-if="selectedFields.length > 0" class="selected-fields-preview">
          <span class="preview-label">已选字段:</span>
          <el-tag
            v-for="field in selectedFields.slice(0, 10)"
            :key="field"
            size="small"
            closable
            @close="removeField(field)"
            style="margin: 2px"
          >
            {{ getFieldLabel(field) }}
          </el-tag>
          <el-tag v-if="selectedFields.length > 10" size="small" type="info">
            +{{ selectedFields.length - 10 }} 个...
          </el-tag>
        </div>
      </div>

      <!-- CSV 保存路径 -->
      <div class="form-item">
        <label class="form-label">CSV 保存文件夹</label>
        <el-input
          v-model="savePath"
          placeholder="点击选择保存文件夹..."
          readonly
          :disabled="creating"
        >
          <template #append>
            <el-button @click="selectSavePath" :disabled="creating">
              <el-icon><FolderOpened /></el-icon>
              选择文件夹
            </el-button>
          </template>
        </el-input>
        <div class="hint-text">
          💡 将创建独立文件夹保存数据，包含订阅信息.txt 和各股票的 CSV 文件
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button
          type="primary"
          size="large"
          @click="createTask"
          :disabled="!canStart || creating"
          :loading="creating"
        >
          <el-icon><VideoPlay /></el-icon>
          {{ creating ? '创建中...' : '创建订阅任务' }}
        </el-button>
        
        <el-button
          size="large"
          @click="visible = false"
        >
          取消
        </el-button>
      </div>
    </el-card>

    <!-- 🆕 字段选择对话框 -->
    <FieldSelectorDialog
      v-model="showFieldSelector"
      :fields="availableFields"
      :selected-fields="selectedFields"
      @confirm="handleFieldsConfirm"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  QuestionFilled,
  FolderOpened,
  VideoPlay,
  List
} from '@element-plus/icons-vue'
import { autoCompleteSymbols, getSymbolInputHint } from '../config/sourceMarketMapping'
import FieldSelectorDialog from './FieldSelectorDialog.vue'

// 调试信息
onMounted(() => {
  console.log('🔍 RealtimeSubscriptionDialog 已挂载')
})

const props = defineProps<{
  modelValue: boolean
  sourceCode: string
  sourceName: string
  fields: any[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 对话框显示状态
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 任务创建状态
const creating = ref(false)
const wsConnected = ref(false)  // WebSocket 连接状态

// 订阅配置
const symbolsInput = ref('')
const validatedSymbols = ref<string[]>([])
const selectedFields = ref<string[]>([])
const savePath = ref('')
const showFieldSelector = ref(false)  // 字段选择对话框

// 可用字段（只显示已启用的字段）
const availableFields = computed(() => {
  return props.fields.filter(f => f.enabled === true)
})

// 股票代码输入提示
const symbolInputHint = computed(() => {
  return getSymbolInputHint(props.sourceCode)
})

// 是否可以创建任务
const canStart = computed(() => {
  return wsConnected.value && selectedFields.value.length > 0 && savePath.value !== ''
})

// 监听股票代码输入，自动补全
watch(symbolsInput, (val) => {
  if (!val.trim()) {
    validatedSymbols.value = []
    return
  }
  
  // 自动补全
  const symbols = autoCompleteSymbols(val, props.sourceCode)
  validatedSymbols.value = symbols
})

// 监听对话框打开，初始化
watch(() => props.modelValue, async (val) => {
  if (val) {
    console.log('📂 打开订阅任务创建对话框')
    
    // 检查 WebSocket 连接状态
    try {
      const wsInfo = await window.electronAPI.subscription.getWebSocketStatus()
      wsConnected.value = wsInfo.status === 'connected'
      console.log('🔍 WebSocket 连接状态:', wsInfo.status)
    } catch (error) {
      wsConnected.value = false
      console.error('获取 WebSocket 状态失败:', error)
    }
    
    // 重置配置
    symbolsInput.value = ''
    validatedSymbols.value = []
    selectedFields.value = []
    creating.value = false
    
    // 默认选中所有已启用字段
    selectedFields.value = availableFields.value.map(f => f.name)
    console.log('✅ 默认选中字段:', selectedFields.value.length, '个')
    
    // 默认保存路径（桌面下的订阅数据文件夹）
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
    const defaultFolderName = `订阅数据_${props.sourceCode}_${timestamp}`
    
    // 🔑 使用 Electron API 获取桌面路径
    try {
      const desktopPath = await window.electronAPI.app.getPath('desktop')
      savePath.value = `${desktopPath}\\${defaultFolderName}`
      console.log('📁 默认保存文件夹:', savePath.value)
    } catch (error) {
      console.error('获取桌面路径失败:', error)
      savePath.value = defaultFolderName  // 降级为相对路径
    }
  }
})

// 移除股票代码
const removeSymbol = (symbol: string) => {
  const input = symbolsInput.value
  symbolsInput.value = input.split(/[,，\s;；\n]+/)
    .filter(s => s.trim() && autoCompleteSymbols(s.trim(), props.sourceCode)[0] !== symbol)
    .join(', ')
}

// 🆕 字段选择确认
const handleFieldsConfirm = (fields: string[]) => {
  selectedFields.value = fields
  console.log('✅ 字段选择已更新:', fields.length, '个字段')
}

// 🆕 移除单个字段
const removeField = (fieldName: string) => {
  selectedFields.value = selectedFields.value.filter(f => f !== fieldName)
}

// 获取字段标签
const getFieldLabel = (fieldName: string) => {
  const field = props.fields.find(f => f.name === fieldName)
  return field?.cn_name || fieldName
}

// 选择保存路径（文件夹）
const selectSavePath = async () => {
  const result = await window.electronAPI.dialog.showOpenDialog({
    title: '选择保存文件夹',
    properties: ['openDirectory', 'createDirectory']
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    // 在选中的文件夹下创建订阅专用文件夹
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
    const folderName = `订阅数据_${props.sourceCode}_${timestamp}`
    const fullPath = `${result.filePaths[0]}\\${folderName}`
    savePath.value = fullPath
    console.log('📁 选择保存路径:', fullPath)
  }
}

// 🆕 创建订阅任务
const createTask = async () => {
  try {
    // 获取API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      ElMessage.error('请先在系统设置中配置API Key')
      return
    }
    
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('无法获取完整的API Key')
      return
    }

    // 构建订阅配置（确保数据可序列化）
    const config = {
      sourceCode: String(props.sourceCode),
      sourceName: String(props.sourceName),
      symbols: validatedSymbols.value.map(s => String(s)),
      fields: selectedFields.value.map(f => String(f)),
      fieldObjects: props.fields.filter(f => selectedFields.value.includes(f.name)).map(f => ({
        name: String(f.name),
        cn_name: String(f.cn_name || '')
      })),  // 🔑 传递字段对象（包含中文名）
      savePath: String(savePath.value)
    }

    console.log('🚀 创建订阅任务，配置:', config)
    creating.value = true

    const result = await window.electronAPI.subscription.createTask(fullApiKey, config)
    
    creating.value = false
    
    ElMessage.success(`订阅任务已创建！任务ID: ${result.taskId}`)
    
    // 询问是否跳转到任务管理
    ElMessageBox.confirm(
      '订阅任务已在后台运行，可在任务管理页面查看实时状态。\n\n是否立即跳转到任务管理？',
      '任务已创建',
      {
        confirmButtonText: '跳转到任务管理',
        cancelButtonText: '继续创建其他任务',
        type: 'success'
      }
    ).then(() => {
      visible.value = false
      // TODO: 跳转到任务管理页面
      window.location.hash = '#/tasks'
    }).catch(async () => {
      // 用户选择继续，重置表单
      symbolsInput.value = ''
      validatedSymbols.value = []
      
      // 更新保存路径时间戳（使用完整路径）
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
      const defaultFolderName = `订阅数据_${props.sourceCode}_${timestamp}`
      
      try {
        const desktopPath = await window.electronAPI.app.getPath('desktop')
        savePath.value = `${desktopPath}\\${defaultFolderName}`
      } catch (error) {
        console.error('获取桌面路径失败:', error)
        savePath.value = defaultFolderName
      }
    })
  } catch (error: any) {
    console.error('❌ 创建任务失败:', error)
    ElMessage.error(error.message || '创建任务失败')
    creating.value = false
  }
}

// 处理关闭
const handleClose = () => {
  visible.value = false
}

// 监听 WebSocket 连接状态变化
window.electronAPI.subscription.onConnected(() => {
  console.log('✅ WebSocket 总线已连接')
  wsConnected.value = true
})

window.electronAPI.subscription.onDisconnected(() => {
  console.log('🔌 WebSocket 总线已断开')
  wsConnected.value = false
})
</script>

<style lang="scss" scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 20px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .label {
      font-size: 14px;
      color: #606266;
    }
  }
}

.config-card {
  margin-bottom: 15px;

  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.data-card {
  margin-bottom: 15px;

  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.form-item {
  margin-bottom: 20px;

  .form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #303133;

    .el-icon {
      color: #909399;
      cursor: help;
    }
  }

  .hint-text {
    margin-top: 5px;
    font-size: 12px;
    color: #909399;
  }

  .validated-symbols {
    margin-top: 10px;
    padding: 10px;
    background: #f0f9ff;
    border-radius: 4px;
    font-size: 12px;
  }

  .selected-fields-preview {
    margin-top: 10px;
    padding: 10px;
    background: #f0f9ff;
    border-radius: 4px;
    font-size: 12px;

    .preview-label {
      font-weight: 500;
      color: #606266;
      margin-right: 8px;
    }
  }
}

.action-buttons {
  margin-top: 20px;

  > div {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .connected-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.symbol-stats {
  margin-bottom: 10px;
  padding: 8px;
  background: #f0f9ff;
  border-radius: 4px;
  font-size: 13px;
}
</style>

