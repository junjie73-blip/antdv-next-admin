/**
 * OpenAPI 3.1 生成器
 *
 * 真值源有两处：server/api 的文件路由（路径 / 方法 / JSDoc）与 scripts/openapi-contracts.mjs
 * （schema / 示例 / 码表 / 权限码）。生成物：
 * - docs/openapi.json                      机器可读规范
 * - docs/API_CONTRACT.md                   人类可读接入文档
 * - server/routes/openapi-spec.generated.ts 运行时 /openapi 端点使用的常量
 *
 * 与 mock-center 的清单不同，这里覆盖 server/api 下的全部路由（含写接口），
 * 不依赖运行时是否访问过该接口。
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CODES,
  ENDPOINTS,
  INFO,
  PERMISSIONS,
  SCHEMAS,
  TAG_META,
} from './openapi-contracts.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(PACKAGE_ROOT, 'server/api');
const DOCS_DIR = join(PACKAGE_ROOT, 'docs');
const UTILS_DIR = join(PACKAGE_ROOT, 'server/utils');

function walk(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (entry.name.endsWith('.ts')) result.push(full);
  }
  return result.sort();
}

/** Nitro 文件约定 → OpenAPI 路径：index 段省略，[id] → {id} */
function routeOf(file) {
  const rel = relative(API_DIR, file).replaceAll(sep, '/');
  const match = /\.(get|post|put|delete|patch)\.ts$/.exec(rel);
  if (!match) return null;
  const method = match[1].toUpperCase();
  const withoutMethod = rel.slice(0, -match[0].length);
  const segments = withoutMethod
    .split('/')
    .filter((segment) => segment && segment !== 'index')
    .map((segment) =>
      segment.startsWith('[') && segment.endsWith(']')
        ? `{${segment.slice(1, -1)}}`
        : segment,
    );
  const routePath = `/${segments.join('/')}`;
  return { method, path: routePath === '/' ? '/' : routePath };
}

/** 只认标准权限码格式，过滤“无（公开接口）”这类说明性文字 */
function permissionOf(text) {
  const value = text?.trim();
  return value && /^(\*|[a-z]+(:[a-z0-9-]+)+)$/.test(value) ? value : undefined;
}

/** 取 export default 之前最后一段 JSDoc，避开文件头的实现说明 */
function docOf(source) {
  const head = source.slice(0, source.indexOf('export default'));
  const blocks = [...head.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  const block = blocks.at(-1);
  if (!block?.[1]) return {};
  const lines = block[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim());
  const tag = (name) => {
    const line = lines.find((item) => item.startsWith(`@${name} `));
    return line?.slice(name.length + 2).trim();
  };
  return {
    summary: lines.find((line) => line && !line.startsWith('@')),
    description: tag('description'),
    permission: permissionOf(tag('permission')),
    tag: tag('tag'),
  };
}

function envelopeSchema(dataSchema) {
  return {
    type: 'object',
    required: ['code', 'data', 'message'],
    properties: {
      code: { type: 'integer', example: 200, description: '业务码' },
      data: dataSchema ?? {},
      message: { type: 'string', example: 'ok' },
    },
  };
}

const codeMessage = (code) =>
  CODES.find((item) => item[0] === code)?.[1] ?? '请求失败';

function operationOf(route, source) {
  const key = `${route.method} ${route.path}`;
  const extra = ENDPOINTS[key] ?? {};
  const doc = docOf(source);
  const firstSegment = route.path.split('/').filter(Boolean)[0] ?? 'root';
  const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map(
    ([, name]) => ({
      in: 'path',
      name,
      required: true,
      schema: { type: 'string' },
      description: '路径参数',
    }),
  );

  if (Array.isArray(extra.query)) {
    for (const [name, type, description] of extra.query) {
      parameters.push({ in: 'query', name, schema: { type }, description });
    }
  } else if (route.method === 'GET' && route.path.endsWith('/list')) {
    parameters.push(
      { in: 'query', name: 'pageNum', schema: { type: 'integer', minimum: 1 }, description: '页码' },
      { in: 'query', name: 'pageSize', schema: { type: 'integer', minimum: 1, maximum: 200 }, description: '每页条数' },
    );
  }

  const responses = {
    200: {
      description: codeMessage(200),
      content: {
        'application/json': {
          schema: envelopeSchema(extra.response),
          ...(extra.responseExample
            ? { example: extra.responseExample }
            : {}),
        },
      },
    },
  };
  for (const code of [400, 401, 403, 404, 500]) {
    responses[code] = {
      description: codeMessage(code),
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    };
  }

  return {
    tags: [doc.tag ?? TAG_META[firstSegment] ?? firstSegment],
    summary: doc.summary?.replace(/（[^）]*）$/, '') ?? `${route.method} ${route.path}`,
    ...(doc.description ? { description: doc.description } : {}),
    operationId: `${route.method.toLowerCase()}_${route.path.replace(/[^A-Za-z0-9]+/g, '_')}`,
    ...(doc.permission ? { 'x-permission': doc.permission } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(extra.requestBody
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: extra.requestBody,
                ...(extra.requestExample ? { example: extra.requestExample } : {}),
              },
            },
          },
        }
      : {}),
    responses,
    security: route.path === '/auth/login' || route.path === '/auth/logout' ? [] : [{ bearerAuth: [] }],
  };
}

