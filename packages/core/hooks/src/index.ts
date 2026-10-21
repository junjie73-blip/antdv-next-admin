/**
 * `@antdv/hooks` 根入口：只收录「轻量、无额外依赖」的组合式函数。
 *
 * 读会话状态的是 `usePermission`（user store）与 `use-locale`（app store 的 locale 偏好），
 * 两者都不读路由实例、不发请求，所以仍可被子包直接复用。
 *
 * echarts 故意不进这个 barrel：它拖进整个图表库的全量注册表，
 * 放进根入口会让 `import { usePrint }` 也付出一份图表的解析成本。
 * 需要它时走独立子路径：
 *
 *   import { useEcharts } from '@antdv/hooks/echarts';
 *
 * `use-locale` 同理走深路径（`@antdv/hooks/use-locale`）：它是唯一牵 vue-i18n 的
 * 组合式函数，塞进根入口等于让所有 hooks 消费者都付出一份 i18n 运行时的解析成本。
 *
 * SSE 与 WebSocket 不在这里了 —— 实时通信的代码统一收在 `@antdv/request`
 * （`@antdv/request/sse`、`@antdv/request/websocket`），与 HTTP 共用一套重连语义。
 */
export { useCache } from './use-cache';
export { useChunkUpload } from './use-chunk-upload';
export type {
  ChunkInfo,
  ChunkUploadOptions,
  UploadStatus,
} from './use-chunk-upload';
export { useCRUD } from './use-crud';
export type { CRUDMessages, UseCRUDOptions, UseCRUDReturn } from './use-crud';
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
