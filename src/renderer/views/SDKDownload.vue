<template>
  <div class="sdk-download-container">
    <el-card class="header-card" shadow="never">
      <div class="page-header">
        <h2>SDK 下载中心</h2>
        <p class="subtitle">下载最新的交易系统开发SDK，快速接入数据服务</p>
      </div>
    </el-card>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- SDK列表 -->
    <div v-else class="sdk-list">
      <el-row :gutter="20">
        <el-col 
          v-for="sdk in sdkList" 
          :key="sdk.type"
          :xs="24" 
          :sm="24" 
          :md="12" 
          :lg="12"
        >
          <el-card class="sdk-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <div class="sdk-title">
                  <el-icon :size="24" color="#409EFF"><Box /></el-icon>
                  <span class="sdk-name">{{ sdk.name }}</span>
                  <el-tag size="small" type="success">v{{ sdk.version }}</el-tag>
                </div>
              </div>
            </template>

            <div class="sdk-content">
              <p class="sdk-description">{{ sdk.description }}</p>

              <div class="sdk-meta">
                <div class="meta-item">
                  <el-icon><Document /></el-icon>
                  <span>大小: {{ formatFileSize(sdk.size) }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  <span>更新: {{ formatDate(sdk.release_date) }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Lock /></el-icon>
                  <span>MD5: {{ sdk.md5.substring(0, 8) }}...</span>
                </div>
              </div>

              <!-- 下载进度条 -->
              <div v-if="downloadingStatus[sdk.type]" class="download-progress">
                <el-progress 
                  :percentage="downloadProgress[sdk.type] || 0" 
                  :status="downloadProgress[sdk.type] === 100 ? 'success' : undefined"
                >
                  <template #default="{ percentage }">
                    <span class="progress-text">{{ percentage }}%</span>
                  </template>
                </el-progress>
              </div>

              <!-- 操作按钮 -->
              <div class="sdk-actions">
                <el-button 
                  type="primary" 
                  :loading="downloadingStatus[sdk.type]"
                  :disabled="downloadingStatus[sdk.type]"
                  @click="handleDownload(sdk)"
                >
                  <el-icon><Download /></el-icon>
                  <span v-if="downloadingStatus[sdk.type]">
                    下载中 {{ downloadProgress[sdk.type] }}%
                  </span>
                  <span v-else>下载 SDK</span>
                </el-button>

                <el-button 
                  v-if="sdk.doc_url" 
                  @click="openDoc(sdk.doc_url)"
                >
                  <el-icon><Reading /></el-icon>
                  查看文档
                </el-button>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 空状态 -->
      <el-empty 
        v-if="!loading && sdkList.length === 0" 
        description="暂无可用SDK"
      />
    </div>

    <!-- 最后更新时间 -->
    <div v-if="updateTime && sdkList.length > 0" class="update-info">
      <el-text type="info" size="small">
        最后更新时间: {{ formatDateTime(updateTime) }}
      </el-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Download, 
  Box, 
  Document, 
  Calendar, 
  Lock, 
  Reading 
} from '@element-plus/icons-vue'

interface SDK {
  type: string
  name: string
  version: string
  release_date: string
  description: string
  filename: string
  download_url: string
  size: number
  md5: string
  doc_url?: string
}

const API_BASE = 'http://61.151.241.233:8080'

const loading = ref(false)
const sdkList = ref<SDK[]>([])
const updateTime = ref('')
const downloadingStatus = ref<Record<string, boolean>>({})
const downloadProgress = ref<Record<string, number>>({})

// 加载SDK列表
const loadSDKList = async () => {
  loading.value = true
  try {
    console.log('[SDK] 开始加载SDK列表...')
    
    // 获取API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      ElMessage.warning('请先配置API Key')
      loading.value = false
      return
    }
    
    const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    
    if (!fullKey) {
      ElMessage.error('获取API Key失败')
      loading.value = false
      return
    }
    
    const response = await fetch(`${API_BASE}/api/v1/sdk/versions`, {
      headers: {
        'X-API-Key': fullKey
      },
      mode: 'cors'
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()

    console.log('[SDK] 响应数据:', data)

    if (data.code === 200) {
      sdkList.value = data.data.sdks
      updateTime.value = data.data.update_time
      ElMessage.success(`成功加载 ${data.data.sdks.length} 个SDK`)
      console.log('[SDK] 加载成功，数量:', data.data.sdks.length)
    } else {
      ElMessage.error('加载SDK列表失败: ' + data.message)
      console.error('[SDK] 加载失败:', data.message)
    }
  } catch (error: any) {
    ElMessage.error('网络错误: ' + error.message)
    console.error('[SDK] 网络错误:', error)
  } finally {
    loading.value = false
  }
}

// 下载SDK
const handleDownload = async (sdk: SDK) => {
  try {
    console.log('[SDK] 开始下载:', sdk.name)
    
    // 1. 显示保存对话框
    const result = await window.electronAPI.dialog.showSaveDialog({
      title: `保存 ${sdk.name}`,
      defaultPath: sdk.filename,
      filters: [
        { name: 'SDK压缩包', extensions: ['tar.gz', 'gz', 'zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      console.log('[SDK] 用户取消下载')
      return
    }

    const savePath = result.filePath
    console.log('[SDK] 保存路径:', savePath)

    // 2. 开始下载
    downloadingStatus.value[sdk.type] = true
    downloadProgress.value[sdk.type] = 0

    ElMessage.info(`开始下载 ${sdk.name}...`)

    // 使用现有的shell.downloadFile功能
    await window.electronAPI.shell.downloadFile(
      sdk.download_url,
      savePath,
      (percent: number) => {
        downloadProgress.value[sdk.type] = Math.floor(percent)
        console.log(`[SDK] 下载进度: ${percent}%`)
      }
    )

    // 3. 下载完成，计算MD5
    console.log('[SDK] 下载完成，开始MD5校验...')
    const fileMD5 = await window.electronAPI.shell.calculateMD5(savePath)
    console.log('[SDK] 文件MD5:', fileMD5)
    console.log('[SDK] 预期MD5:', sdk.md5)

    // 4. 验证MD5
    if (fileMD5.toLowerCase() === sdk.md5.toLowerCase()) {
      ElMessageBox.confirm(
        `${sdk.name} 下载成功！\n\n文件已保存到:\n${savePath}\n\nMD5校验通过 ✓`,
        '下载成功',
        {
          confirmButtonText: '打开文件夹',
          cancelButtonText: '关闭',
          type: 'success',
        }
      ).then(() => {
        // 打开文件所在文件夹
        window.electronAPI.shell.showItemInFolder(savePath)
      }).catch(() => {
        // 用户点击关闭
      })
    } else {
      ElMessageBox.alert(
        `文件已下载，但MD5校验失败！\n\n期望: ${sdk.md5}\n实际: ${fileMD5}\n\n文件可能已损坏，建议重新下载。`,
        'MD5校验失败',
        {
          type: 'warning',
          confirmButtonText: '知道了'
        }
      )
    }

  } catch (error: any) {
    console.error('[SDK] 下载失败:', error)
    ElMessage.error(`下载失败: ${error.message}`)
  } finally {
    downloadingStatus.value[sdk.type] = false
    downloadProgress.value[sdk.type] = 0
  }
}

// 打开文档
const openDoc = (url: string) => {
  if (url) {
    window.open(url, '_blank')
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

// 格式化日期（简短格式）
const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 格式化日期时间（完整格式）
const formatDateTime = (isoDate: string): string => {
  const date = new Date(isoDate)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(() => {
  console.log('[SDK] 组件已挂载，开始加载SDK列表')
  loadSDKList()
})
</script>

<style lang="scss" scoped>
.sdk-download-container {
  .header-card {
    margin-bottom: 20px;
    
    .page-header {
      h2 {
        margin: 0 0 10px 0;
        font-size: 24px;
        color: #303133;
      }
      
      .subtitle {
        margin: 0;
        color: #909399;
        font-size: 14px;
      }
    }
  }

  .loading-container {
    padding: 40px;
  }

  .sdk-list {
    .sdk-card {
      margin-bottom: 20px;
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-2px);
      }

      .card-header {
        .sdk-title {
          display: flex;
          align-items: center;
          gap: 10px;
          
          .sdk-name {
            font-size: 18px;
            font-weight: 600;
            color: #303133;
            flex: 1;
          }
        }
      }

      .sdk-content {
        .sdk-description {
          color: #606266;
          line-height: 1.6;
          margin-bottom: 15px;
          min-height: 48px;
        }

        .sdk-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 15px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 4px;

          .meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #606266;

            .el-icon {
              color: #909399;
            }
          }
        }

        .download-progress {
          margin-bottom: 15px;
          
          .progress-text {
            font-size: 12px;
            color: #409EFF;
          }
        }

        .sdk-actions {
          display: flex;
          gap: 10px;
          
          .el-button {
            flex: 1;
          }
        }
      }
    }
  }

  .update-info {
    text-align: center;
    margin-top: 20px;
    padding: 10px;
  }
}
</style>

