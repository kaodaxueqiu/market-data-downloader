<template>
  <div class="database-dictionary-page">
    <!-- 顶部说明 -->
    <div class="page-header">
      <h2>数据库字典</h2>
      <p class="subtitle">金融数据库表结构和字段定义，包含710张表</p>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索表名、字段名或注释（支持中文）"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="handleSearch">
        搜索
      </el-button>
    </div>

    <!-- 数据分类标签 -->
    <div class="category-section">
      <div class="category-header">
        <span>数据分类</span>
        <span class="total-count">共 {{ totalTables }} 张表</span>
      </div>
      <div class="category-tags">
        <el-tag
          v-for="cat in categories"
          :key="cat.code"
          :type="selectedCategory === cat.code ? getCategoryColor(cat.name) : getCategoryColor(cat.name)"
          :effect="selectedCategory === cat.code ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat.code)"
        >
          {{ cat.name }} ({{ cat.table_count }})
        </el-tag>
      </div>
    </div>

    <!-- 表卡片列表 -->
    <div v-loading="loading" class="table-list">
      <div class="table-grid">
        <el-card 
          v-for="table in displayedTables" 
          :key="table.table_name"
          class="table-card" 
          :class="{ active: selectedTableName === table.table_name }"
          @click="selectTable(table)"
        >
          <div class="table-top-line">
            <el-tag size="small" :type="getCategoryColor(table.category)" class="category-badge">
              {{ table.category || '数据库' }}
            </el-tag>
          </div>
          <div class="table-name-code">{{ table.table_name }}</div>
          <div class="table-comment-text">{{ table.table_comment }}</div>
          <div class="table-stats">
            <el-tag type="success" size="small">{{ table.field_count || 0 }} 字段</el-tag>
            <el-tag type="info" size="small" v-if="table.data_size">{{ table.data_size }}</el-tag>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="!loading && displayedTables.length === 0" description="未找到数据表" />
    </div>

    <!-- 表详情弹窗 -->
    <el-dialog
      v-model="showDetails"
      :title="tableDetail?.table_name || '表详情'"
      width="90%"
      top="5vh"
      class="detail-dialog"
      destroy-on-close
    >
      <div v-if="tableDetail" class="table-detail">
      <el-card>
        <template #header>
          <div class="detail-header">
            <div>
              <h3>{{ tableDetail.table_name }}</h3>
              <p class="table-desc">{{ tableDetail.table_comment }}</p>
            </div>
            <div class="detail-actions">
              <el-button @click="copySQL">
                <el-icon><CopyDocument /></el-icon>
                复制SQL
              </el-button>
              <el-button type="primary" @click="showSQLBuilder">
                <el-icon><Edit /></el-icon>
                SQL构建器
              </el-button>
            </div>
          </div>
        </template>

        <!-- 🆕 数据统计信息 -->
        <el-descriptions v-if="tableDetail.row_count !== undefined || tableDetail.earliest_update_time" :column="2" border class="mb-20">
          <el-descriptions-item label="数据行数" v-if="tableDetail.row_count !== undefined">
            <el-text type="primary">{{ formatNumber(tableDetail.row_count) }} 行</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="数据大小" v-if="tableDetail.data_size">
            <el-text type="success">{{ tableDetail.data_size }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="索引数量" v-if="tableDetail.index_count !== undefined">
            {{ tableDetail.index_count }} 个
          </el-descriptions-item>
          <el-descriptions-item label="字段数量">
            {{ tableDetail.field_count }} 个
          </el-descriptions-item>
          
          <!-- 🆕 数据入库时间范围 -->
          <el-descriptions-item label="数据入库时间范围" v-if="tableDetail.earliest_update_time && tableDetail.latest_update_time" :span="2">
            <el-icon><Calendar /></el-icon>
            <el-text type="primary" style="margin-left: 5px">
              {{ tableDetail.earliest_update_time }} ~ {{ tableDetail.latest_update_time }}
            </el-text>
            <el-tag type="info" size="small" style="margin-left: 10px">
              {{ calculateDateRange(tableDetail.earliest_update_time, tableDetail.latest_update_time) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 字段列表 -->
        <el-table :data="tableDetail.columns" stripe border max-height="500">
          <el-table-column prop="column_name" label="字段名" width="200">
            <template #default="scope">
              <el-text style="font-family: monospace">{{ scope.row.column_name }}</el-text>
              <el-tag v-if="scope.row.is_primary_key" type="danger" size="small" style="margin-left: 5px">
                PK
              </el-tag>
              <el-icon v-if="scope.row.is_indexed" color="#409EFF" style="margin-left: 5px">
                <Key />
              </el-icon>
            </template>
          </el-table-column>
          <el-table-column prop="column_comment" label="字段说明" min-width="200" />
          <el-table-column prop="data_type" label="数据类型" width="180">
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

        <!-- 示例SQL -->
        <div class="sql-section">
          <h4>查询SQL示例</h4>
          <pre class="sql-code">{{ tableDetail.select_sql }}</pre>
        </div>
      </el-card>
      </div>
    </el-dialog>

    <!-- SQL构建器对话框 -->
    <el-dialog
      v-model="sqlBuilderVisible"
      title="SQL构建器"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form :model="sqlForm" label-width="100px">
        <el-form-item label="选择字段">
          <el-select
            v-model="sqlForm.columns"
            multiple
            placeholder="请选择字段（不选则查询全部）"
            style="width: 100%"
          >
            <el-option
              v-for="col in tableDetail?.columns"
              :key="col.column_name"
              :label="`${col.column_name} (${col.column_comment})`"
              :value="col.column_name"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="筛选条件">
          <el-input
            v-model="sqlForm.conditionsText"
            type="textarea"
            :rows="3"
            placeholder="例如：stock_code = '000001' AND report_date > '2023-01-01'"
          />
        </el-form-item>
        
        <el-form-item label="排序">
          <el-input
            v-model="sqlForm.order_by"
            placeholder="例如：stock_code, report_date DESC"
          />
        </el-form-item>
        
        <el-form-item label="限制条数">
          <el-input-number
            v-model="sqlForm.limit"
            :min="1"
            :max="10000"
            style="width: 200px"
          />
        </el-form-item>
      </el-form>

      <div class="generated-sql">
        <h4>生成的SQL</h4>
        <pre class="sql-code">{{ generatedSQL }}</pre>
      </div>

      <template #footer>
        <el-button @click="sqlBuilderVisible = false">取消</el-button>
        <el-button type="primary" @click="buildSQL">
          生成SQL
        </el-button>
        <el-button type="success" @click="copyGeneratedSQL">
          <el-icon><CopyDocument /></el-icon>
          复制SQL
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, CopyDocument, Edit, Key, Check, Close, Calendar } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const searchKeyword = ref('')
const selectedCategory = ref('all')
const selectedTableName = ref('')
const sqlBuilderVisible = ref(false)
const showDetails = ref(false)

// 数据
const categories = ref<any[]>([
  { code: 'all', name: '全部', table_count: 0 }
])
const allTables = ref<any[]>([])
const tableDetail = ref<any>(null)
const generatedSQL = ref('')

// SQL构建器表单
const sqlForm = ref({
  columns: [] as string[],
  conditionsText: '',
  order_by: '',
  limit: 100
})

// 计算属性
const totalTables = computed(() => {
  const allCat = categories.value.find(c => c.code === 'all')
  return allCat ? allCat.table_count : 0
})

// 显示的表（用于卡片展示）
// 分类筛选已在后端完成，这里只需要处理搜索过滤
const displayedTables = computed(() => {
  let tables = allTables.value
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    tables = tables.filter(t => 
      t.table_name.toLowerCase().includes(keyword) ||
      (t.table_comment && t.table_comment.includes(searchKeyword.value))
    )
  }
  
  return tables
})

// 加载分类
const loadCategories = async () => {
  loading.value = true
  try {
    // 先获取API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      ElMessage.error('请先在系统设置中配置API Key')
      return
    }
    
    // 获取完整的未加密API Key
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    
    if (!fullApiKey) {
      ElMessage.error('无法获取完整的API Key，请重新配置')
      return
    }
    
    // 设置API Key
    await window.electronAPI.dbdict.setApiKey(fullApiKey)
    
    // 获取分类统计
    const result = await window.electronAPI.dbdict.getCategories()
    if (result.code === 200) {
      const allCount = result.data.reduce((sum: number, cat: any) => sum + cat.table_count, 0)
      categories.value = [
        { code: 'all', name: '全部', table_count: allCount },
        ...result.data
      ]
      
      // 加载所有表
      await loadTables()
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
    ElMessage.error('数据库字典服务不可用，请检查网络连接和API配置')
  } finally {
    loading.value = false
  }
}

// 加载表列表（支持按分类筛选）
const loadTables = async (category?: string) => {
  try {
    const params: any = {
      page: 1,
      size: 1000  // 加载所有表
    }
    
    // 如果指定了分类，则按分类筛选
    if (category && category !== 'all') {
      params.category = category
      console.log('📋 [数据库字典] 加载分类数据，category参数:', category)
    } else {
      console.log('📋 [数据库字典] 加载所有表数据')
    }
    
    const result = await window.electronAPI.dbdict.getTables(params)
    console.log('✅ [数据库字典] API返回结果:', result)
    if (result.code === 200) {
      allTables.value = result.data
      console.log(`✅ [数据库字典] 加载了 ${result.data.length} 张表`)
    }
  } catch (error: any) {
    console.error('❌ [数据库字典] 加载表列表失败:', error)
    ElMessage.error(error.message || '加载表列表失败')
  }
}

// 选择分类标签
const selectCategory = async (code: string) => {
  console.log('🏷️ [数据库字典] 选择分类 code:', code)
  selectedCategory.value = code
  selectedTableName.value = ''
  tableDetail.value = null
  
  // 重新加载对应分类的表
  await loadTables(code === 'all' ? undefined : code)
}

// 获取分类颜色 - 自动分配
const getCategoryColor = (category: string) => {
  // 预定义常见分类的颜色
  const predefinedColors: Record<string, string> = {
    '全部': 'primary',
    '股票基本信息': 'primary',
    '财务数据': 'success',
    '市场行情': 'warning',
    '指数数据': 'danger'
  }
  
  // 如果有预定义颜色，使用预定义
  if (predefinedColors[category]) {
    return predefinedColors[category]
  }
  
  // 否则根据分类名称自动分配颜色
  const colors = ['primary', 'success', 'warning', 'danger', 'info']
  
  // 计算category字符串的简单hash
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // 根据hash选择颜色
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

// 点击表卡片
const selectTable = async (table: any) => {
  selectedTableName.value = table.table_name
  showDetails.value = true
  
  loading.value = true
  try {
    const result = await window.electronAPI.dbdict.getTableDetail(table.table_name)
    if (result.code === 200) {
      tableDetail.value = result.data
    }
  } catch (error: any) {
    console.error('加载表详情失败:', error)
    ElMessage.error(error.message || '加载表详情失败')
  } finally {
    loading.value = false
  }
}

// 搜索 - 实时过滤
const handleSearch = () => {
  // displayedTables计算属性会自动根据searchKeyword过滤
  if (displayedTables.value.length === 0) {
    ElMessage.info('未找到匹配的表')
  }
}

// 复制SQL
const copySQL = () => {
  if (tableDetail.value?.select_sql) {
    navigator.clipboard.writeText(tableDetail.value.select_sql).then(() => {
      ElMessage.success('SQL已复制到剪贴板')
    }).catch(() => {
      ElMessage.error('复制失败')
    })
  }
}

// 显示SQL构建器
const showSQLBuilder = () => {
  sqlForm.value = {
    columns: [],
    conditionsText: '',
    order_by: '',
    limit: 100
  }
  generatedSQL.value = ''
  sqlBuilderVisible.value = true
}

// 构建SQL
const buildSQL = async () => {
  if (!selectedTableName.value) return
  
  try {
    const conditions = sqlForm.value.conditionsText
      .split('\n')
      .map(c => c.trim())
      .filter(c => c)
    
    const result = await window.electronAPI.dbdict.buildSQL({
      table_name: selectedTableName.value,
      columns: sqlForm.value.columns.length > 0 ? sqlForm.value.columns : undefined,
      conditions: conditions.length > 0 ? conditions : undefined,
      order_by: sqlForm.value.order_by || undefined,
      limit: sqlForm.value.limit
    })
    
    if (result.code === 200) {
      generatedSQL.value = result.data.sql
      ElMessage.success('SQL生成成功')
    }
  } catch (error: any) {
    console.error('SQL构建失败:', error)
    ElMessage.error(error.message || 'SQL构建失败')
  }
}

// 复制生成的SQL
const copyGeneratedSQL = () => {
  if (generatedSQL.value) {
    navigator.clipboard.writeText(generatedSQL.value).then(() => {
      ElMessage.success('SQL已复制到剪贴板')
    }).catch(() => {
      ElMessage.error('复制失败')
    })
  }
}

// 格式化数字（加千分位）
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

// 计算日期范围跨度（天数）
const calculateDateRange = (startDate: string, endDate: string): string => {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) {
      return `${diffDays} 天`
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `约 ${months} 个月`
    } else {
      const years = (diffDays / 365).toFixed(1)
      return `约 ${years} 年`
    }
  } catch (error) {
    return ''
  }
}

