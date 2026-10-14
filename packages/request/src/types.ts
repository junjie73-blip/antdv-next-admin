import type { EventHook } from '@vueuse/core';

import type { Ref } from 'vue';

import type { RequestError } from './error';
export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  timestamp?: number;
  data?: T;
}

export type HttpMethod = 'DELETE' | 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT';

export interface UseRequestReturn<T = unknown> {
  data: Ref<T | undefined>;
  loading: Ref<boolean>;
  error: Ref<null | RequestError>;
  status: Ref<'error' | 'idle' | 'loading' | 'success'>;
  /** 手动发送请求 */
  send: (...args: any[]) => Promise<T>;
  /** 取消当前请求 */
  abort: () => void;
  /** 重新执行最近一次请求 */
  refresh: () => Promise<T>;
  /** 事件订阅 */
  onSuccess: EventHook<T>['on'];
  onError: EventHook<RequestError>['on'];
  onFinally: EventHook<void>['on'];
}
