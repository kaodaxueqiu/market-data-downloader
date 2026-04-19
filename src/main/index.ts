import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join, basename } from 'path'
import { existsSync, readFileSync, rmSync } from 'fs'
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
import { getSSHManager, SSHConfig } from './sshManager'

// 禁用GPU加速，避免Windows上的GPU崩溃问题
app.disableHardwareAcceleration()

// 🆕 解码 Git 八进制转义路径（处理中文文件名）
// Git 使用八进制转义来表示非 ASCII 字符，格式: \351\207\217 -> 量
function decodeGitPath(path: string): string {
  try {
    // 去掉可能的引号
    if (path.startsWith('"') && path.endsWith('"')) {
      path = path.slice(1, -1)
    }
    
    // 收集所有八进制转义序列并转换为字节数组
    const bytes: number[] = []
    let i = 0
    let result = ''
    
    while (i < path.length) {
      if (path[i] === '\\' && i + 3 < path.length) {
        const octal = path.substring(i + 1, i + 4)
        if (/^[0-7]{3}$/.test(octal)) {
          bytes.push(parseInt(octal, 8))
          i += 4
          continue
        }
      }
      
      // 如果有累积的字节，先解码
      if (bytes.length > 0) {
        result += Buffer.from(bytes).toString('utf8')
        bytes.length = 0
      }
      
      result += path[i]
      i++
    }
    
    // 处理剩余的字节
    if (bytes.length > 0) {
      result += Buffer.from(bytes).toString('utf8')
    }
    
    return result
  } catch (e) {
    console.error('[Git] 解码路径失败:', e)
    return path
  }
}

// 配置存储 - 延迟初始化，确保app准备就绪
let store: Store
let configManager: ConfigManager

// 主窗口
let mainWindow: BrowserWindow | null = null

// 更新检查定时器
let updateCheckTimer: NodeJS.Timeout | null = null