// 初始化
onMounted(() => {
  loadCategories()
})
</script>

<style scoped lang="scss">
.database-dictionary-page {
  max-width: 1400px;
  margin: 0 auto;

  .page-header {
    margin-bottom: 30px;
    
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

  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    
    .el-input {
      flex: 1;
    }
  }

  // 分类标签区域
  .category-section {
    margin-bottom: 30px;
    
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      font-size: 16px;
      font-weight: 500;
      
      .total-count {
        color: #909399;
        font-size: 14px;
      }
    }
    
    .category-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      
      .category-tag {
        cursor: pointer;
        padding: 8px 16px;
        transition: all 0.3s;
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      }
    }
  }
  
  // 表卡片列表
  .table-list {
    min-height: 400px;
    
    .table-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 20px;
    }
    
    .table-card {
      cursor: pointer !important;
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      height: 100%;
      border-radius: 16px;
      border: 1px solid #f0f0f0;
      background: #ffffff;
      overflow: hidden;
      
      :deep(.el-card__body) {
        padding: 24px;
      }
      
      &:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
        border-color: rgba(64, 158, 255, 0.3);
        
        .table-name-code {
          color: #409EFF;
        }
      }
      
      &.active {
        border-color: #409EFF;
        box-shadow: 0 8px 24px rgba(64, 158, 255, 0.2);
        background: linear-gradient(135deg, #f6f9ff 0%, #ffffff 100%);
      }
      
      // 强制所有子元素也显示pointer
      * {
        cursor: pointer !important;
      }
      
      .table-top-line {
        margin-bottom: 12px;
        
        .category-badge {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: 500;
        }
      }
      
      .table-name-code {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
        font-size: 15px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 10px;
        word-break: break-all;
        letter-spacing: -0.3px;
      }
      
      .table-comment-text {
        font-size: 13px;
        color: #86868b;
        margin-bottom: 16px;
        min-height: 40px;
        line-height: 1.6;
        font-weight: 400;
      }
      
      .table-stats {
        display: flex;
        gap: 8px;
        
        .el-tag {
          border-radius: 8px;
          font-weight: 500;
        }
      }
    }
  }

  .table-selector {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 30px;
    
    .selector-label {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
    }
  }

  .table-detail {
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      
      h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-family: monospace;
      }
      
      .table-desc {
        margin: 0;
        color: #606266;
      }
      
      .detail-actions {
        display: flex;
        gap: 10px;
      }
    }
    
    .sql-section {
      margin-top: 30px;
      
      h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
      }
      
      .sql-code {
        background-color: #f5f7fa;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #303133;
      }
    }
  }

  .table-option {
    display: flex;
    gap: 10px;
    
    .table-name {
      font-family: monospace;
      font-weight: 500;
      color: #409EFF;
    }
    
    .table-comment {
      color: #909399;
    }
  }

  .generated-sql {
    margin-top: 20px;
    
    h4 {
      margin: 0 0 10px 0;
      font-size: 16px;
    }
    
    .sql-code {
      background-color: #f5f7fa;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #303133;
      min-height: 100px;
    }
  }

  .mb-20 {
    margin-bottom: 20px;
  }
}
</style>
