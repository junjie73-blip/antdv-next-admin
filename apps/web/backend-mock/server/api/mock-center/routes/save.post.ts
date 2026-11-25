import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';

import {
  saveGeneratedDefinition,
  validateDefinition,
} from '../../../utils/generated';
import { bizError, envelope } from '../../../utils/response';

/**
 * 保存自定义接口定义：生成式响应能力已下线，这里只做校验与回显，
 * 保持既有请求参数与返回结构兼容，不再注册运行时假路由。
 */
export default defineHandler(async (event) => {
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
