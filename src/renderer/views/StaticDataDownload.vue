<template>
  <div class="static-download-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>静态元数据下载</h2>
      <p class="subtitle">从PostgreSQL下载静态元数据表，支持710张表的灵活查询和导出</p>
    </div>

    <div class="content-layout">
      <!-- 左侧：选择数据表 -->
      <div class="left-panel">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>选择数据表</span>
            </div>
          </template>

          <!-- 数据分类 -->
          <div class="form-section">
            <label class="form-label">数据分类</label>
            <el-select
              v-model="selectedCategory"
              placeholder="请选择分类"
              @change="handleCategoryChange"
              style="width: 100%"
            >
              <el-option
                v-for="cat in categories"
                :key="cat.code"
                :label="`${cat.name} (${cat.table_count}张表)`"
                :value="cat.code"
              />
            </el-select>
          </div>

          <!-- 数据表列表 -->
          <div class="form-section">
            <label class="form-label">数据表 ({{ filteredTables.length }}张)</label>
            <div class="table-list">
              <div
                v-for="table in filteredTables"
                :key="table.table_name"
                class="table-item"
                :class="{ active: selectedTableName === table.table_name }"
                @click="selectTable(table)"
              >
                <div class="table-name">{{ table.table_name }}</div>
                <div class="table-comment">{{ table.table_comment }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧：字段选择和下载配置 -->
      <div class="right-panel">
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span>字段选择 ({{ selectedFields.length }}个字段)</span>
              <el-checkbox v-model="selectAllFields" @change="toggleSelectAll">
                全部字段
              </el-checkbox>
            </div>
          </template>

          <!-- 字段列表 -->
          <div v-if="tableFields.length > 0" class="fields-grid">
            <el-checkbox
              v-for="field in tableFields"
              :key="field.column_name"
              v-model="selectedFields"
              :label="field.column_name"
              :value="field.column_name"
            >
              {{ field.column_name }}
            </el-checkbox>
          </div>
          <el-empty v-else description="请先选择数据表" :image-size="80" />
        </el-card>

        <!-- 日期范围（可选） -->
        <el-card shadow="hover" class="mt-20">
          <template #header>
            <span>日期范围（可选）</span>
          </template>

          <div class="date-range-section">
            <el-row :gutter="15">
              <el-col :span="8">
                <label class="form-label">日期字段</label>
                <el-select
                  v-model="dateRangeConfig.dateField"
                  placeholder="请选择日期字段"
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="field in dateFields"
                    :key="field"
                    :label="field"
                    :value="field"
                  />
                </el-select>
              </el-col>
              <el-col :span="8">
                <label class="form-label">开始日期</label>
                <el-date-picker
                  v-model="dateRangeConfig.startDate"
                  type="date"
                  placeholder="开始日期"
                  format="YYYY/MM/DD"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-col>
              <el-col :span="8">
                <label class="form-label">结束日期</label>
                <el-date-picker
                  v-model="dateRangeConfig.endDate"
                  type="date"
                  placeholder="结束日期"
                  format="YYYY/MM/DD"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-col>
            </el-row>
          </div>
        </el-card>

        <!-- 下载配置 -->
        <el-card shadow="hover" class="mt-20">
          <template #header>
            <span>下载配置</span>
          </template>

          <el-row :gutter="15">
            <el-col :span="8">
              <label class="form-label">导出格式</label>
              <el-select v-model="downloadConfig.format" style="width: 100%">
                <el-option label="CSV (Excel可打开)" value="csv" />
                <el-option label="JSON (程序处理)" value="json" />
              </el-select>
            </el-col>
            <el-col :span="8">
              <label class="form-label">限制数量</label>
              <el-input-number
                v-model="downloadConfig.limit"
                :min="0"
                :max="1000000"
                :step="1000"
                style="width: 100%"
              />
              <div class="hint-text">0表示不限制</div>
            </el-col>
            <el-col :span="8">
              <label class="form-label">排序字段</label>
              <el-select
                v-model="downloadConfig.orderBy"
                placeholder="默认排序"
                clearable
                style="width: 100%"
              >
                <el-option label="默认排序" value="" />
                <el-option
                  v-for="field in selectedFields"
                  :key="field"
                  :label="`${field} (升序)`"
                  :value="field"
                />
                <el-option
                  v-for="field in selectedFields"
                  :key="field + '_desc'"
                  :label="`${field} (降序)`"
                  :value="field + ' DESC'"
                />
              </el-select>
            </el-col>
          </el-row>
        </el-card>

        <!-- 下载按钮 -->
        <div class="action-bar">
          <el-button type="primary" size="large" @click="handleDownload" :disabled="!canDownload">
            <el-icon><Download /></el-icon>
            开始下载
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const selectedCategory = ref('')
const selectedTableName = ref('')
const selectAllFields = ref(false)
const selectedFields = ref<string[]>([])

// 数据
const categories = ref<any[]>([])
const allTables = ref<any[]>([])
const tableFields = ref<any[]>([])

// 日期范围配置
const dateRangeConfig = ref({
  dateField: '',
  startDate: '',
  endDate: ''
})

// 下载配置
const downloadConfig = ref({
  format: 'csv' as 'csv' | 'json',
  limit: 0,
  orderBy: ''
})

// 计算属性
const filteredTables = computed(() => {
  if (!selectedCategory.value) return []
  
  const selectedCat = categories.value.find(c => c.code === selectedCategory.value)
  if (!selectedCat) return []
  
  return allTables.value.filter(t => 
    t.category === selectedCategory.value || 
    t.category === selectedCat.name
  )
})

const dateFields = computed(() => {
  return tableFields.value
    .filter(f => f.data_type.includes('date') || f.data_type.includes('time'))
    .map(f => f.column_name)
})

const canDownload = computed(() => {
  return selectedTableName.value && selectedFields.value.length > 0
})

// 加载分类和表
const loadCategoriesAndTables = async () => {
  loading.value = true
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
    
    await window.electronAPI.dbdict.setApiKey(fullApiKey)
    
    // 获取分类
    const catResult = await window.electronAPI.dbdict.getCategories()
    if (catResult.code === 200) {
      categories.value = catResult.data
    }
    
    // 获取所有表
    const tablesResult = await window.electronAPI.dbdict.getTables({ page: 1, size: 1000 })
    if (tablesResult.code === 200) {
      allTables.value = tablesResult.data
    }
  } catch (error: any) {
    console.error('加载失败:', error)
    ElMessage.error('加载数据失败，请检查网络连接')
  } finally {
    loading.value = false
  }
}

