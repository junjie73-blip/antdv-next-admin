import { FILE_DB } from '../../../utils/db/file';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const idx = FILE_DB.findIndex((f) => f.id === id);

    if (idx === -1) {
      return bizError(404, '文件不存在');
    }

    FILE_DB.splice(idx, 1);

    return success(null, '删除文件成功');
  },
  method: 'DELETE',
  path: '/system/file/:id',
});
