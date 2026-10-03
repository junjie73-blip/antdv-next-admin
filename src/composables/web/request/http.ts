import { executeRequest, type ExecuteOptions } from './executor'

export const request = {
  get: <T = any>(url: string, params?: Record<string, any>, opts?: ExecuteOptions) =>
    executeRequest<T>('GET', url, undefined, opts, params),

  delete: <T = any>(url: string, params?: Record<string, any>, opts?: ExecuteOptions) =>
    executeRequest<T>('DELETE', url, undefined, opts, params),

  post: <T = any>(url: string, body?: any, opts?: ExecuteOptions) => executeRequest<T>('POST', url, body, opts),

  put: <T = any>(url: string, body?: any, opts?: ExecuteOptions) => executeRequest<T>('PUT', url, body, opts),

  patch: <T = any>(url: string, body?: any, opts?: ExecuteOptions) => executeRequest<T>('PATCH', url, body, opts),
}

export const http = {
  Get: request.get,
  Post: request.post,
  Put: request.put,
  Patch: request.patch,
  Delete: request.delete,
  get: request.get,
  post: request.post,
  put: request.put,
  patch: request.patch,
  delete: request.delete,
}

export { requestCache } from './executor'
