<template>
  <div class="workorder-page">
    <!-- 导航栏 -->
    <div class="nav-tabs" v-if="activeTab !== 'detail'">
      <button 
        v-if="hasPermission('workorder_submit')"
        class="nav-tab"
        :class="{ active: activeTab === 'submit' }"
        @click="switchTab('submit')"
      >
        <el-icon><EditPen /></el-icon>
        <span>提交申请</span>
      </button>
      <button 
        v-if="hasPermission('workorder_my')"
        class="nav-tab"
        :class="{ active: activeTab === 'my' }"
        @click="switchTab('my')"
      >
        <el-icon><List /></el-icon>
        <span>我的申请</span>
      </button>
      <button 
        v-if="hasPermission('workorder_manage')"
        class="nav-tab"
        :class="{ active: activeTab === 'admin' }"
        @click="switchTab('admin')"
      >
        <el-icon><Setting /></el-icon>
        <span>工单管理</span>
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="page-content">
      <SubmitContent v-if="activeTab === 'submit'" @submitted="handleSubmitted" />
      <MyContent v-else-if="activeTab === 'my'" :key="myListKey" @view-detail="handleViewDetail" />
      <AdminContent v-else-if="activeTab === 'admin'" />
      <DetailContent v-else-if="activeTab === 'detail'" :id="detailId" @back="handleBack" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditPen, List, Setting } from '@element-plus/icons-vue'
import SubmitContent from './SubmitContent.vue'
import MyContent from './MyContent.vue'
import AdminContent from './AdminContent.vue'
import DetailContent from './DetailContent.vue'

const route = useRoute()
const router = useRouter()

const activeTab = ref('submit')
const detailId = ref<number>(0)
const myListKey = ref(0)

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
  if (hasPermission('workorder_submit')) tabs.push('submit')
  if (hasPermission('workorder_my')) tabs.push('my')
  if (hasPermission('workorder_manage')) tabs.push('admin')
  return tabs
})

// 根据路由设置 Tab
const setTabFromRoute = () => {
  const path = route.path
  const params = route.params
  
  if (path.includes('/workorder/submit') && hasPermission('workorder_submit')) {
    activeTab.value = 'submit'
  } else if (path.includes('/workorder/my') && hasPermission('workorder_my')) {
    activeTab.value = 'my'
  } else if (path.includes('/workorder/admin') && hasPermission('workorder_manage')) {
    activeTab.value = 'admin'
  } else if (path.includes('/workorder/detail/')) {
    activeTab.value = 'detail'
    detailId.value = Number(params.id) || 0
  } else if (availableTabs.value.length > 0) {
    // 如果当前路由没有权限，跳转到第一个有权限的 Tab
    activeTab.value = availableTabs.value[0]
  }
}

// Tab 切换
const switchTab = (tab: string) => {
  const routeMap: Record<string, string> = {
    submit: '/factor-library/workorder/submit',
    my: '/factor-library/workorder/my',
    admin: '/factor-library/workorder/admin'
  }
  
  if (routeMap[tab]) {
    activeTab.value = tab
    router.push(routeMap[tab])
  }
}

// 提交成功后跳转到我的申请
const handleSubmitted = () => {
  activeTab.value = 'my'
  myListKey.value++  // 刷新列表
  router.push('/factor-library/workorder/my')
}

// 查看详情
const handleViewDetail = (id: number) => {
  detailId.value = id
  activeTab.value = 'detail'
  router.push(`/factor-library/workorder/detail/${id}`)
}

// 返回列表
const handleBack = () => {
  activeTab.value = 'my'
  router.push('/factor-library/workorder/my')
}

// 监听路由变化，立即执行
watch(() => route.path, () => {
  setTabFromRoute()
}, { immediate: true })
</script>

<style scoped lang="scss">
.workorder-page {
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
