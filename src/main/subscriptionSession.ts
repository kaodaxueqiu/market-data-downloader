/**
 * 实时订阅会话（使用全局 WebSocket 管理器）
 */
import { WebSocketManager } from './websocketManager'
import { RealtimeCSVWriter } from './csvWriter'
import { BrowserWindow } from 'electron'

interface SubscriptionConfig {
  sourceCode: string      // 数据源编码（如 ZZ-01）
  sourceName?: string     // 数据源名称
  symbols: string[]       // 股票代码列表（空数组表示订阅全部）
  fields: string[]        // 要订阅的字段（英文名）
  fieldObjects?: any[]    // 🆕 字段对象列表（包含中文名）
  savePath: string        // 保存文件夹路径
}

export class SubscriptionSession {
  private wsManager: WebSocketManager
  private csvWriter: RealtimeCSVWriter | null = null
  private config: SubscriptionConfig | null = null
  private patterns: string[] = []  // 当前订阅的 patterns
  private isSubscribing = false    // 订阅状态
  private startTime: number = 0
  private totalReceived = 0
  private dataRate = 0 // 数据接收速率（条/秒）
  private fieldMapping: Map<string, string> = new Map()  // 🆕 英文名 → 中文名映射
  
  // 数据处理器（绑定到实例）
  private dataHandler = this.handleData.bind(this)

  constructor(
    private mainWindow: BrowserWindow,
    private apiKey: string
  ) {
    this.wsManager = WebSocketManager.getInstance(mainWindow)
  }

  // 开始订阅（自动连接 + 订阅）
  async start(config: SubscriptionConfig): Promise<void> {
    if (this.isSubscribing) {
      throw new Error('订阅已在进行中')
    }

    console.log('🚀 启动订阅任务:', config)
    
    this.config = config
    this.isSubscribing = true
    this.startTime = Date.now()
    this.totalReceived = 0

    // 1. 确保 WebSocket 已连接
    await this.wsManager.connect(this.apiKey)

    // 2. 创建字段映射（英文名 → 中文名）
    this.fieldMapping.clear()
    if (config.fieldObjects) {
      config.fieldObjects.forEach((field: any) => {
        if (field.name && field.cn_name) {
          this.fieldMapping.set(field.name, field.cn_name)
        }
      })
    }

    // 3. 创建 CSV 写入器（不额外添加接收时间，用户可以自己选择）
    const csvHeaders = [...config.fields]
    this.csvWriter = new RealtimeCSVWriter(config.savePath, csvHeaders, {
      sourceCode: config.sourceCode,
      sourceName: config.sourceName,
      symbols: config.symbols,
      startTime: new Date().toLocaleString('zh-CN'),
      fieldMapping: this.fieldMapping  // 🔑 传递字段映射
    })

    // 3. 构建订阅 patterns
    this.patterns = this.buildSubscriptionPatterns(config.sourceCode, config.symbols)
    
    console.log('📡 订阅 patterns:', this.patterns)

    // 4. 订阅数据（使用全局 WebSocket 管理器）
    this.wsManager.subscribe(this.patterns, this.dataHandler)

    console.log('✅ 订阅任务已启动')
  }

  // 停止订阅
  async stop(): Promise<string> {
    if (!this.isSubscribing) {
      throw new Error('当前未在订阅中')
    }

    console.log('⏸ 停止订阅任务...')

    this.isSubscribing = false

    // 1. 从 WebSocket 管理器取消订阅
    if (this.patterns.length > 0) {
      this.wsManager.unsubscribe(this.patterns, this.dataHandler)
    }

    // 2. 保存并关闭 CSV 文件
    let savedPath = ''
    if (this.csvWriter) {
      await this.csvWriter.close()
      savedPath = this.csvWriter.getSavePath()
      this.csvWriter = null
    }

    console.log('✅ 订阅任务已停止，数据已保存:', savedPath)
    console.log(`📊 总计接收 ${this.totalReceived} 条数据`)

    return savedPath
  }

  // 清理资源（任务被删除时调用）
  cleanup() {
    console.log('🧹 清理订阅任务资源...')
    
    // 如果还在订阅，先停止
    if (this.isSubscribing) {
      if (this.patterns.length > 0) {
        this.wsManager.unsubscribe(this.patterns, this.dataHandler)
      }
      if (this.csvWriter) {
        this.csvWriter.close().catch(console.error)
        this.csvWriter = null
      }
      this.isSubscribing = false
    }
    
    console.log('✅ 订阅任务资源已清理')
  }

