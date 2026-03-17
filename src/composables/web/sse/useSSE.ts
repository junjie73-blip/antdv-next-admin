import type { SSEEventCallback, SSEEventHandlers, SSEEventType, SSEOptions } from './types'
import { computed, onUnmounted, readonly, ref } from 'vue'
import { DEFAULT_SSE_OPTIONS } from './constants'
import { SSEEventManager } from './SSEEventManager'
import { SSEReconnectManager } from './SSEReconnectManager'
import { SSEStateManager } from './SSEStateManager'

export function useSSE(options: SSEOptions) {
  const finalOptions = { ...DEFAULT_SSE_OPTIONS, ...options }

  const stateManager = new SSEStateManager()
  const eventManager = new SSEEventManager()
  const reconnectManager = new SSEReconnectManager({
    enabled: finalOptions.reconnectEnabled!,
    interval: finalOptions.reconnectInterval!,
    maxAttempts: finalOptions.maxReconnectAttempts!,
    delayMultiplier: finalOptions.reconnectDelayMultiplier!,
    maxDelay: finalOptions.maxReconnectDelay!,
  })

  const readyState = readonly(stateManager.getStateRef())
  const reconnectAttempts = ref(0)
  const lastEventId = ref<string | null>(null)

  const disconnect = () => {
    reconnectManager.stop()
    stateManager.clearEventSource()
    stateManager.setState('disconnected' as any)
    eventManager.emit('stateChange' as any, 'disconnected' as any)
    eventManager.emit('close' as any, new Event('close'))
  }

  const connect = () => {
    if (stateManager.isConnecting() || stateManager.isConnected()) {
      return
    }

    stateManager.setState('connecting' as any)
    eventManager.emit('stateChange' as any, 'connecting' as any)

    try {
      let url = finalOptions.url

      if (lastEventId.value) {
        const separator = url.includes('?') ? '&' : '?'
        url = `${url}${separator}lastEventId=${encodeURIComponent(lastEventId.value)}`
      }

      const eventSource = new EventSource(url, {
        withCredentials: finalOptions.withCredentials,
      })

      stateManager.setEventSource(eventSource)

      eventSource.onopen = (event) => {
        stateManager.setState('connected' as any)
        eventManager.emit('stateChange' as any, 'connected' as any)
        eventManager.emit('open' as any, event)

        reconnectManager.reset()
        reconnectAttempts.value = 0
      }

      eventSource.onerror = (event) => {
        stateManager.setState('error' as any)
        eventManager.emit('stateChange' as any, 'error' as any)
        eventManager.emit('error' as any, event)

        if (reconnectManager.isEnabled() && !reconnectManager.hasReachedMaxAttempts()) {
          reconnectManager.start()
        }
        else {
          disconnect()
        }
      }

      eventSource.onmessage = (event) => {
        lastEventId.value = event.lastEventId

        if (event.data === '') {
          return
        }

        eventManager.emit('message' as any, event)

        const eventData = event.data
        try {
          const parsed = JSON.parse(eventData)
          eventManager.emit('event:message' as any, parsed)
        }
        catch {
          eventManager.emit('event:message' as any, eventData)
        }
      }
    }
    catch (error) {
      stateManager.setState('error' as any)
      eventManager.emit('stateChange' as any, 'error' as any)
      eventManager.emit('error' as any, error as any)
    }
  }

  const on = <T = unknown>(eventType: SSEEventType | string, callback: SSEEventCallback<T>) => {
    return eventManager.on(eventType, callback)
  }

  const once = <T = unknown>(eventType: SSEEventType | string, callback: SSEEventCallback<T>) => {
    return eventManager.once(eventType, callback)
  }

  const off = (eventType: SSEEventType | string, callback?: SSEEventCallback) => {
    eventManager.off(eventType, callback)
  }

  const registerHandlers = (handlers: SSEEventHandlers) => {
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

  onUnmounted(() => {
    disconnect()
    eventManager.removeAllListeners()
  })

  return {
    connect,
    disconnect,
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
    lastEventId: readonly(lastEventId),
  }
}
