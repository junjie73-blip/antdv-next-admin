/**
 * `@antdv/hooks` 根入口：只收录「轻量、无额外依赖」的组合式函数。
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
export { useChunkUpload } from './use-chunk-upload';
export type {
  ChunkInfo,
  ChunkUploadOptions,
  UploadStatus,
} from './use-chunk-upload';
export { useFileReader } from './use-file-reader';
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
