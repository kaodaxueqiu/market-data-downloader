/**
 * ClickHouse 定时任务监控 API 服务
 */

import axios from 'axios'

const API_BASE_URL = 'http://61.151.241.233:8080/api/v1'

// 从配置中获取 API Key
let apiKey = ''

// 设置 API Key
export function setCronJobApiKey(key: string) {
  apiKey = key
}

// 创建 axios 实例
const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
})

// 请求拦截器 - 添加 API Key
request.interceptors.request.use((config) => {
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API 请求失败:', error)
    return Promise.reject(error)
  }
)

export interface CronJob {
  job_name: string
  display_name: string
  script_path: string
  cron_schedule: string
  schedule_desc: string
  category: string
  enabled: boolean
  timeout_seconds: number | null
  alert_on_failure: boolean
  last_status: 'success' | 'failed' | 'running' | 'timeout' | ''
  last_start_time: string | null
  last_end_time: string | null
  last_duration_seconds: number | null
  last_rows_processed: number | null
  last_error: string | null
}

export interface JobHistory {
  id: number
  job_name: string
  script_path: string
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  status: string
  rows_processed: number | null
  error_message: string | null
  log_file: string | null
}

export interface JobStats {
  job_name: string
  total_executions: number
  success_count: number
  failed_count: number
  timeout_count: number
  avg_duration_seconds: number
  max_duration_seconds: number
  total_rows_processed: number
  success_rate: number
}

class CronJobService {
  /**
   * 获取所有任务列表
   */
  async getJobList(): Promise<{ success: boolean; count: number; data: CronJob[] }> {
    return request.get('/cron-jobs/list')
  }

  /**
   * 获取执行历史（分页）
   */
  async getHistory(params: {
    page?: number
    page_size?: number
    job_name?: string
    status?: string
  }): Promise<{ success: boolean; page: number; page_size: number; total: number; data: JobHistory[] }> {
    return request.get('/cron-jobs/history', { params })
  }

  /**
   * 获取统计信息
   */
  async getStats(days: number = 7): Promise<{ success: boolean; days: number; data: JobStats[] }> {
    return request.get('/cron-jobs/stats', { params: { days } })
  }

  /**
   * 获取最近失败的任务
   */
  async getFailedJobs(limit: number = 20): Promise<{ success: boolean; count: number; data: JobHistory[] }> {
    return request.get('/cron-jobs/failed', { params: { limit } })
  }

  /**
   * 获取单个任务详情
   */
  async getJobDetail(jobName: string): Promise<{
    success: boolean
    data: CronJob & {
      recent_history: JobHistory[]
      stats_30days: JobStats
    }
  }> {
    return request.get(`/cron-jobs/${jobName}/detail`)
  }
}

export const cronJobService = new CronJobService()
export default cronJobService




