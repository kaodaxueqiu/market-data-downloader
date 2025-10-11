<template>
  <div class="download-config-panel">
    <div class="panel-header">
      <h3>下载配置</h3>
    </div>

    <div v-if="!source" class="empty-state">
      <el-empty description="请先选择数据源" :image-size="100" />
    </div>

    <div v-else class="config-content">
      <el-scrollbar height="100%" :always="true">
        <div style="padding: 5px">
          <el-form :model="downloadConfig" label-width="100px" label-position="top">
          <!-- 当前选择 -->
          <el-form-item label="数据源">
            <el-tag type="primary" size="large">
              {{ getSourceCode() }}
            </el-tag>
            <div class="source-name">{{ getSourceName() }}</div>
          </el-form-item>

          <!-- 股票/期货代码（仅行情数据且需要代码输入的数据源） -->
          <el-form-item 
            v-if="activeTab === 'market' && needsSymbolInputComputed" 
            label="股票/期货代码"
          >
            <el-input
              v-model="symbolsInput"
              type="textarea"
              :rows="2"
              :placeholder="symbolInputHint"
              @input="handleSymbolsInputWithUpperCase"
              @blur="handleSymbolsInput"
            />
            <div class="input-hint">
              <div style="color: #67c23a">
                💡 {{ symbolInputHint }}
              </div>
              <div style="color: #909399; margin-top: 3px">
                提示：留空查询全部数据，多个代码用逗号分隔
              </div>
              <div v-if="validatedSymbols.length > 0" style="color: #67c23a; margin-top: 5px">
                ✅ 已识别：{{ validatedSymbols.join(', ') }}
              </div>
              <div v-if="symbolsValidated && symbolsInput && validatedSymbols.length === 0" style="color: #f56c6c; margin-top: 5px">
                ❌ 格式错误！请检查输入格式
              </div>
            </div>
          </el-form-item>

          <!-- 日期范围（可选） -->
          <el-form-item label="日期范围（可选）">
            <el-date-picker
              v-model="downloadConfig.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>

          <!-- 时间范围（可选，仅行情数据） -->
          <el-form-item v-if="activeTab === 'market'" label="时间范围（可选）">
            <div style="display: flex; align-items: center; gap: 10px">
              <el-input
                v-model="downloadConfig.startTime"
                placeholder="如: 0930"
                @blur="formatStartTime"
                @keyup.enter="formatStartTime"
                style="flex: 1"
              />
              <span>-</span>
              <el-input
                v-model="downloadConfig.endTime"
                placeholder="如: 1500"
                @blur="formatEndTime"
                @keyup.enter="formatEndTime"
                style="flex: 1"
              />
            </div>
            <div class="input-hint" style="color: #909399">
              输入4位时间，如 0930、1500（留空表示全天）
            </div>
          </el-form-item>

          <!-- 数据格式 -->
          <el-form-item label="数据格式">
            <el-radio-group v-model="downloadConfig.format">
              <el-radio label="csv">CSV</el-radio>
              <el-radio label="json">JSON</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 操作按钮 -->
          <el-form-item>
            <el-button 
              type="primary" 
              size="large"
              @click="handleQuery"
              :loading="querying"
              :disabled="!canDownload"
              style="width: 100%"
            >
              <el-icon><View /></el-icon>
              预览数据
            </el-button>
          </el-form-item>

          <!-- 查询结果 -->
          <el-form-item v-if="queryResults">
            <el-alert type="success" :closable="false">
              <template #title>
                <div style="font-weight: 600; margin-bottom: 8px">查询成功</div>
              </template>
              <div style="line-height: 1.8">
                <div>📊 总键数: {{ queryResults.totalKeys || queryResults.keys?.length || 0 }}</div>
                <div>📝 消息总数: {{ queryResults.total || 0 }}</div>
              </div>
            </el-alert>
            
            <el-button 
              type="success" 
              size="large"
              @click="handleDownload"
              :loading="downloading"
              style="width: 100%; margin-top: 10px"
            >
              <el-icon><Download /></el-icon>
              创建下载任务
            </el-button>
          </el-form-item>
          </el-form>
        </div>
      </el-scrollbar>
    </div>

    <!-- 字段选择对话框 -->
    <el-dialog
      v-model="showFieldSelector"
      title="选择要下载的字段"
      width="80%"
      top="5vh"
    >
      <el-alert type="info" :closable="false" style="margin-bottom: 15px">
        请选择要下载的字段（不选则下载全部字段）
      </el-alert>

      <div class="fields-selector">
        <div class="selector-header">
          <el-input
            v-model="fieldSearchKeyword"
            placeholder="搜索字段..."
            clearable
            style="width: 300px"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <div>
            <el-button-group>
              <el-button @click="selectAllDownloadFields">全选</el-button>
              <el-button @click="clearAllDownloadFields">清空</el-button>
            </el-button-group>
            <el-tag type="info" style="margin-left: 10px">
              已选: {{ selectedDownloadFields.length }} 个字段
            </el-tag>
          </div>
        </div>

        <div class="fields-grid">
          <div class="grid-column">
            <el-table
              ref="downloadTableRef1"
              :data="leftDownloadFields"
              stripe
              height="400"
              @selection-change="handleDownloadLeftSelectionChange"
            >
              <el-table-column type="selection" width="50" :selectable="row => row.enabled" />
              <el-table-column prop="name" label="字段名" width="180">
                <template #default="scope">
                  <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
                  <el-tag v-if="!scope.row.enabled" type="warning" size="small" style="margin-left: 5px">未启用</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="cn_name" label="中文名" />
            </el-table>
          </div>
          <div class="grid-column">
            <el-table
              ref="downloadTableRef2"
              :data="rightDownloadFields"
              stripe
              height="400"
              @selection-change="handleDownloadRightSelectionChange"
            >
              <el-table-column type="selection" width="50" :selectable="row => row.enabled" />
              <el-table-column prop="name" label="字段名" width="180">
                <template #default="scope">
                  <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
                  <el-tag v-if="!scope.row.enabled" type="warning" size="small" style="margin-left: 5px">未启用</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="cn_name" label="中文名" />
            </el-table>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showFieldSelector = false">取消</el-button>
        <el-button type="primary" @click="confirmDownloadFields">
          确认下载（{{ selectedDownloadFields.length || '全部' }}字段）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, View, Search } from '@element-plus/icons-vue'
