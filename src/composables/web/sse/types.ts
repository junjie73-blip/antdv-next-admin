export enum SSEState {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum SSEEventType {
  Message = 'message',
  Open = 'open',
  Close = 'close',
  Error = 'error',
  StateChange = 'stateChange',
}

export interface SSEOptions {
  url: string
  headers?: Record<string, string>
  reconnectEnabled?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  reconnectDelayMultiplier?: number
  maxReconnectDelay?: number
  withCredentials?: boolean
}

export interface SSEEventCallback<T = unknown> {
  (data: T): void
}

export interface SSEEventHandlers {
  [SSEEventType.Message]?: SSEEventCallback<MessageEvent>
  [SSEEventType.Open]?: SSEEventCallback<Event>
  [SSEEventType.Close]?: SSEEventCallback<Event>
  [SSEEventType.Error]?: SSEEventCallback<Event>
  [SSEEventType.StateChange]?: SSEEventCallback<SSEState>
}

export interface SSEMessage {
  id?: string
  event?: string
  data: string
  retry?: number
}

export interface ReconnectConfig {
  enabled: boolean
  interval: number
  maxAttempts: number
  delayMultiplier: number
  maxDelay: number
}
