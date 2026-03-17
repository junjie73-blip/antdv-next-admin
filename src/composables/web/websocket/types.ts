export enum WebSocketState {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum WebSocketEventType {
  Message = 'message',
  Open = 'open',
  Close = 'close',
  Error = 'error',
  StateChange = 'stateChange',
}

export interface WebSocketOptions {
  url: string
  protocols?: string | string[]
  heartbeatInterval?: number
  heartbeatTimeout?: number
  reconnectEnabled?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  reconnectDelayMultiplier?: number
  maxReconnectDelay?: number
}

export interface WebSocketEventCallback<T = unknown> {
  (data: T): void
}

export interface WebSocketEventHandlers {
  [WebSocketEventType.Message]?: WebSocketEventCallback<string | ArrayBuffer | Blob>
  [WebSocketEventType.Open]?: WebSocketEventCallback<Event>
  [WebSocketEventType.Close]?: WebSocketEventCallback<CloseEvent>
  [WebSocketEventType.Error]?: WebSocketEventCallback<Event>
  [WebSocketEventType.StateChange]?: WebSocketEventCallback<WebSocketState>
}

export interface HeartbeatConfig {
  interval: number
  timeout: number
  message: string | object
}

export interface ReconnectConfig {
  enabled: boolean
  interval: number
  maxAttempts: number
  delayMultiplier: number
  maxDelay: number
}
