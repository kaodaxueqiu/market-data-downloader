import Store from 'electron-store'
import { app } from 'electron'
import path from 'path'
import axios from 'axios'

interface ApiKeyInfo {
  id: string
  name: string
  apiKey: string
  isDefault: boolean
  createdAt: string | number  // 改为字符串或时间戳
  // 🆕 关联的数据库凭证
  databaseCredentials?: {
    accountName?: string  // 账户名称
    postgresql?: {
      username: string
      password: string
    }
    clickhouse?: {
      username: string
      password: string
    }
  }
  // 🆕 菜单权限
  menu_permissions?: string[]
  permissions_updated_at?: string
}

interface AppConfig {
  downloadDir: string
  maxConcurrent: number
  autoRetry: boolean
  retryTimes: number
  theme: 'light' | 'dark' | 'auto'
  language: 'zh_CN' | 'en_US'
}

export class ConfigManager {
  private store: Store

  constructor(store: Store) {
    this.store = store
    this.initDefaultConfig()
  }

  // 初始化默认配置
  private initDefaultConfig() {
    try {
      if (!this.store.has('appConfig')) {
        const downloadsPath = app.getPath('downloads')
        const defaultConfig: AppConfig = {
          downloadDir: path.join(downloadsPath, 'MarketData'),
          maxConcurrent: 3,
          autoRetry: true,
          retryTimes: 3,
          theme: 'light',
          language: 'zh_CN'
        }
        this.store.set('appConfig', defaultConfig)
        console.log('初始化配置成功:', defaultConfig)
      }
    } catch (error) {
      console.error('初始化配置失败:', error)
    }

    if (!this.store.has('apiKeys')) {
      this.store.set('apiKeys', [])
    }
  }

  // 加密文本 - 暂时简化，直接返回原文
  private encrypt(text: string): string {
    // 暂时跳过加密，直接返回原文以确保功能正常
    // TODO: 后续需要实现更可靠的加密方案
    return text
  }

  // 解密文本 - 暂时简化，直接返回原文
  private decrypt(text: string): string {
    // 暂时跳过解密，直接返回原文
    // TODO: 后续需要实现更可靠的解密方案
    return text
  }

  // 获取配置
  get(key?: string): any {
    if (key) {
      return this.store.get(key)
    }
    return this.store.store
  }

  // 设置配置
  set(key: string, value: any) {
    try {
      // 特殊处理appConfig，确保合并而不是覆盖
      if (key === 'appConfig' && typeof value === 'object') {
        const current = this.getAppConfig()
        const merged = { ...current, ...value }
        this.store.set(key, merged)
        console.log('配置已保存:', key, merged)
      } else {
        this.store.set(key, value)
        console.log('配置已保存:', key, value)
      }
      return true
    } catch (error) {
      console.error('保存配置时出错:', error)
      throw error
    }
  }

  // 获取应用配置
  getAppConfig(): AppConfig {
    return this.store.get('appConfig') as AppConfig
  }

  // 更新应用配置
  updateAppConfig(config: Partial<AppConfig>) {
    const current = this.getAppConfig()
    this.store.set('appConfig', { ...current, ...config })
  }

  // 获取API Key列表
  getApiKeys(): ApiKeyInfo[] {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    // 解密API Key并脱敏显示
    return keys.map(key => ({
      ...key,
      apiKey: this.maskApiKey(this.decrypt(key.apiKey)),
      createdAt: key.createdAt  // 确保是字符串或数字
    }))
  }

  // 获取默认API Key（完整的）
  getDefaultApiKey(): string | null {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const defaultKey = keys.find(k => k.isDefault)
    if (defaultKey) {
      return this.decrypt(defaultKey.apiKey)
    }
    return null
  }

  // 根据ID获取完整的API Key
  getFullApiKey(id: string): string | null {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const key = keys.find(k => k.id === id)
    if (key) {
      // 返回完整的API Key（现在是明文存储）
      return this.decrypt(key.apiKey)
    }
    return null
  }

