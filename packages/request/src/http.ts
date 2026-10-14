import type { ExecuteOptions } from './executor';

import { executeRequest } from './executor';

export const request = {
  get: <T = any>(
    url: string,
    params?: Record<string, any>,
    opts?: ExecuteOptions,
  ) => executeRequest<T>('GET', url, undefined, opts, params),

  /** DELETE 也可带请求体：通过 opts.body 透传（后端从 req.body 读取的场景） */
  delete: <T = any>(
    url: string,
    params?: Record<string, any>,
    opts?: ExecuteOptions,
  ) => executeRequest<T>('DELETE', url, opts?.body, opts, params),

  post: <T = any>(url: string, body?: any, opts?: ExecuteOptions) =>
    executeRequest<T>('POST', url, body, opts),

  put: <T = any>(url: string, body?: any, opts?: ExecuteOptions) =>
    executeRequest<T>('PUT', url, body, opts),

  patch: <T = any>(url: string, body?: any, opts?: ExecuteOptions) =>
    executeRequest<T>('PATCH', url, body, opts),
};

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
};

export { requestCache } from './executor';
