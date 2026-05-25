import { computed, onScopeDispose, ref, watch } from 'vue'
import { useWebSocket as _useWebSocket } from '@vueuse/core'

export interface UseWebSocketOptions {
  url: () => string | URL
  protocols?: string[] | string
  autoConnect?: boolean
  autoDisconnect?: boolean
  heartbeat?: {
    interval: number
    message?: string | (() => string)
    timeout?: number
    pongMessage?: string
  }
  reconnect?: {
    retries: number
    interval: number
    onFailed?: () => void
  }
}

type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'stateChange'

interface WebSocketEventCallback<T = unknown> {
  (data: T): void
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    protocols,
    autoConnect = true,
    autoDisconnect = true,
    heartbeat,
    reconnect,
  } = options

  const urlRef = typeof url === 'function' ? computed(url) : ref(url)

  const {
    data,
    status,
    open,
    close,
    send,
    ws,
  } = _useWebSocket(urlRef, {
    immediate: false,
    autoReconnect: reconnect ? { retries: reconnect.retries, delay: reconnect.interval, onFailed: reconnect.onFailed } : false,
  })

  const isConnected = computed(() => status.value === 'OPEN')
  const isConnecting = computed(() => status.value === 'CONNECTING')
  const isError = ref(false)

  const listeners = new Map<WebSocketEventType, Set<WebSocketEventCallback>>()

  function on(event: WebSocketEventType, callback: WebSocketEventCallback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(callback)
  }

  function once(event: WebSocketEventType, callback: WebSocketEventCallback) {
    const wrapper: WebSocketEventCallback = (data) => {
      callback(data)
      off(event, wrapper)
    }
    on(event, wrapper)
  }

  function off(event: WebSocketEventType, callback?: WebSocketEventCallback) {
    if (!callback) {
      listeners.delete(event)
      return
    }
    listeners.get(event)?.delete(callback)
  }

  function emit(event: WebSocketEventType, data?: unknown) {
    listeners.get(event)?.forEach(cb => cb(data))
  }

  watch(status, (newStatus, oldStatus) => {
    if (newStatus !== oldStatus) {
      if (newStatus === 'OPEN') {
        isError.value = false
        emit('open')
        emit('stateChange', 'connected')
      }
      else if (newStatus === 'CLOSED' && oldStatus === 'OPEN') {
        emit('close')
        emit('stateChange', 'disconnected')
      }
      else if (newStatus === 'CONNECTING') {
        emit('stateChange', 'connecting')
      }
    }
  })

  watch(data, (newData) => {
    if (newData) {
      try {
        const parsed = JSON.parse(newData as string)
        if (heartbeat?.pongMessage && parsed === heartbeat.pongMessage) {
          return
        }
        emit('message', parsed)
      }
      catch {
        emit('message', newData)
      }
    }
  })

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  function startHeartbeat() {
    if (!heartbeat || !isConnected.value)
      return

    stopHeartbeat()

    let heartbeatTimeoutTimer: number | null = null

    heartbeatTimer = setInterval(() => {
      if (!isConnected.value) {
        stopHeartbeat()
        return
      }

      const msg = typeof heartbeat.message === 'function' ? heartbeat.message() : (heartbeat.message ?? 'ping')

      try {
        send(msg)

        if (heartbeat.timeout) {
          if (heartbeatTimeoutTimer) {
            clearTimeout(heartbeatTimeoutTimer)
          }
          heartbeatTimeoutTimer = setTimeout(() => {
            if (isConnected.value) {
              close()
            }
          }, heartbeat.timeout) as unknown as number
        }
      }
      catch {
        close()
      }
    }, heartbeat.interval)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function connect() {
    open()
  }

  function disconnect() {
    stopHeartbeat()
    close()
  }

  function connectWithAutoCleanup() {
    connect()

    if (autoDisconnect) {
      onScopeDispose(disconnect)
    }
  }

  if (autoConnect) {
    connectWithAutoCleanup()
  }

  watch(isConnected, (connected) => {
    if (connected) {
      startHeartbeat()
    }
    else {
      stopHeartbeat()
    }
  }, { immediate: false })

  return {
    isConnected,
    isConnecting,
    isError,
    status,
    data,
    connect,
    disconnect,
    send,
    ws,
    on,
    off,
    once,
    emit,
  }
}
