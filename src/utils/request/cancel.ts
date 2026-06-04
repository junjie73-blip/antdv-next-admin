import type { PendingRequest, RequestQueue } from './types'

export function createRequestQueue(): RequestQueue {
  const pending = new Map<string, PendingRequest>()

  const pause = () => {
    pending.forEach((request) => {
      request.cancel()
    })
    pending.clear()
  }

  const resume = () => {
    // 恢复功能由外部调用者重新发起请求
  }

  const clear = () => {
    pending.forEach((request) => {
      request.cancel()
    })
    pending.clear()
  }

  return {
    pending,
    pause,
    resume,
    clear,
  }
}

export const requestQueue = createRequestQueue()
