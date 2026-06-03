import type { MockWrapper } from '@alova/mock'
import type { RequestMeta } from './interface'
import { createAlovaMockAdapter } from '@alova/mock'
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import VueHook from 'alova/vue'
import { message } from 'antdv-next'
import { useUserStore } from '@/stores/modules/user'
import authMock from '../../../mock/auth'

import loginMock from '../../../mock/login'
import menuMock from '../../../mock/menu'
import tableMock from '../../../mock/table'
import userMock from '../../../mock/user'
import { AUTHORIZATION_KEY } from './constant'

interface CreateRequestClientOptions {
  customFetch?: typeof fetch
}

class AlovaRequestError<T = unknown> extends Error {
  data?: T
  status: number
  statusText: string

  constructor(message: string, options: { data?: T, status: number, statusText: string }) {
    super(message)
    this.name = 'RequestError'
    this.data = options.data
    this.status = options.status
    this.statusText = options.statusText
  }
}

const isMockEnabled = import.meta.env.VITE_MOCK === 'true'

export function createRequestClient(options: CreateRequestClientOptions = {}) {
  const fetchAdapter = adapterFetch({
    customFetch: options.customFetch,
  })

  const mockWrappers: MockWrapper[] = [
    authMock,
    loginMock,
    menuMock,
    tableMock,
    userMock,
  ]

  const mockAdapter = createAlovaMockAdapter(mockWrappers, {
    enable: isMockEnabled,
    httpAdapter: fetchAdapter,
    matchMode: 'methodurl',
    delay: [200, 500],
    mockRequestLogger: isMockEnabled,
  })

  return createAlova({
    baseURL: import.meta.env.VITE_APP_BASE_API || '',
    requestAdapter: mockAdapter,
    shareRequest: true,
    statesHook: VueHook,
    async beforeRequest(method) {
      if (method.config.meta?.token === false) {
        return
      }
      const userStore = useUserStore()
      if (!userStore.token) {
        return
      }
      method.config.headers = {
        ...(method.config.headers ?? {}),
        [AUTHORIZATION_KEY]: `Bearer ${userStore.token}`,
      }
    },
    responded: {
      async onSuccess(response) {
        const contentType = response.headers.get('content-type') ?? ''

        let payload: unknown
        if (contentType.includes('application/json')) {
          payload = await response.json()
        }
        else {
          const text = await response.clone().text()
          try {
            payload = JSON.parse(text)
          }
          catch {
            payload = await response.text()
          }
        }

        if (!response.ok) {
          const requestError = new AlovaRequestError(
            resolveErrorMessage(payload, `${response.status} ${response.statusText}`),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
            },
          )
          await reportRequestError(requestError)
          throw requestError
        }

        return payload
      },
      async onError(error) {
        await reportRequestError(error)
      },
    },
  })
}

export const http = createRequestClient()

async function reportRequestError(error: unknown) {
  if (error instanceof AlovaRequestError) {
    message.error(resolveErrorMessage(error.data, error.message))
    return
  }
  if (error instanceof Error) {
    message.error(error.message || '服务器错误')
    return
  }
  message.error('服务器错误')
}

function resolveErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'msg' in data && typeof data.msg === 'string') {
    return data.msg
  }
  return fallback
}

export type { RequestMeta }
export { AlovaRequestError as RequestError }
