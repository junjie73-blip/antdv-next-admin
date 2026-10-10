import { http } from '~/composables';

export interface R<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export interface RL<T = unknown> {
  code: number;
  data: {
    list: T[];
    total: number;
  };
  message: string;
}

export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
) {
  // 第二个实参**就是查询串本身**，不要再包一层 `{ params }`：
  // 包了之后 `buildUrl` 看到的是"一个叫 params 的参数"，
  // 于是发出去的是 `?params=[object Object]`，筛选与分页条件整批丢失
  // （表现是"搜索框输什么都一样、翻到第二页还是第一页的数据"）。
  return http.Get<R<T>>(url, params).then((res) => res.data);
}

export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  return http
    .Post<R<T>>(url, data, params ? { params } : undefined)
    .then((res) => res.data);
}

export function put<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  return http
    .Put<R<T>>(url, data, params ? { params } : undefined)
    .then((res) => res.data);
}

export function del<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
) {
  return http.Delete<R<T>>(url, params).then((res) => res.data);
}
