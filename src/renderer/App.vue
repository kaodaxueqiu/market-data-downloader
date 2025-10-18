<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <el-container class="app-container">
        <!-- 侧边栏 -->
        <el-aside :width="sidebarCollapsed ? '64px' : '200px'" class="app-sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
          <div class="app-logo">
            <img src="@/assets/logo.svg" alt="Logo" class="logo-image" />
          </div>
          
          <el-menu
            :default-active="activeMenu"
            router
            class="app-menu"
            :collapse="sidebarCollapsed"
            @select="handleMenuSelect"
          >
            <!-- 🆕 根据权限动态渲染菜单 -->
            <template v-for="menu in visibleMenus" :key="menu.id">
              <el-menu-item :index="menu.path">
                <el-icon>
                  <component :is="menu.icon" />
                </el-icon>
                <span>{{ menu.name }}</span>
                <el-tag v-if="menu.tag" :type="menu.tag.type" size="small" style="margin-left: 8px">
                  {{ menu.tag.text }}
                </el-tag>
              </el-menu-item>
            </template>
            
            <!-- 🔍 无权限提示 -->
            <div v-if="visibleMenus.length === 0" style="padding: 20px; color: rgba(255, 255, 255, 0.6); text-align: center; font-size: 12px;">
              暂无菜单权限
            </div>
          </el-menu>
          
          <div class="app-version">
            <span v-if="!sidebarCollapsed">v{{ appVersion }}</span>
          </div>
          
          <div class="sidebar-toggle" @click="toggleSidebar">
            <el-icon><DArrowLeft v-if="!sidebarCollapsed" /><DArrowRight v-else /></el-icon>
          </div>
        </el-aside>
        
        <!-- 主内容区 -->
        <el-container>
          <!-- 顶栏 -->
          <el-header class="app-header">
            <div class="header-left">
              <h2>{{ pageTitle }}</h2>
            </div>
            <div class="header-right">
              <el-button
                v-if="hasApiKey"
                type="success"
                size="small"
                circle
                :icon="Connection"
              >
              </el-button>
              <el-button
                v-else
                type="warning"
                size="small"
                @click="goToSettings"
              >
                <el-icon><Key /></el-icon>
                配置API Key
              </el-button>
            </div>
          </el-header>
          
          <!-- 页面内容 -->
          <el-main class="app-main">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </el-main>
        </el-container>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  House, 
  List, 
  Clock, 
  Setting, 
  Connection,
  Key,
  Box,
  DArrowLeft,
  DArrowRight
} from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const hasApiKey = ref(false)
const appVersion = ref('1.6.1')
const sidebarCollapsed = ref(false)

// 🆕 菜单权限相关
const menuPermissions = ref<string[]>([])
let permissionRefreshTimer: NodeJS.Timeout | null = null

// 🆕 所有菜单配置（ID与后端对应）
interface MenuItem {
  id: string
  name: string
  path: string
  icon: any
  tag?: { type: string; text: string }
}

const allMenus: MenuItem[] = [
  { id: 'home', name: '首页', path: '/', icon: House },
  { id: 'data_center', name: '数据中心', path: '/data-center', icon: Connection },
  { id: 'factor_library', name: '因子库', path: '/factor-library', icon: Box },
  { id: 'task_management', name: '任务管理', path: '/tasks', icon: List },
  { id: 'history', name: '历史记录', path: '/history', icon: Clock },
  { id: 'sdk_download', name: 'SDK下载', path: '/sdk-download', icon: Box },
  { id: 'api_key_management', name: 'API Key管理', path: '/api-key-management', icon: Key },
  { id: 'settings', name: '系统设置', path: '/settings', icon: Setting }
]

