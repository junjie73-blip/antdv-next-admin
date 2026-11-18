import { defineEventHandler, readBody } from '#imports';

import { isGeneratedId } from '../../../utils/generated';
import { generatedFileOf } from '../../../utils/route-meta';
import { bizError, envelope } from '../../../utils/response';

/**
 * 删除自定义接口：生成式路由能力已下线，这里保留标识校验与返回结构兼容。
 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!isGeneratedId(id)) return bizError(400, '接口标识不合法');

  return envelope(200, { file: generatedFileOf(id), id }, `接口「${id}」已删除`);
});
