import type { Ref } from 'vue'
import { ref } from 'vue'
import { SSEState } from './types'

export class SSEStateManager {
  private state: Ref<SSEState>
  private eventSource: EventSource | null = null

  constructor() {
    this.state = ref(SSEState.Disconnected)
  }

  getState(): SSEState {
    return this.state.value
  }

  setState(newState: SSEState): void {
    if (this.state.value !== newState) {
      this.state.value = newState
    }
  }

  getEventSource(): EventSource | null {
    return this.eventSource
  }

  setEventSource(eventSource: EventSource | null): void {
    this.eventSource = eventSource
  }

  clearEventSource(): void {
    if (this.eventSource) {
      this.eventSource.onopen = null
      this.eventSource.onerror = null
      this.eventSource.onmessage = null
      this.eventSource.close()
      this.eventSource = null
    }
  }

  isConnecting(): boolean {
    return this.state.value === SSEState.Connecting
  }

  isConnected(): boolean {
    return this.state.value === SSEState.Connected
  }

  isDisconnected(): boolean {
    return this.state.value === SSEState.Disconnected
  }

  isError(): boolean {
    return this.state.value === SSEState.Error
  }

  getStateRef(): Ref<SSEState> {
    return this.state
  }
}