function checkIMCacheVersion() {
  const bundledVersionFile = join(process.resourcesPath, 'im', 'im-version.json')
  const imAppData = join(app.getPath('appData'), 'G-Snowball-IM')
  const localVersionFile = join(imAppData, 'OpenIMData', 'im-version.json')

  let bundledVersion = ''
  try {
    if (existsSync(bundledVersionFile)) {
      bundledVersion = JSON.parse(readFileSync(bundledVersionFile, 'utf-8')).version || ''
    }
  } catch { /* ignore */ }

  if (!bundledVersion) {
    console.log('[IM Cache] 未找到打包的 IM 版本文件，跳过检查')
    return
  }

  let localVersion = ''
  try {
    if (existsSync(localVersionFile)) {
      localVersion = JSON.parse(readFileSync(localVersionFile, 'utf-8')).version || ''
    }
  } catch { /* ignore */ }

  if (localVersion === bundledVersion) {
    console.log(`[IM Cache] 版本一致 (${bundledVersion})，无需清理`)
    return
  }

  console.log(`[IM Cache] 版本不一致: 本地=${localVersion || '无'} → 打包=${bundledVersion}，清理整个 IM 目录`)

  while (existsSync(imAppData)) {
    try {
      rmSync(imAppData, { recursive: true, force: true })
    } catch (error) {
      console.error('[IM Cache] rmSync 异常:', error)
    }

    if (!existsSync(imAppData)) {
      console.log(`[IM Cache] 已删除: ${imAppData}`)
      break
    }

    console.warn('[IM Cache] 删除后目录仍然存在，可能被占用')
    const response = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'IM 缓存清理失败',
      message: `IM 版本已升级（${localVersion || '无'} → ${bundledVersion}），需要清理旧缓存，但目录被占用。\n\n请关闭以下文件夹后点击"重试"：\n${imAppData}`,
      buttons: ['重试', '退出应用'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 1) {
      app.exit(0)
      return
    }
  }
}

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
    icon: join(__dirname, '../../../public/icon.ico'),
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
    console.log('正在加载开发服务器: http://localhost:3100')
    
    // 延迟加载，确保Vite服务器准备就绪
    let retryCount = 0
    const maxRetries = 10
    
    const loadURL = async () => {
      try {
        retryCount++
        console.log(`🔄 尝试加载页面... (第${retryCount}次)`)
        await mainWindow!.loadURL('http://localhost:3100')
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
                // 显示保存对话框（从 URL 提取文件名）
                const platform = process.platform
                const downloadUrl = platform === 'win32'
                  ? updateInfo.downloads.windows.url
                  : (process.arch === 'arm64' ? updateInfo.downloads.mac_arm64.url : updateInfo.downloads.mac_intel.url)
                const filename = basename(downloadUrl)
                
                const defaultPath = join(app.getPath('downloads'), filename)
                
                const saveResult = await dialog.showSaveDialog(mainWindow, {
                  title: '选择保存位置',
                  defaultPath: defaultPath,
                  buttonLabel: '开始下载'
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
  
  // 检查 IM 缓存版本，不一致则清理
  try {
    checkIMCacheVersion()
  } catch (error) {
    console.error('⚠️ IM 缓存版本检查失败:', error)
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

// Gitea: 基于模板创建仓库
ipcMain.handle('gitea:generateFromTemplate', async (_event, templateOwner: string, templateRepo: string, options: {
  owner: string  // 新仓库的所有者（组织名）
  name: string   // 新仓库名称
  description?: string
  private?: boolean
  git_content?: boolean
  topics?: boolean
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 基于模板创建仓库: ${templateOwner}/${templateRepo} -> ${options.owner}/${options.name}`)
    const response = await axios.post(`${GITEA_BASE_URL}/repos/${templateOwner}/${templateRepo}/generate`, {
      owner: options.owner,
      name: options.name,
      description: options.description || '',
      private: options.private !== false,  // 默认私有
      git_content: options.git_content !== false,  // 默认复制内容
      topics: options.topics !== false  // 默认复制主题
    }, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] generateFromTemplate 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取仓库文件树（递归）
ipcMain.handle('gitea:getRepoTree', async (_event, owner: string, repo: string, ref: string = 'main') => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 获取仓库文件树: ${owner}/${repo}@${ref}`)
    const response = await axios.get(`${GITEA_BASE_URL}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getRepoTree 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 获取文件内容
ipcMain.handle('gitea:getFileContent', async (_event, owner: string, repo: string, filepath: string, ref?: string) => {
  try {
    const axios = require('axios')
    const url = ref 
      ? `${GITEA_BASE_URL}/repos/${owner}/${repo}/contents/${filepath}?ref=${ref}`
      : `${GITEA_BASE_URL}/repos/${owner}/${repo}/contents/${filepath}`
    const response = await axios.get(url, {
      headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] getFileContent 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 创建或更新文件
ipcMain.handle('gitea:putFileContent', async (_event, owner: string, repo: string, filepath: string, options: {
  content: string  // base64 编码的内容
  message: string  // 提交信息
  sha?: string     // 如果是更新文件，需要提供当前文件的 SHA
  branch?: string  // 分支名，默认 main
}) => {
  try {
    const axios = require('axios')
    console.log(`[Gitea] 创建/更新文件: ${owner}/${repo}/${filepath}`)
    const response = await axios.put(`${GITEA_BASE_URL}/repos/${owner}/${repo}/contents/${filepath}`, {
      content: options.content,
      message: options.message,
      sha: options.sha,
      branch: options.branch || 'main'
    }, {
      headers: {
        'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('[Gitea] putFileContent 错误:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.message || error.message }
  }
})

// Gitea: 批量下发模板文件到目标仓库
ipcMain.handle('gitea:deployTemplate', async (_event, templateOwner: string, templateRepo: string, targetOwner: string, targetRepo: string, options?: {
  branch?: string
  commitMessage?: string
}) => {
  try {
    const axios = require('axios')
    const commitMessage = options?.commitMessage || `从模板 ${templateRepo} 下发文件`
    
    console.log(`[Gitea] 下发模板: ${templateOwner}/${templateRepo} -> ${targetOwner}/${targetRepo}`)
    
    // 1. 获取模板仓库信息，确定默认分支
    const templateRepoInfo = await axios.get(
      `${GITEA_BASE_URL}/repos/${templateOwner}/${templateRepo}`,
      { headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` } }
    )
    const templateBranch = templateRepoInfo.data.default_branch || 'main'
    
    // 2. 获取模板仓库的文件树
    const treeResponse = await axios.get(
      `${GITEA_BASE_URL}/repos/${templateOwner}/${templateRepo}/git/trees/${templateBranch}?recursive=1`,
      { headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` } }
    )
    
    const treeFiles = treeResponse.data.tree.filter((item: any) => item.type === 'blob')
    console.log(`[Gitea] 模板文件数: ${treeFiles.length}`)
    
    // 3. 获取所有文件内容
    const filesData: { path: string; content: string }[] = []
    for (const file of treeFiles) {
      try {
        const contentResponse = await axios.get(
          `${GITEA_BASE_URL}/repos/${templateOwner}/${templateRepo}/contents/${file.path}?ref=${templateBranch}`,
          { headers: { 'Authorization': `token ${GITEA_ADMIN_TOKEN}` } }
        )
        // content 已经是 base64，需要解码后再使用
        const base64Content = contentResponse.data.content
        // 去除 base64 中的换行符
        const cleanContent = base64Content.replace(/\n/g, '')
        filesData.push({
          path: file.path,
          content: cleanContent
        })
      } catch (e: any) {
        console.error(`[Gitea] 获取文件 ${file.path} 内容失败:`, e.message)
      }
    }
    
    console.log(`[Gitea] 成功获取 ${filesData.length} 个文件内容`)
    
    // 4. 使用批量创建文件 API (POST /repos/{owner}/{repo}/contents)
    // 这个 API 可以一次性创建多个文件，对空仓库也有效
    try {
      const postData = {
        branch: 'main',
        files: filesData.map(f => ({
          path: f.path,
          content: f.content,
          operation: 'create'
        })),
        message: commitMessage,
        new_branch: 'main',  // 如果分支不存在则创建
        author: {
          name: 'Admin',
          email: 'admin@zizhou.com'
        },
        committer: {
          name: 'Admin', 
          email: 'admin@zizhou.com'
        }
      }
      
      console.log(`[Gitea] 批量创建文件, 数量: ${filesData.length}`)
      
      await axios.post(
        `${GITEA_BASE_URL}/repos/${targetOwner}/${targetRepo}/contents`,
        postData,
        {
          headers: {
            'Authorization': `token ${GITEA_ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log(`[Gitea] 批量创建成功`)
      
      return { 
        success: true, 
        data: {
          total: filesData.length,
          success: filesData.length,
          failed: 0,
          results: filesData.map(f => ({ path: f.path, success: true }))
        }
      }
    } catch (batchError: any) {
      const errorDetail = batchError.response?.data || batchError.message
      const statusCode = batchError.response?.status
      console.error(`[Gitea] 批量创建文件失败 (${statusCode}):`, JSON.stringify(errorDetail))
      
      return { 
        success: false, 
        error: batchError.response?.data?.message || batchError.message,
        data: {
          total: filesData.length,
          success: 0,
          failed: filesData.length,
          results: filesData.map(f => ({ path: f.path, success: false, error: errorDetail?.message || '批量创建失败' }))
        }
      }
    }
  } catch (error: any) {
    console.error('[Gitea] deployTemplate 错误:', error.response?.status, error.response?.data || error.message)
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

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec) as (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>

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

// Git: 推送代码（自动拉取后重试）
ipcMain.handle('git:push', async (_event, localPath: string) => {
  try {
    console.log(`[Git] 推送代码: ${localPath}`)
    
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    // 第一次尝试推送
    try {
      const { stdout, stderr } = await execGitCommand(
        `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" push`,
        localPath
      )
      console.log(`[Git] 推送成功: ${stdout || stderr}`)
      return { success: true, message: stdout || stderr || '推送成功' }
    } catch (pushError: any) {
      // 🆕 检查是否是因为远程有新提交
      if (pushError.message && (
        pushError.message.includes('fetch first') ||
        pushError.message.includes('non-fast-forward') ||
        pushError.message.includes('rejected')
      )) {
        console.log('[Git] 远程有新提交，先拉取再推送...')
        
        // 自动拉取
        try {
          const { stdout: pullOut, stderr: pullErr } = await execGitCommand(
            `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" pull --rebase`,
            localPath
          )
          console.log(`[Git] 自动拉取成功: ${pullOut || pullErr}`)
        } catch (pullError: any) {
          console.error('[Git] 自动拉取失败:', pullError.message)
          return { success: false, error: '自动拉取失败: ' + pullError.message }
        }
        
        // 重试推送
        const { stdout, stderr } = await execGitCommand(
          `git -c http.extraHeader="Authorization: token ${GITEA_ADMIN_TOKEN}" push`,
          localPath
        )
        console.log(`[Git] 重试推送成功: ${stdout || stderr}`)
        return { success: true, message: '已自动同步远程更新并推送成功' }
      }
      
      // 其他错误直接返回
      throw pushError
    }
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
      
      // 🆕 解码 Git 八进制转义路径（处理中文文件名）
      file = decodeGitPath(file)
      
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

// Git: 获取本地仓库所有标签
ipcMain.handle('git:getLocalTags', async (_event, localPath: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    // 获取所有标签，按版本号排序
    const { stdout } = await execGitCommand('git tag -l --sort=-v:refname', localPath)
    const tags = stdout.trim().split('\n').filter(Boolean)
    
    console.log(`[Git] 本地标签列表: ${tags.join(', ')}`)
    return { success: true, data: tags }
  } catch (error: any) {
    console.error('[Git] getLocalTags 错误:', error.message)
    return { success: false, error: error.message }
  }
})

// Git: 检查标签是否存在
ipcMain.handle('git:tagExists', async (_event, localPath: string, tagName: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    const { stdout } = await execGitCommand(`git tag -l "${tagName}"`, localPath)
    const exists = stdout.trim() === tagName
    return { success: true, exists }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Git: 创建标签
ipcMain.handle('git:createTag', async (_event, localPath: string, tagName: string, message?: string) => {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '本地仓库不存在' }
    }
    
    // 先检查标签是否已存在
    const { stdout: existingTags } = await execGitCommand(`git tag -l "${tagName}"`, localPath)
    if (existingTags.trim() === tagName) {
      return { success: false, error: `标签 "${tagName}" 已存在` }
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

// SSH: 用文件管理器打开远程目录（SFTP）
ipcMain.handle('ssh:openTerminal', async (_event, host: string, port: number, username: string, remotePath: string) => {
  // 构建 SFTP URL
  const sftpUrl = port === 22 
    ? `sftp://${username}@${host}${remotePath}`
    : `sftp://${username}@${host}:${port}${remotePath}`
  
  console.log('[SSH] 尝试打开 SFTP:', sftpUrl)
  
  try {
    // 尝试用系统默认方式打开 SFTP URL
    await shell.openExternal(sftpUrl)
    return { success: true }
  } catch (e) {
    console.log('[SSH] SFTP 打开失败，尝试其他方式')
    
    // Windows: 尝试用 explorer 打开网络路径
    if (process.platform === 'win32') {
      const { exec } = await import('child_process')
      
      return new Promise((resolve) => {
        // 尝试启动 WinSCP（如果安装了）
        const winscpCmd = `start "" "C:\\Program Files (x86)\\WinSCP\\WinSCP.exe" sftp://${username}@${host}:${port}${remotePath}`
        
        exec(winscpCmd, (error) => {
          if (error) {
            // WinSCP 没装，复制 SFTP 地址
            console.log('[SSH] WinSCP 未安装')
            resolve({ success: false, sftpUrl })
          } else {
            resolve({ success: true })
          }
        })
      })
    }
    
    return { success: false, sftpUrl }
  }
})

// SSH: 获取仓库的 SSH 配置
ipcMain.handle('ssh:getRepoConfig', async (_event, repoFullName: string) => {
  const sshConfigs = store?.get('sshRepoConfigs', {}) as Record<string, any> || {}
  const config = sshConfigs[repoFullName]
  if (config) {
    return { success: true, data: config }
  }
  return { success: false, data: null }
})

// SSH: 保存仓库的 SSH 配置
ipcMain.handle('ssh:saveRepoConfig', async (_event, repoFullName: string, config: any) => {
  const sshConfigs = store?.get('sshRepoConfigs', {}) as Record<string, any> || {}
  sshConfigs[repoFullName] = config
  store?.set('sshRepoConfigs', sshConfigs)
  return { success: true }
})

// SSH: 删除仓库的 SSH 配置
ipcMain.handle('ssh:removeRepoConfig', async (_event, repoFullName: string) => {
  const sshConfigs = store?.get('sshRepoConfigs', {}) as Record<string, any> || {}
  delete sshConfigs[repoFullName]
  store?.set('sshRepoConfigs', sshConfigs)
  return { success: true }
})

// Git: 列出目录文件（用于 .gitignore 配置）
ipcMain.handle('git:listFiles', async (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const files = entries
      .filter(e => !e.name.startsWith('.'))  // 排除隐藏文件
      .map(e => ({
        name: e.name,
        isDir: e.isDirectory()
      }))
      .sort((a, b) => {
        // 目录优先
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })
    return { success: true, data: files }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Git: 读取 .gitignore 文件
ipcMain.handle('git:readGitignore', async (_event, dirPath: string) => {
  try {
    const gitignorePath = path.join(dirPath, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      return { success: true, exists: true, content }
    }
    return { success: true, exists: false, content: '' }
  } catch (error: any) {
    return { success: false, exists: false, error: error.message }
  }
})

// Git: 写入 .gitignore 文件
ipcMain.handle('git:writeGitignore', async (_event, dirPath: string, content: string) => {
  try {
    const gitignorePath = path.join(dirPath, '.gitignore')
    fs.writeFileSync(gitignorePath, content, 'utf-8')
    return { success: true }
  } catch (error: any) {
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

// Git: 检测本地目录状态（用于关联前的检测）
ipcMain.handle('git:checkLocalStatus', async (_event, localPath: string) => {
  console.log(`[Git] 检测本地目录状态: ${localPath}`)
  
  // 检查目录是否存在
  if (!fs.existsSync(localPath)) {
    return { success: false, error: '目录不存在' }
  }
  
  const gitDir = path.join(localPath, '.git')
  const isGitRepo = fs.existsSync(gitDir)
  
  // 如果是 Git 仓库，检查是否已有远程配置
  let hasRemote = false
  let remoteUrl = ''
  if (isGitRepo) {
    try {
      const { stdout } = await execGitCommand('git remote get-url origin', localPath)
      remoteUrl = stdout.trim()
      hasRemote = !!remoteUrl
    } catch (e) {
      // 没有配置远程仓库
      hasRemote = false
    }
  }
  
  return {
    success: true,
    data: {
      isGitRepo,
      hasRemote,
      remoteUrl
    }
  }
})

// Git: 初始化本地仓库并关联远程（一键操作）
ipcMain.handle('git:initAndLink', async (_event, localPath: string, repoFullName: string, remoteUrl: string) => {
  console.log(`[Git] 初始化并关联: ${localPath} -> ${remoteUrl}`)
  
  const gitDir = path.join(localPath, '.git')
  const isGitRepo = fs.existsSync(gitDir)
  const steps: string[] = []
  
  try {
    // 步骤1: 如果不是 Git 仓库，执行 git init
    if (!isGitRepo) {
      console.log('[Git] 执行 git init...')
      await execGitCommand('git init', localPath)
      steps.push('初始化 Git 仓库')
    }
    
    // 步骤2: 检查是否已有 origin 远程配置
    let hasOrigin = false
    try {
      await execGitCommand('git remote get-url origin', localPath)
      hasOrigin = true
    } catch (e) {
      hasOrigin = false
    }
    
    // 步骤3: 配置远程仓库
    if (hasOrigin) {
      // 已有 origin，更新它
      console.log('[Git] 更新远程仓库地址...')
      await execGitCommand(`git remote set-url origin "${remoteUrl}"`, localPath)
      steps.push('更新远程仓库地址')
    } else {
      // 没有 origin，添加它
      console.log('[Git] 添加远程仓库...')
      await execGitCommand(`git remote add origin "${remoteUrl}"`, localPath)
      steps.push('配置远程仓库地址')
    }
    
    // 步骤4: 配置默认分支为 main
    console.log('[Git] 配置默认分支...')
    await execGitCommand('git config init.defaultBranch main', localPath)
    
    // 检查当前分支，如果是 master 则重命名为 main
    try {
      const { stdout: currentBranch } = await execGitCommand('git branch --show-current', localPath)
      if (currentBranch.trim() === 'master') {
        await execGitCommand('git branch -m master main', localPath)
        steps.push('重命名分支 master → main')
      }
    } catch (e) {
      // 可能还没有任何提交，忽略
    }
    
    // 步骤5: 保存关联关系
    setRepoLocalPath(repoFullName, localPath)
    steps.push('建立本地关联')
    
    console.log(`[Git] 初始化并关联完成，执行了: ${steps.join(' → ')}`)
    
    return {
      success: true,
      steps,
      message: '关联成功'
    }
  } catch (error: any) {
    console.error('[Git] 初始化并关联失败:', error)
    return {
      success: false,
      steps,
      error: error.message || '操作失败'
    }
  }
})

// Git: 设置本地路径映射（建立关联）- 保留原有接口兼容
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

ipcMain.handle('file:extractDoc', async (_event, url: string) => {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
    const tmpDir = path.join(os.tmpdir(), 'snowball-preview')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const tmpFile = path.join(tmpDir, `doc_${Date.now()}.doc`)
    fs.writeFileSync(tmpFile, Buffer.from(resp.data))
    const WordExtractor = require('word-extractor')
    const extractor = new WordExtractor()
    const doc = await extractor.extract(tmpFile)
    const body = doc.getBody() || ''
    const headers = doc.getHeaders({ includeFooters: false }) || ''
    const footers = doc.getFooters() || ''
    try { fs.unlinkSync(tmpFile) } catch {}
    return { success: true, text: body, headers, footers }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('file:openWithSystemApp', async (_event, url: string, fileName: string) => {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
    const tmpDir = path.join(os.tmpdir(), 'snowball-preview')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const filePath = path.join(tmpDir, fileName)
    fs.writeFileSync(filePath, Buffer.from(resp.data))
    const err = await shell.openPath(filePath)
    return { success: !err, path: filePath, error: err || undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
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
  dictGlobalApiKey = apiKey  // 同时设置全局搜索用的 API Key
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

// ========== 因子仓库API ==========

// 获取当前用户的仓库列表
ipcMain.handle('factor:getMyRepos', async () => {
  try {
    const result = await factorAPI.getMyRepos()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取仓库列表失败')
  }
})

// 获取仓库中的因子列表
ipcMain.handle('factor:getRepoFactors', async (_event, owner: string, repo: string) => {
  try {
    const result = await factorAPI.getRepoFactors(owner, repo)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取因子列表失败')
  }
})

// 管理员：获取所有仓库
ipcMain.handle('factor:getAllRepos', async () => {
  try {
    const result = await factorAPI.getAllRepos()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取所有仓库失败')
  }
})

// ========== 因子执行任务API ==========

// 创建执行任务
ipcMain.handle('factor:createJob', async (_event, params: any) => {
  try {
    const result = await factorAPI.createJob(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '创建任务失败')
  }
})

// 获取我的任务列表
ipcMain.handle('factor:getMyJobs', async (_event, params?: any) => {
  try {
    const result = await factorAPI.getMyJobs(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取任务列表失败')
  }
})

// 获取任务详情
ipcMain.handle('factor:getJobDetail', async (_event, jobId: string) => {
  try {
    const result = await factorAPI.getJobDetail(jobId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取任务详情失败')
  }
})

// 获取执行日志
ipcMain.handle('factor:getJobLogs', async (_event, jobId: string) => {
  try {
    const result = await factorAPI.getJobLogs(jobId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取执行日志失败')
  }
})

// 下载执行结果
ipcMain.handle('factor:getJobResult', async (_event, jobId: string) => {
  try {
    const result = await factorAPI.getJobResult(jobId)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取执行结果失败')
  }
})

// 管理员：获取所有任务
ipcMain.handle('factor:getAllJobs', async (_event, params?: any) => {
  try {
    const result = await factorAPI.getAllJobs(params)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取所有任务失败')
  }
})

// 获取文件内容
ipcMain.handle('factor:getFileContent', async (_event, owner: string, repo: string, filePath: string, ref?: string) => {
  try {
    const result = await factorAPI.getFileContent(owner, repo, filePath, ref)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取文件内容失败')
  }
})

// ========== 我的因子专属库API ==========

const MY_FACTOR_API_BASE = 'http://61.151.241.233:8080/api/v1/factor/my'

// 获取默认 API Key（用于我的因子API）
function getDefaultApiKeyForMyFactor(): string | null {
  const keys = configManager.getApiKeys()
  const defaultKey = keys.find((k: any) => k.isDefault)
  if (defaultKey) {
    return configManager.getFullApiKey(defaultKey.id)
  }
  return null
}

// 检查专属库状态
ipcMain.handle('factor:myStatus', async () => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    console.log('调用我的因子API - 检查状态:', `${MY_FACTOR_API_BASE}/status`)
    
    const axios = require('axios')
    const response = await axios.get(
      `${MY_FACTOR_API_BASE}/status`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    
    console.log('我的因子状态响应:', response.data)
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('检查专属库状态失败:', error.response?.status, error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 初始化专属库
ipcMain.handle('factor:myInit', async () => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/init`,
      {},
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 30000
      }
    )
    return { success: true, data: response.data.data, message: response.data.message }
  } catch (error: any) {
    console.error('初始化专属库失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 获取因子分类
ipcMain.handle('factor:myCategories', async () => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.get(
      `${MY_FACTOR_API_BASE}/categories`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取因子分类失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 获取我的因子列表
ipcMain.handle('factor:myList', async (_event, params: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.get(
      `${MY_FACTOR_API_BASE}/list`,
      {
        headers: { 'X-API-Key': apiKey },
        params,
        timeout: 15000
      }
    )
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取因子列表失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 创建因子
ipcMain.handle('factor:myCreate', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/create`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, data: response.data.data, message: response.data.message }
  } catch (error: any) {
    console.error('创建因子失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 批量创建因子
ipcMain.handle('factor:myBatchCreate', async (_event, factors: any[]) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/batch-create`,
      { factors },
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 60000  // 批量操作超时时间延长到60秒
      }
    )
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('批量创建因子失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 获取因子详情
ipcMain.handle('factor:myDetail', async (_event, factorId: string | number) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.get(
      `${MY_FACTOR_API_BASE}/${factorId}`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取因子详情失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 更新因子
ipcMain.handle('factor:myUpdate', async (_event, factorId: string | number, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.put(
      `${MY_FACTOR_API_BASE}/${factorId}`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('更新因子失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 删除因子
ipcMain.handle('factor:myDelete', async (_event, factorId: string | number) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.delete(
      `${MY_FACTOR_API_BASE}/${factorId}`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('删除因子失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 批量删除因子
ipcMain.handle('factor:myBatchDelete', async (_event, factorIds: string[]) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/batch-delete`,
      { factor_ids: factorIds },
      {
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        timeout: 30000
      }
    )
    return {
      success: response.data.success,
      message: response.data.message,
      deleted_count: response.data.deleted_count,
      requested: response.data.requested
    }
  } catch (error: any) {
    console.error('批量删除因子失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// ========== 分类管理API ==========

// 创建分类
ipcMain.handle('factor:myCategoryCreate', async (_event, level: 1 | 2 | 3, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/category/l${level}`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message, data: response.data.data }
  } catch (error: any) {
    console.error('创建分类失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 更新分类
ipcMain.handle('factor:myCategoryUpdate', async (_event, level: 1 | 2 | 3, id: number, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.put(
      `${MY_FACTOR_API_BASE}/category/l${level}/${id}`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('更新分类失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 删除分类
ipcMain.handle('factor:myCategoryDelete', async (_event, level: 1 | 2 | 3, id: number) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.delete(
      `${MY_FACTOR_API_BASE}/category/l${level}/${id}`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('删除分类失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// ========== 标签管理API ==========

// 获取标签列表
ipcMain.handle('factor:myTags', async (_event, type?: string) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    let url = `${MY_FACTOR_API_BASE}/tags`
    if (type) {
      url += `?type=${type}`
    }
    
    const response = await axios.get(url, {
      headers: { 'X-API-Key': apiKey },
      timeout: 15000
    })
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取标签失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 创建标签
ipcMain.handle('factor:myTagCreate', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/tag`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message, data: response.data.data }
  } catch (error: any) {
    console.error('创建标签失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 更新标签
ipcMain.handle('factor:myTagUpdate', async (_event, id: number, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.put(
      `${MY_FACTOR_API_BASE}/tag/${id}`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('更新标签失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 删除标签
ipcMain.handle('factor:myTagDelete', async (_event, id: number) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.delete(
      `${MY_FACTOR_API_BASE}/tag/${id}`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    return { success: true, message: response.data.message }
  } catch (error: any) {
    console.error('删除标签失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 从我的因子发起回测
ipcMain.handle('factor:myBacktest', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    console.log('发起因子回测请求:', JSON.stringify(data, null, 2))
    console.log('📊 benchmarks:', data.backtest_params?.benchmarks)
    
    const axios = require('axios')
    const response = await axios.post(
      `${MY_FACTOR_API_BASE}/backtest`,
      data,
      {
        headers: { 
          'X-API-Key': apiKey, 
          'Content-Type': 'application/json' 
        },
        timeout: 30000
      }
    )
    
    console.log('因子回测响应:', JSON.stringify(response.data, null, 2))
    
    // 检查响应中是否有错误
    if (response.data.success === false) {
      return { success: false, error: response.data.error || '回测任务创建失败' }
    }
    
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('发起因子回测失败:', error.response?.data || error.message)
    const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message
    return { success: false, error: errorMsg }
  }
})

// 获取因子回测历史
ipcMain.handle('factor:myBacktestHistory', async (_event, factorId: string | number) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    console.log('获取因子回测历史, factorId:', factorId)
    
    const axios = require('axios')
    const response = await axios.get(
      `${MY_FACTOR_API_BASE}/${factorId}/backtest-history`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    
    console.log('因子回测历史响应:', JSON.stringify(response.data, null, 2))
    
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取因子回测历史失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// ========== 因子表达式字典API ==========
const EXPRESSION_API_BASE = 'http://61.151.241.233:8080/api/v1/factor/expression'

// 获取函数字典（按分类分组）
ipcMain.handle('factor:getExpressionFunctions', async (_event, category?: string) => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    let url = `${EXPRESSION_API_BASE}/functions`
    if (category) {
      url += `?category=${encodeURIComponent(category)}`
    }
    
    const response = await axios.get(url, {
      headers: { 'X-API-Key': apiKey },
      timeout: 15000
    })
    
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取函数字典失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
  }
})

// 获取函数列表（扁平结构）
ipcMain.handle('factor:getExpressionFunctionList', async () => {
  try {
    const apiKey = getDefaultApiKeyForMyFactor()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    const axios = require('axios')
    const response = await axios.get(
      `${EXPRESSION_API_BASE}/function-list`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )
    
    return { success: true, data: response.data.data }
  } catch (error: any) {
    console.error('获取函数列表失败:', error.response?.data || error.message)
    return { success: false, error: error.response?.data?.error || error.message }
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
    // 先在主进程中显示保存对话框（从 URL 提取文件名）
    const platform = process.platform
    const downloadUrl = platform === 'win32'
      ? currentUpdateInfo.downloads.windows.url
      : (process.arch === 'arm64' ? currentUpdateInfo.downloads.mac_arm64.url : currentUpdateInfo.downloads.mac_intel.url)
    const filename = basename(downloadUrl)
    
    const defaultPath = join(app.getPath('downloads'), filename)
    
    console.log('📂 显示保存对话框...')
    const saveResult = await dialog.showSaveDialog(mainWindow!, {
      title: '选择保存位置',
      defaultPath: defaultPath,
      buttonLabel: '开始下载'
    })
    
    console.log('对话框结果:', saveResult)
    
    if (saveResult.canceled || !saveResult.filePath) {
      throw new Error('用户取消下载')
    }
    
    const savePath = saveResult.filePath
    console.log('✅ 用户选择保存到:', savePath)
    
    // 通知渲染进程开始下载
    mainWindow?.webContents.send('updater:start-download')
    
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

// ========== SSH 远程连接管理 ==========

const sshManager = getSSHManager()

// SSH 配置存储
function getSSHConfigs(): SSHConfig[] {
  return store?.get('sshConfigs', []) as SSHConfig[] || []
}

function saveSSHConfigs(configs: SSHConfig[]) {
  store?.set('sshConfigs', configs)
}

function addSSHConfig(config: SSHConfig) {
  const configs = getSSHConfigs()
  const index = configs.findIndex(c => c.id === config.id)
  if (index >= 0) {
    configs[index] = config
  } else {
    configs.push(config)
  }
  saveSSHConfigs(configs)
}

function removeSSHConfig(id: string) {
  const configs = getSSHConfigs().filter(c => c.id !== id)
  saveSSHConfigs(configs)
}

// 测试 SSH 连接
ipcMain.handle('ssh:testConnection', async (_event, config: { host: string; port: number; username: string; password: string }) => {
  try {
    const result = await sshManager.testConnection(config)
    return result
  } catch (error: any) {
    console.error('[SSH] 测试连接失败:', error)
    return { success: false, error: error.message }
  }
})

// 连接到 SSH 服务器
ipcMain.handle('ssh:connect', async (_event, config: SSHConfig) => {
  try {
    // 保存配置
    addSSHConfig(config)
    
    // 连接
    const result = await sshManager.connect(config)
    return result
  } catch (error: any) {
    console.error('[SSH] 连接失败:', error)
    return { success: false, error: error.message }
  }
})

// 断开 SSH 连接
ipcMain.handle('ssh:disconnect', async (_event, id: string) => {
  try {
    await sshManager.disconnect(id)
    return { success: true }
  } catch (error: any) {
    console.error('[SSH] 断开连接失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取 SSH 连接状态
ipcMain.handle('ssh:getStatus', async (_event, id: string) => {
  return sshManager.getStatus(id)
})

// 获取所有已保存的 SSH 配置
ipcMain.handle('ssh:getConfigs', async () => {
  return getSSHConfigs()
})

// 删除 SSH 配置
ipcMain.handle('ssh:deleteConfig', async (_event, id: string) => {
  try {
    await sshManager.disconnect(id)
    removeSSHConfig(id)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 检查远程路径
ipcMain.handle('ssh:checkRemotePath', async (_event, id: string, remotePath: string) => {
  try {
    const result = await sshManager.checkRemotePath(id, remotePath)
    return result
  } catch (error: any) {
    console.error('[SSH] 检查远程路径失败:', error)
    return { success: false, exists: false, isGitRepo: false, error: error.message }
  }
})

// 执行远程 Git 命令
ipcMain.handle('ssh:execGit', async (_event, id: string, command: string) => {
  try {
    const result = await sshManager.execGit(id, command)
    return result
  } catch (error: any) {
    console.error('[SSH] 执行 Git 命令失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取远程 Git 状态
ipcMain.handle('ssh:gitStatus', async (_event, id: string) => {
  try {
    const result = await sshManager.execGit(id, 'status --porcelain')
    if (!result.success) {
      return result
    }
    
    // 解析 git status 输出
    const files = (result.stdout || '').trim().split('\n').filter(Boolean).map(line => {
      const status = line.substring(0, 2)
      let file = line.substring(3).trim()
      
      // 🆕 解码 Git 八进制转义路径（处理中文文件名）
      file = decodeGitPath(file)
      
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
    console.error('[SSH] 获取 Git 状态失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取远程 Git 标签列表
ipcMain.handle('ssh:gitTags', async (_event, id: string) => {
  try {
    const result = await sshManager.execGit(id, 'tag -l --sort=-v:refname')
    if (!result.success) {
      return result
    }
    
    const tags = (result.stdout || '').trim().split('\n').filter(Boolean)
    return { success: true, data: tags }
  } catch (error: any) {
    console.error('[SSH] 获取 Git 标签失败:', error)
    return { success: false, error: error.message }
  }
})

// 远程 Git 提交
ipcMain.handle('ssh:gitCommit', async (_event, id: string, files: string[], message: string, tagName?: string) => {
  try {
    // 1. 添加文件
    const filesArg = files.map(f => `"${f}"`).join(' ')
    const addResult = await sshManager.execGit(id, `add ${filesArg}`)
    if (!addResult.success) {
      return { success: false, error: '添加文件失败: ' + addResult.error }
    }
    
    // 2. 提交
    const escapedMessage = message.replace(/"/g, '\\"')
    const commitResult = await sshManager.execGit(id, `commit -m "${escapedMessage}"`)
    if (!commitResult.success) {
      return { success: false, error: '提交失败: ' + commitResult.error }
    }
    
    // 3. 创建标签（如果需要）
    if (tagName) {
      const tagResult = await sshManager.execGit(id, `tag -a "${tagName}" -m "${escapedMessage}"`)
      if (!tagResult.success) {
        return { success: false, error: '创建标签失败: ' + tagResult.error }
      }
    }
    
    return { success: true, message: '提交成功' }
  } catch (error: any) {
    console.error('[SSH] Git 提交失败:', error)
    return { success: false, error: error.message }
  }
})

// 远程 Git 推送（自动拉取后重试）
ipcMain.handle('ssh:gitPush', async (_event, id: string) => {
  try {
    // 第一次尝试推送代码
    let pushResult = await sshManager.execGit(id, 'push')
    
    // 🆕 检查是否是因为远程有新提交
    if (!pushResult.success && pushResult.error && (
      pushResult.error.includes('fetch first') ||
      pushResult.error.includes('non-fast-forward') ||
      pushResult.error.includes('rejected')
    )) {
      console.log('[SSH] 远程有新提交，先拉取再推送...')
      
      // 自动拉取
      const pullResult = await sshManager.execGit(id, 'pull --rebase')
      if (!pullResult.success) {
        console.error('[SSH] 自动拉取失败:', pullResult.error)
        return { success: false, error: '自动拉取失败: ' + pullResult.error }
      }
      console.log('[SSH] 自动拉取成功')
      
      // 重试推送
      pushResult = await sshManager.execGit(id, 'push')
      if (!pushResult.success) {
        return { success: false, error: '推送失败: ' + pushResult.error }
      }
      
      // 推送标签
      await sshManager.execGit(id, 'push --tags')
      
      return { success: true, message: '已自动同步远程更新并推送成功' }
    }
    
    if (!pushResult.success) {
      return { success: false, error: '推送失败: ' + pushResult.error }
    }
    
    // 推送标签
    await sshManager.execGit(id, 'push --tags')
    
    return { success: true, message: '推送成功' }
  } catch (error: any) {
    console.error('[SSH] Git 推送失败:', error)
    return { success: false, error: error.message }
  }
})

// 远程 Git 拉取
ipcMain.handle('ssh:gitPull', async (_event, id: string) => {
  try {
    const result = await sshManager.execGit(id, 'pull')
    return result
  } catch (error: any) {
    console.error('[SSH] Git 拉取失败:', error)
    return { success: false, error: error.message }
  }
})

// 远程初始化 Git 仓库
ipcMain.handle('ssh:initGitRepo', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, osType: 'linux' | 'windows', repoFullName: string) => {
  const { Client } = await import('ssh2')
  
  return new Promise((resolve) => {
    const client = new Client()
    
    client.on('ready', () => {
      // 构建初始化命令
      const remoteUrl = `http://61.151.241.233:3030/${repoFullName}.git`
      let initCommands: string
      
      if (osType === 'windows') {
        initCommands = `cd /d "${remotePath}" && git init && git remote add origin "${remoteUrl}" 2>nul || git remote set-url origin "${remoteUrl}"`
      } else {
        initCommands = `cd "${remotePath}" && git init && (git remote add origin "${remoteUrl}" 2>/dev/null || git remote set-url origin "${remoteUrl}")`
      }
      
      console.log('[SSH] 执行 Git 初始化命令:', initCommands)
      
      client.exec(initCommands, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, error: err.message })
          return
        }
        
        let stdout = ''
        let stderr = ''
        
        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })
        
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
        
        stream.on('close', (code: number) => {
          client.end()
          console.log('[SSH] Git 初始化完成，退出码:', code, '输出:', stdout, '错误:', stderr)
          
          // git init 成功即可，remote 可能已存在
          if (code === 0 || stdout.includes('Initialized') || stdout.includes('已初始化')) {
            resolve({ success: true })
          } else {
            resolve({ success: false, error: stderr || stdout || '初始化失败' })
          }
        })
      })
    })
    
    client.on('error', (err) => {
      console.error('[SSH] 连接错误:', err.message)
      resolve({ success: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// 检查远程 Git 仓库的 remote 配置
ipcMain.handle('ssh:checkGitRemote', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  return new Promise((resolve) => {
    const client = new Client()
    
    client.on('ready', () => {
      let cmd: string
      if (osType === 'windows') {
        cmd = `cd /d "${remotePath}" && git remote get-url origin 2>nul`
      } else {
        cmd = `cd "${remotePath}" && git remote get-url origin 2>/dev/null`
      }
      
      client.exec(cmd, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, hasRemote: false, error: err.message })
          return
        }
        
        let stdout = ''
        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })
        
        stream.on('close', (code: number) => {
          client.end()
          const remoteUrl = stdout.trim()
          if (code === 0 && remoteUrl) {
            resolve({ success: true, hasRemote: true, remoteUrl })
          } else {
            resolve({ success: true, hasRemote: false })
          }
        })
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, hasRemote: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// 设置远程 Git 仓库的 origin
ipcMain.handle('ssh:setGitRemote', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, remoteUrl: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  return new Promise((resolve) => {
    const client = new Client()
    
    client.on('ready', () => {
      // 先尝试添加，如果已存在则更新
      let cmd: string
      if (osType === 'windows') {
        cmd = `cd /d "${remotePath}" && (git remote add origin "${remoteUrl}" 2>nul || git remote set-url origin "${remoteUrl}")`
      } else {
        cmd = `cd "${remotePath}" && (git remote add origin "${remoteUrl}" 2>/dev/null || git remote set-url origin "${remoteUrl}")`
      }
      
      client.exec(cmd, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, error: err.message })
          return
        }
        
        let stderr = ''
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
        
        stream.on('close', (code: number) => {
          client.end()
          if (code === 0) {
            resolve({ success: true })
          } else {
            resolve({ success: false, error: stderr || '设置远程地址失败' })
          }
        })
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// SSH: 列出远程目录所有文件（用于 .gitignore 配置）
ipcMain.handle('ssh:listFiles', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  console.log('[SSH] listFiles 开始，路径:', remotePath, '系统:', osType)
  
  return new Promise((resolve) => {
    const client = new Client()
    
    client.on('ready', () => {
      let cmd: string
      if (osType === 'windows') {
        cmd = `powershell -Command "Get-ChildItem -Path '${remotePath}' -Force | Where-Object { $_.Name -notlike '.*' } | ForEach-Object { if($_.PSIsContainer){'D|'+$_.Name}else{'F|'+$_.Name} }"`
      } else {
        // 使用更兼容的方式列出文件
        cmd = `cd "${remotePath}" && for f in *; do [ -e "$f" ] && { [ -d "$f" ] && echo "D|$f" || echo "F|$f"; }; done 2>/dev/null`
      }
      
      console.log('[SSH] 执行命令:', cmd)
      
      client.exec(cmd, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, error: err.message })
          return
        }
        
        let output = ''
        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })
        
        stream.on('close', () => {
          console.log('[SSH] listFiles 原始输出:', output)
          
          const files: Array<{ name: string; isDir: boolean }> = []
          const lines = output.trim().split('\n').filter(Boolean)
          
          for (const line of lines) {
            const [type, name] = line.split('|')
            if (name && !name.startsWith('.')) {
              files.push({
                name: name.trim(),
                isDir: type === 'D'
              })
            }
          }
          
          // 目录优先排序
          files.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1
            if (!a.isDir && b.isDir) return 1
            return a.name.localeCompare(b.name)
          })
          
          console.log('[SSH] listFiles 解析结果:', files.length, '个文件')
          
          client.end()
          resolve({ success: true, data: files })
        })
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// SSH: 读取远程 .gitignore 文件
ipcMain.handle('ssh:readGitignore', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  return new Promise((resolve) => {
    const client = new Client()
    
    client.on('ready', () => {
      const gitignorePath = osType === 'windows' 
        ? `${remotePath}\\.gitignore`
        : `${remotePath}/.gitignore`
      
      const cmd = osType === 'windows'
        ? `powershell -Command "if(Test-Path '${gitignorePath}'){Get-Content '${gitignorePath}' -Raw}else{Write-Output 'FILE_NOT_EXISTS'}"`
        : `cat "${gitignorePath}" 2>/dev/null || echo "FILE_NOT_EXISTS"`
      
      client.exec(cmd, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, exists: false, error: err.message })
          return
        }
        
        let output = ''
        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })
        
        stream.on('close', () => {
          client.end()
          if (output.trim() === 'FILE_NOT_EXISTS') {
            resolve({ success: true, exists: false, content: '' })
          } else {
            resolve({ success: true, exists: true, content: output })
          }
        })
      })
    })
    
    client.on('error', (err) => {
      resolve({ success: false, exists: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// SSH: 写入远程 .gitignore 文件（使用 SFTP）
ipcMain.handle('ssh:writeGitignore', async (_event, config: { host: string; port: number; username: string; password: string }, remotePath: string, content: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  console.log('[SSH] writeGitignore 开始，路径:', remotePath)
  
  return new Promise((resolve) => {
    const client = new Client()
    
    const timeout = setTimeout(() => {
      console.log('[SSH] writeGitignore 超时')
      client.end()
      resolve({ success: false, error: '连接超时' })
    }, 15000)
    
    client.on('ready', () => {
      console.log('[SSH] 连接成功，开始 SFTP')
      
      client.sftp((err, sftp) => {
        if (err) {
          clearTimeout(timeout)
          client.end()
          console.error('[SSH] SFTP 错误:', err)
          resolve({ success: false, error: err.message })
          return
        }
        
        const gitignorePath = osType === 'windows'
          ? `${remotePath}\\.gitignore`
          : `${remotePath}/.gitignore`
        
        console.log('[SSH] 写入文件:', gitignorePath)
        
        sftp.writeFile(gitignorePath, content, (writeErr) => {
          clearTimeout(timeout)
          client.end()
          
          if (writeErr) {
            console.error('[SSH] 写入失败:', writeErr)
            resolve({ success: false, error: writeErr.message })
          } else {
            console.log('[SSH] 写入成功')
            resolve({ success: true })
          }
        })
      })
    })
    
    client.on('error', (err) => {
      clearTimeout(timeout)
      console.error('[SSH] 连接错误:', err)
      resolve({ success: false, error: err.message })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// 浏览远程目录
ipcMain.handle('ssh:listDirectory', async (_event, config: { host: string; port: number; username: string; password: string }, path: string, osType: 'linux' | 'windows') => {
  const { Client } = await import('ssh2')
  
  return new Promise((resolve) => {
    const client = new Client()
    const folders: Array<{ name: string; path: string; isGit: boolean }> = []
    
    client.on('ready', () => {
      let cmd: string
      if (osType === 'windows') {
        cmd = `powershell -Command "Get-ChildItem -Path '${path}' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $gitExists = Test-Path (Join-Path $_.FullName '.git'); Write-Output ($_.Name + '|' + $gitExists) }"`
      } else {
        cmd = `for d in "${path}"/*/; do if [ -d "$d" ]; then name=$(basename "$d"); if [ -d "${path}/$name/.git" ]; then echo "$name|True"; else echo "$name|False"; fi; fi; done 2>/dev/null`
      }
      
      client.exec(cmd, (err, stream) => {
        if (err) {
          client.end()
          resolve({ success: false, error: err.message, folders: [] })
          return
        }
        
        let output = ''
        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })
        
        stream.stderr.on('data', (data: Buffer) => {
          console.log('[SSH] stderr:', data.toString())
        })
        
        stream.on('close', () => {
          const lines = output.trim().split('\n').filter(Boolean)
          for (const line of lines) {
            const parts = line.split('|')
            const name = parts[0]?.trim()
            const isGitStr = parts[1]?.trim()
            if (name && name !== '.' && name !== '..') {
              const isGit = isGitStr?.toLowerCase() === 'true'
              const fullPath = osType === 'windows' 
                ? `${path}\\${name}`.replace(/\\\\/g, '\\')
                : `${path}/${name}`.replace(/\/\//g, '/')
              folders.push({ name, path: fullPath, isGit })
            }
          }
          
          // 按名称排序，Git 仓库优先
          folders.sort((a, b) => {
            if (a.isGit && !b.isGit) return -1
            if (!a.isGit && b.isGit) return 1
            return a.name.localeCompare(b.name)
          })
          
          client.end()
          resolve({ success: true, folders })
        })
      })
    })
    
    client.on('error', (err) => {
      console.error('[SSH] 连接错误:', err.message)
      resolve({ success: false, error: err.message, folders: [] })
    })
    
    client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    })
  })
})

// ========== 因子回测API ==========

const BACKTEST_API_BASE = 'http://61.151.241.233:8080/api/v1/backtest'

// 获取默认 API Key（用于回测API认证）
function getDefaultApiKeyForBacktest(): string | null {
  const keys = configManager.getApiKeys()
  const defaultKey = keys.find((k: any) => k.isDefault)
  if (defaultKey) {
    return configManager.getFullApiKey(defaultKey.id)
  }
  return null
}

// 回测: 提交任务
ipcMain.handle('backtest:submit', async (_event, data: any) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    console.log('📊 提交回测任务:', data.task_name)
    const axios = require('axios')
    const response = await axios.post(
      `${BACKTEST_API_BASE}/submit`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '提交失败' }
    }
  } catch (error: any) {
    console.error('❌ 提交回测任务失败:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取任务列表
ipcMain.handle('backtest:getTasks', async (_event, params: { 
  page?: number
  page_size?: number
  status?: string
  task_type?: string
  start_date?: string
  end_date?: string
  sort_field?: string
  sort_order?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/tasks`,
      {
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          status: params.status || undefined,
          task_type: params.task_type || undefined,
          start_date: params.start_date || undefined,
          end_date: params.end_date || undefined,
          sort_field: params.sort_field || undefined,
          sort_order: params.sort_order || undefined
        },
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取回测任务列表失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取任务详情
ipcMain.handle('backtest:getTaskDetail', async (_event, taskId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取回测任务详情失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取回测结果
ipcMain.handle('backtest:getResult', async (_event, taskId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/result`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取回测结果失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取每日明细数据
ipcMain.handle('backtest:getDailyMetrics', async (_event, taskId: string, params?: {
  page?: number
  page_size?: number
  start_date?: string
  end_date?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/daily-metrics`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        params: {
          page: params?.page || 1,
          page_size: params?.page_size || 100,
          start_date: params?.start_date,
          end_date: params?.end_date
        },
        timeout: 60000  // 数据量可能较大，设置较长超时
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取每日明细失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 下载结果文件
ipcMain.handle('backtest:download', async (_event, taskId: string, options?: {
  format?: 'csv' | 'xlsx'
  type?: 'summary' | 'daily' | 'all'
  period?: number  // 预测周期：1/5/10/20
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const format = options?.format || 'csv'
    const type = options?.type || 'all'
    const period = options?.period
    
    // 构建文件名
    const ext = format === 'xlsx' ? 'xlsx' : 'csv'
    const typeLabel = type === 'summary' ? '汇总' : type === 'daily' ? '每日明细' : '全部'
    const periodLabel = period ? `_${period}日周期` : ''
    const defaultFileName = `回测结果_${taskId}_${typeLabel}${periodLabel}.${ext}`
    
    // 弹出保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: '保存回测结果',
      defaultPath: defaultFileName,
      filters: format === 'xlsx' 
        ? [{ name: 'Excel 文件', extensions: ['xlsx'] }]
        : [{ name: 'CSV 文件', extensions: ['csv'] }]
    })
    
    if (canceled || !filePath) {
      return { success: false, error: '用户取消' }
    }

    const axios = require('axios')
    const fs = require('fs')
    
    // 请求下载文件
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/download`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        params: {
          format,
          type,
          period: period?.toString()  // 传递周期参数
        },
        responseType: 'arraybuffer',  // 重要：以二进制接收
        timeout: 120000  // 下载可能需要较长时间
      }
    )
    
    // 保存到用户选择的位置
    fs.writeFileSync(filePath, Buffer.from(response.data))
    
    console.log('✅ 回测结果下载成功:', filePath)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('❌ 下载回测结果失败:', error)
    if (error.response?.status === 404) {
      return { success: false, error: '回测结果不存在' }
    }
    return { success: false, error: error.message || '下载失败' }
  }
})

// 回测: 生成因子报告 PDF（全量多周期报告）
ipcMain.handle('backtest:report', async (_event, taskId: string, _options?: Record<string, unknown>) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }
    
    // 构建文件名（报告自动包含所有周期，无需指定）
    const defaultFileName = `因子报告_${taskId}.pdf`
    
    // 弹出保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: '保存因子报告',
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    
    if (canceled || !filePath) {
      return { success: false, error: '用户取消' }
    }

    const axios = require('axios')
    const fs = require('fs')
    
    // 请求生成报告（无需 period 参数，自动包含所有周期）
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/report`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        responseType: 'arraybuffer',  // 重要：以二进制接收
        timeout: 600000  // 报告生成可能需要较长时间（10分钟）
      }
    )
    
    // 保存到用户选择的位置
    fs.writeFileSync(filePath, Buffer.from(response.data))
    
    console.log('✅ 因子报告生成成功:', filePath)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('❌ 生成因子报告失败:', error)
    if (error.response?.status === 404) {
      return { success: false, error: '回测结果不存在' }
    }
    return { success: false, error: error.message || '生成报告失败' }
  }
})

// 回测: 因子值分页查询
ipcMain.handle('backtest:getFactorValues', async (_event, taskId: string, params?: {
  trade_date?: string
  stock_code?: string
  sort_by?: string
  sort_order?: string
  page?: number
  page_size?: number
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/factor-values`,
      {
        headers: { 'X-API-Key': apiKey },
        params: {
          trade_date: params?.trade_date,
          stock_code: params?.stock_code,
          sort_by: params?.sort_by || 'factor_value',
          sort_order: params?.sort_order || 'desc',
          page: params?.page || 1,
          page_size: params?.page_size || 50
        },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取因子值失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 因子值可用日期列表
ipcMain.handle('backtest:getFactorValueDates', async (_event, taskId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/factor-values/dates`,
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取因子值日期失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 因子值截面统计
ipcMain.handle('backtest:getFactorValueStats', async (_event, taskId: string, tradeDate: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/factor-values/stats`,
      {
        headers: { 'X-API-Key': apiKey },
        params: { trade_date: tradeDate },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取因子值统计失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 因子值分布直方图
ipcMain.handle('backtest:getFactorValueDistribution', async (_event, taskId: string, params: {
  trade_date: string
  bins?: number
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/factor-values/distribution`,
      {
        headers: { 'X-API-Key': apiKey },
        params: {
          trade_date: params.trade_date,
          bins: params.bins || 50
        },
        timeout: 30000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取因子值分布失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 因子值下载CSV
ipcMain.handle('backtest:downloadFactorValues', async (_event, taskId: string, tradeDate?: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const dateLabel = tradeDate || '全部'
    const defaultFileName = `因子值_${taskId}_${dateLabel}.csv`

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: '导出因子值数据',
      defaultPath: defaultFileName,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: '用户取消' }
    }

    const axios = require('axios')
    const fs = require('fs')

    const response = await axios.get(
      `${BACKTEST_API_BASE}/task/${taskId}/factor-values/download`,
      {
        headers: { 'X-API-Key': apiKey },
        params: tradeDate ? { trade_date: tradeDate } : {},
        responseType: 'arraybuffer',
        timeout: 120000
      }
    )

    fs.writeFileSync(filePath, Buffer.from(response.data))
    console.log('✅ 因子值数据导出成功:', filePath)
    return { success: true, filePath }
  } catch (error: any) {
    console.error('❌ 导出因子值失败:', error)
    if (error.response?.status === 404) {
      return { success: false, error: '因子值数据不存在' }
    }
    return { success: false, error: error.message || '导出失败' }
  }
})

// 回测: 取消任务
ipcMain.handle('backtest:cancelTask', async (_event, taskId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.delete(
      `${BACKTEST_API_BASE}/task/${taskId}`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, message: response.data.message }
    } else {
      return { success: false, error: response.data.error || '取消失败' }
    }
  } catch (error: any) {
    console.error('❌ 取消回测任务失败:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取预设股票池列表
ipcMain.handle('backtest:getStockPools', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/stock-pools`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取股票池失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取股票池列表失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// 回测: 获取价格类型选项
ipcMain.handle('backtest:getPriceTypeOptions', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${BACKTEST_API_BASE}/price-type-options`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取价格类型选项失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取价格类型选项失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// ============================================
// 研究成果模块 IPC Handlers
// ============================================

const RESEARCH_API_BASE = 'http://61.151.241.233:8080/api/v1/research'

// 研究成果: 获取列表
ipcMain.handle('research:getList', async (_event, params: {
  page?: number
  page_size?: number
  created_by?: string
  status?: string
  keyword?: string
  sort_by?: string
  sort_order?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    console.log('📊 研究成果API请求:')
    console.log('  URL:', `${RESEARCH_API_BASE}/list`)
    console.log('  API Key:', apiKey?.substring(0, 10) + '...')

    const axios = require('axios')
    const response = await axios.get(
      `${RESEARCH_API_BASE}/list`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          created_by: params.created_by,
          status: params.status,
          keyword: params.keyword,
          sort_by: params.sort_by || 'updated_at',
          sort_order: params.sort_order || 'desc'
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取研究成果列表失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取研究成果列表失败:', error.response?.status, error.response?.data || error.message)
    if (error.response?.status === 401) {
      return { success: false, error: 'API Key 无效或无权限 (401)' }
    }
    if (error.response?.status === 403) {
      return { success: false, error: '无权访问研究成果 (403)' }
    }
    return { success: false, error: error.response?.data?.error || error.message || '网络错误' }
  }
})

// 研究成果: 获取详情
ipcMain.handle('research:getDetail', async (_event, factorId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${RESEARCH_API_BASE}/${factorId}`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取研究成果详情失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取研究成果详情失败:', error)
    if (error.response?.status === 403) {
      return { success: false, error: '无权访问该研究成果' }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// 研究成果: 获取统计信息
ipcMain.handle('research:getStats', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${RESEARCH_API_BASE}/stats`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取统计信息失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取研究成果统计失败:', error)
    if (error.response?.status === 403) {
      return { success: false, error: '无权访问研究成果' }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// 研究成果: 获取研究员列表
ipcMain.handle('research:getResearchers', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${RESEARCH_API_BASE}/researchers`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, researchers: response.data.researchers }
    } else {
      return { success: false, error: response.data.error || '获取研究员列表失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取研究员列表失败:', error)
    if (error.response?.status === 403) {
      return { success: false, error: '无权访问研究成果' }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// 研究成果: 获取回测结果
ipcMain.handle('research:getResult', async (_event, factorId: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${RESEARCH_API_BASE}/${factorId}/result`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return { success: true, data: response.data.data }
    } else {
      return { success: false, error: response.data.error || '获取回测结果失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取回测结果失败:', error)
    if (error.response?.status === 403) {
      return { success: false, error: '无权访问该研究成果' }
    }
    return { success: false, error: error.message || '网络错误' }
  }
})

// ============================================
// 数据工单系统 IPC Handlers
// ============================================

const WORKORDER_API_BASE = 'http://61.151.241.233:8080/api/v1/workorder'

// 工单: 提交字段申请
ipcMain.handle('workorder:submit', async (_event, data: {
  field_name: string
  field_desc?: string
  calc_logic?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.post(
      `${WORKORDER_API_BASE}/field-request`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    console.log('✅ 工单提交成功:', response.data)
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 提交工单失败:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: error.message || '提交失败' }
  }
})

// 工单: 获取我的申请列表
ipcMain.handle('workorder:getMyList', async (_event, params: {
  page?: number
  page_size?: number
  status?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${WORKORDER_API_BASE}/field-request/my`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          status: params.status
        },
        timeout: 15000
      }
    )

    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 获取我的申请列表失败:', error)
    return { success: false, error: error.message || '获取失败' }
  }
})

// 工单: 获取所有申请列表（IT管理）
ipcMain.handle('workorder:getAllList', async (_event, params: {
  page?: number
  page_size?: number
  status?: string
  user_id?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${WORKORDER_API_BASE}/field-request`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          status: params.status,
          user_id: params.user_id
        },
        timeout: 15000
      }
    )

    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 获取所有申请列表失败:', error)
    return { success: false, error: error.message || '获取失败' }
  }
})

// 工单: 获取申请详情
ipcMain.handle('workorder:getDetail', async (_event, id: number) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${WORKORDER_API_BASE}/field-request/${id}`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 获取工单详情失败:', error)
    if (error.response?.status === 404) {
      return { success: false, error: '工单不存在' }
    }
    return { success: false, error: error.message || '获取失败' }
  }
})

// 工单: 更新申请状态（IT管理）
ipcMain.handle('workorder:updateStatus', async (_event, id: number, data: {
  status: string
  reject_reason?: string
  admin_note?: string
}) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.put(
      `${WORKORDER_API_BASE}/field-request/${id}/status`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    console.log('✅ 工单状态更新成功:', response.data)
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 更新工单状态失败:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: error.message || '更新失败' }
  }
})

// 工单: 获取统计信息
ipcMain.handle('workorder:getStats', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      `${WORKORDER_API_BASE}/field-request/stats`,
      {
        headers: {
          'X-API-Key': apiKey
        },
        timeout: 15000
      }
    )

    return { success: true, data: response.data }
  } catch (error: any) {
    console.error('❌ 获取工单统计失败:', error)
    return { success: false, error: error.message || '获取失败' }
  }
})

// IM: 获取 IM Token（通过 API Key 自动获取/创建）
ipcMain.handle('im:getToken', async () => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')
    const response = await axios.get(
      'http://61.151.241.233:8080/api/v1/account/im-token',
      {
        headers: { 'X-API-Key': apiKey },
        timeout: 15000
      }
    )

    if (response.data.success) {
      return {
        success: true,
        userID: response.data.userID,
        token: response.data.token,
        expireTimeSeconds: response.data.expireTimeSeconds,
        phoneNumber: response.data.phoneNumber || '',
        nickname: response.data.nickname || '',
        email: response.data.email || '',
        company: response.data.company || '',
      }
    } else {
      return { success: false, error: response.data.error || '获取IM凭证失败' }
    }
  } catch (error: any) {
    console.error('❌ 获取IM Token失败:', error)
    return { success: false, error: error.message || '网络错误' }
  }
})

// IM: 搜索用户（通过后端 API）
ipcMain.handle('im:searchUsers', async (_event, keyword: string, _token: string) => {
  try {
    const apiKey = getDefaultApiKeyForBacktest()
    if (!apiKey) {
      return { success: false, error: '未找到API Key' }
    }

    const axios = require('axios')

    // 通过后端搜索 IM 用户
    const resp = await axios.get(
      'http://61.151.241.233:8080/api/v1/account/im-search',
      {
        params: { keyword },
        headers: { 'X-API-Key': apiKey },
        timeout: 10000,
      }
    )

    if (resp.data?.success && resp.data?.users) {
      return { success: true, users: resp.data.users }
    }

    return { success: false, error: resp.data?.error || '搜索返回异常', raw: resp.data }
  } catch (error: any) {
    console.error('❌ IM搜索用户失败:', error?.response?.data || error.message)
    return {
      success: false,
      error: error?.response?.data?.error || error.message || '搜索失败',
      statusCode: error?.response?.status,
    }
  }
})

// ========== 数据库权限管理 API ==========

const DB_PERM_API_BASE = 'http://61.151.241.233:8080/api/v1/admin/db-permissions'

function dbPermHeaders() {
  const apiKey = getDefaultApiKeyForBacktest()
  if (!apiKey) throw new Error('未找到API Key')
  return { 'X-API-Key': apiKey }
}

async function dbPermGet(path: string, params?: Record<string, string>) {
  const axios = require('axios')
  const resp = await axios.get(`${DB_PERM_API_BASE}${path}`, { headers: dbPermHeaders(), params, timeout: 15000 })
  return resp.data
}

async function dbPermPost(path: string, body: any) {
  const axios = require('axios')
  const resp = await axios.post(`${DB_PERM_API_BASE}${path}`, body, { headers: dbPermHeaders(), timeout: 15000 })
  return resp.data
}

async function dbPermPut(path: string, body: any) {
  const axios = require('axios')
  const resp = await axios.put(`${DB_PERM_API_BASE}${path}`, body, { headers: dbPermHeaders(), timeout: 15000 })
  return resp.data
}

async function dbPermDelete(path: string, params?: Record<string, string>, body?: any) {
  const axios = require('axios')
  const config: any = { headers: dbPermHeaders(), timeout: 15000 }
  if (params) config.params = params
  if (body) config.data = body
  const resp = await axios.delete(`${DB_PERM_API_BASE}${path}`, config)
  return resp.data
}

function wrapDbPerm(fn: () => Promise<any>) {
  return async () => {
    try {
      const data = await fn()
      return { success: true, ...data }
    } catch (e: any) {
      const rd = e?.response?.data
      return { success: false, error: rd?.error || e.message || '请求失败', field: rd?.field }
    }
  }
}

ipcMain.handle('dbPerm:listDatabases', async (_e, dbType?: string) => {
  return wrapDbPerm(() => dbPermGet('/databases', dbType ? { db_type: dbType } : undefined))()
})

ipcMain.handle('dbPerm:listTables', async (_e, dbType: string, dbName: string) => {
  return wrapDbPerm(() => dbPermGet(`/databases/${dbType}/${dbName}/tables`))()
})

ipcMain.handle('dbPerm:listUsers', async (_e, dbType?: string) => {
  return wrapDbPerm(() => dbPermGet('/users', dbType ? { db_type: dbType } : undefined))()
})

ipcMain.handle('dbPerm:createUser', async (_e, body: any) => {
  return wrapDbPerm(() => dbPermPost('/users', body))()
})

ipcMain.handle('dbPerm:deleteUser', async (_e, username: string, dbType?: string) => {
  return wrapDbPerm(() => dbPermDelete(`/users/${username}`, dbType ? { db_type: dbType } : undefined))()
})

ipcMain.handle('dbPerm:changePassword', async (_e, username: string, body: any) => {
  return wrapDbPerm(() => dbPermPut(`/users/${username}/password`, body))()
})

ipcMain.handle('dbPerm:getUserGrants', async (_e, username: string, dbType?: string) => {
  return wrapDbPerm(() => dbPermGet(`/users/${username}/grants`, dbType ? { db_type: dbType } : undefined))()
})

ipcMain.handle('dbPerm:grantPrivileges', async (_e, username: string, body: any) => {
  return wrapDbPerm(() => dbPermPost(`/users/${username}/grants`, body))()
})

ipcMain.handle('dbPerm:revokePrivileges', async (_e, username: string, body: any) => {
  return wrapDbPerm(() => dbPermDelete(`/users/${username}/grants`, undefined, body))()
})

ipcMain.handle('dbPerm:revokeAllPrivileges', async (_e, username: string, body: any) => {
  return wrapDbPerm(() => dbPermDelete(`/users/${username}/grants/all`, undefined, body))()
})

ipcMain.handle('dbPerm:batchGrant', async (_e, username: string, body: any) => {
  return wrapDbPerm(() => dbPermPost(`/users/${username}/grants/batch`, body))()
})

// ── IM 独立进程 ──
ipcMain.handle('im:openWindow', async () => {
  try {
    const isMac = process.platform === 'darwin'
    const imExePath =
      process.env.NODE_ENV === 'development'
        ? isMac
          ? join(__dirname, '../../../openIM/electron-client/app/release/prod/1.2.1/mac-arm64/G-Snowball-IM.app/Contents/MacOS/G-Snowball-IM')
          : join(__dirname, '../../../openIM/electron-client/app/release/prod/1.2.1/win-unpacked/G-Snowball-IM.exe')
        : isMac
          ? join(process.resourcesPath, 'im', 'G-Snowball-IM.app', 'Contents', 'MacOS', 'G-Snowball-IM')
          : join(process.resourcesPath, 'im', 'G-Snowball-IM.exe')

    const cleanEnv: Record<string, string> = isMac
      ? {
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          HOME: process.env.HOME || '',
          USER: process.env.USER || '',
          TMPDIR: process.env.TMPDIR || '/tmp',
          SHELL: process.env.SHELL || '/bin/zsh',
          LANG: process.env.LANG || 'en_US.UTF-8',
        }
      : {
          PATH: process.env.PATH || '',
          SystemRoot: process.env.SystemRoot || 'C:\\Windows',
          TEMP: process.env.TEMP || '',
          TMP: process.env.TMP || '',
          APPDATA: process.env.APPDATA || '',
          LOCALAPPDATA: process.env.LOCALAPPDATA || '',
          USERPROFILE: process.env.USERPROFILE || '',
          ProgramFiles: process.env.ProgramFiles || '',
          CommonProgramFiles: process.env.CommonProgramFiles || '',
        }

    require('child_process').spawn(imExePath, [], {
      detached: true,
      stdio: 'ignore',
      env: cleanEnv,
      cwd: require('path').dirname(imExePath),
    }).unref()

    return { success: true }
  } catch (error: any) {
    console.error('❌ 启动IM失败:', error)
    return { success: false, error: error.message || '启动失败' }
  }
})

// ── OpenClaw 智能体控制本机 ──

import type { ChildProcess } from 'child_process'

let openclawProcess: ChildProcess | null = null
let openclawStatus: 'stopped' | 'starting' | 'running' | 'error' | 'connected' | 'disconnected' = 'stopped'
let openclawLastError: string = ''
let openclawMessage: string = ''

function sendOpenclawStatus() {
  try {
    mainWindow?.webContents?.send('openclaw:status-changed', {
      status: openclawProcess ? openclawStatus : 'stopped',
      message: openclawMessage,
      error: openclawLastError,
    })
  } catch { /* ignore if window destroyed */ }
}

function getOpenclawConfig(): { agentName: string; agentHistory: string[] } {
  const raw = store?.get('openclawConfig') as any || {}
  return {
    agentName: raw.agentName || '',
    agentHistory: Array.isArray(raw.agentHistory) ? raw.agentHistory : []
  }
}

function saveOpenclawAgentToHistory(agentName: string) {
  const config = getOpenclawConfig()
  const history = config.agentHistory.filter(n => n !== agentName)
  history.unshift(agentName)
  store?.set('openclawConfig', {
    agentName,
    agentHistory: history.slice(0, 20)
  })
}

function resolveOpenclawExePath(): string | null {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'
  const isArm = process.arch === 'arm64'

  const exeName = isWin
    ? 'openclaw-node-win.exe'
    : isMac
      ? (isArm ? 'openclaw-node-macos-arm64' : 'openclaw-node-macos-x64')
      : null

  if (!exeName) return null

  const prodPath = join(process.resourcesPath, 'openclaw', exeName)
  if (fs.existsSync(prodPath)) return prodPath

  const devPaths = [
    join(__dirname, '../../../openclaw', exeName),
    join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', '打包程序', exeName),
  ]
  for (const p of devPaths) {
    if (fs.existsSync(p)) return p
  }

  return null
}

function getOpenclawConfigDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming'), 'openclaw')
  }
  if (process.platform === 'darwin') {
    return join(process.env.HOME || '', 'Library', 'Application Support', 'openclaw')
  }
  return join(process.env.HOME || '', '.config', 'openclaw')
}

function writeNodeConfig(agentName: string) {
  const configDir = getOpenclawConfigDir()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  const configPath = join(configDir, 'node-config.json')
  const gatewayUrl = `ws://61.151.241.233:8080/openclaw/agent/${agentName}`
  const config = {
    agentName,
    gatewayUrl,
    token: 'unified-gateway-token-2026'
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

ipcMain.handle('openclaw:start', async (_e, agentName: string) => {
  try {
    if (openclawProcess) {
      return { success: false, error: '已在运行中' }
    }

    if (!agentName?.trim()) {
      return { success: false, error: '请输入智能体名称' }
    }

    const exePath = resolveOpenclawExePath()
    if (!exePath) {
      return { success: false, error: '未找到 openclaw-node 程序，请确认已正确安装' }
    }

    if (process.platform !== 'win32') {
      try { fs.chmodSync(exePath, 0o755) } catch { /* ignore */ }
    }

    writeNodeConfig(agentName.trim())
    saveOpenclawAgentToHistory(agentName.trim())

    openclawStatus = 'starting'
    openclawLastError = ''

    const { spawn: spawnChild } = require('child_process') as typeof import('child_process')
    openclawProcess = spawnChild(exePath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: path.dirname(exePath),
      windowsHide: true,
    })

    openclawProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      console.log('[OpenClaw]', text)

      if (text.includes('连接成功')) {
        openclawStatus = 'connected'
        openclawMessage = text
        sendOpenclawStatus()
      } else if (text.includes('连接失败')) {
        openclawStatus = 'error'
        openclawMessage = text
        openclawLastError = text
        sendOpenclawStatus()
      } else if (text.includes('连接已断开')) {
        openclawStatus = 'disconnected'
        openclawMessage = text
        sendOpenclawStatus()
      } else if (text.includes('正在连接')) {
        openclawStatus = 'starting'
        openclawMessage = text
        sendOpenclawStatus()
      }
    })

    openclawProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      console.error('[OpenClaw Error]', text)
      if (!text.includes('Warning:') && !text.includes('single-executable')) {
        openclawLastError = text
        sendOpenclawStatus()
      }
    })

    openclawProcess.on('close', (code: number | null) => {
      console.log(`[OpenClaw] 进程退出, code=${code}`)
      openclawProcess = null
      openclawStatus = code === 0 ? 'stopped' : 'error'
      openclawMessage = code === 0 ? '已停止' : `进程异常退出 (code: ${code})`
      if (code !== 0 && code !== null) {
        openclawLastError = `进程异常退出 (code: ${code})`
      }
      sendOpenclawStatus()
    })

    openclawProcess.on('error', (err: Error) => {
      console.error('[OpenClaw] 启动失败:', err)
      openclawProcess = null
      openclawStatus = 'error'
      openclawLastError = err.message
      openclawMessage = '启动失败: ' + err.message
      sendOpenclawStatus()
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    if ((openclawStatus as string) === 'error') {
      return { success: false, error: openclawLastError || '启动失败' }
    }

    return { success: true }
  } catch (error: any) {
    openclawStatus = 'error'
    openclawLastError = error.message
    return { success: false, error: error.message || '启动失败' }
  }
})

ipcMain.handle('openclaw:stop', async () => {
  try {
    if (!openclawProcess) {
      openclawStatus = 'stopped'
      return { success: true }
    }

    openclawProcess.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (openclawProcess) {
          openclawProcess.kill('SIGKILL')
        }
        resolve()
      }, 3000)

      openclawProcess?.on('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    openclawProcess = null
    openclawStatus = 'stopped'
    openclawLastError = ''
    openclawMessage = ''
    sendOpenclawStatus()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || '停止失败' }
  }
})

ipcMain.handle('openclaw:getStatus', async () => {
  return {
    status: openclawProcess ? openclawStatus : 'stopped',
    agentName: getOpenclawConfig().agentName,
    message: openclawMessage,
    error: openclawLastError
  }
})

ipcMain.handle('openclaw:getConfig', async () => {
  return getOpenclawConfig()
})
