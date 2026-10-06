import type { DictType } from '../../../utils/db/dict';

import { DICT_TYPE_DB, nextDictTypeId } from '../../../utils/db/dict';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const newDictType: DictType = {
      id: nextDictTypeId(),
      typeName: String(data.typeName || ''),
      typeCode: String(data.typeCode || ''),
      status: (data.status as 0 | 1) ?? 1,
      remark: String(data.remark || ''),
      items: [],
    };

    DICT_TYPE_DB.push(newDictType);

    return success(newDictType, '新增字典类型成功');
  },
  method: 'POST',
  path: '/system/dict',
});
