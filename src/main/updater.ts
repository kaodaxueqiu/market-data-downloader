import axios from 'axios'
import { app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const UPDATE_SERVER = 'http://61.151.241.233:8080'

// 从app获取当前版本号
function getCurrentVersion(): string {
  return app.getVersion()
}

interface UpdateInfo {
  version: string
  release_date: string
  release_notes: string
  downloads: {
    windows: {
      url: string
      size: number
      md5: string
    }
    mac_intel: {
      url: string
      size: number
      md5: string
    }
    mac_arm64: {
      url: string
      size: number
      md5: string
    }
  }
  minimum_version: string
  force_update: boolean
}

// 版本号比较
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0
    
    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }
  
  return 0
}

// 检查更新
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    console.log('检查更新...', `${UPDATE_SERVER}/api/v1/client/version/latest`)
    const response = await axios.get(`${UPDATE_SERVER}/api/v1/client/version/latest`, {
      timeout: 10000
    })
    
    if (response.data.code !== 200) {
      throw new Error(response.data.message || '检查更新失败')
    }
    
    const updateInfo: UpdateInfo = response.data.data
    const latestVersion = updateInfo.version
    const currentVersion = getCurrentVersion()
    
    console.log(`当前版本: ${currentVersion}, 最新版本: ${latestVersion}`)
    
    // 比较版本号
    if (compareVersions(latestVersion, currentVersion) > 0) {
      console.log('发现新版本!')
      return updateInfo
    }
    
    console.log('已是最新版本')
    return null
  } catch (error: any) {
    console.error('检查更新异常:', error.message)
    throw error
  }
}

// 下载更新（带进度回调）
export async function downloadUpdate(
  updateInfo: UpdateInfo,
  parentWindow: Electron.BrowserWindow | null,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  const platform = process.platform
  let downloadInfo: { url: string; size: number; md5: string }
  
  // 根据平台选择下载地址
  if (platform === 'win32') {
    downloadInfo = updateInfo.downloads.windows
  } else if (platform === 'darwin') {
    const arch = process.arch
    downloadInfo = arch === 'arm64' 
      ? updateInfo.downloads.mac_arm64 
      : updateInfo.downloads.mac_intel
  } else {
    throw new Error('不支持的平台')
  }
  
  const downloadUrl = downloadInfo.url
  const expectedMD5 = downloadInfo.md5
  const fileSize = downloadInfo.size
  
  // 让用户选择保存位置
  const filename = path.basename(downloadUrl)
  const defaultPath = path.join(app.getPath('downloads'), filename)
  
  console.log('准备显示保存对话框...')
  console.log('默认路径:', defaultPath)
  console.log('父窗口存在:', !!parentWindow)
  
  const saveDialogOptions = {
    title: '选择保存位置',
    defaultPath: defaultPath,
    buttonLabel: '开始下载',
    filters: [
      { 
        name: platform === 'win32' ? 'Windows压缩包' : 'macOS安装包', 
        extensions: platform === 'win32' ? ['zip'] : ['dmg'] 
      },
      { name: '所有文件', extensions: ['*'] }
    ]
  }
  
  console.log('显示保存对话框...')
  const result = parentWindow 
    ? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
    : await dialog.showSaveDialog(saveDialogOptions)
  
  console.log('对话框结果:', result)
  
  if (result.canceled || !result.filePath) {
    console.log('用户取消下载')
    throw new Error('用户取消下载')
  }
  
  const downloadPath = result.filePath
  console.log('用户选择的保存路径:', downloadPath)
  
  console.log('开始下载:', downloadUrl)
  
  if (onProgress) {
    onProgress(0, '正在连接...')
  }
  
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    timeout: 300000, // 5分钟超时
    onDownloadProgress: (progressEvent) => {
      const loaded = progressEvent.loaded || 0
      const total = progressEvent.total || fileSize
      const percentCompleted = Math.round((loaded * 100) / total)
      
      const downloadedMB = (loaded / 1024 / 1024).toFixed(2)
      const totalMB = (total / 1024 / 1024).toFixed(2)
      
      console.log(`下载进度: ${percentCompleted}% (${downloadedMB}MB / ${totalMB}MB)`)
      
      if (onProgress) {
        onProgress(percentCompleted, `已下载 ${downloadedMB}MB / ${totalMB}MB`)
      }
    }
  })
  
  const writer = fs.createWriteStream(downloadPath)
  response.data.pipe(writer)
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('下载完成')
      
      // 验证MD5（如果提供）
      if (expectedMD5) {
        console.log('验证文件完整性...')
        const fileMD5 = calculateMD5(downloadPath)
        console.log(`期望MD5: ${expectedMD5}`)
        console.log(`实际MD5: ${fileMD5}`)
        
        if (fileMD5 !== expectedMD5) {
          reject(new Error('文件校验失败，MD5不匹配'))
          return
        }
        console.log('✅ MD5校验通过')
      }
      
      if (onProgress) {
        onProgress(100, '下载完成')
      }
      
      resolve(downloadPath)
    })
    
    writer.on('error', (error) => {
      console.error('文件写入失败:', error)
      reject(error)
    })
  })
}

