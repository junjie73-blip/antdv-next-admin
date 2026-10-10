import type {
  SSEEventCallback,
  SSEEventHandlers,
  SSEOptions,
} from './types';

import { computed, onUnmounted, readonly, ref } from 'vue';

import { DEFAULT_SSE_OPTIONS } from './constants';
import { SSEEventManager } from './SSEEventManager';
import { SSEReconnectManager } from './SSEReconnectManager';
import { SSEStateManager } from './SSEStateManager';
// SSEState / SSEEventType 是枚举，运行时要用它的成员，所以必须是值导入
import { SSEEventType, SSEState } from './types';

/**
 * SSE 客户端：EventSource + 受控重连。
 *
 * 与 `useWebSocket` 的差别只在传输层：EventSource 自己也会重连，
 * 所以我们这套调度器在 onerror 里必须先 `clearEventSource()` 关掉旧连接，
 * 否则浏览器原生重试和我们的重试会同时挂着两条，事件重复消费。
 */
export function useSSE(options: SSEOptions) {
  const finalOptions = { ...DEFAULT_SSE_OPTIONS, ...options };

  const stateManager = new SSEStateManager();
  const eventManager = new SSEEventManager();
  const reconnectManager = new SSEReconnectManager({
    enabled: finalOptions.reconnectEnabled ?? true,
    interval: finalOptions.reconnectInterval ?? 1000,
    maxAttempts: finalOptions.maxReconnectAttempts ?? 5,
    delayMultiplier: finalOptions.reconnectDelayMultiplier ?? 2,
    maxDelay: finalOptions.maxReconnectDelay ?? 30_000,
  });

  const readyState = readonly(stateManager.getStateRef());
  const reconnectAttempts = ref(0);
  const lastEventId = ref<null | string>(null);

  const disconnect = () => {
    reconnectManager.stop();
    stateManager.clearEventSource();
    stateManager.setState(SSEState.Disconnected);
    eventManager.emit(SSEEventType.StateChange, SSEState.Disconnected);
    eventManager.emit(SSEEventType.Close, new Event('close'));
  };

  const connect = () => {
    if (stateManager.isConnecting() || stateManager.isConnected()) {
      return;
    }

    stateManager.setState(SSEState.Connecting);
    eventManager.emit(SSEEventType.StateChange, SSEState.Connecting);

    try {
      let url = finalOptions.url;

      // 断线续传：把上次收到的事件 id 带给服务端，避免漏消息
      if (lastEventId.value) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}lastEventId=${encodeURIComponent(lastEventId.value)}`;
      }

      const eventSource = new EventSource(url, {
        withCredentials: finalOptions.withCredentials,
      });

      stateManager.setEventSource(eventSource);

      eventSource.onopen = (event) => {
        stateManager.setState(SSEState.Connected);
        eventManager.emit(SSEEventType.StateChange, SSEState.Connected);
        eventManager.emit(SSEEventType.Open, event);

        reconnectManager.reset();
        reconnectAttempts.value = 0;
      };

      eventSource.onerror = (event) => {
        stateManager.setState(SSEState.Error);
        eventManager.emit(SSEEventType.StateChange, SSEState.Error);
        eventManager.emit(SSEEventType.Error, event);

        if (
          reconnectManager.isEnabled() &&
          !reconnectManager.hasReachedMaxAttempts()
        ) {
          // 先断开旧连接再排重连：浏览器对 EventSource 有自带重试，
          // 不关掉的话两条连接会同时收消息。
          stateManager.clearEventSource();
          reconnectManager.start();
        } else {
          disconnect();
        }
      };

      eventSource.onmessage = (event) => {
        lastEventId.value = event.lastEventId;

        // 心跳注释帧（data 为空串）只用于保活，不往业务事件里透
        if (event.data === '') {
          return;
        }

        eventManager.emit(SSEEventType.Message, event);

        const eventData = event.data;
        try {
          const parsed = JSON.parse(eventData);
          eventManager.emit('event:message', parsed);
        } catch {
          eventManager.emit('event:message', eventData);
        }
      };
    } catch (error) {
      stateManager.setState(SSEState.Error);
      eventManager.emit(SSEEventType.StateChange, SSEState.Error);
      eventManager.emit(SSEEventType.Error, error);
    }
  };

  const on = <T = unknown>(
    eventType: SSEEventType | string,
    callback: SSEEventCallback<T>,
  ) => {
    return eventManager.on(eventType, callback);
  };

  const once = <T = unknown>(
    eventType: SSEEventType | string,
    callback: SSEEventCallback<T>,
  ) => {
    return eventManager.once(eventType, callback);
  };

  const off = (
    eventType: SSEEventType | string,
    callback?: SSEEventCallback,
  ) => {
    eventManager.off(eventType, callback);
  };

  const registerHandlers = (handlers: SSEEventHandlers) => {
    return eventManager.registerHandlers(handlers);
  };

  const reconnect = () => {
    reconnectManager.reset();
    reconnectAttempts.value = 0;
    disconnect();
    connect();
  };

  reconnectManager.setReconnectCallback(() => {
    reconnectAttempts.value = reconnectManager.getCurrentAttempt();
    connect();
  });

  reconnectManager.setMaxAttemptsReachedCallback(() => {
    console.warn('Max reconnect attempts reached');
    disconnect();
  });

  onUnmounted(() => {
    disconnect();
    eventManager.removeAllListeners();
  });

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
  };
}
