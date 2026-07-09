<template>
  <div class="engine-config-page">
    <!-- 三级 tab 导航（子路由驱动，按权限显示） -->
    <div class="nav-tabs">
      <button
        v-if="hasPermission('cache_management')"
        class="nav-tab"
        :class="{ active: activeTab === 'cache' }"
        @click="switchTab('cache')"
      >
        <el-icon><Coin /></el-icon>
        <span>数据缓存管理</span>
      </button>
      <button
        v-if="hasPermission('factor_dict_sync')"
        class="nav-tab"
        :class="{ active: activeTab === 'dict-sync' }"
        @click="switchTab('dict-sync')"
      >
        <el-icon><Refresh /></el-icon>
        <span>因子字典同步</span>
      </button>
    </div>

    <!-- tab 内容 -->
    <div class="page-content">
      <CacheManagerMain v-if="activeTab === 'cache'" />

      <div v-else-if="activeTab === 'dict-sync'" class="dict-sync-panel">
        <div class="dict-sync-desc">
          从回测引擎拉取最新算子清单并更新因子字典。同步后可在因子表达式中使用最新算子。
        </div>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="syncing"
          @click="handleSync"
        >
          同步最新因子字典
        </el-button>
        <div v-if="lastSyncResult" class="dict-sync-result">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="同步数量">{{ lastSyncResult.synced_count }}</el-descriptions-item>
            <el-descriptions-item label="数据来源">{{ lastSyncResult.source }}</el-descriptions-item>
            <el-descriptions-item label="结果">{{ lastSyncResult.message }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Coin, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import CacheManagerMain from '../CacheManager/Main.vue'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'cache' | 'dict-sync'>('cache')

// 菜单权限（从 App.vue 注入）
const menuPermissions = inject<{ value: string[] }>('menuPermissions', { value: [] })
const hasPermission = (menuId: string): boolean => {
  const permissions = menuPermissions.value || []
  if (permissions.length === 0) return true
  return permissions.includes(menuId)
}

const availableTabs = computed(() => {
  const tabs: string[] = []
  if (hasPermission('cache_management')) tabs.push('cache')
  if (hasPermission('factor_dict_sync')) tabs.push('dict-sync')
  return tabs
})

// 根据路由设置 tab
const setTabFromRoute = () => {
  if (route.path.includes('/engine-config/dict-sync') && hasPermission('factor_dict_sync')) {
    activeTab.value = 'dict-sync'
  } else if (route.path.includes('/engine-config/cache') && hasPermission('cache_management')) {
    activeTab.value = 'cache'
  } else if (availableTabs.value.length > 0) {
    activeTab.value = availableTabs.value[0] as 'cache' | 'dict-sync'
  }
}

const switchTab = (tab: 'cache' | 'dict-sync') => {
  const routeMap: Record<string, string> = {
    cache: '/factor-library/engine-config/cache',
    'dict-sync': '/factor-library/engine-config/dict-sync'
  }
  if (routeMap[tab]) {
    activeTab.value = tab
    router.push(routeMap[tab])
  }
}

watch(() => route.path, () => {
  setTabFromRoute()
}, { immediate: true })

// ===== 因子字典同步 =====
const syncing = ref(false)
const lastSyncResult = ref<{ synced_count: number; source: string; message: string } | null>(null)

const handleSync = async () => {
  syncing.value = true
  try {
    const result = await window.electronAPI.factor.syncExpressionCatalog()
    if (result.success && result.data) {
      lastSyncResult.value = result.data
      ElMessage.success(result.data.message || '同步成功')
    } else {
      ElMessage.error(result.error || '同步失败')
    }
  } catch (e: any) {
    ElMessage.error('同步失败: ' + (e.message || e))
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped lang="scss">
.engine-config-page {
  padding: 24px;

  .nav-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    border-bottom: 1px solid #e4e7ed;

    .nav-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: #606266;
      border-bottom: 2px solid transparent;

      &:hover {
        color: #409eff;
      }

      &.active {
        color: #409eff;
        border-bottom-color: #409eff;
      }
    }
  }

  .dict-sync-panel {
    max-width: 600px;

    .dict-sync-desc {
      margin-bottom: 16px;
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
    }

    .dict-sync-result {
      margin-top: 20px;
    }
  }
}
</style>
