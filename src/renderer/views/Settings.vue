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
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened } from '@element-plus/icons-vue'

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
