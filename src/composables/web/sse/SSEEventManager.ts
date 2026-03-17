import type { SSEEventCallback, SSEEventHandlers, SSEEventType } from './types'

export class SSEEventManager {
  private eventHandlers: Map<SSEEventType, Set<SSEEventCallback>> = new Map()
  private namedEventHandlers: Map<string, Set<SSEEventCallback>> = new Map()

  on<T = unknown>(eventType: SSEEventType | string, callback: SSEEventCallback<T>): () => void {
    if (eventType.startsWith('event:')) {
      const eventName = eventType.replace('event:', '')
      return this.onNamedEvent(eventName, callback as SSEEventCallback)
    }

    if (!this.eventHandlers.has(eventType as SSEEventType)) {
      this.eventHandlers.set(eventType as SSEEventType, new Set())
    }

    const handlers = this.eventHandlers.get(eventType as SSEEventType)!
    handlers.add(callback as SSEEventCallback)

    return () => {
      handlers.delete(callback as SSEEventCallback)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType as SSEEventType)
      }
    }
  }

  onNamedEvent<T = unknown>(eventName: string, callback: SSEEventCallback<T>): () => void {
    if (!this.namedEventHandlers.has(eventName)) {
      this.namedEventHandlers.set(eventName, new Set())
    }

    const handlers = this.namedEventHandlers.get(eventName)!
    handlers.add(callback as SSEEventCallback)

    return () => {
      handlers.delete(callback as SSEEventCallback)
      if (handlers.size === 0) {
        this.namedEventHandlers.delete(eventName)
      }
    }
  }

  once<T = unknown>(eventType: SSEEventType | string, callback: SSEEventCallback<T>): () => void {
    const wrappedCallback = (data: T) => {
      callback(data)
      this.off(eventType, wrappedCallback as SSEEventCallback)
    }

    return this.on(eventType, wrappedCallback as SSEEventCallback)
  }

  off(eventType: SSEEventType | string, callback?: SSEEventCallback): void {
    if (eventType.startsWith('event:')) {
      const eventName = eventType.replace('event:', '')
      this.offNamedEvent(eventName, callback)
      return
    }

    const handlers = this.eventHandlers.get(eventType as SSEEventType)
    if (!handlers) {
      return
    }

    if (callback) {
      handlers.delete(callback)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType as SSEEventType)
      }
    }
    else {
      this.eventHandlers.delete(eventType as SSEEventType)
    }
  }

  offNamedEvent(eventName: string, callback?: SSEEventCallback): void {
    const handlers = this.namedEventHandlers.get(eventName)
    if (!handlers) {
      return
    }

    if (callback) {
      handlers.delete(callback)
      if (handlers.size === 0) {
        this.namedEventHandlers.delete(eventName)
      }
    }
    else {
      this.namedEventHandlers.delete(eventName)
    }
  }

  emit<T = unknown>(eventType: SSEEventType | string, data: T): void {
    if (eventType.startsWith('event:')) {
      const eventName = eventType.replace('event:', '')
      this.emitNamedEvent(eventName, data)
      return
    }

    const handlers = this.eventHandlers.get(eventType as SSEEventType)
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

  emitNamedEvent<T = unknown>(eventName: string, data: T): void {
    const handlers = this.namedEventHandlers.get(eventName)
    if (!handlers) {
      return
    }

    handlers.forEach((callback) => {
      try {
        callback(data)
      }
      catch (error) {
        console.error(`Error in named event handler for ${eventName}:`, error)
      }
    })
  }

  registerHandlers(handlers: SSEEventHandlers): () => void {
    const unsubscribers: Array<() => void> = []

    Object.entries(handlers).forEach(([eventType, callback]) => {
      if (callback) {
        const unsubscribe = this.on(eventType as SSEEventType, callback)
        unsubscribers.push(unsubscribe)
      }
    })

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }

  removeAllListeners(eventType?: SSEEventType | string): void {
    if (eventType) {
      if (eventType.startsWith('event:')) {
        const eventName = eventType.replace('event:', '')
        this.namedEventHandlers.delete(eventName)
      }
      else {
        this.eventHandlers.delete(eventType as SSEEventType)
      }
    }
    else {
      this.eventHandlers.clear()
      this.namedEventHandlers.clear()
    }
  }

  getListenerCount(eventType: SSEEventType | string): number {
    if (eventType.startsWith('event:')) {
      const eventName = eventType.replace('event:', '')
      return this.namedEventHandlers.get(eventName)?.size || 0
    }
    return this.eventHandlers.get(eventType as SSEEventType)?.size || 0
  }

  hasListeners(eventType: SSEEventType | string): boolean {
    return this.getListenerCount(eventType) > 0
  }
}
