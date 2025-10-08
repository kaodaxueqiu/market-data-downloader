<template>
  <div class="query-export-container">
    <!-- Tab导航 -->
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="数据查询" name="query">
        <!-- 查询表单 -->
        <el-card class="query-form-card">
          <template #header>
            <span>查询条件</span>
          </template>
          
          <el-form
            ref="formRef"
            :model="queryForm"
            :rules="rules"
            label-width="120px"
            label-position="left"
          >
            <!-- 数据类型选择（放在最前面） -->
            <el-form-item label="数据类型" prop="dataType">
              <div class="data-type-selector">
                <el-radio-group v-model="queryForm.dataType" size="large">
                  <el-radio-button value="DECODED">
                    <div class="radio-content">
                      <span class="radio-title">DECODED</span>
                      <span class="radio-desc">解析数据</span>
                    </div>
                  </el-radio-button>
                  <el-radio-button value="RAW">
                    <div class="radio-content">
                      <span class="radio-title">RAW</span>
                      <span class="radio-desc">原始数据</span>
                    </div>
                  </el-radio-button>
                </el-radio-group>
                <div class="data-type-hint">
                  <span v-if="queryForm.dataType === 'RAW'" style="color: #FF9500; font-weight: 500">
                    ⚠️ RAW数据仅支持查询预览，不支持导出下载
                  </span>
                  <span v-else style="color: #34C759; font-weight: 500">
                    ✅ DECODED数据支持查询预览和导出下载
                  </span>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="消息类型" prop="messageType">
              <el-select
                v-model="queryForm.messageType"
                placeholder="请选择消息类型（支持多选）"
                filterable
                multiple
                style="width: 100%"
              >
                <el-option-group
                  v-for="group in MESSAGE_GROUPS"
                  :key="group.label"
                  :label="group.label"
                >
                  <el-option
                    v-for="item in group.options"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  >
                    <span style="float: left">{{ item.label }}</span>
                    <span style="float: right; color: #8492a6; font-size: 13px">{{ item.value }}</span>
                  </el-option>
                </el-option-group>
              </el-select>
            </el-form-item>

            <el-form-item label="股票/期货代码">
              <el-input
                v-model="symbolsInput"
                type="textarea"
                :rows="2"
                placeholder="必须输入完整格式，如：SZ.000001, SH.600000, SHFE.CU2401（多个用逗号分隔）"
                @input="handleSymbolsInputWithUpperCase"
                @blur="handleSymbolsInput"
              />
              <div style="color: #909399; font-size: 12px; margin-top: 5px">
                <div style="color: #f56c6c">⚠️ 必须输入完整格式：市场前缀.代码（如 SZ.000001, SH.600000）</div>
                <div style="margin-top: 3px">
                  <strong>股票市场：</strong>SH.上海 | SZ.深圳
                </div>
                <div style="margin-top: 3px">
                  <strong>期货市场：</strong>CFFEX.中金所 | SHFE.上期所 | CZCE.郑商所 | DCE.大商所 | GFEX.广期所 | INE.上海能源
                </div>
                <div style="margin-top: 3px; color: #67c23a">
                  提示：留空查询全部数据
                </div>
                <div v-if="queryForm.symbols && queryForm.symbols.length > 0" style="color: #67c23a; margin-top: 5px">
                  ✅ 已识别：{{ queryForm.symbols.join(', ') }}
                </div>
                <div v-if="symbolsValidated && symbolsInput && queryForm.symbols && queryForm.symbols.length === 0" style="color: #f56c6c; margin-top: 5px">
                  ❌ 格式错误！请输入完整格式，如：SZ.000001, SHFE.CU2401
                </div>
              </div>
            </el-form-item>

            <el-form-item label="日期范围" prop="dateRange">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                format="YYYYMMDD"
                value-format="YYYYMMDD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :disabled-date="disabledDate"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="时间范围">
              <el-col :span="11">
                <el-input
                  v-model="queryForm.startTime"
                  placeholder="如: 0930"
                  @blur="formatStartTime"
                  @keyup.enter="formatStartTime"
                  style="width: 100%"
                />
              </el-col>
              <el-col :span="2" style="text-align: center">-</el-col>
              <el-col :span="11">
                <el-input
                  v-model="queryForm.endTime"
                  placeholder="如: 1500"
                  @blur="formatEndTime"
                  @keyup.enter="formatEndTime"
                  style="width: 100%"
                />
              </el-col>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleQuery" :loading="querying">
                查询数据
              </el-button>
              <el-button @click="resetForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 查询结果 -->
        <el-card v-if="queryResults" class="results-card">
          <template #header>
            <div class="results-header">
              <span>查询结果</span>
              <div>
                <el-tag v-if="queryResults.keys" type="info">
                  总键数: {{ queryResults.totalKeys || queryResults.keys.length }}
                </el-tag>
                <el-tag type="success" style="margin-left: 5px">
                  消息总数: {{ queryResults.total || 0 }}
                </el-tag>
                <el-button
                  type="success"
                  size="small"
                  @click="handleExportClick"
                  :disabled="!queryResults.total || queryForm.dataType === 'RAW'"
                  style="margin-left: 10px"
                >
                  {{ queryForm.dataType === 'RAW' ? 'RAW数据不支持导出' : '导出全部数据' }}
                </el-button>
              </div>
            </div>
          </template>

          <!-- 根据数据类型显示不同内容 -->
          <div v-if="queryForm.dataType === 'RAW'">
            <!-- RAW数据：显示所有keys列表 -->
            <el-table
              :data="queryResults.keys || []"
              style="width: 100%"
              max-height="600"
              v-loading="querying"
            >
              <el-table-column type="index" label="序号" width="60" />
              <el-table-column label="数据键" min-width="400">
                <template #default="scope">
                  <span style="font-family: monospace; font-size: 12px">
                    {{ scope.row }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="100">
                <template #default>
                  <el-tag size="small">RAW</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top: 10px; color: #f56c6c; font-size: 14px">
              <el-icon><InfoFilled /></el-icon>
              RAW数据为原始二进制格式，不支持预览内容和导出功能
            </div>
          </div>
          
          <div v-else-if="queryForm.dataType === 'DECODED'">
            <!-- DECODED数据：显示信息 -->
            <div style="padding: 20px">
              <!-- 查询统计信息 -->
              <el-row :gutter="20" style="margin-bottom: 20px">
                <el-col :span="8">
                  <el-card shadow="hover">
                    <el-statistic title="总键数" :value="queryResults.keys ? queryResults.keys.length : 0" />
                  </el-card>
                </el-col>
                <el-col :span="8">
                  <el-card shadow="hover">
                    <el-statistic title="消息总数" :value="queryResults.total || 0" />
                  </el-card>
                </el-col>
                <el-col :span="8">
                  <el-card shadow="hover">
                    <el-statistic title="数据预览" value="1条示例" />
                  </el-card>
                </el-col>
              </el-row>
              
              <!-- 示例数据预览 -->
              <el-alert 
                title="数据预览（仅展示第一条数据作为示例）" 
                type="info" 
                :closable="false"
                style="margin-bottom: 10px"
              />
              
              <!-- JSON原样显示 -->
              <div v-if="queryResults.preview && queryResults.preview.length > 0" 
                   class="json-preview"
                   v-loading="querying">
                <pre style="
                  background-color: #f5f7fa; 
                  padding: 15px; 
                  border-radius: 4px; 
                  overflow: auto; 
                  max-height: 400px;
                  font-size: 13px;
                  line-height: 1.5;
                  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                ">{{ JSON.stringify(queryResults.preview[0], null, 2) }}</pre>
              </div>
              
              <!-- 提示信息 -->
              <el-alert 
                :title="`查询成功！共找到 ${queryResults.total || 0} 条数据，请点击'导出全部数据'获取完整数据集`"
                type="success" 
                show-icon
                :closable="false"
                style="margin-top: 20px"
              />
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="导出任务" name="tasks">
        <TaskList 
          ref="taskListRef"
          @refresh="refreshTasks"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 导出对话框 -->
    <el-dialog
      v-model="showExportDialog"
      title="创建导出任务"
      width="400px"
    >
      <el-form label-width="100px">
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportOptions.format">
            <el-radio-button value="csv">CSV</el-radio-button>
            <el-radio-button value="json">JSON</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-text type="info">任务完成后，您可以在任务列表中下载文件</el-text>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :loading="exporting">
          创建任务
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElCol, FormInstance, FormRules } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import TaskList from '../components/TaskList.vue'
import { MESSAGE_TYPE_LIST } from '../api/constants'

