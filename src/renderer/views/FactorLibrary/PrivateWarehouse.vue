<template>
  <div class="private-warehouse">
    <!-- 加载中 -->
    <div v-if="pageLoading" class="loading-wrap">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <!-- 未初始化：引导页 -->
    <div v-else-if="!isInitialized" class="init-container">
      <div class="init-card">
        <div class="init-icon">
          <el-icon :size="80"><Coin /></el-icon>
        </div>
        <h2>创建您的私有数据仓库</h2>
        <p class="init-desc">
          在 ClickHouse 中为您创建独立的专属库，<br>
          用于存放您自己计算的因子中间值。
        </p>
        <div class="init-info" v-if="dbStatus">
          <el-tag type="warning">{{ dbStatus.database }}</el-tag>
        </div>
        <el-button type="primary" size="large" :loading="initLoading" @click="handleInit">
          <el-icon><Plus /></el-icon>
          初始化专属库
        </el-button>
      </div>
    </div>

    <!-- 已初始化 -->
    <div v-else class="ready-container">
      <el-result icon="success" title="私有数据仓库已就绪">
        <template #sub-title>
          <p>专属库：<el-tag type="success">{{ dbStatus?.database }}</el-tag></p>
        </template>
        <template #extra>
          <span style="color:#909399">建表与数据写入功能即将上线</span>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin, Plus, Loading } from '@element-plus/icons-vue'

interface CHLibStatus {
  initialized: boolean
  database: string
  factor_user?: string
}

const pageLoading = ref(true)
const initLoading = ref(false)
const isInitialized = ref(false)
const dbStatus = ref<CHLibStatus | null>(null)

const checkStatus = async () => {
  pageLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHStatus()
    if (result.success && result.data) {
      dbStatus.value = result.data
      isInitialized.value = result.data.initialized
    } else {
      ElMessage.error(result.error || '检查专属库状态失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '检查专属库状态失败')
  } finally {
    pageLoading.value = false
  }
}

const handleInit = async () => {
  initLoading.value = true
  try {
    const result = await window.electronAPI.factor.myCHInit()
    if (result.success) {
      ElMessage.success(result.message || '初始化成功')
      await checkStatus()   // 刷新状态 → 变为已就绪
    } else {
      ElMessage.error(result.error || '初始化失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '初始化失败')
  } finally {
    initLoading.value = false
  }
}

onMounted(checkStatus)
</script>

<style scoped>
.private-warehouse { padding: 24px; }
.loading-wrap, .init-container { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.init-card { text-align: center; max-width: 480px; }
.init-icon { color: #67C23A; margin-bottom: 16px; }
.init-desc { color: #606266; line-height: 1.8; margin: 12px 0 20px; }
.init-info { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
.ready-container { padding-top: 40px; }
</style>
