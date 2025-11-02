/**
 * WebSocket 订阅任务管理器
 * 支持多个订阅任务并发运行
 */
import { SubscriptionSession } from './subscriptionSession'
import { BrowserWindow } from 'electron'

interface SubscriptionTask {
  id: string
  sourceCode: string
  sourceName: string
  symbols: string[]
  fields: string[]
  savePath: string
  status: 'connecting' | 'connected' | 'subscribing' | 'stopped' | 'error'
  startTime: number
  totalReceived: number
  dataRate: number
  error?: string
  session: SubscriptionSession
}

export class SubscriptionTaskManager {
  private tasks: Map<string, SubscriptionTask> = new Map()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  // 创建订阅任务
  async createTask(apiKey: string, config: {
    sourceCode: string
    sourceName: string
    symbols: string[]
    fields: string[]
    savePath: string
  }): Promise<string> {
    // 生成任务ID
    const taskId = this.generateTaskId()
    
    console.log('📋 创建订阅任务:', taskId, config)

    // 创建订阅会话（传递 apiKey）
    const session = new SubscriptionSession(this.mainWindow, apiKey)

    // 创建任务记录
    const task: SubscriptionTask = {
      id: taskId,
      sourceCode: config.sourceCode,
      sourceName: config.sourceName,
      symbols: config.symbols,
      fields: config.fields,
      savePath: config.savePath,
      status: 'connecting',
      startTime: Date.now(),
      totalReceived: 0,
      dataRate: 0,
      session
    }

    this.tasks.set(taskId, task)

    // 启动任务（异步）
    this.startTask(taskId, apiKey, config).catch(error => {
      console.error('❌ 任务启动失败:', error)
      task.status = 'error'
      task.error = error.message
    })

    return taskId
  }

  // 启动任务
  private async startTask(taskId: string, _apiKey: string, config: any) {
    const task = this.tasks.get(taskId)
    if (!task) return

    try {
      task.status = 'connecting'
      
      // 启动订阅（内部会自动连接 WebSocket）
      await task.session.start(config)
      
      task.status = 'subscribing'
      console.log('✅ 任务订阅已启动:', taskId)
    } catch (error: any) {
      console.error('❌ 任务启动失败:', taskId, error)
      task.status = 'error'
      task.error = error.message
      throw error
    }
  }

  // 停止任务
  async stopTask(taskId: string): Promise<string> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }

    console.log('⏸ 停止任务:', taskId)
    
    const savedPath = await task.session.stop()
    task.status = 'stopped'

    console.log('✅ 任务已停止:', taskId)
    return savedPath
  }

  // 断开并删除任务
  disconnectTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }

    task.session.cleanup()
    this.tasks.delete(taskId)
    
    console.log('🔌 任务已断开并删除:', taskId)
  }

  // 获取所有任务
  getAllTasks(): any[] {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      type: 'realtime_subscription',  // 任务类型
      sourceCode: task.sourceCode,
      sourceName: task.sourceName,
      symbols: task.symbols,
      fieldCount: task.fields.length,
      savePath: task.savePath,
      status: task.status,
      startTime: new Date(task.startTime).toISOString(),
      totalReceived: task.totalReceived,
      dataRate: task.dataRate,
      runningTime: Math.round((Date.now() - task.startTime) / 1000),
      error: task.error
    }))
  }

  // 获取单个任务
  getTask(taskId: string): any {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const sessionStatus = task.session.getStatus()

    return {
      id: task.id,
      type: 'realtime_subscription',
      sourceCode: task.sourceCode,
      sourceName: task.sourceName,
      symbols: task.symbols,
      fieldCount: task.fields.length,
      savePath: task.savePath,
      status: task.status,
      startTime: new Date(task.startTime).toISOString(),
      ...sessionStatus  // 合并会话状态
    }
  }

  // 更新任务统计（由 session 回调）
  updateTaskStats(taskId: string, stats: any) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.totalReceived = stats.totalReceived || 0
      task.dataRate = stats.dataRate || 0
    }
  }

  // 生成任务ID
  private generateTaskId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    return `sub_${timestamp}_${random}`
  }

  // 清理已停止的任务
  clearStoppedTasks() {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'stopped') {
        this.tasks.delete(taskId)
      }
    }
  }

  // 停止所有任务（应用退出时调用）
  async stopAllTasks() {
    console.log('🛑 停止所有订阅任务...')
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'subscribing') {
        try {
          await task.session.stop()
        } catch (error) {
          console.error(`停止任务 ${taskId} 失败:`, error)
        }
      }
      task.session.cleanup()
    }
    
    this.tasks.clear()
    console.log('✅ 所有订阅任务已停止')
  }
}