import { 
  needsSymbolInput, 
  getSymbolInputHint, 
  autoCompleteSymbols,
  getMarketPrefix
} from '../../../config/sourceMarketMapping'

const props = defineProps<{
  source: any
  selectedFields: string[]
  activeTab: 'market' | 'static'
}>()

const emit = defineEmits<{
  download: [params: any]
  preview: [params: any]
}>()

// 代码输入相关
const symbolsInput = ref('')
const validatedSymbols = ref<string[]>([])
const symbolsValidated = ref(false)

// 下载配置
const downloadConfig = ref({
  dateRange: [] as string[],
  startTime: '',
  endTime: '',
  format: 'csv'
})

// 查询结果和状态
const queryResults = ref<any>(null)
const querying = ref(false)
const downloading = ref(false)
const lastQueryParams = ref<any>(null)

// 字段选择对话框
const showFieldSelector = ref(false)
const fieldSearchKeyword = ref('')
const selectedDownloadFields = ref<string[]>([])  // 存储选中的字段name
const allFields = ref<any[]>([])  // 所有可用字段
const downloadTableRef1 = ref()
const downloadTableRef2 = ref()

// 获取数据源代码
const getSourceCode = () => {
  return props.source?.code || props.source?.table_name || ''
}

// 获取数据源名称
const getSourceName = () => {
  return props.source?.name || props.source?.table_comment || ''
}

// 是否需要代码输入
const needsSymbolInputComputed = computed(() => {
  const sourceCode = getSourceCode()
  return needsSymbolInput(sourceCode)
})

// 代码输入提示
const symbolInputHint = computed(() => {
  const sourceCode = getSourceCode()
  return getSymbolInputHint(sourceCode)
})

// 是否可以下载（只要有数据源就可以下载，所有参数都是可选的）
const canDownload = computed(() => {
  return !!props.source
})

// 是否可以预览
const canPreview = computed(() => {
  return props.source && props.selectedFields.length > 0
})

