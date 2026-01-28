<template>
  <div class="expression-dict-content">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-info">
        <h2>因子表达式字典</h2>
        <p class="description">
          因子表达式支持的所有函数列表，帮助您编写因子表达式。
          共 <strong>{{ totalCount }}</strong> 个函数，分为 <strong>{{ categories.length }}</strong> 个类别。
        </p>
      </div>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索函数名或描述"
          clearable
          style="width: 260px"
          :prefix-icon="Search"
        />
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="category-tabs">
      <el-radio-group v-model="selectedCategory" size="default">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button 
          v-for="cat in categories" 
          :key="cat.category" 
          :label="cat.category"
        >
          {{ cat.category }} ({{ cat.functions.length }})
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 函数列表 -->
    <div class="functions-container" v-loading="loading">
      <template v-for="cat in filteredCategories" :key="cat.category">
        <div class="category-section">
          <div class="category-header">
            <el-icon><Folder /></el-icon>
            <span>{{ cat.category }}</span>
            <el-tag size="small" type="info" round>{{ cat.functions.length }}</el-tag>
          </div>
          
          <div class="functions-grid">
            <div 
              v-for="func in cat.functions" 
              :key="func.id" 
              class="function-card"
              @click="showFunctionDetail(func)"
            >
              <div class="func-header">
                <span class="func-name">{{ func.function_name }}</span>
                <span class="func-aliases" v-if="func.aliases">
                  {{ func.aliases }}
                </span>
              </div>
              <div class="func-syntax">
                <code>{{ func.syntax }}</code>
              </div>
              <div class="func-desc">{{ func.description }}</div>
            </div>
          </div>
        </div>
      </template>
      
      <el-empty v-if="!loading && filteredCategories.length === 0" description="没有找到匹配的函数" />
    </div>

    <!-- 函数详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="currentFunction?.function_name"
      width="650px"
      destroy-on-close
    >
      <div class="function-detail" v-if="currentFunction">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="函数名">
            <strong>{{ currentFunction.function_name }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="别名" v-if="currentFunction.aliases">
            {{ currentFunction.aliases }}
          </el-descriptions-item>
          <el-descriptions-item label="语法">
            <code class="syntax-code">{{ currentFunction.syntax }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="描述">
            {{ currentFunction.description }}
          </el-descriptions-item>
          <el-descriptions-item label="返回值" v-if="currentFunction.return_desc">
            {{ currentFunction.return_desc }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 参数说明 -->
        <div class="params-section" v-if="currentFunction.parameters && currentFunction.parameters.length > 0">
          <h4>参数说明</h4>
          <el-table :data="currentFunction.parameters" border size="small">
            <el-table-column prop="name" label="参数名" width="120" />
            <el-table-column prop="desc" label="说明" />
          </el-table>
        </div>

        <!-- 示例 -->
        <div class="examples-section" v-if="currentFunction.examples && currentFunction.examples.length > 0">
          <h4>使用示例</h4>
          <div class="examples-list">
            <div v-for="(example, idx) in currentFunction.examples" :key="idx" class="example-item">
              <code>{{ example }}</code>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 数据状态
const loading = ref(false)
const categories = ref<any[]>([])
const totalCount = ref(0)
const searchKeyword = ref('')
const selectedCategory = ref('')

// 详情对话框
const detailDialogVisible = ref(false)
const currentFunction = ref<any>(null)

// 过滤后的分类
const filteredCategories = computed(() => {
  let result = categories.value
  
  // 按分类筛选
  if (selectedCategory.value) {
    result = result.filter(cat => cat.category === selectedCategory.value)
  }
  
  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.map(cat => ({
      ...cat,
      functions: cat.functions.filter((func: any) => 
        func.function_name.toLowerCase().includes(keyword) ||
        (func.aliases && func.aliases.toLowerCase().includes(keyword)) ||
        func.description.toLowerCase().includes(keyword)
      )
    })).filter(cat => cat.functions.length > 0)
  }
  
  return result
})

// 加载函数字典
const loadFunctions = async () => {
  loading.value = true
  
  try {
    const result = await window.electronAPI.factor.getExpressionFunctions()
    
    if (result.success && result.data) {
      categories.value = result.data.categories || []
      totalCount.value = result.data.total_count || 0
    } else {
      ElMessage.error(result.error || '加载函数字典失败')
    }
  } catch (error: any) {
    console.error('加载函数字典失败:', error)
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 显示函数详情
const showFunctionDetail = (func: any) => {
  currentFunction.value = func
  detailDialogVisible.value = true
}

onMounted(() => {
  loadFunctions()
})
</script>

<style scoped lang="scss">
.expression-dict-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  
  .header-info {
    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }
    
    .description {
      margin: 0;
      color: #909399;
      font-size: 14px;
      
      strong {
        color: #409eff;
      }
    }
  }
}

.category-tabs {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.functions-container {
  min-height: 400px;
}

.category-section {
  margin-bottom: 24px;
  
  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    
    .el-icon {
      color: #409eff;
    }
  }
}

.functions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.function-card {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #409eff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
    transform: translateY(-2px);
  }
  
  .func-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
    
    .func-name {
      font-weight: 600;
      font-size: 15px;
      color: #409eff;
    }
    
    .func-aliases {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .func-syntax {
    margin-bottom: 8px;
    
    code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #606266;
      background: #f5f7fa;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }
  }
  
  .func-desc {
    font-size: 13px;
    color: #909399;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

// 详情对话框
.function-detail {
  .syntax-code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px;
    color: #409eff;
    background: #f5f7fa;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .params-section,
  .examples-section {
    margin-top: 20px;
    
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .example-item {
      code {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        color: #606266;
        background: #f5f7fa;
        padding: 8px 12px;
        border-radius: 4px;
        display: block;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }
}
</style>
