/**
 * 量化模型执行平台 API 服务
 * 
 * 架构说明：
 * 1. Gitea API 通过 Electron 主进程调用（避免 CORS）
 * 2. 根据当前用户名（从API Key获取）过滤仓库
 * 3. 中文姓名转拼音匹配 Gitea 用户名
 */

import axios from 'axios'

// 后端执行器 API 地址（待配置）
const EXECUTOR_BASE_URL = 'http://61.151.241.233:8080/api/v1/model-runner'

// 当前用户的拼音用户名
let currentUserPinyin = ''

// API Key（用于后端执行器）
let apiKey = ''

// 设置当前用户拼音
export function setCurrentUserPinyin(pinyin: string) {
  currentUserPinyin = pinyin
}

// 设置 Gitea Admin Token（主进程中已配置，这里保留接口兼容性）
export function setGiteaAdminToken(_token: string) {
  // Token 已在主进程中配置，此函数保留但不执行
  console.log('Gitea Token 已在主进程中配置')
}

// 设置 API Key
export function setModelRunnerApiKey(key: string) {
  apiKey = key
}

// 创建后端执行器请求实例
const executorRequest = axios.create({
  baseURL: EXECUTOR_BASE_URL,
  timeout: 30000
})

// 执行器请求拦截器 - 添加 API Key
executorRequest.interceptors.request.use((config) => {
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

// 执行器响应拦截器
executorRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('执行器 API 请求失败:', error)
    return Promise.reject(error)
  }
)

// ========== 数据类型定义 ==========

export interface User {
  id: number
  username: string
  email: string
  avatar_url: string
}

export interface Repository {
  id: number
  name: string
  full_name: string
  description: string
  private: boolean
  default_branch?: string
  updated_at: string
  clone_url: string
}

export interface Commit {
  sha: string
  short_sha: string
  message: string
  author: string
  date: string
}

export interface Branch {
  name: string
  commit: Commit
}

export interface Tag {
  name: string
  commit: Commit
}

export interface Versions {
  branches: Branch[]
  tags: Tag[]
  commits: Commit[]
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface Task {
  task_id: string
  repo_name: string
  version: string
  version_type: 'branch' | 'tag' | 'commit'
  commit_sha?: string
  status: TaskStatus
  params?: Record<string, any>
  started_at: string
  finished_at?: string
  duration_seconds?: number
  results?: ResultFile[]
}

export interface ResultFile {
  filename: string
  size: number
  size_human: string
  download_url: string
}

export interface LogEntry {
  time: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
}

// ========== API 服务类 ==========

class ModelRunnerService {
  /**
   * Gitea 仓库接口（通过 Electron 主进程调用，避免 CORS）
   * 获取当前用户作为协作者能访问的仓库
   */
  async getRepos(): Promise<Repository[]> {
    // 如果没有设置用户拼音，无法获取
    if (!currentUserPinyin) {
      console.warn('未设置用户拼音，无法获取仓库')
      return []
    }
    
    // 获取用户在组织中作为协作者能访问的仓库
    const result = await (window as any).electronAPI.gitea.getUserAccessibleRepos('zizhou', currentUserPinyin)
    
    if (!result.success) {
      throw new Error(result.error || '获取仓库列表失败')
    }
    
    return result.data || []
  }
  
  /**
   * 获取组织下所有仓库（管理员用）
   */
  async getAllOrgRepos(org: string = 'zizhou'): Promise<Repository[]> {
    const result = await (window as any).electronAPI.gitea.getOrgRepos(org)
    
    if (!result.success) {
      throw new Error(result.error || '获取组织仓库失败')
    }
    
    return result.data || []
  }

  async getRepoDetail(owner: string, repoName: string): Promise<Repository> {
    const result = await (window as any).electronAPI.gitea.getRepo(owner, repoName)
    if (!result.success) {
      throw new Error(result.error || '获取仓库详情失败')
    }
    return result.data
  }

