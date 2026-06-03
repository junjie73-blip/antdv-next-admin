import { http } from '@/utils/request'

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
  return http.Get<R<T>>(url, { params }).then(res => res.data)
}

export function post<T = unknown>(url: string, data?: Record<string, unknown>) {
  return http.Post<R<T>>(url, data).then(res => res.data)
}

export function put<T = unknown>(url: string, data?: Record<string, unknown>) {
  return http.Put<R<T>>(url, data).then(res => res.data)
}

export function del<T = unknown>(url: string, params?: Record<string, unknown>) {
  return http.Delete<R<T>>(url, { params }).then(res => res.data)
}