// 分类切换
const handleCategoryChange = () => {
  selectedTableName.value = ''
  tableFields.value = []
  selectedFields.value = []
  selectAllFields.value = false
}

// 选择表
const selectTable = async (table: any) => {
  selectedTableName.value = table.table_name
  loading.value = true
  
  try {
    // 获取表字段
    const result = await window.electronAPI.dbdict.getTableFields(table.table_name)
    if (result.code === 200) {
      tableFields.value = result.data
      // 默认选中所有字段
      selectedFields.value = result.data.map((f: any) => f.column_name)
      selectAllFields.value = true
      
      // 自动选择第一个日期字段
      const firstDateField = dateFields.value[0]
      if (firstDateField) {
        dateRangeConfig.value.dateField = firstDateField
      }
    }
  } catch (error: any) {
    console.error('加载字段失败:', error)
    ElMessage.error('加载字段失败')
  } finally {
    loading.value = false
  }
}

// 全选切换
const toggleSelectAll = () => {
  if (selectAllFields.value) {
    selectedFields.value = tableFields.value.map(f => f.column_name)
  } else {
    selectedFields.value = []
  }
}

// 下载
const handleDownload = async () => {
  if (!selectedTableName.value) {
    ElMessage.warning('请先选择数据表')
    return
  }
  
  if (selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个字段')
    return
  }
  
  // 弹出文件保存对话框
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  const defaultFilename = `${selectedTableName.value}_${timestamp}.${downloadConfig.value.format}`
  
  const saveResult = await window.electronAPI.dialog.showSaveDialog({
    title: '保存文件',
    defaultPath: defaultFilename,
    filters: [
      downloadConfig.value.format === 'csv' 
        ? { name: 'CSV文件', extensions: ['csv'] }
        : { name: 'JSON文件', extensions: ['json'] }
    ]
  })
  
  if (saveResult.canceled || !saveResult.filePath) {
    return
  }
  
  loading.value = true
  
  try {
    // 构建请求参数
    const params: any = {
      table_name: selectedTableName.value,
      columns: selectedFields.value,
      limit: downloadConfig.value.limit,
      format: downloadConfig.value.format
    }
    
    // 添加日期范围
    if (dateRangeConfig.value.dateField && 
        dateRangeConfig.value.startDate && 
        dateRangeConfig.value.endDate) {
      params.date_range = {
        date_field: dateRangeConfig.value.dateField,
        start_date: dateRangeConfig.value.startDate,
        end_date: dateRangeConfig.value.endDate
      }
    }
    
    // 添加排序
    if (downloadConfig.value.orderBy) {
      params.order_by = downloadConfig.value.orderBy
    }
    
    console.log('下载参数:', JSON.stringify(params, null, 2))
    console.log('保存路径:', saveResult.filePath)
    console.log('开始调用IPC...')
    
    // 先测试：传递简单参数
    const simpleParams = JSON.parse(JSON.stringify(params))
    console.log('简化后的参数:', simpleParams)
    
    // 调用下载API（主进程会保存文件）
    const result = await window.electronAPI.dbdict.downloadData(simpleParams, saveResult.filePath)
    console.log('下载结果:', result)
    
    if (result && result.success) {
      ElMessage.success(`下载成功！`)
      
      // 打开文件所在位置
      window.electronAPI.shell.showItemInFolder(result.path)
    }
  } catch (error: any) {
    console.error('下载失败:', error)
    ElMessage.error(error.message || '下载失败')
  } finally {
    loading.value = false
  }
}

