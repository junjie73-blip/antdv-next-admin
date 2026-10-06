import { defineEventHandler, readBody } from '#imports';

import { isGeneratedId } from '../../utils/generated';
import { bizError, envelope } from '../../utils/response';
import { unregisterGenerated } from '../../utils/store';

/**
 * 删除面板生成的自定义接口。
 *
 * legacy 还要 rmSync 掉 mock/generated/<id>.fake.ts 并在校验残留时回 500；
 * Nitro 下定义只存在于 store，unregisterGenerated 会连带清掉运行时覆盖、统计与清单条目，
 * 因此不存在"文件未删除"的中间态。
 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!isGeneratedId(id)) return bizError(400, '接口标识不合法');

  const removed = unregisterGenerated(id);
  if (!removed) return bizError(404, `自定义接口不存在：${id}`);

  return envelope(
    200,
    { file: removed.file, id },
    `接口「${removed.key}」已删除`,
  );
});
