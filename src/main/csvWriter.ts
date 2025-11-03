/**
 * CSV 流式写入器
 * 每个股票一个 CSV 文件，保存在独立文件夹中
 */
import * as fs from 'fs'
import * as path from 'path'

export class RealtimeCSVWriter {
  private folderPath: string
  private writingFolderPath: string  // 🆕 隐藏的写入文件夹
  private fileStreams: Map<string, fs.WriteStream> = new Map()
  private headers: string[] = []
  private fieldMapping: Map<string, string> = new Map()  // 英文名 → 中文名
  private rowCounts: Map<string, number> = new Map()
  private infoFilePath: string
  private previewTimer: NodeJS.Timeout | null = null  // 🆕 预览文件更新定时器

  constructor(folderPath: string, headers: string[], config: {
    sourceCode: string
    sourceName?: string
    symbols: string[]
    startTime: string
    fieldMapping?: Map<string, string>  // 🆕 字段名到中文名的映射
  }) {
    this.folderPath = folderPath
    this.headers = headers
    
    // 🆕 创建隐藏的写入文件夹
    this.writingFolderPath = path.join(folderPath, '.writing')
    
    // 保存字段映射（如果提供）
    if (config.fieldMapping) {
      this.fieldMapping = config.fieldMapping
    }

    // 创建文件夹
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true })
    }
    
    // 创建隐藏的写入文件夹
    if (!fs.existsSync(this.writingFolderPath)) {
      fs.mkdirSync(this.writingFolderPath, { recursive: true })
      console.log('📁 已创建隐藏写入文件夹:', this.writingFolderPath)
    }

    console.log('📁 CSV 写入器已创建，文件夹:', folderPath)
    
    // 立即创建订阅信息文件
    this.infoFilePath = path.join(folderPath, '订阅信息.txt')
    this.createInfoFile(config)
    
    // 🆕 启动预览文件更新定时器（每10秒复制一次）
    this.startPreviewUpdate()
  }
  
  // 🆕 启动预览文件更新
  private startPreviewUpdate() {
    // 立即执行一次（避免等待10秒）
    setTimeout(() => {
      this.updatePreviewFiles()
    }, 2000)  // 2秒后首次更新（给数据一点缓冲时间）
    
    // 然后每10秒更新一次
    this.previewTimer = setInterval(() => {
      this.updatePreviewFiles()
    }, 10000)
    
    console.log('⏰ 预览文件更新定时器已启动（首次2秒后，之后每10秒）')
  }
  
  // 🆕 更新所有预览文件
  private updatePreviewFiles() {
    try {
      for (const symbol of this.fileStreams.keys()) {
        const safeSymbol = symbol.replace(/[<>:"/\\|?*]/g, '_')
        const writingFile = path.join(this.writingFolderPath, `${safeSymbol}.csv`)
        const previewFile = path.join(this.folderPath, `${safeSymbol}.csv`)
        
        // 复制主文件到预览文件
        if (fs.existsSync(writingFile)) {
          fs.copyFileSync(writingFile, previewFile)
        }
      }
      
      console.log(`🔄 已更新 ${this.fileStreams.size} 个预览文件`)
    } catch (error) {
      console.error('❌ 更新预览文件失败:', error)
    }
  }

  // 创建订阅信息文件
  private createInfoFile(config: {
    sourceCode: string
    sourceName?: string
    symbols: string[]
    startTime: string
  }) {
    const infoContent = [
      '=' .repeat(60),
      '  实时订阅信息',
      '=' .repeat(60),
      '',
      `订阅时间: ${config.startTime}`,
      `数据源: ${config.sourceCode}${config.sourceName ? ' - ' + config.sourceName : ''}`,
      `订阅范围: ${config.symbols.length > 0 ? config.symbols.join(', ') : '全部股票'}`,
      `订阅字段: ${this.headers.join(', ')}`,
      '',
      '=' .repeat(60),
      `文件夹路径: ${this.folderPath}`,
      '文件格式: CSV (逗号分隔，UTF-8编码)',
      '',
      '📖 使用说明：',
      '─'.repeat(60),
      '• 每个股票/合约的数据保存在独立的 CSV 文件中',
      '• 您可以随时打开 CSV 文件查看数据（不会影响写入）',
      '• 预览文件每10秒自动更新一次',
      '• 在 Excel 中手动刷新或重新打开，即可看到最新数据',
      '',
      '⚠️ 文件说明：',
      '─'.repeat(60),
      '• 您看到的 CSV 文件是预览文件（可随时打开）',
      '• 主文件在隐藏的 .writing 文件夹中实时写入',
      '• 停止订阅后，所有数据会同步到预览文件',
      '',
      '=' .repeat(60),
      `状态: 等待数据接收...`,
      `创建时间: ${new Date().toLocaleString('zh-CN')}`,
      ''
    ].join('\n')

    fs.writeFileSync(this.infoFilePath, infoContent, 'utf-8')
    console.log('📄 已创建订阅信息文件')
  }

  // 为股票创建 CSV 文件（如果不存在）
  private ensureCSVFile(symbol: string): fs.WriteStream {
    if (!this.fileStreams.has(symbol)) {
      console.log(`📄 创建 CSV 文件: ${symbol}.csv`)
      
      // 清理股票代码中的特殊字符（避免文件名问题）
      const safeSymbol = symbol.replace(/[<>:"/\\|?*]/g, '_')
      
      // 🔑 主文件写入到隐藏文件夹
      const csvPath = path.join(this.writingFolderPath, `${safeSymbol}.csv`)
      
      // 创建写入流
      const stream = fs.createWriteStream(csvPath, { flags: 'a', encoding: 'utf-8' })
      
      // 🔑 写入 UTF-8 BOM（避免 Excel 打开时乱码）
      stream.write('\uFEFF')
      
      // 🔑 写入表头（中文名(英文名)格式）
      const headerLine = this.headers.map(field => {
        const cnName = this.fieldMapping.get(field)
        return cnName ? `${cnName}(${field})` : field
      }).join(',') + '\n'
      stream.write(headerLine)
      
      this.fileStreams.set(symbol, stream)
      this.rowCounts.set(symbol, 0)
    }

    return this.fileStreams.get(symbol)!
  }

  // 追加一行数据
  appendRow(symbol: string, data: Record<string, any>) {
    try {
      const stream = this.ensureCSVFile(symbol)

      // 按 headers 顺序提取数据
      const values = this.headers.map(header => {
        let value = data[header] ?? ''
        
        // 🔑 格式化时间戳为本地时间
        if (typeof value === 'number' && value > 1000000000000 && value < 9999999999999) {
          const date = new Date(value)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hour = String(date.getHours()).padStart(2, '0')
          const minute = String(date.getMinutes()).padStart(2, '0')
          const second = String(date.getSeconds()).padStart(2, '0')
          value = `${year}-${month}-${day} ${hour}:${minute}:${second}`
        }
        
        // 🔑 处理数组和对象类型 - JSON序列化
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value)
        }
        
        // 转换为字符串
        value = String(value)
        
        // 🔑 修复时间格式：将点号时间转换为冒号时间
        // 例如：11.12.09.123 → 11:12:09.123
        if (/^\d{1,2}\.\d{2}\.\d{2}/.test(value)) {
          value = value.replace(/\./g, ':')
        }
        
        // 🔑 时间字段特殊处理：强制Excel识别为文本
        // 对于 HH:MM:SS 格式的时间，在前面加上单引号撇号，让Excel保持原样显示
        if (/^\d{1,2}:\d{2}:\d{2}/.test(value)) {
          value = `'${value}`
        }
        
        // 处理包含逗号、引号、换行的值（CSV 转义）
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`  // 引号转义
        }
        
        return value
      })

      // 写入一行（逗号分隔）
      const line = values.join(',') + '\n'
      stream.write(line)

      // 更新行数统计
      const count = this.rowCounts.get(symbol) || 0
      this.rowCounts.set(symbol, count + 1)
    } catch (error) {
      console.error(`❌ 写入 CSV 失败 [${symbol}]:`, error)
      throw error
    }
  }

  // 获取统计信息
  getStats(): { symbol: string; count: number }[] {
    return Array.from(this.rowCounts.entries()).map(([symbol, count]) => ({
      symbol,
      count
    }))
  }

  // 获取总行数
  getTotalRows(): number {
    return Array.from(this.rowCounts.values()).reduce((sum, count) => sum + count, 0)
  }

  // 更新订阅信息文件（添加统计）
  updateInfoFile(stats: { totalReceived: number; runningTime: number; status: string }) {
    try {
      const content = fs.readFileSync(this.infoFilePath, 'utf-8')
      
      // 更新最后的状态行
      const lines = content.split('\n')
      const statusIndex = lines.findIndex(line => line.startsWith('状态:'))
      
      if (statusIndex !== -1) {
        lines[statusIndex] = `状态: ${stats.status}`
        
        // 添加统计信息
        const existingStatsIndex = lines.findIndex(line => line.startsWith('已接收:'))
        const statsLines = [
          `已接收: ${stats.totalReceived} 条`,
          `运行时间: ${this.formatTime(stats.runningTime)}`,
          `更新时间: ${new Date().toLocaleString('zh-CN')}`
        ]
        
        if (existingStatsIndex !== -1) {
          // 替换已有统计
          lines.splice(existingStatsIndex, 3, ...statsLines)
        } else {
          // 添加新统计
          lines.push('')
          lines.push(...statsLines)
        }
        
        fs.writeFileSync(this.infoFilePath, lines.join('\n'), 'utf-8')
      }
    } catch (error) {
      console.error('更新订阅信息文件失败:', error)
    }
  }

  // 格式化时间
  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // 关闭所有文件流
  async close(): Promise<void> {
    console.log('💾 正在关闭 CSV 文件...')
    
    // 🆕 停止预览文件更新定时器
    if (this.previewTimer) {
      clearInterval(this.previewTimer)
      this.previewTimer = null
      console.log('⏰ 预览文件更新定时器已停止')
    }
    
    // 关闭所有 CSV 文件流
    for (const [symbol, stream] of this.fileStreams.entries()) {
      stream.end()
      console.log(`✅ 已关闭: ${symbol}.csv`)
    }
    
    this.fileStreams.clear()
    
    // 🆕 最后一次更新预览文件（确保数据完整）
    console.log('🔄 执行最后一次预览文件更新...')
    this.updatePreviewFiles()
    
    // 更新订阅信息文件状态
    this.updateInfoFile({
      totalReceived: this.getTotalRows(),
      runningTime: 0,
      status: '订阅已完成'
    })
    
    console.log('✅ CSV 文件保存完成:', this.folderPath)
  }

  // 获取保存路径
  getSavePath(): string {
    return this.folderPath
  }
}

