<template>
  <div class="submit-content">
    <!-- 主表单卡片 -->
    <div class="form-card">
      <div class="card-header">
        <div class="header-icon">
          <el-icon :size="24"><EditPen /></el-icon>
        </div>
        <div class="header-text">
          <h3>提交字段申请</h3>
          <p>申请将新字段添加到 zz_384 中间表</p>
        </div>
      </div>
      
      <div class="card-body">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
        >
          <el-form-item label="字段名称" prop="field_name">
            <el-input 
              v-model="form.field_name" 
              placeholder="请输入英文字段名，如 turnover_rate"
              maxlength="50"
              show-word-limit
            >
              <template #prefix>
                <el-icon><Key /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              <el-icon><InfoFilled /></el-icon>
              <span>字段名应为英文，使用下划线分隔，如：turnover_rate、pe_ratio</span>
            </div>
            <div class="field-check" v-if="existingFields.length > 0">
              <el-icon color="#67c23a"><CircleCheck /></el-icon>
              <span>已加载 {{ existingFields.length }} 个现有字段，输入时会自动检查重复</span>
            </div>
          </el-form-item>

          <el-form-item label="字段描述" prop="field_desc">
            <el-input 
              v-model="form.field_desc" 
              placeholder="请输入字段的中文描述，简要说明含义和用途"
              maxlength="200"
              show-word-limit
            >
              <template #prefix>
                <el-icon><Document /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="计算逻辑" prop="calc_logic">
            <el-input 
              v-model="form.calc_logic" 
              type="textarea" 
              :rows="8"
              placeholder="请输入计算逻辑，可以是 SQL 表达式或详细的文字描述&#10;&#10;示例：&#10;volume / float_shares  -- 换手率&#10;或详细描述计算方式"
              maxlength="2000"
              show-word-limit
            />
            <div class="form-tip">
              <el-icon><InfoFilled /></el-icon>
              <span>可以是 SQL 表达式（如：volume / float_shares）或详细的文字描述</span>
            </div>
          </el-form-item>

          <el-form-item class="form-actions">
            <el-button 
              type="primary" 
              @click="handleSubmit" 
              :loading="submitting" 
              size="large"
              class="submit-btn"
            >
              <el-icon><Check /></el-icon>
              提交申请
            </el-button>
            <el-button @click="handleReset" size="large">
              <el-icon><RefreshRight /></el-icon>
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 说明卡片 -->
    <div class="info-card">
      <div class="info-section">
        <div class="section-title">
          <el-icon><QuestionFilled /></el-icon>
          <span>申请说明</span>
        </div>
        <div class="info-list">
          <div class="info-item">
            <div class="item-icon success">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="item-content">
              <div class="item-title">提交后等待处理</div>
              <div class="item-desc">工单将进入待处理队列，IT 人员会尽快处理</div>
            </div>
          </div>
          <div class="info-item">
            <div class="item-icon primary">
              <el-icon><DataLine /></el-icon>
            </div>
            <div class="item-content">
              <div class="item-title">字段添加位置</div>
              <div class="item-desc">处理完成后，字段将添加到 <code>zz_384</code> 中间表中</div>
            </div>
          </div>
          <div class="info-item">
            <div class="item-icon info">
              <el-icon><View /></el-icon>
            </div>
            <div class="item-content">
              <div class="item-title">查看进度</div>
              <div class="item-desc">您可以在"我的申请"中查看工单进度和处理结果</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="info-section warning-section">
        <div class="section-title warning">
          <el-icon><Warning /></el-icon>
          <span>注意事项</span>
        </div>
        <ul class="warning-list">
          <li>请确保字段名不与现有字段重复</li>
          <li>字段名只能包含英文字母、数字和下划线</li>
          <li>计算逻辑请描述清楚，便于 IT 理解和实现</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { 
  EditPen, Check, RefreshRight, Key, Document, InfoFilled, 
  CircleCheck, Warning, QuestionFilled, Clock, DataLine, View
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'submitted'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

// zz_384 表的现有字段列表
const existingFields = ref<string[]>([])
const fieldsLoading = ref(false)

const form = reactive({
  field_name: '',
  field_desc: '',
  calc_logic: ''
})

// 自定义校验器：检查字段是否已存在
const validateFieldName = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入字段名称'))
    return
  }
  
  // 格式校验
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
    callback(new Error('字段名必须以字母开头，只能包含字母、数字和下划线'))
    return
  }
  
  // 检查是否已存在（转小写比较）
  const lowerValue = value.toLowerCase()
  if (existingFields.value.includes(lowerValue)) {
    callback(new Error(`字段 "${value}" 已存在于 zz_384 表中，请使用其他名称`))
    return
  }
  
  callback()
}

