/**
 * WebSocket 实时行情推送客户端
 */
import WebSocket from 'ws'
import { BrowserWindow } from 'electron'

export class TradingWebSocketClient {
  private ws: WebSocket | null = null
  private apiKey: string = ''
  private mainWindow: BrowserWindow
  private subscriptions: Set<string> = new Set()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  // 数据回调函数
  private dataCallback: ((message: any) => void) | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }
  
  // 设置数据回调
  setDataCallback(callback: (message: any) => void) {
    this.dataCallback = callback
  }

  // 连接 WebSocket
  connect(apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.apiKey = apiKey
      
      console.log('🔌 正在连接 WebSocket...')
      
      this.ws = new WebSocket('ws://61.151.241.233:8081/ws', {
        headers: {
          'X-API-Key': apiKey
        }
      })

      this.ws.on('open', () => {
        console.log('✅ WebSocket 连接成功')
        this.reconnectAttempts = 0
        
        // 选择 Pub/Sub 模式
        this.send({
          action: 'select_mode',
          mode: 'pubsub'
        })
        
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
        this.mainWindow.webContents.send('ws:error', error.message)
        reject(error)
      })

      this.ws.on('close', () => {
        console.log('🔌 WebSocket 连接关闭')
        this.stopHeartbeat()
        this.mainWindow.webContents.send('ws:disconnected')
        this.reconnect()
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
        // Pub/Sub 模式的数据
        // 注意：data 字段是 JSON 字符串，需要再次解析
        try {
          const actualData = JSON.parse(message.data)
          
          const dataMessage = {
            pattern: message.pattern,
            channel: message.channel,
            data: actualData,
            timestamp: message.timestamp
          }
          
          // 调用回调函数（如果设置了）
          if (this.dataCallback) {
            this.dataCallback(dataMessage)
          }
          
          // 也发送到渲染进程（用于实时显示）
          this.mainWindow.webContents.send('ws:data', dataMessage)
        } catch (error) {
          console.error('❌ 数据解析失败:', error, message.data)
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
        console.log('📨 未知消息类型:', message.type, message)
    }
  }

  // 订阅数据（支持简化格式）
  subscribe(patterns: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法订阅')
      return
    }

    console.log('📡 订阅数据:', patterns)
    
    this.send({
      action: 'subscribe',
      patterns: patterns
    })

    // 记录订阅（用于重连恢复）
    patterns.forEach(p => this.subscriptions.add(p))
  }

  // 取消订阅
  unsubscribe(patterns: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法取消订阅')
      return
    }

    console.log('🚫 取消订阅:', patterns)
    
    this.send({
      action: 'unsubscribe',
      patterns: patterns
    })

    // 移除记录
    patterns.forEach(p => this.subscriptions.delete(p))
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
        // 恢复订阅
        if (this.subscriptions.size > 0) {
          const patterns = Array.from(this.subscriptions)
          console.log('🔄 恢复订阅:', patterns)
          this.subscribe(patterns)
        }
      }).catch((error) => {
        console.error('❌ 重连失败:', error)
      })
    }, 3000) // 3秒后重连
  }

  // 断开连接
  disconnect() {
    console.log('🔌 主动断开 WebSocket 连接')
    
    this.stopHeartbeat()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.subscriptions.clear()
    this.reconnectAttempts = 0
  }

  // 获取连接状态
  getStatus(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
        return 'closing'
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'unknown'
    }
  }
}

// 单例实例
let wsClient: TradingWebSocketClient | null = null

export function getWebSocketClient(mainWindow: BrowserWindow): TradingWebSocketClient {
  if (!wsClient) {
    wsClient = new TradingWebSocketClient(mainWindow)
  }
  return wsClient
}

