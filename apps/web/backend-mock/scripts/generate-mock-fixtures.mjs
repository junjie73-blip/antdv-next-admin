/**
 * 浏览器内 mock 的 fixtures 生成器：把 mock 服务的响应快照直接生成进 web 子包。
 *
 * 一次命令完成：`pnpm mock:fixtures`。脚本自己用进程内 Nitro dev server 起 mock 服务，
 * 扫 `apps/web/backend-mock/server/api/**` 得到路由表，抓取每条 GET 的统一信封响应，写出
 * `apps/web/src/mock/fixtures.json` + `fixtures.ts` 包装。
 *
 * 产物是入库的生成物：web 构建只把它编进一个懒加载 chunk，不需要任何部署平台配置，
 * 也不需要 CI 上有 mock 服务在跑（Vercel / Netlify / 任意静态托管都一样）。
 * 只有需要刷新快照时才跑这条命令；`MOCK_SERVER=http://host:port` 可以改用外部已启动的服务。
 *
 * 账号表（`apps/web/backend-mock/server/utils/accounts.ts`）也是快照的一部分：浏览器内 mock
 * 没有服务端会话可问，「谁能登录、能看到哪些菜单」只能靠 `auth.accounts` 带进包里。
 *
 * 可重跑：对象键按字典序输出、快照时间取 `server/api` 的最新 mtime 而不是当前时刻、
 * 登录 token 归一化成固定串，所以产物里只会留下「接口数据的真实变化」。
 *
 * 快照写成 .json：JSON 产物天然在 lint 之外，业务数据里的长数字不会被要求加分隔符。
 */

import { readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOCK_ROOT = resolve(HERE, '..');
const WEB_ROOT = resolve(MOCK_ROOT, '..');
const MONOREPO_ROOT = resolve(WEB_ROOT, '../..');
const API_ROOT = join(MOCK_ROOT, 'server/api');
const MOCK_DIR = resolve(WEB_ROOT, 'src/mock');
const DATA_OUTPUT = join(MOCK_DIR, 'fixtures.json');
const MODULE_OUTPUT = join(MOCK_DIR, 'fixtures.ts');
/** 给了就用外部服务，否则本脚本自己起一个进程内 Nitro */
const EXTERNAL_SERVER = process.env.MOCK_SERVER ?? '';
/** Nitro 的 `server/api` 天然挂在 /api 下，抓取时补这段前缀 */
const API_PREFIX = '/api';
/** 菜单接口：路径写进 fixtures，覆盖层按它做「按账号裁剪」 */
const MENUS_PATH = '/menus';
/** 登录 token 归一化用的正则：时间戳每次不同，不归一就是一条无意义 diff */
const TOKEN_RE = /mock_token_[A-Za-z0-9]+_\d+/g;

/**
 * 账号表的唯一来源就是 mock 服务用的那一份（Node 22.18+/24 的原生类型擦除直接 import TS）。
 * 覆盖层要按账号决定「能不能登录、能看到哪些菜单」，再抄一份常量进生成器就等着漂移。
 */
async function loadAccounts() {
  try {
    const module = await import(
      new URL('../server/utils/accounts.ts', import.meta.url)
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
// 与统一分页契约 pageQuerySchema 的上限保持一致（pageSize <= 200）
const FULL_PAGE_SIZE = 200;
/** 参数段的取样值：mock 数据的 id 都从小值起步，取 1 基本都有货 */
const SAMPLE_PARAM = '1';

/**
 * 这些接口不进 fixtures：
 * - `/mock-center/**` 要的是实时行为（延迟、停用、生成），快照会把它钉死；
 * - 上传是 multipart / 二进制，浏览器内也复刻不了，由 `src/mock/dynamic.ts` 现造应答。
 */
const PASSTHROUGH_PREFIXES = ['/mock-center'];
const PASSTHROUGH_PATHS = new Set([
  '/upload',
  '/upload/:variant',
  '/system/file/upload',
]);

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

let serverUrl = EXTERNAL_SERVER.replace(/\/$/, '');

async function requestJson(path, { body, method = 'GET', query = {}, token } = {}) {
  const url = new URL(API_PREFIX + apiPath(path), serverUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
    method,
  });
  if (!response.ok)
    throw new Error(`${method} ${url} → HTTP ${response.status}`);
  return await response.json();
}

/**
 * 自起 Nitro：用和 `pnpm dev` 完全相同的 dev preset，快照因此与开发环境同源。
 * 返回关闭函数；走外部服务时返回空操作。
 */
async function startServer() {
  if (serverUrl) return async () => {};
  process.env.MOCK_ENV ??= 'development';
  process.env.MOCK_SQLITE_DRIVER ??= 'node';
  // 快照必须可复现：列表接口会触发超时审批等 Writable 副作用，若沿用磁盘库，
  // 下一次对账进程读到的是被上一次抓取改过的状态，同一个 GET 的字段就会漂移。
  process.env.MOCK_DB_FILE ??= ':memory:';
  const { build, createDevServer, createNitro, prepare } = await import('nitro/builder');
  const nitro = await createNitro({
    dev: true,
    rootDir: WEB_ROOT,
  });
  // Nitro v3：listen 只收一个 options 对象；url 监听 [::]，改成本机 IPv4 回环
  const listener = await createDevServer(nitro).listen({ port: 0 });
  await prepare(nitro);
  await build(nitro);
  serverUrl = `http://127.0.0.1:${new URL(listener.url).port}`;
  return async () => nitro.close();
}

/** listen() 返回时 dev handler 还没装载完，等登录接口真的能应答再抓 */
async function waitUntilReady() {
  let lastError = '';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const probe = await requestJson('/auth/login', {
        body: { password: 'admin123', username: 'admin' },
        method: 'POST',
      });
      if (probe?.code === 200) return;
      lastError = `code=${probe?.code}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`mock 服务未就绪：${lastError}`);
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

/** 列表接口在 data 里的数组与总数字段（本项目统一 `{ list, total }`，见 pagination.ts） */
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
  const closeServer = await startServer();
  try {
    await waitUntilReady();
    // 带超管 token 抓取：部分读接口按账号裁剪，不带凭证只能拿到默认账号视图
    const adminLogin = await requestJson('/auth/login', {
      body: { password: 'admin123', username: 'admin' },
      method: 'POST',
    });
    const token = adminLogin.data?.user?.token;

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
        // 写接口不抓响应：抓一次就真改掉数据（DELETE 尤其致命），
        // 应答由覆盖层按同一信封格式现造。
        routes.push(base);
        continue;
      }

      const response = await requestJson(route.path, {
        query: isList ? { pageNum: 1, page: 1, pageSize: FULL_PAGE_SIZE } : {},
        token,
      });
      if (!isEnvelope(response)) {
        console.warn(`跳过 ${route.method} ${route.path}：响应不是统一信封`);
        continue;
      }
      routes.push({
        ...base,
        ...listFieldsOf(response, isList),
        // 记录实际抓取路径（动态段代入的取样值），验证脚本按同一路径回放才不会
        // 因为两边各自猜 id 而比出 404 / 空数组这类假差异。
        samplePath: apiPath(route.path),
        response,
      });
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
      mockServer: EXTERNAL_SERVER || '进程内 Nitro dev server',
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
      `// 生成物，请勿手改 —— 数据在 \`./fixtures.json\`，由 \`pnpm mock:fixtures\` 产出。
// 重新生成：mock 接口有增删或响应结构变化时跑一次即可，脚本会自己起 Nitro，不需要先开服务。
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
  } finally {
    await closeServer();
  }
}

await main();
