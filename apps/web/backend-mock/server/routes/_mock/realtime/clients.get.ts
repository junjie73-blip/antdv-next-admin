/**
 * GET /_mock/realtime/clients — 查询当前 WebSocket 连接
 *
 * 该端点位于 server/routes 而非 server/api，不进入 mock 清单与快照（127 条基线不受影响）。
 */
import { defineHandler } from 'nitro';

import { success } from '../../../utils/response';
import { getMockWsHub } from '../../../utils/realtime/hub';

export default defineHandler(() => {
  const hub = getMockWsHub();
  return success({ list: hub.list(), total: hub.size });
});
