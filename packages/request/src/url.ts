import { isNil } from 'es-toolkit';
import qs from 'qs';

/**
 * qs 序列化配置：
 * - `arrayFormat: 'repeat'` 产出 `a=1&a=2`，Nitro mock（h3 getQuery）会还原成真数组，
 *   登录日志的 `dateRange` 双值过滤依赖这一形态；
 * - `skipNulls` + 入口的 nil 清洗保持与旧实现一致的"空参数不发送"行为。
 */
export function buildUrl(url: string, params?: Record<string, any>): string {
  if (!params) return url;

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (isNil(value)) continue;
    cleaned[key] = value;
  }

  const query = qs.stringify(cleaned, {
    arrayFormat: 'repeat',
    skipNulls: true,
  });
  if (!query) return url;
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
}
