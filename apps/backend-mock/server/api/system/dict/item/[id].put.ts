import { DICT_TYPE_DB } from '../../../../utils/db/dict';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);

    for (const dictType of DICT_TYPE_DB) {
      const itemIdx = dictType.items.findIndex((i) => i.id === id);
      if (itemIdx !== -1) {
        dictType.items[itemIdx] = {
          ...dictType.items[itemIdx]!,
          ...(data.dictLabel !== undefined && {
            dictLabel: String(data.dictLabel),
          }),
          ...(data.dictValue !== undefined && {
            dictValue: String(data.dictValue),
          }),
          ...(data.cssClass !== undefined && {
            cssClass: String(data.cssClass),
          }),
          ...(data.sort !== undefined && { sort: Number(data.sort) }),
          ...(data.status !== undefined && { status: data.status as 0 | 1 }),
          ...(data.remark !== undefined && { remark: String(data.remark) }),
        };

        return success(dictType.items[itemIdx], '更新字典项成功');
      }
    }

    return bizError(404, '字典项不存在');
  },
  method: 'PUT',
  path: '/system/dict/item/:id',
});
