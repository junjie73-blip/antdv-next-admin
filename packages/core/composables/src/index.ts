/**
 * `@antdv/composables` 根入口：只收录「轻量、无额外依赖」的组合式函数。
 *
 * echarts / sse / websocket 故意不进这个 barrel：
 * 它们要么拖进整个图表库（echarts 全量注册表），要么带一堆管理器类，
 * 放进根入口会让 `import { usePrint }` 也付出一份图表的解析成本。
 * 需要用它们时走独立子路径：
 *
 *   import { useEcharts } from '@antdv/composables/echarts';
 *   import { useSSE } from '@antdv/composables/sse';
 *   import { useWebSocket } from '@antdv/composables/websocket';
 */
export { useCache } from './useCache';
export { useChunkUpload } from './useChunkUpload';
export type {
  ChunkInfo,
  ChunkUploadOptions,
  UploadStatus,
} from './useChunkUpload';
export { useFileReader } from './useFileReader';
export { usePrint } from './usePrint';
export type { PrintOptions } from './usePrint';
export { useRouteLoading } from './useRouteLoading';
export type { RouteLoadingOptions } from './useRouteLoading';
export { useWatermark } from './useWatermark';
export type { UseWatermarkOptions } from './useWatermark';
export type {
  CacheInstance,
  UseCacheOptions,
  UseCacheReturn,
} from '@antdv/shared/cache';
