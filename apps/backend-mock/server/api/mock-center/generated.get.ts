import { defineEventHandler } from '#imports';

import { envelope } from '../../utils/response';

/** 生成式自定义接口能力已下线，保持返回空清单以兼容既有调用 */
export default defineEventHandler(() =>
  envelope(200, [], '获取自定义接口成功'),
);
