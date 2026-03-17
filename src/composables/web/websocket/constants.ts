import type { HeartbeatConfig, ReconnectConfig } from './types'

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  interval: 30000,
  timeout: 5000,
  message: JSON.stringify({ type: 'ping' }),
}

export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  enabled: true,
  interval: 1000,
  maxAttempts: 5,
  delayMultiplier: 2,
  maxDelay: 30000,
}

export const DEFAULT_WEBSOCKET_OPTIONS = {
  heartbeatInterval: DEFAULT_HEARTBEAT_CONFIG.interval,
  heartbeatTimeout: DEFAULT_HEARTBEAT_CONFIG.timeout,
  reconnectEnabled: DEFAULT_RECONNECT_CONFIG.enabled,
  reconnectInterval: DEFAULT_RECONNECT_CONFIG.interval,
  maxReconnectAttempts: DEFAULT_RECONNECT_CONFIG.maxAttempts,
  reconnectDelayMultiplier: DEFAULT_RECONNECT_CONFIG.delayMultiplier,
  maxReconnectDelay: DEFAULT_RECONNECT_CONFIG.maxDelay,
}
