#!/usr/bin/env node
/**
 * 开发环境 Nitro 与生产包内 fixtures 的一致性验证。
 *
 * 生产包不再依赖任何部署平台配置：`/api/*` 由 web 子包里的 `src/mock/fixtures.json`
 * 在 fetch 出口应答。所以这里逐条对比「开发态真实 Nitro 响应」与「随包构建进去的快照」：
 * HTTP 状态、业务码、提示文案与响应结构有任何漂移都会让命令退出 1。
 *
 * 写接口用 `{}` 探测，业务码 400/404（参数校验、目标不存在）属于预期反馈；
 * 快照里写接口没有 response（抓一次就真改数据），只校验路由是否登记。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOCK_ROOT = resolve(HERE, '..');
const WEB_ROOT = resolve(MOCK_ROOT, '..');
const MONOREPO_ROOT = resolve(WEB_ROOT, '../..');
const API_DIR = join(MOCK_ROOT, 'server/api');
const FIXTURES = join(WEB_ROOT, 'src/mock/fixtures.json');

const ROUTE_RE = /\.(get|post|put|delete|patch)\.ts$/;
/** Nitro 的 server/api 天然挂在 /api 下 */
const API_PREFIX = '/api';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
/** 与生成器一致的透传名单：这些接口不进快照，由 dynamic.ts 现造或走真实网络 */
const PASSTHROUGH = (path) =>
  path.includes('mock-center') || path.startsWith('/upload') ||
  path.startsWith('/system/file/upload');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) walk(target, out);
    else out.push(target);
  }
  return out;
}

/** 文件约定路由 → { method, key }，key 用 :x 占位动态段，便于两边逐条对账 */
function collectRoutes() {
  return walk(API_DIR)
    .filter((file) => ROUTE_RE.test(file))
    .map((file) => {
      const method = ROUTE_RE.exec(file)[1].toUpperCase();
      const raw = relative(API_DIR, file)
        .replaceAll('\\', '/')
        .replace(ROUTE_RE, '')
        .replace(/\/index$/, '');
      return {
        file: relative(API_DIR, file).replaceAll('\\', '/'),
        key: `/${raw.replaceAll(/\[[^\]]+\]/g, ':x')}`,
        method,
      };
    })
    .sort((a, b) => `${a.method} ${a.key}`.localeCompare(`${b.method} ${b.key}`));
}

/** 只比结构，不比会随写入变化的数据值；code / message 单独精确比较 */
function shape(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return { array: true, item: value.length ? shape(value[0]) : 'empty' };
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape(value[key])]),
    );
  }
  return typeof value;
}

function parseResult(status, text) {
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    return { status, failure: `非 JSON 响应：${text.slice(0, 120)}` };
  }
  if (!payload || typeof payload.code !== 'number') {
    return { status, failure: `响应缺少 code 信封：${text.slice(0, 120)}` };
  }
  if (status < 200 || status >= 300) {
    return { status, failure: `HTTP ${status}` };
  }
  return {
    status,
    code: payload.code,
    message: payload.message,
    shape: shape(payload),
    raw: payload,
  };
}

/** 动态段优先从上一条 list 接口取真实 ID，取不到才回落数字 1 */
async function resolveIds(call, routes) {
  const cache = new Map();
  const prefixes = new Set();
  for (const route of routes) {
    const parts = route.key.split('/');
    for (let index = 0; index < parts.length; index++) {
      if (parts[index] === ':x') prefixes.add(parts.slice(0, index).join('/'));
    }
  }
  for (const prefix of prefixes) {
    for (const candidate of [`${prefix}/list`, prefix]) {
      const response = await call({
        method: 'GET',
        path: candidate,
        query: 'pageNum=1&pageSize=10',
      });
      if (response.failure || response.code !== 200) continue;
      const data = response.raw?.data;
      const items = data?.items ?? data?.list ?? (Array.isArray(data) ? data : []);
      const id = items?.[0]?.id ?? items?.[0]?._id;
      if (id !== undefined && id !== null) {
        cache.set(prefix, String(id));
        break;
      }
    }
  }
  return cache;
}

function buildRequest(route, ids, token) {
  const parts = route.key.split('/');
  const path = parts
    .map((part, index) => {
      if (part !== ':x') return part;
      return ids.get(parts.slice(0, index).join('/')) ?? '1';
    })
    .join('/');
  const query = route.method === 'GET' ? 'pageNum=1&pageSize=10' : '';
  let body = route.method === 'GET' ? undefined : {};
  if (route.key === '/auth/login') {
    body = { username: 'admin', password: 'admin123' };
  }
  if (route.key === '/mock-center/runtime') {
    body = { enabled: true, defaultDelay: 0, failRate: 0 };
  }
  return { method: route.method, path, query, body, token };
}

async function callDev(baseUrl, options) {
  const url = `${baseUrl}${API_PREFIX}${options.path}${options.query ? `?${options.query}` : ''}`;
  const headers = { ...JSON_HEADERS };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return parseResult(response.status, await response.text());
  } catch (error) {
    return { failure: `网络失败：${String(error)}` };
  }
}

async function login(call) {
  const response = await call({
    method: 'POST',
    path: '/auth/login',
    body: { username: 'admin', password: 'admin123' },
  });
  if (response.failure || response.code !== 200) {
    throw new Error(
      `登录失败：${response.failure ?? `${response.code} ${response.message}`}`,
    );
  }
  return response.raw.data.user.token;
}

