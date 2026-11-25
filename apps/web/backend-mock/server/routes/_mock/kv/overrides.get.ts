/**
 * GET /_mock/kv/overrides — 列出全部单接口覆盖配置
 */
import { defineHandler } from 'nitro';

import { success } from '../../../utils/response';
import { listRouteOverrides } from '../../../utils/kv/mock-kv';

export default defineHandler(async () => {
  const list = await listRouteOverrides();
  return success({ list, total: list.length });
});
