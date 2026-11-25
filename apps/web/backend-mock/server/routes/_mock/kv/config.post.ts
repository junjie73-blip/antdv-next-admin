/**
 * POST /_mock/kv/config — 动态修改全局 Mock 参数（默认延迟 / 覆盖开关）
 * body: { defaultDelayMs?: number, overridesEnabled?: boolean }
 */
import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';

import { ApiCode } from '../../../contracts/codes';
import { globalMockConfigSchema } from '../../../contracts/runtime-kv';
import { bizError, success } from '../../../utils/response';
import { setGlobalConfig } from '../../../utils/kv/mock-kv';

export default defineHandler(async (event) => {
  const raw = (await readBody(event)) ?? {};
  const allowed = globalMockConfigSchema
    .pick({ defaultDelayMs: true, overridesEnabled: true })
    .partial()
    .safeParse(raw);
  if (!allowed.success) {
    return bizError(
      ApiCode.BAD_REQUEST,
      `参数校验失败：${allowed.error.issues[0]?.path.join('.') ?? 'body'} ${allowed.error.issues[0]?.message ?? ''}`.trim(),
    );
  }
  return success(await setGlobalConfig(allowed.data));
});
