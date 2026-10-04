import { request } from '~/composables'

export interface R<T = unknown> {
  code: number
  data: T
  message: string
}

export interface RL<T = unknown> {
  code: number
  data: {
    list: T[]
    total: number
  }
  message: string
}

export function get<T = unknown>(url: string, params?: Record<string, unknown>) {
  return request.get<R<T>>(url, params).then((res) => res.data)
}

export function post<T = unknown>(url: string, data?: Record<string, unknown>) {
  return request.post<R<T>>(url, data).then((res) => res.data)
}

export function put<T = unknown>(url: string, data?: Record<string, unknown>) {
  return request.put<R<T>>(url, data).then((res) => res.data)
}

export function del<T = unknown>(url: string, params?: Record<string, unknown>) {
  return request.delete<R<T>>(url, params).then((res) => res.data)
}