// 🆕 根据权限过滤可见菜单
const visibleMenus = computed(() => {
  // 🔐 没有配置API Key，只显示"设置"菜单
  if (!hasApiKey.value) {
    console.log('⚠️ 未配置API Key，只显示设置菜单')
    return allMenus.filter(menu => menu.id === 'settings')
  }
  
  // 如果没有权限数据或权限为空，默认显示所有菜单（兼容旧用户）
  if (!menuPermissions.value || menuPermissions.value.length === 0) {
    console.log('⚠️ 无菜单权限数据，显示全部菜单（兼容模式）')
    return allMenus
  }
  
  // 根据权限过滤
  const filtered = allMenus.filter(menu => menuPermissions.value.includes(menu.id))
  console.log('✅ 可见菜单:', filtered.map(m => m.name))
  return filtered
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '首页',
    '/data-center': '数据中心',
    '/factor-library': '因子库',
    '/download': '行情数据下载',
    '/tasks': '任务管理',
    '/history': '历史记录',
    '/dictionary': '行情数据字典',
    '/database-dictionary': '静态元数据字典',
    '/static-data-download': '静态元数据下载',
    '/sdk-download': 'SDK下载',
    '/api-key-management': 'API Key管理',
    '/settings': '系统设置'
  }
  return titles[route.path] || '市场数据下载工具'
})

const handleMenuSelect = (index: string) => {
  console.log('Menu selected:', index)
}