  // 从后端获取数据库凭证
  async fetchDatabaseCredentials(apiKey: string): Promise<any> {
    try {
      console.log('📋 获取数据库凭证...')
      const response = await axios.get(
        'http://61.151.241.233:8080/api/v1/account/config',
        {
          headers: {
            'X-API-Key': apiKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取数据库凭证成功:', response.data)
      
      if (response.data.success && response.data.data) {
        return {
          success: true,
          credentials: {
            accountName: response.data.data.name,  // 账户名称
            postgresql: {
              username: response.data.data.database_config?.postgresql_username,
              password: response.data.data.database_config?.postgresql_password
            },
            clickhouse: {
              username: response.data.data.database_config?.clickhouse_username,
              password: response.data.data.database_config?.clickhouse_password
            }
          },
          accountName: response.data.data.name
        }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取数据库凭证失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足，无法获取数据库凭证' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 从后端获取菜单权限
  async fetchMenuPermissions(apiKey: string): Promise<any> {
    try {
      console.log('🔑 获取菜单权限...')
      const response = await axios.get(
        'http://61.151.241.233:8080/api/v1/account/my-menus',
        {
          headers: {
            'X-API-Key': apiKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取菜单权限成功:', response.data)
      
      if (response.data.success && response.data.data) {
        return {
          success: true,
          menuPermissions: response.data.data.menu_permissions || []
        }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取菜单权限失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 从后端获取所有API Keys（管理接口）
  async fetchAllApiKeys(): Promise<any> {
    try {
      // 获取当前用户的API Key（用于认证）
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('📋 获取所有API Keys（管理接口）...')
      const response = await axios.get(
        'http://61.151.241.233:8080/api/v1/admin/apikeys',
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取所有API Keys成功:', response.data)
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data || [],
          total: response.data.total || 0
        }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取所有API Keys失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足，需要管理员权限' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 吊销API Key（管理接口）
  async revokeApiKey(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🚫 吊销API Key:', key)
      const response = await axios.post(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}/revoke`,
        {},
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 吊销成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '吊销失败' }
      }
    } catch (error: any) {
      console.error('❌ 吊销失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 激活API Key（管理接口）
  async reactivateApiKey(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('✅ 激活API Key:', key)
      const response = await axios.post(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}/reactivate`,
        {},
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 激活成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '激活失败' }
      }
    } catch (error: any) {
      console.error('❌ 激活失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 获取API Key详情（管理接口）
  async fetchApiKeyDetail(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🔍 获取API Key详情:', key)
      const response = await axios.get(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}`,
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取详情成功:', response.data)
      
      if (response.data.success && response.data.data) {
        return { success: true, data: response.data.data }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取详情失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 更新API Key基本信息（管理接口）
  async updateApiKey(key: string, data: any): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('📝 更新API Key:', key, data)
      const response = await axios.put(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}`,
        data,
        {
          headers: {
            'X-API-Key': defaultKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 更新成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '更新失败' }
      }
    } catch (error: any) {
      console.error('❌ 更新失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 创建API Key（管理接口）
  async createApiKey(data: any): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('➕ 创建API Key:', data)
      const response = await axios.post(
        'http://61.151.241.233:8080/api/v1/admin/apikeys',
        data,
        {
          headers: {
            'X-API-Key': defaultKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 创建成功:', response.data)
      
      if (response.data.success) {
        return { success: true, data: response.data.data }
      } else {
        return { success: false, error: response.data.error || '创建失败' }
      }
    } catch (error: any) {
      console.error('❌ 创建失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 删除API Key（管理接口）
  async deleteApiKeyAdmin(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🗑️ 删除API Key:', key)
      const response = await axios.delete(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}`,
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 删除成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '删除失败' }
      }
    } catch (error: any) {
      console.error('❌ 删除失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 获取权限配置（管理接口）
  async fetchPermissionConfig(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🔐 获取权限配置:', key)
      const response = await axios.get(
        `http://61.151.241.233:8080/api/v1/admin/permissions/${key}`,
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取权限配置成功:', response.data)
      
      if (response.data.success && response.data.data) {
        return { success: true, data: response.data.data }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取权限配置失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: '权限配置不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 更新权限配置（PATCH部分更新）
  async patchPermissionConfig(key: string, updates: any): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🔄 部分更新权限配置:', key, updates)
      const response = await axios.patch(
        `http://61.151.241.233:8080/api/v1/admin/permissions/${key}`,
        updates,
        {
          headers: {
            'X-API-Key': defaultKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 权限配置更新成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '更新失败' }
      }
    } catch (error: any) {
      console.error('❌ 更新权限配置失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 获取数据库配置（独立接口）
  async fetchDatabaseConfig(key: string): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🔐 获取数据库配置:', key)
      const response = await axios.get(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}/database-config`,
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取数据库配置成功:', response.data)
      
      if (response.data.success && response.data.data) {
        return { success: true, data: response.data.data }
      } else {
        return { success: false, error: '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取数据库配置失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 更新数据库配置（独立接口）
  async updateDatabaseConfig(key: string, config: any): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('🔄 更新数据库配置:', key, config)
      const response = await axios.put(
        `http://61.151.241.233:8080/api/v1/admin/apikeys/${key}/database-config`,
        config,
        {
          headers: {
            'X-API-Key': defaultKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 数据库配置更新成功:', response.data)
      
      if (response.data.success) {
        return { success: true }
      } else {
        return { success: false, error: response.data.error || '更新失败' }
      }
    } catch (error: any) {
      console.error('❌ 更新数据库配置失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else if (error.response?.status === 404) {
        return { success: false, error: 'API Key不存在' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 🆕 获取权限注册表（所有系统权限）
  async fetchPermissionRegistry(): Promise<any> {
    try {
      const defaultKey = this.getDefaultApiKey()
      if (!defaultKey) {
        return { success: false, error: '未找到API Key' }
      }

      console.log('📚 获取权限注册表...')
      const response = await axios.get(
        'http://61.151.241.233:8080/api/v1/admin/permission-registry',
        {
          headers: {
            'X-API-Key': defaultKey
          },
          timeout: 10000
        }
      )
      
      console.log('✅ 获取权限注册表成功:', response.data)
      
      // 注意：这个接口返回的是 code/data/message 格式
      if (response.data.code === 'SUCCESS' && response.data.data) {
        return { success: true, data: response.data.data }
      } else if (response.data.success && response.data.data) {
        return { success: true, data: response.data.data }
      } else {
        return { success: false, error: response.data.message || '响应格式错误' }
      }
    } catch (error: any) {
      console.error('❌ 获取权限注册表失败:', error)
      if (error.response?.status === 401) {
        return { success: false, error: 'API Key无效或已过期' }
      } else if (error.response?.status === 403) {
        return { success: false, error: '权限不足' }
      } else {
        return { success: false, error: error.message || '网络错误' }
      }
    }
  }

  // 保存API Key（新版：同时获取并保存数据库凭证和菜单权限）
  async saveApiKeyWithCredentials(apiKey: string, name: string, isDefault: boolean = false): Promise<{ success: boolean; id?: string; error?: string; accountName?: string }> {
    try {
      // 并行调用后端接口获取数据库凭证和菜单权限
      const [credResult, permResult] = await Promise.all([
        this.fetchDatabaseCredentials(apiKey),
        this.fetchMenuPermissions(apiKey)
      ])
      
      if (!credResult.success) {
        return { success: false, error: credResult.error }
      }
      
      // 菜单权限获取失败不影响保存，只是不设置权限
      const menuPermissions = permResult.success ? permResult.menuPermissions : []
      if (!permResult.success) {
        console.warn('⚠️ 获取菜单权限失败，将使用空权限:', permResult.error)
      }
      
      const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
      
      // 如果设为默认，取消其他的默认状态
      if (isDefault) {
        keys.forEach(k => k.isDefault = false)
      }

      const newKey: ApiKeyInfo = {
        id: `key_${Date.now()}`,
        name: name || credResult.accountName || `API Key ${keys.length + 1}`,
        apiKey: this.encrypt(apiKey),
        isDefault,
        createdAt: new Date().toISOString(),
        databaseCredentials: credResult.credentials,  // 保存数据库凭证
        menu_permissions: menuPermissions,  // 🆕 保存菜单权限
        permissions_updated_at: new Date().toISOString()  // 🆕 权限更新时间
      }

      keys.push(newKey)
      this.store.set('apiKeys', keys)
      
      console.log('✅ API Key、数据库凭证和菜单权限已保存')
      
      return { 
        success: true, 
        id: newKey.id,
        accountName: credResult.accountName
      }
    } catch (error: any) {
      console.error('❌ 保存失败:', error)
      return { success: false, error: error.message || '保存失败' }
    }
  }

  // 保存API Key（旧版：兼容）
  saveApiKey(apiKey: string, name: string, isDefault: boolean = false): string {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    
    // 如果设为默认，取消其他的默认状态
    if (isDefault) {
      keys.forEach(k => k.isDefault = false)
    }

    const newKey: ApiKeyInfo = {
      id: `key_${Date.now()}`,
      name: name || `API Key ${keys.length + 1}`,
      apiKey: this.encrypt(apiKey),
      isDefault,
      createdAt: new Date().toISOString()  // 转为ISO字符串
    }

    keys.push(newKey)
    this.store.set('apiKeys', keys)
    
    return newKey.id
  }

  // 获取数据库凭证
  getDatabaseCredentials(apiKeyId: string): any {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const key = keys.find(k => k.id === apiKeyId)
    return key?.databaseCredentials || null
  }

  // 🆕 获取指定Key的菜单权限
  getMenuPermissions(apiKeyId: string): string[] {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const key = keys.find(k => k.id === apiKeyId)
    return key?.menu_permissions || []
  }

  // 🆕 刷新指定Key的菜单权限
  async refreshMenuPermissions(apiKeyId: string): Promise<{ success: boolean; menuPermissions?: string[]; error?: string }> {
    try {
      const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
      const key = keys.find(k => k.id === apiKeyId)
      
      if (!key) {
        return { success: false, error: 'API Key不存在' }
      }
      
      // 获取完整API Key
      const fullApiKey = this.decrypt(key.apiKey)
      
      // 从后端获取最新权限
      const permResult = await this.fetchMenuPermissions(fullApiKey)
      
      if (!permResult.success) {
        return { success: false, error: permResult.error }
      }
      
      // 更新本地存储
      key.menu_permissions = permResult.menuPermissions
      key.permissions_updated_at = new Date().toISOString()
      this.store.set('apiKeys', keys)
      
      console.log(`✅ 菜单权限已刷新 (${apiKeyId}):`, permResult.menuPermissions)
      
      return { 
        success: true, 
        menuPermissions: permResult.menuPermissions 
      }
    } catch (error: any) {
      console.error('❌ 刷新菜单权限失败:', error)
      return { success: false, error: error.message || '刷新失败' }
    }
  }

  // 🆕 刷新默认Key的菜单权限
  async refreshDefaultKeyPermissions(): Promise<{ success: boolean; menuPermissions?: string[]; error?: string }> {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const defaultKey = keys.find(k => k.isDefault)
    
    if (!defaultKey) {
      return { success: false, error: '未找到默认API Key' }
    }
    
    return this.refreshMenuPermissions(defaultKey.id)
  }

  // 删除API Key
  deleteApiKey(id: string): boolean {
    const keys = this.store.get('apiKeys', []) as ApiKeyInfo[]
    const index = keys.findIndex(k => k.id === id)
    
    if (index !== -1) {
      keys.splice(index, 1)
      this.store.set('apiKeys', keys)
      return true
    }
    
    return false
  }

  // 脱敏显示API Key
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 20) return apiKey
    const start = apiKey.substring(0, 10)
    const end = apiKey.substring(apiKey.length - 10)
    return `${start}...${end}`
  }

  // 重置配置
  reset() {
    this.store.clear()
    this.initDefaultConfig()
  }
}
