/**
 * 包内环境变量入口。
 *
 * 为什么不让各模块直接写 `import.meta.env`：
 * 1. `@antdv/shared` 的产物是 dist 里的 ESM，Vite 的 env 静态替换只作用于应用自己的源码，
 *    包体里读 `import.meta.env` 在预打包（esbuild）后大概率拿到 undefined，行为静默退化；
 * 2. 单测里无法切换"生产/开发"分支，`shouldEncrypt()` 这类判定就成了不可测代码。
 *
 * 所以由应用在入口调用 `configureSharedEnv()` 注入，包只依赖这份显式配置。
 */

export interface SharedEnv {
  /** 缓存值加密主密钥；未配置时开发环境用兜底密钥并告警 */
  cacheEncryptKey?: string;
  /** 缓存键前缀 */
  cachePrefix: string;
  /** MinIO 直链域名，未配置时下载走代理前缀 */
  minioPublicUrl?: string;
  /** 是否生产环境 */
  production: boolean;
}

const FALLBACK_CACHE_KEY = 'antdv_dev_cache_key_change_me';

const state: SharedEnv = {
  cacheEncryptKey: undefined,
  cachePrefix: 'app_cache',
  minioPublicUrl: undefined,
  production: false,
};

export function configureSharedEnv(next: Partial<SharedEnv>): Readonly<SharedEnv> {
  if (next.cachePrefix !== undefined) state.cachePrefix = next.cachePrefix;
  if (next.cacheEncryptKey !== undefined) {
    state.cacheEncryptKey = next.cacheEncryptKey;
  }
  if (next.minioPublicUrl !== undefined) {
    state.minioPublicUrl = next.minioPublicUrl;
  }
  if (next.production !== undefined) state.production = next.production;
  return state;
}

export function getSharedEnv(): Readonly<SharedEnv> {
  return state;
}

export function isProduction(): boolean {
  return state.production;
}

/**
 * 取缓存加密密钥。
 * 生产环境缺配置必须抛错：静默回退到内置密钥会让"以为加密了"的数据以固定密钥落盘，
 * 比明文更危险。开发环境给出告警 + 兜底，保证本地能跑。
 */
export function getCacheEncryptKey(): string {
  const configured = state.cacheEncryptKey ?? '';
  if (configured.length >= 16) return configured;
  if (state.production) {
    throw new Error(
      '[shared/cache] 生产环境必须配置 cacheEncryptKey（长度 >= 16）',
    );
  }
  return FALLBACK_CACHE_KEY;
}

export function getMinioPublicUrl(): string | undefined {
  return state.minioPublicUrl;
}

export function getCachePrefix(): string {
  return state.cachePrefix;
}

/**
 * 把 `.env` 里的开关读成布尔值。
 *
 * Vite 注入的 `import.meta.env.*` 一律是**字符串**：`VITE_MOCK=true` 拿到的是 `'true'`。
 * 所以 `import.meta.env.VITE_X === true` 恒为 false —— 开关看着配了、实际从没生效过，
 * 而且 TS 里字符串和布尔比较不报错（`ImportMetaEnv` 声明成 `any` 时）。
 * 这类"永远关着的功能"最难查，统一走这个函数。
 *
 * 认 `'true' / '1' / 'on' / 'yes'`（大小写、前后空格都忽略），其余（含 undefined、''）为 false。
 */
export function isEnvEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['1', 'on', 'true', 'yes'].includes(value.trim().toLowerCase());
}

