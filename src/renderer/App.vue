<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <el-container class="app-container">
        <!-- 侧边栏 -->
        <el-aside :width="sidebarCollapsed ? '64px' : '200px'" class="app-sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
          <div class="app-logo">
            <img src="@/assets/logo.svg" alt="Logo" class="logo-image" />
          </div>
          
          <el-scrollbar class="menu-scrollbar">
          <el-menu
            :default-active="activeMenu"
            router
            class="app-menu"
            :collapse="sidebarCollapsed"
            :unique-opened="true"
            v-model:opened="openedMenus"
            popper-class="sidebar-popper"
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
          </el-scrollbar>

          <div class="sidebar-footer">
            <span v-if="!sidebarCollapsed" class="version-text">v{{ appVersion }}</span>
            <div class="collapse-btn" @click="toggleSidebar">
              <el-icon :size="14"><Fold v-if="!sidebarCollapsed" /><Expand v-else /></el-icon>
            </div>
          </div>
        </el-aside>
        
        <!-- 主内容区 -->
        <el-container class="app-content">
          <!-- 顶栏 -->
          <el-header class="app-header">
            <div class="header-left">
              <h2>
                <template v-for="(crumb, i) in breadcrumb" :key="i">
                  <span v-if="i > 0" class="crumb-sep">/</span>
                  <span :class="{ 'crumb-current': i === breadcrumb.length - 1 }">{{ crumb }}</span>
                </template>
              </h2>
            </div>
            <div class="header-right">
              <!-- 更新已就绪按钮（静默下载完成后显示） -->
              <el-button
                v-if="updateReady"
                type="warning"
                size="small"
                @click="installDownloadedUpdate"
              >
                <el-icon><RefreshRight /></el-icon>
                更新已就绪，点击重启
              </el-button>

              <!-- 消息中心 -->
              <el-popover
                placement="bottom-end"
                :width="380"
                trigger="click"
                popper-class="notification-popover"
              >
                <template #reference>
                  <el-badge :value="unreadCount" :max="99" :hidden="unreadCount === 0" class="notification-badge">
                    <el-button circle size="small">
                      <el-icon :size="18"><Bell /></el-icon>
                    </el-button>
                  </el-badge>
                </template>

                <!-- 消息中心面板 -->
                <div class="notification-panel">
                  <div class="panel-header">
                    <span class="panel-title">消息中心</span>
                    <div class="panel-actions">
                      <el-button link size="small" @click="markAllAsRead" :disabled="unreadCount === 0">
                        全部已读
                      </el-button>
                      <el-button link size="small" type="danger" @click="clearAllNotifications" :disabled="notifications.length === 0">
                        清空
                      </el-button>
                    </div>
                  </div>
                  
                  <div class="notification-list" v-if="notifications.length > 0">
                    <div 
                      v-for="item in notifications.slice(0, 10)" 
                      :key="item.id"
                      class="notification-item"
                      :class="{ unread: !item.read }"
                      @click="handleNotificationClick(item)"
                    >
                      <div class="notification-icon">
                        <el-icon v-if="item.type === 'workorder'" color="#409eff"><Tickets /></el-icon>
                        <el-icon v-else-if="item.type === 'system'" color="#e6a23c"><InfoFilled /></el-icon>
                        <el-icon v-else color="#67c23a"><Bell /></el-icon>
                      </div>
                      <div class="notification-content">
                        <div class="notification-title">{{ item.title }}</div>
                        <div class="notification-message">{{ item.message }}</div>
                        <div class="notification-time">{{ formatTime(item.time) }}</div>
                      </div>
                      <div class="notification-dot" v-if="!item.read"></div>
                    </div>
                  </div>
                  
                  <el-empty v-else description="暂无消息" :image-size="60" />
                </div>
              </el-popover>
              
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

              <!-- 窗口控制按钮（仅Windows显示） -->
              <div v-if="!isMac" class="window-controls">
                <button class="win-btn" @click="handleMinimize">
                  <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="4.5" width="8" height="1" fill="currentColor"/></svg>
                </button>
                <button class="win-btn" @click="handleMaximize">
                  <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/></svg>
                  <svg v-else width="10" height="10" viewBox="0 0 10 10"><rect x="2.5" y="1" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="1" y="2.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="1" y="2.5" width="6.5" height="1.5" fill="#f5f7fa"/></svg>
                </button>
                <button class="win-btn win-close" @click="handleClose">
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" stroke-width="1.2"/></svg>
                </button>
              </div>

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
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setMenuPermissions } from './router/index'
import { ElMessage } from 'element-plus'
import {
  Fold,
  Expand,
  Refresh,
  RefreshRight,
  List,
  Bell,
  Tickets,
  InfoFilled,
  Key,
  Connection
} from '@element-plus/icons-vue'
import { allMenus, type MenuItem } from '@/config/menuConfig'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const hasApiKey = ref(false)
const appVersion = ref('1.6.1')
const sidebarCollapsed = ref(false)
const openedMenus = ref<string[]>([])

