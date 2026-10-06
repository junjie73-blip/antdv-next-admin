import type { FileRecord } from '../../../utils/db/file';

import dayjs from 'dayjs';

import { FILE_DB, nextFileId, UPLOADERS } from '../../../utils/db/file';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data, query }) {
    // legacy 从查询串取 parentId（而非请求体），保持同名参数来源不变
    const parentId = query.parentId ? Number(query.parentId) : null;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const uploader = UPLOADERS[0]!;

    const newFolder: FileRecord = {
      id: nextFileId(),
      name: String(data.name || '新建文件夹'),
      type: 'folder',
      extension: '',
      size: 0,
      sizeDisplay: '-',
      mimeType: 'inode/directory',
      path: String(data.path || '/'),
      parentId,
      uploader: uploader.name,
      uploaderId: uploader.id,
      createdAt: now,
      updatedAt: now,
      isFolder: true,
    };

    FILE_DB.push(newFolder);

    return success(newFolder, '文件夹创建成功');
  },
  method: 'POST',
  path: '/system/file/folder',
});
