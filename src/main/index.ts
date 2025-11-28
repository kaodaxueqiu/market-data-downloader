import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import axios from 'axios'
import downloadManager from './download'
import staticDownloadManager from './staticDownload'
import { ConfigManager } from './config'
import { getDictionaryAPI } from './dictionary'
import { getDbDictAPI } from './dbdict'
import { factorAPI } from './factor'
import { getFundAPI } from './fund'
import * as updater from './updater'
import { SubscriptionTaskManager } from './subscriptionTaskManager'

// 禁用GPU加速，避免Windows上的GPU崩溃问题
app.disableHardwareAcceleration()

// 配置存储 - 延迟初始化，确保app准备就绪
let store: Store
let configManager: ConfigManager

// 主窗口
let mainWindow: BrowserWindow | null = null

// 更新检查定时器
let updateCheckTimer: NodeJS.Timeout | null = null

// 初始化函数
function initializeServices() {
  store = new Store()
  // downloadManager已经通过import导入
  configManager = new ConfigManager(store)
  console.log('服务初始化完成')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: join(__dirname, '../../public/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  })

  // 🔒 隐藏原生菜单栏（File、Edit、View等）
  Menu.setApplicationMenu(null)

  // 捕获渲染进程崩溃
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('❌ 渲染进程崩溃:', JSON.stringify(details))
    console.error('原因:', details.reason)
    console.error('退出码:', details.exitCode)
  })

  // 捕获加载失败
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('❌ 页面加载失败:', errorCode, errorDescription)
  })

  // 捕获所有控制台消息
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}]`, message, `(${sourceId}:${line})`)
  })

  // 捕获崩溃前的日志
  mainWindow.webContents.on('destroyed', () => {
    console.log('⚠️ webContents被销毁')
  })

  // 开发环境
  if (process.env.NODE_ENV === 'development') {
    console.log('正在加载开发服务器: http://localhost:5173')
    
    // 延迟加载，确保Vite服务器准备就绪
    let retryCount = 0
    const maxRetries = 10
    
    const loadURL = async () => {
      try {
        retryCount++
        console.log(`🔄 尝试加载页面... (第${retryCount}次)`)
        await mainWindow!.loadURL('http://localhost:5173')
        console.log('✅ 页面加载成功！')
        // 开发模式下启用DevTools
        mainWindow!.webContents.openDevTools()
      } catch (error: any) {
        console.error(`❌ 页面加载失败 (第${retryCount}次):`, error.message)
        if (retryCount < maxRetries) {
          console.log(`⏳ 2秒后重试...`)
          setTimeout(loadURL, 2000)
        } else {
          console.error('❌ 重试次数已达上限，放弃加载')
        }
      }
    }
    
    // 等待3秒确保Vite服务器完全启动
    console.log('⏰ 3秒后开始加载页面...')
    setTimeout(loadURL, 3000)
  } else {
    mainWindow.loadFile(join(__dirname, '../../renderer/index.html'))
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    
    // 🔧 仅在开发模式下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
      mainWindow?.webContents.openDevTools()
    }
    
    // 生产模式下启动时自动检查更新，并启动定期检查
    if (process.env.NODE_ENV !== 'development') {
      // 首次检查：5秒后
      setTimeout(async () => {
        try {
          console.log('🔍 启动时自动检查更新...')
          const updateInfo = await updater.checkForUpdates()
          
          if (updateInfo && mainWindow && !mainWindow.isDestroyed()) {
            // 显示更新提示
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '发现新版本',
              message: `发现新版本 v${updateInfo.version}`,
              detail: updateInfo.release_notes,
              buttons: ['立即更新', '稍后提醒'],
              defaultId: 0,
              cancelId: 1
            })
            
            if (result.response === 0) {
              // 用户选择立即更新，直接下载
              try {
                // 显示保存对话框
                const platform = process.platform
                const filename = platform === 'win32' 
                  ? `Market-Data-Downloader-${updateInfo.version}.exe`
                  : `Market-Data-Downloader-${updateInfo.version}-mac.zip`
                
                const defaultPath = join(app.getPath('downloads'), filename)
                
                const saveResult = await dialog.showSaveDialog(mainWindow, {
                  title: '选择保存位置',
                  defaultPath: defaultPath,
                  buttonLabel: '开始下载',
                  filters: [
                    { 
                      name: platform === 'win32' ? 'Windows应用程序' : 'macOS应用程序', 
                      extensions: platform === 'win32' ? ['exe'] : ['zip'] 
                    }
                  ]
                })
                
                if (saveResult.canceled || !saveResult.filePath) {
                  console.log('用户取消下载')
                  return
                }
                
                const savePath = saveResult.filePath
                console.log('✅ 用户选择保存到:', savePath)
                
                // 开始下载
                const filePath = await updater.downloadUpdateToPath(
                  updateInfo, 
                  savePath,
                  (percent, _status) => {
                    mainWindow?.webContents.send('updater:download-progress', {
                      percent,
                      transferred: 0,
                      total: updateInfo.downloads.windows?.size || 0
                    })
                  }
                )
                
                console.log('✅ 下载完成:', filePath)
                
                // 自动打开安装
                await updater.installUpdate(filePath)
                
              } catch (error: any) {
                console.error('❌ 下载失败:', error)
                if (!error.message.includes('用户取消')) {
                  dialog.showErrorBox('更新失败', error.message || '下载更新失败')
                }
              }
            }
          }
        } catch (error) {
          console.error('自动检查更新失败:', error)
          // 静默失败，不打扰用户
        }
      }, 5000)
      
      // 🆕 启动定期检查：每10分钟检查一次
      updateCheckTimer = setInterval(async () => {
        try {
          console.log('⏰ 定期检查更新（每10分钟）...')
          const updateInfo = await updater.checkForUpdates()
          
          if (updateInfo && mainWindow && !mainWindow.isDestroyed()) {
            // 发现新版本，静默记录（不弹窗打扰用户）
            console.log('✅ 发现新版本:', updateInfo.version)
            // 发送事件到渲染进程，让Settings页面显示提示
            mainWindow.webContents.send('updater:update-available', updateInfo)
          }
        } catch (error) {
          console.error('定期检查更新失败:', error)
          // 静默失败
        }
      }, 10 * 60 * 1000)  // 每10分钟 = 600,000毫秒
    }
  })

  // 窗口关闭处理
  mainWindow.on('closed', () => {
    console.log('窗口已关闭')
    
    // 清理定时器
    if (updateCheckTimer) {
      clearInterval(updateCheckTimer)
      updateCheckTimer = null
    }
    
    mainWindow = null
  })

  // 防止窗口被意外关闭
  mainWindow.on('close', () => {
    console.log('窗口即将关闭')
  })
  
  // 监听窗口是否响应
  mainWindow.on('unresponsive', () => {
    console.error('❌ 窗口无响应')
  })
  
  mainWindow.on('responsive', () => {
    console.log('✅ 窗口恢复响应')
  })
}

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error)
  console.error('堆栈:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason)
  console.error('Promise:', promise)
})

// 应用准备就绪
app.whenReady().then(() => {
  console.log('✅ App准备就绪')
  
  // 禁用代理（解决 ERR_PROXY_CONNECTION_FAILED 错误）
  const { session } = require('electron')
  session.defaultSession.setProxy({ mode: 'direct' })
    .then(() => console.log('✅ 已禁用代理'))
    .catch((err: any) => console.error('⚠️ 设置代理失败:', err))
  
  // 先初始化服务
  try {
    initializeServices()
    console.log('✅ 服务初始化成功')
  } catch (error) {
    console.error('❌ 服务初始化失败:', error)
  }
  
  // 再创建窗口
  try {
    createWindow()
    console.log('✅ 窗口创建成功')
  } catch (error) {
    console.error('❌ 窗口创建失败:', error)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch(error => {
  console.error('❌ App初始化失败:', error)
})

// 所有窗口关闭时退出（除了macOS）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前清理订阅任务
app.on('before-quit', async (event) => {
  if (subscriptionTaskManager || wsManager) {
    console.log('🛑 应用退出，清理资源...')
    event.preventDefault()  // 阻止立即退出
    
    // 停止所有订阅任务
    if (subscriptionTaskManager) {
      await subscriptionTaskManager.stopAllTasks()
      subscriptionTaskManager = null
    }
    
    // 强制断开 WebSocket
    if (wsManager) {
      wsManager.forceDisconnect()
      wsManager = null
    }
    
    app.quit()  // 清理完成后退出
  }
})

// ===== IPC通信处理 =====

// 获取配置
ipcMain.handle('config:get', async (_event, key?: string) => {
  return configManager.get(key)
})

// 设置配置
ipcMain.handle('config:set', async (_event, key: string, value: any) => {
  try {
    return configManager.set(key, value)
  } catch (error) {
    console.error('配置保存错误:', error)
    throw error
  }
})

// 获取API Key列表
ipcMain.handle('config:getApiKeys', async () => {
  return configManager.getApiKeys()
})

// 保存API Key（新版：同时获取数据库凭证）
ipcMain.handle('config:saveApiKeyWithCredentials', async (_event, apiKey: string, name: string, isDefault: boolean) => {
  return configManager.saveApiKeyWithCredentials(apiKey, name, isDefault)
})

// 保存API Key（旧版：兼容）
ipcMain.handle('config:saveApiKey', async (_event, apiKey: string, name: string, isDefault: boolean) => {
  return configManager.saveApiKey(apiKey, name, isDefault)
})

// 获取数据库凭证
ipcMain.handle('config:getDatabaseCredentials', async (_event, apiKeyId: string) => {
  return configManager.getDatabaseCredentials(apiKeyId)
})

// 删除API Key
ipcMain.handle('config:deleteApiKey', async (_event, id: string) => {
  return configManager.deleteApiKey(id)
})

// 获取完整的API Key（用于下载）
ipcMain.handle('config:getFullApiKey', async (_event, id: string) => {
  return configManager.getFullApiKey(id)
})

// 🆕 获取指定Key的菜单权限
ipcMain.handle('config:getMenuPermissions', async (_event, apiKeyId: string) => {
  return configManager.getMenuPermissions(apiKeyId)
})

// 🆕 刷新指定Key的菜单权限
ipcMain.handle('config:refreshMenuPermissions', async (_event, apiKeyId: string) => {
  return configManager.refreshMenuPermissions(apiKeyId)
})

// 🆕 刷新默认Key的菜单权限
ipcMain.handle('config:refreshDefaultKeyPermissions', async () => {
  return configManager.refreshDefaultKeyPermissions()
})

// 🆕 获取所有API Keys（管理接口）
ipcMain.handle('config:fetchAllApiKeys', async () => {
  return configManager.fetchAllApiKeys()
})

// 🆕 吊销API Key（管理接口）
ipcMain.handle('config:revokeApiKey', async (_event, key: string) => {
  return configManager.revokeApiKey(key)
})

// 🆕 激活API Key（管理接口）
ipcMain.handle('config:reactivateApiKey', async (_event, key: string) => {
  return configManager.reactivateApiKey(key)
})

// 🆕 获取API Key详情（管理接口）
ipcMain.handle('config:fetchApiKeyDetail', async (_event, key: string) => {
  return configManager.fetchApiKeyDetail(key)
})

// 🆕 更新API Key基本信息（管理接口）
ipcMain.handle('config:updateApiKey', async (_event, key: string, data: any) => {
  return configManager.updateApiKey(key, data)
})

// 🆕 创建API Key（管理接口）
ipcMain.handle('config:createApiKey', async (_event, data: any) => {
  return configManager.createApiKey(data)
})

// 🆕 删除API Key（管理接口）
ipcMain.handle('config:deleteApiKeyAdmin', async (_event, key: string) => {
  return configManager.deleteApiKeyAdmin(key)
})

// 🆕 获取权限配置（管理接口）
ipcMain.handle('config:fetchPermissionConfig', async (_event, key: string) => {
  return configManager.fetchPermissionConfig(key)
})

// 🆕 获取权限注册表（管理接口）
ipcMain.handle('config:fetchPermissionRegistry', async () => {
  return configManager.fetchPermissionRegistry()
})

// 🆕 更新权限配置（PATCH部分更新）
ipcMain.handle('config:patchPermissionConfig', async (_event, key: string, updates: any) => {
  return configManager.patchPermissionConfig(key, updates)
})

// 🆕 获取数据库配置（独立接口）
ipcMain.handle('config:fetchDatabaseConfig', async (_event, key: string) => {
  return configManager.fetchDatabaseConfig(key)
})

// 🆕 更新数据库配置（独立接口）
ipcMain.handle('config:updateDatabaseConfig', async (_event, key: string, config: any) => {
  return configManager.updateDatabaseConfig(key, config)
})

// ========== Gitea API 调用（避免CORS问题） ==========

const GITEA_BASE_URL = 'http://61.151.241.233:3030/api/v1'
const GITEA_ADMIN_TOKEN = '5441d871f875f3083e0044a337b3fee979c1ae64'

// Gitea: 获取组织仓库列表
ipcMain.handle('gitea:getOrgRepos', async (_event, org: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取组织仓库: ${org}`)
    const response = await axios.get(`${GITEA_BASE_URL}/orgs/${org}/repos`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getOrgRepos 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 获取用户的所有仓库
ipcMain.handle('gitea:getUserRepos', async (_event, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取用户仓库: ${username}`)
    const response = await axios.get(`${GITEA_BASE_URL}/users/${username}/repos`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getUserRepos 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: `状态码 ${error.response?.status}: ${error.response?.data?.message || error.message}` }
  }
})

// Gitea: 获取仓库的协作者列表
ipcMain.handle('gitea:getRepoCollaborators', async (_event, owner: string, repo: string) => {
  try {
    const axios = require('axios')
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}/collaborators`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getRepoCollaborators 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 获取用户作为协作者能访问的仓库（从组织仓库中过滤）
ipcMain.handle('gitea:getUserAccessibleRepos', async (_event, org: string, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取用户 ${username} 在组织 ${org} 中可访问的仓库`)
    
    // 1. 获取组织所有仓库
    const orgReposRes = await axios.get(`${GITEA_BASE_URL}/orgs/${org}/repos`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` },
      params: { limit: 100 }
    })
    const allRepos = orgReposRes.data || []
    console.log(`[Gitea] 组织 ${org} 共有 ${allRepos.length} 个仓库`)
    
    // 2. 检查每个仓库的协作者
    const accessibleRepos = []
    for (const repo of allRepos) {
      try {
        const collabRes = await axios.get(`${GITEA_BASE_URL}/repos/${org}/${repo.name}/collaborators`, {
          headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
        })
        const collaborators = collabRes.data || []
        // 检查用户是否在协作者列表中
        const isCollaborator = collaborators.some((c: any) => 
          c.login?.toLowerCase() === username.toLowerCase() || 
          c.username?.toLowerCase() === username.toLowerCase()
        )
        if (isCollaborator) {
          console.log(`[Gitea] ✓ 用户 ${username} 是仓库 ${repo.name} 的协作者`)
          accessibleRepos.push(repo)
        }
      } catch (e) {
        // 获取协作者失败，跳过
      }
    }
    
    console.log(`[Gitea] 用户 ${username} 可访问 ${accessibleRepos.length} 个仓库`)
    return { success: true, data: accessibleRepos }
  } catch (error: any) {
    console.error('[Gitea] getUserAccessibleRepos 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 创建仓库（在组织下）
ipcMain.handle('gitea:createRepo', async (_event, org: string, repoData: { name: string; description?: string; private?: boolean }) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 创建仓库: ${org}/${repoData.name}`)
    const response = await axios.post(`${GITEA_BASE_URL}/orgs/${org}/repos`, repoData, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] createRepo 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 编辑仓库
ipcMain.handle('gitea:editRepo', async (_event, owner: string, repo: string, repoData: {
  description?: string
  private?: boolean
  default_branch?: string
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 编辑仓库: ${owner}/${repo}`, repoData)
    const response = await axios.patch(`${GITEA_BASE_URL}/repos/${owner}/${repo}`, repoData, {
      headers: { 
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] editRepo 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 删除仓库
ipcMain.handle('gitea:deleteRepo', async (_event, owner: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 删除仓库: ${owner}/${repo}`)
    await axios.delete(`${GITEA_BASE_URL}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] deleteRepo 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 添加协作者
ipcMain.handle('gitea:addCollaborator', async (_event, owner: string, repo: string, username: string, permission: string = 'write') => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 添加协作者: ${username} -> ${owner}/${repo}`)
    await axios.put(`${GITEA_BASE_URL}/repos/${owner}/${repo}/collaborators/${username}`, 
      { permission },
      {
        headers: {
          'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] addCollaborator 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 移除协作者
ipcMain.handle('gitea:removeCollaborator', async (_event, owner: string, repo: string, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 移除协作者: ${username} <- ${owner}/${repo}`)
    await axios.delete(`${GITEA_BASE_URL}/repos/${owner}/${repo}/collaborators/${username}`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] removeCollaborator 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取组织成员列表
ipcMain.handle('gitea:getOrgMembers', async (_event, org: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取组织成员: ${org}`)
    const response = await axios.get(`${GITEA_BASE_URL}/orgs/${org}/members`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getOrgMembers 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// ========== 团队管理 API ==========

// Gitea: 获取组织下的团队列表
ipcMain.handle('gitea:getOrgTeams', async (_event, org: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取组织团队: ${org}`)
    const response = await axios.get(`${GITEA_BASE_URL}/orgs/${org}/teams`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    // 打印第一个团队的数据结构
    if (response.data && response.data.length > 0) {
      console.log('[Gitea] 团队数据示例:', JSON.stringify(response.data[0], null, 2))
    }
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getOrgTeams 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 创建团队
ipcMain.handle('gitea:createTeam', async (_event, org: string, teamData: { 
  name: string
  description?: string
  permission?: string
  includes_all_repositories?: boolean
  can_create_org_repo?: boolean
  units?: string[]
  units_map?: Record<string, string>
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 创建团队: ${org}/${teamData.name}`, teamData)
    const response = await axios.post(`${GITEA_BASE_URL}/orgs/${org}/teams`, {
      name: teamData.name,
      description: teamData.description || '',
      permission: teamData.permission || 'read',
      includes_all_repositories: teamData.includes_all_repositories || false,
      can_create_org_repo: teamData.can_create_org_repo || false,
      units: teamData.units || ['repo.code', 'repo.issues', 'repo.pulls', 'repo.releases'],
      units_map: teamData.units_map || {}
    }, {
      headers: { 
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] createTeam 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 编辑团队
ipcMain.handle('gitea:editTeam', async (_event, teamId: number, teamData: {
  description?: string
  permission?: string
  includes_all_repositories?: boolean
  can_create_org_repo?: boolean
  units?: string[]
  units_map?: Record<string, string>
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 编辑团队: ${teamId}`, teamData)
    const response = await axios.patch(`${GITEA_BASE_URL}/teams/${teamId}`, teamData, {
      headers: { 
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] editTeam 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 删除团队
ipcMain.handle('gitea:deleteTeam', async (_event, teamId: number) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 删除团队: ${teamId}`)
    await axios.delete(`${GITEA_BASE_URL}/teams/${teamId}`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] deleteTeam 错误:', error.response?.status, error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取团队的仓库列表
ipcMain.handle('gitea:getTeamRepos', async (_event, teamId: number) => {
  try {
    const axios = require('axios')
    const response = await axios.get(`${GITEA_BASE_URL}/teams/${teamId}/repos`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getTeamRepos 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 给团队添加仓库
ipcMain.handle('gitea:addTeamRepo', async (_event, teamId: number, org: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 给团队添加仓库: team ${teamId} <- ${org}/${repo}`)
    await axios.put(`${GITEA_BASE_URL}/teams/${teamId}/repos/${org}/${repo}`, {}, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] addTeamRepo 错误:', error.response?.status, error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 从团队移除仓库
ipcMain.handle('gitea:removeTeamRepo', async (_event, teamId: number, org: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 从团队移除仓库: team ${teamId} -> ${org}/${repo}`)
    await axios.delete(`${GITEA_BASE_URL}/teams/${teamId}/repos/${org}/${repo}`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] removeTeamRepo 错误:', error.response?.status, error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取团队成员
ipcMain.handle('gitea:getTeamMembers', async (_event, teamId: number) => {
  try {
    const axios = require('axios')
    const response = await axios.get(`${GITEA_BASE_URL}/teams/${teamId}/members`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getTeamMembers 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 添加成员到团队
ipcMain.handle('gitea:addTeamMember', async (_event, teamId: number, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 添加成员到团队: ${username} -> team ${teamId}`)
    await axios.put(`${GITEA_BASE_URL}/teams/${teamId}/members/${username}`, {}, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] addTeamMember 错误:', error.response?.status, error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 从团队移除成员
ipcMain.handle('gitea:removeTeamMember', async (_event, teamId: number, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 从团队移除成员: ${username} <- team ${teamId}`)
    await axios.delete(`${GITEA_BASE_URL}/teams/${teamId}/members/${username}`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] removeTeamMember 错误:', error.response?.status, error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取所有用户（管理员）
ipcMain.handle('gitea:getAllUsers', async (_event) => {
  try {
    const axios = require('axios')
    const response = await axios.get(`${GITEA_BASE_URL}/admin/users`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` },
      params: { limit: 100 }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getAllUsers 错误:', error.response?.status, error.message)
    return { success: false, error: error.message }
  }
})

// Gitea: 创建用户
ipcMain.handle('gitea:createUser', async (_event, userData: { 
  username: string
  email: string
  password: string
  full_name?: string
  must_change_password?: boolean
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 创建用户: ${userData.username}`)
    const response = await axios.post(`${GITEA_BASE_URL}/admin/users`, {
      ...userData,
      must_change_password: userData.must_change_password ?? false
    }, {
      headers: { 
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] createUser 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 编辑用户
ipcMain.handle('gitea:editUser', async (_event, username: string, userData: {
  full_name?: string
  email?: string
  active?: boolean
  admin?: boolean
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 编辑用户: ${username}`, userData)
    // Gitea API 要求必须传 login_name
    const response = await axios.patch(`${GITEA_BASE_URL}/admin/users/${username}`, {
      login_name: username,  // 必填字段
      ...userData
    }, {
      headers: { 
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] editUser 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 删除用户
ipcMain.handle('gitea:deleteUser', async (_event, username: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 删除用户: ${username}`)
    await axios.delete(`${GITEA_BASE_URL}/admin/users/${username}`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true }
  } catch (error: any) {
    console.error('[Gitea] deleteUser 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取仓库详情
ipcMain.handle('gitea:getRepo', async (_event, owner: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取仓库详情: ${owner}/${repo}`)
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getRepo 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: `状态码 ${error.response?.status}: ${error.response?.data?.message || error.message}` }
  }
})

// Gitea: 获取分支列表
ipcMain.handle('gitea:getBranches', async (_event, owner: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取分支: ${owner}/${repo}`)
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}/branches`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getBranches 错误:', error.response?.status, error.response?.data || error.message)
    // 409 表示仓库是空的（没有提交），返回空数组
    if (error.response?.status === 409) {
      return { success: true, data: [] }
    }
    return { success: false, error: `状态码 ${error.response?.status}: ${error.response?.data?.message || error.message}` }
  }
})

// Gitea: 获取标签列表
ipcMain.handle('gitea:getTags', async (_event, owner: string, repo: string) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取标签: ${owner}/${repo}`)
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}/tags`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getTags 错误:', error.response?.status, error.response?.data || error.message)
    // 409 表示仓库是空的，返回空数组
    if (error.response?.status === 409) {
      return { success: true, data: [] }
    }
    return { success: false, error: `状态码 ${error.response?.status}: ${error.response?.data?.message || error.message}` }
  }
})

// Gitea: 获取提交列表
ipcMain.handle('gitea:getCommits', async (_event, owner: string, repo: string, params?: any) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取提交: ${owner}/${repo}`)
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}/commits`, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`
      },
      params
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getCommits 错误:', error.response?.status, error.response?.data || error.message)
    // 409 表示仓库是空的，返回空数组
    if (error.response?.status === 409) {
      return { success: true, data: [] }
    }
    return { success: false, error: `状态码 ${error.response?.status}: ${error.response?.data?.message || error.message}` }
  }
})

// ========== Git 操作（本地 Git 命令） ==========

import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

// 存储仓库和本地路径的映射（持久化到 electron-store）
function getRepoLocalPaths(): Record<string, string> {
  return store?.get('repoLocalPaths', {}) as Record<string, string> || {}
}

function setRepoLocalPath(repoFullName: string, localPath: string) {
  const paths = getRepoLocalPaths()
  paths[repoFullName] = localPath
  store?.set('repoLocalPaths', paths)
}

function removeRepoLocalPath(repoFullName: string) {
  const paths = getRepoLocalPaths()
  delete paths[repoFullName]
  store?.set('repoLocalPaths', paths)
}

function getRepoLocalPath(repoFullName: string): string | null {
  const paths = getRepoLocalPaths()
  return paths[repoFullName] || null
}

// 执行 Git 命令的辅助函数
async function execGitCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const options: any = {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0' // 禁用交互式提示
    }
  }
  if (cwd) {
    options.cwd = cwd
  }
  return execAsync(command, options)
}

// Git: 克隆仓库（纯下载，不建立关联）
ipcMain.handle('git:clone', async (_event, repoUrl: string, localPath: string, _repoFullName: string) => {
  try {
    console.log(`[Git] 克隆仓库: ${repoUrl} -> ${localPath}`)
    
    // 检查目标目录是否已存在
    if (fs.existsSync(localPath)) {
      return { success: false, error: '目标目录已存在' }
    }
    
    // 创建父目录
    const parentDir = path.dirname(localPath)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }
    
    // 使用带认证的 URL 克隆
    const authUrl = repoUrl.replace('http://', `http://zzadmin:${GITEA_ADMIN_TOKEN}@`)
    const { stdout, stderr } = await execGitCommand(`git clone "${authUrl}" "${localPath}"`)
    
    console.log(`[Git] 克隆成功: ${stdout || stderr}`)
    
    // 注意：不再自动建立关联，关联是单独的操作
    
    return { success: true, message: '下载成功', data: { path: localPath } }
  } catch (error: any) {
    console.error('[Git] clone 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 拉取最新代码
ipcMain.handle('git:pull', async (_event, localPath: string) => {
  try {
    console.log(`[Git] 拉取代码: ${localPath}`)
    
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout, stderr } = await execGitCommand(
      `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" pull`,
      localPath
    )
    
    console.log(`[Git] 拉取成功: ${stdout || stderr}`)
    return { success: true, message: stdout || stderr || '已是最新' }
  } catch (error: any) {
    console.error('[Git] pull 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 推送代码
ipcMain.handle('git:push', async (_event, localPath: string) => {
  try {
    console.log(`[Git] 推送代码: ${localPath}`)
    
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout, stderr } = await execGitCommand(
      `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" push`,
      localPath
    )
    
    console.log(`[Git] 推送成功: ${stdout || stderr}`)
    return { success: true, message: stdout || stderr || '推送成功' }
  } catch (error: any) {
    console.error('[Git] push 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 查看状态
ipcMain.handle('git:status', async (_event, localPath: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout } = await execGitCommand('git status --porcelain', localPath)
    
    // 解析状态输出
    // 格式: XY PATH 或 XY "PATH" (带引号的路径)
    // X = 暂存区状态, Y = 工作区状态
    // 使用正则表达式更可靠地解析
    const files = stdout.trim().split('\n').filter(Boolean).map(line => {
      // 匹配格式: 前两个字符是状态，然后是空格，然后是文件路径
      const match = line.match(/^(.)(.)[\s]+(.+)$/)
      
      let status = ''
      let file = ''
      
      if (match) {
        status = match[1] + match[2]
        file = match[3].trim()
      } else {
        // 备用解析：找到第一个非空格字符后的路径
        const firstSpace = line.indexOf(' ')
        if (firstSpace > 0) {
          status = line.substring(0, firstSpace).padEnd(2, ' ')
          file = line.substring(firstSpace).trim()
        } else {
          status = line.substring(0, 2)
          file = line.substring(2).trim()
        }
      }
      
      // 去掉可能的引号
      if (file.startsWith('"') && file.endsWith('"')) {
        file = file.slice(1, -1)
      }
      
      console.log(`[Git] status 解析: line="${line}" -> status="${status}", file="${file}"`)
      
      return {
        status: status.trim() || 'M',
        file,
        staged: status[0] !== ' ' && status[0] !== '?',
        type: status[0] === 'A' || status[1] === 'A' ? 'added' :
              status[0] === 'D' || status[1] === 'D' ? 'deleted' :
              status[0] === '?' ? 'untracked' : 'modified'
      }
    })
    
    return { success: true, data: files }
  } catch (error: any) {
    console.error('[Git] status 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 查看文件差异
ipcMain.handle('git:diff', async (_event, localPath: string, filePath?: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    let command = 'git diff'
    if (filePath) {
      command += ` -- "${filePath}"`
    }
    
    const { stdout } = await execGitCommand(command, localPath)
    return { success: true, data: stdout }
  } catch (error: any) {
    console.error('[Git] diff 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 查看已暂存的差异
ipcMain.handle('git:diffStaged', async (_event, localPath: string, filePath?: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    let command = 'git diff --cached'
    if (filePath) {
      command += ` -- "${filePath}"`
    }
    
    const { stdout } = await execGitCommand(command, localPath)
    return { success: true, data: stdout }
  } catch (error: any) {
    console.error('[Git] diffStaged 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 添加文件到暂存区
ipcMain.handle('git:add', async (_event, localPath: string, files: string | string[]) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    // 给每个文件路径加上引号，处理空格和特殊字符
    const fileArray = Array.isArray(files) ? files : [files]
    const quotedFiles = fileArray.map(f => `"${f}"`).join(' ')
    
    console.log(`[Git] add 文件: ${quotedFiles}`)
    const { stdout, stderr } = await execGitCommand(`git add ${quotedFiles}`, localPath)
    
    return { success: true, message: stdout || stderr || '已添加到暂存区' }
  } catch (error: any) {
    console.error('[Git] add 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 提交
ipcMain.handle('git:commit', async (_event, localPath: string, message: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    // 转义提交信息中的特殊字符
    const escapedMessage = message.replace(/"/g, '\\"')
    const { stdout, stderr } = await execGitCommand(`git commit -m "${escapedMessage}"`, localPath)
    
    return { success: true, message: stdout || stderr || '提交成功' }
  } catch (error: any) {
    console.error('[Git] commit 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 创建标签
ipcMain.handle('git:createTag', async (_event, localPath: string, tagName: string, message?: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    let command = `git tag "${tagName}"`
    if (message) {
      const escapedMessage = message.replace(/"/g, '\\"')
      command = `git tag -a "${tagName}" -m "${escapedMessage}"`
    }
    
    const { stdout, stderr } = await execGitCommand(command, localPath)
    console.log(`[Git] 创建标签成功: ${tagName}`)
    return { success: true, message: stdout || stderr || '标签创建成功' }
  } catch (error: any) {
    console.error('[Git] createTag 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 推送标签
ipcMain.handle('git:pushTags', async (_event, localPath: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout, stderr } = await execGitCommand(
      `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" push --tags`,
      localPath
    )
    
    console.log(`[Git] 推送标签成功: ${stdout || stderr}`)
    return { success: true, message: stdout || stderr || '标签推送成功' }
  } catch (error: any) {
    console.error('[Git] pushTags 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 获取本地路径映射（持久化）
ipcMain.handle('git:getLocalPath', async (_event, repoFullName: string) => {
  const localPath = getRepoLocalPath(repoFullName)
  if (localPath && fs.existsSync(localPath)) {
    return { success: true, data: localPath }
  }
  // 如果路径不存在了，清除映射
  if (localPath) {
    removeRepoLocalPath(repoFullName)
  }
  return { success: false, data: null }
})

// Git: 设置本地路径映射（建立关联）
ipcMain.handle('git:setLocalPath', async (_event, repoFullName: string, localPath: string) => {
  // 验证路径是否存在且是 git 仓库
  if (!fs.existsSync(localPath)) {
    return { success: false, error: '目录不存在' }
  }
  
  const gitDir = path.join(localPath, '.git')
  if (!fs.existsSync(gitDir)) {
    return { success: false, error: '该目录不是 Git 仓库' }
  }
  
  // 验证是否是对应的仓库
  try {
    const { stdout } = await execGitCommand('git remote get-url origin', localPath)
    const remoteUrl = stdout.trim()
    // 从 repoFullName 提取仓库名
    const repoName = repoFullName.split('/').pop()
    if (!remoteUrl.includes(repoName!)) {
      return { success: false, error: '该目录关联的远程仓库不匹配' }
    }
  } catch (e) {
    return { success: false, error: '无法验证仓库信息' }
  }
  
  setRepoLocalPath(repoFullName, localPath)
  console.log(`[Git] 建立关联: ${repoFullName} -> ${localPath}`)
  return { success: true }
})

// Git: 解除本地路径映射（解除关联）
ipcMain.handle('git:removeLocalPath', async (_event, repoFullName: string) => {
  removeRepoLocalPath(repoFullName)
  console.log(`[Git] 解除关联: ${repoFullName}`)
  return { success: true }
})

// Git: 获取所有关联关系
ipcMain.handle('git:getAllLocalPaths', async () => {
  return { success: true, data: getRepoLocalPaths() }
})

// Git: 获取文件内容
ipcMain.handle('git:getFileContent', async (_event, localPath: string, filePath: string) => {
  try {
    const fullPath = path.join(localPath, filePath)
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' }
    }
    const content = fs.readFileSync(fullPath, 'utf-8')
    return { success: true, data: content }
  } catch (error: any) {
    console.error('[Git] getFileContent 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 获取远程文件内容（用于对比）
ipcMain.handle('git:getRemoteFileContent', async (_event, localPath: string, filePath: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout } = await execGitCommand(`git show HEAD:"${filePath}"`, localPath)
    return { success: true, data: stdout }
  } catch (error: any) {
    // 文件可能是新增的，不存在于远程
    if (error.message.includes('does not exist') || error.message.includes('fatal')) {
      return { success: true, data: '' }
    }
    console.error('[Git] getRemoteFileContent 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// 获取应用版本号
ipcMain.handle('app:getVersion', async () => {
  return app.getVersion()
})

// 🆕 获取系统路径
ipcMain.handle('app:getPath', async (_event, name: 'desktop' | 'downloads' | 'documents') => {
  return app.getPath(name)
})

// 选择下载目录
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择下载目录'
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// 显示保存对话框
ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options)
  return result
})

// 🆕 打开文件/文件夹选择对话框
ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options)
  return result
})

// 打开文件所在目录
ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// 🆕 打开文件或文件夹
ipcMain.handle('shell:openPath', async (_event, path: string) => {
  const result = await shell.openPath(path)
  return result  // 返回空字符串表示成功，否则返回错误信息
})

// 下载文件
ipcMain.handle('shell:downloadFile', async (event, url: string, savePath: string) => {
  const https = require('https')
  const http = require('http')
  const fs = require('fs')
  
  return new Promise((resolve, reject) => {
    console.log('📥 开始下载文件:', url)
    console.log('💾 保存路径:', savePath)
    
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(savePath)
    
    protocol.get(url, (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，HTTP状态码: ${response.statusCode}`))
        return
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0
      
      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length
        file.write(chunk)
        
        // 计算进度并发送到渲染进程
        if (totalSize > 0) {
          const percent = (downloadedSize / totalSize) * 100
          event.sender.send('shell:download-progress', {
            url,
            percent: Math.floor(percent),
            downloaded: downloadedSize,
            total: totalSize
          })
        }
      })
      
      response.on('end', () => {
        file.end()
        console.log('✅ 文件下载完成:', savePath)
        resolve({ path: savePath, size: downloadedSize })
      })
      
      response.on('error', (err: Error) => {
        file.close()
        fs.unlinkSync(savePath)
        reject(err)
      })
    }).on('error', (err: Error) => {
      file.close()
      if (fs.existsSync(savePath)) {
        fs.unlinkSync(savePath)
      }
      reject(err)
    })
  })
})

// 计算文件MD5
ipcMain.handle('shell:calculateMD5', async (_event, filePath: string) => {
  const crypto = require('crypto')
  const fs = require('fs')
  
  return new Promise((resolve, reject) => {
    console.log('🔐 计算文件MD5:', filePath)
    
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    
    stream.on('data', (data: Buffer) => {
      hash.update(data)
    })
    
    stream.on('end', () => {
      const md5 = hash.digest('hex')
      console.log('✅ MD5计算完成:', md5)
      resolve(md5)
    })
    
    stream.on('error', (err: Error) => {
      console.error('❌ MD5计算失败:', err)
      reject(err)
    })
  })
})

// ========== 下载管理 - 基于异步任务系统 ==========

// 步骤1: 查询数据（预览）
ipcMain.handle('download:query', async (_event, params) => {
  console.log('查询数据请求...')
  try {
    const result = await downloadManager.queryData(params)
    return result
  } catch (error: any) {
    console.error('查询数据失败:', error)
    throw error
  }
})

// 步骤2: 创建导出任务
ipcMain.handle('download:createTask', async (_event, params) => {
  console.log('创建导出任务...')
  try {
    const taskId = await downloadManager.createExportTask(params)
    console.log('导出任务创建成功，ID:', taskId)
    return taskId
  } catch (error: any) {
    console.error('创建导出任务失败:', error)
    throw error
  }
})

// 获取所有任务
ipcMain.handle('download:getTasks', async () => {
  return downloadManager.getTasks()
})

// 获取单个任务
ipcMain.handle('download:getTask', async (_event, taskId: string) => {
  return downloadManager.getTask(taskId)
})

// 取消任务
ipcMain.handle('download:cancelTask', async (_event, taskId: string) => {
  return downloadManager.cancelTask(taskId)
})

// 下载任务文件到指定位置
ipcMain.handle('download:downloadTaskFile', async (_event, taskId: string, filePath: string) => {
  return downloadManager.downloadTaskFile(taskId, filePath)
})

// 清理已完成的任务
ipcMain.handle('download:clearCompleted', async () => {
  return downloadManager.clearCompletedTasks()
})

// 兼容旧的下载接口
ipcMain.handle('download:start', async (_event, params) => {
  console.log('[兼容模式] 收到旧版下载请求，转换为导出任务')
  return downloadManager.createExportTask(params)
})

// 获取下载历史
ipcMain.handle('download:getHistory', async () => {
  return downloadManager.getHistory()
})

// 获取下载进度
ipcMain.handle('download:getProgress', async (_event, taskId: string) => {
  return downloadManager.getProgress(taskId)
})

// 暂停下载（不支持，但提供接口）
ipcMain.handle('download:pause', async (_event, taskId: string) => {
  return downloadManager.pauseDownload(taskId)
})

// 恢复下载（不支持，但提供接口）
ipcMain.handle('download:resume', async (_event, taskId: string) => {
  return downloadManager.resumeDownload(taskId)
})

// 取消下载
ipcMain.handle('download:cancel', async (_event, taskId: string) => {
  return downloadManager.cancelDownload(taskId)
})

// 清理下载历史
ipcMain.handle('download:clearHistory', async (_event, olderThanDays: number) => {
  return downloadManager.clearHistory(olderThanDays)
})

// ========== 数据字典API ==========
const dictionaryAPI = getDictionaryAPI()

// 全局API Key存储（用于全局搜索、WebSocket 等接口）
let dictGlobalApiKey = ''

// 初始化数据字典API Key
ipcMain.handle('dictionary:setApiKey', async (_event, apiKey: string) => {
  dictionaryAPI.setApiKey(apiKey)
  dictGlobalApiKey = apiKey  // 同时存储到全局变量
  return true
})

// 🆕 获取市场分类
ipcMain.handle('dictionary:getMarkets', async () => {
  try {
    const result = await dictionaryAPI.getMarkets()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取市场分类失败')
  }
})

// 🆕 全局搜索
ipcMain.handle('search:global', async (_event, keyword: string, limit?: number) => {
  try {
    const response = await axios.get('http://61.151.241.233:8080/api/v1/search/global', {
      params: { keyword, limit: limit || 20 },
      headers: {
        'X-API-Key': dictGlobalApiKey
      }
    })
    return response.data
  } catch (error: any) {
    console.error('全局搜索失败:', error)
    throw new Error(error.message || '全局搜索失败')
  }
})

// 获取所有数据源
ipcMain.handle('dictionary:getSources', async (_event, market?: string) => {
  try {
    const result = await dictionaryAPI.getAllSources(market)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取数据源列表失败')
  }
})

// 获取数据源详情
ipcMain.handle('dictionary:getSourceDetail', async (_event, code: string) => {
  try {
    const result = await dictionaryAPI.getSourceDetail(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取数据源详情失败')
  }
})

// 获取DECODED格式文档
ipcMain.handle('dictionary:getDecodedFormat', async (_event, code: string) => {
  try {
    const result = await dictionaryAPI.getDecodedFormat(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取DECODED格式失败')
  }
})

// 获取RAW格式文档
ipcMain.handle('dictionary:getRawFormat', async (_event, code: string) => {
  try {
    const result = await dictionaryAPI.getRawFormat(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取RAW格式失败')
  }
})

// 获取字段定义
ipcMain.handle('dictionary:getFields', async (_event, code: string, enabledOnly?: boolean) => {
  try {
    const result = await dictionaryAPI.getFields(code, enabledOnly)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取字段定义失败')
  }
})

// 搜索数据源
ipcMain.handle('dictionary:search', async (_event, keyword: string) => {
  try {
    const result = await dictionaryAPI.search(keyword)
    return result
  } catch (error: any) {
    throw new Error(error.message || '搜索失败')
  }
})

// 对比字段
ipcMain.handle('dictionary:compare', async (_event, sourceCodes: string[]) => {
  try {
    const result = await dictionaryAPI.compareFields(sourceCodes)
    return result
  } catch (error: any) {
    throw new Error(error.message || '字段对比失败')
  }
})

// 获取解析代码
ipcMain.handle('dictionary:getCode', async (_event, code: string, language: string) => {
  try {
    const result = await dictionaryAPI.getParserCode(code, language)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取解析代码失败')
  }
})

// 预览数据源数据
ipcMain.handle('dictionary:previewSource', async (_event, code: string) => {
  try {
    const result = await dictionaryAPI.previewSource(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '预览数据失败')
  }
})

// ========== 任务事件转发 ==========
downloadManager.on('task-created', (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:task-created', data)
  }
})

downloadManager.on('task-updated', (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:task-updated', data)
  }
})

downloadManager.on('download-completed', (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:completed', data)
  }
})

downloadManager.on('tasks-cleared', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download:tasks-cleared')
  }
})

// ========== 数据库字典API (710张表) ==========
const dbDictAPI = getDbDictAPI()

// 设置API Key
ipcMain.handle('dbdict:setApiKey', async (_event, apiKey: string) => {
  dbDictAPI.setApiKey(apiKey)
  return true
})

// 获取表列表
ipcMain.handle('dbdict:getTables', async (_event, params?: any) => {
  try {
    const result = await dbDictAPI.getTables(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取表列表失败')
  }
})

// 获取表详情
ipcMain.handle('dbdict:getTableDetail', async (_event, tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.getTableDetail(tableName, datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取表详情失败')
  }
})

// 获取表字段
ipcMain.handle('dbdict:getTableFields', async (_event, tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.getTableFields(tableName, datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取表字段失败')
  }
})

// 获取分类统计
// 获取数据源列表（包含权限信息）
ipcMain.handle('dbdict:getDatasources', async () => {
  try {
    const result = await dbDictAPI.getDatasources()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取数据源列表失败')
  }
})

ipcMain.handle('dbdict:getCategories', async (_event, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.getCategories(datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取分类统计失败')
  }
})

// 搜索表和字段
ipcMain.handle('dbdict:search', async (_event, keyword: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.search(keyword, datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '搜索失败')
  }
})

// SQL构建器
ipcMain.handle('dbdict:buildSQL', async (_event, params: any) => {
  try {
    const result = await dbDictAPI.buildSQL(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || 'SQL构建失败')
  }
})

// 获取数据库统计
ipcMain.handle('dbdict:getStats', async (_event, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.getStats(datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取数据库统计失败')
  }
})

// 导出数据字典
ipcMain.handle('dbdict:export', async (_event, params: any) => {
  try {
    const result = await dbDictAPI.exportDict(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '导出数据字典失败')
  }
})

// 清除缓存
ipcMain.handle('dbdict:clearCache', async (_event, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.clearCache(datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '清除缓存失败')
  }
})

// 预览表数据
ipcMain.handle('dbdict:previewTable', async (_event, tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const result = await dbDictAPI.previewTable(tableName, datasource)
    return result
  } catch (error: any) {
    throw new Error(error.message || '预览表数据失败')
  }
})

// 下载静态数据（旧接口，保留兼容）
ipcMain.handle('dbdict:downloadData', async (_event, params: any, savePath: string) => {
  const fs = require('fs').promises
  
  try {
    console.log('开始下载静态数据，参数:', params)
    console.log('保存路径:', savePath)
    
    const result = await dbDictAPI.downloadData(params)
    
    console.log('下载完成，数据类型:', typeof result)
    console.log('是否Buffer:', Buffer.isBuffer(result))
    console.log('是否ArrayBuffer:', result instanceof ArrayBuffer)
    
    // 根据格式保存文件
    if (params.format === 'csv') {
      // CSV格式 - arraybuffer/Buffer 数据
      if (Buffer.isBuffer(result)) {
        console.log('保存Buffer数据，大小:', result.length)
        await fs.writeFile(savePath, result)
      } else if (result instanceof ArrayBuffer) {
        console.log('保存ArrayBuffer数据，大小:', result.byteLength)
        await fs.writeFile(savePath, Buffer.from(result))
      } else {
        // 可能是字符串
        console.log('保存字符串数据')
        await fs.writeFile(savePath, result, 'utf-8')
      }
    } else {
      // JSON格式 - 对象转字符串
      console.log('保存JSON数据')
      const jsonStr = JSON.stringify(result, null, 2)
      await fs.writeFile(savePath, jsonStr, 'utf-8')
    }
    
    console.log(`✅ 文件已成功保存到: ${savePath}`)
    
    // 返回简单对象
    const returnValue = { success: true, path: savePath }
    console.log('返回值:', returnValue)
    return returnValue
  } catch (error: any) {
    console.error('❌ 下载保存失败:', error)
    throw new Error(error.message || '下载静态数据失败')
  }
})

// ========== WebSocket 实时订阅任务管理 ==========
import { WebSocketManager } from './websocketManager'

let subscriptionTaskManager: SubscriptionTaskManager | null = null
let wsManager: WebSocketManager | null = null

// 获取 WebSocket 管理器
function getWebSocketManager(): WebSocketManager {
  if (!wsManager && mainWindow) {
    wsManager = WebSocketManager.getInstance(mainWindow)
  }
  return wsManager!
}

// 初始化订阅任务管理器
function getSubscriptionTaskManager(): SubscriptionTaskManager {
  if (!subscriptionTaskManager && mainWindow) {
    subscriptionTaskManager = new SubscriptionTaskManager(mainWindow)
  }
  return subscriptionTaskManager!
}

// 🆕 连接 WebSocket 总线
ipcMain.handle('subscription:connect', async (_event, apiKey: string) => {
  try {
    if (!mainWindow) {
      throw new Error('主窗口未初始化')
    }

    const manager = getWebSocketManager()
    await manager.connect(apiKey)
    
    return { success: true, message: 'WebSocket 连接成功' }
  } catch (error: any) {
    console.error('❌ WebSocket 连接失败:', error)
    throw new Error(error.message || '连接失败')
  }
})

// 🆕 断开 WebSocket 总线
ipcMain.handle('subscription:disconnect', async () => {
  try {
    if (wsManager) {
      wsManager.disconnect()
    }
    return { success: true, message: 'WebSocket 已断开' }
  } catch (error: any) {
    console.error('❌ WebSocket 断开失败:', error)
    throw new Error(error.message || '断开失败')
  }
})

// 🆕 获取 WebSocket 状态
ipcMain.handle('subscription:getWebSocketStatus', async () => {
  try {
    if (!wsManager) {
      return { status: 'disconnected', stats: {} }
    }
    return {
      status: wsManager.getStatus(),
      stats: wsManager.getStats()
    }
  } catch (error: any) {
    console.error('❌ 获取 WebSocket 状态失败:', error)
    return { status: 'disconnected', stats: {} }
  }
})

// 🆕 创建订阅任务（一步到位：连接+订阅）
ipcMain.handle('subscription:createTask', async (_event, apiKey: string, config: any) => {
  try {
    if (!mainWindow) {
      throw new Error('主窗口未初始化')
    }

    const manager = getSubscriptionTaskManager()
    const taskId = await manager.createTask(apiKey, config)
    
    return { success: true, taskId, message: '订阅任务已创建' }
  } catch (error: any) {
    console.error('❌ 创建订阅任务失败:', error)
    throw new Error(error.message || '创建订阅任务失败')
  }
})

// 🆕 停止订阅任务
ipcMain.handle('subscription:stopTask', async (_event, taskId: string) => {
  try {
    const manager = getSubscriptionTaskManager()
    const savedPath = await manager.stopTask(taskId)

    return { success: true, savedPath }
  } catch (error: any) {
    console.error('❌ 停止任务失败:', error)
    throw new Error(error.message || '停止任务失败')
  }
})

// 🆕 断开任务的连接
ipcMain.handle('subscription:disconnectTask', async (_event, taskId: string) => {
  try {
    const manager = getSubscriptionTaskManager()
    manager.disconnectTask(taskId)

    return { success: true, message: '任务已断开' }
  } catch (error: any) {
    console.error('❌ 断开任务失败:', error)
    throw new Error(error.message || '断开任务失败')
  }
})

// 🆕 获取所有订阅任务
ipcMain.handle('subscription:getAllTasks', async () => {
  try {
    const manager = getSubscriptionTaskManager()
    return manager.getAllTasks()
  } catch (error: any) {
    console.error('❌ 获取任务列表失败:', error)
    return []
  }
})

// 🆕 获取单个任务详情
ipcMain.handle('subscription:getTask', async (_event, taskId: string) => {
  try {
    const manager = getSubscriptionTaskManager()
    return manager.getTask(taskId)
  } catch (error: any) {
    console.error('❌ 获取任务详情失败:', error)
    return null
  }
})

// ========== 因子库API ==========

// 设置因子库API Key
ipcMain.handle('factor:setApiKey', async (_event, apiKey: string) => {
  factorAPI.setApiKey(apiKey)
  return true
})

// 获取因子分类树
ipcMain.handle('factor:getCategories', async () => {
  try {
    const result = await factorAPI.getCategories()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子分类树失败')
  }
})

// 获取因子标签列表
ipcMain.handle('factor:getTags', async (_event, tagType?: string) => {
  try {
    const result = await factorAPI.getTags(tagType)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子标签失败')
  }
})

// 获取因子列表
ipcMain.handle('factor:getFactorList', async (_event, params: any) => {
  try {
    const result = await factorAPI.getFactorList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子列表失败')
  }
})

// 获取因子详情
ipcMain.handle('factor:getFactorDetail', async (_event, factorId: number) => {
  try {
    const result = await factorAPI.getFactorDetail(factorId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子详情失败')
  }
})

// 下载因子数据
ipcMain.handle('factor:downloadFactorData', async (_event, params: any) => {
  try {
    const result = await factorAPI.downloadFactorData(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建因子下载任务失败')
  }
})

// 获取因子性能数据
ipcMain.handle('factor:getFactorPerformance', async (_event, factorId: number, days?: number) => {
  try {
    const result = await factorAPI.getFactorPerformance(factorId, days)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子性能数据失败')
  }
})

// ========== 基金管理API ==========

const fundAPI = getFundAPI()

// 设置API Key
ipcMain.handle('fund:setApiKey', async (_event, apiKey: string) => {
  return fundAPI.setApiKey(apiKey)
})

// 获取托管人列表
ipcMain.handle('fund:getCustodians', async () => {
  try {
    const result = await fundAPI.getCustodians()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取托管人列表失败')
  }
})

// 获取经纪服务商列表
ipcMain.handle('fund:getBrokers', async () => {
  try {
    const result = await fundAPI.getBrokers()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取经纪服务商列表失败')
  }
})

// 创建基金
ipcMain.handle('fund:createFund', async (_event, fundData: any) => {
  try {
    const result = await fundAPI.createFund(fundData)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建基金失败')
  }
})

// 获取基金列表
ipcMain.handle('fund:getFundList', async (_event, params?: any) => {
  try {
    const result = await fundAPI.getFundList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取基金列表失败')
  }
})

// 获取基金详情
ipcMain.handle('fund:getFundDetail', async (_event, code: string) => {
  try {
    const result = await fundAPI.getFundDetail(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取基金详情失败')
  }
})

// 更新基金
ipcMain.handle('fund:updateFund', async (_event, code: string, fundData: any) => {
  try {
    const result = await fundAPI.updateFund(code, fundData)
    return result
  } catch (error: any) {
    throw new Error(error.message || '更新基金失败')
  }
})

// 删除基金
ipcMain.handle('fund:deleteFund', async (_event, code: string) => {
  try {
    const result = await fundAPI.deleteFund(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '删除基金失败')
  }
})

// 清盘基金
ipcMain.handle('fund:liquidateFund', async (_event, code: string, liquidateDate: string, reason?: string) => {
  try {
    const result = await fundAPI.liquidateFund(code, liquidateDate, reason)
    return result
  } catch (error: any) {
    throw new Error(error.message || '清盘基金失败')
  }
})

// 恢复基金运作
ipcMain.handle('fund:restoreFund', async (_event, code: string, restoreDate: string, reason?: string) => {
  try {
    const result = await fundAPI.restoreFund(code, restoreDate, reason)
    return result
  } catch (error: any) {
    throw new Error(error.message || '恢复基金失败')
  }
})

// 上传报告
ipcMain.handle('fund:uploadReport', async (_event, reportData: any) => {
  try {
    const result = await fundAPI.uploadReport(reportData)
    return result
  } catch (error: any) {
    throw new Error(error.message || '上传报告失败')
  }
})

// 获取报告列表
ipcMain.handle('fund:getReportList', async (_event, params?: any) => {
  try {
    const result = await fundAPI.getReportList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取报告列表失败')
  }
})

// 获取报告下载链接
ipcMain.handle('fund:getReportDownloadUrl', async (_event, reportId: number) => {
  try {
    const result = await fundAPI.getReportDownloadUrl(reportId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取下载链接失败')
  }
})

// 删除报告
ipcMain.handle('fund:deleteReport', async (_event, reportId: number) => {
  try {
    const result = await fundAPI.deleteReport(reportId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '删除报告失败')
  }
})

// ========== 净值管理 ==========

// 录入净值
ipcMain.handle('fund:createNav', async (_event, data: any) => {
  try {
    const result = await fundAPI.createNav(data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '录入净值失败')
  }
})

// 获取净值列表
ipcMain.handle('fund:getNavList', async (_event, params?: any) => {
  try {
    const result = await fundAPI.getNavList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取净值列表失败')
  }
})

// 获取净值详情
ipcMain.handle('fund:getNavDetail', async (_event, navId: number) => {
  try {
    const result = await fundAPI.getNavDetail(navId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取净值详情失败')
  }
})

// 更新净值
ipcMain.handle('fund:updateNav', async (_event, navId: number, data: any) => {
  try {
    const result = await fundAPI.updateNav(navId, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '更新净值失败')
  }
})

// 删除净值
ipcMain.handle('fund:deleteNav', async (_event, navId: number) => {
  try {
    const result = await fundAPI.deleteNav(navId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '删除净值失败')
  }
})

// 获取基金净值历史
ipcMain.handle('fund:getFundNavHistory', async (_event, code: string, params?: any) => {
  try {
    const result = await fundAPI.getFundNavHistory(code, params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取净值历史失败')
  }
})

// 获取最新净值
ipcMain.handle('fund:getLatestNav', async (_event, code: string) => {
  try {
    const result = await fundAPI.getLatestNav(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取最新净值失败')
  }
})

// 获取净值曲线
ipcMain.handle('fund:getNavChart', async (_event, code: string, days: number) => {
  try {
    const result = await fundAPI.getNavChart(code, days)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取净值曲线失败')
  }
})

// 获取净值统计
ipcMain.handle('fund:getNavStatistics', async (_event, code: string) => {
  try {
    const result = await fundAPI.getNavStatistics(code)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取净值统计失败')
  }
})

// ========== 申购赎回 ==========

// 创建交易
ipcMain.handle('fund:createTransaction', async (_event, data: any) => {
  try {
    const result = await fundAPI.createTransaction(data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建交易失败')
  }
})

// 获取交易列表
ipcMain.handle('fund:getTransactionList', async (_event, params?: any) => {
  try {
    const result = await fundAPI.getTransactionList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取交易列表失败')
  }
})

// 确认交易
ipcMain.handle('fund:confirmTransaction', async (_event, transId: number, data: any) => {
  try {
    const result = await fundAPI.confirmTransaction(transId, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '确认交易失败')
  }
})

// 撤销交易
ipcMain.handle('fund:cancelTransaction', async (_event, transId: number) => {
  try {
    const result = await fundAPI.cancelTransaction(transId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '撤销交易失败')
  }
})

// 获取基金交易记录
ipcMain.handle('fund:getFundTransactions', async (_event, code: string, params?: any) => {
  try {
    const result = await fundAPI.getFundTransactions(code, params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取基金交易记录失败')
  }
})

// ========== 基础信息维护 ==========

// 托管人管理
ipcMain.handle('fund:createCustodian', async (_event, data: any) => {
  try {
    const result = await fundAPI.createCustodian(data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建托管人失败')
  }
})

ipcMain.handle('fund:updateCustodian', async (_event, id: number, data: any) => {
  try {
    const result = await fundAPI.updateCustodian(id, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '更新托管人失败')
  }
})

ipcMain.handle('fund:deleteCustodian', async (_event, id: number) => {
  try {
    const result = await fundAPI.deleteCustodian(id)
    return result
  } catch (error: any) {
    throw new Error(error.message || '删除托管人失败')
  }
})

// 经纪商管理
ipcMain.handle('fund:createBroker', async (_event, data: any) => {
  try {
    const result = await fundAPI.createBroker(data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建经纪商失败')
  }
})

ipcMain.handle('fund:updateBroker', async (_event, id: number, data: any) => {
  try {
    const result = await fundAPI.updateBroker(id, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '更新经纪商失败')
  }
})

ipcMain.handle('fund:deleteBroker', async (_event, id: number) => {
  try {
    const result = await fundAPI.deleteBroker(id)
    return result
  } catch (error: any) {
    throw new Error(error.message || '删除经纪商失败')
  }
})

// ========== 投资者管理 ==========

ipcMain.handle('fund:createInvestor', async (_event, data: any) => {
  try {
    const result = await fundAPI.createInvestor(data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建投资者失败')
  }
})

ipcMain.handle('fund:getInvestorList', async (_event, params?: any) => {
  try {
    const result = await fundAPI.getInvestorList(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取投资者列表失败')
  }
})

ipcMain.handle('fund:getInvestorDetail', async (_event, id: number) => {
  try {
    const result = await fundAPI.getInvestorDetail(id)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取投资者详情失败')
  }
})

ipcMain.handle('fund:updateInvestor', async (_event, id: number, data: any) => {
  try {
    const result = await fundAPI.updateInvestor(id, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '更新投资者失败')
  }
})

ipcMain.handle('fund:deleteInvestor', async (_event, id: number) => {
  try {
    const result = await fundAPI.deleteInvestor(id)
    return result
  } catch (error: any) {
    throw new Error(error.message || '投资者销户失败')
  }
})

ipcMain.handle('fund:qualifyInvestor', async (_event, id: number, data: any) => {
  try {
    const result = await fundAPI.qualifyInvestor(id, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '合格投资者认定失败')
  }
})

ipcMain.handle('fund:riskAssessInvestor', async (_event, id: number, data: any) => {
  try {
    const result = await fundAPI.riskAssessInvestor(id, data)
    return result
  } catch (error: any) {
    throw new Error(error.message || '风险评估失败')
  }
})

ipcMain.handle('fund:getInvestorStatistics', async (_event) => {
  try {
    const result = await fundAPI.getInvestorStatistics()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取投资者统计失败')
  }
})

// ========== 账户/菜单管理 ==========

ipcMain.handle('account:getMyMenus', async (_event) => {
  try {
    const result = await fundAPI.getMyMenus()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取菜单权限失败')
  }
})

ipcMain.handle('account:getAllMenus', async (_event) => {
  try {
    const result = await fundAPI.getAllMenus()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取所有菜单失败')
  }
})

// ========== 静态数据异步下载 ==========

// 创建静态数据下载任务
ipcMain.handle('staticDownload:createTask', async (_event, request: any, apiKey: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => {
  try {
    const taskId = await staticDownloadManager.createTask(request, apiKey, datasource)
    return taskId
  } catch (error: any) {
    console.error('创建静态数据下载任务失败:', error)
    throw new Error(error.message || '创建任务失败')
  }
})

// 查询静态数据下载任务状态
ipcMain.handle('staticDownload:getTaskStatus', async (_event, taskId: string, apiKey: string) => {
  try {
    const task = await staticDownloadManager.getTaskStatus(taskId, apiKey)
    return task
  } catch (error: any) {
    console.error('查询任务状态失败:', error)
    throw new Error(error.message || '查询任务状态失败')
  }
})

// 下载静态数据文件
ipcMain.handle('staticDownload:downloadFile', async (_event, fileId: string, savePath: string, fileName: string, apiKey: string) => {
  try {
    const filePath = await staticDownloadManager.downloadFile(fileId, savePath, fileName, apiKey)
    return filePath
  } catch (error: any) {
    console.error('下载文件失败:', error)
    throw new Error(error.message || '下载文件失败')
  }
})

// ========== 自动更新功能（自建服务器） ==========

let currentUpdateInfo: any = null

// 检查更新
ipcMain.handle('updater:checkForUpdates', async () => {
  try {
    console.log('检查更新...')
    mainWindow?.webContents.send('updater:checking')
    
    const updateInfo = await updater.checkForUpdates()
    
    if (updateInfo) {
      currentUpdateInfo = updateInfo
      console.log('发现新版本:', updateInfo.version)
      mainWindow?.webContents.send('updater:update-available', updateInfo)
      
      return {
        updateAvailable: true,
        version: updateInfo.version,
        releaseNotes: updateInfo.release_notes
      }
    } else {
      console.log('当前已是最新版本')
      mainWindow?.webContents.send('updater:update-not-available')
      
      return {
        updateAvailable: false,
        version: updater.getCurrentVersion()
      }
    }
  } catch (error: any) {
    console.error('检查更新失败:', error)
    mainWindow?.webContents.send('updater:error', error.message)
    throw new Error(error.message || '检查更新失败')
  }
})

// 下载更新
ipcMain.handle('updater:downloadUpdate', async () => {
  console.log('=== IPC: updater:downloadUpdate 被调用 ===')
  
  if (!currentUpdateInfo) {
    throw new Error('没有可用的更新信息')
  }
  
  try {
    // 先在主进程中显示保存对话框
    const platform = process.platform
    const filename = platform === 'win32' 
      ? `Market-Data-Downloader-${currentUpdateInfo.version}.exe`
      : `Market-Data-Downloader-${currentUpdateInfo.version}-mac.zip`
    
    const defaultPath = join(app.getPath('downloads'), filename)
    
    console.log('📂 显示保存对话框...')
    const saveResult = await dialog.showSaveDialog(mainWindow!, {
      title: '选择保存位置',
      defaultPath: defaultPath,
      buttonLabel: '开始下载',
      filters: [
        { 
          name: platform === 'win32' ? 'Windows应用程序' : 'macOS应用程序', 
          extensions: platform === 'win32' ? ['exe'] : ['zip'] 
        }
      ]
    })
    
    console.log('对话框结果:', saveResult)
    
    if (saveResult.canceled || !saveResult.filePath) {
      throw new Error('用户取消下载')
    }
    
    const savePath = saveResult.filePath
    console.log('✅ 用户选择保存到:', savePath)
    
    // 开始下载到指定路径
    const filePath = await updater.downloadUpdateToPath(
      currentUpdateInfo, 
      savePath,
      (percent, status) => {
        console.log(`📊 下载进度: ${percent}% - ${status}`)
        mainWindow?.webContents.send('updater:download-progress', {
          percent,
          transferred: 0,
          total: currentUpdateInfo.downloads.windows?.size || 0
        })
      }
    )
    
    console.log('✅ 更新下载完成:', filePath)
    mainWindow?.webContents.send('updater:update-downloaded', filePath)
    
    return { success: true, filePath }
  } catch (error: any) {
    console.error('❌ 下载更新失败:', error)
    mainWindow?.webContents.send('updater:error', error.message)
    throw new Error(error.message || '下载更新失败')
  }
})

// 安装更新
ipcMain.handle('updater:quitAndInstall', async (_event, filePath: string) => {
  try {
    await updater.installUpdate(filePath)
    return true
  } catch (error: any) {
    console.error('安装更新失败:', error)
    throw new Error(error.message || '安装更新失败')
  }
})
