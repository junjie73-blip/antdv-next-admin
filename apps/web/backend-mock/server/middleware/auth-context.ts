/**
 * 认证上下文中间件
 *
 * 解析 Authorization 并把账号 / 权限码写入 event.context，供 handler 做服务端鉴权。
 * 默认保持 mock 的"免登录可浏览"语义（无 token 回落 admin），避免影响快照与前端联调；
 * 需要验证未登录行为时设置 `MOCK_AUTH_ENFORCE=1`，未带 token 的请求会收到 code 401。
 *
 * 迁移到真实后端时，只需把 `resolveAccount` 替换为验签 / 会话查询实现，
 * 下游 `requirePermission` 与操作日志的 actor 逻辑保持不变。
 */

import { defineMiddleware } from 'nitro';
import { getRequestHeaders, setResponseStatus } from 'nitro/h3';

import { ApiCode } from '../contracts/codes';
import { accountOfHeaders, resolveAccount } from '../utils/accounts';
import { envelope } from '../utils/response';

export default defineMiddleware(async (event, next) => {
  const headers = Object.fromEntries(
    Object.entries(getRequestHeaders(event)).map(([name, value]) => [
      name.toLowerCase(),
      value ?? '',
    ]),
  );
  const account = resolveAccount(headers);
  Object.assign(event.context, {
    account,
    permissions: account.permissions,
  });

  if (
    process.env.MOCK_AUTH_ENFORCE === '1' &&
    accountOfHeaders(headers) === undefined
  ) {
    // 业务错误仍走 HTTP 200 + code 401，与前端 request 层的判定方式一致
    setResponseStatus(event, 200);
    return envelope(ApiCode.UNAUTHORIZED, null, '未登录或登录已过期');
  }

  return next();
});
