/**
 * OpenAPI 3.1 规范端点：GET /openapi
 *
 * 规格由 scripts/generate-openapi.mjs 从路由文件 + 契约层生成，
 * 生成物是可直接 import 的 TS 常量，不依赖运行时读磁盘，构建产物可独立部署。
 * 放在 server/routes（而非 server/api）下：不进入 mock 清单、不进入前端快照。
 */

import { defineHandler } from 'nitro';

import { OPENAPI_SPEC } from '../utils/openapi-spec';

export default defineHandler(() => OPENAPI_SPEC);
