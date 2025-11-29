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
              <!-- 有子菜单：渲染二级菜单 -->
              <el-sub-menu v-if="menu.children && menu.children.length > 0" :index="menu.path">
                <template #title>
                  <el-icon>
                    <component :is="menu.icon" />
                  </el-icon>
                  <span>{{ menu.name }}</span>
                </template>
                <el-menu-item 
                  v-for="child in menu.children" 
                  :key="child.id" 
                  :index="child.path"
                >
                  {{ child.name }}
                </el-menu-item>
              </el-sub-menu>
              
              <!-- 无子菜单：普通菜单项 -->
              <el-menu-item v-else :index="menu.path">
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
              <!-- 🆕 系统状态面板 -->
              <el-popover
                placement="bottom-end"
                :width="320"
                trigger="click"
              >
                <template #reference>
                  <el-button :type="overallStatusType" size="small">
                    <el-icon><Connection /></el-icon>
                    系统状态
                    <el-badge
                      v-if="activeSubscriptionCount > 0"
                      :value="activeSubscriptionCount"
                      type="success"
                      style="margin-left: 5px"
                    />
                  </el-button>
                </template>

                <!-- 状态面板内容 -->
                <div class="status-panel">
                  <div class="panel-title">系统连接状态</div>

                  <!-- API Key 状态 -->
                  <div class="status-item">
                    <el-icon :color="hasApiKey ? '#67C23A' : '#F56C6C'" :size="18">
                      <Key />
                    </el-icon>
                    <span class="status-label">API Key:</span>
                    <el-tag :type="hasApiKey ? 'success' : 'danger'" size="small">
                      {{ hasApiKey ? '已配置' : '未配置' }}
                    </el-tag>
                    <el-button v-if="!hasApiKey" link type="primary" size="small" @click="goToSettings">
                      去配置
                    </el-button>
                  </div>

                  <!-- WebSocket 状态 -->
                  <div class="status-item">
                    <el-icon :color="wsStatusColor" :size="18">
                      <Connection />
                    </el-icon>
                    <span class="status-label">WebSocket:</span>
                    <el-tag :type="wsStatusTagType" size="small">
                      {{ wsStatusText }}
                    </el-tag>
                    
                    <!-- 连接/断开按钮 -->
                    <el-button
                      v-if="wsStatus === 'disconnected'"
                      link
                      type="primary"
                      size="small"
                      @click="connectWebSocket"
                      :disabled="!hasApiKey"
                    >
                      连接
                    </el-button>
                    <el-button
                      v-else-if="wsStatus === 'connected'"
                      link
                      type="danger"
                      size="small"
                      @click="disconnectWebSocket"
                      :disabled="activeSubscriptionCount > 0"
                    >
                      断开
                    </el-button>
                  </div>

                  <!-- 活跃订阅任务 -->
                  <div class="status-item">
                    <el-icon color="#409EFF" :size="18">
                      <List />
                    </el-icon>
                    <span class="status-label">活跃订阅:</span>
                    <el-tag type="primary" size="small">
                      {{ activeSubscriptionCount }} 个任务
                    </el-tag>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="panel-actions">
                    <el-button size="small" @click="refreshStatus">
                      <el-icon><Refresh /></el-icon>
                      刷新状态
                    </el-button>
                    <el-button size="small" type="primary" @click="goToTasks">
                      <el-icon><List /></el-icon>
                      任务管理
                    </el-button>
                  </div>
                </div>
              </el-popover>
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
      
      <!-- 🆕 全局更新下载进度对话框 -->
      <el-dialog
        v-model="showUpdateProgress"
        title="正在下载更新"
        width="400px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        center
      >
        <div class="update-progress-content">
          <div class="progress-icon">
            <el-icon :size="48" color="#409EFF" class="rotating">
              <Loading />
            </el-icon>
          </div>
          <div class="progress-info">
            <el-progress 
              :percentage="updateDownloadProgress" 
              :stroke-width="20"
              :status="updateDownloadProgress === 100 ? 'success' : undefined"
            />
            <div class="progress-text">
              {{ updateDownloadStatus }}
            </div>
          </div>
        </div>
      </el-dialog>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setMenuPermissions } from './router/index'
