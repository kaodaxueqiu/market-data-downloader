<template>
  <div class="settings-page">
    <!-- API Key配置 -->
    <el-card class="settings-card">
      <template #header>
        <span>API Key 配置</span>
      </template>
      
      <el-form :model="apiKeyConfig" label-width="120px">
        <el-form-item label="API Key">
          <el-input
            v-model="apiKeyConfig.apiKey"
            placeholder="请输入您的API Key（用于身份验证和行为管理）"
            show-password
            clearable
          >
            <template #append>
              <el-button @click="saveApiKey" type="primary">
                保存
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="当前状态">
          <el-tag v-if="apiKeyConfig.apiKey" type="success">已配置</el-tag>
          <el-tag v-else type="warning">未配置</el-tag>
          <span v-if="apiKeyConfig.apiKey" style="margin-left: 10px; color: #909399">
            Key前缀：{{ apiKeyConfig.apiKey.substring(0, 10) }}...
          </span>
        </el-form-item>
        <div style="color: #909399; font-size: 12px; margin: 10px 0 0 120px">
          提示：API Key用于身份识别和权限验证，请妥善保管，不要泄露给他人
        </div>
      </el-form>
    </el-card>
    
    <!-- 下载设置 -->
    <el-card class="settings-card">
      <template #header>
        <span>下载设置</span>
      </template>
      
      <el-form :model="appConfig" label-width="120px">
        <el-form-item label="下载目录">
          <el-input
            v-model="appConfig.downloadDir"
            placeholder="选择默认下载目录"
            readonly
          >
            <template #append>
              <el-button @click="selectDownloadDir" :icon="FolderOpened">
                选择
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="最大并发数">
          <el-input-number
            v-model="appConfig.maxConcurrent"
            :min="1"
            :max="10"
            @change="saveConfig"
          />
        </el-form-item>
        
        <el-form-item label="自动重试">
          <el-switch
            v-model="appConfig.autoRetry"
            @change="saveConfig"
          />
        </el-form-item>
        
        <el-form-item label="重试次数" v-if="appConfig.autoRetry">
          <el-input-number
            v-model="appConfig.retryTimes"
            :min="1"
            :max="5"
            @change="saveConfig"
          />
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 界面设置 -->
    <el-card class="settings-card">
      <template #header>
        <span>界面设置</span>
      </template>
      
      <el-form :model="appConfig" label-width="120px">
        <el-form-item label="主题">
          <el-radio-group v-model="appConfig.theme" @change="saveConfig">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">深色</el-radio>
            <el-radio value="auto">跟随系统</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="语言">
          <el-select v-model="appConfig.language" @change="saveConfig">
            <el-option label="简体中文" value="zh_CN" />
            <el-option label="English" value="en_US" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 关于和更新 -->
    <el-card class="settings-card">
      <template #header>
        <span>关于和更新</span>
      </template>
      
      <el-form label-width="120px">
        <el-form-item label="当前版本">
          <el-tag type="primary" size="large">v1.3.3</el-tag>
        </el-form-item>
        
        <el-form-item label="检查更新">
          <el-button 
            type="primary" 
            @click="checkForUpdates" 
            :loading="checking"
            :disabled="downloading"
          >
            <el-icon><Refresh /></el-icon>
            检查更新
          </el-button>
          <span v-if="updateInfo" style="margin-left: 15px; color: #67c23a">
            发现新版本：v{{ updateInfo.version }}
          </span>
        </el-form-item>
        
        <el-form-item label="更新进度" v-if="downloading">
          <el-progress 
            :percentage="downloadProgress" 
            :status="downloadProgress === 100 ? 'success' : undefined"
          />
          <div style="margin-top: 5px; font-size: 12px; color: #909399">
            {{ downloadProgress }}% - {{ downloadStatus }}
          </div>
        </el-form-item>
        
        <el-form-item label="" v-if="updateReady">
          <el-alert
            title="更新已就绪"
            type="success"
            :closable="false"
            show-icon
          >
            <template #default>
              <div style="margin-top: 10px">
                <el-button type="success" @click="installUpdate">
                  <el-icon><Check /></el-icon>
                  立即重启并更新
                </el-button>
              </div>
            </template>
          </el-alert>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Refresh, Check } from '@element-plus/icons-vue'

// API Key配置（单一Key）
const apiKeyConfig = reactive({
  apiKey: ''
})

const appConfig = reactive({
  downloadDir: '',
  maxConcurrent: 3,
  autoRetry: true,
  retryTimes: 3,
  theme: 'light' as 'light' | 'dark' | 'auto',
  language: 'zh_CN'
})

// 更新相关状态
const checking = ref(false)
const downloading = ref(false)
const downloadProgress = ref(0)
const downloadStatus = ref('')
const updateInfo = ref<any>(null)
const updateReady = ref(false)

