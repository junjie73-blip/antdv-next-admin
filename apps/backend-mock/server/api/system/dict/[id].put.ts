import { DICT_TYPE_DB } from '../../../utils/db/dict';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);
    const idx = DICT_TYPE_DB.findIndex((d) => d.id === id);

    if (idx === -1) {
      return bizError(404, '字典类型不存在');
    }

    DICT_TYPE_DB[idx] = {
      ...DICT_TYPE_DB[idx]!,
      ...(data.typeName !== undefined && { typeName: String(data.typeName) }),
      ...(data.typeCode !== undefined && { typeCode: String(data.typeCode) }),
      ...(data.status !== undefined && { status: data.status as 0 | 1 }),
      ...(data.remark !== undefined && { remark: String(data.remark) }),
    };

    return success(DICT_TYPE_DB[idx], '更新字典类型成功');
  },
  method: 'PUT',
  path: '/system/dict/:id',
});
