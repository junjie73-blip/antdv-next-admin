import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureRequest, resetRequestRuntime } from '../src/runtime';

/**
 * 提示渠道的契约钉在这份测试里：
 * - HTTP 非 2xx / 网络异常 → notification（全局通知）
 * - HTTP 2xx 但业务码失败 → message（轻量操作反馈）
 * 两条通道各只响一次，成功响应不弹提示。
 */
const h = vi.hoisted(() => ({
  createFetchOptions: null as any,
  messageError: vi.fn(),
  notificationError: vi.fn(),
  onError: vi.fn(),
}));

vi.mock('@antdv/popup-ui', () => ({
  message: { error: h.messageError },
  notification: { error: h.notificationError },
}));

vi.mock('@vueuse/core', () => ({
  createFetch: vi.fn((options: any) => {
    h.createFetchOptions = options;
    return () => ({});
  }),
}));

const { createFetcher } = await import('../src/fetcher');

function hooks() {
  return {
    afterFetch: h.createFetchOptions.options.afterFetch as (args: {
      data: unknown;
      response: Response;
    }) => Promise<{ data: unknown }>,
    onFetchError: h.createFetchOptions.options.onFetchError as (args: {
      error: unknown;
      response?: Response;
    }) => Promise<never>,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(status: number, statusText: string): Response {
  return new Response('<html><body>Not Found</body></html>', {
    status,
    statusText,
    headers: { 'content-type': 'text/html' },
  });
}

async function captureAfterFetch(data: unknown, response: Response) {
  try {
    await hooks().afterFetch({ data, response });
    return null;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  resetRequestRuntime();
  configureRequest({
    baseUrl: 'http://mock',
    onError: h.onError,
    onLogout: vi.fn(),
    tokens: {
      access: () => 'token',
      refresh: () => 'refresh',
      setAccess: () => {},
      setRefresh: () => {},
    },
  });
  h.createFetchOptions = null;
  h.messageError.mockClear();
  h.notificationError.mockClear();
  h.onError.mockClear();
  createFetcher();
});

describe('请求响应提示规则', () => {
  it('HTTP 200 + 业务码失败走 message，不弹全局通知', async () => {
    const response = jsonResponse({ code: 400, message: '用户名或密码错误' });
    const error = await captureAfterFetch(
      { code: 400, message: '用户名或密码错误' },
      response,
    );

    expect(error).toBeTruthy();
    await expect(
      hooks().onFetchError({ error, response }),
    ).rejects.toBe(error);

    expect(h.messageError).toHaveBeenCalledTimes(1);
    expect(h.messageError).toHaveBeenCalledWith('用户名或密码错误');
    expect(h.notificationError).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledOnce();
  });

  it('HTTP 404 非 JSON 响应走 notification，文案不露 HTML', async () => {
    const response = htmlResponse(404, 'Not Found');

    await expect(
      hooks().onFetchError({ error: new Error('Not Found'), response }),
    ).rejects.toMatchObject({ status: 404, code: 404 });

    expect(h.notificationError).toHaveBeenCalledTimes(1);
    expect(h.notificationError).toHaveBeenCalledWith('请求失败', {
      description: '请求的资源不存在',
    });
    expect(h.messageError).not.toHaveBeenCalled();
  });

  it('HTTP 500 JSON 错误体优先展示后端 message', async () => {
    const response = jsonResponse({ code: 500_000, message: '数据库连接失败' }, 500);

    await expect(
      hooks().onFetchError({ error: new Error('Internal Server Error'), response }),
    ).rejects.toMatchObject({ status: 500 });

    expect(h.notificationError).toHaveBeenCalledTimes(1);
    expect(h.notificationError).toHaveBeenCalledWith('请求失败', {
      description: '数据库连接失败',
    });
  });

  it('网络异常（无 response）也走 notification', async () => {
    await expect(
      hooks().onFetchError({ error: new TypeError('Failed to fetch') }),
    ).rejects.toMatchObject({ status: 0 });

    expect(h.notificationError).toHaveBeenCalledTimes(1);
    expect(h.notificationError).toHaveBeenCalledWith('请求失败', {
      description: '网络连接异常，请检查网络后重试',
    });
  });

  it('HTTP 2xx 非 JSON 响应原样透传，不触发任何提示', async () => {
    const response = new Response('plain text', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });

    await expect(
      hooks().afterFetch({ data: 'plain text', response }),
    ).resolves.toEqual({ data: 'plain text' });
    expect(h.messageError).not.toHaveBeenCalled();
    expect(h.notificationError).not.toHaveBeenCalled();
  });
});
