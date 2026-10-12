/**
 * 浏览器内 mock 的 fixtures 生成器。
 *
 * 干的事：扫 `apps/backend-mock/server/api/**` 得到路由表，再对着**运行中**的 Nitro mock
 * 把每条 GET 的响应抓下来，写成 `apps/web/src/mock/fixtures.json` + 同名 `fixtures.ts` 包装。
 *
 * 用法（两步）：
 *   1. 起 mock：`pnpm --filter @antdv/backend-mock dev`，或起 web dev 让 vite 把它带起来；
 *   2. `pnpm mock:fixtures`（`MOCK_SERVER=http://host:port` 可指到别处）。
 *
 * 产物是**入库**的生成物：生产构建必须在没有 5320 服务的情况下也能产出（CI、离线都要能 build），
 * 所以快照不能留到构建期现抓。
 *
 * 账号表（`apps/backend-mock/server/utils/accounts.ts`）同样是快照的一部分：浏览器内 mock
 * 没有服务端会话可问，「谁能登录、登录后能看到哪些菜单」只能靠 `auth.accounts` 带进包里。
 *
 * 可重跑：对象键按字典序输出、快照时间取 `server/api` 的最新 mtime 而不是当前时刻、
 * 登录 token 归一化成固定串，所以产物里只会留下「接口数据的真实变化」。
 * 注意 dashboard/stats、screen/monitor 这类接口用的是没播种的 faker，本来就每次不同，
 * 重跑出现在 diff 里是正常的。
 *
 * 快照写成 .json：JSON 产物天然在 lint 之外，业务数据里的长数字不会被要求加分隔符。
 */

import { readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(HERE, '../apps/backend-mock/server/api');
const MOCK_DIR = resolve(HERE, '../apps/web/src/mock');
const DATA_OUTPUT = join(MOCK_DIR, 'fixtures.json');
const MODULE_OUTPUT = join(MOCK_DIR, 'fixtures.ts');
const SERVER = process.env.MOCK_SERVER ?? 'http://localhost:5320';
/** Nitro 的 `server/api` 天然挂在 /api 下，抓取时补这段前缀 */
const API_PREFIX = '/api';
/** 菜单接口：路径写进 fixtures，覆盖层按它做「按账号裁剪」 */
const MENUS_PATH = '/menus';
/** 登录 token 归一化用的正则：时间戳每次不同，不归一就是一条无意义 diff */
const TOKEN_RE = /mock_token_[A-Za-z0-9]+_\d+/g;

/**
 * 账号表的唯一来源就是 mock 服务用的那一份（Node 22.18+/23+ 的原生类型擦除直接 import TS）。
 * 覆盖层要按账号决定"能不能登录、能看到哪些菜单"，再抄一份常量进生成器就等着漂移。
 */
async function loadAccounts() {
  try {
    const module = await import(
      new URL('../apps/backend-mock/server/utils/accounts.ts', import.meta.url)
    );
    return module.accounts;
  } catch (error) {
    throw new Error(
      `读取 mock 账号表失败（需要 Node >= 22.18 的原生 TS 擦除）：${error.message}`,
      { cause: error },
    );
  }
}

/** 列表接口按大 pageSize 抓全集：覆盖层要靠这份全集做分页与增删改 */
const FULL_PAGE_SIZE = 500;
/** 参数段的取样值：mock 数据的 id 都从小值起步，取 1 基本都有货 */
const SAMPLE_PARAM = '1';

/**
 * `/mock-center/**` 不进 fixtures：面板调的延迟、停用、生成接口要的是实时行为，
 * 浏览器内快照会把它钉死。上传接口是 multipart / 二进制，浏览器内也复刻不了。
 */
const PASSTHROUGH_PREFIXES = ['/mock-center'];
const PASSTHROUGH_PATHS = new Set(['/upload', '/upload/:variant']);

const METHOD_RE = /\.(delete|get|patch|post|put)\.ts$/;

function isSkipped(path) {
  return (
    PASSTHROUGH_PATHS.has(path) ||
    PASSTHROUGH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  );
}

/** `system/user/[id].get.ts` → `{ method: 'GET', path: '/system/user/:id' }` */
function routeOf(filePath) {
  const matched = METHOD_RE.exec(filePath);
  if (!matched) return null;
  const withoutMethod = filePath.slice(0, matched.index);
  const trimmed = withoutMethod.endsWith('/index')
    ? withoutMethod.slice(0, -'/index'.length)
    : withoutMethod;
  const path = `/${trimmed}`.replaceAll('[', ':').replaceAll(']', '');
  return { method: matched[1].toUpperCase(), path };
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function apiPath(path) {
  return path
    .split('/')
    .map((segment) => (segment.startsWith(':') ? SAMPLE_PARAM : segment))
    .join('/');
}

async function requestJson(path, { body, method = 'GET', query = {} } = {}) {
  const url = new URL(API_PREFIX + apiPath(path), SERVER);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
          method,
        }),
  });
  if (!response.ok)
    throw new Error(`${method} ${url} → HTTP ${response.status}`);
  return await response.json();
}

function isEnvelope(value) {
  return (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    'data' in value &&
    'message' in value
  );
}