// 🆕 系统状态
const wsStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const activeSubscriptionCount = ref(0)

// 更新已就绪（静默下载完成后置为true，显示重启按钮）
const updateReady = ref(false)
const updateFilePath = ref('')

// 定时器引用（用于清理）
let statusRefreshTimer: NodeJS.Timeout | null = null

// 🆕 菜单权限相关
const menuPermissions = ref<string[]>([])
let permissionRefreshTimer: NodeJS.Timeout | null = null

// 提供菜单权限给子组件使用
provide('menuPermissions', menuPermissions)

// 🆕 数据源权限相关
const datasourcePermissions = ref<string[]>([])
let datasourceRefreshTimer: NodeJS.Timeout | null = null

// 🆕 消息中心相关
interface NotificationItem {
  id: string
  type: 'workorder' | 'system' | 'task'  // 消息类型
  title: string
  message: string
  time: Date
  read: boolean
  link?: string  // 跳转链接
}
// 从 localStorage 加载消息历史
const loadNotifications = (): NotificationItem[] => {
  try {
    const saved = localStorage.getItem('notificationHistory')
    if (saved) {
      const items = JSON.parse(saved)
      // 恢复 Date 对象
      return items.map((item: any) => ({
        ...item,
        time: new Date(item.time)
      }))
    }
    return []
  } catch {
    return []
  }
}

// 保存消息到 localStorage
const saveNotifications = () => {
  try {
    // 最多保存50条
    const toSave = notifications.value.slice(0, 50)
    localStorage.setItem('notificationHistory', JSON.stringify(toSave))
  } catch (e) {
    console.error('保存消息历史失败:', e)
  }
}

const notifications = ref<NotificationItem[]>(loadNotifications())
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
let notificationRefreshTimer: NodeJS.Timeout | null = null
let lastWorkorderStats = { pending: 0 }

// 记录已通知过的工单状态，避免重复通知（从 localStorage 恢复）
const loadNotifiedStatus = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem('notifiedWorkorderStatus')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}
const notifiedWorkorderStatus = ref<Record<string, string>>(loadNotifiedStatus())

// 保存已通知状态到 localStorage
const saveNotifiedStatus = () => {
  try {
    localStorage.setItem('notifiedWorkorderStatus', JSON.stringify(notifiedWorkorderStatus.value))
  } catch (e) {
    console.error('保存通知状态失败:', e)
  }
}

// 🆕 记录已通知过的回测任务状态
const loadNotifiedTaskStatus = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem('notifiedBacktestTaskStatus')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}
const notifiedTaskStatus = ref<Record<string, string>>(loadNotifiedTaskStatus())

