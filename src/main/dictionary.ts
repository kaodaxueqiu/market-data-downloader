/**
 * 数据字典API模块
 */
import axios, { AxiosInstance } from 'axios'

interface DataSource {
  code: string
  name: string
  market: string
  exchange: string
  data_type: string
  update_frequency: string
  redis_port: number
  raw_db: number
  decoded_db: number
  field_count: number
  enabled_count: number
}

interface RawFormat {
  code: string
  total_size: number
  byte_order: string
  header_size: number
  body_size: number
  header_fields: Array<{
    name: string
    type: string
    offset: number
    size: number
    cn_name: string
    description: string
    unit: string
    formula: string
  }>
  body_fields: Array<{
    name: string
    type: string
    offset: number
    size: number
    cn_name: string
    description: string
    unit: string
    formula: string
  }>
}

interface DecodedFormat {
  code: string
  format: string
  encoding: string
  key_pattern: string
  fields: Array<{
    name: string
    cn_name: string
    type: string
    description: string
    example: any
  }>
  example: Record<string, any>
}

interface Field {
  name: string
  source: string
  type: string
  offset: number
  size: number
  output_name: string
  description: string
  cn_name: string
  enabled: boolean
  for_index: boolean
}

interface CompareResult {
  common_fields: Array<{
    name: string
    cn_name: string
    type: string
  }>
  unique_fields: Record<string, Array<{
    name: string
    cn_name: string
    type: string
  }>>
}

export class DataDictionaryAPI {
  private client: AxiosInstance
  private cache: Map<string, any> = new Map()

  constructor(apiKey?: string) {
    // 使用公网API地址（和数据下载保持一致）
    const baseURL = process.env.DICT_API_URL || 'http://61.151.241.233:8080/api/v1/dictionary'
    
    console.log('数据字典API地址:', baseURL)
    
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
        console.error('数据字典API错误:', error.response?.data || error.message)
        throw error
      }
    )
  }

  // 设置API Key
  setApiKey(apiKey: string) {
    this.client.defaults.headers['X-API-Key'] = apiKey
  }

  // 获取所有数据源
  async getAllSources(market?: string): Promise<{ code: number; data: DataSource[]; total: number }> {
    const cacheKey = `sources_${market || 'all'}`
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const params = market ? { market } : {}
      const response = await this.client.get('/sources', { params })
      
      // 缓存5分钟
      this.cache.set(cacheKey, response.data)
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000)
      
      return response.data
    } catch (error: any) {
      console.error('获取数据源列表失败:', error)
      throw new Error(error.response?.data?.message || '获取数据源列表失败')
    }
  }

  // 获取数据源详情
  async getSourceDetail(code: string): Promise<{ code: number; data: DataSource }> {
    const cacheKey = `source_${code}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const response = await this.client.get(`/sources/${code}`)
      
      this.cache.set(cacheKey, response.data)
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000)
      
      return response.data
    } catch (error: any) {
      console.error(`获取数据源 ${code} 详情失败:`, error)
      if (error.response?.status === 404) {
        throw new Error(`数据源 ${code} 不存在`)
      }
      throw new Error(error.response?.data?.message || '获取数据源详情失败')
    }
  }

  // 获取RAW格式文档
  async getRawFormat(code: string): Promise<{ code: number; data: RawFormat }> {
    try {
      const response = await this.client.get(`/sources/${code}/raw`)
      return response.data
    } catch (error: any) {
      console.error(`获取 ${code} RAW格式失败:`, error)
      throw new Error(error.response?.data?.message || '获取RAW格式失败')
    }
  }

  // 获取DECODED格式文档
  async getDecodedFormat(code: string): Promise<{ code: number; data: DecodedFormat }> {
    try {
      const response = await this.client.get(`/sources/${code}/decoded`)
      return response.data
    } catch (error: any) {
      console.error(`获取 ${code} DECODED格式失败:`, error)
      throw new Error(error.response?.data?.message || '获取DECODED格式失败')
    }
  }

  // 获取字段定义
  async getFields(code: string, enabledOnly?: boolean): Promise<{ code: number; data: Field[]; total: number }> {
    try {
      const params = enabledOnly !== undefined ? { enabled: enabledOnly } : {}
      const response = await this.client.get(`/sources/${code}/fields`, { params })
      return response.data
    } catch (error: any) {
      console.error(`获取 ${code} 字段定义失败:`, error)
      throw new Error(error.response?.data?.message || '获取字段定义失败')
    }
  }

  // 获取解析代码
  async getParserCode(code: string, language: string): Promise<{ code: number; data: { language: string; code: string } }> {
    try {
      const response = await this.client.get(`/sources/${code}/code/${language}`)
      return response.data
    } catch (error: any) {
      console.error(`获取 ${code} ${language} 解析代码失败:`, error)
      throw new Error(error.response?.data?.message || '获取解析代码失败')
    }
  }

  // 搜索数据源
  async search(keyword: string): Promise<{ code: number; data: DataSource[]; total: number }> {
    try {
      const response = await this.client.get('/search', {
        params: { keyword }
      })
      return response.data
    } catch (error: any) {
      console.error('搜索数据源失败:', error)
      throw new Error(error.response?.data?.message || '搜索失败')
    }
  }

  // 对比字段
  async compareFields(sourceCodes: string[]): Promise<{ code: number; data: CompareResult }> {
    try {
      const response = await this.client.post('/compare', {
        source_codes: sourceCodes
      })
      return response.data
    } catch (error: any) {
      console.error('字段对比失败:', error)
      throw new Error(error.response?.data?.message || '字段对比失败')
    }
  }

  // 下载文档
  async downloadDocument(code: string, format: string = 'json'): Promise<any> {
    try {
      const response = await this.client.get(`/sources/${code}/download`, {
        params: { format },
        responseType: format === 'json' ? 'json' : 'blob'
      })
      return response.data
    } catch (error: any) {
      console.error(`下载 ${code} 文档失败:`, error)
      throw new Error(error.response?.data?.message || '下载文档失败')
    }
  }

  // 清除缓存
  clearCache() {
    this.cache.clear()
  }
}

// 单例实例
let dictionaryAPI: DataDictionaryAPI | null = null

export function getDictionaryAPI(apiKey?: string): DataDictionaryAPI {
  if (!dictionaryAPI) {
    dictionaryAPI = new DataDictionaryAPI(apiKey)
  } else if (apiKey) {
    dictionaryAPI.setApiKey(apiKey)
  }
  return dictionaryAPI
}
