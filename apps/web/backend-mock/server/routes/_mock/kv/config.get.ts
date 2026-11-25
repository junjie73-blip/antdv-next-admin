/**
 * GET /_mock/kv/config — 查看 KV 全局 Mock 配置与覆盖项数量
 */
import { defineHandler } from 'nitro';

import { success } from '../../../utils/response';
import { getGlobalConfig, listRouteOverrides } from '../../../utils/kv/mock-kv';

export default defineHandler(async () => {
  const [config, overrides] = await Promise.all([
    getGlobalConfig(),
    listRouteOverrides(),
  ]);
  return success({ config, overrideCount: overrides.length });
});
