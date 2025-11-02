/**
 * WebSocket 全局管理器（单例模式）
 * 所有订阅任务共享同一个 WebSocket 连接
 */
import WebSocket from 'ws'
import { BrowserWindow } from 'electron'

type MessageHandler = (message: any) => void

export class WebSocketManager {
  private static instance: WebSocketManager | null = null
  private ws: WebSocket | null = null
  private apiKey: string = ''
  private mainWindow: BrowserWindow
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private isConnecting = false
  private manualDisconnect = false  // 🆕 标记是否为主动断开
  
  // 消息处理器（按 pattern 订阅）
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  
  // 活跃的订阅 patterns
  private activePatterns: Set<string> = new Set()

  private constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  // 获取单例
  static getInstance(mainWindow: BrowserWindow): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager(mainWindow)
    }
    return WebSocketManager.instance
  }

  // 连接 WebSocket
  async connect(apiKey: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket 已连接，无需重复连接')
      return
    }

    if (this.isConnecting) {
      console.log('⏳ WebSocket 正在连接中，请稍候...')
      // 等待连接完成
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval)
            if (this.ws?.readyState === WebSocket.OPEN) {
              resolve()
            } else {
              reject(new Error('连接失败'))
            }
          }
        }, 100)
      })
    }

    return new Promise((resolve, reject) => {
      this.apiKey = apiKey
      this.isConnecting = true
      
      console.log('🔌 正在连接 WebSocket 总线...')
      
      this.ws = new WebSocket('ws://61.151.241.233:8081/ws', {
        headers: { 'X-API-Key': apiKey }
      })

      this.ws.on('open', () => {
        console.log('✅ WebSocket 总线连接成功')
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.manualDisconnect = false  // 重置主动断开标志
        
        // 选择 Pub/Sub 模式
        this.send({ action: 'select_mode', mode: 'pubsub' })
        
        // 启动心跳
        this.startHeartbeat()
        
        // 通知渲染进程
        this.mainWindow.webContents.send('ws:connected')
        
        resolve()
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(message)
        } catch (error) {
          console.error('❌ 消息解析失败:', error)
        }
      })

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket 错误:', error)
        this.isConnecting = false
        this.mainWindow.webContents.send('ws:error', error.message)
        reject(error)
      })

      this.ws.on('close', () => {
        console.log('🔌 WebSocket 总线连接关闭')
        this.isConnecting = false
        this.stopHeartbeat()
        this.mainWindow.webContents.send('ws:disconnected')
        
        // 只有非主动断开时才重连
        if (!this.manualDisconnect) {
          console.log('🔄 检测到异常断开，准备重连...')
          this.reconnect()
        } else {
          console.log('✅ 主动断开，不重连')
        }
      })
    })
  }

  // 处理消息
  private handleMessage(message: any) {
    switch (message.type) {
      case 'mode_selected':
        console.log('📌 模式已选择:', message.data.mode)
        this.mainWindow.webContents.send('ws:mode_selected', message.data)
        break

      case 'subscribed':
        console.log('✅ 订阅成功:', message.data)
        this.mainWindow.webContents.send('ws:subscribed', message.data)
        break

      case 'unsubscribed':
        console.log('✅ 取消订阅成功:', message.data)
        this.mainWindow.webContents.send('ws:unsubscribed', message.data)
        break

      case 'data':
        // 解析数据并分发给订阅了该 pattern 的处理器
        try {
          const actualData = JSON.parse(message.data)
          
          const dataMessage = {
            pattern: message.pattern,
            channel: message.channel,
            data: actualData,
            timestamp: message.timestamp
          }
          
          // 分发给所有订阅了该 pattern 的处理器
          this.dispatchMessage(message.pattern, dataMessage)
          
          // 也发送到渲染进程
          this.mainWindow.webContents.send('ws:data', dataMessage)
        } catch (error) {
          console.error('❌ 数据解析失败:', error)
        }
        break

      case 'error':
        console.error('❌ 服务器错误:', message)
        this.mainWindow.webContents.send('ws:server_error', message)
        break

      case 'pong':
        // 心跳响应
        break

      default:
        console.log('📨 未知消息类型:', message.type)
    }
  }

  // 分发消息给订阅者
  private dispatchMessage(pattern: string, message: any) {
    // 找到匹配的 pattern（支持通配符匹配）
    for (const [subscribedPattern, handlers] of this.handlers.entries()) {
      if (this.patternMatches(pattern, subscribedPattern)) {
        handlers.forEach(handler => {
          try {
            handler(message)
          } catch (error) {
            console.error('❌ 消息处理器错误:', error)
          }
        })
      }
    }
  }

  // Pattern 匹配（简单实现）
  private patternMatches(actualPattern: string, subscribedPattern: string): boolean {
    // 精确匹配
    if (actualPattern === subscribedPattern) return true
    
    // 通配符匹配
    if (subscribedPattern.endsWith('/*')) {
      const prefix = subscribedPattern.slice(0, -2)
      return actualPattern.startsWith(prefix)
    }
    
    return false
  }

  // 订阅（添加 patterns）
  subscribe(patterns: string[], handler: MessageHandler) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法订阅')
      return
    }

    console.log('📡 订阅 patterns:', patterns)
    
    // 发送订阅消息
    this.send({
      action: 'subscribe',
      patterns: patterns
    })

    // 注册消息处理器
    patterns.forEach(pattern => {
      if (!this.handlers.has(pattern)) {
        this.handlers.set(pattern, new Set())
      }
      this.handlers.get(pattern)!.add(handler)
      this.activePatterns.add(pattern)
    })
  }

  // 取消订阅
  unsubscribe(patterns: string[], handler: MessageHandler) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法取消订阅')
      return
    }

    console.log('🚫 取消订阅:', patterns)
    
    // 移除处理器
    patterns.forEach(pattern => {
      const handlers = this.handlers.get(pattern)
      if (handlers) {
        handlers.delete(handler)
        
        // 如果该 pattern 没有处理器了，从服务器取消订阅
        if (handlers.size === 0) {
          this.handlers.delete(pattern)
          this.activePatterns.delete(pattern)
          
          // 发送取消订阅消息
          this.send({
            action: 'unsubscribe',
            patterns: [pattern]
          })
        }
      }
    })
  }

  // 发送消息
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️ WebSocket 未连接，消息未发送')
    }
  }

  // 启动心跳
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ action: 'ping' })
    }, 30000) // 30秒
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // 重连
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ 重连次数超限，停止重连')
      this.mainWindow.webContents.send('ws:reconnect_failed')
      return
    }

    this.reconnectAttempts++
    
    console.log(`🔄 尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.apiKey).then(() => {
        // 恢复所有订阅
        if (this.activePatterns.size > 0) {
          const patterns = Array.from(this.activePatterns)
          console.log('🔄 恢复订阅:', patterns)
          this.send({
            action: 'subscribe',
            patterns: patterns
          })
        }
      }).catch((error) => {
        console.error('❌ 重连失败:', error)
      })
    }, 3000) // 3秒后重连
  }

  // 断开连接（只有在没有活跃订阅时才真正断开）
  disconnect() {
    if (this.activePatterns.size > 0) {
      console.warn('⚠️ 仍有活跃订阅，不断开 WebSocket 连接')
      return
    }

    console.log('🔌 主动断开 WebSocket 总线连接')
    
    this.manualDisconnect = true  // 🔑 设置主动断开标志
    this.stopHeartbeat()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.handlers.clear()
    this.activePatterns.clear()
    this.reconnectAttempts = 0
  }

  // 强制断开（不管订阅）
  forceDisconnect() {
    console.log('🔌 强制断开 WebSocket 总线连接')
    
    this.manualDisconnect = true  // 🔑 设置主动断开标志
    this.stopHeartbeat()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.handlers.clear()
    this.activePatterns.clear()
    this.reconnectAttempts = 0
  }

  // 获取连接状态
  getStatus(): 'disconnected' | 'connecting' | 'connected' {
    if (this.isConnecting) return 'connecting'
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.OPEN:
        return 'connected'
      default:
        return 'disconnected'
    }
  }

  // 获取统计信息
  getStats() {
    return {
      status: this.getStatus(),
      activePatterns: Array.from(this.activePatterns),
      activeTaskCount: this.handlers.size,
      reconnectAttempts: this.reconnectAttempts
    }
  }
}

