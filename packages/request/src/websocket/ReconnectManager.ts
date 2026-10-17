/**
 * WebSocket 侧的重连管理器。
 *
 * 实现放在 `../internal/reconnect`，与 SSE 共用同一份退避逻辑；
 * 这里只保留本目录习惯使用的名字，`useWebSocket.ts` 的 `./ReconnectManager`
 * 导入路径不必改。
 */
export { ReconnectScheduler as ReconnectManager } from '../internal/reconnect';
export type { ReconnectSchedulerConfig } from '../internal/reconnect';