// 过滤后的字段（用于下载选择）- 显示全部字段
const filteredDownloadFields = computed(() => {
  if (!fieldSearchKeyword.value) return allFields.value
  const keyword = fieldSearchKeyword.value.toLowerCase()
  return allFields.value.filter(f => 
    (f.name || '').toLowerCase().includes(keyword) ||
    (f.cn_name || '').toLowerCase().includes(keyword)
  )
})

// 左右分栏字段
const leftDownloadFields = computed(() => {
  const half = Math.ceil(filteredDownloadFields.value.length / 2)
  return filteredDownloadFields.value.slice(0, half)
})

const rightDownloadFields = computed(() => {
  const half = Math.ceil(filteredDownloadFields.value.length / 2)
  return filteredDownloadFields.value.slice(half)
})

// 监听数据源变化，重置配置
watch(() => props.source, () => {
  resetConfig()
})

// 重置配置
const resetConfig = () => {
  symbolsInput.value = ''
  validatedSymbols.value = []
  symbolsValidated.value = false
  queryResults.value = null
  lastQueryParams.value = null
  downloadConfig.value = {
    dateRange: [],
    startTime: '',
    endTime: '',
    format: 'csv'
  }
}

// 处理代码输入时自动转大写
const handleSymbolsInputWithUpperCase = () => {
  symbolsInput.value = symbolsInput.value.toUpperCase()
  symbolsValidated.value = false
}

// 处理代码输入（失焦时验证和自动补全）
const handleSymbolsInput = () => {
  symbolsValidated.value = true
  
  if (!symbolsInput.value.trim()) {
    validatedSymbols.value = []
    return
  }
  
  const sourceCode = getSourceCode()
  validatedSymbols.value = autoCompleteSymbols(symbolsInput.value, sourceCode)
  
  // 更新输入框显示（可选）
  // symbolsInput.value = validatedSymbols.value.join(', ')
}

// 时间格式化函数（完全照抄原来的逻辑）
const formatTime = (timeStr: string): string => {
  if (!timeStr) return ''
  
  // 移除所有非数字字符
  let digits = timeStr.replace(/\D/g, '')
  
  if (digits.length === 0) return ''
  
  // 根据输入长度智能补齐
  if (digits.length === 3) {
    // 如 "930" -> "0930"
    digits = '0' + digits
  } else if (digits.length === 2) {
    // 如 "93" -> "9300"（假设是小时）
    digits = digits + '00'
    if (digits.length === 3) {
      digits = '0' + digits
    }
  } else if (digits.length === 1) {
    // 如 "9" -> "0900"
    digits = '0' + digits + '00'
  } else if (digits.length > 4) {
    // 如果超过4位，取前4位
    digits = digits.substring(0, 4)
  }
  
  // 确保是4位数字
  if (digits.length === 4) {
    // 验证时间的合法性
    const hour = parseInt(digits.substring(0, 2))
    const minute = parseInt(digits.substring(2, 4))
    
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return digits
    }
  }
  
  return timeStr // 如果格式不正确，返回原值
}

// 格式化开始时间
const formatStartTime = () => {
  downloadConfig.value.startTime = formatTime(downloadConfig.value.startTime)
}

// 格式化结束时间
const formatEndTime = () => {
  downloadConfig.value.endTime = formatTime(downloadConfig.value.endTime)
}

