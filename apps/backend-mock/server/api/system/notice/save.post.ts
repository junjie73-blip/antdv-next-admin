import dayjs from 'dayjs';

import { NOTICE_DB } from '../../../utils/db/notice';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新增 / 编辑消息（`POST /system/notice/save`）
 *
 * 这条路由以前**不存在**：通知管理页的「新增消息」把表单 POST 到 `/system/notice/save`，
 * Nitro 那边没有对应文件，dev 下 `/api` 全量透传，于是返回 405，
 * 页面只弹一句「保存失败」——用户看到的是"按钮坏了"，而不是"后端没这个接口"。
 *
 * 语义上它同时承担新增与更新（带 `id` 就是改），与前端 `saveNotice()` 一个函数对应，
 * 所以这里也只有一个文件，不拆成 `:id.put`。
 */
export default defineMockRoute({
  handler({ data }) {
    const title = String(data.title ?? '').trim();
    const content = String(data.content ?? '').trim();

    if (!title) return bizError(400, '消息标题不能为空');
    if (!content) return bizError(400, '消息内容不能为空');

    const type = (Number(data.type) || 2) as 1 | 2 | 3;
    const priority = (Number(data.priority) || 0) as 0 | 1 | 2;
    const status = Number(data.status) === 1 ? 1 : 0;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    /** 编辑：按 id 就地覆盖，保留原发送人与发送时间 */
    if (data.id !== undefined && data.id !== null && data.id !== '') {
      const id = Number(data.id);
      const target = NOTICE_DB.find((item) => item.id === id);
      if (!target) return bizError(404, '消息不存在');

      target.title = title;
      target.content = content;
      target.type = type;
      target.priority = priority;
      target.status = status;
      target.readTime = status === 1 ? now : undefined;

      return success(target, '修改成功');
    }

    /** 新增：id 取当前最大值 +1，内存库按插入顺序即可 */
    const nextId = NOTICE_DB.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const created = {
      content,
      id: nextId,
      priority,
      readTime: status === 1 ? now : undefined,
      sender: String(data.sender || '系统管理员'),
      sendTime: String(data.sendTime || now),
      status: status as 0 | 1,
      title,
      type,
    };

    NOTICE_DB.push(created);

    return success(created, '发布成功');
  },
  method: 'POST',
  path: '/system/notice/save',
  title: '新增/编辑消息通知',
});
