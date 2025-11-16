/**
 * 静态数据下载管理器 - 基于异步任务系统
 * 
 * API流程：
 * 1. POST /api/v1/dbdict/download-task - 创建下载任务
 * 2. GET /api/v1/dbdict/download-task/{taskId} - 轮询任务状态
 * 3. GET /api/v1/dbdict/download-file/{fileId} - 下载文件
 */

import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

// API配置
const API_BASE_URL = 'http://61.151.241.233:8080/api/v1/dbdict'

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',      // 待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed',        // 失败
  CANCELLED = 'cancelled'   // 已取消
}

// 下载任务请求参数
export interface StaticDownloadRequest {
  table_name: string                // 表名
  columns?: string[]                // 字段列表（可选，空则下载所有字段）
  conditions?: Record<string, any>  // 查询条件（可选）
  date_range?: {                    // 日期范围（可选，后端自动用UPDATE_TIME筛选）
    start_date?: string             // 开始日期 YYYY-MM-DD
    end_date?: string               // 结束日期 YYYY-MM-DD
  }
  symbols?: string[]                // 🆕 股票/期货代码列表（可选，ClickHouse数据源）
  order_by?: string                 // 排序（可选）
  format: 'csv' | 'json'            // 文件格式
}

// 下载任务信息
export interface StaticDownloadTask {
  id: string                        // 任务ID
  type: 'static_download'           // 任务类型
  status: TaskStatus                // 状态
  progress: number                  // 进度 (0-100)
  message: string                   // 状态消息
  
  // 请求参数
  request: StaticDownloadRequest
  
  // 结果信息
  result?: {
    file_id: string                 // 文件ID
    file_name: string               // 文件名
    file_size: number               // 文件大小（字节）
    record_count: number            // 记录数
    format: string                  // 格式
    download_url: string            // 下载URL
  }
  
  // 错误信息
  error?: string
  
  // 时间信息
  created_at: string                // 创建时间
  updated_at?: string               // 更新时间
  completed_at?: string             // 完成时间
  expires_at?: string               // 过期时间
  
  // API Key（用于后续下载）
  api_key?: string
}

class StaticDownloadManager {
  private apiBaseUrl: string = API_BASE_URL

  constructor() {
    console.log('✅ StaticDownloadManager 初始化完成')
    console.log('📍 API地址:', this.apiBaseUrl)
  }

  /**
   * 创建下载任务
   */
  async createTask(request: StaticDownloadRequest, apiKey: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data'): Promise<string> {
    try {
      const dbType = datasource || 'postgresql'
      console.log(`📋 创建${dbType === 'clickhouse' ? 'ClickHouse' : 'PostgreSQL'}下载任务`)
      console.log('🔧 请求参数:', request)
      
      // 构建URL，添加 datasource 参数
      const url = datasource 
        ? `${this.apiBaseUrl}/download-task?datasource=${datasource}`
        : `${this.apiBaseUrl}/download-task`
      console.log('🌐 API URL:', url)
      
      // 严格按照后端文档的参数格式
      const requestBody: any = {
        table_name: request.table_name,
        format: request.format
      }
      
      // 可选参数
      if (request.columns && request.columns.length > 0) {
        requestBody.columns = request.columns
      }
      
      if (request.conditions && Object.keys(request.conditions).length > 0) {
        requestBody.conditions = request.conditions
      }
      
      if (request.date_range) {
        requestBody.date_range = {}
        if (request.date_range.start_date) {
          requestBody.date_range.start_date = request.date_range.start_date
        }
        if (request.date_range.end_date) {
          requestBody.date_range.end_date = request.date_range.end_date
        }
        // 不需要 date_field，后端自动使用 UPDATE_TIME
      }
      
      if (request.order_by) {
        requestBody.order_by = request.order_by
      }
      
      // 🆕 股票/期货代码筛选（ClickHouse数据源）
      if (request.symbols && request.symbols.length > 0) {
        requestBody.symbols = request.symbols
        console.log('📊 添加股票代码筛选:', requestBody.symbols)
      }
      
      console.log('📤 发送请求体:', JSON.stringify(requestBody, null, 2))
      
      const response = await axios.post(
        url,
        requestBody,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )
      
      console.log('✅ 创建任务响应:', response.data)
      
      if (response.data.code === 200) {
        const taskId = response.data.data.task_id
        console.log('✅ 任务创建成功，task_id:', taskId)
        return taskId
      } else {
        throw new Error(response.data.message || '创建任务失败')
      }
    } catch (error: any) {
      console.error('❌ 创建静态数据下载任务失败:', error)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应数据:', error.response.data)
      }
      throw new Error(this.getErrorMessage(error))
    }
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string, apiKey: string): Promise<StaticDownloadTask> {
    try {
      console.log('📋 查询任务状态, task_id:', taskId)
      
      const response = await axios.get(
        `${this.apiBaseUrl}/download-task/${taskId}`,
        {
          headers: {
            'X-API-Key': apiKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 任务状态:', response.data.data?.status, '进度:', response.data.data?.progress)
      
      if (response.data.code === 200) {
        return response.data.data
      } else {
        throw new Error(response.data.message || '查询任务失败')
      }
    } catch (error: any) {
      console.error('❌ 查询任务状态失败:', error)
      throw new Error(this.getErrorMessage(error))
    }
  }

  /**
   * 下载文件到指定路径
   */
  async downloadFile(fileId: string, savePath: string, fileName: string, apiKey: string): Promise<string> {
    try {
      console.log('📥 开始下载文件')
      console.log('📄 文件ID:', fileId)
      console.log('📁 保存路径:', savePath)
      console.log('📝 文件名:', fileName)
      
      const downloadUrl = `${this.apiBaseUrl}/download-file/${fileId}`
      console.log('🌐 下载URL:', downloadUrl)
      
      const response = await axios.get(downloadUrl, {
        headers: {
          'X-API-Key': apiKey
        },
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      console.log(`✅ 收到文件数据，大小: ${response.data.byteLength} bytes`)
      
      // 确保目录存在
      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true })
      }
      
      // 保存文件
      const filePath = path.join(savePath, fileName)
      fs.writeFileSync(filePath, Buffer.from(response.data))
      
      console.log('✅ 文件已保存:', filePath)
      return filePath
    } catch (error: any) {
      console.error('❌ 下载文件失败:', error)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应头:', error.response.headers)
      }
      throw new Error(this.getErrorMessage(error))
    }
  }

  /**
   * 获取错误信息
   */
  private getErrorMessage(error: any): string {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      
      if (status === 400) {
        return data?.message || '请求参数错误'
      } else if (status === 401) {
        return 'API Key无效或已过期'
      } else if (status === 403) {
        return '权限不足'
      } else if (status === 404) {
        return '资源不存在'
      } else if (status === 500) {
        return data?.message || '服务器错误'
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

export default new StaticDownloadManager()