// 查询数据（预览）
const handleQuery = async () => {
  console.log('🔍 预览按钮被点击')
  console.log('canDownload:', canDownload.value)
  console.log('source:', props.source)
  
  if (!canDownload.value) {
    ElMessage.warning('请先选择数据源')
    return
  }

  querying.value = true
  queryResults.value = null

  try {
    // 获取API Key
    console.log('开始获取API Key...')
    const keys = await window.electronAPI.config.getApiKeys()
    console.log('API Keys数量:', keys.length)
    const defaultKey = keys.find((k: any) => k.isDefault)
    console.log('默认Key:', defaultKey)
    
    if (!defaultKey) {
      console.error('❌ 未找到默认API Key')
      ElMessage.error('请先在系统设置中配置API Key')
      querying.value = false
      return
    }
    
    console.log('获取完整API Key...')
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id) || ''
    console.log('API Key获取成功:', fullApiKey ? '✅' : '❌')
    if (!fullApiKey) {
      ElMessage.error('无法获取API Key，请检查系统设置')
      querying.value = false
      return
    }

    // 构建查询参数 - 直接使用后端API的字段名
    const queryParams: any = {
      apiKey: String(fullApiKey),
      data_type: 'DECODED',
      message_type: String(getSourceCode())
    }
    
    // 股票代码
    if (validatedSymbols.value.length === 1) {
      queryParams.symbol = validatedSymbols.value[0]
    } else if (validatedSymbols.value.length > 1) {
      queryParams.symbols = validatedSymbols.value
    }
    
    // 日期范围
    if (downloadConfig.value.dateRange.length === 2) {
      queryParams.date_start = downloadConfig.value.dateRange[0].replace(/-/g, '')
      queryParams.date_end = downloadConfig.value.dateRange[1].replace(/-/g, '')
    }
    
    // 时间范围
    if (downloadConfig.value.startTime) {
      queryParams.time_start = downloadConfig.value.startTime
    }
    if (downloadConfig.value.endTime) {
      queryParams.time_end = downloadConfig.value.endTime
    }
    
    queryParams.include_count = true
    queryParams.return_data = true

    // 保存查询参数供导出使用
    lastQueryParams.value = { ...queryParams }

    console.log('执行数据查询...', queryParams)
    const result = await window.electronAPI.download.query(JSON.parse(JSON.stringify(queryParams)))
    
    console.log('查询结果:', result)
    queryResults.value = result
    
    if (result.total > 0) {
      ElMessage.success(`查询成功，共找到 ${result.total} 条数据`)
    } else {
      ElMessage.warning('未找到符合条件的数据')
    }
  } catch (error: any) {
    console.error('查询失败:', error)
    ElMessage.error(error.message || '查询失败')
  } finally {
    querying.value = false
  }
}

// 点击创建下载任务 - 弹出字段选择对话框
const handleDownload = async () => {
  if (!lastQueryParams.value) {
    ElMessage.error('请先预览数据')
    return
  }

  // 加载所有字段
  try {
    const sourceCode = getSourceCode()
    const result = await window.electronAPI.dictionary.getFields(sourceCode, false)
    if (result.code === 200) {
      allFields.value = result.data || []
      // 默认全选已启用的字段
      selectedDownloadFields.value = allFields.value.filter(f => f.enabled).map(f => f.name)
      showFieldSelector.value = true
      
      // 等待对话框打开后同步选择状态
      await nextTick()
      syncDownloadTableSelection()
    } else {
      ElMessage.error('加载字段失败')
    }
  } catch (error) {
    ElMessage.error('加载字段失败')
  }
}

// 同步下载对话框表格选择状态
const syncDownloadTableSelection = () => {
  if (!downloadTableRef1.value || !downloadTableRef2.value) return
  
  downloadTableRef1.value.clearSelection()
  downloadTableRef2.value.clearSelection()
  
  leftDownloadFields.value.forEach((row: any) => {
    if (selectedDownloadFields.value.includes(row.name)) {
      downloadTableRef1.value.toggleRowSelection(row, true)
    }
  })
  
  rightDownloadFields.value.forEach((row: any) => {
    if (selectedDownloadFields.value.includes(row.name)) {
      downloadTableRef2.value.toggleRowSelection(row, true)
    }
  })
}

// 左表格选择变化
const handleDownloadLeftSelectionChange = (selection: any[]) => {
  const leftSelected = selection.map(f => f.name)
  const rightSelected = selectedDownloadFields.value.filter(f => 
    rightDownloadFields.value.some(r => r.name === f)
  )
  selectedDownloadFields.value = [...leftSelected, ...rightSelected]
}

// 右表格选择变化
const handleDownloadRightSelectionChange = (selection: any[]) => {
  const rightSelected = selection.map(f => f.name)
  const leftSelected = selectedDownloadFields.value.filter(f => 
    leftDownloadFields.value.some(l => l.name === f)
  )
  selectedDownloadFields.value = [...leftSelected, ...rightSelected]
}

