<template>
  <div class="download-page">
    <!-- 查询表单 -->
    <el-card class="query-card">
      <template #header>
        <div class="card-header">
          <span>数据查询条件</span>
          <el-button type="primary" @click="handleDownload" :loading="downloading">
            <el-icon><Download /></el-icon>
            开始下载
          </el-button>
        </div>
      </template>
      
      <el-form
        ref="formRef"
        :model="queryForm"
        :rules="rules"
        label-width="120px"
        class="query-form"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="消息类型" prop="messageType">
              <el-select
                v-model="queryForm.messageType"
                placeholder="请选择消息类型"
                filterable
                @change="handleMessageTypeChange"
              >
                <el-option-group
                  v-for="group in messageGroups"
                  :key="group.label"
                  :label="group.label"
                >
                  <el-option
                    v-for="item in group.options"
                    :key="item.code"
                    :label="`[${item.code}] ${item.name}`"
                    :value="item.code"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="日期范围" prop="dateRange">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                format="YYYY-MM-DD"
                value-format="YYYYMMDD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :disabled-date="disabledDate"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="股票代码">
              <el-select
                v-model="queryForm.symbols"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="可选，留空下载全部"
                class="symbol-select"
              >
                <el-option
                  v-for="item in popularSymbols"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
              <div class="form-tip">
                输入格式：SZ.000001、SH.600000等，支持批量输入
              </div>
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="导出格式" prop="exportFormat">
              <el-radio-group v-model="queryForm.exportFormat">
                <el-radio-button value="csv">CSV</el-radio-button>
                <el-radio-button value="json">JSON</el-radio-button>
              </el-radio-group>
              <div class="form-tip">
                CSV格式适合Excel打开，JSON格式适合程序处理
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="保存位置" prop="savePath">
              <el-input
                v-model="queryForm.savePath"
                placeholder="选择文件保存位置"
                readonly
              >
                <template #append>
                  <el-button @click="selectSavePath">
                    <el-icon><FolderOpened /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="API Key" prop="apiKey">
              <el-select
                v-model="queryForm.apiKey"
                placeholder="请选择API Key"
              >
                <el-option
                  v-for="key in apiKeys"
                  :key="key.id"
                  :label="`${key.name} ${key.isDefault ? '(默认)' : ''}`"
                  :value="key.id"
                />
              </el-select>
              <el-button
                link
                type="primary"
                @click="goToSettings"
                v-if="apiKeys.length === 0"
              >
                配置API Key
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
    
    <!-- 当前下载任务 -->
    <el-card class="task-card" v-if="currentTask">
      <template #header>
        <div class="card-header">
          <span>当前下载任务</span>
          <el-button-group>
            <el-button
              v-if="currentTask.status === 'downloading'"
              @click="pauseDownload"
              :icon="VideoPause"
              size="small"
            >
              暂停
            </el-button>
            <el-button
              v-else-if="currentTask.status === 'paused'"
              @click="resumeDownload"
              :icon="VideoPlay"
              size="small"
            >
              继续
            </el-button>
            <el-button
              @click="cancelDownload"
              :icon="Close"
              size="small"
              type="danger"
            >
              取消
            </el-button>
          </el-button-group>
        </div>
      </template>
      
      <div class="task-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务ID">
            {{ currentTask.id }}
          </el-descriptions-item>
          <el-descriptions-item label="消息类型">
            {{ currentTask.messageType }}
          </el-descriptions-item>
          <el-descriptions-item label="日期范围">
            {{ currentTask.startDate }} - {{ currentTask.endDate }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentTask.status)">
              {{ getStatusText(currentTask.status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="progress-section">
          <div class="progress-info">
            <span>下载进度</span>
            <span>{{ currentTask.downloadedRecords }} / {{ currentTask.totalRecords }} 条记录</span>
          </div>
          <el-progress
            :percentage="currentTask.progress"
            :status="currentTask.status === 'completed' ? 'success' : undefined"
            :stroke-width="20"
            text-inside
          />
        </div>
        
        <div class="task-actions" v-if="currentTask.status === 'completed'">
          <el-button
            type="primary"
            @click="openFile"
            :icon="FolderOpened"
          >
            打开文件位置
          </el-button>
          <el-button
            @click="clearCurrentTask"
            :icon="Delete"
          >
            清除任务
          </el-button>
        </div>
      </div>
    </el-card>
    
    <!-- 快捷操作 -->
    <el-card class="shortcuts-card">
      <template #header>
        <span>快捷下载</span>
      </template>
      
      <div class="shortcuts-grid">
        <el-button
          v-for="shortcut in shortcuts"
          :key="shortcut.id"
          @click="applyShortcut(shortcut)"
          class="shortcut-btn"
        >
          <div>
            <el-icon :size="24"><component :is="shortcut.icon" /></el-icon>
            <div>{{ shortcut.name }}</div>
            <div class="shortcut-desc">{{ shortcut.desc }}</div>
          </div>
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import {
  Download,
  FolderOpened,
  Delete,
  Close,
  VideoPause,
  VideoPlay,
  TrendCharts,
  Coin,
  DataLine,
  Connection
} from '@element-plus/icons-vue'
import { MESSAGE_TYPES } from '../api/constants'

const router = useRouter()
const formRef = ref<FormInstance>()
const downloading = ref(false)
const currentTask = ref<any>(null)
const apiKeys = ref<any[]>([])

const queryForm = reactive({
  messageType: '',
  dateRange: [] as string[],
  symbols: [] as string[],
  exportFormat: 'csv',
  savePath: '',
  apiKey: ''
})

const rules: FormRules = {
  messageType: [
    { required: true, message: '请选择消息类型', trigger: 'change' }
  ],
  dateRange: [
    { required: true, message: '请选择日期范围', trigger: 'change' }
  ],
  exportFormat: [
    { required: true, message: '请选择导出格式', trigger: 'change' }
  ],
  savePath: [
    { required: true, message: '请选择保存位置', trigger: 'change' }
  ],
  apiKey: [
    { required: true, message: '请选择API Key', trigger: 'change' }
  ]
}

// 消息类型分组
const messageGroups = [
  {
    label: '深圳市场（14个）',
    options: Object.entries(MESSAGE_TYPES.SZ).map(([code, name]) => ({ code, name }))
  },
  {
    label: '上海市场（9个）',
    options: Object.entries(MESSAGE_TYPES.SH).map(([code, name]) => ({ code, name }))
  },
  {
    label: '期货市场（13个）',
    options: Object.entries(MESSAGE_TYPES.FUTURES).map(([code, name]) => ({ code, name }))
  },
  {
    label: '期权市场（13个）',
    options: Object.entries(MESSAGE_TYPES.OPTIONS).map(([code, name]) => ({ code, name }))
  },
  {
    label: '陆港通市场（4个）',
    options: Object.entries(MESSAGE_TYPES.HK).map(([code, name]) => ({ code, name }))
  }
]

// 热门股票代码
const popularSymbols = [
  'SZ.000001', 'SZ.000002', 'SZ.000333', 'SZ.000858', 'SZ.002415',
  'SH.600000', 'SH.600036', 'SH.600519', 'SH.601318', 'SH.603288'
]

// 快捷操作
const shortcuts = [
  {
    id: 1,
    name: '今日行情',
    desc: '下载今日全市场数据',
    icon: TrendCharts,
    action: () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      queryForm.dateRange = [today, today]
      queryForm.messageType = 'ZZ-01'
    }
  },
  {
    id: 2,
    name: '本月数据',
    desc: '下载本月深市股票数据',
    icon: DataLine,
    action: () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      queryForm.dateRange = [
        firstDay.toISOString().slice(0, 10).replace(/-/g, ''),
        lastDay.toISOString().slice(0, 10).replace(/-/g, '')
      ]
      queryForm.messageType = 'ZZ-01'
    }
  },
  {
    id: 3,
    name: '期货快照',
    desc: '下载期货市场快照数据',
    icon: Coin,
    action: () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      queryForm.dateRange = [today, today]
      queryForm.messageType = 'ZZ-61'
    }
  },
  {
    id: 4,
    name: '港股通额度',
    desc: '下载港股通实时额度',
    icon: Connection,
    action: () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      queryForm.dateRange = [today, today]
      queryForm.messageType = 'ZZ-105'
    }
  }
]

