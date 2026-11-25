/**
 * POST /_mock/cache/invalidate — 失效缓存（body: { name?: string }，缺省全部）
 */
import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';
import { z } from 'zod';

import { ApiCode } from '../../../contracts/codes';
import { invalidateMockCaches } from '../../../utils/cache/policies';
import { bizError, success } from '../../../utils/response';

const schema = z.object({ name: z.string().min(1).optional() }).strict();

export default defineHandler(async (event) => {
  const parsed = schema.safeParse((await readBody(event)) ?? {});
  if (!parsed.success) {
    return bizError(ApiCode.BAD_REQUEST, 'name 必须是非空字符串');
  }
  return success({ invalidated: invalidateMockCaches(parsed.data.name) });
});
