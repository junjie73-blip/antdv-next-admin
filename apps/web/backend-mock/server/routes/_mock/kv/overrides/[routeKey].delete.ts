/**
 * DELETE /_mock/kv/overrides/:routeKey — 删除单接口覆盖（routeKey 需 URL 编码）
 * 例：DELETE /_mock/kv/overrides/GET%20%2Fmenus
 */
import { defineHandler } from 'nitro';
import { getRouterParams } from 'nitro/h3';

import { removeRouteOverride } from '../../../../utils/kv/mock-kv';
import { success } from '../../../../utils/response';

export default defineHandler(async (event) => {
  const { routeKey } = getRouterParams(event) as { routeKey?: string };
  if (!routeKey) return success({ removed: false, routeKey: null });

  // Nitro 对 `%2F` 的解码行为与方括号不同：参数可能是 `[GET]%2Fmenus`
  // 也可能是 `[GET]/menus`。两种形态都尝试，避免删不掉配置却返回成功。
  const candidates = new Set([routeKey]);
  try {
    candidates.add(decodeURIComponent(routeKey));
  } catch {
    // 非法转义序列保持原值
  }
  let removed = false;
  for (const candidate of candidates) {
    if (await removeRouteOverride(candidate)) removed = true;
  }
  return success({ removed, routeKey });
});
