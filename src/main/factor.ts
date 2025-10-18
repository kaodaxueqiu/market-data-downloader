/**
 * 因子库API模块
 */
import axios, { AxiosInstance } from 'axios'

// 因子分类（三级）
interface FactorCategory {
  id: number
  code: string
  name: string
  name_en: string
  parent_id?: number
  sort_order: number
  factor_count: number           // ⭐ 新增：该分类下的因子数量
  children?: FactorCategory[]
}

// 因子标签
interface FactorTag {
  id: number
  tag_type: string
  tag_value: string
  tag_name: string
  description?: string
  sort_order: number
  created_at: string
}

// 因子元数据
interface FactorMetadata {
  factor_id: number
  factor_code: string
  factor_name: string
  factor_name_en: string
  category_l3_id: number
  category_l3_name?: string
  category_l2_name?: string
  category_l1_name?: string
  description?: string
  formula?: string
  lookback_period?: number
  data_type?: string
  unit?: string
  ic_mean?: number
  ic_std?: number
  ic_ir?: number
  rank_ic_mean?: number
  rank_ic_std?: number
  rank_ic_ir?: number
  turnover?: number
  sharpe_ratio?: number
  max_drawdown?: number
  last_performance_date?: string
  data_start_date?: string
  data_end_date?: string
  coverage_rate?: number
  status: string
  version?: string
  author?: string
  created_by?: string
  created_at: string
  updated_at: string
  tags?: FactorTag[]
}

// 因子性能数据
interface FactorPerformance {
  id: number
  factor_id: number
  date: string
  ic_value: number
  rank_ic_value: number
  turnover: number
  long_short_return: number
  created_at: string
}

export class FactorAPI {
  private client: AxiosInstance
  private cache: Map<string, any> = new Map()

  constructor(apiKey?: string) {
    const baseURL = process.env.FACTOR_API_URL || 'http://61.151.241.233:8080/api/v1/factor'
    
    console.log('因子库API地址:', baseURL)
    
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
        console.error('因子库API错误:', error.response?.data || error.message)
        throw error
      }
    )
  }

  // 设置API Key
  setApiKey(apiKey: string) {
    this.client.defaults.headers['X-API-Key'] = apiKey
  }

  // 1. 获取因子分类树
  async getCategories(): Promise<{ code: number; data: FactorCategory[] }> {
    const cacheKey = 'categories'
    if (this.cache.has(cacheKey)) {
      return { code: 200, data: this.cache.get(cacheKey) }
    }

    const response = await this.client.get('/categories')
    
    if (response.data.success) {
      this.cache.set(cacheKey, response.data.data)
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '获取分类树失败')
  }

  // 2. 获取因子标签列表
  async getTags(tag_type?: string): Promise<{ code: number; data: Record<string, FactorTag[]> }> {
    const params = tag_type ? { tag_type } : {}
    const response = await this.client.get('/tags', { params })
    
    if (response.data.success) {
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '获取标签列表失败')
  }

  // 3. 获取因子列表
  async getFactorList(params: {
    category_l3_id?: number
    tags?: string
    status?: string
    page?: number
    page_size?: number
  }): Promise<{ 
    code: number
    data: {
      factors: FactorMetadata[]
      total: number
      page: number
      page_size: number
    }
  }> {
    const response = await this.client.get('/list', { params })
    
    if (response.data.success) {
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '获取因子列表失败')
  }

  // 4. 获取因子详情
  async getFactorDetail(factorId: number): Promise<{ code: number; data: FactorMetadata }> {
    const response = await this.client.get(`/detail/${factorId}`)
    
    if (response.data.success) {
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '获取因子详情失败')
  }

  // 5. 下载因子数据
  async downloadFactorData(params: {
    factor_ids: number[]
    start_date: string
    end_date: string
    stock_pool?: string
  }): Promise<{ 
    code: number
    data: {
      task_id: string
      status: string
      factor_ids: number[]
      start_date: string
      end_date: string
      stock_pool: string
      created_at: string
      note?: string
    }
  }> {
    const response = await this.client.post('/download', params)
    
    if (response.data.success) {
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '创建下载任务失败')
  }

  // 6. 获取因子性能数据
  async getFactorPerformance(factorId: number, days: number = 60): Promise<{
    code: number
    data: {
      factor_id: number
      days: number
      count: number
      performances: FactorPerformance[]
    }
  }> {
    const response = await this.client.get(`/performance/${factorId}`, {
      params: { days }
    })
    
    if (response.data.success) {
      return { code: 200, data: response.data.data }
    }
    
    throw new Error(response.data.message || '获取因子性能数据失败')
  }

  // 清除缓存
  clearCache() {
    this.cache.clear()
  }
}

// 导出单例
export const factorAPI = new FactorAPI()



