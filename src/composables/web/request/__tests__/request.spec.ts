import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCode, RequestError } from '../error'
import { requestCache } from '../executor'
import { request } from '../http'

interface MockedCall {
  url: string
  init: RequestInit
}

type MockedResponse = { kind: 'ok'; value: unknown } | { kind: 'err'; error: unknown }

const h = vi.hoisted(() => {
  // 对齐 @vueuse/core 的 UseFetchReturn：data / error 是 ref，blob()/text() 等也返回同构对象
  const asReturn = (value: unknown) => ({ data: { value }, error: { value: undefined } })
  return {
    calls: [] as MockedCall[],
    queue: [] as MockedResponse[],
    refreshAccessToken: vi.fn<() => Promise<string>>(),
    forceLogout: vi.fn<() => void>(),
    loggingOut: false,
    asReturn,
  }
})

// 请求层依赖大量浏览器/Pinia 上下文，这里只替换 fetcher，专测 executor 的编排逻辑
// 注意：真实 createFetch 返回的是同步 UseFetchReturn（可 then 的对象），故这里不能写成 async
vi.mock('../fetcher', () => ({
  createFetcher: () => (url: string, init: RequestInit) => {
    h.calls.push({ url, init })
    const item = h.queue.shift()
    if (!item) throw new Error('测试未预置响应')
    if (item.kind === 'err') return { data: { value: undefined }, error: { value: item.error } }
    return {
      ...h.asReturn(item.value),
      blob: async () => h.asReturn(item.value),
      arrayBuffer: async () => h.asReturn(item.value),
      text: async () => h.asReturn(item.value),
    }
  },
  isAuthEndpoint: (url?: string) => !!url && /auth\/(login|logout|refresh|register|captcha)/.test(url),
  forceLogout: h.forceLogout,
  isLoggingOutNow: () => h.loggingOut,
  refreshAccessToken: h.refreshAccessToken,
}))

const ok = (value: unknown): MockedResponse => ({ kind: 'ok', value })
const fail = (error: unknown): MockedResponse => ({ kind: 'err', error })

const unauthorizedError = () => new RequestError('登录已过期', { status: 401, code: ErrorCode.UNAUTHORIZED })
const serverError = () => new RequestError('服务器开小差了', { status: 500, code: 500 })

function firstCall(): MockedCall {
  const call = h.calls[0]
  if (!call) throw new Error('断言失败：没有任何请求发出')
  return call
}

beforeEach(() => {
  vi.restoreAllMocks()
  h.calls.length = 0
  h.queue.length = 0
  h.loggingOut = false
  h.refreshAccessToken.mockReset()
  h.forceLogout.mockReset()
  requestCache.clear()
})

describe('请求体归一化', () => {
  it('FormData 原样透传，不会被 JSON 序列化成 "{}"', async () => {
    h.queue.push(ok({ code: 200, data: null }))
    const formData = new FormData()
    formData.append('file', new Blob(['x']), 'a.txt')

    await request.post('/upload', formData)

    expect(firstCall().init.body).toBe(formData)
  })

  it('普通对象序列化为 JSON 字符串', async () => {
    h.queue.push(ok({ code: 200, data: null }))

    await request.post('/user', { name: '张三' })

    expect(firstCall().init.body).toBe(JSON.stringify({ name: '张三' }))
  })

  it('DELETE 可通过 opts.body 携带请求体', async () => {
    h.queue.push(ok({ code: 200, data: { removed: 1 } }))

    await request.delete('/user-group/g1/members', undefined, { body: { userIds: ['u1'] } })

    expect(firstCall().init.method).toBe('DELETE')
    expect(firstCall().init.body).toBe(JSON.stringify({ userIds: ['u1'] }))
  })
})

