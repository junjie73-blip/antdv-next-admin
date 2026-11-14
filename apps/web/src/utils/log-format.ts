/**
 * 日志类页面共用的格式化函数。
 *
 * 单独成文件而不是散在 .vue 里：手机号 / 邮箱掩码属于「PII 脱敏」这条硬约束，
 * 必须能被单元测试直接断言；页面只负责把值交给它。
 */

/** 语义色档位，供 StatusPill / Tag 消费 */
export type Tone = 'error' | 'info' | 'neutral' | 'success' | 'warning';

/** 客户端日志级别 → 语义色 */
export function levelTone(level: string): Tone {
  switch (level) {
    case 'error': {
      return 'error';
    }
    case 'warn': {
      return 'warning';
    }
    case 'info': {
      return 'info';
    }
    case 'debug': {
      return 'neutral';
    }
    default: {
      return 'neutral';
    }
  }
}

/** 校验 / 执行结果 → 语义色；同时兼容 1/0 与 success/fail 两套历史取值 */
export function resultTone(result: number | string): Tone {
  if (result === 'passed' || result === 'success' || result === 1)
    return 'success';
  if (result === 'failed' || result === 'fail' || result === 0) return 'error';
  return 'neutral';
}

/**
 * 手机号与邮箱掩码。
 * - 手机号：保留前 3 后 4；
 * - 邮箱：保留首字符与域名，用户名部分打星；
 * - 已是掩码或无法识别时原样返回，不把短字符串也糊成一串星号。
 */
export function maskReceiver(value: string): string {
  const text = String(value ?? '').trim();
  if (!text || text.includes('*')) return text;

  if (/^1\d{10}$/.test(text)) {
    return `${text.slice(0, 3)}****${text.slice(-4)}`;
  }

  const at = text.indexOf('@');
  if (at >= 1 && at < text.length - 1) {
    const local = text.slice(0, at);
    const domain = text.slice(at);
    const shown = local.length <= 2 ? local[0] : local.slice(0, 2);
    return `${shown}***${domain}`;
  }

  return text;
}

/** 数字千分位，非有限值统一回退成 '-'，避免界面出现 NaN */
export function formatCount(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '-';
}

/**
 * 请求层信封适配。
 *
 * `src/api/request.ts` 的 get/post/put/del 在**运行时**返回统一信封
 * `{ code, data, message }`（`http.*` 的响应体），但泛型推导把返回值标成了业务数据 T。
 * 既有的系统页面靠 `res?.data ?? res` 兼容两种形态，代价是全仓 vue-tsc 报一条
 * `Property 'data' does not exist`。新增页面统一走这个适配层：既保留运行时兼容
 * （将来请求层改成只吐 data 也不会坏），又让类型落回业务数据本身。
 */
export function unwrapApi<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

/**
 * 详情页通用值格式化：数组、布尔、对象、空值都收敛成可读文本，
 * 保证 Descriptions 里不会出现 undefined / [object Object] / NaN。
 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
