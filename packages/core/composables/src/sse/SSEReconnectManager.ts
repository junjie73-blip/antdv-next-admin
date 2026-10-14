/**
 * SSE 侧的重连管理器。
 *
 * 与 WebSocket 共用 `../internal/reconnect` 的退避实现，
 * 只保留本目录习惯使用的名字，`useSSE.ts` 的 `./SSEReconnectManager` 导入路径不变。
 */
export { ReconnectScheduler as SSEReconnectManager } from '../internal/reconnect';
export type { ReconnectSchedulerConfig } from '../internal/reconnect';
