import type { FileRecord, FileType } from '../../../utils/db/file';

import dayjs from 'dayjs';

import {
  FILE_DB,
  formatFileSize,
  nextFileId,
  UPLOADERS,
} from '../../../utils/db/file';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const uploader = UPLOADERS[0]!;

    const newFile: FileRecord = {
      id: nextFileId(),
      name: String(data.name || 'unknown_file'),
      type: (data.type as FileType) || 'other',
      extension: String(data.extension || ''),
      size: Number(data.size || 0),
      sizeDisplay: formatFileSize(Number(data.size || 0)),
      mimeType: String(data.mimeType || 'application/octet-stream'),
      path: String(data.path || '/'),
      parentId: data.parentId === undefined ? null : Number(data.parentId),
      uploader: uploader.name,
      uploaderId: uploader.id,
      createdAt: now,
      updatedAt: now,
      isFolder: false,
    };

    FILE_DB.push(newFile);

    return success(newFile, '文件上传成功');
  },
  method: 'POST',
  path: '/system/file/upload',
});
