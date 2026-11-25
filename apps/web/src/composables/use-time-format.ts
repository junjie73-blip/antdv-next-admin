/**
 * 时间展示格式：把偏好里的 `timeFormat` / `customTimeFormat` 收敛成一个纯函数，
 * 表格、详情、日志共用同一套口径，不再各自写死 `YYYY-MM-DD HH:mm:ss`。
 *
 * 特殊值：
 * - `relative`：相对时间（依赖 shared/dayjs 已注册的 relativeTime 插件）；
 * - `iso`：保留服务端原始 ISO 串，便于排查问题；
 * - `custom`：使用用户自定义 dayjs 格式串，空串回落到默认格式。
 */
import { useAppStore } from '@antdv/stores';
import { formatTz, parseTz } from '@antdv/shared/utils/dayjs';

const FALLBACK_PATTERN = 'YYYY-MM-DD HH:mm:ss';

export function formatByTimeFormat(
  value: unknown,
  format: string,
  customPattern = '',
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date))
    return String(value);

  if (format === 'iso') return String(value);

  const parsed = parseTz(value as string | number | Date);
  if (!parsed.isValid()) return String(value);
  if (format === 'relative') return parsed.fromNow();

  const pattern =
    format === 'custom' ? customPattern.trim() || FALLBACK_PATTERN : format || FALLBACK_PATTERN;
  const formatted = formatTz(value as string | number | Date, pattern);
  return formatted || String(value);
}

/** 响应式入口：偏好改变后所有调用点自动跟着变 */
export function useTimeFormat() {
  const appStore = useAppStore();
  function format(value: unknown): string {
    return formatByTimeFormat(value, appStore.timeFormat, appStore.customTimeFormat);
  }
  return { format };
}