const rules: FormRules = {
  field_name: [
    { required: true, message: '请输入字段名称', trigger: 'blur' },
    { validator: validateFieldName, trigger: ['blur', 'input'] }
  ]
}

// 加载 zz_384 表的字段列表（ClickHouse 加工数据库）
const loadExistingFields = async () => {
  fieldsLoading.value = true
  try {
    // zz_384 是 ClickHouse 加工数据表，使用 dbdict.getTableFields
    const result = await window.electronAPI.dbdict.getTableFields('zz_384', 'clickhouse')
    console.log('🔍 zz_384 字段API返回:', result)
    if (result.code === 200 && result.data) {
      // 提取字段名（转小写存储，方便比较）
      existingFields.value = result.data.map((f: any) => (f.column_name || f.name || '').toLowerCase())
      console.log('✅ 加载 zz_384 字段成功，共', existingFields.value.length, '个字段')
      console.log('字段列表示例:', existingFields.value.slice(0, 10))
    }
  } catch (error: any) {
    console.error('加载 zz_384 字段失败:', error)
  } finally {
    fieldsLoading.value = false
  }
}

onMounted(() => {
  loadExistingFields()
})

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  
  try {
    const result = await window.electronAPI.workorder.submit({
      field_name: form.field_name,
      field_desc: form.field_desc || undefined,
      calc_logic: form.calc_logic || undefined
    })
    
    if (result.success) {
      ElMessage.success(`工单提交成功，工单ID: ${result.data?.id}`)
      handleReset()
      emit('submitted')
    } else {
      ElMessage.error(result.error || '提交失败')
    }
  } catch (error: any) {
    console.error('提交失败:', error)
    ElMessage.error(error.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

const handleReset = () => {
  form.field_name = ''
  form.field_desc = ''
  form.calc_logic = ''
  formRef.value?.resetFields()
}
</script>

<style scoped lang="scss">
.submit-content {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  align-items: start;
}

// 表单卡片
.form-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;

  .header-icon {
    width: 56px;
    height: 56px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-text {
    h3 {
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 600;
    }
    
    p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
  }
}

.card-body {
  padding: 32px;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
  
  .el-icon {
    font-size: 14px;
  }
}

.field-check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;
  color: #67c23a;
  
  .el-icon {
    font-size: 14px;
  }
}

.form-actions {
  margin-top: 16px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
  
  .submit-btn {
    min-width: 140px;
  }
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #303133;
  font-size: 15px;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 10px;
}

:deep(.el-textarea__inner) {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
}

// 说明卡片
.info-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  position: sticky;
  top: 20px;
}

.info-section {
  padding: 24px;
  
  &:not(:last-child) {
    border-bottom: 1px solid #f0f0f0;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 20px;
    
    .el-icon {
      color: #409eff;
      font-size: 18px;
    }
    
    &.warning .el-icon {
      color: #e6a23c;
    }
  }
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  gap: 14px;

  .item-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    
    &.success {
      background: linear-gradient(135deg, #67c23a, #95d475);
      color: #fff;
    }
    &.primary {
      background: linear-gradient(135deg, #409eff, #79bbff);
      color: #fff;
    }
    &.info {
      background: linear-gradient(135deg, #909399, #c0c4cc);
      color: #fff;
    }
    
    .el-icon {
      font-size: 18px;
    }
  }

  .item-content {
    flex: 1;
    
    .item-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .item-desc {
      font-size: 13px;
      color: #909399;
      line-height: 1.5;

      code {
        background: #f0f7ff;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 12px;
        color: #409eff;
      }
    }
  }
}

.warning-section {
  background: #fdf6ec;
}

.warning-list {
  margin: 0;
  padding-left: 20px;
  
  li {
    font-size: 13px;
    color: #e6a23c;
    line-height: 2;
  }
}

@media (max-width: 1200px) {
  .submit-content {
    grid-template-columns: 1fr;
  }
  
  .info-card {
    position: static;
  }
}
</style>