// 消息类型分组
const MESSAGE_GROUPS = [
  {
    label: '深圳市场',
    options: MESSAGE_TYPE_LIST.filter(t => t.market === 'SZ')
  },
  {
    label: '上海市场',
    options: MESSAGE_TYPE_LIST.filter(t => t.market === 'SH')
  },
  {
    label: '期货市场',
    options: MESSAGE_TYPE_LIST.filter(t => t.market === 'FUTURES')
  },
  {
    label: '期权市场',
    options: MESSAGE_TYPE_LIST.filter(t => t.market === 'OPTIONS')
  },
  {
    label: '陆港通市场',
    options: MESSAGE_TYPE_LIST.filter(t => t.market === 'HK')
  }
]

const activeTab = ref('query')
const formRef = ref<FormInstance>()
const taskListRef = ref<any>()
const querying = ref(false)
const exporting = ref(false)
const showExportDialog = ref(false)
const queryResults = ref<any>(null)
const symbolsInput = ref('')  // 股票代码输入
const symbolsValidated = ref(false)  // 是否已经验证过股票代码

// 查询表单
const queryForm = reactive({
  dataType: 'DECODED',  // 默认使用DECODED
  messageType: [] as string[],  // 支持多选
  symbols: [] as string[],
  dateRange: [] as string[],
  startTime: '',
  endTime: ''
})

