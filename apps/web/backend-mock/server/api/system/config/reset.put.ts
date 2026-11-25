import {
  CONFIG_DEFAULTS,
  CONFIG_PANELS,
  CONFIG_VALUES,
} from '../../../utils/db/monitor';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 恢复单个配置面板的默认值 */
export default defineMockRoute({
  handler({ data }) {
    const panelKey = String(data.panel ?? '');
    const panel = CONFIG_PANELS.find((item) => item.key === panelKey);
    if (!panel) return bizError(400, `未知的配置面板：${panelKey}`);

    CONFIG_VALUES[panelKey] = structuredClone(CONFIG_DEFAULTS[panelKey] ?? {});
    return success(
      { panel: panelKey, values: CONFIG_VALUES[panelKey] },
      `${panel.title}已恢复默认`,
    );
  },
  method: 'PUT',
  path: '/system/config/reset',
});
