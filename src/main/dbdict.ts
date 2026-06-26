/**
 * 数据库字典API模块 - 支持动态 engine+database 参数
 */
import axios, { AxiosInstance } from 'axios'

export class DatabaseDictAPI {
  private client: AxiosInstance

  constructor(apiKey?: string) {
    const baseURL = process.env.DBDICT_API_URL || 'http://61.151.241.233:8080/api/v1/dbdict'
    this.client = axios.create({
      baseURL,
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      timeout: 15000
    })
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('数据库字典API错误:', error.response?.data || error.message)
        throw error
      }
    )
  }

  setApiKey(apiKey: string) {
    this.client.defaults.headers['X-API-Key'] = apiKey
  }

  // 获取用户可访问的引擎及库列表（新版，返回 engines[]）
  async getDatasources(): Promise<{ code: number; data: any }> {
    const response = await this.client.get('/datasources')
    return response.data
  }

  // 获取表列表（按 engine+database 参数化）
  async getTables(engine: string, database: string, params?: {
    category?: string
    page?: number
    size?: number
  }): Promise<any> {
    const response = await this.client.get('/tables', {
      params: { engine, database, ...params }
    })
    return response.data
  }

  // 获取表详情
  async getTableDetail(engine: string, database: string, tableName: string): Promise<any> {
    const response = await this.client.get(`/tables/${tableName}`, {
      params: { engine, database }
    })
    return response.data
  }

  // 获取表字段
  async getTableFields(engine: string, database: string, tableName: string): Promise<any> {
    const response = await this.client.get(`/tables/${tableName}/fields`, {
      params: { engine, database }
    })
    return response.data
  }

  // 获取分类统计
  async getCategories(engine: string, database: string): Promise<any> {
    const response = await this.client.get('/categories', {
      params: { engine, database }
    })
    return response.data
  }

  // 搜索（受权限约束，遍历用户可访问库）
  async search(keyword: string): Promise<any> {
    const response = await this.client.get('/search', {
      params: { keyword }
    })
    return response.data
  }

  // 获取数据库统计
  async getStats(engine: string, database: string): Promise<any> {
    const response = await this.client.get('/stats', {
      params: { engine, database }
    })
    return response.data
  }

  // 清除缓存
  async clearCache(engine: string, database: string): Promise<any> {
    const response = await this.client.post('/cache/clear', {}, {
      params: { engine, database }
    })
    return response.data
  }

  // 预览表数据（增强版：支持分页/选列/筛选）
  async previewTable(
    engine: string,
    database: string,
    tableName: string,
    limit?: number,
    page?: number,
    columns?: string,
    filter?: string
  ): Promise<any> {
    const params: any = { engine, database }
    if (limit) params.limit = limit
    if (page) params.page = page
    if (columns) params.columns = columns
    if (filter) params.filter = filter
    const response = await this.client.get(`/tables/${tableName}/preview`, { params })
    return response.data
  }
}

let dbDictAPIInstance: DatabaseDictAPI | null = null

export function getDbDictAPI(apiKey?: string): DatabaseDictAPI {
  if (!dbDictAPIInstance) {
    dbDictAPIInstance = new DatabaseDictAPI(apiKey)
  } else if (apiKey) {
    dbDictAPIInstance.setApiKey(apiKey)
  }
  return dbDictAPIInstance
}
