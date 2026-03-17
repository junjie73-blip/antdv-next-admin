import type { AxiosInstance } from 'axios'
import type { RequestConfig, RequestOptions } from './types'
import axios from 'axios'
import { requestQueue } from './cancel'
import { createRequestInterceptor, createResponseInterceptor } from './interceptors'

const DEFAULT_TIMEOUT = 10000
const DEFAULT_BASE_URL = '/api'

export function createRequest(options: RequestOptions = {}): AxiosInstance {
  const { baseURL = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT, headers = {} } = options

  const instance = axios.create({
    baseURL,
    timeout,
    headers,
  })

  const requestInterceptor = createRequestInterceptor(headers)
  const responseInterceptor = createResponseInterceptor()

  instance.interceptors.request.use(requestInterceptor)
  instance.interceptors.response.use(
    responseInterceptor.onSuccess,
    responseInterceptor.onError,
  )

  return instance
}

export const request = createRequest()

export async function get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request.get(url, config)
}

export async function post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.post(url, data, config)
}

export async function put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.put(url, data, config)
}

export async function del<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request.delete(url, config)
}

export async function patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.patch(url, data, config)
}

export function cancelAllRequests(): void {
  requestQueue.clear()
}

export function pauseRequests(): void {
  requestQueue.pause()
}

export function resumeRequests(): void {
  requestQueue.resume()
}
