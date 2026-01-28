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
    component: () => import('../views/FactorLibrary/index.vue'),
    meta: { menuId: 'factor_library' },
    children: [
      {
        path: 'plaza',
        name: 'FactorPlaza',
        component: () => import('../views/FactorLibrary/Plaza.vue'),
        meta: { menuId: 'factor_plaza' }
      },
      {
        path: 'my-factors',
        name: 'MyFactors',
        component: () => import('../views/FactorLibrary/MyFactors.vue'),
        meta: { menuId: 'my_factors' }
      },
      {
        path: 'submit',
        name: 'FactorSubmit',
        component: () => import('../views/FactorLibrary/Submit.vue'),
        meta: { menuId: 'factor_submit' }
      },
      {
        path: 'backtest/submit',
        name: 'FactorBacktestSubmit',
        component: () => import('../views/FactorLibrary/Backtest/Main.vue'),
        meta: { menuId: 'backtest_submit' }
      },
      {
        path: 'backtest/tasks',
        name: 'FactorBacktestTasks',
        component: () => import('../views/FactorLibrary/Backtest/Main.vue'),
        meta: { menuId: 'backtest_tasks' }
      },
      {
        path: 'backtest/result',
        name: 'FactorBacktestResults',
        component: () => import('../views/FactorLibrary/Backtest/Main.vue'),
        meta: { menuId: 'backtest_result' }
      },
      {
        path: 'backtest/result/:taskId',
        name: 'FactorBacktestResultDetail',
        component: () => import('../views/FactorLibrary/Backtest/Main.vue'),
        meta: { menuId: 'backtest_result' }
      },
      {
        path: 'backtest/expression-dict',
        name: 'ExpressionDict',
        component: () => import('../views/FactorLibrary/Backtest/Main.vue'),
        meta: { menuId: 'expression_dict' }
      },
      // 数据工单
      {
        path: 'workorder/submit',
        name: 'WorkOrderSubmit',
        component: () => import('../views/FactorLibrary/WorkOrder/Main.vue'),
        meta: { menuId: 'workorder_submit' }
      },
      {
        path: 'workorder/my',
        name: 'WorkOrderMy',
        component: () => import('../views/FactorLibrary/WorkOrder/Main.vue'),
        meta: { menuId: 'workorder_my' }
      },
      {
        path: 'workorder/admin',
        name: 'WorkOrderAdmin',
        component: () => import('../views/FactorLibrary/WorkOrder/Main.vue'),
        meta: { menuId: 'workorder_manage' }
      },
      {
        path: 'workorder/detail/:id',
        name: 'WorkOrderDetail',
        component: () => import('../views/FactorLibrary/WorkOrder/Main.vue'),
        meta: { menuId: 'workorder_my' }
      }
    ]
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
    path: '/code-repository',
    name: 'CodeRepository',
    component: () => import('../views/CodeRepository/index.vue'),
    meta: { menuId: 'code_repository' },
    children: [
      {
        path: 'repos',
        name: 'CodeRepositoryRepos',
        component: () => import('../views/CodeRepository/Repos.vue'),
        meta: { menuId: 'my_repos' }
      },
      {
        path: 'repos/:repoName',
        name: 'CodeRepositoryRepoDetail',
        component: () => import('../views/CodeRepository/RepoDetail.vue'),
        meta: { menuId: 'my_repos' }
      },
      {
        path: 'repos/:repoName/execute',
        name: 'CodeRepositoryRepoExecute',
        component: () => import('../views/CodeRepository/RepoExecute.vue'),
        meta: { menuId: 'execute_model' }
      },
      {
        path: 'execute',
        name: 'CodeRepositoryExecute',
        component: () => import('../views/CodeRepository/Execute.vue'),
        meta: { menuId: 'execute_model' }
      },
      {
        path: 'history',
        name: 'CodeRepositoryHistory',
        component: () => import('../views/CodeRepository/History.vue'),
        meta: { menuId: 'execute_history' }
      },
      {
        path: 'history/:taskId',
        name: 'CodeRepositoryTaskDetail',
        component: () => import('../views/CodeRepository/TaskDetail.vue'),
        meta: { menuId: 'execute_history' }
      },
      {
        path: 'admin',
        name: 'CodeRepositoryAdmin',
        component: () => import('../views/CodeRepository/Admin.vue'),
        meta: { menuId: 'repo_admin' }
      }
    ]
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
  
  // 特殊处理：访问 /code-repository 时，自动跳转到第一个有权限的子路由
  if (to.path === '/code-repository') {
    const subRoutes = [
      { path: '/code-repository/repos', menuId: 'my_repos' },
      { path: '/code-repository/execute', menuId: 'execute_model' },
      { path: '/code-repository/history', menuId: 'execute_history' },
      { path: '/code-repository/admin', menuId: 'repo_admin' }
    ]
    
    // 找到第一个有权限的子路由
    const allowedRoute = subRoutes.find(r => userMenuPermissions.includes(r.menuId))
    
    if (allowedRoute) {
      console.log('🔀 自动跳转到:', allowedRoute.path)
      next(allowedRoute.path)
      return
    } else if (userMenuPermissions.includes('code_repository')) {
      // 有父菜单权限但没有子菜单权限，显示提示
      console.warn('⚠️ 有代码仓库权限，但没有子菜单权限')
      next('/')  // 跳转到首页
      return
    }
  }
  
  // 特殊处理：访问 /factor-library 时，自动跳转到第一个有权限的子路由
  if (to.path === '/factor-library') {
    const subRoutes = [
      { path: '/factor-library/plaza', menuId: 'factor_plaza' },
      { path: '/factor-library/my-factors', menuId: 'my_factors' },
      { path: '/factor-library/submit', menuId: 'factor_submit' }
    ]
    
    // 找到第一个有权限的子路由
    const allowedRoute = subRoutes.find(r => userMenuPermissions.includes(r.menuId))
    
    if (allowedRoute) {
      console.log('🔀 自动跳转到:', allowedRoute.path)
      next(allowedRoute.path)
      return
    } else if (userMenuPermissions.includes('factor_library')) {
      // 有父菜单权限但没有子菜单权限，显示提示
      console.warn('⚠️ 有因子库权限，但没有子菜单权限')
      next('/')  // 跳转到首页
      return
    }
  }
  
  // 特殊处理：访问 /factor-library/backtest 时，自动跳转到第一个有权限的三级菜单
  if (to.path === '/factor-library/backtest') {
    const subRoutes = [
      { path: '/factor-library/backtest/submit', menuId: 'backtest_submit' },
      { path: '/factor-library/backtest/tasks', menuId: 'backtest_tasks' },
      { path: '/factor-library/backtest/result', menuId: 'backtest_result' },
      { path: '/factor-library/backtest/expression-dict', menuId: 'expression_dict' }
    ]
    
    // 找到第一个有权限的子路由
    const allowedRoute = subRoutes.find(r => userMenuPermissions.includes(r.menuId))
    
    if (allowedRoute) {
      console.log('🔀 自动跳转到:', allowedRoute.path)
      next(allowedRoute.path)
      return
    } else if (userMenuPermissions.includes('factor_backtest')) {
      // 有二级菜单权限但没有三级菜单权限
      console.warn('⚠️ 有因子回测权限，但没有三级菜单权限')
      next('/')
      return
    }
  }
  
  // 特殊处理：访问 /factor-library/workorder 时，自动跳转到第一个有权限的三级菜单
  if (to.path === '/factor-library/workorder') {
    const subRoutes = [
      { path: '/factor-library/workorder/submit', menuId: 'workorder_submit' },
      { path: '/factor-library/workorder/my', menuId: 'workorder_my' },
      { path: '/factor-library/workorder/admin', menuId: 'workorder_manage' }
    ]
    
    // 找到第一个有权限的子路由
    const allowedRoute = subRoutes.find(r => userMenuPermissions.includes(r.menuId))
    
    if (allowedRoute) {
      console.log('🔀 自动跳转到:', allowedRoute.path)
      next(allowedRoute.path)
      return
    } else if (userMenuPermissions.includes('data_workorder')) {
      // 有二级菜单权限但没有三级菜单权限
      console.warn('⚠️ 有数据工单权限，但没有三级菜单权限')
      next('/')
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
