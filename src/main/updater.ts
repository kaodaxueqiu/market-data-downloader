import axios from 'axios'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { spawn } from 'child_process'

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

// 静默下载更新到临时目录（不显示任何对话框）
export async function downloadUpdateSilently(
  updateInfo: UpdateInfo,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  const platform = process.platform
  let downloadInfo: { url: string; size: number; md5: string }

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

  // 下载到临时目录
  const filename = path.basename(downloadUrl)
  const tempDir = path.join(app.getPath('temp'), 'g-snowball-updates')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const savePath = path.join(tempDir, filename)

  console.log('静默下载:', downloadUrl)
  console.log('保存到:', savePath)

  if (onProgress) {
    onProgress(0, '正在连接...')
  }

  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    timeout: 600000,
    onDownloadProgress: (progressEvent) => {
      const loaded = progressEvent.loaded || 0
      const total = progressEvent.total || fileSize
      // loaded 可能超过 total（gzip 传输 / 清单 size 偏小），钳制到 0~100 避免出现 114% 这类越界值
      const percentCompleted = Math.min(100, Math.max(0, Math.round((loaded * 100) / total)))

      if (onProgress) {
        onProgress(percentCompleted, `已下载 ${Math.round(loaded / 1024 / 1024)}MB / ${Math.round(total / 1024 / 1024)}MB`)
      }
    }
  })

  const writer = fs.createWriteStream(savePath)
  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('下载完成')

      if (expectedMD5) {
        const fileMD5 = calculateMD5(savePath)
        if (fileMD5 !== expectedMD5) {
          reject(new Error('文件校验失败，MD5不匹配'))
          return
        }
        console.log('MD5校验通过')
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

// 计算文件MD5
function calculateMD5(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  const hash = crypto.createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

// 杀掉 IM 子进程（通过进程名匹配）
function killIMProcess() {
  const platform = process.platform
  const imName = platform === 'win32' ? 'G-Snowball-IM.exe' : 'G-Snowball-IM'

  try {
    if (platform === 'win32') {
      spawn('taskkill', ['/F', '/IM', imName], {
        detached: true,
        shell: false,
        stdio: 'ignore'
      }).unref()
    } else if (platform === 'darwin') {
      spawn('pkill', ['-f', imName], {
        detached: true,
        shell: false,
        stdio: 'ignore'
      }).unref()
    }
    console.log('IM进程已终止')
  } catch (error) {
    console.error('终止IM进程失败:', error)
  }
}

// 安装更新：自动运行安装包并退出当前应用
export async function installUpdate(filePath: string): Promise<void> {
  const platform = process.platform

  // 安装前校验文件完整性
  if (!fs.existsSync(filePath)) {
    throw new Error('安装包文件不存在，请重新下载')
  }

  const stats = fs.statSync(filePath)
  console.log('安装包大小:', stats.size)

  if (currentUpdateInfo) {
    const downloadInfo = platform === 'win32'
      ? currentUpdateInfo.downloads.windows
      : process.arch === 'arm64'
        ? currentUpdateInfo.downloads.mac_arm64
        : currentUpdateInfo.downloads.mac_intel

    if (downloadInfo && downloadInfo.size > 0) {
      if (stats.size < downloadInfo.size) {
        throw new Error(`安装包不完整（${stats.size}/${downloadInfo.size}），请重新下载`)
      }
    }
  }

  console.log('自动运行安装包:', filePath)

  if (platform === 'win32') {
    // 生成临时 bat：轮询等待主进程 PID 结束后再启动安装器，彻底消除“exe 被占用导致 NSIS 无法关闭”的竞态
    const pid = process.pid
    const tempDir = path.join(app.getPath('temp'), 'g-snowball-updates')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const batPath = path.join(tempDir, 'run-installer.bat')
    // :wait 循环用 tasklist 检测 PID 是否仍存在，存在则等 1 秒重试；退出后再启动安装器并自删脚本
    const batContent = [
      '@echo off',
      ':wait',
      `tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`,
      'if not errorlevel 1 (',
      '  timeout /t 1 /nobreak >nul',
      '  goto wait',
      ')',
      `start "" "${filePath}"`,
      'del "%~f0"'
    ].join('\r\n')
    fs.writeFileSync(batPath, batContent, 'utf-8')

    spawn('cmd', ['/c', batPath], {
      detached: true,
      shell: false,
      stdio: 'ignore'
    }).unref()
  } else if (platform === 'darwin') {
    // macOS: .pkg 安装包，用 open 命令打开安装向导
    spawn('open', [filePath], {
      detached: true,
      shell: false,
      stdio: 'ignore'
    }).unref()
  }

  // 杀掉 IM 进程
  killIMProcess()

  // 立即退出当前应用；bat 会等本进程真正结束后才启动安装器
  app.quit()
}

// 启动时清理临时目录中与当前版本号相同的安装包（更新完成后残留的旧文件）
export function cleanOldUpdateFiles() {
  try {
    const tempDir = path.join(app.getPath('temp'), 'g-snowball-updates')
    if (!fs.existsSync(tempDir)) return

    const currentVersion = getCurrentVersion()
    const files = fs.readdirSync(tempDir)
    for (const file of files) {
      // 只删除文件名中包含当前版本号的安装包
      if (file.includes(currentVersion)) {
        const filePath = path.join(tempDir, file)
        try {
          fs.unlinkSync(filePath)
          console.log('清理当前版本残留安装包:', filePath)
        } catch (e) {
          // 文件可能被占用，忽略
        }
      }
    }
  } catch (e) {
    console.log('清理临时目录失败:', e)
  }
}

// 检查临时目录中是否已存在下载好的安装包（大小和MD5校验通过）
export function checkExistingUpdate(updateInfo: any): string | null {
  const platform = process.platform
  let downloadInfo: { url: string; size: number; md5: string }

  if (platform === 'win32') {
    downloadInfo = updateInfo.downloads.windows
  } else if (platform === 'darwin') {
    downloadInfo = process.arch === 'arm64'
      ? updateInfo.downloads.mac_arm64
      : updateInfo.downloads.mac_intel
  } else {
    return null
  }

  const filename = path.basename(downloadInfo.url)
  const tempDir = path.join(app.getPath('temp'), 'g-snowball-updates')
  const filePath = path.join(tempDir, filename)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const stats = fs.statSync(filePath)
  if (stats.size !== downloadInfo.size) {
    console.log(`本地安装包大小不匹配: ${stats.size} / ${downloadInfo.size}`)
    return null
  }

  const fileMD5 = calculateMD5(filePath)
  if (fileMD5 !== downloadInfo.md5) {
    console.log('本地安装包MD5校验失败')
    return null
  }

  console.log('本地已存在完整的安装包:', filePath)
  return filePath
}

// 保存当前更新信息供安装时校验
let currentUpdateInfo: any = null
export function setCurrentUpdateInfo(info: any) {
  currentUpdateInfo = info
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
      // loaded 可能超过 total（gzip 传输 / 清单 size 偏小），钳制到 0~100 避免出现 114% 这类越界值
      const percentCompleted = Math.min(100, Math.max(0, Math.round((loaded * 100) / total)))
      
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

