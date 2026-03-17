import type { Ref } from 'vue'
import { ref } from 'vue'
import { WebSocketState } from './types'

export class WebSocketStateManager {
  private state: Ref<WebSocketState>
  private ws: WebSocket | null = null

  constructor() {
    this.state = ref(WebSocketState.Disconnected)
  }

  getState(): WebSocketState {
    return this.state.value
  }

  setState(newState: WebSocketState): void {
    if (this.state.value !== newState) {
      this.state.value = newState
    }
  }

  getWebSocket(): WebSocket | null {
    return this.ws
  }

  setWebSocket(ws: WebSocket | null): void {
    this.ws = ws
  }

  clearWebSocket(): void {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }

  isConnecting(): boolean {
    return this.state.value === WebSocketState.Connecting
  }

  isConnected(): boolean {
    return this.state.value === WebSocketState.Connected
  }

  isDisconnected(): boolean {
    return this.state.value === WebSocketState.Disconnected
  }

  isError(): boolean {
    return this.state.value === WebSocketState.Error
  }

  getStateRef(): Ref<WebSocketState> {
    return this.state
  }
}
