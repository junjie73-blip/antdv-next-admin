import type { WebSocketEventCallback, WebSocketEventHandlers, WebSocketEventType } from './types'

export class EventManager {
  private eventHandlers: Map<WebSocketEventType, Set<WebSocketEventCallback>> = new Map()

  on<T = unknown>(eventType: WebSocketEventType, callback: WebSocketEventCallback<T>): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }

    const handlers = this.eventHandlers.get(eventType)!
    handlers.add(callback as WebSocketEventCallback)

    return () => {
      handlers.delete(callback as WebSocketEventCallback)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType)
      }
    }
  }

  once<T = unknown>(eventType: WebSocketEventType, callback: WebSocketEventCallback<T>): () => void {
    const wrappedCallback = (data: T) => {
      callback(data)
      this.off(eventType, wrappedCallback as WebSocketEventCallback)
    }

    return this.on(eventType, wrappedCallback as WebSocketEventCallback)
  }

  off(eventType: WebSocketEventType, callback?: WebSocketEventCallback): void {
    const handlers = this.eventHandlers.get(eventType)
    if (!handlers) {
      return
    }

    if (callback) {
      handlers.delete(callback)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType)
      }
    }
    else {
      this.eventHandlers.delete(eventType)
    }
  }

  emit<T = unknown>(eventType: WebSocketEventType, data: T): void {
    const handlers = this.eventHandlers.get(eventType)
    if (!handlers) {
      return
    }

    handlers.forEach((callback) => {
      try {
        callback(data)
      }
      catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error)
      }
    })
  }

  registerHandlers(handlers: WebSocketEventHandlers): () => void {
    const unsubscribers: Array<() => void> = []

    Object.entries(handlers).forEach(([eventType, callback]) => {
      if (callback) {
        const unsubscribe = this.on(eventType as WebSocketEventType, callback)
        unsubscribers.push(unsubscribe)
      }
    })

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }

  removeAllListeners(eventType?: WebSocketEventType): void {
    if (eventType) {
      this.eventHandlers.delete(eventType)
    }
    else {
      this.eventHandlers.clear()
    }
  }

  getListenerCount(eventType: WebSocketEventType): number {
    return this.eventHandlers.get(eventType)?.size || 0
  }

  hasListeners(eventType: WebSocketEventType): boolean {
    return this.getListenerCount(eventType) > 0
  }
}
