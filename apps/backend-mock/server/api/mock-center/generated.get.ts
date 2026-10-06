import { defineEventHandler } from '#imports';

import { envelope } from '../../utils/response';
import { listGenerated } from '../../utils/store';

export default defineEventHandler(() =>
  envelope(200, listGenerated(), '获取自定义接口成功'),
);
