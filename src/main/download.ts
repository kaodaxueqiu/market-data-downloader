/**
 * 下载管理器 - 基于后端异步任务系统
 * 
 * API流程：
 * 1. POST /download/task - 创建下载任务
 * 2. GET /download/task/{taskId} - 轮询任务状态
 * 3. GET {download_url} - 下载文件
 */

import { EventEmitter } from 'events'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

// API配置
const API_BASE_URL = 'http://61.151.241.233:8080/api/v1'

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',      // 待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed'         // 失败
}

// 下载任务接口
export interface DownloadTask {
  id: string                 // 任务ID
  status: TaskStatus         // 状态
  progress: number           // 进度 (0-100)
  messageType: string        // 消息类型
  symbols?: string[]         // 股票代码
  startDate: string          // 开始日期
  endDate: string            // 结束日期
  format: 'csv' | 'json'     // 导出格式
  savePath?: string          // 保存路径（可选，下载时再指定）
  createdAt: string          // 创建时间
  completedAt?: string       // 完成时间
  errorMessage?: string      // 错误信息
  fileSize?: number          // 文件大小
  totalRecords?: number      // 总记录数
  fileName?: string          // 文件名
  downloadUrl?: string       // 下载链接（任务完成后）
  apiKey?: string            // 保存API Key用于后续下载
}

// 下载参数接口
export interface DownloadParams {
  apiKey: string
  messageType: string
  symbols?: string[]
  startDate: string
  endDate: string
  format: 'csv' | 'json'
  savePath?: string
}

class DownloadManager extends EventEmitter {
  private tasks: Map<string, DownloadTask> = new Map()
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private apiBaseUrl: string = API_BASE_URL

  constructor() {
    super()
    console.log('DownloadManager 初始化完成')
  }

  /**
   * 创建导出任务（兼容旧接口名）
   */
  async startDownload(params: DownloadParams): Promise<string> {
    return this.createExportTask(params)
  }

  /**
   * 创建导出任务
   */
  async createExportTask(params: any): Promise<string> {
    // 只允许导出DECODED数据
    if (params.dataType && params.dataType !== 'DECODED') {
      throw new Error('只支持导出DECODED格式的数据，RAW数据不支持导出')
    }
    
    const taskId = `task_${Date.now()}`
    
    // 创建本地任务记录（不需要savePath）
    const task: DownloadTask & { startTime?: string; endTime?: string } = {
      id: taskId,
      status: TaskStatus.PENDING,
      progress: 0,
      messageType: params.messageType,
      symbols: params.symbols,
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format,
      createdAt: new Date().toISOString(),
      apiKey: params.apiKey  // 保存API Key供后续下载使用
    }
    
    // 添加时间参数
    if (params.startTime) {
      task.startTime = params.startTime
    }
    if (params.endTime) {
      task.endTime = params.endTime
    }
    
    this.tasks.set(taskId, task)
    
    // 异步执行下载
    this.executeDownload(taskId, params.apiKey).catch(error => {
      console.error(`任务 ${taskId} 执行失败:`, error)
      task.status = TaskStatus.FAILED
      task.errorMessage = error.message
      this.emit('error', { taskId, error: error.message })
    })
    
    return taskId
  }

