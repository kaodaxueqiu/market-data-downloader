/**
 * SSH 连接管理器
 * 支持 Linux 和 Windows 服务器（需开启 SSH 服务）
 */

import { Client, ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'

// SSH 连接配置
export interface SSHConfig {
  id: string           // 唯一标识
  name: string         // 连接名称
  host: string         // 服务器地址
  port: number         // 端口，默认 22
  username: string     // 用户名
  password: string     // 密码
  remotePath: string   // 远程项目路径
  osType: 'linux' | 'windows'  // 操作系统类型
}

// SSH 连接状态
export type SSHConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// SSH 连接实例
interface SSHConnection {
  config: SSHConfig
  client: Client
  status: SSHConnectionStatus
  lastError?: string
}

export class SSHManager extends EventEmitter {
  private connections: Map<string, SSHConnection> = new Map()
  
  constructor() {
    super()
  }
  
  /**
   * 连接到 SSH 服务器
   */
  async connect(config: SSHConfig): Promise<{ success: boolean; error?: string }> {
    console.log(`[SSH] 连接到 ${config.host}:${config.port}...`)
    
    // 如果已存在连接，先断开
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }
    
    const client = new Client()
    const connection: SSHConnection = {
      config,
      client,
      status: 'connecting'
    }
    
    this.connections.set(config.id, connection)
    this.emit('status-change', config.id, 'connecting')
    
    return new Promise((resolve) => {
      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        readyTimeout: 10000,  // 10秒超时
        keepaliveInterval: 30000,  // 30秒心跳
      }
      
      client.on('ready', () => {
        console.log(`[SSH] 连接成功: ${config.host}`)
        connection.status = 'connected'
        this.emit('status-change', config.id, 'connected')
        resolve({ success: true })
      })
      
      client.on('error', (err) => {
        console.error(`[SSH] 连接错误: ${err.message}`)
        connection.status = 'error'
        connection.lastError = err.message
        this.emit('status-change', config.id, 'error', err.message)
        resolve({ success: false, error: err.message })
      })
      
      client.on('close', () => {
        console.log(`[SSH] 连接关闭: ${config.host}`)
        connection.status = 'disconnected'
        this.emit('status-change', config.id, 'disconnected')
      })
      
      client.on('end', () => {
        console.log(`[SSH] 连接结束: ${config.host}`)
        connection.status = 'disconnected'
        this.emit('status-change', config.id, 'disconnected')
      })
      
      try {
        client.connect(connectConfig)
      } catch (err: any) {
        console.error(`[SSH] 连接异常: ${err.message}`)
        connection.status = 'error'
        connection.lastError = err.message
        resolve({ success: false, error: err.message })
      }
    })
  }
  
  /**
   * 断开 SSH 连接
   */
  async disconnect(id: string): Promise<void> {
    const connection = this.connections.get(id)
    if (connection) {
      console.log(`[SSH] 断开连接: ${connection.config.host}`)
      connection.client.end()
      this.connections.delete(id)
    }
  }
  
  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const [id] of this.connections) {
      await this.disconnect(id)
    }
  }
  
  /**
   * 执行远程命令
   */
  async exec(id: string, command: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    const connection = this.connections.get(id)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    if (connection.status !== 'connected') {
      return { success: false, error: '未连接到服务器' }
    }
    
    console.log(`[SSH] 执行命令: ${command}`)
    
    return new Promise((resolve) => {
      connection.client.exec(command, (err, stream) => {
        if (err) {
          console.error(`[SSH] 执行命令失败: ${err.message}`)
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
          console.log(`[SSH] 命令执行完成，退出码: ${code}`)
          if (code === 0) {
            resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() })
          } else {
            resolve({ success: false, stdout: stdout.trim(), stderr: stderr.trim(), error: `退出码: ${code}` })
          }
        })
      })
    })
  }
  
  /**
   * 执行远程 Git 命令
   */
  async execGit(id: string, gitCommand: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    const connection = this.connections.get(id)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    const remotePath = connection.config.remotePath
    const isWindows = connection.config.osType === 'windows'
    
    // 构建完整命令
    let fullCommand: string
    if (isWindows) {
      // Windows: cd /d path && git command
      fullCommand = `cd /d "${remotePath}" && git ${gitCommand}`
    } else {
      // Linux: cd path && git command
      fullCommand = `cd "${remotePath}" && git ${gitCommand}`
    }
    
    return this.exec(id, fullCommand)
  }
  
  /**
   * 获取连接状态
   */
  getStatus(id: string): SSHConnectionStatus {
    const connection = this.connections.get(id)
    return connection?.status || 'disconnected'
  }
  
  /**
   * 获取连接信息
   */
  getConnection(id: string): SSHConfig | null {
    const connection = this.connections.get(id)
    return connection?.config || null
  }
  
  /**
   * 获取所有连接
   */
  getAllConnections(): Array<{ config: SSHConfig; status: SSHConnectionStatus }> {
    const result: Array<{ config: SSHConfig; status: SSHConnectionStatus }> = []
    for (const [, connection] of this.connections) {
      result.push({
        config: connection.config,
        status: connection.status
      })
    }
    return result
  }
  
  /**
   * 测试连接
   */
  async testConnection(config: Omit<SSHConfig, 'id' | 'name' | 'remotePath' | 'osType'>): Promise<{ success: boolean; error?: string; osType?: 'linux' | 'windows' }> {
    console.log(`[SSH] 测试连接: ${config.host}:${config.port}`)
    
    const client = new Client()
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.end()
        resolve({ success: false, error: '连接超时' })
      }, 10000)
      
      client.on('ready', () => {
        clearTimeout(timeout)
        console.log(`[SSH] 测试连接成功: ${config.host}`)
        
        // 检测操作系统类型
        client.exec('uname -s 2>/dev/null || echo WINDOWS', (err, stream) => {
          if (err) {
            client.end()
            resolve({ success: true, osType: 'linux' })
            return
          }
          
          let output = ''
          stream.on('data', (data: Buffer) => {
            output += data.toString()
          })
          
          stream.on('close', () => {
            client.end()
            const osType = output.trim().toUpperCase().includes('WINDOWS') ? 'windows' : 'linux'
            console.log(`[SSH] 检测到操作系统: ${osType}`)
            resolve({ success: true, osType })
          })
        })
      })
      
      client.on('error', (err) => {
        clearTimeout(timeout)
        console.error(`[SSH] 测试连接失败: ${err.message}`)
        resolve({ success: false, error: err.message })
      })
      
      try {
        client.connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          readyTimeout: 10000
        })
      } catch (err: any) {
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      }
    })
  }
  
  /**
   * 检查远程路径是否存在且是 Git 仓库
   */
  async checkRemotePath(id: string, remotePath: string): Promise<{ 
    success: boolean
    exists: boolean
    isGitRepo: boolean
    error?: string 
  }> {
    const connection = this.connections.get(id)
    if (!connection) {
      return { success: false, exists: false, isGitRepo: false, error: '连接不存在' }
    }
    
    const isWindows = connection.config.osType === 'windows'
    
    // 检查目录是否存在
    let checkCommand: string
    if (isWindows) {
      checkCommand = `if exist "${remotePath}" (echo EXISTS) else (echo NOT_EXISTS)`
    } else {
      checkCommand = `[ -d "${remotePath}" ] && echo EXISTS || echo NOT_EXISTS`
    }
    
    const existsResult = await this.exec(id, checkCommand)
    if (!existsResult.success) {
      return { success: false, exists: false, isGitRepo: false, error: existsResult.error }
    }
    
    const exists = existsResult.stdout?.includes('EXISTS') || false
    if (!exists) {
      return { success: true, exists: false, isGitRepo: false }
    }
    
    // 检查是否是 Git 仓库
    let gitCheckCommand: string
    if (isWindows) {
      gitCheckCommand = `if exist "${remotePath}\\.git" (echo IS_GIT) else (echo NOT_GIT)`
    } else {
      gitCheckCommand = `[ -d "${remotePath}/.git" ] && echo IS_GIT || echo NOT_GIT`
    }
    
    const gitResult = await this.exec(id, gitCheckCommand)
    const isGitRepo = gitResult.stdout?.includes('IS_GIT') || false
    
    return { success: true, exists: true, isGitRepo }
  }
}

// 单例
let sshManager: SSHManager | null = null

export function getSSHManager(): SSHManager {
  if (!sshManager) {
    sshManager = new SSHManager()
  }
  return sshManager
}