import { ElMessage } from 'element-plus'
import { 
  DArrowLeft,
  DArrowRight,
  Refresh,
  List,
  Loading
} from '@element-plus/icons-vue'
import { allMenus, type MenuItem } from '@/config/menuConfig'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const hasApiKey = ref(false)
const appVersion = ref('1.6.1')
const sidebarCollapsed = ref(false)

// 🆕 系统状态
const wsStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const activeSubscriptionCount = ref(0)

// 🆕 全局更新下载进度
const showUpdateProgress = ref(false)
const updateDownloadProgress = ref(0)
const updateDownloadStatus = ref('准备下载...')

// 🆕 定时器引用（用于清理）
let statusRefreshTimer: NodeJS.Timeout | null = null

// 🧪 开发测试：模拟下载进度（在控制台输入 window.testUpdateProgress() 调用）
;(window as any).testUpdateProgress = () => {
  showUpdateProgress.value = true
  updateDownloadProgress.value = 0
  updateDownloadStatus.value = '准备下载...'
  
  let progress = 0
  const interval = setInterval(() => {
    progress += 5
    updateDownloadProgress.value = progress
    const loadedMB = (progress * 1.2).toFixed(2)  // 模拟 120MB 文件
    updateDownloadStatus.value = `已下载 ${loadedMB} MB / 120.00 MB`
    
    if (progress >= 100) {
      clearInterval(interval)
      updateDownloadStatus.value = '下载完成！'
      setTimeout(() => {
        showUpdateProgress.value = false
      }, 1500)
    }
  }, 200)
  
  console.log('🧪 测试下载进度开始...')
}

// 🆕 菜单权限相关
const menuPermissions = ref<string[]>([])
let permissionRefreshTimer: NodeJS.Timeout | null = null

// 🆕 数据源权限相关
const datasourcePermissions = ref<string[]>([])
let datasourceRefreshTimer: NodeJS.Timeout | null = null

// 菜单配置从 @/config/menuConfig.ts 统一导入

// 扁平化过滤菜单树（精确匹配权限）
const filterMenuTree = (menus: MenuItem[]): MenuItem[] => {
  return menus
    .filter(menu => {
      // 当前菜单必须在权限列表里才显示
      return menuPermissions.value.includes(menu.id)
    })
    .map(menu => {
      const filtered = { ...menu }
      
      // 如果有子菜单，递归过滤子菜单
      if (menu.children && menu.children.length > 0) {
        filtered.children = filterMenuTree(menu.children)
      }
      
      return filtered
    })
}

// 🆕 根据权限过滤可见菜单（支持3级，精确匹配）
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
  
  // 精确过滤：只显示在权限列表里的菜单
  const filtered = filterMenuTree(allMenus)
  console.log('✅ 可见菜单（3级）:', filtered.map(m => m.name))
  return filtered
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '首页',
    '/data-center': '数据中心',
    '/factor-library': '因子库',
    '/fund-management': '基金管理',
    '/fund-management/list': '基金列表',
    '/fund-management/performance': '业绩分析',
    '/fund-management/position': '持仓分析',
    '/fund-management/operations': '基金运维',
    '/download': '行情数据下载',
    '/code-repository': '代码仓库',
    '/code-repository/repos': '我的仓库',
    '/code-repository/execute': '执行模型',
    '/code-repository/history': '执行记录',
    '/code-repository/admin': '仓库管理',
    '/tasks': '任务管理',
    '/history': '历史记录',
    '/dictionary': '行情数据字典',
    '/database-dictionary': '静态元数据字典',
    '/static-data-download': '静态元数据下载',
    '/sdk-download': 'SDK下载',
    '/api-key-management': 'API Key管理',
    '/monitoring/redis': 'Redis监控',
    '/monitoring/markets': '市场监控',
    '/monitoring/services': '服务监控',
    '/monitoring/clickhouse-cron': 'ClickHouse定时任务',
    '/settings': '系统设置'
  }
  return titles[route.path] || '市场数据下载工具'
})

const handleMenuSelect = (index: string) => {
  console.log('Menu selected:', index)
}

// 🆕 WebSocket 状态计算属性
const wsStatusColor = computed(() => {
  if (wsStatus.value === 'connected') return '#67C23A'
  if (wsStatus.value === 'connecting') return '#E6A23C'
  return '#909399'
})