// 初始化
onMounted(() => {
  loadCategoriesAndTables()
})
</script>

<style scoped lang="scss">
.static-download-page {
  max-width: 1600px;
  margin: 0 auto;

  .page-header {
    margin-bottom: 20px;
    
    h2 {
      font-size: 28px;
      margin: 0 0 10px 0;
      color: #303133;
    }
    
    .subtitle {
      font-size: 14px;
      color: #909399;
      margin: 0;
    }
  }

  .content-layout {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 20px;
    align-items: start;
  }

  .left-panel {
    .card-header {
      font-size: 16px;
      font-weight: 500;
    }

    .form-section {
      margin-bottom: 20px;

      .form-label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #606266;
      }
    }

    .table-list {
      max-height: 500px;
      overflow-y: auto;
      border: 1px solid #DCDFE6;
      border-radius: 4px;

      .table-item {
        padding: 12px;
        border-bottom: 1px solid #EBEEF5;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          background-color: #F5F7FA;
        }

        &.active {
          background-color: #ECF5FF;
          border-left: 3px solid #409EFF;
        }

        &:last-child {
          border-bottom: none;
        }

        .table-name {
          font-family: monospace;
          font-weight: 500;
          font-size: 14px;
          color: #303133;
          margin-bottom: 4px;
        }

        .table-comment {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }

  .right-panel {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: 500;
    }

    .fields-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      padding: 10px;
    }

    .date-range-section {
      .form-label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #606266;
      }
    }

    .mt-20 {
      margin-top: 20px;
    }

    .hint-text {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }

    .action-bar {
      margin-top: 30px;
      text-align: center;
    }
  }
}
</style>