// 计算文件MD5
function calculateMD5(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  const hash = crypto.createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

// 安装更新
export async function installUpdate(filePath: string): Promise<void> {
  const platform = process.platform
  
  console.log('准备安装更新:', filePath)
  
  if (platform === 'win32') {
    // Windows绿色版: 显示提示信息
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '新版本已下载',
      message: `新版本文件已下载完成`,
      detail: `使用说明：\n1. 关闭当前应用\n2. 解压下载的zip文件\n3. 运行解压后的exe文件\n4. 删除旧版本（可选）\n\n文件路径：${filePath}`,
      buttons: ['我知道了', '立即退出应用'],
      defaultId: 0,
      cancelId: 0
    })
    
    if (result.response === 1) {
      app.quit()
    }
  } else if (platform === 'darwin') {
    // macOS: 显示提示信息
    await dialog.showMessageBox({
      type: 'info',
      title: '新版本已下载',
      message: '新版本已下载完成',
      detail: `使用说明：\n1. 双击打开dmg文件\n2. 将新版本app拖到应用程序文件夹替换旧版本\n3. 运行新版本\n\n文件路径：${filePath}`,
      buttons: ['知道了']
    })
  }
}

// 下载更新到指定路径（不显示对话框）
export async function downloadUpdateToPath(
  updateInfo: UpdateInfo,
  savePath: string,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  const platform = process.platform
  let downloadInfo: { url: string; size: number; md5: string }
  
  // 根据平台选择下载地址
  if (platform === 'win32') {
    downloadInfo = updateInfo.downloads.windows
  } else if (platform === 'darwin') {
    const arch = process.arch
    downloadInfo = arch === 'arm64' 
      ? updateInfo.downloads.mac_arm64 
      : updateInfo.downloads.mac_intel
  } else {
    throw new Error('不支持的平台')
  }
  
  const downloadUrl = downloadInfo.url
  const expectedMD5 = downloadInfo.md5
  const fileSize = downloadInfo.size
  
  console.log('开始下载:', downloadUrl)
  console.log('保存到:', savePath)
  
  if (onProgress) {
    onProgress(0, '正在连接...')
  }
  
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    timeout: 300000,
    onDownloadProgress: (progressEvent) => {
      const loaded = progressEvent.loaded || 0
      const total = progressEvent.total || fileSize
      const percentCompleted = Math.round((loaded * 100) / total)
      
      const downloadedMB = (loaded / 1024 / 1024).toFixed(2)
      const totalMB = (total / 1024 / 1024).toFixed(2)
      
      if (onProgress) {
        onProgress(percentCompleted, `已下载 ${downloadedMB}MB / ${totalMB}MB`)
      }
    }
  })
  
  const writer = fs.createWriteStream(savePath)
  response.data.pipe(writer)
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('下载完成')
      
      // 验证MD5（如果提供）
      if (expectedMD5) {
        const fileMD5 = calculateMD5(savePath)
        if (fileMD5 !== expectedMD5) {
          reject(new Error('文件校验失败，MD5不匹配'))
          return
        }
        console.log('✅ MD5校验通过')
      }
      
      if (onProgress) {
        onProgress(100, '下载完成')
      }
      
      resolve(savePath)
    })
    
    writer.on('error', (error) => {
      console.error('文件写入失败:', error)
      reject(error)
    })
  })
}

// 导出getCurrentVersion
export { getCurrentVersion }