// 保存回测任务已通知状态到 localStorage
const saveNotifiedTaskStatus = () => {
  try {
    localStorage.setItem('notifiedBacktestTaskStatus', JSON.stringify(notifiedTaskStatus.value))
  } catch (e) {
    console.error('保存回测任务通知状态失败:', e)
  }
}

// 提供消息中心给子组件使用
provide('notifications', notifications)
provide('unreadCount', unreadCount)

// 菜单配置从 @/config/menuConfig.ts 统一导入

// 扁平化过滤菜单树（精确匹配权限）
const filterMenuTree = (menus: MenuItem[]): MenuItem[] => {
  return menus
    .filter(menu => {
      if (menu.hidden) return false
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
    return allMenus.filter(m => !m.hidden)
  }
  
  // 精确过滤：只显示在权限列表里的菜单
  const filtered = filterMenuTree(allMenus)
  console.log('✅ 可见菜单（3级）:', filtered.map(m => m.name))
  return filtered
})

// 面包屑：根据路由路径推导完整层级
const childTitles: Record<string, string[]> = {
  '/': ['首页'],
  '/data-center': ['数据中心'],
  '/factor-library': ['因子库'],
  '/factor-library/plaza': ['因子库', '因子广场'],
  '/factor-library/my-factors': ['因子库', '我的因子'],
  '/factor-library/private-warehouse': ['因子库', '私有数据仓库'],
  '/factor-library/submit': ['因子库', '提交因子'],
  '/factor-library/backtest': ['因子库', '单因子回测'],
  '/factor-library/backtest/submit': ['因子库', '单因子回测'],
  '/factor-library/backtest/tasks': ['因子库', '任务详情'],
  '/factor-library/backtest/result': ['因子库', '任务详情'],
  '/factor-library/expression-dict': ['因子库', '表达式字典'],
  '/factor-library/research-results': ['因子库', '研究成果'],
  '/factor-library/engine-config': ['因子库', '回测引擎配置'],
  '/factor-library/engine-config/cache': ['因子库', '回测引擎配置'],
  '/factor-library/engine-config/dict-sync': ['因子库', '回测引擎配置'],
  '/factor-library/engine-config/admission-config': ['因子库', '回测引擎配置'],
  '/factor-library/cache-manager': ['因子库', '数据缓存管理'],
  '/fund-management': ['基金管理'],
  '/fund-management/list': ['基金管理', '基金列表'],
  '/fund-management/performance': ['基金管理', '业绩分析'],
  '/fund-management/position': ['基金管理', '持仓分析'],
  '/fund-management/operations': ['基金管理', '基金运维'],
  '/download': ['行情数据下载'],
  '/code-repository': ['代码仓库'],
  '/code-repository/repos': ['代码仓库', '我的仓库'],
  '/code-repository/execute': ['代码仓库', '执行模型'],
  '/code-repository/history': ['代码仓库', '执行记录'],
  '/code-repository/admin': ['代码仓库', '仓库管理'],
  '/tasks': ['任务管理'],
  '/history': ['历史记录'],
  '/dictionary': ['行情数据字典'],
  '/database-dictionary': ['静态元数据字典'],
  '/static-data-download': ['静态元数据下载'],
  '/sdk-download': ['SDK下载'],
  '/control-center/api-key': ['控制中心', 'API Key管理'],
  '/control-center/db-management': ['控制中心', '数据库管理'],
  '/monitoring/redis': ['监控中心', 'Redis监控'],
  '/monitoring/markets': ['监控中心', '市场监控'],
  '/monitoring/services': ['监控中心', '服务监控'],
  '/monitoring/clickhouse-cron': ['监控中心', 'ClickHouse定时任务'],
  '/im': ['智能助手'],
  '/settings': ['系统设置']
}

const breadcrumb = computed<string[]>(() => {
  const path = route.path
  // 动态路由
  if (path.startsWith('/factor-library/backtest/result/')) {
    return ['因子库', '任务详情']
  }
  return childTitles[path] || ['资舟量化研究平台']
})