  /**
   * 执行下载任务 - 使用后端的异步任务API
   */
  private async executeDownload(taskId: string, apiKey: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    try {
      console.log(`开始执行任务 ${taskId}`)
      
      // 更新任务状态为处理中
      task.status = TaskStatus.PROCESSING
      this.emit('progress', { taskId, progress: 10 })

      // ========== 第一步：创建下载任务 ==========
      console.log('第一步：创建下载任务...')
      console.log('请求URL:', `${this.apiBaseUrl}/download/task`)
      
      // 构建请求体 - 使用与网页版相同的格式
      const requestBody: any = {
        dataType: 'DECODED',  // 固定使用DECODED数据
        format: task.format
      }
      
      // 消息类型（支持单个或多个）
      if (Array.isArray(task.messageType)) {
        requestBody.messageTypes = task.messageType
      } else {
        requestBody.messageType = task.messageType
      }
      
      // 日期范围
      if (task.startDate && task.endDate) {
        requestBody.dateRange = {
          start: task.startDate,
          end: task.endDate
        }
      }
      
      // 股票代码（可选）
      if (task.symbols && task.symbols.length > 0) {
        if (task.symbols.length === 1) {
          requestBody.symbol = task.symbols[0]
        } else {
          requestBody.symbols = task.symbols
        }
      }
      
      // 时间范围（可选）
      if ((task as any).startTime && (task as any).endTime) {
        requestBody.timeRange = {
          start: (task as any).startTime,
          end: (task as any).endTime
        }
      }
      
      console.log('请求数据:', requestBody)
      
      let createTaskResponse
      try {
        createTaskResponse = await axios.post(
          `${this.apiBaseUrl}/download/task`,  // 新的端点
          requestBody,
          {
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        )
        console.log('创建任务响应:', createTaskResponse.data)
      } catch (createError: any) {
        console.error('创建任务失败:', createError.response?.status, createError.response?.data)
        if (createError.response?.status === 404) {
          console.error('404错误：接口不存在，URL:', `${this.apiBaseUrl}/download/task`)
        }
        throw createError
      }

      // 检查是否直接返回了下载链接（同步处理）
      if (createTaskResponse.data.download_url) {
        console.log('任务同步完成，下载链接:', createTaskResponse.data.download_url)
        
        // 构造完整的下载URL
        const downloadUrl = createTaskResponse.data.download_url
        let fullDownloadUrl: string
        if (downloadUrl.startsWith('http')) {
          fullDownloadUrl = downloadUrl
        } else if (downloadUrl.startsWith('/api/v1/')) {
          // 如果已经包含/api/v1/，直接替换为完整URL
          fullDownloadUrl = downloadUrl.replace('/api/v1/', `${this.apiBaseUrl}/`)
        } else {
          // 其他情况，添加基础URL
          fullDownloadUrl = `${this.apiBaseUrl}${downloadUrl}`
        }
        
        task.progress = 100
        task.status = TaskStatus.COMPLETED
        task.completedAt = new Date().toISOString()
        task.fileName = createTaskResponse.data.file_name || `export_${taskId}.${task.format}`
        task.downloadUrl = fullDownloadUrl  // 保存完整的下载链接
        task.fileSize = createTaskResponse.data.file_size || 0
        task.totalRecords = createTaskResponse.data.record_count || 0
        
        // 重要：确保任务更新被保存到Map中
        this.tasks.set(taskId, task)
        console.log(`任务 ${taskId} 同步完成，已保存downloadUrl:`, task.downloadUrl)
        
        this.emit('completed', { 
          taskId, 
          download_url: fullDownloadUrl,
          fileName: task.fileName
        })
        return
      }

      // 获取后端返回的任务ID（异步处理）
      const backendTaskId = createTaskResponse.data.task_id || createTaskResponse.data.id
      if (!backendTaskId) {
        throw new Error('后端未返回任务ID或下载链接')
      }
      
      console.log(`后端任务ID: ${backendTaskId}`)
      task.progress = 20
      this.emit('progress', { taskId, progress: 20 })

      // ========== 第二步：轮询任务状态 ==========
      console.log('第二步：轮询任务状态...')
      let taskStatus = 'pending'
      let pollCount = 0
      const maxPolls = 300  // 最多轮询300次（10分钟）
      
      while ((taskStatus === 'pending' || taskStatus === 'processing') && pollCount < maxPolls) {
        // 等待2秒
        await new Promise(resolve => setTimeout(resolve, 2000))
        pollCount++
        
        try {
          const statusResponse = await axios.get(
            `${this.apiBaseUrl}/download/task/${backendTaskId}`,
            {
              headers: { 'X-API-Key': apiKey },
              timeout: 10000
            }
          )
          
      // 打印完整响应以调试
      console.log('任务状态响应:', statusResponse.data)
      
      taskStatus = statusResponse.data.status
      
      // 更新进度
      const backendProgress = statusResponse.data.progress || 0
      task.progress = 20 + (backendProgress * 0.6)  // 20-80%的进度用于处理
        this.emit('progress', { taskId, progress: task.progress })
      
      console.log(`任务状态: ${taskStatus}, 进度: ${backendProgress}%`)
      
      // 检查是否失败
      if (taskStatus === 'failed') {
        throw new Error(statusResponse.data.error || '任务失败')
      }
      
      // 任务完成，准备下载文件
      if (taskStatus === 'completed') {
        // 兼容不同的响应格式
        const result = statusResponse.data.result || statusResponse.data
        const downloadUrl = result.download_url
        const fileName = result.file_name || `export_${taskId}.${task.format}`
        
        if (!downloadUrl) {
          console.error('响应中没有找到下载链接:', statusResponse.data)
          throw new Error('任务完成但未返回下载链接')
        }
            
            // ========== 第三步：保存任务信息，不下载文件 ==========
            console.log('任务完成，保存下载链接')
            console.log('原始下载URL:', downloadUrl)
            
            // 构造完整的下载URL
            let fullDownloadUrl: string
            if (downloadUrl.startsWith('http')) {
              fullDownloadUrl = downloadUrl
            } else if (downloadUrl.startsWith('/api/v1/')) {
              // 如果已经包含/api/v1/，直接替换为完整URL
              fullDownloadUrl = downloadUrl.replace('/api/v1/', `${this.apiBaseUrl}/`)
            } else {
              // 其他情况，添加基础URL
              fullDownloadUrl = `${this.apiBaseUrl}${downloadUrl}`
            }
            
            console.log(`完整下载URL: ${fullDownloadUrl}`)
            
            // 更新任务信息
            task.downloadUrl = fullDownloadUrl  // 保存完整下载链接
            task.fileName = fileName
            task.fileSize = result.file_size || 0
            task.totalRecords = result.record_count || 0
            task.progress = 100
            task.status = TaskStatus.COMPLETED
            task.completedAt = new Date().toISOString()
            
            // 重要：确保任务更新被保存到Map中
            this.tasks.set(taskId, task)
            console.log(`任务 ${taskId} 已更新，downloadUrl:`, task.downloadUrl)
            
            // 发送完成事件
            this.emit('progress', { taskId, progress: 100 })
            this.emit('completed', { 
              taskId, 
              fileName: task.fileName,
              fileSize: task.fileSize,
              totalRecords: task.totalRecords,
              download_url: fullDownloadUrl
            })
            
            break  // 退出轮询循环
          }
        } catch (pollError: any) {
          console.error(`轮询出错: ${pollError.message}`)
          // 如果是网络错误，继续轮询
          if (pollError.code === 'ECONNABORTED' || pollError.code === 'ETIMEDOUT') {
            continue
          }
          // 其他错误，抛出
          throw pollError
        }
      }
      
      // 检查是否超时
      if (pollCount >= maxPolls) {
        throw new Error('任务处理超时（超过10分钟）')
      }
      
    } catch (error: any) {
      console.error(`任务 ${taskId} 失败:`, error)
      
      // 更新任务状态
      task.status = TaskStatus.FAILED
      task.errorMessage = this.getErrorMessage(error)
      task.progress = 0
      
      // 发送错误事件
      this.emit('error', { 
        taskId, 
        error: task.errorMessage 
      })
      
      throw error
    }
  }

  /**
   * 查询数据（预览功能）
   */
  async queryData(params: any): Promise<any> {
    console.log('查询数据预览...')
    console.log('查询参数:', {
      ...params,
      apiKey: '***已隐藏***'
    })
    
    try {
      // 构建请求参数
      const requestData: any = {
        data_type: params.dataType || 'DECODED',  // 使用传入的数据类型，默认DECODED
        // 不设置limit，由API返回所有数据
        include_count: true,     // 包含消息数量统计
        return_data: true        // 返回数据
      }
      
      // 处理消息类型 - 如果有多个，传递数组给后端
      if (params.messageTypes && params.messageTypes.length > 0) {
        // 多个消息类型，传递给后端
        requestData.message_types = params.messageTypes  
        console.log(`查询多个消息类型: ${params.messageTypes.join(', ')}`)
      } else if (params.messageType) {
        // 单个消息类型
        requestData.message_type = params.messageType
        console.log(`查询消息类型: ${params.messageType}`)
      }
      
      // 添加日期参数 - 使用单个date字段，因为查询的是单日
      if (params.startDate && params.startDate === params.endDate) {
        // 如果是查询单日，使用date参数
        requestData.date = params.startDate
      } else if (params.startDate || params.endDate) {
        // 如果是日期范围，使用date_start和date_end
        requestData.date_start = params.startDate
        requestData.date_end = params.endDate
      }
      
      // 添加可选参数
      if (params.symbols && params.symbols.length > 0) {
        // 同时设置symbol和symbols，以兼容不同的API参数格式
        requestData.symbol = params.symbols[0]  // 第一个股票作为symbol
        requestData.symbols = params.symbols    // 所有股票作为symbols数组
      }
      if (params.startTime) {
        requestData.time_start = params.startTime
      }
      if (params.endTime) {
        requestData.time_end = params.endTime
      }
      
      console.log('发送给API的请求数据:', requestData)
      
      const response = await axios.post(
        `${this.apiBaseUrl}/query`,
        requestData,
        {
          headers: {
            'X-API-Key': params.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      // 处理API返回的数据格式
      console.log('API响应:', response.data)
      
      if (response.data.success) {
        // API返回格式:
        // - keys: Redis key列表
        // - total: key总数
        // - messages: 所有key中的消息总数（实际数据量）
        // - data: 可能包含sample数据（第一个key的数据预览）
        
        const result = {
          success: true,
          keys: response.data.keys || [],
          totalKeys: response.data.total || 0,  // key的总数
          totalRecords: response.data.messages || response.data.total_messages || 0, // 实际消息总数
          preview: null as any
        }
        
        // 处理预览数据
        if (response.data.data) {
          // 如果有data.sample字段，使用它作为预览
          if (response.data.data.sample) {
            result.preview = response.data.data.sample
          } else if (response.data.data.sample_data) {
            result.preview = response.data.data.sample_data
          } else {
            result.preview = response.data.data
          }
        }
        
        // 返回处理后的结果
        return {
          success: true,
          total: result.totalRecords || result.totalKeys, // 优先返回实际数据量，否则返回key数量
          keys: result.keys,
          preview: result.preview ? [result.preview] : [], // 将预览数据包装成数组
          totalKeys: result.totalKeys, // 额外返回总键数
          totalRecords: result.totalRecords // 额外返回消息总数
        }
      } else {
        throw new Error(response.data.error || response.data.message || '查询失败')
      }
    } catch (error: any) {
      console.error('查询失败:', error.message)
      throw new Error(this.getErrorMessage(error))
    }
  }

  /**
   * 获取任务进度
   */
  getProgress(taskId: string): number {
    const task = this.tasks.get(taskId)
    return task?.progress || 0
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getTasks(): DownloadTask[] {
    // 返回所有任务，确保包含downloadUrl
    const tasks = Array.from(this.tasks.values())
    
    // 调试：打印每个任务的详细信息
    console.log('getTasks 返回任务列表:')
    tasks.forEach(task => {
      console.log(`任务 ${task.id}:`, {
        status: task.status,
        downloadUrl: task.downloadUrl,
        fileName: task.fileName,
        fileSize: task.fileSize
      })
    })
    
    return tasks.map(task => ({
      ...task,
      // 确保downloadUrl字段存在
      downloadUrl: task.downloadUrl || undefined
    }))
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) return

    // 停止轮询
    const interval = this.pollingIntervals.get(taskId)
    if (interval) {
      clearInterval(interval)
      this.pollingIntervals.delete(taskId)
    }

    // 更新状态
    task.status = TaskStatus.FAILED
    task.errorMessage = '用户取消'
    task.progress = 0
    
    this.emit('cancelled', { taskId })
  }

  /**
   * 清理已完成的任务
   */
  clearCompletedTasks() {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
        this.tasks.delete(taskId)
      }
    }
    this.emit('tasks-cleared')
  }

  /**
   * 获取下载历史（兼容旧接口）
   */
  getHistory(): DownloadTask[] {
    return this.getTasks()
  }

  /**
   * 清理下载历史（兼容旧接口）
   */
  clearHistory(olderThanDays?: number): void {
    if (olderThanDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
      
      for (const [taskId, task] of this.tasks.entries()) {
        if (new Date(task.createdAt) < cutoffDate) {
          this.tasks.delete(taskId)
        }
      }
    } else {
      this.clearCompletedTasks()
    }
  }

  /**
   * 暂停下载（兼容旧接口 - 不支持）
   */
  pauseDownload(_taskId: string): boolean {
    console.warn('暂停功能不支持')
    return false
  }

  /**
   * 恢复下载（兼容旧接口 - 不支持）
   */
  resumeDownload(_taskId: string): boolean {
    console.warn('恢复功能不支持')
    return false
  }

  /**
   * 取消下载（兼容旧接口）
   */
  cancelDownload(taskId: string): void {
    this.cancelTask(taskId)
  }

  /**
   * 获取任务进度（兼容旧接口）
   */
  getTaskProgress(taskId: string): number {
    return this.getProgress(taskId)
  }

  /**
   * 下载已完成任务的文件到指定位置
   */
  async downloadTaskFile(taskId: string, filePath: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }
    
    console.log(`下载任务文件 ${taskId}:`, {
      status: task.status,
      downloadUrl: task.downloadUrl,
      fileName: task.fileName,
      fileSize: task.fileSize
    })
    
    if (task.status !== TaskStatus.COMPLETED) {
      throw new Error('任务尚未完成')
    }
    
    if (!task.downloadUrl) {
      throw new Error('没有可下载的文件')
    }
    
    // 获取保存的API Key
    const apiKey = task.apiKey || ''
    
    // 下载文件
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath)
    
    await this.downloadFileFromUrl(
      task.downloadUrl,
      dir,
      fileName,
      apiKey
    )
  }