/**
 * 集合根，读写字典里同一个键才能对上：
 * - 列表接口 `/system/user/list` → `/system/user`；
 * - 详情与改删接口末段是参数段（`/system/user/:id`）→ 往上走一层；
 * - 其余就是路径本身 —— 集合根上的 POST（`/system/user`）正好命中列表登记的那份副本，
 *   而带动词后缀的写接口（`/system/notice/save`）命不中任何副本，走通用应答。
 */
function collectionOf({ isList, path }) {
  const segments = path.split('/').filter(Boolean);
  const last = segments.at(-1) ?? '';
  if (isList || last.startsWith(':')) {
    if (segments.length < 2) return undefined;
    return `/${segments.slice(0, -1).join('/')}`;
  }
  return `/${segments.join('/')}`;
}

/** 列表接口在 data 里的数组与总数字段（本项目一律 `{ list, total }`，见 api/request.ts 的 RL） */
function listFieldsOf(envelope, isList) {
  if (!isList || !Array.isArray(envelope.data?.list)) return {};
  return { listField: 'list', totalField: 'total' };
}

/** 对象键按字典序重排，数组顺序保持原样 —— 重跑不产生无意义 diff */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

async function newestMtime(files) {
  let newest = 0;
  for (const file of files) {
    const info = await stat(file);
    newest = Math.max(newest, info.mtimeMs);
  }
  return new Date(newest).toISOString();
}

async function main() {
  const scanned = await walk(API_ROOT);
  const files = scanned.toSorted();
  const routes = [];

  for (const file of files) {
    const route = routeOf(relative(API_ROOT, file).replaceAll('\\', '/'));
    if (!route || isSkipped(route.path)) continue;

    const isList = route.path.endsWith('/list');
    const base = {
      collection: collectionOf({ isList, path: route.path }),
      method: route.method,
      path: route.path,
    };

    if (route.method !== 'GET') {
      // 写接口不抓响应：抓一次就真改掉开发中 mock 服务的数据（DELETE 尤其致命），
      // 应答由覆盖层按同一信封格式现造。
      routes.push(base);
      continue;
    }

    const response = await requestJson(route.path, {
      query: isList ? { pageNum: 1, page: 1, pageSize: FULL_PAGE_SIZE } : {},
    });
    if (!isEnvelope(response)) {
      console.warn(`跳过 ${route.method} ${route.path}：响应不是统一信封`);
      continue;
    }
    routes.push({ ...base, ...listFieldsOf(response, isList), response });
  }

  const accounts = await loadAccounts();
  const captured = [];
  for (const account of accounts) {
    const login = await requestJson('/auth/login', {
      body: { password: account.password, username: account.profile.username },
      method: 'POST',
    });
    if (!isEnvelope(login) || login.code !== 200)
      throw new Error(
        `账号 ${account.profile.username} 登录失败：检查 mock 服务与账号表是否一致`,
      );
    const {
      permissions: _p,
      roles: _r,
      token: _t,
      ...profile
    } = login.data?.user ?? {};
    captured.push({
      password: account.password,
      permissions: account.permissions,
      profile,
      roles: account.roles,
      username: account.profile.username,
      visibleMenus: account.visibleMenus,
    });
  }

  const [primary] = captured;
  const login = await requestJson('/auth/login', {
    body: { password: primary.password, username: primary.username },
    method: 'POST',
  });
  const rejected = await requestJson('/auth/login', {
    body: { password: 'wrong-on-purpose', username: primary.username },
    method: 'POST',
  });
  if (!isEnvelope(login) || !isEnvelope(rejected)) {
    throw new Error('登录接口响应不是统一信封，检查 mock 服务是否正常');
  }
  // token 里嵌着抓取那一刻的时间戳，不归一的话每次重跑都是一条无意义 diff
  const success = JSON.parse(
    JSON.stringify(login).replaceAll(TOKEN_RE, 'mock_token_0'),
  );

  const snapshot = {
    auth: {
      accounts: captured,
      failure: rejected,
      loginPath: '/auth/login',
      logoutPath: '/auth/logout',
      success,
      userPath: '/auth/user-info',
    },
    generatedAt: await newestMtime(files),
    menusPath: MENUS_PATH,
    mockServer: SERVER,
    routes: routes.toSorted((a, b) =>
      `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`),
    ),
  };

  await writeFile(
    DATA_OUTPUT,
    `${JSON.stringify(canonicalize(snapshot), null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    MODULE_OUTPUT,
    `// 生成物，请勿手改 —— 数据在 \`./fixtures.json\`，由 \`scripts/generate-mock-fixtures.mjs\` 产出。
// 重新生成：mock 接口有增删或响应结构变化时，先起 Nitro mock（\`pnpm --filter @antdv/backend-mock dev\`），
// 再跑 \`pnpm mock:fixtures\`。
import type { FixtureSet } from './types';

import snapshot from './fixtures.json';

// JSON 里推不出 \`method\` 的字面量联合，也没法表达 \`response: unknown\`，整体断言一次
export const fixtures = snapshot as unknown as FixtureSet;
`,
    'utf8',
  );
  console.log(
    `已生成 ${relative(process.cwd(), DATA_OUTPUT)}：${snapshot.routes.length} 条接口（快照 ${snapshot.generatedAt}）`,
  );
}

await main();
