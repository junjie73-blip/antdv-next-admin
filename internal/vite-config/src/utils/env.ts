import { loadEnv as viteLoadEnv } from 'vite';
import { parseLoadedEnv } from 'vite-plugin-env-parse';

export function loadEnv(mode: string): Record<string, any> {
  // 第三个参数传 "" 表示加载所有变量（含非 VITE_ 前缀）
  const raw = viteLoadEnv(mode, process.cwd(), '');
  return parseLoadedEnv(raw);
}

/**
 * 把环境变量读成布尔值。
 *
 * 坑点：`loadEnv` 里的 `parseLoadedEnv` 会做**类型转换**，`.env` 里的
 * `VITE_DEV_POLLING=true` 拿回来的是布尔 `true`，`VITE_PORT=6080` 是数字 `6080`。
 * 于是 `envConfig.VITE_X === 'true'` 恒为 false —— 开关配了、代码写了、实际从没生效过，
 * 而且 TS 里 `Record<string, any>` 不做比较校验，连报错都报不出来。
 * dev 巡检时就是这样发现 `VITE_DEV_POLLING`（映射盘上监听不到 fs 事件）一直是死配置。
 *
 * 反过来直接写 `if (envConfig.VITE_X)` 也不对：`'0'` 不会被转成数字（实测拿到字符串 `'0'`，
 * 真值），`'abc'`、`'no'` 同样会被当成开启。所以开关判定统一走这个函数。
 *
 * 认 `true / 1 / 'true' / '1' / 'on' / 'yes'`（大小写、前后空格忽略），其余（含 undefined、''、'0'）为 false。
 * 数字 1/0 也要认 —— 这是 Node 侧相对浏览器侧的额外分支，因为 `parseLoadedEnv` 会把 `'1'` 转成 `1`。
 *
 * 浏览器侧的同名函数在 `@antdv/shared/env`（来源是 `import.meta.env`，一律是字符串，不认数字）。
 * 两个包各自服务自己的运行时，Node 侧不依赖浏览器包，所以重复一份几行的纯函数，
 * 而不是让 `internal/vite-config` 去 import `@antdv/shared`。
 */
export function isEnvEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  return ['1', 'on', 'true', 'yes'].includes(value.trim().toLowerCase());
}
