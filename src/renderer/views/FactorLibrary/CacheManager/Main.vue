<template>
  <div class="cache-manager-page">
    <!-- 小 tab 导航 -->
    <div class="content-card nav-card">
    <div class="nav-bar">
    <div class="nav-tabs">
      <button
        class="nav-tab"
        :class="{ active: activeTab === 'definitions' }"
        @click="activeTab = 'definitions'"
      >
        <el-icon><Coin /></el-icon>
        <span>缓存配置</span>
      </button>
      <button
        class="nav-tab"
        :class="{ active: activeTab === 'runs' }"
        @click="activeTab = 'runs'"
      >
        <el-icon><List /></el-icon>
        <span>同步记录</span>
      </button>
      <button
        class="nav-tab"
        :class="{ active: activeTab === 'data' }"
        @click="activeTab = 'data'"
      >
        <el-icon><Box /></el-icon>
        <span>数据管理</span>
      </button>
    </div>
      <div class="intro-banner">
        <el-icon class="intro-icon"><InfoFilled /></el-icon>
        <span>
          <strong>全量复制</strong>：字段映射留空则复制源表全部列；本服务只搬运、不加工。
        </span>
      </div>
    </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-card content-body">
      <DefinitionsTab
        v-if="activeTab === 'definitions'"
        :can-write="canWrite"
        @synced="goToRuns"
      />
      <RunsTab v-else-if="activeTab === 'runs'" />
      <DataTab v-else-if="activeTab === 'data'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { InfoFilled, Coin, List, Box } from '@element-plus/icons-vue'
import DefinitionsTab from './DefinitionsTab.vue'
import RunsTab from './RunsTab.vue'
import DataTab from './DataTab.vue'

const activeTab = ref<'definitions' | 'runs' | 'data'>('definitions')

// 写权限：后端 create/update/delete 已就绪。前端仅拿到 menu 权限，
// 能进入本页即视为可写，按钮统一开放，具体 API 权限由后端 403 兜底。
const canWrite = ref(true)

// 切换到同步记录 Tab（触发同步成功后调用）
const goToRuns = () => {
  activeTab.value = 'runs'
}
</script>

<style scoped lang="scss">
.cache-manager-page {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.content-card {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.nav-card {
  margin: 10px 10px 0 10px;
  padding: 5px 10px;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.intro-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f56c6c;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 1;

  strong {
    color: #f56c6c;
  }

  .intro-icon {
    font-size: 15px;
    flex-shrink: 0;
  }
}

.content-body {
  flex: 1;
  min-height: 0;
  margin: 10px 10px 0 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.nav-tabs {
  display: flex;
  gap: 4px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border: none;
  background: transparent;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;

  .el-icon {
    font-size: 15px;
  }

  &:hover:not(.active) {
    background: #f1f5f9;
    color: #3b82f6;
  }

  &.active {
    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(79, 110, 240, 0.35);
  }
}

.page-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .cache-manager-page {
    padding: 20px 16px;
  }

  .nav-tabs {
    display: flex;
    width: 100%;
  }

  .nav-tab {
    flex: 1;
    justify-content: center;
    padding: 10px 12px;
  }
}
</style>
