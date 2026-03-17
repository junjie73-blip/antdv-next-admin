import type { AxiosRequestConfig } from 'axios'

export interface RequestConfig extends AxiosRequestConfig {
  retry?: RetryOptions
  enableCancel?: boolean
}

export interface RetryOptions {
  count?: number
  delay?: number
  condition?: (error: Error) => boolean
}

export interface Response<T = unknown> {
  code: number
  data: T
  message: string
}

export interface RequestOptions {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
}

export interface PendingRequest {
  url: string
  method: string
  cancel: () => void
}

export interface RequestQueue {
  pending: Map<string, PendingRequest>
  pause: () => void
  resume: () => void
  clear: () => void
}
