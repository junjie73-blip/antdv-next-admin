/**
 * `@antdv/shared` 的统一出口（root barrel）。
 *
 * 子路径导入（`@antdv/shared/cn`、`@antdv/shared/cache`）依然可用，
 * root barrel 只是给"想一次拿一组工具"的调用方用的便捷入口。
 * 这里刻意用显式 `export *`：一旦两个模块导出同名成员，
 * TS 会直接报 TS2308，比在业务侧出现"导入到了 undefined"更早暴露。
 */
export * from './cache';
export * from './cn';
/**
 * crypto 与 jwt 都描述 JWT 载荷，`export *` 会让 root barrel 出现同名类型（TS2308）。
 * root barrel 里显式列出 crypto 的运行时函数，JWT 类型统一以 `./jwt` 为准；
 * 需要 crypto 那一套类型时用子路径 `@antdv/shared/crypto`。
 */
export {
  decrypt,
  decryptObject,
  encrypt,
  encryptObject,
} from './crypto/aes';
export { hash, md5, md5File, sha256 } from './crypto/hash';
export * from './csrf';
export * from './dayjs';
export * from './domUtils';
export * from './download';
export * from './env';
export * from './event';
export * from './excel';
export * from './file-category';
export * from './iframe';
export * from './jwt';
export * from './masking';
export * from './menu';
export * from './template';
export * from './welcome';
export * from './xss';
