import type { ConfigValue } from '../../../utils/db/monitor';

import { CONFIG_PANELS, CONFIG_VALUES } from '../../../utils/db/monitor';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 保存单个配置面板：只接受已声明字段，避免请求体把任意键写进配置表 */
export default defineMockRoute({
  handler({ data }) {
    const panelKey = String(data.panel ?? '');
    const panel = CONFIG_PANELS.find((item) => item.key === panelKey);
    if (!panel) return bizError(400, `未知的配置面板：${panelKey}`);

    const incoming = (data.values ?? {}) as Record<string, ConfigValue>;
    const allowed = new Set(panel.fields.map((field) => field.key));
    const next: Record<string, ConfigValue> = { ...CONFIG_VALUES[panelKey] };
    for (const [key, value] of Object.entries(incoming)) {
      if (allowed.has(key)) next[key] = value;
    }
    CONFIG_VALUES[panelKey] = next;
    return success({ panel: panelKey, values: next }, `${panel.title}已保存`);
  },
  method: 'PUT',
  path: '/system/config/save',
});
