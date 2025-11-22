<template>
  <div class="fund-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Wallet /></el-icon>
          <span>基金列表</span>
        </div>
      </template>
      
      <!-- 搜索筛选 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索基金名称或代码"
          clearable
          style="width: 300px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 150px">
          <el-option label="全部" value="" />
          <el-option label="运行中" value="running" />
          <el-option label="已清盘" value="liquidated" />
          <el-option label="暂停" value="paused" />
        </el-select>
      </div>
      
      <!-- 基金列表表格 -->
      <el-table
        :data="filteredFunds"
        stripe
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column prop="code" label="基金代码" width="120" />
        <el-table-column prop="name" label="基金名称" min-width="180" />
        <el-table-column prop="type" label="基金类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getFundTypeColor(row.type)">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="manager" label="基金经理" width="120" />
        <el-table-column prop="netValue" label="最新净值" width="120" align="right">
          <template #default="{ row }">
            <span>{{ row.netValue?.toFixed(4) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="totalValue" label="总资产(万)" width="120" align="right">
          <template #default="{ row }">
            <span>{{ (row.totalValue / 10000).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="returnRate" label="累计收益率" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.returnRate >= 0 ? 'profit' : 'loss'">
              {{ row.returnRate >= 0 ? '+' : '' }}{{ (row.returnRate * 100).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusColor(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="110" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalFunds"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Wallet, Search, View } from '@element-plus/icons-vue'

// 基金数据接口
interface Fund {
  id: string
  code: string
  name: string
  type: string
  manager: string
  netValue: number
  totalValue: number
  returnRate: number
  status: 'running' | 'liquidated' | 'paused'
  createTime: string
  remark?: string
}

// 状态
const loading = ref(false)

// 搜索筛选
const searchKeyword = ref('')
const filterStatus = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const totalFunds = ref(0)

// 基金列表数据（模拟数据）
const fundList = ref<Fund[]>([
  {
    id: '1',
    code: 'FUND001',
    name: '紫洲量化1号',
    type: '股票型',
    manager: '张三',
    netValue: 1.2345,
    totalValue: 5000000,
    returnRate: 0.2345,
    status: 'running',
    createTime: '2024-01-15'
  },
  {
    id: '2',
    code: 'FUND002',
    name: '紫洲混合策略2号',
    type: '混合型',
    manager: '李四',
    netValue: 1.1234,
    totalValue: 3000000,
    returnRate: 0.1234,
    status: 'running',
    createTime: '2024-03-20'
  },
  {
    id: '3',
    code: 'FUND003',
    name: '紫洲指数增强3号',
    type: '指数型',
    manager: '王五',
    netValue: 0.9876,
    totalValue: 2000000,
    returnRate: -0.0124,
    status: 'paused',
    createTime: '2024-06-10'
  }
])


// 筛选后的基金列表
const filteredFunds = computed(() => {
  let result = fundList.value
  
  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(fund => 
      fund.name.toLowerCase().includes(keyword) || 
      fund.code.toLowerCase().includes(keyword)
    )
  }
  
  // 状态筛选
  if (filterStatus.value) {
    result = result.filter(fund => fund.status === filterStatus.value)
  }
  
  totalFunds.value = result.length
  
  // 分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return result.slice(start, end)
})

// 获取基金类型颜色
const getFundTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    '股票型': '',
    '债券型': 'success',
    '混合型': 'warning',
    '货币型': 'info',
    '指数型': '',
    'QDII': 'danger'
  }
  return colorMap[type] || ''
}

// 获取状态颜色
const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    running: 'success',
    liquidated: 'info',
    paused: 'warning'
  }
  return colorMap[status] || ''
}

// 获取状态文本
const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    running: '运行中',
    liquidated: '已清盘',
    paused: '暂停'
  }
  return textMap[status] || status
}

// 查看详情
const viewDetail = (fund: Fund) => {
  ElMessage.info(`查看基金详情: ${fund.name}`)
  // TODO: 跳转到业绩页面或打开详情对话框
}

// 分页处理
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

// 加载数据
const loadFunds = async () => {
  loading.value = true
  try {
    // TODO: 调用后端API获取基金列表
    await new Promise(resolve => setTimeout(resolve, 500))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFunds()
})
</script>

<style lang="scss" scoped>
.fund-list {
  height: 100%;
  padding: 20px;
  
  .el-card {
    height: calc(100vh - 100px);
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
    
    .search-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .profit {
      color: #f56c6c;
      font-weight: 500;
    }
    
    .loss {
      color: #67c23a;
      font-weight: 500;
    }
    
    .pagination {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
  }
}
</style>



