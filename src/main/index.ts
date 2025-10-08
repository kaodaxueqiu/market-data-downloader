import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import downloadManager from './download'
import { ConfigManager } from './config'
import { getDictionaryAPI } from './dictionary'
import { getDbDictAPI } from './dbdict'

// 禁用GPU加速，避免Windows上的GPU崩溃问题
app.disableHardwareAcceleration()

// 配置自动更新
autoUpdater.autoDownload = false // 不自动下载，让用户确认
autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装

// 配置存储 - 延迟初始化，确保app准备就绪
let store: Store
let configManager: ConfigManager

// 主窗口
let mainWindow: BrowserWindow | null = null

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
        // DevTools会导致崩溃，保持禁用
        // mainWindow!.webContents.openDevTools()
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
  })

  // 窗口关闭处理
  mainWindow.on('closed', () => {
    console.log('窗口已关闭')
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

// 保存API Key
ipcMain.handle('config:saveApiKey', async (_event, apiKey: string, name: string, isDefault: boolean) => {
  return configManager.saveApiKey(apiKey, name, isDefault)
})

// 删除API Key
ipcMain.handle('config:deleteApiKey', async (_event, id: string) => {
  return configManager.deleteApiKey(id)
})

// 获取完整的API Key（用于下载）
ipcMain.handle('config:getFullApiKey', async (_event, id: string) => {
  return configManager.getFullApiKey(id)
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

// 打开文件所在目录
ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
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

// 初始化数据字典API Key
ipcMain.handle('dictionary:setApiKey', async (_event, apiKey: string) => {
  dictionaryAPI.setApiKey(apiKey)
  return true
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
ipcMain.handle('dbdict:getTableDetail', async (_event, tableName: string) => {
  try {
    const result = await dbDictAPI.getTableDetail(tableName)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取表详情失败')
  }
})

// 获取表字段
ipcMain.handle('dbdict:getTableFields', async (_event, tableName: string) => {
  try {
    const result = await dbDictAPI.getTableFields(tableName)
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取表字段失败')
  }
})

// 获取分类统计
ipcMain.handle('dbdict:getCategories', async () => {
  try {
    const result = await dbDictAPI.getCategories()
    return result
  } catch (error: any) {
    throw new Error(error.message || '获取分类统计失败')
  }
})

// 搜索表和字段
ipcMain.handle('dbdict:search', async (_event, keyword: string) => {
  try {
    const result = await dbDictAPI.search(keyword)
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
ipcMain.handle('dbdict:getStats', async () => {
  try {
    const result = await dbDictAPI.getStats()
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
ipcMain.handle('dbdict:clearCache', async () => {
  try {
    const result = await dbDictAPI.clearCache()
    return result
  } catch (error: any) {
    throw new Error(error.message || '清除缓存失败')
  }
})

// 下载静态数据
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

// ========== 自动更新功能 ==========

// 检查更新
ipcMain.handle('updater:checkForUpdates', async () => {
  try {
    console.log('检查更新...')
    const result = await autoUpdater.checkForUpdates()
    return {
      updateAvailable: result !== null,
      version: result?.updateInfo.version,
      releaseNotes: result?.updateInfo.releaseNotes
    }
  } catch (error: any) {
    console.error('检查更新失败:', error)
    throw new Error(error.message || '检查更新失败')
  }
})

// 下载更新
ipcMain.handle('updater:downloadUpdate', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return true
  } catch (error: any) {
    console.error('下载更新失败:', error)
    throw new Error(error.message || '下载更新失败')
  }
})

// 安装更新（退出并安装）
ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall()
})

// 自动更新事件
autoUpdater.on('checking-for-update', () => {
  console.log('正在检查更新...')
  mainWindow?.webContents.send('updater:checking')
})

autoUpdater.on('update-available', (info) => {
  console.log('发现新版本:', info.version)
  mainWindow?.webContents.send('updater:update-available', info)
})

autoUpdater.on('update-not-available', () => {
  console.log('当前已是最新版本')
  mainWindow?.webContents.send('updater:update-not-available')
})

autoUpdater.on('download-progress', (progress) => {
  console.log(`下载进度: ${progress.percent}%`)
  mainWindow?.webContents.send('updater:download-progress', progress)
})

autoUpdater.on('update-downloaded', () => {
  console.log('更新下载完成')
  mainWindow?.webContents.send('updater:update-downloaded')
})

autoUpdater.on('error', (error) => {
  console.error('更新错误:', error)
  mainWindow?.webContents.send('updater:error', error.message)
})