  /**
   * 从URL下载文件
   */
  private async downloadFileFromUrl(downloadUrl: string, savePath: string, fileName: string, apiKey: string) {
    try {
      // downloadUrl 应该是完整的API URL，例如 http://61.151.241.233:8080/api/v1/download/file/xxx
      console.log(`下载文件: ${downloadUrl}`)
      console.log(`保存路径: ${savePath}`)
      console.log(`文件名: ${fileName}`)
      
      const response = await axios.get(downloadUrl, {
        headers: { 
          'X-API-Key': apiKey,
          'Accept': '*/*'
        },
        responseType: 'arraybuffer',  // 重要：以二进制形式接收文件
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      console.log(`收到响应，数据大小: ${response.data.byteLength} bytes`)
      
      // 保存文件
      const filePath = path.join(savePath, fileName)
      
      // 确保目录存在
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      // 写入文件
      fs.writeFileSync(filePath, Buffer.from(response.data))
      console.log(`文件已保存: ${filePath}`)
      
      return filePath
    } catch (error: any) {
      console.error('下载文件失败:', error.message)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应数据:', error.response.data?.toString?.())
      }
      throw error
    }
  }

  /**
   * 获取错误信息
   */
  private getErrorMessage(error: any): string {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      
      if (status === 401) {
        return 'API Key无效或已过期'
      } else if (status === 403) {
        return '权限不足'
      } else if (status === 404) {
        return '接口不存在'
      } else if (status === 429) {
        return '请求过于频繁，请稍后再试'
      } else if (status === 500) {
        return '服务器错误，请稍后再试'
      } else if (data?.message) {
        return data.message
      } else if (data?.error) {
        return data.error
      }
    } else if (error.request) {
      return '网络连接失败，请检查网络'
    }
    
    return error.message || '未知错误'
  }
}

export default new DownloadManager()