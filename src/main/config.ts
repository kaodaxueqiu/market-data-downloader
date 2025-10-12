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

  // 保存API Key（新版：同时获取并保存数据库凭证）
  async saveApiKeyWithCredentials(apiKey: string, name: string, isDefault: boolean = false): Promise<{ success: boolean; id?: string; error?: string; accountName?: string }> {
    try {
      // 先调用后端接口获取数据库凭证
      const credResult = await this.fetchDatabaseCredentials(apiKey)
      
      if (!credResult.success) {
        return { success: false, error: credResult.error }
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
        databaseCredentials: credResult.credentials  // 保存数据库凭证
      }

      keys.push(newKey)
      this.store.set('apiKeys', keys)
      
      console.log('✅ API Key和数据库凭证已保存')
      
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
