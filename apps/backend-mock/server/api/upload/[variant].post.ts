import dayjs from 'dayjs';

import { defineMockRoute } from '../../utils/runtime';
import { uploadSuccess } from '../../utils/upload';

/**
 * 上传变体：`/api/upload/{image,avatar,custom,status,validate,manual,drag-sort}`
 *
 * 「上传」示例页按演示场景写了 8 个不同的 `action`，行为上它们只需要同一个成功响应，
 * 差异留给变体名（决定返回的 `storedPath` 与预览图配色）。
 * 新增演示场景不必再来加文件——路径带参数即可命中。
 */
export default defineMockRoute({
  handler({ params }) {
    return uploadSuccess(
      params.variant || 'upload',
      dayjs().format('YYYY-MM-DD HH:mm:ss'),
    );
  },
  method: 'POST',
  path: '/upload/:variant',
  title: '文件上传（按场景变体）',
});
