<template>
  <div class="backtest-page">
    <!-- 导航栏 -->
    <div class="nav-tabs">
      <button 
        v-if="hasPermission('backtest_submit')"
        class="nav-tab"
        :class="{ active: activeTab === 'submit' }"
        @click="switchTab('submit')"
      >
        <el-icon><DataAnalysis /></el-icon>
        <span>单因子回测</span>
      </button>
      <button 
        v-if="hasPermission('backtest_tasks')"
        class="nav-tab"
        :class="{ active: activeTab === 'tasks' }"
        @click="switchTab('tasks')"
      >
        <el-icon><List /></el-icon>
        <span>回测任务</span>
      </button>
      <button 
        v-if="hasPermission('backtest_result')"
        class="nav-tab"
        :class="{ active: activeTab === 'result' }"
        @click="switchTab('result')"
      >
        <el-icon><TrendCharts /></el-icon>
        <span>回测结果</span>
      </button>
      <button 
        v-if="hasPermission('expression_dict')"
        class="nav-tab"
        :class="{ active: activeTab === 'expression-dict' }"
        @click="switchTab('expression-dict')"
      >
        <el-icon><Document /></el-icon>
        <span>表达式字典</span>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="page-content">
      <SubmitContent v-if="activeTab === 'submit'" @submitted="handleSubmitSuccess" />
      <TasksContent v-else-if="activeTab === 'tasks'" @view-result="handleViewResult" />
      <ResultContent v-else-if="activeTab === 'result'" :task-id="currentTaskId" @back="handleBackToResult" />
      <ExpressionDictContent v-else-if="activeTab === 'expression-dict'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DataAnalysis, List, TrendCharts, Document } from '@element-plus/icons-vue'
import SubmitContent from './SubmitContent.vue'
import TasksContent from './TasksContent.vue'
import ResultContent from './ResultContent.vue'
import ExpressionDictContent from './ExpressionDictContent.vue'

const route = useRoute()
const router = useRouter()

const activeTab = ref('submit')
const currentTaskId = ref('')

// 获取菜单权限（从 App.vue 注入）
const menuPermissions = inject<{ value: string[] }>('menuPermissions', { value: [] })

// 权限检查
const hasPermission = (menuId: string): boolean => {
  const permissions = menuPermissions.value || []
  // 如果权限列表为空，全部显示
  if (permissions.length === 0) return true
  return permissions.includes(menuId)
}

// 可用的 Tab 列表
const availableTabs = computed(() => {
  const tabs: string[] = []
  if (hasPermission('backtest_submit')) tabs.push('submit')
  if (hasPermission('backtest_tasks')) tabs.push('tasks')
  if (hasPermission('backtest_result')) tabs.push('result')
  if (hasPermission('expression_dict')) tabs.push('expression-dict')
  return tabs
})

// 根据路由设置当前 Tab
const setTabFromRoute = () => {
  const path = route.path
  
  if (path.includes('/backtest/submit') && hasPermission('backtest_submit')) {
    activeTab.value = 'submit'
  } else if (path.includes('/backtest/tasks') && hasPermission('backtest_tasks')) {
    activeTab.value = 'tasks'
  } else if (path.includes('/backtest/expression-dict') && hasPermission('expression_dict')) {
    activeTab.value = 'expression-dict'
  } else if (path.includes('/backtest/result') && hasPermission('backtest_result')) {
    activeTab.value = 'result'
    // 提取 taskId
    const taskId = route.params.taskId as string
    if (taskId) {
      currentTaskId.value = taskId
    } else {
      currentTaskId.value = ''
    }
  } else {
    // 默认选择第一个可用的 Tab
    if (availableTabs.value.length > 0) {
      activeTab.value = availableTabs.value[0]
    }
  }
}

// Tab 切换
const switchTab = (tab: string) => {
  activeTab.value = tab
  if (tab === 'submit') {
    router.push('/factor-library/backtest/submit')
  } else if (tab === 'tasks') {
    router.push('/factor-library/backtest/tasks')
  } else if (tab === 'result') {
    if (currentTaskId.value) {
      router.push(`/factor-library/backtest/result/${currentTaskId.value}`)
    } else {
      router.push('/factor-library/backtest/result')
    }
  } else if (tab === 'expression-dict') {
    router.push('/factor-library/backtest/expression-dict')
  }
}

// 提交成功后跳转到任务列表
const handleSubmitSuccess = () => {
  if (hasPermission('backtest_tasks')) {
    activeTab.value = 'tasks'
    router.push('/factor-library/backtest/tasks')
  }
}

// 查看结果
const handleViewResult = (taskId: string) => {
  currentTaskId.value = taskId
  if (hasPermission('backtest_result')) {
    activeTab.value = 'result'
    router.push(`/factor-library/backtest/result/${taskId}`)
  }
}

// 返回结果列表
const handleBackToResult = () => {
  currentTaskId.value = ''
  router.push('/factor-library/backtest/result')
}

// 监听路由变化
watch(() => route.path, () => {
  setTabFromRoute()
})

watch(() => route.params.taskId, (newTaskId) => {
  if (newTaskId) {
    currentTaskId.value = newTaskId as string
  }
})

onMounted(() => {
  setTabFromRoute()
})
</script>

<style scoped lang="scss">
.backtest-page {
  padding: 24px;
  background: linear-gradient(180deg, #f0f5ff 0%, #f5f7fa 100%);
  min-height: calc(100vh - 60px);
}

.nav-tabs {
  display: inline-flex;
  background: #fff;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  
  .el-icon {
    font-size: 16px;
  }
  
  &:hover:not(.active) {
    background: #f5f7fa;
    color: #409eff;
  }
  
  &.active {
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
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