// 导出选项
const exportOptions = reactive({
  format: 'csv',
  savePath: ''
})

// 保存查询参数（用于导出）
const lastQueryParams = ref<any>(null)

const rules: FormRules = {
  messageType: [
    { 
      required: true, 
      message: '请至少选择一个消息类型', 
      trigger: 'change',
      type: 'array',
      min: 1
    }
  ]
}

// 禁用未来日期
const disabledDate = (date: Date) => {
  return date.getTime() > Date.now()
}

// 格式化时间输入（支持多种格式输入）
const formatTime = (timeStr: string): string => {
  if (!timeStr) return ''
  
  // 移除所有非数字字符
  let digits = timeStr.replace(/\D/g, '')
  
  // 处理不同长度的输入
  if (digits.length === 3) {
    // 如 "930" -> "0930"
    digits = '0' + digits
  } else if (digits.length === 2) {
    // 如 "93" -> "0930"（假设是小时）
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
  queryForm.startTime = formatTime(queryForm.startTime)
}

// 格式化结束时间
const formatEndTime = () => {
  queryForm.endTime = formatTime(queryForm.endTime)
}

// 处理股票代码输入时自动转大写（不进行验证）
const handleSymbolsInputWithUpperCase = () => {
  // 仅自动转换为大写，不进行验证
  symbolsInput.value = symbolsInput.value.toUpperCase()
  // 重置验证状态，避免输入过程中显示错误
  symbolsValidated.value = false
  // 验证会在失去焦点(blur)时进行
}

// 处理股票代码输入
const handleSymbolsInput = () => {
  // 标记已经进行过验证
  symbolsValidated.value = true
  
  if (!symbolsInput.value.trim()) {
    queryForm.symbols = []
    return
  }
  
  // 分割输入的股票代码（支持逗号、空格、分号、换行）
  const inputCodes = symbolsInput.value
    .split(/[,，\s;；\n]+/)
    .filter(code => code.trim())
  
  const validCodes: string[] = []
  const invalidCodes: string[] = []
  
  inputCodes.forEach(code => {
    const c = code.trim()  // 已经在输入时转为大写了
    
    // 必须包含点且格式为 XX.XXXXXX
    if (!c.includes('.')) {
      invalidCodes.push(code)
      return
    }
    
    const parts = c.split('.')
    if (parts.length !== 2) {
      invalidCodes.push(code)
      return
    }
    
    const [market, stockCode] = parts
    
    // 验证市场前缀（支持股票和期货市场）
    const validMarkets = ['SZ', 'SH', 'CFFEX', 'SHFE', 'CZCE', 'DCE', 'GFEX', 'INE']
    if (!validMarkets.includes(market)) {
      invalidCodes.push(code)
      return
    }
    
    // 对于股票市场（SZ/SH），代码必须是数字且补齐到6位
    if (market === 'SZ' || market === 'SH') {
      if (!/^\d+$/.test(stockCode)) {
        invalidCodes.push(code)
        return
      }
      // 补齐股票代码到6位
      const paddedCode = stockCode.padStart(6, '0')
      validCodes.push(`${market}.${paddedCode}`)
    } else {
      // 期货市场代码直接使用原始输入（支持字母数字组合）
      validCodes.push(`${market}.${stockCode}`)
    }
  })
  
  // 如果有无效的代码，显示错误提示
  if (invalidCodes.length > 0) {
    ElMessage.error(`格式错误的代码：${invalidCodes.join(', ')}。请使用格式：SZ.000001, SH.600000 或 SHFE.CU2401`)
  }
  
  // 去重
  queryForm.symbols = [...new Set(validCodes)]
  
  // 不要修改用户的输入，让用户看到哪些格式是错误的
  // symbolsInput.value = queryForm.symbols.join(', ')
}

// 查询数据（预览）
const handleQuery = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    querying.value = true
    queryResults.value = null
    
    try {
      // 自动获取默认（唯一）的API Key
      let fullApiKey = ''
      const keys = await window.electronAPI.config.getApiKeys()
      const defaultKey = keys.find((k: any) => k.isDefault)
      
      if (!defaultKey) {
        ElMessage.error('请先在系统设置中配置API Key')
        querying.value = false
        return
      }
      
      fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id) || ''
      if (!fullApiKey) {
        ElMessage.error('无法获取API Key，请检查系统设置')
        querying.value = false
        return
      }

      // 构建查询参数（仿照demo的方式）
      const queryParams = {
        apiKey: String(fullApiKey),
        dataType: String(queryForm.dataType),  // 数据类型：DECODED或RAW
        messageType: queryForm.messageType && queryForm.messageType.length > 0 ? String(queryForm.messageType[0]) : '',  // 兼容单个
        messageTypes: queryForm.messageType && queryForm.messageType.length > 0 ? [...queryForm.messageType] : undefined, // 传递所有选中的类型
        symbols: queryForm.symbols && queryForm.symbols.length > 0 ? [...queryForm.symbols] : undefined,
        startDate: queryForm.dateRange && queryForm.dateRange.length > 0 ? String(queryForm.dateRange[0]) : undefined,
        endDate: queryForm.dateRange && queryForm.dateRange.length > 1 ? String(queryForm.dateRange[1]) : undefined,
        startTime: queryForm.startTime ? String(queryForm.startTime) : undefined,
        endTime: queryForm.endTime ? String(queryForm.endTime) : undefined
      }

      // 保存查询参数供导出使用
      lastQueryParams.value = { ...queryParams }

      // 调用查询API
      console.log('执行数据查询...', queryParams)
      const result = await window.electronAPI.download.query(JSON.parse(JSON.stringify(queryParams)))
      
      console.log('查询结果:', result)
      queryResults.value = result
      
      ElMessage.success(`查询成功，共 ${result.total} 条记录`)
    } catch (error: any) {
      console.error('查询失败:', error)
      ElMessage.error(error.message || '查询失败')
    } finally {
      querying.value = false
    }
  })
}

