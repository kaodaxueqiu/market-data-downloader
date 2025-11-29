/**
 * Prometheus API 服务
 * 从 Prometheus 获取实时监控数据
 */

// Prometheus API 地址
const PROMETHEUS_BASE_URL = 'http://61.151.241.233:9090'

interface PrometheusResponse<T = any> {
  status: 'success' | 'error'
  data?: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string'
    result: T[]
  }
  errorType?: string
  error?: string
}

interface MetricResult {
  metric: Record<string, string>
  value: [number, string]  // [timestamp, value]
}

class PrometheusService {
  /**
   * 执行即时查询
   */
  async query(query: string): Promise<MetricResult[]> {
    try {
      const url = `${PROMETHEUS_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}`
      
      const response = await fetch(url)
      const data: PrometheusResponse<MetricResult> = await response.json()
      
      if (data.status === 'error') {
        throw new Error(data.error || 'Prometheus query failed')
      }
      
      return data.data?.result || []
    } catch (error) {
      console.error('Prometheus query error:', error)
      throw error
    }
  }

  /**
   * 执行范围查询
   */
  async queryRange(query: string, start: number, end: number, step: string): Promise<any[]> {
    try {
      const url = `${PROMETHEUS_BASE_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
      
      const response = await fetch(url)
      const data: PrometheusResponse = await response.json()
      
      if (data.status === 'error') {
        throw new Error(data.error || 'Prometheus query_range failed')
      }
      
      return data.data?.result || []
    } catch (error) {
      console.error('Prometheus query_range error:', error)
      throw error
    }
  }
}

export const prometheusService = new PrometheusService()
export default prometheusService






