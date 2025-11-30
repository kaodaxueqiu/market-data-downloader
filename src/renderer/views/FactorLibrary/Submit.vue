<template>
  <div class="factor-submit-page">
    <div class="page-header">
      <h2>🚀 因子提交</h2>
      <el-button @click="resetForm">
        <el-icon><Refresh /></el-icon>
        重置
      </el-button>
    </div>

    <!-- 三步流程 -->
    <el-steps :active="currentStep" align-center class="steps-container">
      <el-step title="选择因子" description="选择要执行的因子" :icon="FolderOpened" />
      <el-step title="配置参数" description="设置执行参数" :icon="Setting" />
      <el-step title="提交执行" description="确认并提交" :icon="Upload" />
    </el-steps>

    <!-- 步骤1: 选择因子 -->
    <el-card v-show="currentStep === 0" class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>📂 第一步：选择因子</span>
        </div>
      </template>
      
      <div class="select-factor-section">
        <el-form :model="submitForm" label-width="120px">
          <!-- 仓库选择 -->
          <el-form-item label="选择仓库" required>
            <el-select
              v-model="submitForm.repoFullName"
              placeholder="请选择因子仓库"
              style="width: 100%"
              @change="handleRepoChange"
              :loading="loadingRepos"
            >
              <el-option
                v-for="repo in repos"
                :key="repo.full_name"
                :label="repo.full_name"
                :value="repo.full_name"
              >
                <div class="repo-option">
                  <span>{{ repo.full_name }}</span>
                  <span class="repo-count">{{ repo.factor_count || 0 }} 个因子</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <!-- 因子选择 -->
          <el-form-item label="选择因子" required>
            <el-select
              v-model="submitForm.factorCode"
              placeholder="请选择因子"
              style="width: 100%"
              :loading="loadingFactors"
              :disabled="!submitForm.repoFullName"
              @change="handleFactorChange"
              filterable
            >
              <el-option
                v-for="factor in factors"
                :key="factor.code"
                :label="`${factor.code} - ${factor.name}`"
                :value="factor.code"
              >
                <div class="factor-option">
                  <span class="factor-code">{{ factor.code }}</span>
                  <span class="factor-name">{{ factor.name }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <!-- 分支选择 -->
          <el-form-item label="分支">
            <el-input v-model="submitForm.branch" placeholder="main" />
            <div class="form-tip">
              <el-text type="info" size="small">默认使用 main 分支</el-text>
            </div>
          </el-form-item>
        </el-form>

        <!-- 因子预览 -->
        <div v-if="selectedFactor" class="factor-preview">
          <el-descriptions title="因子信息" :column="2" border>
            <el-descriptions-item label="因子代码">
              <el-text style="font-family: monospace; font-weight: 600;">
                {{ selectedFactor.code }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="因子名称">{{ selectedFactor.name }}</el-descriptions-item>
            <el-descriptions-item label="因子文件">
              <el-text style="font-family: monospace; font-size: 12px;">
                {{ selectedFactor.file }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="执行函数">{{ selectedFactor.function }}</el-descriptions-item>
            <el-descriptions-item label="分类" v-if="selectedFactor.category">
              {{ selectedFactor.category.l1 }} > {{ selectedFactor.category.l2 }} > {{ selectedFactor.category.l3 }}
            </el-descriptions-item>
            <el-descriptions-item label="描述">
              {{ selectedFactor.description || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="版本">
              <el-tag size="small" type="success">{{ selectedFactor.version || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ selectedFactor.updated_at || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <div class="step-actions">
        <el-button type="primary" size="large" @click="goToStep2" :disabled="!canGoToStep2">
          下一步：配置参数
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </el-card>

    <!-- 步骤2: 配置参数 -->
    <el-card v-show="currentStep === 1" class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>⚙️ 第二步：配置参数</span>
        </div>
      </template>
      
      <div class="config-section">
        <el-form :model="submitForm" label-width="120px">
          <el-form-item label="计算日期" required>
            <el-date-picker
              v-model="submitForm.calcDate"
              type="date"
              placeholder="选择计算日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <div class="form-tip">
              <el-text type="info" size="small">因子计算的目标日期</el-text>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="step-actions">
        <el-button size="large" @click="currentStep = 0">
          <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
          上一步
        </el-button>
        <el-button type="primary" size="large" @click="goToStep3" :disabled="!submitForm.calcDate">
          下一步：确认提交
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </el-card>

    <!-- 步骤3: 提交执行 -->
    <el-card v-show="currentStep === 2" class="step-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>✅ 第三步：确认提交</span>
        </div>
      </template>
      
      <div class="submit-section">
        <el-alert
          title="提交说明"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <div>提交后将创建 K8S Job 执行因子计算任务，您可以在"因子管理"页面查看执行状态和结果</div>
        </el-alert>

        <!-- 最终确认信息 -->
        <div class="final-review">
          <el-descriptions title="提交信息确认" :column="1" border>
            <el-descriptions-item label="仓库">{{ submitForm.repoFullName }}</el-descriptions-item>
            <el-descriptions-item label="分支">{{ submitForm.branch || 'main' }}</el-descriptions-item>
            <el-descriptions-item label="因子代码">
              <el-text style="font-family: monospace; font-weight: 600;">
                {{ submitForm.factorCode }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="因子文件">
              <el-text style="font-family: monospace; font-size: 12px;">
                {{ selectedFactor?.file }}
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="执行函数">{{ selectedFactor?.function }}</el-descriptions-item>
            <el-descriptions-item label="计算日期">
              <el-tag type="primary">{{ submitForm.calcDate }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 提交结果 -->
        <div v-if="submitStatus === 'success'" class="submit-result">
          <el-result
            icon="success"
            title="提交成功"
            :sub-title="`任务ID: ${submitResult?.job_id || submitResult?.id}`"
          >
            <template #extra>
              <el-button type="primary" @click="goToManage">
                查看执行状态
              </el-button>
              <el-button @click="resetAndNewSubmit">
                继续提交
              </el-button>
            </template>
          </el-result>
        </div>

        <div v-if="submitStatus === 'error'" class="submit-result">
          <el-result
            icon="error"
            title="提交失败"
            :sub-title="submitError"
          >
            <template #extra>
              <el-button type="primary" @click="handleSubmit">
                重试
              </el-button>
              <el-button @click="currentStep = 1">
                返回修改
              </el-button>
            </template>
          </el-result>
        </div>
      </div>

      <div v-if="submitStatus === 'idle'" class="step-actions">
        <el-button size="large" @click="currentStep = 1">
          <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
          上一步
        </el-button>
        <el-button type="success" size="large" @click="handleSubmit" :loading="submitting">
          <el-icon class="el-icon--left"><Upload /></el-icon>
          提交执行
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, ArrowRight, ArrowLeft, Upload, FolderOpened, Setting } from '@element-plus/icons-vue'

interface Repo {
  id: number
  name: string
  full_name: string  // 格式: owner/repo
  description?: string
  factor_count?: number
}

interface FactorCategory {
  l1: string
  l2: string
  l3: string
}

interface Factor {
  code: string        // 因子代码
  name: string        // 因子名称
  file: string        // 因子文件路径
  function: string    // 执行函数
  description?: string
  category?: FactorCategory  // 三级分类对象
  version?: string
  author?: string
  created_at?: string
  updated_at?: string
  tags?: string[]
  params?: Record<string, any>
}

const router = useRouter()
const route = useRoute()

// 步骤控制
const currentStep = ref(0)

// 加载状态
const loadingRepos = ref(false)
const loadingFactors = ref(false)
const submitting = ref(false)

// 数据
const repos = ref<Repo[]>([])
const factors = ref<Factor[]>([])
const selectedFactor = ref<Factor | null>(null)

// 提交状态
const submitStatus = ref<'idle' | 'success' | 'error'>('idle')
const submitResult = ref<any>(null)
const submitError = ref('')

// 表单数据
const submitForm = reactive({
  repoFullName: '',  // owner/repo 格式
  factorCode: '',
  branch: 'main',
  calcDate: ''
})

// 计算属性
const canGoToStep2 = computed(() => {
  return submitForm.repoFullName && submitForm.factorCode && selectedFactor.value
})

// 加载仓库列表
const loadRepos = async () => {
  loadingRepos.value = true
  try {
    // 设置API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (!defaultKey) {
      ElMessage.error('请先配置 API Key')
      return
    }
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('获取API Key失败')
      return
    }
    await window.electronAPI.factor.setApiKey(fullApiKey)
    
    const result = await window.electronAPI.factor.getMyRepos()
    if (result.code === 200) {
      // 数据在 data.repos 里面
      repos.value = result.data?.repos || []
      
      // 如果URL参数中有仓库信息，自动选择
      const ownerFromQuery = route.query.owner as string
      const repoFromQuery = route.query.repo as string
      if (ownerFromQuery && repoFromQuery) {
        submitForm.repoFullName = `${ownerFromQuery}/${repoFromQuery}`
        await handleRepoChange(submitForm.repoFullName)
        
        // 自动选择因子
        const factorCodeFromQuery = route.query.factor_code as string
        if (factorCodeFromQuery) {
          submitForm.factorCode = factorCodeFromQuery
          handleFactorChange(factorCodeFromQuery)
        }
      }
    }
  } catch (error: any) {
    console.error('加载仓库失败:', error)
    ElMessage.error('加载仓库列表失败: ' + error.message)
  } finally {
    loadingRepos.value = false
  }
}

// 仓库选择变化
const handleRepoChange = async (repoFullName: string) => {
  submitForm.factorCode = ''
  selectedFactor.value = null
  factors.value = []
  
  if (repoFullName) {
    const [owner, repo] = repoFullName.split('/')
    loadingFactors.value = true
    try {
      const result = await window.electronAPI.factor.getRepoFactors(owner, repo)
      if (result.code === 200) {
        // 因子数据在 data.factors 里面
        factors.value = result.data?.factors || []
      }
    } catch (error: any) {
      console.error('加载因子列表失败:', error)
      ElMessage.error('加载因子列表失败: ' + error.message)
    } finally {
      loadingFactors.value = false
    }
  }
}

// 因子选择变化
const handleFactorChange = (factorCode: string) => {
  selectedFactor.value = factors.value.find(f => f.code === factorCode) || null
}

// 进入步骤2
const goToStep2 = () => {
  if (!canGoToStep2.value) {
    ElMessage.warning('请先选择仓库和因子')
    return
  }
  currentStep.value = 1
}

// 进入步骤3
const goToStep3 = () => {
  if (!submitForm.calcDate) {
    ElMessage.warning('请选择计算日期')
    return
  }
  currentStep.value = 2
}

// 提交执行
const handleSubmit = async () => {
  submitting.value = true
  submitStatus.value = 'idle'
  
  try {
    const [owner, repo] = submitForm.repoFullName.split('/')
    
    // 构建执行参数
    const params = {
      repo_owner: owner,
      repo_name: repo,
      branch: submitForm.branch || 'main',
      factor_code: submitForm.factorCode,
      factor_file: selectedFactor.value?.file || '',
      factor_func: selectedFactor.value?.function || 'calculate',
      calc_date: submitForm.calcDate
    }
    
    console.log('提交任务参数:', params)
    
    // 调用创建任务API
    const result = await window.electronAPI.factor.createJob(params)
    
    if (result.code === 200) {
      submitResult.value = result.data
      submitStatus.value = 'success'
      ElMessage.success('因子任务提交成功！')
    } else {
      throw new Error('提交失败')
    }
  } catch (error: any) {
    console.error('提交失败:', error)
    submitError.value = error.message || '提交失败'
    submitStatus.value = 'error'
    ElMessage.error('提交失败: ' + error.message)
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  currentStep.value = 0
  submitStatus.value = 'idle'
  submitResult.value = null
  submitError.value = ''
  
  submitForm.repoFullName = ''
  submitForm.factorCode = ''
  submitForm.branch = 'main'
  submitForm.calcDate = ''
  selectedFactor.value = null
  factors.value = []
}

// 重置并继续提交
const resetAndNewSubmit = () => {
  resetForm()
}

// 跳转到管理页面
const goToManage = () => {
  router.push('/factor-library/manage')
}

onMounted(() => {
  loadRepos()
})
</script>

<style scoped lang="scss">
.factor-submit-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .steps-container {
    background: white;
    padding: 30px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .step-card {
    margin-top: 20px;
    
    .card-header {
      font-weight: 500;
      font-size: 16px;
    }
  }

  .select-factor-section {
    .repo-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;

      .repo-count {
        font-size: 12px;
        color: #909399;
      }
    }

    .factor-option {
      display: flex;
      gap: 12px;
      align-items: center;

      .factor-code {
        font-family: monospace;
        font-weight: 600;
        color: #303133;
      }

      .factor-name {
        font-size: 13px;
        color: #606266;
      }
    }

    .form-tip {
      margin-top: 8px;
    }

    .factor-preview {
      margin-top: 20px;
      padding: 20px;
      background: #f5f7fa;
      border-radius: 8px;
    }
  }

  .config-section {
    .form-tip {
      margin-top: 8px;
    }
  }

  .submit-section {
    .final-review {
      margin: 20px 0;
    }

    .submit-result {
      margin-top: 20px;
    }
  }

  .step-actions {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e4e7ed;
  }
}
</style>
