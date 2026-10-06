import { DICT_TYPE_DB } from '../../../../utils/db/dict';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const typeId = Number(params.typeId);
    const dictType = DICT_TYPE_DB.find((d) => d.id === typeId);

    if (!dictType) {
      return bizError(404, '字典类型不存在');
    }

    return success(dictType.items, '获取字典项列表成功');
  },
  method: 'GET',
  path: '/system/dict/items/:typeId',
});