const wsStatusTagType = computed(() => {
  if (wsStatus.value === 'connected') return 'success'
  if (wsStatus.value === 'connecting') return 'warning'
  return 'info'
})

const wsStatusText = computed(() => {
  if (wsStatus.value === 'connected') return '已连接'
  if (wsStatus.value === 'connecting') return '连接中'
  return '未连接'
})

// 🆕 整体状态按钮类型
const overallStatusType = computed(() => {
  if (!hasApiKey.value) return 'danger'
  if (activeSubscriptionCount.value > 0) return 'success'
  if (wsStatus.value === 'connected') return 'success'
  return 'primary'
})

// 🆕 刷新状态
const refreshStatus = async () => {
  try {
    // 刷新订阅任务数量
    const tasks = await window.electronAPI.subscription.getAllTasks()
    activeSubscriptionCount.value = tasks.filter((t: any) => t.status === 'subscribing').length
    
    // 从 WebSocket 管理器获取连接状态
    const wsInfo = await window.electronAPI.subscription.getWebSocketStatus()
    if (wsInfo.status !== wsStatus.value) {
      wsStatus.value = wsInfo.status
    }
  } catch (error) {
    console.error('刷新状态失败:', error)
  }
}

// 🆕 连接 WebSocket
const connectWebSocket = async () => {
  try {
    // 获取 API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    
    if (!defaultKey) {
      ElMessage.error('请先配置 API Key')
      goToSettings()
      return
    }
    
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('无法获取完整的 API Key')
      return
    }

    wsStatus.value = 'connecting'
    
    // 这里需要调用 WebSocket 管理器的连接接口
    // TODO: 需要添加 subscription:connect 接口
    await window.electronAPI.subscription.connect(fullApiKey)
    
    wsStatus.value = 'connected'
    ElMessage.success('WebSocket 连接成功！')
  } catch (error: any) {
    console.error('❌ 连接失败:', error)
    ElMessage.error(error.message || '连接失败')
    wsStatus.value = 'disconnected'
  }
}

// 🆕 断开 WebSocket
const disconnectWebSocket = async () => {
  try {
    if (activeSubscriptionCount.value > 0) {
      ElMessage.warning('仍有活跃订阅任务，无法断开连接')
      return
    }

    await window.electronAPI.subscription.disconnect()
    
    wsStatus.value = 'disconnected'
    ElMessage.success('WebSocket 已断开')
  } catch (error: any) {
    console.error('❌ 断开失败:', error)
    ElMessage.error(error.message || '断开失败')
  }
}

// 🆕 跳转到任务管理
const goToTasks = () => {
  router.push('/tasks')
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
      setMenuPermissions(defaultKey.menu_permissions)  // 同步到路由守卫
      console.log('✅ 菜单权限已加载:', menuPermissions.value)
    } else {
      console.log('⚠️ 未找到菜单权限，显示全部菜单')
      menuPermissions.value = []
      setMenuPermissions([])  // 同步到路由守卫
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
      setMenuPermissions(result.menuPermissions)  // 同步到路由守卫
      
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

// 🆕 刷新数据源权限（从后端获取最新）
const refreshDatasourcePermissions = async (showMessage: boolean = false) => {
  try {
    console.log('🔄 刷新数据源权限...')
    
    // 先设置API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        await window.electronAPI.dbdict.setApiKey(fullKey)
      }
    }
    
    const result = await window.electronAPI.dbdict.getDatasources()
    
    if (result.code === 200 && result.data) {
      const datasources = result.data.datasources || []
      const newPermissions = datasources
        .filter((ds: any) => ds.has_permission)
        .map((ds: any) => ds.code)
      
      const oldPermissions = [...datasourcePermissions.value]
      datasourcePermissions.value = newPermissions
      
      // 检查权限是否有变化
      const hasChanged = JSON.stringify(oldPermissions.sort()) !== JSON.stringify(newPermissions.sort())
      
      if (hasChanged) {
        console.log('⚠️ 数据源权限已变更:', {
          旧权限: oldPermissions,
          新权限: newPermissions
        })
        ElMessage.warning({
          message: '您的数据源访问权限已更新，部分数据源可能已变化',
          duration: 5000
        })
        
        // 通知所有需要的组件刷新（可以用事件总线或其他方式）
        window.dispatchEvent(new CustomEvent('datasource-permission-changed', { 
          detail: { permissions: newPermissions }
        }))
      } else if (showMessage) {
        console.log('✅ 数据源权限未变化')
      }
    } else {
      console.warn('⚠️ 刷新数据源权限失败:', result.error)
    }
  } catch (error: any) {
    console.error('❌ 刷新数据源权限失败:', error)
  }
}