  // 构建订阅模式
  private buildSubscriptionPatterns(sourceCode: string, symbols: string[]): string[] {
    // 🔑 K线数据特殊处理（Redis Key 格式：KLINE-1M/ZZ-XXXX/...）
    // 注意：K线的channel没有日期时间后缀，所以不需要通配符
    if (sourceCode === 'ZZ-5001' || sourceCode === 'ZZ-6001') {
      if (symbols.length === 0) {
        // 订阅全部K线
        const pattern = `KLINE-1M/${sourceCode}/*`
        console.log('📊 K线数据订阅全部:', pattern)
        return [pattern]
      } else {
        // 订阅指定股票/合约的K线（不带通配符后缀！）
        const patterns = symbols.map(symbol => `KLINE-1M/${sourceCode}/${symbol}`)
        console.log('📊 K线数据订阅指定:', patterns)
        return patterns
      }
    }
    
    // 普通数据源（DECODED/ZZ-XX/...）
    // 注意：后端会将订阅pattern规范化为 DECODED/ZZ-XX/SYMBOL/*
    // 所以前端注册handler时也要使用相同的pattern，否则收不到数据
    if (symbols.length === 0) {
      // 订阅全部
      return [`DECODED/${sourceCode}/*`]
    } else {
      // 订阅指定股票（使用通配符后缀，匹配所有时间戳的数据）
      return symbols.map(symbol => `DECODED/${sourceCode}/${symbol}/*`)
    }
  }

  // 处理接收到的数据
  handleData(message: any) {
    if (!this.isSubscribing || !this.csvWriter || !this.config) {
      console.log('⚠️ 跳过数据处理: isSubscribing=', this.isSubscribing, 'csvWriter=', !!this.csvWriter, 'config=', !!this.config)
      return
    }

    try {
      console.log('\n📥 收到消息:', {
        pattern: message.pattern,
        channel: message.channel,
        dataType: typeof message.data
      })
      
      let data = message.data
      
      // 🔑 检查数据嵌套结构
      if (data && typeof data === 'object') {
        console.log('📦 数据是对象，检查嵌套结构...')
        console.log('   有 payload?', !!data.payload)
        console.log('   有 key?', !!data.key)
        console.log('   有 data?', !!data.data)
        console.log('   data.data类型:', typeof data.data)
        
        // Stream 模式 1：有 payload 字段
        if (data.payload) {
          try {
            data = JSON.parse(data.payload)
            console.log('📦 Stream payload 模式解析成功')
          } catch (error) {
            console.error('❌ Stream payload 解析失败:', error)
            return
          }
        }
        // 嵌套结构：有 key 和 data 字段（实际数据在 data 对象中）
        else if (data.key && data.data && typeof data.data === 'object') {
          console.log('📦 检测到K线嵌套结构，提取 data.data')
          console.log('   原始data.key:', data.key)
          console.log('   原始data.data字段:', Object.keys(data.data))
          data = data.data  // 🔑 提取嵌套的 data 对象
          console.log('📦 提取后的数据字段:', Object.keys(data))
        } else {
          console.log('📦 没有嵌套，直接使用数据')
        }
      }
      
      // 提取股票代码（某些数据源如ZZ-111可能没有代码字段）
      let symbol = this.extractSymbol(data, message.channel || message.key)
      
      if (!symbol) {
        // 提取不到代码时使用默认值，而不是丢弃数据
        symbol = 'UNKNOWN'
        console.warn('⚠️  无法提取代码，使用默认值: UNKNOWN')
        console.warn('   Channel:', message.channel)
        console.warn('   数据源:', this.config.sourceCode)
      } else {
        console.log(`✅ 提取代码成功: ${symbol}，准备写入CSV`)
      }

      // 🔍 调试：打印第一条数据的结构（只打印一次）
      if (this.totalReceived === 0) {
        console.log('📊 收到第一条数据，数据结构:', data)
        console.log('📋 数据字段:', Object.keys(data))
        console.log('🎯 订阅字段（英文名）:', this.config.fields)
        console.log('🔤 字段映射（英文→中文）:', Array.from(this.fieldMapping.entries()))
      }

      // 提取字段数据（按用户选择的字段顺序）
      const rowData: Record<string, any> = {}
      
      this.config.fields.forEach(field => {
        // 🔑 关键修复：同时支持中文和英文字段名
        // 1. 先尝试用英文名（ZZ-5001, ZZ-6001等K线数据用英文）
        // 2. 再尝试用中文名（ZZ-01, ZZ-31等快照数据用中文）
        // 3. 最后用智能查找
        const chineseFieldName = this.fieldMapping.get(field) || field
        const value = data[field] ?? data[chineseFieldName] ?? this.findFieldValue(data, field)
        rowData[field] = value ?? '-'
        
        // 调试：如果值是 undefined，打印日志
        if (value === undefined && this.totalReceived < 5) {
          console.warn(`⚠️ 字段 "${field}"（中文名："${chineseFieldName}"）未找到`)
          console.warn('   数据keys:', Object.keys(data))
        }
      })

      // 🔑 接收时间字段已在上面的字段提取中处理，不需要额外添加

      // 写入 CSV
      this.csvWriter.appendRow(symbol, rowData)
      console.log(`📝 已写入CSV: ${symbol}, 第 ${this.totalReceived + 1} 条数据`)

      // 更新统计
      this.totalReceived++
      
      // 计算接收速率
      const elapsed = (Date.now() - this.startTime) / 1000
      this.dataRate = elapsed > 0 ? Math.round(this.totalReceived / elapsed) : 0

      // 每100条数据向渲染进程发送一次统计更新
      if (this.totalReceived % 100 === 0) {
        this.sendStats()
      }

    } catch (error) {
      console.error('❌ 处理数据失败:', error, message)
    }
  }

