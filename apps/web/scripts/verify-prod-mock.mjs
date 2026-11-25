/**
 * 生产静态产物 + 浏览器内 mock 的端到端核验。
 *
 *   node apps/web/scripts/verify-prod-mock.mjs              # 自带一个不带代理的静态服务器
 *   node apps/web/scripts/verify-prod-mock.mjs --base=http://127.0.0.1:9380
 *
 * 为什么不能只看「页面能打开」：产物里没有 Node mock，`/api/**` 一律由包内 fixtures 在
 * fetch 出口应答。某条接口没被接住就会退化成真实网络请求 —— 静态服务器上要么 404、
 * 要么被 SPA 兜底伪装成 200 + index.html。这里把「逃逸到网络的 /api 请求」当硬失败。
 *
 * 为什么不用 `vite preview`：它会继承 dev proxy，`/api` 又被 Nitro 接住，测出来的
 * 「生产能跑」是假阳性。这里自带的静态服务只服务 dist，不做任何 history 兜底。
 *
 * 验证不依赖具体 UI 选择器（UI 已从 antd 换成 shadcn）：直接在页面上下文里调用
 * `globalThis.fetch`，检查 mock 信封、透传隔离、写操作覆盖层与运行时开关。
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const DIST = resolve(fileURLToPath(import.meta.url), '../../dist');

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

/** 只服务 dist：命中文件就发，命不中一律 404（故意不做 SPA history 兜底） */
function serveDist() {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(
        new URL(req.url ?? '/', 'http://127.0.0.1').pathname,
      );
      res.setHeader('cache-control', 'no-store');
      let file = resolve(DIST, `.${path}`.replaceAll('/', sep));
      if (!file.startsWith(DIST + sep) && file !== DIST) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (path === '/') file = join(DIST, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      done({
        close: () => new Promise((finish) => server.close(finish)),
        origin: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`找不到静态产物：${DIST}`);
  console.error('请先执行 pnpm build:web。');
  process.exit(1);
}

const explicit = process.argv
  .find((a) => a.startsWith('--base='))
  ?.slice('--base='.length);
const staticServer = explicit ? null : await serveDist();
const BASE = (explicit ?? staticServer.origin).replace(/\/$/, '');
console.log(`核验对象：${BASE}${staticServer ? '（自带静态 dist，无代理）' : '（外部地址）'}`);

const results = [];
const escaped = [];

function check(name, ok, detail = '') {
  results.push({ detail, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

/** 统计真正发到网络上的 fetch（mock 接住的请求不会进这里） */
page.on('request', (req) => {
  const type = req.resourceType();
  if (type !== 'fetch' && type !== 'xmlhttprequest') return;
  const url = new URL(req.url());
  if (url.origin !== new URL(BASE).origin) return;
  if (url.pathname.startsWith('/npm/')) return;
  if (
    /\.(?:js|mjs|css|json|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|webmanifest)$/.test(
      url.pathname,
    )
  )
    return;
  escaped.push(`${req.method()} ${url.pathname}${url.search}`);
});

/** 在页面上下文里调用 fetch，返回 { status, body } */
async function call(path, init) {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await globalThis.fetch(path, init);
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 120);
      }
      return { body, status: response.status };
    },
    { path, init },
  );
}

try {
  // 1. 首屏能在没有后端的情况下挂载
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app > *', { timeout: 20_000 });
  check('首屏挂载（无后端）', true);

  // 2. 等 mock 拦截器装上：/api/auth/login 必须拿到 mock 信封（静态服务器对 /api 一律 404）
  let login = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await call('/api/auth/login', {
        body: JSON.stringify({ password: 'admin123', username: 'admin' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.body?.code === 200) {
        login = response;
        break;
      }
    } catch {
      // chunk 还没加载完
    }
    await page.waitForTimeout(250);
  }
  const token = login?.body?.data?.user?.token;
  check(
    '登录由包内 mock 应答（HTTP 200 + code 200 + token）',
    login?.status === 200 && Boolean(token),
    login ? `status=${login.status} code=${login.body.code}` : '未拿到 mock 信封',
  );

  // 3. 菜单接口由快照应答
  const menus = await call('/api/menus', {
    headers: { authorization: `Bearer ${token ?? ''}` },
  });
  check(
    '菜单接口由快照应答',
    menus.body?.code === 200 && Array.isArray(menus.body?.data?.list),
    `code=${menus.body?.code}`,
  );

  // 4. 同源但不在 /api 下的路径必须透传（静态服务器上 404，不能被 mock 吞掉或误接）
  const escapedBefore = escaped.length;
  const passthrough = await call('/real-business/orders');
  check(
    '非 /api 路径原样透传（静态服务器 404）',
    passthrough.status === 404,
    `status=${passthrough.status}`,
  );
  check(
    '透传请求真的发到了网络',
    escaped.slice(escapedBefore).some((line) => line.includes('/real-business/orders')),
  );

  // 5. 写操作覆盖层：新增任务后列表能查到
  const created = await call('/api/demo/task', {
    body: JSON.stringify({ owner: '核验脚本', title: `PROD-${Date.now().toString(36)}` }),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token ?? ''}` },
    method: 'POST',
  });
  check('写接口由覆盖层应答', created.body?.code === 200, `code=${created.body?.code}`);

  // 6. 运行时开关：?mock=0 时不再拦截，/api 请求逃逸到网络（静态服务器 404）
  const offPage = await browser.newPage();
  await offPage.goto(`${BASE}/?mock=0`, { waitUntil: 'domcontentloaded' });
  await offPage.waitForSelector('#app > *', { timeout: 20_000 });
  const disabled = await offPage.evaluate(async () => {
    const response = await globalThis.fetch('/api/auth/login', {
      body: JSON.stringify({ password: 'admin123', username: 'admin' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return { status: response.status, text: (await response.text()).slice(0, 60) };
  });
  await offPage.close();
  check(
    '运行时 ?mock=0 关闭 mock（/api 逃逸到网络 → 404）',
    disabled.status === 404,
    `status=${disabled.status}`,
  );

  // 7. 命中 mock 的 /api 请求一个都不该出现在网络上
  const apiEscapes = escaped.filter((line) => line.includes('/api/'));
  check(
    '无 /api 请求逃逸到网络',
    apiEscapes.length === 0,
    apiEscapes.length ? apiEscapes.slice(0, 5).join(', ') : '零逃逸',
  );
} catch (error) {
  check('脚本执行完成', false, String(error).slice(0, 300));
}

console.log('\n=== 逃逸到网络的请求 ===');
console.log(escaped.length > 0 ? [...new Set(escaped)].join('\n') : '（无）');
const failed = results.filter((r) => !r.ok);
console.log(`\n=== 结论：${results.length - failed.length}/${results.length} 通过 ===`);
await browser.close();
if (staticServer) await staticServer.close();
process.exit(failed.length > 0 ? 1 : 0);