// 全选字段（只选择已启用的）
const selectAllDownloadFields = () => {
  selectedDownloadFields.value = allFields.value.filter(f => f.enabled).map(f => f.name)
  nextTick(() => syncDownloadTableSelection())
}

// 清空字段
const clearAllDownloadFields = () => {
  selectedDownloadFields.value = []
  if (downloadTableRef1.value) downloadTableRef1.value.clearSelection()
  if (downloadTableRef2.value) downloadTableRef2.value.clearSelection()
}

// 确认下载字段并创建任务
const confirmDownloadFields = async () => {
  // 验证至少选择一个字段
  if (selectedDownloadFields.value.length === 0) {
    ElMessage.warning('请至少选择一个字段')
    return
  }
  
  showFieldSelector.value = false
  downloading.value = true

  try {
    // 获取API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    
    // 构建下载参数 - 按照后端统一的格式
    const downloadParams: any = {
      apiKey: fullApiKey,
      data_type: 'DECODED',
      message_type: lastQueryParams.value.message_type,
      format: downloadConfig.value.format
    }
    
    // 复制查询参数（symbol/symbols, date, time）
    if (lastQueryParams.value.symbol) {
      downloadParams.symbol = String(lastQueryParams.value.symbol)
    }
    if (lastQueryParams.value.symbols) {
      downloadParams.symbols = [...lastQueryParams.value.symbols]
    }
    if (lastQueryParams.value.date_start) {
      downloadParams.date_start = lastQueryParams.value.date_start
    }
    if (lastQueryParams.value.date_end) {
      downloadParams.date_end = lastQueryParams.value.date_end
    }
    if (lastQueryParams.value.time_start) {
      downloadParams.time_start = lastQueryParams.value.time_start
    }
    if (lastQueryParams.value.time_end) {
      downloadParams.time_end = lastQueryParams.value.time_end
    }

    // 添加字段筛选 - 使用中文名
    const enabledFields = allFields.value.filter(f => f.enabled)
    const allEnabledNames = enabledFields.map(f => f.name)
    const isSelectAll = selectedDownloadFields.value.length === allEnabledNames.length
    
    if (isSelectAll) {
      // 全选已启用字段：传递空数组
      downloadParams.fields = []
    } else {
      // 部分字段：传递选中字段的中文名数组
      const selectedCnNames = allFields.value
        .filter(f => selectedDownloadFields.value.includes(f.name))
        .map(f => f.cn_name)
      downloadParams.fields = selectedCnNames
    }

    console.log('创建导出任务，参数:', downloadParams)
    const taskId = await window.electronAPI.download.createTask(downloadParams)
    
    ElMessage.success(`任务创建成功！任务ID: ${taskId}`)
    
    // 通知父组件任务已创建
    emit('download', { success: true, taskId })
  } catch (error: any) {
    console.error('创建导出任务失败:', error)
    ElMessage.error(error.message || '创建导出任务失败')
  } finally {
    downloading.value = false
  }
}
</script>

<style lang="scss" scoped>
.download-config-panel {
  height: 100%;
  display: flex;
  flex-direction: column;

  .panel-header {
    padding: 15px;
    border-bottom: 1px solid #e4e7ed;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .config-content {
    flex: 1;
    overflow: hidden;

    :deep(.el-scrollbar__view) {
      padding: 20px;
    }

    .source-name {
      margin-top: 5px;
      font-size: 12px;
      color: #909399;
    }

    .field-preview {
      margin-top: 8px;
      padding: 8px;
      background: #f5f7fa;
      border-radius: 4px;
    }

    .option-tip {
      margin-left: 10px;
      font-size: 12px;
      color: #909399;
    }

    .input-hint {
      margin-top: 5px;
      font-size: 12px;
      line-height: 1.6;
    }

    :deep(.el-form-item__label) {
      font-weight: 600;
      color: #606266;
    }

    :deep(.el-collapse) {
      border: none;

      .el-collapse-item__header {
        background: #f5f7fa;
        padding: 0 10px;
        border-radius: 4px;
      }

      .el-collapse-item__wrap {
        border-bottom: none;
      }

      .el-collapse-item__content {
        padding: 10px 0;
      }
    }
  }
}

.fields-selector {
  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;

    .grid-column {
      min-width: 0;
    }
  }
}
</style>

