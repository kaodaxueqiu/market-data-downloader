import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { menuId: 'home' }
  },
  {
    path: '/data-center',
    name: 'DataCenter',
    component: () => import('../views/DataCenter/index.vue'),
    meta: { menuId: 'data_center' }
  },
  {
    path: '/factor-library',
    name: 'FactorLibrary',
    component: () => import('../views/FactorLibrary.vue'),
    meta: { menuId: 'factor_library' }
  },
  {
    path: '/fund-management',
    name: 'FundManagement',
    component: () => import('../views/FundManagement/index.vue'),
    // 不设置默认 redirect，让用户自己点击子菜单
    meta: { menuId: 'fund_management' },
    children: [
      {
        path: 'list',
        name: 'FundList',
        component: () => import('../views/FundManagement/List.vue'),
        meta: { menuId: 'fund_list' }
      },
      {
        path: 'performance',
        name: 'FundPerformance',
        component: () => import('../views/FundManagement/Performance.vue'),
        meta: { menuId: 'fund_performance' }
      },
      {
        path: 'position',
        name: 'FundPosition',
        component: () => import('../views/FundManagement/Position.vue'),
        meta: { menuId: 'fund_position' }
      },
      {
        path: 'operations',
        name: 'FundOperations',
        component: () => import('../views/FundManagement/Operations.vue'),
        meta: { menuId: 'fund_operation' }
      }
    ]
  },
  {
    path: '/download',
    name: 'Download',
    component: () => import('../views/QueryAndExport.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue'),
    meta: { menuId: 'task_management' }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { menuId: 'history' }
  },
  {
    path: '/dictionary',
    name: 'DataDictionary',
    component: () => import('../views/DataDictionary.vue')
  },
  {
    path: '/database-dictionary',
    name: 'DatabaseDictionary',
    component: () => import('../views/DatabaseDictionary.vue')
  },
  {
    path: '/static-data-download',
    name: 'StaticDataDownload',
    component: () => import('../views/StaticDataDownload.vue')
  },
  {
    path: '/sdk-download',
    name: 'SDKDownload',
    component: () => import('../views/SDKDownload.vue'),
    meta: { menuId: 'sdk_download' }
  },
  {
    path: '/api-key-management',
    name: 'ApiKeyManagement',
    component: () => import('../views/ApiKeyManagement.vue'),
    meta: { menuId: 'api_key_management' }
  },
  {
    path: '/monitoring',
    name: 'Monitoring',
    redirect: '/monitoring/redis',
    meta: { menuId: 'system_monitor' },
    children: [
      {
        path: 'redis',
        name: 'MonitoringRedis',
        component: () => import('../views/Monitoring/Redis.vue'),
        meta: { menuId: 'redis_monitor' }
      },
      {
        path: 'redis/:market',
        name: 'MonitoringRedisDetail',
        component: () => import('../views/Monitoring/RedisDetail.vue'),
        meta: { menuId: 'redis_monitor' }
      },
      {
        path: 'redis/:market/:port',
        name: 'MonitoringRedisDB',
        component: () => import('../views/Monitoring/RedisDB.vue'),
        meta: { menuId: 'redis_monitor' }
      },
      {
        path: 'markets',
        name: 'MonitoringMarkets',
        component: () => import('../views/Monitoring/Markets.vue'),
        meta: { menuId: 'market_monitor' }
      },
      {
        path: 'markets/:market',
        name: 'MonitoringMarketsDetail',
        component: () => import('../views/Monitoring/MarketsDetail.vue'),
        meta: { menuId: 'market_monitor' }
      },
      {
        path: 'services',
        name: 'MonitoringServices',
        component: () => import('../views/Monitoring/Services.vue'),
        meta: { menuId: 'service_monitor' }
      },
      {
        path: 'kafka',
        name: 'MonitoringKafka',
        component: () => import('../views/Monitoring/KafkaDetail.vue'),
        meta: { menuId: 'service_monitor' }
      },
      {
        path: 'api-gateway',
        name: 'MonitoringAPIGateway',
        component: () => import('../views/Monitoring/APIGatewayDetail.vue'),
        meta: { menuId: 'service_monitor' }
      },
      {
        path: 'redis-indexer',
        name: 'MonitoringRedisIndexer',
        component: () => import('../views/Monitoring/RedisIndexerDetail.vue'),
        meta: { menuId: 'service_monitor' }
      },
      {
        path: 'opensearch',
        name: 'MonitoringOpenSearch',
        component: () => import('../views/Monitoring/OpenSearchDetail.vue'),
        meta: { menuId: 'service_monitor' }
      },
      {
        path: 'clickhouse-cron',
        name: 'MonitoringClickHouseCron',
        component: () => import('../views/Monitoring/ClickHouseCron.vue'),
        meta: { menuId: 'clickhouse_tasks' }
      },
      {
        path: 'clickhouse-cron/:jobName',
        name: 'MonitoringClickHouseCronDetail',
        component: () => import('../views/Monitoring/ClickHouseCronDetail.vue'),
        meta: { menuId: 'clickhouse_tasks' }
      }
    ]
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { menuId: 'settings' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 存储用户菜单权限
let userMenuPermissions: string[] = []

// 设置菜单权限（由 App.vue 调用）
export function setMenuPermissions(permissions: string[]) {
  userMenuPermissions = permissions
}

// 路由守卫 - 检查菜单权限
router.beforeEach((to, _from, next) => {
  const menuId = to.meta?.menuId as string
  
  // 特殊处理：访问 /fund-management 时，自动跳转到第一个有权限的子路由
  if (to.path === '/fund-management') {
    const subRoutes = [
      { path: '/fund-management/list', menuId: 'fund_list' },
      { path: '/fund-management/performance', menuId: 'fund_performance' },
      { path: '/fund-management/position', menuId: 'fund_position' },
      { path: '/fund-management/operations', menuId: 'fund_operation' }
    ]
    
    // 找到第一个有权限的子路由
    const allowedRoute = subRoutes.find(r => userMenuPermissions.includes(r.menuId))
    
    if (allowedRoute) {
      console.log('🔀 自动跳转到:', allowedRoute.path)
      next(allowedRoute.path)
      return
    } else if (userMenuPermissions.includes('fund_management')) {
      // 有父菜单权限但没有子菜单权限，显示提示
      console.warn('⚠️ 有基金管理权限，但没有子菜单权限')
      next('/')  // 跳转到首页
      return
    }
  }
  
  // 如果路由有 menuId，检查权限
  if (menuId) {
    if (userMenuPermissions.length === 0 || userMenuPermissions.includes(menuId)) {
      // 有权限，放行
      next()
    } else {
      // 无权限，跳转到首页
      console.warn('⛔ 无权访问:', to.path, '缺少菜单权限:', menuId)
      next('/')
    }
  } else {
    // 没有 menuId 的路由直接放行
    next()
  }
})

export default router