const handleMenuSelect = (index: string) => {
  console.log('Menu selected:', index)
  if (index === '#im') {
    ;(window.electronAPI?.im as any)?.openWindow().then((result: any) => {
      if (result && !result.success) {
        ElMessage.error(result.error || '打开IM失败')
      }
    })
  }
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
  return 'default'
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

// 窗口控制
const isMaximized = ref(false)
const isMac = computed(() => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent))

const handleMinimize = () => {
  window.electronAPI.window.minimize()
}

const handleMaximize = async () => {
  await window.electronAPI.window.maximize()
  isMaximized.value = await window.electronAPI.window.isMaximized()
}

const handleClose = () => {
  window.electronAPI.window.close()
}

// 监听窗口最大化状态变化
window.electronAPI.window.isMaximized().then((val: boolean) => {
  isMaximized.value = val
})

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

// 安装下载好的更新（点击"更新已就绪"按钮触发）
const installDownloadedUpdate = async () => {
  if (!updateFilePath.value) {
    ElMessage.error('未找到更新文件')
    return
  }
  try {
    await window.electronAPI.updater.quitAndInstall(updateFilePath.value)
  } catch (error: any) {
    ElMessage.error('安装失败: ' + error.message)
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

// 🆕 添加通知消息
const addNotification = (type: 'workorder' | 'system' | 'task', title: string, message: string, link?: string) => {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  notifications.value.unshift({
    id,
    type,
    title,
    message,
    time: new Date(),
    read: false,
    link
  })
  
  // 最多保留50条消息
  if (notifications.value.length > 50) {
    notifications.value = notifications.value.slice(0, 50)
  }
  
  // 保存到 localStorage
  saveNotifications()
  console.log('📬 新消息:', title, message)
}

// 🆕 标记消息已读
const markAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
    saveNotifications()
  }
}

// 🆕 标记全部已读
const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true)
  saveNotifications()
}

// 🆕 清空所有消息
const clearAllNotifications = () => {
  notifications.value = []
  saveNotifications()
}

// 提供消息操作方法给子组件
provide('markAsRead', markAsRead)
provide('markAllAsRead', markAllAsRead)
provide('clearAllNotifications', clearAllNotifications)

// 🆕 点击通知项
const handleNotificationClick = (item: NotificationItem) => {
  markAsRead(item.id)
  if (item.link) {
    router.push(item.link)
  }
}

// 🆕 格式化时间
const formatTime = (time: Date) => {
  const now = new Date()
  const diff = now.getTime() - new Date(time).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return new Date(time).toLocaleDateString()
}

