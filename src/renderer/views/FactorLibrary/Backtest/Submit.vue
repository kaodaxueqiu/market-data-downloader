<template>
  <div class="backtest-submit">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack">
        <template #content>
          <span class="page-title">提交回测任务</span>
        </template>
      </el-page-header>
    </div>

    <!-- 表单 -->
    <el-form 
      ref="formRef" 
      :model="formData" 
      :rules="formRules" 
      label-width="120px"
      class="submit-form"
    >
      <!-- 基本信息 -->
      <el-card class="form-section">
        <template #header>
          <span class="section-title">基本信息</span>
        </template>
        
        <el-form-item label="任务名称" prop="task_name">
          <el-input 
            v-model="formData.task_name" 
            placeholder="请输入任务名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="任务类型" prop="task_type">
          <el-radio-group v-model="formData.task_type">
            <el-radio value="single_factor">单因子回测</el-radio>
            <el-radio value="multi_factor">多因子回测</el-radio>
            <el-radio value="factor_compare">因子对比</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-card>

      <!-- 因子配置 -->
      <el-card class="form-section">
        <template #header>
          <span class="section-title">因子配置</span>
        </template>
        
        <el-form-item label="因子来源" prop="factor_source">
          <el-radio-group v-model="factorSource" @change="onFactorSourceChange">
            <el-radio value="library">从因子库选择</el-radio>
            <el-radio value="expression">因子表达式</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <!-- 从因子库选择 -->
        <el-form-item v-if="factorSource === 'library'" label="选择因子" prop="factor_ids">
          <el-select
            v-model="formData.factor_ids"
            multiple
            filterable
            placeholder="请选择因子"
            style="width: 100%;"
          >
            <el-option
              v-for="factor in factorList"
              :key="factor.id"
              :label="factor.name"
              :value="factor.id"
            >
              <span>{{ factor.name }}</span>
              <span style="color: #909399; margin-left: 10px; font-size: 12px;">
                {{ factor.category }}
              </span>
            </el-option>
          </el-select>
          <div class="form-tip">可多选，支持搜索</div>
        </el-form-item>
        
        <!-- 因子表达式 -->
        <el-form-item v-if="factorSource === 'expression'" label="因子表达式" prop="factor_expression">
          <el-input
            v-model="formData.factor_expression"
            type="textarea"
            :rows="3"
            placeholder="请输入因子表达式，如: close/open - 1"
          />
          <div class="form-tip">支持的字段: close, open, high, low, volume, turnover 等</div>
        </el-form-item>
      </el-card>

      <!-- 时间范围 -->
      <el-card class="form-section">
        <template #header>
          <span class="section-title">回测时间</span>
        </template>
        
        <el-form-item label="时间范围" prop="date_range">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="dateShortcuts"
            style="width: 400px;"
          />
        </el-form-item>
      </el-card>

      <!-- 股票池配置 -->
      <el-card class="form-section">
        <template #header>
          <span class="section-title">股票池配置</span>
        </template>
        
        <el-form-item label="股票池类型">
          <el-radio-group v-model="formData.universe.type">
            <el-radio value="preset">预设股票池</el-radio>
            <el-radio value="custom">自定义</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="formData.universe.type === 'preset'" label="预设股票池">
          <el-select v-model="formData.universe.preset_name" style="width: 200px;">
            <el-option label="全市场" value="all" />
            <el-option label="沪深300" value="hs300" />
            <el-option label="中证500" value="zz500" />
            <el-option label="中证1000" value="zz1000" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="formData.universe.type === 'custom'" label="股票代码">
          <el-input
            v-model="customStockList"
            type="textarea"
            :rows="3"
            placeholder="请输入股票代码，多个用逗号分隔，如: 000001.SZ, 600000.SH"
          />
        </el-form-item>
        
        <el-form-item label="过滤条件">
          <el-checkbox v-model="formData.universe.exclude_st">排除ST股票</el-checkbox>
          <el-checkbox v-model="formData.universe.exclude_suspended">排除停牌股票</el-checkbox>
        </el-form-item>
      </el-card>

      <!-- 高级参数（可折叠） -->
      <el-card class="form-section">
        <template #header>
          <div class="section-header-collapse" @click="showAdvanced = !showAdvanced">
            <span class="section-title">高级参数</span>
            <el-icon :class="{ 'rotate': showAdvanced }">
              <ArrowDown />
            </el-icon>
          </div>
        </template>
        
        <el-collapse-transition>
          <div v-show="showAdvanced">
            <el-form-item label="调仓频率">
              <el-select v-model="formData.backtest_params.rebalance_freq" style="width: 150px;">
                <el-option label="每日" value="daily" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="分组数量">
              <el-input-number 
                v-model="formData.backtest_params.num_groups" 
                :min="2" 
                :max="20"
              />
              <span class="form-tip-inline">用于分层回测</span>
            </el-form-item>
            
            <el-form-item label="基准指数">
              <el-select v-model="formData.backtest_params.benchmark" style="width: 200px;">
                <el-option label="沪深300 (000300.SH)" value="000300.SH" />
                <el-option label="中证500 (000905.SH)" value="000905.SH" />
                <el-option label="中证1000 (000852.SH)" value="000852.SH" />
                <el-option label="上证指数 (000001.SH)" value="000001.SH" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="交易成本">
              <el-input-number 
                v-model="formData.backtest_params.cost_rate" 
                :min="0" 
                :max="0.01"
                :step="0.0001"
                :precision="4"
              />
              <span class="form-tip-inline">双边成本率</span>
            </el-form-item>
            
            <el-form-item label="滑点">
              <el-input-number 
                v-model="formData.backtest_params.slippage" 
                :min="0" 
                :max="0.01"
                :step="0.0001"
                :precision="4"
              />
              <span class="form-tip-inline">价格百分比</span>
            </el-form-item>
          </div>
        </el-collapse-transition>
      </el-card>

      <!-- 计算选项 -->
      <el-card class="form-section">
        <template #header>
          <span class="section-title">计算选项</span>
        </template>
        
        <el-form-item label="分析指标">
          <el-checkbox-group v-model="calcOptions">
            <el-checkbox value="calc_ic">IC（信息系数）</el-checkbox>
            <el-checkbox value="calc_rank_ic">Rank IC</el-checkbox>
            <el-checkbox value="calc_layer_return">分层收益</el-checkbox>
            <el-checkbox value="calc_long_short">多空组合</el-checkbox>
            <el-checkbox value="calc_turnover">换手率</el-checkbox>
            <el-checkbox value="calc_drawdown">最大回撤</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-card>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <el-button @click="goBack">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ submitting ? '提交中...' : '提交回测' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const showAdvanced = ref(false)