const goToSettings = () => {
  router.push('/settings')
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const checkApiKey = async () => {
  try {
    console.log('🔑 开始检查API Key...')
    const keys = await window.electronAPI.config.getApiKeys()
    console.log('✅ API Key检查完成，数量:', keys.length)
    hasApiKey.value = keys.length > 0 && keys.some((k: any) => k.isDefault)
  } catch (error) {
    console.error('❌ 检查API Key失败:', error)
    hasApiKey.value = false
  }
}

// 🆕 加载菜单权限（从本地存储）
const loadMenuPermissions = async () => {
  try {
    console.log('📋 加载菜单权限...')
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (defaultKey && defaultKey.menu_permissions) {
      menuPermissions.value = defaultKey.menu_permissions
      console.log('✅ 菜单权限已加载:', menuPermissions.value)
    } else {
      console.log('⚠️ 未找到菜单权限，显示全部菜单')
      menuPermissions.value = []
    }
  } catch (error) {
    console.error('❌ 加载菜单权限失败:', error)
    menuPermissions.value = []
  }
}

// 🆕 刷新菜单权限（从后端获取最新权限）
const refreshMenuPermissions = async (showMessage: boolean = false) => {
  try {
    console.log('🔄 刷新菜单权限...')
    const result = await window.electronAPI.config.refreshDefaultKeyPermissions()
    
    if (result.success && result.menuPermissions) {
      const oldPermissions = [...menuPermissions.value]
      menuPermissions.value = result.menuPermissions
      
      // 检查权限是否有变化
      const hasChanged = JSON.stringify(oldPermissions.sort()) !== JSON.stringify(result.menuPermissions.sort())
      
      if (hasChanged) {
        console.log('⚠️ 菜单权限已变更:', {
          旧权限: oldPermissions,
          新权限: result.menuPermissions
        })
        ElMessage.warning({
          message: '您的菜单权限已更新，部分功能可能已变化',
          duration: 5000
        })
      } else if (showMessage) {
        console.log('✅ 菜单权限未变化')
      }
    } else {
      console.warn('⚠️ 刷新权限失败:', result.error)
    }
  } catch (error: any) {
    console.error('❌ 刷新菜单权限失败:', error)
  }
}

// 🆕 启动定时刷新（每30秒）
const startPermissionRefresh = () => {
  // 清除已存在的定时器
  if (permissionRefreshTimer) {
    clearInterval(permissionRefreshTimer)
  }
  
  // 每30秒刷新一次权限
  permissionRefreshTimer = setInterval(() => {
    refreshMenuPermissions(false)
  }, 30000)
  
  console.log('⏰ 菜单权限定时刷新已启动（每30秒）')
}

// 🆕 停止定时刷新
const stopPermissionRefresh = () => {
  if (permissionRefreshTimer) {
    clearInterval(permissionRefreshTimer)
    permissionRefreshTimer = null
    console.log('⏹️ 菜单权限定时刷新已停止')
  }
}

// 🆕 路由守卫：没有API Key时只能访问设置页
watch([() => route.path, hasApiKey], () => {
  if (!hasApiKey.value && route.path !== '/settings') {
    console.log('⚠️ 未配置API Key，跳转到设置页面')
    router.push('/settings')
  }
})

onMounted(async () => {
  console.log('📱 App组件已挂载')
  
  // 加载应用版本号
  try {
    appVersion.value = await window.electronAPI.app.getVersion()
  } catch (error) {
    console.error('获取版本号失败:', error)
  }
  
  // 使用setTimeout避免阻塞
  setTimeout(async () => {
    // 检查API Key
    await checkApiKey().catch(err => {
      console.error('API Key检查异常:', err)
    })
    
    // 🆕 如果没有Key，跳转到设置页
    if (!hasApiKey.value && route.path !== '/settings') {
      router.push('/settings')
    }
    
    // 🆕 加载菜单权限
    await loadMenuPermissions()
    
    // 🆕 立即刷新一次权限（从后端获取最新）
    await refreshMenuPermissions(false)
    
    // 🆕 启动定时刷新
    startPermissionRefresh()
  }, 100)
})

onUnmounted(() => {
  // 🆕 组件卸载时清理定时器
  stopPermissionRefresh()
})
</script>

<style lang="scss">
.app-container {
  height: 100vh;
  
  .app-sidebar {
    background: linear-gradient(180deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    display: flex;
    flex-direction: column;
    transition: width 0.3s;
    position: relative;
    overflow-x: hidden !important;
    
    .app-logo {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      
      .logo-image {
        max-width: 100%;
        max-height: 60px;
        object-fit: contain;
      }
    }
    
    .app-menu {
      flex: 1;
      background: transparent;
      border: none;
      overflow-x: hidden;
      
      .el-sub-menu {
        .el-sub-menu__title {
          color: rgba(255, 255, 255, 0.8);
          
          &:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
        }
      }
      
      .el-menu-item {
        color: rgba(255, 255, 255, 0.8);
        
        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }
        
        &.is-active {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }
      }
    }
    
    // 子菜单样式（不弹出，直接在侧边栏内展开）
    .el-sub-menu__icon-arrow {
      color: rgba(255, 255, 255, 0.8);
    }
    
    // 深层样式覆盖，确保子菜单也是深色
    :deep(.el-sub-menu) {
      .el-menu {
        background-color: rgba(0, 0, 0, 0.2) !important;
        
        .el-menu-item {
          background-color: transparent !important;
          color: rgba(255, 255, 255, 0.8) !important;
          padding-left: 50px !important;
          
          &:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: white !important;
          }
          
          &.is-active {
            background-color: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
          }
        }
      }
    }
  }
  
  
  .app-sidebar {
    .app-version {
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }

    .sidebar-toggle {
      position: absolute;
      right: -18px;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 2px 2px 12px rgba(102, 126, 234, 0.4);
      color: white;
      transition: all 0.3s;
      z-index: 100;

      &:hover {
        box-shadow: 3px 3px 16px rgba(102, 126, 234, 0.6);
        transform: translateY(-50%) scale(1.1);
      }

      &:active {
        transform: translateY(-50%) scale(0.95);
      }
    }

    &.sidebar-collapsed {
      overflow-x: hidden !important;
      
      .app-logo {
        justify-content: center;
        
        .logo-image {
          width: 40px;
          height: 40px;
        }
      }

      .app-menu {
        :deep(.el-menu-item span),
        :deep(.el-sub-menu__title span),
        :deep(.el-tag) {
          display: none;
        }
      }
    }
  }
  
  .app-header {
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    
    .header-left h2 {
      margin: 0;
      font-size: 20px;
      color: #303133;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }
  
  .app-main {
    background: #f5f7fa;
    padding: 20px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style lang="scss">
/* 全局样式：强制覆盖Element Plus子菜单 */
.app-sidebar .el-sub-menu .el-menu {
  background-color: rgba(0, 0, 0, 0.3) !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item {
  background-color: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
  padding-left: 50px !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: white !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item.is-active {
  background-color: rgba(255, 255, 255, 0.25) !important;
  color: white !important;
}
</style>