// 禁用未来日期
const disabledDate = (date: Date) => {
  return date.getTime() > Date.now()
}

// 处理消息类型变化
const handleMessageTypeChange = (value: string) => {
  // 根据消息类型自动调整其他参数
  console.log('Message type changed:', value)
}

// 选择保存路径
const selectSavePath = async () => {
  const path = await window.electronAPI.dialog.selectDirectory()
  if (path) {
    queryForm.savePath = path
  }
}

// 开始下载
const handleDownload = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    downloading.value = true
    try {
      // 获取真实的API Key
      const selectedKey = apiKeys.value.find(k => k.id === queryForm.apiKey)
      if (!selectedKey) {
        ElMessage.error('请选择有效的API Key')
        return
      }
      
      // 获取完整的API Key（这里需要特殊处理）
      console.log('获取API Key，ID:', selectedKey.id)
      const fullApiKey = await getFullApiKey(selectedKey.id)
      
      if (!fullApiKey) {
        ElMessage.error('无法获取API Key，请重新配置')
        return
      }
      
      console.log('获取到的API Key长度:', fullApiKey.length)
      console.log('API Key前20位:', fullApiKey.substring(0, 20) + '...')
      
      // 创建普通对象，避免传递响应式对象
      const params = {
        apiKey: fullApiKey,
        messageType: String(queryForm.messageType),
        symbols: queryForm.symbols.length > 0 ? [...queryForm.symbols] : undefined,
        startDate: String(queryForm.dateRange[0]),
        endDate: String(queryForm.dateRange[1]),
        format: String(queryForm.exportFormat),
        savePath: String(queryForm.savePath)
      }
      
      console.log('下载参数（不含API Key）:', {
        ...params,
        apiKey: '***已隐藏***'
      })
      const taskId = await window.electronAPI.download.start(params)
      
      // 监听下载进度
      startProgressMonitoring(taskId)
      
      ElMessage.success('下载任务已创建')
    } catch (error: any) {
      ElMessage.error(error.message || '创建下载任务失败')
    } finally {
      downloading.value = false
    }
  })
}