  // 从数据中查找字段值（兼容中英文字段名）
  private findFieldValue(data: any, field: string): any {
    // 尝试各种可能的key
    const possibleKeys = [
      field,
      field.toLowerCase(),
      field.toUpperCase(),
      // 如果field是中文，尝试在括号中查找英文
      ...Object.keys(data).filter(k => k.includes(field))
    ]

    for (const key of possibleKeys) {
      if (data.hasOwnProperty(key)) {
        return data[key]
      }
    }

    return undefined
  }

  // 提取股票代码（从数据或channel中）
  private extractSymbol(data: any, channel: string): string | null {
    // 1. 从数据中提取（支持多种命名格式）
    if (data.symbol) return data.symbol
    if (data.证券代码) return data.证券代码
    if (data.security_id) return data.security_id
    if (data.stockCode) return data.stockCode
    if (data.contractCode) return data.contractCode  // 驼峰
    if (data.contract_code) return data.contract_code  // 下划线

    // 2. 从 channel 中提取（K线数据必定能从channel提取）
    // channel 格式: 
    //   KLINE-1M/ZZ-5001/SZ.000001/...
    //   KLINE-1M/ZZ-6001/SHFE.FU2609/...
    //   DECODED/ZZ-01/SZ.000001/...
    
    // 🔑 先尝试K线格式：KLINE-1M/ZZ-XXXX/SYMBOL/...
    let match = channel.match(/KLINE-1M\/ZZ-\d+\/([^/]+)/)
    if (match) {
      console.log(`✅ 从K线channel提取股票代码: ${match[1]}`)
      return match[1]  // 返回 SZ.000001 或 SHFE.FU2609
    }
    
    // 再尝试快照格式：DECODED/ZZ-XX/SYMBOL/...
    match = channel.match(/DECODED\/ZZ-\d+\/([^/]+)/)
    if (match) {
      console.log(`✅ 从DECODED channel提取股票代码: ${match[1]}`)
      return match[1]
    }
    
    // 最后尝试通用格式
    match = channel.match(/\/((?:SZ|SH|SZSE|SSE|SHFE|DCE|CZCE|CFFEX|INE|GFEX)\.[^/]+)/)
    if (match) {
      console.log(`✅ 从通用格式提取股票代码: ${match[1]}`)
      return match[1]
    }

    // 3. 如果都没找到，打印详细日志
    console.error('❌ 无法提取股票代码!')
    console.error('   Channel:', channel)
    console.error('   数据字段:', Object.keys(data))
    console.error('   stockCode:', data.stockCode)
    console.error('   contractCode:', data.contractCode)
    console.error('   证券代码:', data.证券代码)

    return null
  }

  // 发送统计信息到渲染进程
  private sendStats() {
    const stats = {
      totalReceived: this.totalReceived,
      dataRate: this.dataRate,
      runningTime: Math.round((Date.now() - this.startTime) / 1000),
      symbolStats: this.csvWriter?.getStats() || []
    }

    this.mainWindow.webContents.send('ws:stats', stats)
    
    // 同时更新订阅信息文件
    if (this.csvWriter) {
      this.csvWriter.updateInfoFile({
        totalReceived: this.totalReceived,
        runningTime: Math.round((Date.now() - this.startTime) / 1000),
        status: '订阅中...'
      })
    }
  }


  // 获取会话状态
  getStatus() {
    return {
      isSubscribing: this.isSubscribing,
      wsStatus: this.wsManager.getStatus(),
      totalReceived: this.totalReceived,
      dataRate: this.dataRate,
      runningTime: this.isSubscribing ? Math.round((Date.now() - this.startTime) / 1000) : 0,
      patterns: this.patterns
    }
  }
}

