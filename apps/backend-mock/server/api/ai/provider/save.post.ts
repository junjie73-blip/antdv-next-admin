import { saveProvider } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新建 / 编辑供应商。
 * key 字段只用于服务端脱敏：明文在 db 层立即被 maskApiKey 转成末 4 位掩码，
 * 落库与回包里都只有 keyMasked / keyStatus。
 */
export default defineMockRoute({
  handler({ data }) {
    const result = saveProvider(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/ai/provider/save',
});
