/**
 * `@antdv/shared` 的统一出口（root barrel）。
 *
 * 目录划分：`cache`（内存/存储缓存）、`color`（色值换算）、`constants`（跨层字面量）、
 * `utils`（一个文件一件工具的通用方法）、`store`（只转发 @tanstack/vue-store）。
 * 子路径导入（`@antdv/shared/utils/cn`、`@antdv/shared/color`）依然可用，
 * root barrel 只是给"想一次拿一组工具"的调用方用的便捷入口。
 *
 * 这里刻意用显式 `export *`：一旦两个模块导出同名成员，
 * TS 会直接报 TS2308，比在业务侧出现"导入到了 undefined"更早暴露。
 */
export * from './cache';
export * from './color';
export * from './constants';
export * from './store';
export * from './utils';