// 🆕 检查工单更新并添加到消息中心
const checkWorkorderUpdates = async () => {
  try {
    // 检查是否有工单相关权限
    const hasWorkorderPermission = menuPermissions.value.length === 0 || 
      menuPermissions.value.includes('data_workorder') ||
      menuPermissions.value.includes('workorder_submit') ||
      menuPermissions.value.includes('workorder_my') ||
      menuPermissions.value.includes('workorder_manage')
    
    if (!hasWorkorderPermission) return
    
    const isITAdmin = menuPermissions.value.includes('workorder_manage')
    
    // IT管理员：检查新工单
    if (isITAdmin) {
      const statsResult = await window.electronAPI.workorder.getStats()
      if (statsResult.success) {
        const stats = statsResult.data
        const pendingCount = stats.pending || 0
        
        // 有新工单
        if (pendingCount > lastWorkorderStats.pending && lastWorkorderStats.pending > 0) {
          const newCount = pendingCount - lastWorkorderStats.pending
          addNotification(
            'workorder',
            '新工单提醒',
            `有 ${newCount} 个新的字段申请待处理`,
            '/factor-library/workorder/admin'
          )
        }
        
        lastWorkorderStats.pending = pendingCount
      }
    }
    
    // 普通用户：检查自己工单的状态变化
    const myResult = await window.electronAPI.workorder.getMyList({ page: 1, page_size: 20 })
    if (myResult.success && myResult.data?.list) {
      const myList = myResult.data.list
      
      let statusChanged = false
      
      myList.forEach((item: any) => {
        const workorderId = String(item.id)
        const currentStatus = item.status
        const lastStatus = notifiedWorkorderStatus.value[workorderId]
        
        // 首次记录或状态发生变化
        if (lastStatus === undefined) {
          // 首次加载，只记录状态，不通知
          notifiedWorkorderStatus.value[workorderId] = currentStatus
          statusChanged = true
        } else if (lastStatus !== currentStatus && currentStatus !== 'pending') {
          // 状态发生变化，且不是变回 pending
          const statusText: Record<string, string> = {
            processing: '已被接单，正在处理中',
            completed: '已完成',
            rejected: '已被拒绝'
          }
          
          if (statusText[currentStatus]) {
            addNotification(
              'workorder',
              '工单状态更新',
              `您的工单"${item.field_name}"${statusText[currentStatus]}`,
              `/factor-library/workorder/detail/${item.id}`
            )
          }
          
          // 更新记录的状态
          notifiedWorkorderStatus.value[workorderId] = currentStatus
          statusChanged = true
        }
      })
      
      // 状态有变化时保存到 localStorage
      if (statusChanged) {
        saveNotifiedStatus()
      }
    }
  } catch (error: any) {
    console.error('检查工单更新失败:', error)
  }
}

// 🆕 检查回测任务状态并添加通知
const checkBacktestTaskUpdates = async () => {
  try {
    // 检查是否有因子回测权限
    const hasBacktestPermission = menuPermissions.value.length === 0 || 
      menuPermissions.value.includes('backtest_tasks') ||
      menuPermissions.value.includes('factor_backtest')
    
    if (!hasBacktestPermission) {
      console.log('🔕 无回测权限，跳过任务检查')
      return
    }
    
    // 获取最近的回测任务（只获取最近50个，增加覆盖范围）
    const result = await window.electronAPI.backtest.getTasks({
      page: 1,
      page_size: 50
    })
    
    if (!result.success || !result.data?.tasks) {
      console.log('🔕 获取任务列表失败或无数据:', result)
      return
    }
    
    const tasks = result.data.tasks
    let statusChanged = false
    let notifiedCount = 0
    
    console.log(`🔍 检查 ${tasks.length} 个回测任务状态...`)
    
    tasks.forEach((task: any) => {
      const taskId = task.task_id
      const currentStatus = task.status
      const lastStatus = notifiedTaskStatus.value[taskId]
      
      // 首次记录或状态发生变化
      if (lastStatus === undefined) {
        // 首次加载，只记录状态，不通知
        notifiedTaskStatus.value[taskId] = currentStatus
        statusChanged = true
      } else if (lastStatus !== currentStatus) {
        console.log(`📢 任务 ${taskId} 状态变化: ${lastStatus} → ${currentStatus}`)
        
        // 状态发生变化，只在完成或失败时通知
        if (currentStatus === 'completed') {
          addNotification(
            'task',
            '回测任务完成',
            `因子回测任务"${task.task_name || taskId}"已完成`,
            `/factor-library/backtest/result/${taskId}`
          )
          notifiedCount++
        } else if (currentStatus === 'failed') {
          addNotification(
            'task',
            '回测任务失败',
            `因子回测任务"${task.task_name || taskId}"执行失败`,
            `/factor-library/backtest/result/${taskId}`
          )
          notifiedCount++
        }
        
        // 更新记录的状态
        notifiedTaskStatus.value[taskId] = currentStatus
        statusChanged = true
      }
    })
    
    if (notifiedCount > 0) {
      console.log(`🔔 本次新增 ${notifiedCount} 条通知`)
    }
    
    // 状态有变化时保存到 localStorage
    if (statusChanged) {
      saveNotifiedTaskStatus()
    }
  } catch (error: any) {
    console.error('检查回测任务更新失败:', error)
  }
}

