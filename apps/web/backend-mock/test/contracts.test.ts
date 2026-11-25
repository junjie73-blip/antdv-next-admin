import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiCode, CODE_CATALOG, CODE_SEGMENTS, descriptorOfCode, isSuccessCode, messageOfCode } from '../server/contracts/codes';
import { ApiError, badRequest, forbidden, internalError, isApiError, normalizeError, notFound } from '../server/contracts/errors';
import { bizTargetOf, buildOperationLog } from '../server/contracts/operation-log';
import { PermissionCode, hasPermission, permissionOf, requirePermission } from '../server/contracts/permissions';
import type { MockRouteInput } from '../server/utils/runtime';
import { accounts, issueToken } from '../server/utils/accounts';
import { flattenQuery, pageOf, requiredString, validate } from '../server/contracts/validation';

const context: MockRouteInput = {
  body: {},
  data: {},
  headers: {},
  params: { id: '12' },
  path: '/system/user/12',
  query: {},
  clientIp: '127.0.0.1',
  traceId: 'trace-contract-1',
};

describe('统一状态码目录', () => {
  it('每个登记码都有文案、分段与 HTTP 语义', () => {
    expect(CODE_CATALOG.length).toBeGreaterThanOrEqual(10);
    for (const item of CODE_CATALOG) {
      expect(item.message.length).toBeGreaterThan(0);
      expect(CODE_SEGMENTS[item.category]).toBeTruthy();
      expect(messageOfCode(item.code)).toBe(item.message);
      expect(isSuccessCode(item.code)).toBe(item.success);
      expect(descriptorOfCode(item.code)).toBe(item);
    }
  });

  it('未登记的码有兜底文案，不会把 undefined 泄漏给调用方', () => {
    expect(messageOfCode(4999)).toBe('请求失败');
    expect(descriptorOfCode(4999)).toBeUndefined();
  });
});

describe('标准错误模型', () => {
  it('错误信封固定三字段且 data 恒为 null', () => {
    expect(badRequest('参数错误').toEnvelope()).toEqual({
      code: ApiCode.BAD_REQUEST,
      data: null,
      message: '参数错误',
    });
    expect(notFound('用户').code).toBe(404);
    expect(forbidden().code).toBe(403);
  });

  it('字段明细保留在异常对象上，未知异常一律规整为 500', () => {
    const error = new ApiError(400, '参数校验失败', [
      { field: 'query.pageNum', message: '必须大于 0', code: 'too_small' },
    ]);
    expect(error.items[0]?.field).toBe('query.pageNum');
    expect(normalizeError(error)).toBe(error);

    const unknown = normalizeError(new Error('db password=secret'));
    expect(unknown.code).toBe(500);
    expect(unknown.message).toBe('服务器内部错误');
    expect(isApiError(unknown)).toBe(true);
    expect(internalError('boom').code).toBe(500);
  });
});

describe('zod 参数校验', () => {
  it('校验失败返回 400 且 message 带字段路径', () => {
    const schema = z.object({ password: requiredString('密码') });
    try {
      validate(schema, {}, 'body');
      throw new Error('未抛出异常');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      const apiError = error as ApiError;
      expect(apiError.code).toBe(400);
      expect(apiError.items[0]?.field).toBe('body.password');
      expect(apiError.message).toContain('body.password');
    }
  });

  it('校验成功返回解析后的强类型值', () => {
    const schema = z.object({ password: requiredString('密码') });
    expect(validate(schema, { password: ' abc ', extra: 1 }, 'body')).toEqual({
      password: 'abc',
    });
  });

  it('同名多值拍平，分页参数按 pageNum 优先并兼容 page', () => {
    expect(flattenQuery({ keyword: ['a', 'b'], status: undefined })).toEqual({
      keyword: 'a',
      status: undefined,
    });
    expect(pageOf({ pageNum: '2', pageSize: '20' })).toEqual({ pageNum: 2, pageSize: 20 });
    expect(pageOf({ page: '3', pageSize: '5' })).toEqual({ pageNum: 3, pageSize: 5 });
  });
});

describe('权限标识', () => {
  it('权限码按 模块:资源:动作 拼接', () => {
    expect(permissionOf('/system/user', 'list')).toBe('system:user:list');
    expect(PermissionCode.USER_REMOVE).toBe('system:user:remove');
  });

  it('无 token 回落 admin；受限账号缺少权限码时抛 403', () => {
    const admin = requirePermission(context, PermissionCode.USER_ADD);
    expect(admin.profile.username).toBe('admin');

    const custom = accounts.find((item) => item.profile.username === 'custom');
    expect(custom).toBeDefined();
    expect(hasPermission(custom!, PermissionCode.USER_LIST)).toBe(true);
    expect(() =>
      requirePermission(
        { headers: { authorization: issueToken(custom!) } },
        PermissionCode.USER_REMOVE,
      ),
    ).toThrowError('没有操作权限');
  });
});

describe('操作日志字段', () => {
  it('从路径推导业务对象，失败请求标记 high 与 error', () => {
    expect(bizTargetOf('/system/user/12')).toEqual({ bizId: '12', bizType: 'user' });
    expect(bizTargetOf('/system/user/list')).toEqual({ bizType: 'list' });

    const log = buildOperationLog({
      code: 404,
      context,
      detail: '{}',
      durationMs: 12,
      method: 'DELETE',
      module: 'system/user',
      path: '/system/user/12',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      endedAt: new Date('2026-01-01T00:00:00.012Z'),
    });
    expect(log.bizType).toBe('user');
    expect(log.bizId).toBe('12');
    expect(log.result).toBe('error');
    expect(log.risk).toBe('high');
    expect(log.traceId).toBe('trace-contract-1');
    expect(log.durationMs).toBe(12);
    expect(log.errorMessage).toBe('业务码 404');
  });
});
