/**
 * 应用的请求出口：`http` / `request` / `ExecuteOptions` 等仍从 `~/composables` 取，
 * 让页面不必逐个写子包路径。通用的组合式函数（权限判定、CRUD 骨架、缓存、打印…）
 * 已经收进 `@antdv/hooks`，这里不再重复导出。
 */
export * from '@antdv/request';
