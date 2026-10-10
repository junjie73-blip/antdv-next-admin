import type { Ref } from 'vue';

import { ref } from 'vue';

import { WebSocketState } from './types';

export class WebSocketStateManager {
  private state: Ref<WebSocketState>;
  private ws: null | WebSocket = null;

  constructor() {
    this.state = ref(WebSocketState.Disconnected);
  }

  clearWebSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
  }

  getState(): WebSocketState {
    return this.state.value;
  }

  getStateRef(): Ref<WebSocketState> {
    return this.state;
  }

  getWebSocket(): null | WebSocket {
    return this.ws;
  }

  isConnected(): boolean {
    return this.state.value === WebSocketState.Connected;
  }

  isConnecting(): boolean {
    return this.state.value === WebSocketState.Connecting;
  }

  isDisconnected(): boolean {
    return this.state.value === WebSocketState.Disconnected;
  }

  isError(): boolean {
    return this.state.value === WebSocketState.Error;
  }

  setState(newState: WebSocketState): void {
    if (this.state.value !== newState) {
      this.state.value = newState;
    }
  }

  setWebSocket(ws: null | WebSocket): void {
    this.ws = ws;
  }
}
