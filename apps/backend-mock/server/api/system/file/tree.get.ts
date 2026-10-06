import { FILE_DB } from '../../../utils/db/file';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

interface FileTreeNode {
  children: FileTreeNode[];
  key: number;
  title: string;
}

export default defineMockRoute({
  handler() {
    const folders = FILE_DB.filter((f) => f.isFolder);

    function buildTree(parentId: null | number): FileTreeNode[] {
      return folders
        .filter((f) => f.parentId === parentId)
        .map((folder) => ({
          key: folder.id,
          title: folder.name,
          children: buildTree(folder.id),
        }));
    }

    return success(buildTree(null), '获取文件树成功');
  },
  method: 'GET',
  path: '/system/file/tree',
});
