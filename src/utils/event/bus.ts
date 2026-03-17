import type { EventBus, EventHandler } from './types'
import mitt from 'mitt'

export function createEventBus(): EventBus {
  const emitter = mitt<Record<string, unknown>>()

  const on = <T = unknown>(event: string, handler: EventHandler<T>) => {
    emitter.on(event, handler as (data: unknown) => void)
  }

  const off = <T = unknown>(event: string, handler: EventHandler<T>) => {
    emitter.off(event, handler as (data: unknown) => void)
  }

  const emit = <T = unknown>(event: string, payload?: T) => {
    emitter.emit(event, payload)
  }

  const once = <T = unknown>(event: string, handler: EventHandler<T>) => {
    const wrappedHandler: EventHandler<T> = (payload) => {
      handler(payload)
      emitter.off(event, wrappedHandler as (data: unknown) => void)
    }
    emitter.on(event, wrappedHandler as (data: unknown) => void)
  }

  const clear = (event?: string) => {
    if (event) {
      emitter.all.delete(event)
    }
    else {
      emitter.all.clear()
    }
  }

  return {
    on,
    off,
    emit,
    once,
    clear,
  }
}

export const eventBus = createEventBus()
