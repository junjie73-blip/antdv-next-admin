import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getToken, removeToken } from '../token'

export function createRequestInterceptor(defaultHeaders: Record<string, string> = {}) {
  return (config: InternalAxiosRequestConfig) => {
    const token = getToken()

    config.headers = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...config.headers,
    } as typeof config.headers

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  }
}

export function createResponseInterceptor() {
  return {
    onSuccess: (response: AxiosResponse) => {
      const { code, data, message } = response.data

      if (code === 200) {
        return data
      }

      if (code === 401) {
        removeToken()
        window.location.href = '/login'
        return Promise.reject(new Error(message || '未授权'))
      }

      return Promise.reject(new Error(message || '请求失败'))
    },
    onError: (error: AxiosError) => {
      const message = error.message || '网络错误'
      console.error('Request error:', error)
      return Promise.reject(new Error(message))
    },
  }
}
