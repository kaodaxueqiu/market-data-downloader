/**
 * 统一菜单配置
 * App.vue 侧边栏和 Home.vue 首页卡片都从这里读取
 * 新增菜单只需要在这里添加即可！
 */

import {
  House,
  Connection,
  Box,
  Coin,
  Folder,
  List,
  Clock,
  Download,
  Key,
  Monitor,
  Setting,
  DataBoard,
  TrendCharts,
  Grid
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

// 菜单项类型定义
export interface MenuItem {
  id: string              // 菜单ID，用于权限匹配
  name: string            // 菜单名称
  path: string            // 路由路径
  icon: Component | null  // 图标组件
  color?: string          // 卡片颜色（首页用）
  description?: string    // 描述（首页卡片用）
  children?: MenuItem[]   // 子菜单
  tag?: { text: string; type: 'success' | 'warning' | 'danger' | 'info' }  // 标签
  showInHome?: boolean    // 是否在首页显示卡片，默认 true
}

// 所有菜单配置（一级菜单）
export const allMenus: MenuItem[] = [
  { 
    id: 'home', 
    name: '首页', 
    path: '/', 
    icon: House,
    showInHome: false  // 首页不在首页卡片中显示
  },
  { 
    id: 'data_center', 
    name: '数据中心', 
    path: '/data-center', 
    icon: Connection,
    color: '#409EFF',
    description: '查询市场数据、财务数据'
  },
  { 
    id: 'factor_library', 
    name: '因子库', 
    path: '/factor-library', 
    icon: Box,
    color: '#67C23A',
    description: '因子数据管理与查询'
  },
  { 
    id: 'fund_management', 
    name: '基金管理', 
    path: '/fund-management', 
    icon: Coin,
    color: '#E6A23C',
    description: '基金运维、净值、申赎',
    children: [
      { id: 'fund_list', name: '基金列表', path: '/fund-management/list', icon: null },
      { id: 'fund_performance', name: '业绩分析', path: '/fund-management/performance', icon: null },
      { id: 'fund_position', name: '持仓分析', path: '/fund-management/position', icon: null },
      { 
        id: 'fund_operation', 
        name: '基金运维', 
        path: '/fund-management/operations', 
        icon: null,
        children: [
          { id: 'fund_info_manage', name: '基金信息管理', path: '/fund-management/operations#fund', icon: null },
          { id: 'fund_basic_info', name: '基础信息维护', path: '/fund-management/operations#basicinfo', icon: null },
          { id: 'fund_subscription', name: '申购赎回', path: '/fund-management/operations#transaction', icon: null },
          { id: 'fund_nav_manage', name: '净值管理', path: '/fund-management/operations#netvalue', icon: null },
          { id: 'fund_report_manage', name: '报告管理', path: '/fund-management/operations#report', icon: null },
          { id: 'fund_investor_manage', name: '投资者管理', path: '/fund-management/operations#investor', icon: null }
        ]
      }
    ]
  },
  { 
    id: 'code_repository', 
    name: '代码仓库', 
    path: '/code-repository', 
    icon: Folder,
    color: '#73C0DE',
    description: '代码版本管理与模型执行',
    children: [
      { id: 'my_repos', name: '我的仓库', path: '/code-repository/repos', icon: null },
      { id: 'execute_model', name: '执行模型', path: '/code-repository/execute', icon: null },
      { id: 'execute_history', name: '执行记录', path: '/code-repository/history', icon: null },
      { id: 'repo_admin', name: '仓库管理', path: '/code-repository/admin', icon: null }
    ]
  },
  { 
    id: 'task_management', 
    name: '任务管理', 
    path: '/tasks', 
    icon: List,
    color: '#F56C6C',
    description: '查看数据任务状态'
  },
  { 
    id: 'history', 
    name: '历史记录', 
    path: '/history', 
    icon: Clock,
    color: '#909399',
    description: '查看操作历史'
  },
  { 
    id: 'sdk_download', 
    name: 'SDK下载', 
    path: '/sdk-download', 
    icon: Download,
    color: '#5470C6',
    description: '下载开发工具包'
  },
  { 
    id: 'api_key_management', 
    name: 'API Key管理', 
    path: '/api-key-management', 
    icon: Key,
    color: '#91CC75',
    description: '管理用户和权限'
  },
  { 
    id: 'system_monitor', 
    name: '系统监控', 
    path: '/monitoring', 
    icon: Monitor,
    color: '#EE6666',
    description: 'Redis/市场/服务/定时任务监控',
    children: [
      { id: 'redis_monitor', name: 'Redis监控', path: '/monitoring/redis', icon: DataBoard },
      { id: 'market_monitor', name: '市场监控', path: '/monitoring/markets', icon: TrendCharts },
      { id: 'service_monitor', name: '服务监控', path: '/monitoring/services', icon: Grid },
      { id: 'clickhouse_tasks', name: 'ClickHouse定时任务', path: '/monitoring/clickhouse-cron', icon: Clock }
    ]
  },
  { 
    id: 'settings', 
    name: '系统设置', 
    path: '/settings', 
    icon: Setting,
    color: '#FAC858',
    description: '系统参数配置'
  }
]

// 获取首页要展示的模块（过滤掉 showInHome: false 的）
export const getHomeModules = () => {
  return allMenus.filter(menu => menu.showInHome !== false)
}

// 获取某个菜单的第一个可用路径（如果有子菜单，返回第一个子菜单路径）
export const getMenuFirstPath = (menu: MenuItem): string => {
  if (menu.children && menu.children.length > 0) {
    return getMenuFirstPath(menu.children[0])
  }
  return menu.path
}