// 导出数据
// 处理导出按钮点击
const handleExportClick = async () => {
  if (queryForm.dataType === 'RAW') {
    ElMessage.warning('RAW数据不支持导出，请切换到DECODED数据类型')
    return
  }
  
  // 如果保存路径为空，尝试加载默认路径
  if (!exportOptions.savePath) {
    try {
      const config = await window.electronAPI.config.get('appConfig')
      if (config?.downloadDir) {
        exportOptions.savePath = config.downloadDir
      }
    } catch (error) {
      console.error('加载默认下载路径失败:', error)
    }
  }
  
  showExportDialog.value = true
}

// 处理导出
const handleExport = async () => {
  if (!lastQueryParams.value) {
    ElMessage.error('请先查询数据')
    return
  }

  exporting.value = true
  showExportDialog.value = false

  try {
    // 创建导出任务（不需要本地路径，等下载时再选择）
    const params = JSON.parse(JSON.stringify({
      ...lastQueryParams.value,
      format: String(exportOptions.format)
      // 不传savePath，后端处理完成后用户点击下载时再选择
    }))

    console.log('创建导出任务...')
    await window.electronAPI.download.createTask(params)
    
    ElMessage.success('导出任务已创建')
    
    // 切换到任务列表
    activeTab.value = 'tasks'
    
    // 刷新任务列表
    await nextTick()
    if (taskListRef.value) {
      taskListRef.value.refresh()
    }
  } catch (error: any) {
    console.error('创建导出任务失败:', error)
    ElMessage.error(error.message || '创建导出任务失败')
  } finally {
    exporting.value = false
  }
}