// 🆕 启动消息中心定时检查（每10秒）
const startNotificationRefresh = () => {
  if (notificationRefreshTimer) {
    clearInterval(notificationRefreshTimer)
  }
  
  // 先立即检查一次
  checkWorkorderUpdates()
  checkBacktestTaskUpdates()
  
  // 每10秒检查一次
  notificationRefreshTimer = setInterval(() => {
    checkWorkorderUpdates()
    checkBacktestTaskUpdates()
  }, 10000)
  
  console.log('⏰ 消息中心定时检查已启动（每10秒）')
}

// 🆕 停止消息中心检查
const stopNotificationRefresh = () => {
  if (notificationRefreshTimer) {
    clearInterval(notificationRefreshTimer)
    notificationRefreshTimer = null
    console.log('⏹️ 消息中心定时检查已停止')
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
  
  // 监听更新下载完成（静默下载完成后显示"更新已就绪"按钮）
  window.electronAPI.on('updater:update-downloaded', (filePath: string) => {
    updateFilePath.value = filePath
    updateReady.value = true
    console.log('更新已就绪:', filePath)
  })

  window.electronAPI.on('updater:error', (error: any) => {
    console.error('更新下载失败:', error?.message || error)
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
    
    // 🆕 启动消息中心检查
    startNotificationRefresh()
  }, 100)
})

onUnmounted(() => {
  if (statusRefreshTimer) {
    clearInterval(statusRefreshTimer)
    statusRefreshTimer = null
  }
  stopPermissionRefresh()
  stopDatasourceRefresh()
  stopNotificationRefresh()
})
</script>

