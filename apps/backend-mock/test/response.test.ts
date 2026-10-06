import { describe, expect, it } from 'vitest'

import { bizError, envelope, httpError, success } from '../server/utils/response'

describe('响应信封', () => {
  it('固定三个字段 code / data / message，与后端 R<T> 一致', () => {
    expect(envelope(200, { id: 1 }, 'ok')).toEqual({ code: 200, data: { id: 1 }, message: 'ok' })
    expect(Object.keys(envelope(200, null, 'ok'))).toEqual(['code', 'data', 'message'])
  })

  it('success 缺省 message 为 ok', () => {
    expect(success({ a: 1 })).toEqual({ code: 200, data: { a: 1 }, message: 'ok' })
    expect(success(null, '删除成功')).toEqual({ code: 200, data: null, message: '删除成功' })
  })

  it('bizError 只表达业务失败，不改 HTTP 状态', () => {
    expect(bizError(400, '用户名或密码错误')).toEqual({ code: 400, data: null, message: '用户名或密码错误' })
    expect(bizError(404, '用户不存在').code).toBe(404)
  })

  it('httpError 用同一形状承载 HTTP 层错误', () => {
    expect(httpError(503, 'Mock 服务已全局停用')).toEqual({ code: 503, data: null, message: 'Mock 服务已全局停用' })
  })
})
