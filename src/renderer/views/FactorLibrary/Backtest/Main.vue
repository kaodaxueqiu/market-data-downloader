<template>
  <div class="backtest-page">
    <!-- 内容区域（当前显示哪个页面由路由驱动 activeTab） -->
    <div class="page-content">
      <SubmitContent v-if="activeTab === 'submit'" @submitted="handleSubmitSuccess" />
      <TasksContent v-else-if="activeTab === 'tasks'" @view-result="handleViewResult" />
      <ResultContent v-else-if="activeTab === 'result'" :task-id="currentTaskId" @back="handleBackToResult" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubmitContent from './SubmitContent.vue'
import TasksContent from './TasksContent.vue'
import ResultContent from './ResultContent.vue'
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
  if (hasPermission('factor_backtest')) tabs.push('submit')
  if (hasPermission('backtest_tasks')) tabs.push('tasks')
  // 结果页归属"任务详情"权限（从任务列表进入）
  if (hasPermission('backtest_tasks')) tabs.push('result')
  return tabs
})

// 根据路由设置当前 Tab
const setTabFromRoute = () => {
  const path = route.path
  
  if (path.includes('/backtest/submit') && hasPermission('factor_backtest')) {
    activeTab.value = 'submit'
  } else if (path.includes('/backtest/tasks') && hasPermission('backtest_tasks')) {
    activeTab.value = 'tasks'
  } else if (path.includes('/backtest/result') && hasPermission('backtest_tasks')) {
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
  if (hasPermission('backtest_tasks')) {
    activeTab.value = 'result'
    router.push(`/factor-library/backtest/result/${taskId}`)
  }
}

// 从结果详情返回来源列表（研究成果 or 任务列表）
const handleBackToResult = () => {
  const from = route.query.from as string
  currentTaskId.value = ''
  if (from === 'research') {
    router.push('/factor-library/research-results')
  } else {
    activeTab.value = 'tasks'
    router.push('/factor-library/backtest/tasks')
  }
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
  background: #f5f7fa;
  height: calc(100vh - 60px - 24px - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
</style>
