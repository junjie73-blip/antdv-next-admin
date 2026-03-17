import type { WebSocketEventCallback, WebSocketEventHandlers, WebSocketEventType, WebSocketOptions } from './types'
import { computed, onUnmounted, readonly, ref } from 'vue'
import { DEFAULT_HEARTBEAT_CONFIG, DEFAULT_WEBSOCKET_OPTIONS } from './constants'
import { EventManager } from './EventManager'
import { HeartbeatManager } from './HeartbeatManager'
import { ReconnectManager } from './ReconnectManager'
import { WebSocketStateManager } from './WebSocketStateManager'

export function useWebSocket(options: WebSocketOptions) {
  const finalOptions = { ...DEFAULT_WEBSOCKET_OPTIONS, ...options }

  const stateManager = new WebSocketStateManager()
  const eventManager = new EventManager()
  const readyState = readonly(stateManager.getStateRef())
  const reconnectAttempts = ref(0)

  const send = (data: string | ArrayBuffer | Blob) => {
    const ws = stateManager.getWebSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected')
      return false
    }

    try {
      ws.send(data)
      return true
    }
    catch (error) {
      console.error('Failed to send message:', error)
      return false
    }
  }

  const heartbeatManager = new HeartbeatManager(
    {
      interval: finalOptions.heartbeatInterval!,
      timeout: finalOptions.heartbeatTimeout!,
      message: DEFAULT_HEARTBEAT_CONFIG.message,
    },
    (message) => {
      send(message)
    },
  )
  const reconnectManager = new ReconnectManager({
    enabled: finalOptions.reconnectEnabled!,
    interval: finalOptions.reconnectInterval!,
    maxAttempts: finalOptions.maxReconnectAttempts!,
    delayMultiplier: finalOptions.reconnectDelayMultiplier!,
    maxDelay: finalOptions.maxReconnectDelay!,
  })

  const connect = () => {
    if (stateManager.isConnecting() || stateManager.isConnected()) {
      return
    }

    stateManager.setState('connecting' as any)
    eventManager.emit('stateChange' as any, 'connecting' as any)

    try {
      const ws = new WebSocket(finalOptions.url, finalOptions.protocols)
      stateManager.setWebSocket(ws)

      ws.onopen = (event) => {
        stateManager.setState('connected' as any)
        eventManager.emit('stateChange' as any, 'connected' as any)
        eventManager.emit('open' as any, event)

        reconnectManager.reset()
        reconnectAttempts.value = 0

        heartbeatManager.start()
      }

      ws.onclose = (event) => {
        stateManager.setState('disconnected' as any)
        eventManager.emit('stateChange' as any, 'disconnected' as any)
        eventManager.emit('close' as any, event)

        heartbeatManager.stop()

        if (reconnectManager.isEnabled() && !reconnectManager.hasReachedMaxAttempts()) {
          reconnectManager.start()
        }
      }

      ws.onerror = (event) => {
        stateManager.setState('error' as any)
        eventManager.emit('stateChange' as any, 'error' as any)
        eventManager.emit('error' as any, event)
      }

      ws.onmessage = (event) => {
        eventManager.emit('message' as any, event.data)
      }
    }
    catch (error) {
      stateManager.setState('error' as any)
      eventManager.emit('stateChange' as any, 'error' as any)
      eventManager.emit('error' as any, error as any)
    }
  }

  const disconnect = () => {
    reconnectManager.stop()
    heartbeatManager.stop()
    stateManager.clearWebSocket()
    stateManager.setState('disconnected' as any)
    eventManager.emit('stateChange' as any, 'disconnected' as any)
  }

  const on = <T = unknown>(eventType: WebSocketEventType, callback: WebSocketEventCallback<T>) => {
    return eventManager.on(eventType, callback)
  }

  const once = <T = unknown>(eventType: WebSocketEventType, callback: WebSocketEventCallback<T>) => {
    return eventManager.once(eventType, callback)
  }

  const off = (eventType: WebSocketEventType, callback?: WebSocketEventCallback) => {
    eventManager.off(eventType, callback)
  }

  const registerHandlers = (handlers: WebSocketEventHandlers) => {
    return eventManager.registerHandlers(handlers)
  }

  const reconnect = () => {
    reconnectManager.reset()
    reconnectAttempts.value = 0
    disconnect()
    connect()
  }

  reconnectManager.setReconnectCallback(() => {
    reconnectAttempts.value = reconnectManager.getCurrentAttempt()
    connect()
  })

  reconnectManager.setMaxAttemptsReachedCallback(() => {
    console.warn('Max reconnect attempts reached')
  })

  heartbeatManager.setTimeoutCallback(() => {
    console.warn('Heartbeat timeout, closing connection')
    disconnect()
  })

  onUnmounted(() => {
    disconnect()
    eventManager.removeAllListeners()
  })

  return {
    connect,
    disconnect,
    send,
    on,
    once,
    off,
    registerHandlers,
    reconnect,
    readyState,
    isConnected: computed(() => stateManager.isConnected()),
    isConnecting: computed(() => stateManager.isConnecting()),
    isDisconnected: computed(() => stateManager.isDisconnected()),
    isError: computed(() => stateManager.isError()),
    reconnectAttempts: readonly(reconnectAttempts),
  }
}
