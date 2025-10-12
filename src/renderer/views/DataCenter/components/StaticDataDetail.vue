<template>
  <div class="static-data-detail">
    <div v-if="!source" class="empty-state">
      <el-empty description="请从左侧选择数据表" :image-size="120" />
    </div>

    <div v-else class="detail-content">
      <!-- 概要信息卡片 -->
      <div class="summary-card">
        <div class="card-header">
          <h3>{{ source.table_comment || source.table_name }}</h3>
          <el-tag type="primary">{{ source.table_name }}</el-tag>
        </div>

        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="数据分类">
            <el-tag type="success">{{ source.category || '未分类' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="字段数量">
            <el-tag size="small">{{ source.field_count || 0 }} 个</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="数据行数" v-if="tableDetailData?.row_count !== undefined">
            {{ tableDetailData.row_count.toLocaleString() }} 行
          </el-descriptions-item>
          <el-descriptions-item label="数据大小" v-if="tableDetailData?.data_size">
            {{ tableDetailData.data_size }}
          </el-descriptions-item>
          <el-descriptions-item label="数据入库时间" v-if="tableDetailData?.earliest_update_time && tableDetailData?.latest_update_time" :span="2">
            <el-text type="primary" size="small">
              {{ tableDetailData.earliest_update_time }} ~ {{ tableDetailData.latest_update_time }}
            </el-text>
          </el-descriptions-item>
        </el-descriptions>

        <div class="quick-actions">
          <el-button type="primary" size="large" @click="showDetailDialog" style="width: 100%">
            <el-icon><View /></el-icon>
            查看完整详情
          </el-button>
        </div>

        <div class="hint-text">
          💡 提示：点击查看完整的字段列表和生成SQL
        </div>
      </div>
    </div>

    <!-- 完整详情对话框 -->
    <el-dialog
      v-model="showFullDetail"
      :title="`${source?.table_comment || source?.table_name || ''} - 表详情`"
      width="95%"
      top="3vh"
      destroy-on-close
      class="detail-dialog"
    >
      <el-tabs v-model="activeTab">
        <!-- 字段展示 -->
        <el-tab-pane label="字段展示" name="fields">
          <div class="fields-panel">
            <!-- 🆕 数据统计信息 -->
            <el-descriptions v-if="tableDetailData?.row_count !== undefined || tableDetailData?.earliest_update_time" :column="2" border class="mb-15">
              <el-descriptions-item label="数据行数" v-if="tableDetailData.row_count !== undefined">
                <el-text type="primary">{{ tableDetailData.row_count.toLocaleString() }} 行</el-text>
              </el-descriptions-item>
              <el-descriptions-item label="数据大小" v-if="tableDetailData.data_size">
                <el-text type="success">{{ tableDetailData.data_size }}</el-text>
              </el-descriptions-item>
              <el-descriptions-item label="索引数量" v-if="tableDetailData.index_count !== undefined">
                {{ tableDetailData.index_count }} 个
              </el-descriptions-item>
              <el-descriptions-item label="字段数量">
                {{ fields.length }} 个
              </el-descriptions-item>
              <el-descriptions-item label="数据入库时间范围" v-if="tableDetailData.earliest_update_time && tableDetailData.latest_update_time" :span="2">
                <el-text type="primary">
                  {{ tableDetailData.earliest_update_time }} ~ {{ tableDetailData.latest_update_time }}
                </el-text>
              </el-descriptions-item>
            </el-descriptions>

            <div class="fields-grid">
              <div class="grid-column">
                <el-table
                  :data="leftFields"
                  stripe
                  v-loading="fieldsLoading"
                >
                  <el-table-column type="index" label="序号" width="60" :index="indexMethod1" />
                  <el-table-column prop="column_name" label="字段名" width="180">
                    <template #default="scope">
                      <el-text style="font-family: monospace">{{ scope.row.column_name }}</el-text>
                      <el-tag v-if="scope.row.is_primary_key" type="danger" size="small" style="margin-left: 5px">PK</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="column_comment" label="字段说明" min-width="150" />
                  <el-table-column prop="data_type" label="数据类型" width="200" show-overflow-tooltip>
                    <template #default="scope">
                      <el-tag size="small">{{ scope.row.data_type }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="is_nullable" label="可为空" width="80" align="center">
                    <template #default="scope">
                      <el-icon v-if="scope.row.is_nullable" color="#67C23A"><Check /></el-icon>
                      <el-icon v-else color="#F56C6C"><Close /></el-icon>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="grid-column">
                <el-table
                  :data="rightFields"
                  stripe
                  v-loading="fieldsLoading"
                >
                  <el-table-column type="index" label="序号" width="60" :index="indexMethod2" />
                  <el-table-column prop="column_name" label="字段名" width="180">
                    <template #default="scope">
                      <el-text style="font-family: monospace">{{ scope.row.column_name }}</el-text>
                      <el-tag v-if="scope.row.is_primary_key" type="danger" size="small" style="margin-left: 5px">PK</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="column_comment" label="字段说明" min-width="150" />
                  <el-table-column prop="data_type" label="数据类型" width="200" show-overflow-tooltip>
                    <template #default="scope">
                      <el-tag size="small">{{ scope.row.data_type }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="is_nullable" label="可为空" width="80" align="center">
                    <template #default="scope">
                      <el-icon v-if="scope.row.is_nullable" color="#67C23A"><Check /></el-icon>
                      <el-icon v-else color="#F56C6C"><Close /></el-icon>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- SQL生成 -->
        <el-tab-pane label="SQL生成" name="sql">
          <div class="sql-panel">
            <div class="sql-header">
              <el-button type="primary" @click="buildSQL">
                <el-icon><Edit /></el-icon>
                生成SQL语句
              </el-button>
              <el-button type="success" @click="copySQL" :disabled="!generatedSQL">
                <el-icon><CopyDocument /></el-icon>
                复制SQL
              </el-button>
            </div>

            <div v-if="generatedSQL">
              <h4>生成的SQL语句：</h4>
              <pre class="sql-block">{{ generatedSQL }}</pre>
            </div>
            <el-empty v-else description="请先选择字段，然后点击生成SQL" :image-size="100" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, View, Edit, CopyDocument, Check, Close } from '@element-plus/icons-vue'

const props = defineProps<{
  source: any
  selectedFields: string[]
}>()

const emit = defineEmits<{
  fieldsChange: [fields: string[]]
}>()

// 字段数据
const fields = ref<any[]>([])
const fieldSearchKeyword = ref('')
const selectedFieldsLocal = ref<string[]>([])
const fieldsLoading = ref(false)
const tableRef1 = ref()
const tableRef2 = ref()

// 表详情数据（包含数据范围信息）
const tableDetailData = ref<any>(null)

// 表格高度（自适应窗口，更大）
const tableHeight = computed(() => {
  return Math.max(700, window.innerHeight * 0.85 - 150)
})

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
const generatedSQL = ref('')

// 过滤后的字段
const filteredFields = computed(() => {
  if (!fieldSearchKeyword.value) return fields.value
  const keyword = fieldSearchKeyword.value.toLowerCase()
  return fields.value.filter(f => 
    (f.column_name || '').toLowerCase().includes(keyword) ||
    (f.column_comment || '').toLowerCase().includes(keyword)
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

// 监听数据源变化，加载字段
watch(() => props.source, async (newSource) => {
  if (newSource) {
    await loadFields()
  } else {
    fields.value = []
    selectedFieldsLocal.value = []
    tableDetailData.value = null
  }
}, { immediate: true })

// 监听外部字段变化
watch(() => props.selectedFields, (newFields) => {
  selectedFieldsLocal.value = [...newFields]
})

// 加载字段（使用getTableDetail获取完整信息）
const loadFields = async () => {
  fieldsLoading.value = true
  try {
    const result = await window.electronAPI.dbdict.getTableDetail(props.source.table_name)
    console.log('静态数据详情返回结果:', result)
    if (result.code === 200) {
      // 保存完整的表详情数据
      tableDetailData.value = result.data
      fields.value = result.data?.columns || []
      console.log('✅ 加载字段成功:', fields.value.length)
      
      // 🆕 如果有数据入库时间信息，打印出来
      if (result.data?.earliest_update_time) {
        console.log('📅 数据入库时间范围:', result.data.earliest_update_time, '~', result.data.latest_update_time)
      }
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
    if (selectedFieldsLocal.value.includes(row.column_name)) {
      tableRef1.value.toggleRowSelection(row, true)
    }
  })
  
  rightFields.value.forEach((row: any) => {
    if (selectedFieldsLocal.value.includes(row.column_name)) {
      tableRef2.value.toggleRowSelection(row, true)
    }
  })
}

// 左表格选择变化
const handleLeftSelectionChange = (selection: any[]) => {
  const leftSelected = selection.map(f => f.column_name)
  const rightSelected = selectedFieldsLocal.value.filter(f => rightFields.value.some(r => r.column_name === f))
  selectedFieldsLocal.value = [...leftSelected, ...rightSelected]
  emit('fieldsChange', selectedFieldsLocal.value)
  generatedSQL.value = ''
}

// 右表格选择变化
const handleRightSelectionChange = (selection: any[]) => {
  const rightSelected = selection.map(f => f.column_name)
  const leftSelected = selectedFieldsLocal.value.filter(f => leftFields.value.some(l => l.column_name === f))
  selectedFieldsLocal.value = [...leftSelected, ...rightSelected]
  emit('fieldsChange', selectedFieldsLocal.value)
  generatedSQL.value = ''
}

// 生成SQL
const buildSQL = () => {
  if (selectedFieldsLocal.value.length === 0) {
    ElMessage.warning('请先选择字段')
    return
  }
  
  const fieldsList = selectedFieldsLocal.value.join(',\n    ')
  generatedSQL.value = `SELECT\n    ${fieldsList}\nFROM ${props.source.table_name}\nWHERE 1=1\nLIMIT 100;`
  ElMessage.success('SQL语句已生成')
}

// 复制SQL
const copySQL = () => {
  navigator.clipboard.writeText(generatedSQL.value)
  ElMessage.success('SQL已复制到剪贴板')
}
</script>

<style lang="scss" scoped>
.static-data-detail {
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
      }

      .hint-text {
        margin-top: 10px;
        padding: 10px;
        background: #f5f7fa;
        border-radius: 4px;
        color: #606266;
        font-size: 12px;
        text-align: center;
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

  .sql-panel {
    .sql-header {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    h4 {
      margin: 20px 0 10px 0;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .sql-block {
    background: #282c34;
    color: #61dafb;
    padding: 20px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.6;
    overflow-x: auto;
    font-family: 'Consolas', monospace;
    white-space: pre;
  }

  .mb-15 {
    margin-bottom: 15px;
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
</style>
