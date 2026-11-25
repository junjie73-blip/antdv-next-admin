import type { DictItem } from '../../../utils/db/dict';

import { DICT_TYPE_DB, nextDictItemId } from '../../../utils/db/dict';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const typeId = Number(data.dictType);

    const dictType = DICT_TYPE_DB.find((d) => d.id === typeId);
    if (!dictType) {
      return bizError(400, '字典类型不存在');
    }

    const newItem: DictItem = {
      id: nextDictItemId(),
      dictType: typeId,
      dictLabel: String(data.dictLabel || ''),
      dictValue: String(data.dictValue || ''),
      cssClass: String(data.cssClass || ''),
      sort: Number(data.sort) || 0,
      status: (data.status as 0 | 1) ?? 1,
      remark: String(data.remark || ''),
    };

    dictType.items.push(newItem);

    return success(newItem, '新增字典项成功');
  },
  method: 'POST',
  path: '/system/dict/item',
});
