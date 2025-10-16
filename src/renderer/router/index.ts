import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/data-center',
    name: 'DataCenter',
    component: () => import('../views/DataCenter/index.vue')
  },
  {
    path: '/download',
    name: 'Download',
    component: () => import('../views/QueryAndExport.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue')
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
    component: () => import('../views/SDKDownload.vue')
  },
  {
    path: '/api-key-management',
    name: 'ApiKeyManagement',
    component: () => import('../views/ApiKeyManagement.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
