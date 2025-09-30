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

    <!-- 数据分类 -->
    <div class="category-section">
      <div class="category-header">
        <span>数据分类</span>
        <span class="total-count">共 {{ totalTables }} 张表</span>
      </div>
      <div class="category-tags">
        <el-tag
          v-for="cat in categories"
          :key="cat.code"
          :type="selectedCategory === cat.code ? 'primary' : 'info'"
          :effect="selectedCategory === cat.code ? 'dark' : 'plain'"
          size="large"
          class="category-tag"
          @click="selectCategory(cat.code)"
        >
          {{ cat.name }} {{ cat.table_count }}
        </el-tag>
      </div>
    </div>

    <!-- 表选择 -->
    <div class="table-selector">
      <div class="selector-label">选择数据表：</div>
      <el-select
        v-model="selectedTable"
        placeholder="请选择数据表..."
        filterable
        clearable
        size="large"
        style="width: 600px"
        @change="handleTableChange"
      >
        <el-option
          v-for="table in filteredTables"
          :key="table.table_name"
          :label="`${table.table_name} - ${table.table_comment}`"
          :value="table.table_name"
        >
          <div class="table-option">
            <span class="table-name">{{ table.table_name }}</span>
            <span class="table-comment">{{ table.table_comment }}</span>
          </div>
        </el-option>
      </el-select>
    </div>

    <!-- 表详情 -->
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

    <!-- 空状态 -->
    <el-empty
      v-else
      description="选择一个表查看详情"
      :image-size="120"
    />

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
import { Search, CopyDocument, Edit, Key, Check, Close } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const searchKeyword = ref('')
const selectedCategory = ref('all')
const selectedTable = ref('')
const sqlBuilderVisible = ref(false)

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

const filteredTables = computed(() => {
  if (selectedCategory.value === 'all') {
    return allTables.value
  }
  
  // 根据分类code或name筛选
  const selectedCat = categories.value.find(c => c.code === selectedCategory.value)
  if (!selectedCat) return []
  
  // 尝试匹配 category 字段（可能是中文名称或代码）
  return allTables.value.filter(t => 
    t.category === selectedCategory.value || // 匹配code
    t.category === selectedCat.name // 匹配name
  )
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

// 加载表列表
const loadTables = async () => {
  try {
    const result = await window.electronAPI.dbdict.getTables({
      page: 1,
      size: 1000  // 加载所有表
    })
    if (result.code === 200) {
      allTables.value = result.data
      console.log(`加载了 ${result.data.length} 张表`)
      console.log('表数据示例:', result.data[0])
      console.log('当前分类:', categories.value)
    }
  } catch (error: any) {
    console.error('加载表列表失败:', error)
    ElMessage.error(error.message || '加载表列表失败')
  }
}

// 选择分类
const selectCategory = (code: string) => {
  selectedCategory.value = code
  selectedTable.value = ''
  tableDetail.value = null
}

// 表切换
const handleTableChange = async (tableName: string) => {
  if (!tableName) {
    tableDetail.value = null
    return
  }
  
  loading.value = true
  try {
    const result = await window.electronAPI.dbdict.getTableDetail(tableName)
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

// 搜索
const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  
  try {
    const result = await window.electronAPI.dbdict.search(searchKeyword.value)
    if (result.code === 200) {
      console.log('搜索结果:', result.data)
      ElMessage.success(`找到 ${result.data.length} 个匹配结果`)
      // TODO: 显示搜索结果
    }
  } catch (error: any) {
    console.error('搜索失败:', error)
    ElMessage.error(error.message || '搜索失败')
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
  if (!selectedTable.value) return
  
  try {
    const conditions = sqlForm.value.conditionsText
      .split('\n')
      .map(c => c.trim())
      .filter(c => c)
    
    const result = await window.electronAPI.dbdict.buildSQL({
      table_name: selectedTable.value,
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
      gap: 10px;
      
      .category-tag {
        cursor: pointer;
        transition: all 0.3s;
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
}
</style>
