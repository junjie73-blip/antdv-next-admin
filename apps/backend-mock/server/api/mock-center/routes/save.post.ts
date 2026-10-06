import { defineEventHandler, readBody } from '#imports';

import {
  saveGeneratedDefinition,
  validateDefinition,
} from '../../utils/generated';
import { bizError, envelope } from '../../utils/response';

/**
 * 保存面板生成的自定义接口。
 *
 * legacy 会落地 mock/generated/<id>.fake.ts 让插件热加载，写文件失败要回 500；
 * Nitro 下定义持久化进 store（server/utils/store.ts 的 generated 字段），
 * 由 server/middleware/generated.ts 立即生效，落盘失败已在 store.persist 内部降级为告警，
 * 所以这里没有 500 分支，file 字段仅作为面板展示用的虚拟路径。
 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const validated = validateDefinition(body);
  if (validated.error || !validated.value)
    return bizError(400, validated.error ?? '接口定义不合法');

  const item = saveGeneratedDefinition(validated.value);
  return envelope(
    200,
    item,
    `接口「${validated.value.key}」已保存，热更新即刻生效`,
  );
});