const factorSource = ref('library')
const factorList = ref<any[]>([])
const customStockList = ref('')

// 日期范围
const dateRange = ref<[string, string] | null>(null)

// 计算选项
const calcOptions = ref([
  'calc_ic',
  'calc_rank_ic',
  'calc_layer_return',
  'calc_long_short',
  'calc_turnover',
  'calc_drawdown'
])

// 日期快捷选项
const dateShortcuts = [
  {
    text: '最近1年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 1)
      return [start, end]
    }
  },
  {
    text: '最近2年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 2)
      return [start, end]
    }
  },
  {
    text: '最近3年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 3)
      return [start, end]
    }
  },
  {
    text: '今年以来',
    value: () => {
      const end = new Date()
      const start = new Date(end.getFullYear(), 0, 1)
      return [start, end]
    }
  }
]

// 表单数据
const formData = reactive({
  task_name: '',
  task_type: 'single_factor',
  factor_ids: [] as number[],
  factor_expression: '',
  universe: {
    type: 'preset',
    preset_name: 'all',
    custom_list: null as string[] | null,
    exclude_st: true,
    exclude_suspended: true
  },
  backtest_params: {
    rebalance_freq: 'daily',
    num_groups: 10,
    benchmark: '000300.SH',
    cost_rate: 0.001,
    slippage: 0
  },
  data_sources: {
    market_data: {
      database: 'clickhouse',
      table: 'stock_daily',
      fields: ['close', 'volume', 'turnover', 'high', 'low'],
      date_field: 'trade_date',
      code_field: 'stock_code'
    }
  }
})

