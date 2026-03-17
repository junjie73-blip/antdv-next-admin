import type { AxiosError, AxiosInstance } from 'axios'
import type { RetryOptions } from './types'

const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY = 1000

export function createRetryInterceptor(
  instance: AxiosInstance,
  options: RetryOptions = {},
) {
  const { count = DEFAULT_RETRY_COUNT, delay = DEFAULT_RETRY_DELAY, condition } = options

  let retryCount = 0

  instance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const config = error.config

      if (!config) {
        return Promise.reject(error)
      }

      const shouldRetry = condition ? condition(error as Error) : isRetryableError(error)

      if (shouldRetry && retryCount < count) {
        retryCount++
        await sleep(delay)
        return instance.request(config)
      }

      retryCount = 0
      return Promise.reject(error)
    },
  )
}

function isRetryableError(error: AxiosError): boolean {
  return !error.response || error.code === 'ECONNABORTED'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { count = DEFAULT_RETRY_COUNT, delay = DEFAULT_RETRY_DELAY, condition } = options

  let lastError: Error | null = null

  for (let i = 0; i <= count; i++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error as Error

      const shouldRetry = condition ? condition(lastError) : true
      if (!shouldRetry || i === count) {
        throw lastError
      }

      await sleep(delay)
    }
  }

  throw lastError
}
