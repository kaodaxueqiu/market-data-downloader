/**
 * 数据库字典API模块 (710张表)
 */
import axios, { AxiosInstance } from 'axios'

interface TableInfo {
  table_name: string
  table_comment: string
  table_type?: string
  category: string
  row_count?: number
  data_size?: string
  index_count?: number
  field_count: number
  create_time?: string
  update_time?: string
  
  // 🆕 新增：数据入库时间范围（707/708张表有）
  earliest_update_time?: string  // 最早数据入库时间，格式：YYYY-MM-DD
  latest_update_time?: string    // 最新数据入库时间，格式：YYYY-MM-DD
}

interface TableDetail {
  // ===== 基本信息 =====
  table_name: string
  table_comment: string
  table_type?: string
  category?: string
  row_count?: number
  data_size?: string
  index_count?: number
  field_count: number
  create_time?: string
  update_time?: string
  
  // ===== 详细信息 =====
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
  
  // ===== 🆕 新增：数据入库时间范围（707/708张表有）=====
  earliest_update_time?: string  // 最早数据入库时间，格式：YYYY-MM-DD
  latest_update_time?: string    // 最新数据入库时间，格式：YYYY-MM-DD
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

  // 1. 获取表列表（不缓存，因为需要支持分类筛选）
  async getTables(params?: {
    category?: string
    page?: number
    size?: number
    datasource?: 'postgresql' | 'clickhouse'  // 🆕 数据源参数
  }): Promise<{ code: number; data: TableInfo[]; total: number; page: number; size: number }> {
    try {
      console.log('📋 调用后端API: GET /tables', params)
      const response = await this.client.get('/tables', { params })
      console.log('✅ 后端返回:', response.data.code, `${response.data.data?.length || 0} 张表`)
      return response.data
    } catch (error: any) {
      console.error('获取表列表失败:', error)
      throw new Error(error.response?.data?.message || '获取表列表失败')
    }
  }

  // 2. 获取表详情（实时查询，不缓存）
  async getTableDetail(tableName: string, datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; data: TableDetail }> {
    try {
      console.log('📋 调用后端API: GET /tables/' + tableName, datasource ? `[${datasource}]` : '')
      const params = datasource ? { datasource } : {}
      const response = await this.client.get(`/tables/${tableName}`, { params })
      console.log('✅ 后端返回表详情:', response.data.code)
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
  async getTableFields(tableName: string, datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; data: any[] }> {
    try {
      const params = datasource ? { datasource } : {}
      const response = await this.client.get(`/tables/${tableName}/fields`, { params })
      return response.data
    } catch (error: any) {
      console.error(`获取表 ${tableName} 字段失败:`, error)
      throw new Error(error.response?.data?.message || '获取表字段失败')
    }
  }

  // 4. 获取分类统计（实时查询，不缓存）
  async getCategories(datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; data: Category[] }> {
    try {
      console.log('📋 调用后端API: GET /categories', datasource ? `[${datasource}]` : '')
      const params = datasource ? { datasource } : {}
      const response = await this.client.get('/categories', { params })
      console.log('✅ 后端返回分类:', response.data.code, `${response.data.data?.length || 0} 个分类`)
      return response.data
    } catch (error: any) {
      console.error('获取分类统计失败:', error)
      throw new Error(error.response?.data?.message || '获取分类统计失败')
    }
  }

  // 5. 搜索表和字段
  async search(keyword: string, datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; data: SearchResult[] }> {
    try {
      const params: any = { keyword }
      if (datasource) params.datasource = datasource
      const response = await this.client.get('/search', { params })
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

  // 7. 获取数据库统计（实时查询，不缓存）
  async getStats(datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; data: any }> {
    try {
      const params = datasource ? { datasource } : {}
      const response = await this.client.get('/stats', { params })
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
  async clearCache(datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; message: string }> {
    try {
      const params = datasource ? { datasource } : {}
      const response = await this.client.post('/cache/clear', {}, { params })
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

  // 下载静态数据
  async downloadData(params: {
    table_name: string
    columns?: string[]
    conditions?: Record<string, any>
    date_range?: {
      start_date: string
      end_date: string
      date_field: string
    }
    order_by?: string
    limit?: number
    format?: 'csv' | 'json'
  }): Promise<any> {
    try {
      const response = await this.client.post('/download-data', params, {
        responseType: params.format === 'json' ? 'json' : 'arraybuffer'
      })
      return response.data
    } catch (error: any) {
      console.error('下载静态数据失败:', error)
      throw new Error(error.response?.data?.message || '下载静态数据失败')
    }
  }

  // 🆕 预览表数据（最新10条）
  async previewTable(tableName: string, datasource?: 'postgresql' | 'clickhouse'): Promise<{ code: number; table_name: string; preview_count: number; columns: string[]; data: any[] }> {
    try {
      console.log('📋 调用后端API: GET /tables/' + tableName + '/preview', datasource ? `[${datasource}]` : '')
      const params = datasource ? { datasource } : {}
      const response = await this.client.get(`/tables/${tableName}/preview`, { params })
      console.log('✅ 后端返回预览数据:', response.data.code, `${response.data.preview_count || 0} 条`)
      return response.data
    } catch (error: any) {
      console.error(`预览表 ${tableName} 失败:`, error)
      throw new Error(error.response?.data?.message || '预览表数据失败')
    }
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
