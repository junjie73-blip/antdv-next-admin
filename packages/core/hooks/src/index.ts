/**
 * `@antdv/hooks` 根入口：只收录「轻量、无额外依赖」的组合式函数。
 *
 * 唯一读会话状态的是 `usePermission`：它只认 `@antdv/stores` 的 user store，
 * 不读路由实例、不发请求，所以仍可被子包直接复用。
 *
 * echarts 故意不进这个 barrel：它拖进整个图表库的全量注册表，
 * 放进根入口会让 `import { usePrint }` 也付出一份图表的解析成本。
 * 需要它时走独立子路径：
 *
 *   import { useEcharts } from '@antdv/hooks/echarts';
 *
 * SSE 与 WebSocket 不在这里了 —— 实时通信的代码统一收在 `@antdv/request`
 * （`@antdv/request/sse`、`@antdv/request/websocket`），与 HTTP 共用一套重连语义。
 */
export { useCache } from './use-cache';
export { useCRUD } from './use-crud';
export type { CRUDMessages, UseCRUDOptions, UseCRUDReturn } from './use-crud';
export { useChunkUpload } from './use-chunk-upload';
export type {
  ChunkInfo,
  ChunkUploadOptions,
  UploadStatus,
} from './use-chunk-upload';
export { useFileReader } from './use-file-reader';
export {
  PermissionAction,
  PermissionMode,
  PermissionResource,
  PermissionRole,
  usePermission,
} from './use-permission';
export type {
  Permission,
  PermissionCheckOptions,
  Role,
  UsePermissionOptions,
} from './use-permission';
export { usePrint } from './use-print';
export type { PrintOptions } from './use-print';
export { useRouteLoading } from './use-route-loading';
export type { RouteLoadingOptions } from './use-route-loading';
export { useWatermark } from './use-watermark';
export type { UseWatermarkOptions } from './use-watermark';
export type {
  CacheInstance,
  UseCacheOptions,
  UseCacheReturn,
} from '@antdv/shared/cache';