async function collectDev(fixtureRoutes) {
  process.env.MOCK_ENV ??= 'development';
  process.env.MOCK_SQLITE_DRIVER ??= 'node';
  // 与 fixtures 生成器一致：每次对账都从全新内存库起步，避免上次抓取的写副作用
  // 让同一个 GET 在两次进程里返回不同字段（例如审批超时自动通过后的进度字段）。
  process.env.MOCK_DB_FILE ??= ':memory:';
  const { build, createDevServer, createNitro, prepare } = await import('nitro/builder');
  const nitro = await createNitro({
    dev: true,
    rootDir: WEB_ROOT,
  });
  // Nitro v3：listen 只收一个 options 对象，返回的 url 监听在 [::] 上，
  // 统一改成本机 IPv4 回环，避免不同平台对 :: 的解析差异。
  const listener = await createDevServer(nitro).listen({ port: 0 });
  await prepare(nitro);
  await build(nitro);
  const baseUrl = `http://127.0.0.1:${new URL(listener.url).port}`;
  try {
    const call = (options) => callDev(baseUrl, options);
    let token = '';
    let lastError = '';
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        token = await login(call);
        break;
      } catch (error) {
        lastError = String(error);
        await new Promise((done) => setTimeout(done, 250));
      }
    }
    if (!token) throw new Error(`Nitro dev server 未就绪：${lastError}`);

    const allRoutes = collectRoutes().filter(
      (route) => !PASSTHROUGH(route.key),
    );
    // 按快照记录的取样路径逐条回放 GET，和生成时用的是同一个 id / 分页参数；
    // 自己另猜 id 会拿到 404 或空数组，那是取样差异，不是快照失真。
    const results = [];
    for (const route of fixtureRoutes.filter((item) => item.method === 'GET')) {
      const request = {
        method: 'GET',
        path: route.samplePath ?? route.path,
        query: route.path.endsWith('/list')
          ? 'pageNum=1&page=1&pageSize=200'
          : '',
        token,
      };
      const { raw, ...record } = await call(request);
      results.push({
        key: `${route.method} ${route.path}`,
        routeKey: `${route.method} ${normalizeKey(route.path)}`,
        ...record,
      });
    }
    return {
      routeCount: allRoutes.length,
      writeCount: allRoutes.length - fixtureRoutes.length,
      registered: allRoutes.map((route) => `${route.method} ${route.key}`),
      routes: results,
    };
  } finally {
    await nitro.close();
  }
}

/** 任意 `:xxx` 参数段归一成 `:x`，让文件路由 `[id]` 与快照 `:id` 对得上 */
function normalizeKey(path) {
  return `/${path
    .split('/')
    .filter(Boolean)
    .map((part) => (part.startsWith(':') ? ':x' : part))
    .join('/')}`;
}

function collectFixtures() {
  const snapshot = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  const routes = snapshot.routes.map((route) => {
    const key = normalizeKey(route.path);
    const payload = route.response;
    return {
      key: `${route.method} ${key}`,
      method: route.method,
      path: route.path,
      samplePath: route.samplePath,
      status: payload ? 200 : undefined,
      code: payload?.code,
      message: payload?.message,
      shape: payload ? shape(payload) : undefined,
      hasSnapshot: Boolean(payload),
    };
  });
  return {
    routeCount: routes.length,
    routes,
    accountCount: snapshot.auth.accounts.length,
    generatedAt: snapshot.generatedAt,
  };
}

function compare(dev, fixture) {
  const problems = [];
  const byKey = new Map(fixture.routes.map((item) => [item.key, item]));
  let compared = 0;
  for (const key of dev.registered) {
    if (!byKey.has(key)) problems.push(`生产包缺少路由登记：${key}`);
  }

  for (const item of dev.routes) {
    const other = byKey.get(item.routeKey);
    if (!other) {
      problems.push(`生产包缺少路由：${item.key}`);
      continue;
    }
    if (item.failure) {
      problems.push(`开发态请求失败：${item.key} → ${item.failure}`);
      continue;
    }
    if (!other.hasSnapshot) {
      problems.push(`生产包缺少 GET 快照：${item.key}`);
      continue;
    }
    compared += 1;
    for (const field of ['status', 'code', 'message']) {
      if (item[field] !== other[field]) {
        problems.push(
          `${item.key} 的 ${field} 不一致：dev=${String(item[field])} / fixtures=${String(other[field])}`,
        );
      }
    }
    if (JSON.stringify(item.shape) !== JSON.stringify(other.shape)) {
      problems.push(
        `${item.key} 的数据结构不一致：dev=${JSON.stringify(item.shape)} / fixtures=${JSON.stringify(other.shape)}`,
      );
    }
  }

  return {
    problems,
    devRouteCount: dev.routeCount,
    fixtureRouteCount: fixture.routeCount,
    compared,
    writeCount: dev.writeCount,
    generatedAt: fixture.generatedAt,
    accountCount: fixture.accountCount,
  };
}

if (!existsSync(FIXTURES)) {
  console.error(`找不到生产包快照：${FIXTURES}`);
  console.error('请先执行 pnpm mock:fixtures。');
  process.exit(1);
}

const fixture = collectFixtures();
const report = compare(await collectDev(fixture.routes), fixture);
const reportPath = join(MONOREPO_ROOT, '.tmp/verify-environments-report.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log(
  `路由对比：开发态 ${report.devRouteCount} 条 / 生产包快照 ${report.fixtureRouteCount} 条；` +
    `逐条对比 ${report.compared} 条，写接口登记 ${report.writeCount} 条。`,
);
if (report.problems.length === 0) {
  console.log(
    '开发环境与生产包快照的状态、业务码、文案、数据结构完全一致。',
  );
} else {
  console.error(`发现 ${report.problems.length} 处问题：`);
  for (const problem of report.problems.slice(0, 40)) console.error(`  - ${problem}`);
  process.exit(1);
}
