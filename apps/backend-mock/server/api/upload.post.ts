import dayjs from 'dayjs';

import { defineMockRoute } from '../utils/runtime';
import { uploadSuccess } from '../utils/upload';

/**
 * 基础上传（组件示例「上传」页里 `action="/api/upload"` 的那几个拖拽/多文件演示）
 *
 * 这些接口以前**一个都没有**：页面选完文件必然变红「上传失败」，
 * 因为 dev 下 `/api` 全量透传到 Nitro，而 Nitro 里没有 `/upload` 路由（404）。
 * 真实上传由后端承担，mock 只需要把「成功长什么样」演出来，见 utils/upload.ts。
 */
export default defineMockRoute({
  handler: () =>
    uploadSuccess('upload', dayjs().format('YYYY-MM-DD HH:mm:ss')),
  method: 'POST',
  path: '/upload',
  title: '文件上传（基础）',
});
