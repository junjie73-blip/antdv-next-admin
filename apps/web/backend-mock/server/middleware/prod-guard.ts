/**
 * 生产环境保护中间件：拦截 Mock 数据中心的运行时控制 / 重置类写接口。
 * 开发环境全部放行，逻辑见 utils/prod-guard.ts。
 */
// Nitro v3：显式导入，#imports 已移除
import { defineHandler } from 'nitro';
import {
  getMethod,
  getRequestURL,
  setResponseStatus,
} from 'nitro/h3';

import { guardProdOp } from '../utils/prod-guard';

export default defineHandler((event) => {
  const blocked = guardProdOp(getMethod(event), getRequestURL(event).pathname);
  if (blocked) {
    setResponseStatus(event, 403);
    return blocked;
  }
});
