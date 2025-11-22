/**
 * 基金管理API模块
 */

import axios, { AxiosInstance } from 'axios'

export class FundAPI {
  private client: AxiosInstance
  private apiKey: string | null = null

  constructor(baseURL: string = 'http://61.151.241.233:8080') {
    this.client = axios.create({
      baseURL: baseURL + '/api/v1/fund',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器：自动添加API Key
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers['X-API-Key'] = this.apiKey
      }
      return config
    })
  }

  /**
   * 设置API Key
   */
  setApiKey(apiKey: string): boolean {
    this.apiKey = apiKey
    console.log('🔑 基金API - 设置API Key')
    return true
  }

  /**
   * 获取托管人列表
   */
  async getCustodians(): Promise<{ code: number; data: any[] }> {
    try {
      console.log('📋 调用后端API: GET /custodians')
      const response = await this.client.get('/custodians')
      console.log('✅ 后端返回托管人列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取托管人列表失败:', error)
      throw new Error(error.response?.data?.message || '获取托管人列表失败')
    }
  }

  /**
   * 获取经纪服务商列表
   */
  async getBrokers(): Promise<{ code: number; data: any[] }> {
    try {
      console.log('📋 调用后端API: GET /brokers')
      const response = await this.client.get('/brokers')
      console.log('✅ 后端返回经纪服务商列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取经纪服务商列表失败:', error)
      throw new Error(error.response?.data?.message || '获取经纪服务商列表失败')
    }
  }

  /**
   * 创建基金
   */
  async createFund(fundData: any): Promise<{ code: number; data: any }> {
    try {
      console.log('📋 调用后端API: POST /info', fundData)
      const response = await this.client.post('/info', fundData)
      console.log('✅ 基金创建成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('创建基金失败:', error)
      throw new Error(error.response?.data?.message || '创建基金失败')
    }
  }

  /**
   * 获取基金列表
   */
  async getFundList(params?: {
    page?: number
    size?: number
    fund_name?: string
    custodian?: string
    broker?: string
    status?: string
  }): Promise<{ code: number; data: any[]; total: number; page: number; size: number }> {
    try {
      console.log('📋 调用后端API: GET /info', params)
      const response = await this.client.get('/info', { params })
      console.log('✅ 后端返回基金列表:', response.data.total, '个基金')
      return response.data
    } catch (error: any) {
      console.error('获取基金列表失败:', error)
      throw new Error(error.response?.data?.message || '获取基金列表失败')
    }
  }

  /**
   * 获取基金详情
   */
  async getFundDetail(code: string): Promise<{ code: number; data: any }> {
    try {
      console.log('📋 调用后端API: GET /info/' + code)
      const response = await this.client.get(`/info/${code}`)
      console.log('✅ 后端返回基金详情:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取基金详情失败:', error)
      throw new Error(error.response?.data?.message || '获取基金详情失败')
    }
  }

  /**
   * 更新基金信息
   */
  async updateFund(code: string, fundData: any): Promise<{ code: number; data: any }> {
    try {
      console.log('📋 调用后端API: PUT /info/' + code, fundData)
      const response = await this.client.put(`/info/${code}`, fundData)
      console.log('✅ 基金更新成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('更新基金失败:', error)
      throw new Error(error.response?.data?.message || '更新基金失败')
    }
  }

  /**
   * 删除基金（软删除）
   */
  async deleteFund(code: string): Promise<{ code: number; message: string }> {
    try {
      console.log('📋 调用后端API: DELETE /info/' + code)
      const response = await this.client.delete(`/info/${code}`)
      console.log('✅ 基金删除成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('删除基金失败:', error)
      throw new Error(error.response?.data?.message || '删除基金失败')
    }
  }

  /**
   * 清盘基金（改变状态为已清盘）
   */
  async liquidateFund(code: string, liquidateDate: string, reason?: string): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /info/' + code + '/liquidate')
      const response = await this.client.post(`/info/${code}/liquidate`, {
        liquidate_date: liquidateDate,
        reason: reason || ''
      })
      console.log('✅ 基金清盘成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('清盘基金失败:', error)
      throw new Error(error.response?.data?.error || error.response?.data?.message || '清盘基金失败')
    }
  }

  /**
   * 恢复基金运作（将已清盘的基金恢复为运作中）
   */
  async restoreFund(code: string, restoreDate: string, reason?: string): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /info/' + code + '/restore')
      const response = await this.client.post(`/info/${code}/restore`, {
        restore_date: restoreDate,
        reason: reason || ''
      })
      console.log('✅ 基金恢复成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('恢复基金失败:', error)
      throw new Error(error.response?.data?.error || error.response?.data?.message || '恢复基金失败')
    }
  }

  /**
   * 上传报告
   */
  async uploadReport(reportData: { 
    fund_code: string
    report_type: string
    report_date: string
    report_title?: string
    filePath: string
  }): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /reports')
      
      const FormData = require('form-data')
      const fs = require('fs')
      
      const formData = new FormData()
      formData.append('fund_code', reportData.fund_code)
      formData.append('report_type', reportData.report_type)
      formData.append('report_date', reportData.report_date)
      if (reportData.report_title) {
        formData.append('report_title', reportData.report_title)
      }
      formData.append('file', fs.createReadStream(reportData.filePath))
      
      const response = await this.client.post('/reports', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-API-Key': this.apiKey
        }
      })
      console.log('✅ 报告上传成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('上传报告失败:', error)
      throw new Error(error.response?.data?.error || error.response?.data?.message || '上传报告失败')
    }
  }

  /**
   * 获取报告列表
   */
  async getReportList(params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /reports', params)
      const response = await this.client.get('/reports', { params })
      console.log('✅ 后端返回报告列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取报告列表失败:', error)
      throw new Error(error.response?.data?.error || '获取报告列表失败')
    }
  }

  /**
   * 获取报告下载链接
   */
  async getReportDownloadUrl(reportId: number): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /reports/' + reportId + '/download')
      const response = await this.client.get(`/reports/${reportId}/download`)
      console.log('✅ 获取下载链接成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取下载链接失败:', error)
      throw new Error(error.response?.data?.error || '获取下载链接失败')
    }
  }

  /**
   * 删除报告
   */
  async deleteReport(reportId: number): Promise<any> {
    try {
      console.log('📋 调用后端API: DELETE /reports/' + reportId)
      const response = await this.client.delete(`/reports/${reportId}`)
      console.log('✅ 报告删除成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('删除报告失败:', error)
      throw new Error(error.response?.data?.error || '删除报告失败')
    }
  }
}

// 导出工厂函数
let fundAPIInstance: FundAPI | null = null

export function getFundAPI(): FundAPI {
  if (!fundAPIInstance) {
    fundAPIInstance = new FundAPI()
  }
  return fundAPIInstance
}


