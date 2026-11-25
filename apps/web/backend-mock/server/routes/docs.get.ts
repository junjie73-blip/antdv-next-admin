/**
 * 交互式接口文档端点：GET /docs
 *
 * 使用 Scalar 渲染 /openapi 返回的 OpenAPI 3.1 规范。
 * 文档页面本身不参与 mock 运行时管道，纯静态 HTML。
 */

import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';

const HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Backend Mock API · OpenAPI 3.1</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
      #fallback { padding: 24px; color: #444; }
    </style>
  </head>
  <body>
    <div id="fallback">正在加载接口文档… 若长时间无响应，请直接访问 <a href="/openapi">/openapi</a> 查看规范原文。</div>
    <script id="api-reference" data-url="/openapi"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

export default defineHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
  return HTML;
});