// 重置表单
const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  queryResults.value = null
  lastQueryParams.value = null
}

// 刷新任务列表
const refreshTasks = () => {
  if (taskListRef.value) {
    taskListRef.value.refresh()
  }
}

onMounted(async () => {
  
  // 设置默认日期为今天
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  queryForm.dateRange = [today, today]
  
  // 设置默认时间范围（9:30 - 15:00）
  queryForm.startTime = '0930'
  queryForm.endTime = '1500'
  
  // 加载默认下载路径
  try {
    const config = await window.electronAPI.config.get('appConfig')
    if (config?.downloadDir) {
      exportOptions.savePath = config.downloadDir
    }
  } catch (error) {
    console.error('加载默认下载路径失败:', error)
  }
})
</script>

<style scoped>
.query-export-container {
  padding: 20px;
}

.main-tabs {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.query-form-card {
  margin-bottom: 20px;
}

.results-card {
  margin-top: 20px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-dialog__body) {
  padding: 20px 30px;
}

/* 数据类型选择器美化 */
.data-type-selector {
  :deep(.el-radio-group) {
    display: flex;
    gap: 60px;
  }
  
  :deep(.el-radio-button) {
    flex: 1;
    border: none;
    margin: 0 !important;
    
    &:first-child {
      margin-right: 0 !important;
      
      .el-radio-button__inner {
        border-radius: 12px !important;
        border-right: 1.5px solid #e4e7ed !important;
      }
    }
    
    &:last-child {
      margin-left: 0 !important;
      
      .el-radio-button__inner {
        border-radius: 12px !important;
        border-left: 1.5px solid #e4e7ed !important;
      }
    }
    
    .el-radio-button__inner {
      width: 100%;
      min-width: 160px;
      border-radius: 12px !important;
      padding: 8px 20px;
      border: 1.5px solid #e4e7ed !important;
      background: #ffffff;
      transition: all 0.3s;
      box-shadow: none;
      
      &:hover {
        border-color: #409EFF;
        background: #f6f9ff;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
    }
    
    &.is-active .el-radio-button__inner {
      background: #409EFF;
      border-color: #409EFF;
      box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
      color: white;
    }
  }
  
  .radio-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    
    .radio-title {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .radio-desc {
      font-size: 11px;
      opacity: 0.7;
    }
  }
  
  .data-type-hint {
    margin-top: 16px;
    font-size: 13px;
    padding: 10px 16px;
    background: #f5f7fa;
    border-radius: 10px;
    
    span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

</style>
