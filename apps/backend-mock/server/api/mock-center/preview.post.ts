import { defineEventHandler, readBody } from '#imports';

import { bizError, envelope } from '../../utils/response';
import { renderPreview } from '../../utils/templates';

/** 校验响应模板并原样回显样本；不生成任何数据，失败只回业务码 400 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const preview = renderPreview(body.template);

  if ('error' in preview) return bizError(400, preview.error);
  return envelope(200, { sample: preview.sample }, '模板预览成功');
});