// 获取完整的API Key
const getFullApiKey = async (keyId: string): Promise<string> => {
  const apiKey = await window.electronAPI.config.getFullApiKey(keyId)
  return apiKey || ''
}

// 监控下载进度
const startProgressMonitoring = (taskId: string) => {
  const interval = setInterval(async () => {
    const task = await window.electronAPI.download.getProgress(taskId)
    if (task) {
      currentTask.value = task
      
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        clearInterval(interval)
        
        if (task.status === 'completed') {
          ElMessage.success('下载完成')
        } else if (task.status === 'failed') {
          ElMessage.error(task.error || '下载失败')
        }
      }
    }
  }, 500)
}

// 暂停下载
const pauseDownload = async () => {
  if (currentTask.value) {
    await window.electronAPI.download.pause(currentTask.value.id)
  }
}

// 恢复下载
const resumeDownload = async () => {
  if (currentTask.value) {
    await window.electronAPI.download.resume(currentTask.value.id)
  }
}

// 取消下载
const cancelDownload = async () => {
  if (currentTask.value) {
    await ElMessageBox.confirm('确定要取消当前下载任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await window.electronAPI.download.cancel(currentTask.value.id)
    currentTask.value = null
  }
}

// 打开文件位置
const openFile = async () => {
  if (currentTask.value?.savePath) {
    await window.electronAPI.shell.showItemInFolder(currentTask.value.savePath)
  }
}

// 清除当前任务
const clearCurrentTask = () => {
  currentTask.value = null
}

// 应用快捷操作
const applyShortcut = (shortcut: any) => {
  shortcut.action()
  ElMessage.success(`已应用快捷操作：${shortcut.name}`)
}

// 获取状态类型
const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'info',
    downloading: '',
    paused: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings')
}

// 加载API Keys
const loadApiKeys = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    apiKeys.value = keys
    
    // 自动选择默认Key
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      queryForm.apiKey = defaultKey.id
    }
  } catch (error) {
    console.error('加载API Keys失败:', error)
  }
}

// 加载默认下载路径
const loadDefaultPath = async () => {
  const config = await window.electronAPI.config.get('appConfig')
  if (config?.downloadDir) {
    queryForm.savePath = config.downloadDir
  }
}

onMounted(() => {
  loadApiKeys()
  loadDefaultPath()
})
</script>

<style lang="scss" scoped>
.download-page {
  .query-card {
    margin-bottom: 20px;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .query-form {
      .form-tip {
        font-size: 12px;
        color: #909399;
        margin-top: 5px;
      }
      
      .symbol-select {
        width: 100%;
      }
    }
  }
  
  .task-card {
    margin-bottom: 20px;
    
    .task-info {
      .progress-section {
        margin: 20px 0;
        
        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
          color: #606266;
        }
      }
      
      .task-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
    }
  }
  
  .shortcuts-card {
    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
      
      .shortcut-btn {
        height: 100px;
        width: 100%;
        
        > div {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          
          .shortcut-desc {
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }
  }
}
</style>
