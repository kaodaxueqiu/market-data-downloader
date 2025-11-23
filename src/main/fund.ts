/**
 * 基金管理API模块
 */

import axios, { AxiosInstance } from 'axios'

export class FundAPI {
  private client: AxiosInstance
  private apiKey: string | null = null
  private baseURL: string

  constructor(baseURL: string = 'http://61.151.241.233:8080') {
    this.baseURL = baseURL
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
  
  // 创建 account 接口的 client
  private getAccountClient() {
    return axios.create({
      baseURL: this.baseURL + '/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
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

  // ========== 净值管理 ==========

  /**
   * 录入净值
   */
  async createNav(data: {
    fund_code: string
    nav_date: string
    unit_nav: number
    accumulated_nav?: number
    daily_return?: number
    total_assets?: number
    total_shares?: number
    remark?: string
  }): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /nav', data)
      const response = await this.client.post('/nav', data)
      console.log('✅ 净值录入成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('录入净值失败:', error)
      throw new Error(error.response?.data?.error || '录入净值失败')
    }
  }

  /**
   * 获取净值列表
   */
  async getNavList(params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /nav', params)
      const response = await this.client.get('/nav', { params })
      console.log('✅ 后端返回净值列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取净值列表失败:', error)
      throw new Error(error.response?.data?.error || '获取净值列表失败')
    }
  }

  /**
   * 获取净值详情
   */
  async getNavDetail(navId: number): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /nav/' + navId)
      const response = await this.client.get(`/nav/${navId}`)
      console.log('✅ 后端返回净值详情:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取净值详情失败:', error)
      throw new Error(error.response?.data?.error || '获取净值详情失败')
    }
  }

  /**
   * 更新净值
   */
  async updateNav(navId: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: PUT /nav/' + navId, data)
      const response = await this.client.put(`/nav/${navId}`, data)
      console.log('✅ 净值更新成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('更新净值失败:', error)
      throw new Error(error.response?.data?.error || '更新净值失败')
    }
  }

  /**
   * 删除净值
   */
  async deleteNav(navId: number): Promise<any> {
    try {
      console.log('📋 调用后端API: DELETE /nav/' + navId)
      const response = await this.client.delete(`/nav/${navId}`)
      console.log('✅ 净值删除成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('删除净值失败:', error)
      throw new Error(error.response?.data?.error || '删除净值失败')
    }
  }

  /**
   * 获取基金净值历史
   */
  async getFundNavHistory(code: string, params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /info/' + code + '/nav', params)
      const response = await this.client.get(`/info/${code}/nav`, { params })
      console.log('✅ 后端返回净值历史:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取净值历史失败:', error)
      throw new Error(error.response?.data?.error || '获取净值历史失败')
    }
  }

