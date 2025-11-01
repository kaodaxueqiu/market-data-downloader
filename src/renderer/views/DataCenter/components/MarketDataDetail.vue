<template>
  <div class="market-data-detail">
    <div v-if="!source" class="empty-state">
      <el-empty description="请从左侧选择数据源" :image-size="120" />
    </div>

    <div v-else class="detail-content">
      <!-- 概要信息卡片 -->
      <div class="summary-card">
        <div class="card-header">
          <h3>{{ source.name }}</h3>
          <el-tag type="primary">{{ source.code }}</el-tag>
        </div>

        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="市场">{{ source.market }}</el-descriptions-item>
          <el-descriptions-item label="交易所">{{ source.exchange && source.exchange.trim() ? source.exchange : '-' }}</el-descriptions-item>
          <el-descriptions-item label="更新频率">{{ source.update_frequency || '实时' }}</el-descriptions-item>
          <el-descriptions-item label="字段数量">
            <el-tag type="success" size="small">{{ fields.length }} 个</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="quick-actions">
          <div class="action-item">
            <el-button type="primary" size="large" @click="showDetailDialog" style="width: 100%">
              <el-icon><View /></el-icon>
              查看字段详情
            </el-button>
            <div class="action-desc">查看字段列表、数据格式和解析代码</div>
          </div>

          <div class="action-item">
            <el-button type="success" size="large" @click="previewData" style="width: 100%">
              <el-icon><View /></el-icon>
              数据预览
            </el-button>
            <div class="action-desc">预览实时数据（最新10条消息）</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 完整详情对话框 -->
    <el-dialog
      v-model="showFullDetail"
      :title="`${source?.name || ''} - 数据源详情`"
      width="95%"
      top="3vh"
      destroy-on-close
      class="detail-dialog"
    >
      <el-tabs v-model="activeTab">
        <!-- 字段展示 -->
        <el-tab-pane label="字段展示" name="fields">
          <div class="fields-panel">
            <div style="margin-bottom: 10px;">
              <el-alert type="info" :closable="false">
                共 {{ fields.length }} 个字段，其中 {{ enabledFieldsCount }} 个已启用，{{ disabledFieldsCount }} 个未启用
              </el-alert>
            </div>

            <div class="fields-grid">
              <div class="grid-column">
                <el-table
                  :data="leftFields"
                  stripe
                  v-loading="fieldsLoading"
                  :row-class-name="tableRowClassName"
                >
                  <el-table-column type="index" label="序号" width="60" :index="indexMethod1" />
                  <el-table-column prop="name" label="字段名" width="220">
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
                  :data="rightFields"
                  stripe
                  v-loading="fieldsLoading"
                  :row-class-name="tableRowClassName"
                >
                  <el-table-column type="index" label="序号" width="60" :index="indexMethod2" />
                  <el-table-column prop="name" label="字段名" width="220">
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
        </el-tab-pane>

        <!-- JSON格式 -->
        <el-tab-pane label="JSON格式" name="decoded">
          <div v-if="decodedFormat" v-loading="formatLoading" class="format-panel">
            <el-scrollbar height="100%">
              <div class="format-content">
                <el-descriptions :column="2" border class="mb-20">
                  <el-descriptions-item label="格式">{{ decodedFormat.format }}</el-descriptions-item>
                  <el-descriptions-item label="编码">{{ decodedFormat.encoding }}</el-descriptions-item>
                  <el-descriptions-item label="Key模式" :span="2">
                    <el-text type="info" style="font-family: monospace">
                      {{ decodedFormat.key_pattern }}
                    </el-text>
                  </el-descriptions-item>
                </el-descriptions>

                <div style="margin-bottom: 10px;">
                  <el-alert type="info" :closable="false">
                    共 {{ fields.length }} 个字段，其中 {{ enabledFieldsCount }} 个已启用（已解析），{{ disabledFieldsCount }} 个未启用（未解析）
                  </el-alert>
                </div>
            <h4>字段说明</h4>
            <el-table :data="fields" stripe :row-class-name="tableRowClassName">
              <el-table-column type="index" label="序号" width="60" />
              <el-table-column prop="name" label="字段名" width="180">
                <template #default="scope">
                  <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
                  <el-tag v-if="!scope.row.enabled" type="warning" size="small" style="margin-left: 5px">未启用</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="cn_name" label="中文名" width="120" />
              <el-table-column prop="type" label="类型" width="100">
                <template #default="scope">
                  <el-tag size="small">{{ scope.row.type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
              <el-table-column prop="example" label="示例" width="120">
                <template #default="scope">
                  <el-text type="info" size="small">{{ scope.row.example }}</el-text>
                </template>
              </el-table-column>
            </el-table>

                <div v-if="decodedFormat.example" style="margin-top: 20px">
                  <h4>JSON示例</h4>
                  <pre class="json-example">{{ JSON.stringify(decodedFormat.example, null, 2) }}</pre>
                </div>
              </div>
            </el-scrollbar>
          </div>
          <el-button v-else @click="loadDecodedFormat" type="primary" v-loading="formatLoading">
            加载格式文档
          </el-button>
        </el-tab-pane>

        <!-- 二进制格式 -->
        <el-tab-pane label="二进制格式" name="raw">
          <div v-if="rawFormat" v-loading="formatLoading" class="format-panel">
            <el-scrollbar height="100%">
              <div class="format-content">
                <el-descriptions :column="2" border class="mb-20">
              <el-descriptions-item label="总大小">{{ rawFormat.total_size }} bytes</el-descriptions-item>
              <el-descriptions-item label="字节序">{{ rawFormat.byte_order }}</el-descriptions-item>
              <el-descriptions-item label="消息头">{{ rawFormat.header_size }} bytes</el-descriptions-item>
              <el-descriptions-item label="Key模式" v-if="rawFormat.key_pattern">
                <el-text type="info" style="font-family: monospace">
                  {{ rawFormat.key_pattern }}
                </el-text>
              </el-descriptions-item>
            </el-descriptions>

            <div style="margin-bottom: 10px;">
              <el-alert type="info" :closable="false">
                共 {{ fields.length }} 个字段，其中 {{ enabledFieldsCount }} 个已启用（已解析），{{ disabledFieldsCount }} 个未启用（未解析）
              </el-alert>
            </div>
            <h4>字段说明</h4>
            <el-table :data="fields" stripe :row-class-name="tableRowClassName">
              <el-table-column type="index" label="序号" width="60" />
              <el-table-column prop="name" label="字段名" width="180">
                <template #default="scope">
                  <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
                  <el-tag v-if="!scope.row.enabled" type="warning" size="small" style="margin-left: 5px">未启用</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="cn_name" label="中文名" width="120" />
              <el-table-column prop="type" label="类型" width="100">
                <template #default="scope">
                  <el-tag size="small">{{ scope.row.type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="offset" label="偏移" width="80" />
              <el-table-column prop="size" label="大小" width="80" />
              <el-table-column prop="description" label="说明" />
            </el-table>
              </div>
            </el-scrollbar>
          </div>
          <el-button v-else @click="loadRawFormat" type="primary" v-loading="formatLoading">
            加载格式文档
          </el-button>
        </el-tab-pane>

        <!-- 解析代码 -->
        <el-tab-pane label="解析代码" name="code">
          <div class="code-panel">
            <div class="code-header">
              <div>
                <el-select v-model="codeLanguage" @change="loadParserCode">
                  <el-option label="Python" value="python" />
                  <el-option label="Go" value="go" />
                  <el-option label="C++" value="cpp" />
                  <el-option label="Java" value="java" />
                </el-select>
              </div>
              <div>
                <el-button type="primary" @click="copyCode">
                  <el-icon><CopyDocument /></el-icon>
                  复制代码
                </el-button>
              </div>
            </div>
            <pre v-if="parserCode" v-loading="codeLoading" class="code-block">{{ parserCode }}</pre>
            <el-button v-else @click="loadParserCode" type="primary" v-loading="codeLoading">
              生成代码
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 数据预览对话框 -->
    <el-dialog
      v-model="showPreviewDialog"
      :title="`数据预览 - ${source?.name || source?.code || ''}`"
      width="90%"
      top="5vh"
      destroy-on-close
    >
      <div v-loading="previewLoading">
        <div v-if="previewData_result">
          <el-alert type="info" :closable="false" style="margin-bottom: 15px">
            <div style="font-size: 13px">
              📡 消息类型：{{ previewData_result.message_type }} | 
              📝 字段数：{{ previewData_result.columns?.length || 0 }} 个 | 
              🔢 预览数据：{{ previewData_result.preview_count || 0 }} 条（随机抽样）
            </div>
          </el-alert>

          <el-table :data="previewData_result.data" border stripe max-height="600" size="small">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column
              v-for="col in previewData_result.columns"
              :key="col"
              :label="col"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="scope">
                <span style="font-family: monospace; font-size: 12px">
                  {{ formatPreviewValue(getFieldValue(scope.row, col)) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { /* Search, */ View, CopyDocument } from '@element-plus/icons-vue'

const props = defineProps<{
  source: any
  selectedFields: string[]
}>()

// const emit = defineEmits<{
//   fieldsChange: [fields: string[]]
// }>()  // 已移除字段快速选择功能，暂不需要emit

// 字段数据
const fields = ref<any[]>([])
const fieldSearchKeyword = ref('')
const selectedFieldsLocal = ref<string[]>([])
const fieldsLoading = ref(false)
const tableRef1 = ref()
const tableRef2 = ref()

// 表格高度（自适应窗口，更大）（暂未使用）
// const tableHeight = computed(() => {
//   return Math.max(700, window.innerHeight * 0.85 - 150)
// })

// 序号方法
const indexMethod1 = (index: number) => {
  return index + 1
}

const indexMethod2 = (index: number) => {
  return index + 1 + leftFields.value.length
}

// 对话框
const showFullDetail = ref(false)
const activeTab = ref('fields')

// 格式数据
const decodedFormat = ref<any>(null)
const rawFormat = ref<any>(null)
const parserCode = ref('')
const formatLoading = ref(false)
const codeLoading = ref(false)
const codeLanguage = ref('python')

// 过滤后的字段
const filteredFields = computed(() => {
  if (!fieldSearchKeyword.value) return fields.value
  const keyword = fieldSearchKeyword.value.toLowerCase()
  return fields.value.filter(f => 
    (f.name || '').toLowerCase().includes(keyword) ||
    (f.cn_name || '').toLowerCase().includes(keyword) ||
    (f.description || '').toLowerCase().includes(keyword)
  )
})

// 左右分栏字段
const leftFields = computed(() => {
  const half = Math.ceil(filteredFields.value.length / 2)
  return filteredFields.value.slice(0, half)
})

const rightFields = computed(() => {
  const half = Math.ceil(filteredFields.value.length / 2)
  return filteredFields.value.slice(half)
})

// 统计启用和未启用的字段数量
const enabledFieldsCount = computed(() => {
  return fields.value.filter(f => f.enabled).length
})

const disabledFieldsCount = computed(() => {
  return fields.value.filter(f => !f.enabled).length
})

// 表格行样式（未启用的字段用灰色显示）
const tableRowClassName = ({ row }: any) => {
  return !row.enabled ? 'disabled-row' : ''
}

// 监听数据源变化，加载字段
watch(() => props.source, async (newSource) => {
  if (newSource) {
    await loadFields()
  } else {
    fields.value = []
    selectedFieldsLocal.value = []
  }
}, { immediate: true })

// 监听外部字段变化
watch(() => props.selectedFields, (newFields) => {
  selectedFieldsLocal.value = [...newFields]
})

// 加载字段
const loadFields = async () => {
  fieldsLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getFields(props.source.code, false)
    console.log('字段API返回结果:', result)
    if (result.code === 200) {
      fields.value = result.data || []
      console.log('✅ 加载字段成功:', fields.value.length)
      console.log('字段数据示例（前3个）:', fields.value.slice(0, 3))
    } else {
      ElMessage.error(result.msg || '加载字段失败')
    }
  } catch (error) {
    console.error('❌ 加载字段失败:', error)
    ElMessage.error('加载字段失败')
  } finally {
    fieldsLoading.value = false
  }
}

// 显示详情对话框
const showDetailDialog = async () => {
  console.log('打开详情对话框，当前字段数量:', fields.value.length)
  console.log('过滤后字段数量:', filteredFields.value.length)
  console.log('左侧字段数量:', leftFields.value.length)
  console.log('右侧字段数量:', rightFields.value.length)
  showFullDetail.value = true
  await nextTick()
  syncTableSelection()
}

// 同步表格选择状态
const syncTableSelection = () => {
  if (!tableRef1.value || !tableRef2.value) return
  
  tableRef1.value.clearSelection()
  tableRef2.value.clearSelection()
  
  leftFields.value.forEach((row: any) => {
    if (selectedFieldsLocal.value.includes(row.name)) {
      tableRef1.value.toggleRowSelection(row, true)
    }
  })
  
  rightFields.value.forEach((row: any) => {
    if (selectedFieldsLocal.value.includes(row.name)) {
      tableRef2.value.toggleRowSelection(row, true)
    }
  })
}

// 左表格选择变化（已移除字段快速选择功能，暂未使用）
// const handleLeftSelectionChange = (selection: any[]) => {
//   const leftSelected = selection.map(f => f.name)
//   const rightSelected = selectedFieldsLocal.value.filter(f => rightFields.value.some(r => r.name === f))
//   selectedFieldsLocal.value = [...leftSelected, ...rightSelected]
//   emit('fieldsChange', selectedFieldsLocal.value)
// }

// 右表格选择变化（已移除字段快速选择功能，暂未使用）
// const handleRightSelectionChange = (selection: any[]) => {
//   const rightSelected = selection.map(f => f.name)
//   const leftSelected = selectedFieldsLocal.value.filter(f => leftFields.value.some(l => l.name === f))
//   selectedFieldsLocal.value = [...leftSelected, ...rightSelected]
//   emit('fieldsChange', selectedFieldsLocal.value)
// }

// 加载JSON格式
const loadDecodedFormat = async () => {
  console.log('开始加载DECODED格式文档...')
  formatLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getDecodedFormat(props.source.code)
    console.log('DECODED格式API返回:', result)
    if (result.code === 200) {
      decodedFormat.value = result.data
      console.log('✅ 加载DECODED格式成功，字段数量:', decodedFormat.value.fields?.length)
    } else {
      ElMessage.error(result.msg || '加载格式文档失败')
    }
  } catch (error) {
    console.error('❌ 加载格式文档失败:', error)
    ElMessage.error('加载格式文档失败')
  } finally {
    formatLoading.value = false
  }
}

// 加载二进制格式
const loadRawFormat = async () => {
  formatLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getRawFormat(props.source.code)
    if (result.code === 200) {
      rawFormat.value = result.data
    }
  } catch (error) {
    ElMessage.error('加载格式文档失败')
  } finally {
    formatLoading.value = false
  }
}

// 加载解析代码
const loadParserCode = async () => {
  codeLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getCode(props.source.code, codeLanguage.value)
    if (result.code === 200) {
      parserCode.value = result.data
    }
  } catch (error) {
    ElMessage.error('加载代码失败')
  } finally {
    codeLoading.value = false
  }
}

// 复制代码
const copyCode = () => {
  navigator.clipboard.writeText(parserCode.value)
  ElMessage.success('代码已复制到剪贴板')
}

// 监听Tab切换，按需加载数据
watch(activeTab, async (newTab) => {
  if (newTab === 'decoded' && !decodedFormat.value) {
    await loadDecodedFormat()
  } else if (newTab === 'raw' && !rawFormat.value) {
    await loadRawFormat()
  } else if (newTab === 'code' && !parserCode.value) {
    await loadParserCode()
  }
})

// 预览状态
const showPreviewDialog = ref(false)
const previewLoading = ref(false)
const previewData_result = ref<any>(null)

// 数据预览
const previewData = async () => {
  if (!props.source?.code) {
    ElMessage.error('请先选择数据源')
    return
  }

  previewLoading.value = true
  showPreviewDialog.value = true
  previewData_result.value = null
  
  try {
    const result = await window.electronAPI.dictionary.previewSource(props.source.code)
    console.log('📊 预览数据返回:', result)
    
    if (result.code === 200) {
      // 🆕 过滤掉空对象，只保留有数据的记录
      if (result.data && Array.isArray(result.data)) {
        result.data = result.data.filter((row: any) => {
          return row && Object.keys(row).length > 0
        })
        console.log(`✅ 过滤后剩余 ${result.data.length} 条有效数据`)
      }
      
      previewData_result.value = result
      console.log('✅ 预览成功:', result.preview_count, '条数据')
      
      if (result.data.length === 0) {
        ElMessage.warning('后端返回的预览数据为空，请联系后端检查接口')
      }
    } else {
      ElMessage.error('预览失败')
      showPreviewDialog.value = false
    }
  } catch (error: any) {
    console.error('❌ 预览失败:', error)
    ElMessage.error(error.message || '预览失败')
    showPreviewDialog.value = false
  } finally {
    previewLoading.value = false
  }
}

// 从"中文(英文)"格式中提取中文字段名（行情数据的key是中文！）
const extractChineseFieldName = (columnHeader: string): string => {
  const match = columnHeader.match(/^([^(]+)\(/)
  return match ? match[1] : columnHeader
}

const extractEnglishFieldName = (columnHeader: string): string => {
  const match = columnHeader.match(/\(([^)]+)\)$/)
  return match ? match[1] : columnHeader
}

// 🆕 智能获取字段值，兼容不同的后端数据格式
const getFieldValue = (row: any, columnHeader: string): any => {
  // 1. 先尝试用完整的 column 名（如 "接收时间(local_time)"）
  if (row.hasOwnProperty(columnHeader)) {
    return row[columnHeader]
  }
  
  // 2. 尝试用中文部分（如 "接收时间"）
  const chineseName = extractChineseFieldName(columnHeader)
  if (row.hasOwnProperty(chineseName)) {
    return row[chineseName]
  }
  
  // 3. 尝试用英文部分（如 "local_time" 或 "stockCode"）
  const englishName = extractEnglishFieldName(columnHeader)
  if (row.hasOwnProperty(englishName)) {
    return row[englishName]
  }
  
  // 4. 都找不到，返回 undefined
  return undefined
}

// 格式化显示值（处理数组和对象）
const formatPreviewValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
</script>

<style lang="scss" scoped>
.market-data-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 15px;

  .empty-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 15px;

    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      border: 1px solid #e4e7ed;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
      }

      .quick-actions {
        margin-top: 15px;

        .action-item {
          margin-bottom: 15px;

          &:last-child {
            margin-bottom: 0;
          }

          .action-desc {
            margin-top: 8px;
            padding: 8px;
            background: #f5f7fa;
            border-radius: 4px;
            color: #606266;
            font-size: 12px;
            text-align: center;
            line-height: 1.5;
          }
        }
      }
    }
  }

  .fields-panel {
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }

    .fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      height: 100%;

      .grid-column {
        min-width: 0;
        height: 100%;
      }
    }
  }

  .code-panel {
    .code-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 15px;
      
      .el-select {
        width: 200px;
      }
    }
  }

  .mb-20 {
    margin-bottom: 20px;
  }

  .json-example {
    background: #f5f7fa;
    padding: 15px;
    border-radius: 4px;
    font-size: 12px;
    overflow-x: auto;
    font-family: 'Consolas', monospace;
  }

  .code-block {
    background: #282c34;
    color: #abb2bf;
    padding: 15px;
    border-radius: 4px;
    font-size: 13px;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: 'Consolas', monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

// 未启用的字段行样式
:deep(.disabled-row) {
  background-color: #f5f7fa !important;
  color: #909399;
  
  &:hover > td {
    background-color: #e9ecef !important;
  }
}

:deep(.el-dialog) {
  height: 94vh;
  margin-top: 3vh !important;
  display: flex;
  flex-direction: column;

  .el-dialog__body {
    flex: 1;
    overflow: hidden;
    padding: 20px;
  }

  .el-tabs {
    height: 100%;
    display: flex;
    flex-direction: column;

    .el-tabs__content {
      flex: 1;
      overflow: hidden;
    }

    .el-tab-pane {
      height: 100%;
    }
  }
}

.fields-panel {
  height: 100%;
  display: flex;
  flex-direction: column;

  .panel-header {
    flex-shrink: 0;
  }

  .fields-grid {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
}

.format-panel {
  height: 100%;

  .format-content {
    padding: 10px;
  }
}
</style>
