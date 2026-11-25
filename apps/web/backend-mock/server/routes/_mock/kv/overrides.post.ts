/**
 * POST /_mock/kv/overrides — 新增/更新单接口覆盖，写入后下一次请求立即生效
 *
 * body: { routeKey: 'GET /menus', delayMs?: number, enabled?: boolean,
 *        statusCode?: number, response?: unknown, note?: string }
 */
import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';

import { ApiCode } from '../../../contracts/codes';
import { routeOverrideSchema } from '../../../contracts/runtime-kv';
import { bizError, success } from '../../../utils/response';
import { setRouteOverride } from '../../../utils/kv/mock-kv';

export default defineHandler(async (event) => {
  const parsed = routeOverrideSchema.safeParse((await readBody(event)) ?? {});
  if (!parsed.success) {
    return bizError(
      ApiCode.BAD_REQUEST,
      `参数校验失败：${parsed.error.issues[0]?.path.join('.') ?? 'body'} ${parsed.error.issues[0]?.message ?? ''}`.trim(),
    );
  }
  return success(await setRouteOverride(parsed.data));
});