function buildSpec() {
  const paths = {};
  for (const file of walk(API_DIR)) {
    const route = routeOf(file);
    if (!route) continue;
    const operation = operationOf(route, readFileSync(file, 'utf8'));
    paths[route.path] ??= {};
    paths[route.path][route.method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.1.0',
    info: INFO,
    servers: [
      { url: 'http://localhost:6080', description: '本地开发（Nitro mock，与前端同端口）' },
      { url: 'https://your-backend.example', description: '真实后端：替换 baseURL 即可联调' },
    ],
    tags: Object.entries(TAG_META).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'mock_token_<username>_<timestamp>',
          description: 'mock 未带 token 时回落 admin；生产环境需验签',
        },
      },
      schemas: SCHEMAS,
    },
  };
}

function buildMarkdown(spec) {
  const routes = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.keys(methods).map((method) => `${method.toUpperCase()} /api${path}`),
  );
  const codeRows = CODES.map(
    ([code, message, group, success]) => `| ${code} | ${group} | ${success ? '是' : '否'} | ${message} |`,
  ).join('\n');
  const permissionRows = PERMISSIONS.map(
    ([code, description]) => `| \`${code}\` | ${description} |`,
  ).join('\n');
  const endpointRows = Object.values(spec.paths)
    .flatMap((methods) => Object.values(methods))
    .filter((operation) => operation['x-permission'])
    .map(
      (operation) =>
        `| ${operation.summary} | \`${operation['x-permission']}\` |`,
    )
    .join('\n');

  return `# Backend Mock API 接入规范

> 本文件由 \`pnpm openapi:generate\` 自动生成，规格原文见 [openapi.json](./openapi.json)。
> 服务运行时也可直接访问 \`GET /openapi\`（规范）与 \`GET /docs\`（交互式文档）。

## 1. 概览

- **Base URL**：开发 \`http://localhost:6080\`，官方 \`nitro/vite\` 插件与前端共用同一端口，\`/api\` 直连；切换真实后端时只替换 baseURL。
- **内容类型**：请求与响应均为 \`application/json; charset=utf-8\`。
- **接口数量**：${routes.length} 个（覆盖 \`server/api\` 下全部路由）。
- **认证**：请求头 \`Authorization: Bearer <token>\`；mock 未带 token 时回落 admin，
  便于联调；设置 \`MOCK_AUTH_ENFORCE=1\` 后未登录请求返回 code 401。

## 2. 统一响应格式

所有接口（含错误）响应体固定三个字段，与真实后端 \`R<T>\` 完全一致：

\`\`\`json
{ "code": 200, "data": { "...": "..." }, "message": "ok" }
\`\`\`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| \`code\` | integer | 业务码，200 表示成功；其余见下方码表 |
| \`data\` | any | 业务数据；失败时恒为 \`null\` |
| \`message\` | string | 可直接展示的描述；校验失败时会带出字段路径 |

可观测信息通过响应头下发，不进入业务信封：

| 响应头 | 说明 |
| --- | --- |
| \`x-request-id\` / \`x-trace-id\` | 链路号，与审计台账 \`traceId\` 对应 |
| \`x-response-time\` | 服务端耗时，如 \`12ms\` |
| \`cache-control: no-store\` | 禁止缓存（同一 URL 会因账号返回不同数据） |
| \`vary: Authorization\` | 代理必须按凭据区分缓存 |

## 3. 状态码体系

业务失败默认 **HTTP 仍为 200**，由前端按 \`code\` 判定；仅运行时拦截（全局停用 / 失败注入）
同步抬升 HTTP 状态。这样可以与真实后端的拦截器行为保持一致。

| code | 类别 | 成功 | 默认文案 |
| --- | --- | --- | --- |
${codeRows}

## 4. 标准错误结构

\`\`\`json
{
  "code": 400,
  "data": null,
  "message": "参数校验失败：query.pageNum 必须大于 0"
}
\`\`\`

字段级明细保存在服务端 \`ApiError.items\`（字段路径 / 描述 / 子码），写入审计日志供联调定位，
但不直接出现在响应体中 —— 避免把内部实现暴露给调用方。

## 5. 分页约定

- 入参：\`pageNum\`（从 1 开始，兼容别名 \`page\`）+ \`pageSize\`（1-200，缺省 10）。
- 出参：\`{ "list": [...], "total": number }\`，\`total\` 是筛选后总条数。
- 不传任何分页参数时兼容旧行为返回全量；一旦出现分页参数就按页切片。

## 6. 参数校验

统一使用 zod schema（代码侧见 \`server/contracts/models.ts\` 与 \`validation.ts\`）：
必填、长度、枚举、邮箱 / 手机号格式、日期格式、数值范围都有约束。
校验失败返回 code 400，\`message\` 形如 \`参数校验失败：body.password 密码不能为空\`。

## 7. 权限标识

权限码格式 \`模块:资源:动作\`，与菜单派生规则一致。前端用于控制按钮可见性，
服务端通过 \`requirePermission\` 做二次校验（未通过返回 code 403）。

| 权限码 | 含义 |
| --- | --- |
${permissionRows}

已落地服务端鉴权的接口：

| 接口 | 权限码 |
| --- | --- |
${endpointRows || '| （暂无） | - |'}

## 8. 操作日志与审计

每次请求由统一管道写入审计台账，字段与真实后端 \`tb_operation_log\` 对齐：
\`actor\`（操作人）、\`action\`（\`METHOD /path\`）、\`module\`、\`bizType\` / \`bizId\`、
\`method\`、\`path\`、\`ip\`（代理头优先）、\`detail\`（脱敏后的请求参数 + 标准操作日志字段）、
\`result\`（success / error / denied）、\`risk\`、\`traceId\`、\`startTime\` / \`endTime\`、\`durationMs\`。

请求体先经服务端脱敏策略处理，凭据、证件号等敏感字段不会落库。

## 9. 前端接入示例

\`\`\`ts
const res = await fetch('/api/system/user/list?pageNum=1&pageSize=10', {
  headers: { Authorization: \`Bearer \${token}\` },
});
const envelope = await res.json();
if (envelope.code !== 200) {
  console.error(envelope.message, 'traceId:', res.headers.get('x-request-id'));
  throw new Error(envelope.message);
}
const { list, total } = envelope.data;
\`\`\`

## 10. 迁移为真实后端

1. 保持路径、方法、信封、分页结构、权限码不变 —— 前端零改动。
2. 把 \`server/middleware/auth-context.ts\` 的账号解析替换为验签 / 会话查询。
3. 把 \`server/utils/db/*\` 的内存 / SQLite 集合换成真实 DAO；\`server/contracts/*\` 的 DTO 可继续复用。
4. \`defineMockRoute\` 的运行时管道（延迟 / 失败注入）仅用于联调，生产服务移除即可。
5. 审计落点从 \`recordAudit\` 换成写入 \`tb_operation_log\` 的持久化实现，字段无需调整。

## 11. 接口清单

${routes.map((item) => `- \`${item}\``).join('\n')}
`;
}

const spec = buildSpec();
mkdirSync(DOCS_DIR, { recursive: true });
mkdirSync(UTILS_DIR, { recursive: true });

writeFileSync(join(DOCS_DIR, 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
writeFileSync(join(DOCS_DIR, 'API_CONTRACT.md'), buildMarkdown(spec), 'utf8');
writeFileSync(
  join(UTILS_DIR, 'openapi-spec.ts'),
  `// 自动生成，勿手改。重新生成：pnpm openapi:generate\n// 来源：server/api 文件路由 + scripts/openapi-contracts.mjs\nexport const OPENAPI_SPEC = ${JSON.stringify(spec, null, 2)};\n`,
  'utf8',
);

console.log(
  `[openapi] 已生成 ${Object.keys(spec.paths).length} 个路径 / ${routesCount(spec)} 个操作 → docs/openapi.json、docs/API_CONTRACT.md、server/utils/openapi-spec.ts`,
);

function routesCount(document) {
  return Object.values(document.paths).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0,
  );
}
