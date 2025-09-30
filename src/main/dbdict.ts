/**
 * 数据库字典API模块 (710张表)
 */
import axios, { AxiosInstance } from 'axios'

interface TableInfo {
  table_name: string
  table_comment: string
  category: string
  field_count: number
  row_count: number
}

interface TableDetail {
  table_name: string
  table_comment: string
  field_count: number
  columns: Array<{
    column_name: string
    column_comment: string
    data_type: string
    is_nullable: boolean
    is_primary_key: boolean
    is_indexed: boolean
  }>
  indexes: any[]
  sample_data: any[]
  select_sql: string
}

interface Category {
  code: string
  name: string
  table_count: number
}

interface SearchResult {
  type: 'table' | 'column'
  table_name: string
  column_name: string
  comment: string
  data_type?: string
  match_score: number
}

export class DatabaseDictAPI {
  private client: AxiosInstance
  private cache: Map<string, any> = new Map()

  constructor(apiKey?: string) {
    // 使用公网API地址
    const baseURL = process.env.DBDICT_API_URL || 'http://61.151.241.233:8080/api/v1/dbdict'
    
    console.log('数据库字典API地址:', baseURL)
    
    this.client = axios.create({
      baseURL,
      headers: apiKey ? {
        'X-API-Key': apiKey
      } : {},
      timeout: 10000
    })

    // 响应拦截器
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('数据库字典API错误:', error.response?.data || error.message)
        throw error
      }
    )
  }

  // 设置API Key
  setApiKey(apiKey: string) {
    this.client.defaults.headers['X-API-Key'] = apiKey
  }

  // 1. 获取表列表
  async getTables(params?: {
    category?: string
    page?: number
    size?: number
  }): Promise<{ code: number; data: TableInfo[]; total: number; page: number; size: number }> {
    try {
      const response = await this.client.get('/tables', { params })
      return response.data
    } catch (error: any) {
      console.error('获取表列表失败:', error)
      throw new Error(error.response?.data?.message || '获取表列表失败')
    }
  }

  // 2. 获取表详情
  async getTableDetail(tableName: string): Promise<{ code: number; data: TableDetail }> {
    const cacheKey = `table_${tableName}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const response = await this.client.get(`/tables/${tableName}`)
      
      // 缓存1小时
      this.cache.set(cacheKey, response.data)
      setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000)
      
      return response.data
    } catch (error: any) {
      console.error(`获取表 ${tableName} 详情失败:`, error)
      if (error.response?.status === 404) {
        throw new Error(`表 ${tableName} 不存在`)
      }
      throw new Error(error.response?.data?.message || '获取表详情失败')
    }
  }

  // 3. 获取表字段
  async getTableFields(tableName: string): Promise<{ code: number; data: any[] }> {
    try {
      const response = await this.client.get(`/tables/${tableName}/fields`)
      return response.data
    } catch (error: any) {
      console.error(`获取表 ${tableName} 字段失败:`, error)
      throw new Error(error.response?.data?.message || '获取表字段失败')
    }
  }

  // 4. 获取分类统计
  async getCategories(): Promise<{ code: number; data: Category[] }> {
    const cacheKey = 'categories'
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const response = await this.client.get('/categories')
      
      // 缓存1小时
      this.cache.set(cacheKey, response.data)
      setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000)
      
      return response.data
    } catch (error: any) {
      console.error('获取分类统计失败:', error)
      throw new Error(error.response?.data?.message || '获取分类统计失败')
    }
  }

  // 5. 搜索表和字段
  async search(keyword: string): Promise<{ code: number; data: SearchResult[] }> {
    try {
      const response = await this.client.get('/search', {
        params: { keyword }
      })
      return response.data
    } catch (error: any) {
      console.error('搜索失败:', error)
      throw new Error(error.response?.data?.message || '搜索失败')
    }
  }

  // 6. SQL构建器
  async buildSQL(params: {
    table_name: string
    columns?: string[]
    conditions?: string[]
    order_by?: string
    limit?: number
  }): Promise<{ code: number; data: { sql: string } }> {
    try {
      const response = await this.client.post('/sql-builder', params)
      return response.data
    } catch (error: any) {
      console.error('SQL构建失败:', error)
      throw new Error(error.response?.data?.message || 'SQL构建失败')
    }
  }

  // 7. 获取数据库统计
  async getStats(): Promise<{ code: number; data: any }> {
    const cacheKey = 'stats'
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const response = await this.client.get('/stats')
      
      // 缓存30分钟
      this.cache.set(cacheKey, response.data)
      setTimeout(() => this.cache.delete(cacheKey), 30 * 60 * 1000)
      
      return response.data
    } catch (error: any) {
      console.error('获取数据库统计失败:', error)
      throw new Error(error.response?.data?.message || '获取数据库统计失败')
    }
  }

  // 8. 导出数据字典
  async exportDict(params: {
    format: 'json' | 'markdown' | 'html' | 'excel' | 'pdf'
    categories?: string[]
    include_data?: boolean
  }): Promise<any> {
    try {
      const response = await this.client.post('/export', params, {
        responseType: params.format === 'json' ? 'json' : 'blob'
      })
      return response.data
    } catch (error: any) {
      console.error('导出数据字典失败:', error)
      throw new Error(error.response?.data?.message || '导出数据字典失败')
    }
  }

  // 9. 清除缓存
  async clearCache(): Promise<{ code: number; message: string }> {
    try {
      const response = await this.client.post('/cache/clear')
      // 同时清除本地缓存
      this.cache.clear()
      return response.data
    } catch (error: any) {
      console.error('清除缓存失败:', error)
      throw new Error(error.response?.data?.message || '清除缓存失败')
    }
  }

  // 清除本地缓存
  clearLocalCache() {
    this.cache.clear()
  }
}

// 单例实例
let dbDictAPI: DatabaseDictAPI | null = null

export function getDbDictAPI(apiKey?: string): DatabaseDictAPI {
  if (!dbDictAPI) {
    dbDictAPI = new DatabaseDictAPI(apiKey)
  } else if (apiKey) {
    dbDictAPI.setApiKey(apiKey)
  }
  return dbDictAPI
}