// 表单校验规则
const formRules: FormRules = {
  task_name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' }
  ],
  task_type: [
    { required: true, message: '请选择任务类型', trigger: 'change' }
  ]
}

// 因子来源切换
const onFactorSourceChange = () => {
  formData.factor_ids = []
  formData.factor_expression = ''
}

// 返回
const goBack = () => {
  router.push('/factor-library/backtest/tasks')
}

// 加载因子列表
const loadFactorList = async () => {
  try {
    // TODO: 调用获取因子列表接口
    // const result = await window.electronAPI.factor.getFactorList()
    // if (result.success) {
    //   factorList.value = result.data
    // }
    
    // 暂时使用模拟数据
    factorList.value = []
  } catch (error) {
    console.error('加载因子列表失败:', error)
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    // 校验日期范围
    if (!dateRange.value || dateRange.value.length !== 2) {
      ElMessage.error('请选择回测时间范围')
      return
    }
    
    // 校验因子配置
    if (factorSource.value === 'library' && formData.factor_ids.length === 0) {
      ElMessage.error('请选择至少一个因子')
      return
    }
    if (factorSource.value === 'expression' && !formData.factor_expression.trim()) {
      ElMessage.error('请输入因子表达式')
      return
    }
    
    submitting.value = true
    
    try {
      // 构建请求数据
      const requestData: any = {
        task_name: formData.task_name,
        task_type: formData.task_type,
        start_date: dateRange.value[0],
        end_date: dateRange.value[1],
        data_sources: formData.data_sources,
        universe: {
          ...formData.universe
        },
        backtest_params: formData.backtest_params,
        calc_options: {
          calc_ic: calcOptions.value.includes('calc_ic'),
          calc_rank_ic: calcOptions.value.includes('calc_rank_ic'),
          calc_layer_return: calcOptions.value.includes('calc_layer_return'),
          calc_long_short: calcOptions.value.includes('calc_long_short'),
          calc_turnover: calcOptions.value.includes('calc_turnover'),
          calc_drawdown: calcOptions.value.includes('calc_drawdown')
        }
      }
      
      // 因子配置
      if (factorSource.value === 'library') {
        requestData.factor_ids = formData.factor_ids
      } else {
        requestData.factor_expression = formData.factor_expression
      }
      
      // 自定义股票池
      if (formData.universe.type === 'custom' && customStockList.value) {
        requestData.universe.custom_list = customStockList.value
          .split(/[,，\s]+/)
          .map(s => s.trim())
          .filter(s => s)
      }
      
      console.log('提交回测任务:', requestData)
      
      const result = await window.electronAPI.backtest.submit(requestData)
      
      if (result.success && result.data) {
        ElMessage.success('任务提交成功！')
        router.push('/factor-library/backtest/tasks')
      } else {
        ElMessage.error(result.error || '提交失败')
      }
    } catch (error: any) {
      ElMessage.error('提交失败: ' + error.message)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  loadFactorList()
})
</script>

<style scoped lang="scss">
.backtest-submit {
  max-width: 900px;
  
  .page-header {
    margin-bottom: 20px;
    
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }
  
  .submit-form {
    .form-section {
      margin-bottom: 20px;
      
      .section-title {
        font-size: 15px;
        font-weight: 600;
      }
      
      .section-header-collapse {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        
        .el-icon {
          transition: transform 0.3s;
          
          &.rotate {
            transform: rotate(180deg);
          }
        }
      }
    }
    
    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
    
    .form-tip-inline {
      font-size: 12px;
      color: #909399;
      margin-left: 10px;
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 0;
    }
  }
}
</style>
