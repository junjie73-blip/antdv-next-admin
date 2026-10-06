import { defineEventHandler } from '#imports';

import { envelope } from '../../utils/response';
import { PRESET_TEMPLATES } from '../../utils/templates';

export default defineEventHandler(() =>
  envelope(200, PRESET_TEMPLATES, '获取响应模板成功'),
);
