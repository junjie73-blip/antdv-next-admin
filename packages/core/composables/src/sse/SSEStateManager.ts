import type { Ref } from 'vue';

import { ref } from 'vue';

import { SSEState } from './types';

export class SSEStateManager {
  private eventSource: EventSource | null = null;
  private state: Ref<SSEState>;

  constructor() {
    this.state = ref(SSEState.Disconnected);
  }

  clearEventSource(): void {
    if (this.eventSource) {
      this.eventSource.onopen = null;
      this.eventSource.onerror = null;
      this.eventSource.onmessage = null;
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  getEventSource(): EventSource | null {
    return this.eventSource;
  }

  getState(): SSEState {
    return this.state.value;
  }

  getStateRef(): Ref<SSEState> {
    return this.state;
  }

  isConnected(): boolean {
    return this.state.value === SSEState.Connected;
  }

  isConnecting(): boolean {
    return this.state.value === SSEState.Connecting;
  }

  isDisconnected(): boolean {
    return this.state.value === SSEState.Disconnected;
  }

  isError(): boolean {
    return this.state.value === SSEState.Error;
  }

  setEventSource(eventSource: EventSource | null): void {
    this.eventSource = eventSource;
  }

  setState(newState: SSEState): void {
    if (this.state.value !== newState) {
      this.state.value = newState;
    }
  }
}