// 🆕 启动数据源权限定时刷新（每30秒）
const startDatasourceRefresh = () => {
  if (datasourceRefreshTimer) {
    clearInterval(datasourceRefreshTimer)
  }
  
  datasourceRefreshTimer = setInterval(() => {
    refreshDatasourcePermissions(false)
  }, 30000)
  
  console.log('⏰ 数据源权限定时刷新已启动（每30秒）')
}

// 🆕 停止数据源权限定时刷新
const stopDatasourceRefresh = () => {
  if (datasourceRefreshTimer) {
    clearInterval(datasourceRefreshTimer)
    datasourceRefreshTimer = null
    console.log('⏹️ 数据源权限定时刷新已停止')
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
  
  // 🆕 初始化状态
  refreshStatus()
  
  // 🆕 监听 WebSocket 状态变化
  window.electronAPI.subscription.onConnected(() => {
    wsStatus.value = 'connected'
    refreshStatus()
  })
  
  window.electronAPI.subscription.onDisconnected(() => {
    wsStatus.value = 'disconnected'
    refreshStatus()
  })
  
  // 🆕 定时刷新状态（每3秒）
  statusRefreshTimer = setInterval(() => {
    refreshStatus()
  }, 3000)
  
  // 🆕 监听全局更新下载进度
  window.electronAPI.on('updater:start-download', () => {
    showUpdateProgress.value = true
    updateDownloadProgress.value = 0
    updateDownloadStatus.value = '准备下载...'
  })
  
  window.electronAPI.on('updater:download-progress', (progress: any) => {
    showUpdateProgress.value = true
    updateDownloadProgress.value = Math.floor(progress.percent || 0)
    const totalMB = ((progress.total || 0) / 1024 / 1024).toFixed(2)
    const loadedMB = (((progress.total || 0) * (progress.percent || 0) / 100) / 1024 / 1024).toFixed(2)
    updateDownloadStatus.value = `已下载 ${loadedMB} MB / ${totalMB} MB`
  })
  
  window.electronAPI.on('updater:update-downloaded', (filePath: string) => {
    updateDownloadProgress.value = 100
    updateDownloadStatus.value = '下载完成！'
    setTimeout(() => {
      showUpdateProgress.value = false
    }, 1500)
    console.log('✅ 更新下载完成:', filePath)
  })
  
  window.electronAPI.on('updater:error', (error: any) => {
    showUpdateProgress.value = false
    ElMessage.error('下载更新失败: ' + (error?.message || error))
  })
  
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
    
    // 🆕 数据源权限定期检查
    await refreshDatasourcePermissions(false)
    startDatasourceRefresh()
  }, 100)
})

onUnmounted(() => {
  // 🆕 组件卸载时清理定时器
  if (statusRefreshTimer) {
    clearInterval(statusRefreshTimer)
    statusRefreshTimer = null
  }
  stopPermissionRefresh()
  stopDatasourceRefresh()
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

// 🆕 状态面板样式
.status-panel {
  .panel-title {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e4e7ed;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #f5f5f5;

    &:last-of-type {
      border-bottom: none;
    }

    .status-label {
      font-size: 14px;
      color: #606266;
      min-width: 90px;
    }
  }

  .panel-actions {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #e4e7ed;
    display: flex;
    gap: 8px;
    justify-content: center;
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

// 🆕 更新下载进度对话框样式
.update-progress-content {
  text-align: center;
  padding: 20px 0;
  
  .progress-icon {
    margin-bottom: 20px;
    
    .rotating {
      animation: rotate 1.5s linear infinite;
    }
  }
  
  .progress-info {
    .progress-text {
      margin-top: 15px;
      font-size: 14px;
      color: #606266;
    }
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
