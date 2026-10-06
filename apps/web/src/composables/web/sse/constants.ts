export const DEFAULT_RECONNECT_CONFIG = {
  enabled: true,
  interval: 1000,
  maxAttempts: 5,
  delayMultiplier: 2,
  maxDelay: 30000,
}

export const DEFAULT_SSE_OPTIONS = {
  reconnectEnabled: DEFAULT_RECONNECT_CONFIG.enabled,
  reconnectInterval: DEFAULT_RECONNECT_CONFIG.interval,
  maxReconnectAttempts: DEFAULT_RECONNECT_CONFIG.maxAttempts,
  reconnectDelayMultiplier: DEFAULT_RECONNECT_CONFIG.delayMultiplier,
  maxReconnectDelay: DEFAULT_RECONNECT_CONFIG.maxDelay,
  withCredentials: false,
}