describe('响应语义', () => {
  it('resolve 完整 envelope，不做自动拆包', async () => {
    const envelope = { code: 200, message: '操作成功', data: { id: 'u1' } }
    h.queue.push(ok(envelope))

    await expect(request.get('/user/u1')).resolves.toEqual(envelope)
  })

  it('responseType=blob 时返回二进制结果', async () => {
    const blob = new Blob(['file'])
    h.queue.push(ok(blob))

    await expect(request.get('/export/users', undefined, { responseType: 'blob' })).resolves.toBe(blob)
    expect(firstCall().init.method).toBe('GET')
  })
})

describe('URL 与参数', () => {
  it('GET 参数拼接进 query 并跳过 null/undefined', async () => {
    h.queue.push(ok({ code: 200, data: null }))

    await request.get('/user/list', { page: 1, name: null, keyword: 'a b', empty: undefined })

    expect(firstCall().url).toBe('/user/list?page=1&keyword=a%20b')
  })
})

describe('重试', () => {
  it('5xx 按 retries 次数重试后成功', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    h.queue.push(fail(serverError()), fail(serverError()), ok({ code: 200, data: 'ok' }))

    await expect(request.get('/flaky', undefined, { retries: 2, retryDelay: 1 })).resolves.toEqual({
      code: 200,
      data: 'ok',
    })
    expect(h.calls).toHaveLength(3)
  })
})

describe('401 令牌刷新与重放', () => {
  it('收到 401 先刷新再重放一次', async () => {
    h.refreshAccessToken.mockResolvedValue('new-token')
    h.queue.push(fail(unauthorizedError()), ok({ code: 200, data: { list: [] } }))

    await expect(request.get('/user/list')).resolves.toEqual({ code: 200, data: { list: [] } })
    expect(h.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(h.calls).toHaveLength(2)
  })

  it('刷新失败则强制登出并抛出原错误', async () => {
    h.refreshAccessToken.mockRejectedValue(new Error('refresh failed'))
    h.queue.push(fail(unauthorizedError()))

    await expect(request.get('/user/list')).rejects.toBeInstanceOf(RequestError)
    expect(h.forceLogout).toHaveBeenCalledTimes(1)
    expect(h.calls).toHaveLength(1)
  })

  it('认证接口自身的 401 不触发刷新重放', async () => {
    h.refreshAccessToken.mockResolvedValue('x')
    h.queue.push(fail(unauthorizedError()))

    await expect(request.post('/auth/login', { username: 'a' })).rejects.toBeInstanceOf(RequestError)
    expect(h.refreshAccessToken).not.toHaveBeenCalled()
    expect(h.calls).toHaveLength(1)
  })
})

describe('缓存与并发去重', () => {
  it('GET + cache:true 命中缓存后不再发请求', async () => {
    h.queue.push(ok({ code: 200, data: 1 }))

    await request.get('/cached', undefined, { cache: true })
    await request.get('/cached', undefined, { cache: true })

    expect(h.calls).toHaveLength(1)
  })

  it('cacheOnly 未命中时抛错且不发请求', async () => {
    await expect(request.get('/cold', undefined, { cache: true, cacheOnly: true })).rejects.toThrow('缓存未命中')
    expect(h.calls).toHaveLength(0)
  })

  it('并发相同请求只发出一次', async () => {
    h.queue.push(ok({ code: 200, data: 'once' }))

    const [a, b] = await Promise.all([request.get('/same'), request.get('/same')])

    expect(a).toEqual({ code: 200, data: 'once' })
    expect(b).toEqual({ code: 200, data: 'once' })
    expect(h.calls).toHaveLength(1)
  })

  it('requestCache.clearByUrl 只清除指定接口的缓存', async () => {
    h.queue.push(ok({ code: 200, data: 1 }), ok({ code: 200, data: 2 }))

    await request.get('/a', undefined, { cache: true })
    await request.get('/b', undefined, { cache: true })
    expect(requestCache.size()).toBe(2)

    requestCache.clearByUrl('/a')

    expect(requestCache.size()).toBe(1)
  })
})
