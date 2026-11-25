/**
 * POST /_mock/cache/policies — 动态调整缓存 TTL / SWR / key 模板，立即生效
 * body: { name, maxAge?, swr?, keyTemplate? }
 */
import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';

import { ApiCode } from '../../../contracts/codes';
import { cachePolicySchema } from '../../../contracts/runtime-kv';
import { setCachePolicy } from '../../../utils/cache/policies';
import { bizError, success } from '../../../utils/response';

export default defineHandler(async (event) => {
  const parsed = cachePolicySchema.safeParse((await readBody(event)) ?? {});
  if (!parsed.success) {
    return bizError(
      ApiCode.BAD_REQUEST,
      `参数校验失败：${parsed.error.issues[0]?.path.join('.') ?? 'body'} ${parsed.error.issues[0]?.message ?? ''}`.trim(),
    );
  }
  return success(await setCachePolicy(parsed.data));
});