  /**
   * 获取最新净值
   */
  async getLatestNav(code: string): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /info/' + code + '/nav/latest')
      const response = await this.client.get(`/info/${code}/nav/latest`)
      console.log('✅ 后端返回最新净值:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取最新净值失败:', error)
      throw new Error(error.response?.data?.error || '获取最新净值失败')
    }
  }

  /**
   * 获取净值曲线数据（用于图表）
   */
  async getNavChart(code: string, days: number = 30): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /info/' + code + '/nav/chart')
      const response = await this.client.get(`/info/${code}/nav/chart`, {
        params: { days }
      })
      console.log('✅ 后端返回净值曲线:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取净值曲线失败:', error)
      throw new Error(error.response?.data?.error || '获取净值曲线失败')
    }
  }

  /**
   * 获取净值统计
   */
  async getNavStatistics(code: string): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /nav/statistics')
      const response = await this.client.get('/nav/statistics', {
        params: { fund_code: code }
      })
      console.log('✅ 后端返回净值统计:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取净值统计失败:', error)
      throw new Error(error.response?.data?.error || '获取净值统计失败')
    }
  }

  // ========== 申购赎回 ==========

  /**
   * 创建交易（申购或赎回）
   */
  async createTransaction(data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /transactions', data)
      const response = await this.client.post('/transactions', data)
      console.log('✅ 交易创建成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('创建交易失败:', error)
      throw new Error(error.response?.data?.error || '创建交易失败')
    }
  }

  /**
   * 获取交易列表
   */
  async getTransactionList(params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /transactions', params)
      const response = await this.client.get('/transactions', { params })
      console.log('✅ 后端返回交易列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取交易列表失败:', error)
      throw new Error(error.response?.data?.error || '获取交易列表失败')
    }
  }

  /**
   * 确认交易
   */
  async confirmTransaction(transId: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /transactions/' + transId + '/confirm', data)
      const response = await this.client.post(`/transactions/${transId}/confirm`, data)
      console.log('✅ 交易确认成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('确认交易失败:', error)
      throw new Error(error.response?.data?.error || '确认交易失败')
    }
  }

  /**
   * 撤销交易
   */
  async cancelTransaction(transId: number): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /transactions/' + transId + '/cancel')
      const response = await this.client.post(`/transactions/${transId}/cancel`)
      console.log('✅ 交易撤销成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('撤销交易失败:', error)
      throw new Error(error.response?.data?.error || '撤销交易失败')
    }
  }

  /**
   * 获取基金的交易记录
   */
  async getFundTransactions(code: string, params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /info/' + code + '/transactions', params)
      const response = await this.client.get(`/info/${code}/transactions`, { params })
      console.log('✅ 后端返回基金交易记录:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取基金交易记录失败:', error)
      throw new Error(error.response?.data?.error || '获取基金交易记录失败')
    }
  }

  // ========== 基础信息维护 ==========

  /**
   * 创建托管人
   */
  async createCustodian(data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /custodians', data)
      const response = await this.client.post('/custodians', data)
      console.log('✅ 托管人创建成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('创建托管人失败:', error)
      throw new Error(error.response?.data?.error || '创建托管人失败')
    }
  }

  /**
   * 更新托管人
   */
  async updateCustodian(id: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: PUT /custodians/' + id, data)
      const response = await this.client.put(`/custodians/${id}`, data)
      console.log('✅ 托管人更新成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('更新托管人失败:', error)
      throw new Error(error.response?.data?.error || '更新托管人失败')
    }
  }

  /**
   * 删除托管人
   */
  async deleteCustodian(id: number): Promise<any> {
    try {
      console.log('📋 调用后端API: DELETE /custodians/' + id)
      const response = await this.client.delete(`/custodians/${id}`)
      console.log('✅ 托管人删除成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('删除托管人失败:', error)
      throw new Error(error.response?.data?.error || '删除托管人失败')
    }
  }

  /**
   * 创建经纪商
   */
  async createBroker(data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /brokers', data)
      const response = await this.client.post('/brokers', data)
      console.log('✅ 经纪商创建成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('创建经纪商失败:', error)
      throw new Error(error.response?.data?.error || '创建经纪商失败')
    }
  }

  /**
   * 更新经纪商
   */
  async updateBroker(id: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: PUT /brokers/' + id, data)
      const response = await this.client.put(`/brokers/${id}`, data)
      console.log('✅ 经纪商更新成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('更新经纪商失败:', error)
      throw new Error(error.response?.data?.error || '更新经纪商失败')
    }
  }

  /**
   * 删除经纪商
   */
  async deleteBroker(id: number): Promise<any> {
    try {
      console.log('📋 调用后端API: DELETE /brokers/' + id)
      const response = await this.client.delete(`/brokers/${id}`)
      console.log('✅ 经纪商删除成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('删除经纪商失败:', error)
      throw new Error(error.response?.data?.error || '删除经纪商失败')
    }
  }

  // ========== 投资者管理 ==========
  // 注意：投资者接口在 /api/v1/investors，需要创建独立的client

  private getInvestorClient() {
    return axios.create({
      baseURL: 'http://61.151.241.233:8080/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    })
  }

  /**
   * 创建投资者
   */
  async createInvestor(data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /investors', data)
      const client = this.getInvestorClient()
      const response = await client.post('/investors', data)
      console.log('✅ 投资者创建成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('创建投资者失败:', error)
      throw new Error(error.response?.data?.error || '创建投资者失败')
    }
  }

  /**
   * 获取投资者列表
   */
  async getInvestorList(params?: any): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /investors', params)
      const client = this.getInvestorClient()
      const response = await client.get('/investors', { params })
      console.log('✅ 后端返回投资者列表:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取投资者列表失败:', error)
      throw new Error(error.response?.data?.error || '获取投资者列表失败')
    }
  }

  /**
   * 获取投资者详情
   */
  async getInvestorDetail(id: number): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /investors/' + id)
      const client = this.getInvestorClient()
      const response = await client.get(`/investors/${id}`)
      console.log('✅ 后端返回投资者详情:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取投资者详情失败:', error)
      throw new Error(error.response?.data?.error || '获取投资者详情失败')
    }
  }

  /**
   * 更新投资者
   */
  async updateInvestor(id: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: PUT /investors/' + id, data)
      const client = this.getInvestorClient()
      const response = await client.put(`/investors/${id}`, data)
      console.log('✅ 投资者更新成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('更新投资者失败:', error)
      throw new Error(error.response?.data?.error || '更新投资者失败')
    }
  }

  /**
   * 删除投资者（销户）
   */
  async deleteInvestor(id: number): Promise<any> {
    try {
      console.log('📋 调用后端API: DELETE /investors/' + id)
      const client = this.getInvestorClient()
      const response = await client.delete(`/investors/${id}`)
      console.log('✅ 投资者销户成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('投资者销户失败:', error)
      throw new Error(error.response?.data?.error || '投资者销户失败')
    }
  }

  /**
   * 合格投资者认定
   */
  async qualifyInvestor(id: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /investors/' + id + '/qualify', data)
      const client = this.getInvestorClient()
      const response = await client.post(`/investors/${id}/qualify`, data)
      console.log('✅ 合格投资者认定成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('合格投资者认定失败:', error)
      throw new Error(error.response?.data?.error || '合格投资者认定失败')
    }
  }

  /**
   * 风险评估
   */
  async riskAssessInvestor(id: number, data: any): Promise<any> {
    try {
      console.log('📋 调用后端API: POST /investors/' + id + '/risk-assess', data)
      const client = this.getInvestorClient()
      const response = await client.post(`/investors/${id}/risk-assess`, data)
      console.log('✅ 风险评估成功:', response.data)
      return response.data
    } catch (error: any) {
      console.error('风险评估失败:', error)
      throw new Error(error.response?.data?.error || '风险评估失败')
    }
  }

  /**
   * 投资者统计
   */
  async getInvestorStatistics(): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /investors/statistics')
      const client = this.getInvestorClient()
      const response = await client.get('/investors/statistics')
      console.log('✅ 后端返回投资者统计:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取投资者统计失败:', error)
      throw new Error(error.response?.data?.error || '获取投资者统计失败')
    }
  }

  // ========== 账户/菜单管理 ==========

  /**
   * 获取用户的菜单权限
   */
  async getMyMenus(): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /account/my-menus')
      const client = this.getAccountClient()
      const response = await client.get('/account/my-menus')
      console.log('✅ 后端返回菜单权限:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取菜单权限失败:', error)
      throw new Error(error.response?.data?.error || '获取菜单权限失败')
    }
  }

  /**
   * 获取所有菜单定义
   */
  async getAllMenus(): Promise<any> {
    try {
      console.log('📋 调用后端API: GET /account/menus')
      const client = this.getAccountClient()
      const response = await client.get('/account/menus')
      console.log('✅ 后端返回所有菜单:', response.data)
      return response.data
    } catch (error: any) {
      console.error('获取所有菜单失败:', error)
      throw new Error(error.response?.data?.error || '获取所有菜单失败')
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