// 保存API Key
const saveApiKey = async () => {
  if (!apiKeyConfig.apiKey) {
    ElMessage.error('请输入API Key')
    return
  }
  
  try {
    // 保存为默认且唯一的Key
    await window.electronAPI.config.saveApiKey(
      apiKeyConfig.apiKey,
      '默认',
      true
    )
    
    ElMessage.success('API Key 保存成功')
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

const selectDownloadDir = async () => {
  const dir = await window.electronAPI.dialog.selectDirectory()
  if (dir) {
    appConfig.downloadDir = dir
    saveConfig()
  }
}

const saveConfig = async () => {
  try {
    // 将响应式对象转换为普通对象
    const plainConfig = {
      downloadDir: appConfig.downloadDir,
      maxConcurrent: appConfig.maxConcurrent,
      autoRetry: appConfig.autoRetry,
      retryTimes: appConfig.retryTimes,
      theme: appConfig.theme,
      language: appConfig.language
    }
    
    console.log('开始保存配置:', plainConfig)
    const result = await window.electronAPI.config.set('appConfig', plainConfig)
    console.log('保存结果:', result)
    ElMessage.success('设置已保存')
  } catch (error: any) {
    console.error('保存配置失败:', error)
    ElMessage.error(`保存失败: ${error?.message || error}`)
  }
}

// 加载当前API Key
const loadApiKey = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    // 获取默认（唯一）的Key
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      // 获取完整的Key用于显示
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        apiKeyConfig.apiKey = fullKey
      }
    }
  } catch (error) {
    console.error('加载API Key失败:', error)
  }
}

const loadConfig = async () => {
  try {
    console.log('开始加载配置...')
    const config = await window.electronAPI.config.get('appConfig')
    console.log('加载的配置:', config)
    if (config) {
      Object.assign(appConfig, config)
      console.log('配置已应用到界面:', appConfig)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

// 检查更新
const checkForUpdates = async () => {
  checking.value = true
  updateInfo.value = null
  
  try {
    const result = await window.electronAPI.updater.checkForUpdates()
    
    if (result.updateAvailable) {
      updateInfo.value = result
      
      // 询问是否下载
      ElMessageBox.confirm(
        `发现新版本 v${result.version}，是否立即下载？`,
        '更新提示',
        {
          confirmButtonText: '立即下载',
          cancelButtonText: '稍后再说',
          type: 'info'
        }
      ).then(() => {
        downloadUpdate()
      }).catch(() => {
        ElMessage.info('已取消更新')
      })
    } else {
      ElMessage.success('当前已是最新版本')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '检查更新失败，请检查网络连接')
  } finally {
    checking.value = false
  }
}

// 下载更新
const downloadUpdate = async () => {
  downloading.value = true
  downloadProgress.value = 0
  downloadStatus.value = '正在下载...'
  
  try {
    await window.electronAPI.updater.downloadUpdate()
  } catch (error: any) {
    ElMessage.error(error.message || '下载更新失败')
    downloading.value = false
  }
}

// 安装更新
const installUpdate = () => {
  window.electronAPI.updater.quitAndInstall()
}

// 监听更新事件
const setupUpdateListeners = () => {
  window.electronAPI.on('updater:download-progress', (progress: any) => {
    downloadProgress.value = Math.floor(progress.percent)
    downloadStatus.value = `已下载 ${(progress.transferred / 1024 / 1024).toFixed(2)} MB / ${(progress.total / 1024 / 1024).toFixed(2)} MB`
  })
  
  window.electronAPI.on('updater:update-downloaded', () => {
    downloading.value = false
    updateReady.value = true
    downloadStatus.value = '下载完成'
    ElMessage.success('更新下载完成，可以安装了')
  })
  
  window.electronAPI.on('updater:error', (error: string) => {
    downloading.value = false
    ElMessage.error(`更新失败: ${error}`)
  })
}

onMounted(() => {
  console.log('Settings组件已挂载')
  console.log('window.electronAPI:', window.electronAPI)
  
  if (!window.electronAPI) {
    console.error('electronAPI未定义！')
    ElMessage.error('系统初始化失败，请重启应用')
    return
  }
  
  loadApiKey()  // 加载单一API Key
  loadConfig()
  setupUpdateListeners()
})

onUnmounted(() => {
  // 清理事件监听
  window.electronAPI.off('updater:download-progress', () => {})
  window.electronAPI.off('updater:update-downloaded', () => {})
  window.electronAPI.off('updater:error', () => {})
})
</script>

<style lang="scss" scoped>
.settings-page {
  .settings-card {
    margin-bottom: 20px;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .api-key-text {
      font-family: monospace;
      color: #909399;
    }
  }
}
</style>