  /**
   * Gitea 版本接口（转换 Gitea API 格式）
   */
  async getBranches(owner: string, repoName: string): Promise<Branch[]> {
    const result = await (window as any).electronAPI.gitea.getBranches(owner, repoName)
    if (!result.success) {
      throw new Error(result.error || '获取分支列表失败')
    }
    // 转换 Gitea 格式到统一格式
    return (result.data || []).map((branch: any) => ({
      name: branch.name,
      commit: {
        sha: branch.commit?.id || branch.commit?.sha || '',
        short_sha: (branch.commit?.id || branch.commit?.sha || '').substring(0, 7),
        message: branch.commit?.message || '',
        author: branch.commit?.author?.name || branch.commit?.author?.username || '',
        date: branch.commit?.timestamp || branch.commit?.created || ''
      }
    }))
  }

  async getTags(owner: string, repoName: string): Promise<Tag[]> {
    const result = await (window as any).electronAPI.gitea.getTags(owner, repoName)
    if (!result.success) {
      throw new Error(result.error || '获取标签列表失败')
    }
    // 转换 Gitea 格式到统一格式
    return (result.data || []).map((tag: any) => ({
      name: tag.name,
      commit: {
        sha: tag.commit?.sha || tag.id || '',
        short_sha: (tag.commit?.sha || tag.id || '').substring(0, 7),
        message: tag.message || '',
        author: tag.tagger?.name || '',
        date: tag.commit?.created || tag.tagger?.date || ''
      }
    }))
  }

  async getCommits(owner: string, repoName: string, params?: {
    sha?: string
    page?: number
    limit?: number
  }): Promise<Commit[]> {
    const result = await (window as any).electronAPI.gitea.getCommits(owner, repoName, params)
    if (!result.success) {
      throw new Error(result.error || '获取提交列表失败')
    }
    // 转换 Gitea 格式到统一格式
    return (result.data || []).map((item: any) => ({
      sha: item.sha || item.commit?.sha || '',
      short_sha: (item.sha || item.commit?.sha || '').substring(0, 7),
      message: item.commit?.message || item.message || '',
      author: item.commit?.author?.name || item.author?.username || '',
      date: item.commit?.author?.date || item.created || ''
    }))
  }

  /**
   * 执行接口（调用后端执行器 API）
   */
  async executeModel(repoName: string, payload: {
    version: string
    version_type: 'branch' | 'tag' | 'commit'
    params?: Record<string, any>
  }): Promise<{ success: boolean; data: { task_id: string; status: string; message: string } }> {
    return executorRequest.post(`/repos/${repoName}/execute`, payload)
  }

  /**
   * 任务接口（调用后端执行器 API）
   */
  async getTasks(params?: {
    status?: TaskStatus
    repo?: string
    start_date?: string
    end_date?: string
    page?: number
    page_size?: number
  }): Promise<{ success: boolean; data: { total: number; page: number; page_size: number; items: Task[] } }> {
    return executorRequest.get('/tasks', { params })
  }

  async getTaskDetail(taskId: string): Promise<{ success: boolean; data: Task }> {
    return executorRequest.get(`/tasks/${taskId}`)
  }

  async getTaskStatus(taskId: string): Promise<{ success: boolean; data: { task_id: string; status: TaskStatus; progress?: number; current_step?: string } }> {
    return executorRequest.get(`/tasks/${taskId}/status`)
  }

  async getTaskLogs(taskId: string, params?: {
    since?: string
  }): Promise<{ success: boolean; data: { logs: LogEntry[] } }> {
    return executorRequest.get(`/tasks/${taskId}/logs`, { params })
  }

  /**
   * 结果文件接口（调用后端执行器 API）
   */
  getResultDownloadUrl(taskId: string, filename: string): string {
    return `${EXECUTOR_BASE_URL}/tasks/${taskId}/results/${filename}`
  }

  async previewResult(taskId: string, filename: string, lines: number = 100): Promise<{
    success: boolean
    data: {
      filename: string
      total_lines: number
      preview_lines: number
      headers: string[]
      rows: any[][]
    }
  }> {
    return executorRequest.get(`/tasks/${taskId}/results/${filename}/preview`, { params: { lines } })
  }
}

export const modelRunnerService = new ModelRunnerService()
export default modelRunnerService