<style lang="scss">
.app-container {
  height: 100vh;
  background: #f5f5f5;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;

  .app-sidebar {
    background: #ffffff;
    color: #303133;
    display: flex;
    flex-direction: column;
    transition: width 0.3s;
    position: relative;
    overflow-x: hidden !important;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    margin-right: 12px;

    .app-logo {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-bottom: none;

      .logo-image {
        max-width: 100%;
        max-height: 40px;
        object-fit: contain;
      }
    }

    .menu-scrollbar {
      flex: 1;
      min-height: 0;
    }

    .app-menu {
      background: transparent;
      border: none;
      overflow-x: hidden;
      padding: 8px 0;

      .el-sub-menu {
        .el-sub-menu__title {
          color: #606266;
          border-radius: 0;
          margin: 0 8px;
          transition: all 0.2s;

          &:hover {
            background: #f5f7fa;
            color: #303133;
          }
        }
      }

      .el-menu-item {
        color: #606266;
        border-radius: 0;
        margin: 0 8px;
        transition: all 0.2s;

        &:hover {
          background: #f5f7fa;
          color: #303133;
        }

        &.is-active {
          background: #f0f0f0;
          color: #303133;
          font-weight: 500;
        }
      }
    }

    .el-sub-menu__icon-arrow {
      color: #909399;
    }

    :deep(.el-sub-menu) {
      .el-menu {
        background-color: transparent !important;

        .el-menu-item {
          background-color: transparent !important;
          color: #909399 !important;
          padding-left: 50px !important;
          margin: 0 8px;
          transition: all 0.2s;

          &:hover {
            background-color: #f5f7fa !important;
            color: #303133 !important;
          }

          &.is-active {
            background-color: #f0f0f0 !important;
            color: #303133 !important;
            font-weight: 500;
          }
        }
      }
    }
  }
  
  
  .app-sidebar {
    .sidebar-footer {
      padding: 16px 12px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;

      .version-text {
        font-size: 11px;
        color: #c0c4cc;
      }

      .collapse-btn {
        position: absolute;
        right: 12px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #c0c4cc;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
          background: #f5f7fa;
          color: #606266;
        }
      }
    }

    &.sidebar-collapsed {
      overflow: hidden !important;
      
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

        :deep(.el-menu-item),
        :deep(.el-sub-menu__title) {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          padding: 0 !important;
          margin: 0 !important;
          text-align: center !important;
          width: 100% !important;
        }
      }
    }
  }
  
  .app-content {
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    background: #ffffff;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background: #f5f7fa;
    box-shadow: none;
    border-bottom: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 0 20px;
    flex-shrink: 0;
    -webkit-app-region: drag;

    .header-left,
    .header-right {
      -webkit-app-region: no-drag;
    }
    
    .header-left h2 {
      margin: 0;
      font-size: 18px;
      color: #303133;
      display: flex;
      align-items: center;
      gap: 6px;

      .crumb-sep {
        color: #c0c4cc;
        font-weight: 400;
        font-size: 14px;
      }

      .crumb-current {
        font-weight: 600;
      }
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .window-controls {
      display: flex;
      align-items: center;
      gap: 0;
      margin-left: 8px;
      -webkit-app-region: no-drag;

      .win-btn {
        width: 32px;
        height: 28px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #606266;
        transition: background 0.15s;

        &:hover {
          background: #e9ecef;
        }

        &.win-close:hover {
          background: #e81123;
          color: #fff;
        }
      }
    }
  }
  
  .app-main {
    background: #f5f7fa;
    padding: 20px;
    overflow: hidden !important;
    flex: 1;
    min-height: 0;
    height: 0;
    display: flex;
    flex-direction: column;
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

</style>

<style lang="scss">
/* 折叠模式下弹出菜单卡片样式 */
.el-popper.sidebar-popper {
  border-radius: 8px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
  border: none !important;
  padding: 0 !important;
  overflow: hidden;

  .el-menu {
    border: none !important;
    background: #ffffff !important;
    padding: 4px;
  }

  .el-menu-item {
    border-radius: 4px;
    margin: 1px 0;
    height: 32px;
    line-height: 32px;
    font-size: 13px;
    color: #606266 !important;

    &:hover {
      background: #f5f7fa !important;
      color: #303133 !important;
    }

    &.is-active {
      background: #f0f0f0 !important;
      color: #303133 !important;
      font-weight: 500;
    }
  }
}

/* 全局样式：强制覆盖Element Plus子菜单 */
.app-sidebar .el-sub-menu .el-menu {
  background-color: transparent !important;
}

/* 折叠模式下图标居中 */
.app-sidebar.sidebar-collapsed .el-menu-item,
.app-sidebar.sidebar-collapsed .el-sub-menu__title {
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item {
  background-color: transparent !important;
  color: #909399 !important;
  padding-left: 50px !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item:hover {
  background-color: #f5f7fa !important;
  color: #303133 !important;
}

.app-sidebar .el-sub-menu .el-menu .el-menu-item.is-active {
  background-color: #f0f0f0 !important;
  color: #303133 !important;
  font-weight: 500;
}

/* 消息中心样式 */
.notification-badge {
  margin-right: 12px;
}

.notification-panel {
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid #eee;
    margin-bottom: 12px;
    
    .panel-title {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }
    
    .panel-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  .notification-list {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .notification-item {
    display: flex;
    align-items: flex-start;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    position: relative;
    
    &:hover {
      background: #f5f7fa;
    }
    
    &.unread {
      background: #ecf5ff;
      
      &:hover {
        background: #d9ecff;
      }
    }
    
    .notification-icon {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }
    
    .notification-content {
      flex: 1;
      min-width: 0;
      
      .notification-title {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        margin-bottom: 4px;
      }
      
      .notification-message {
        font-size: 13px;
        color: #606266;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .notification-time {
        font-size: 12px;
        color: #909399;
      }
    }
    
    .notification-dot {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f56c6c;
    }
  }
}
</style>
