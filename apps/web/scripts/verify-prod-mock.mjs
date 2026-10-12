/**
 * 生产产物 + 浏览器内 Mock 的端到端核验。
 *
 *   node apps/web/scripts/verify-prod-mock.mjs              # 自带一个不带代理的静态服务器
 *   node apps/web/scripts/verify-prod-mock.mjs --base=http://127.0.0.1:9380
 *
 * 为什么不能只看"页面能打开"：产物里没有 Node mock，接口一律由包里的 fixtures 在 fetch 出口应答。
 * 一旦某条接口没被接住，它会退化成一次真实网络请求 —— 静态服务器上要么 404、要么被 SPA
 * 兜底伪装成 200 + index.html。所以这里把「逃逸到网络的非资源请求」当作硬失败来统计。
 *
 * 为什么不直接用 `vite preview`：`internal/vite-config` 没有 `preview` 段，而 Vite 的 preview server
 * 会继承 `server.proxy`，`/api` 又被 dev 的 Nitro 接住 —— 测出来的"生产能跑"是假阳性。
 * 这里自带的静态服务只服务 dist：没有代理，也**故意不做 SPA history 兜底**。
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

/**
 * 只服务 dist：路径命中文件就发，命不中一律 404。
 * 端口给 0 让系统挑，避免和上一次没退干净的实例抢。
 */
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
      // hash 路由下浏览器只请求 `/`。不要写 SPA history fallback —— 它会把没被 mock
      // 接住的接口请求喂成 200 + index.html，把"产物里缺接口"这件事伪装成成功。
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
      const { port } = server.address();
      done({
        close: () => new Promise((finish) => server.close(finish)),
        origin: `http://127.0.0.1:${port}`,
      });
    });
  });
}

const explicit = process.argv
  .find((a) => a.startsWith('--base='))
  ?.slice('--base='.length);
const staticServer = explicit ? null : await serveDist();
const BASE = (explicit ?? staticServer.origin).replace(/\/$/, '');
console.log(
  `核验对象：${BASE}${staticServer ? '（自带静态 dist，无代理）' : '（外部地址）'}`,
);

const results = [];
const consoleErrors = [];
const escaped = [];

function check(name, ok, detail = '') {
  results.push({ detail, name, ok });
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
  return ok;
}

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('request', (req) => {
  // 只统计 XHR/fetch：包内 mock 劫持的正是这一层，任何一条出现在网络上就是漏接
  const type = req.resourceType();
  if (type !== 'fetch' && type !== 'xmlhttprequest') return;
  const url = new URL(req.url());
  if (url.origin !== new URL(BASE).origin) return;
  // 图标集与静态资源本来就走 HTTP（离线化是把 @iconify 拉到本地 `/npm/`，不是拦成内存应答），
  // 混进来的话"逃逸统计"就永远红一片，看不出真正的漏接
  if (url.pathname.startsWith('/npm/')) return;
  if (
    /\.(?:js|mjs|css|json|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|webmanifest)$/.test(
      url.pathname,
    )
  )
    return;
  escaped.push(
    `${type.toUpperCase()} ${req.method()} ${url.pathname}${url.search}`,
  );
});

async function signIn(username, password) {
  // 换账号必须先把会话状态清干净：登录守卫会在已登录时把 /#/login 顶回首页
  await page.goto(`${BASE}/#/login`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = `${c.split('=')[0].trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });
  await page.goto(`${BASE}/#/login`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ant-app');
  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForSelector('.ant-menu > .ant-menu-submenu', {
    timeout: 20_000,
  });
}

try {
  // 1. 首屏：产物能在没有后端的情况下挂载
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.ant-app', { timeout: 20_000 });
  check('首屏挂载（无后端）', page.url().includes('/#/'), page.url());

  // 2. 登录：接口由包内 fixtures 应答
  await signIn('admin', 'admin123');
  const topMenus = await page.locator('.ant-menu > .ant-menu-submenu').count();
  check('admin 登录后侧栏渲染', topMenus >= 4, `一级菜单 ${topMenus} 个`);

  // 3. 写链路：useCRUD 新增 / 编辑 / 删除真的落到会话内存里
  await page.goto(`${BASE}/#/components/table/crud`);
  await page.waitForSelector('.ant-table-tbody .ant-table-row', {
    timeout: 20_000,
  });
  const stamp = Date.now().toString(36);
  const title = `PROD-${stamp}`;
  await page.getByRole('button', { exact: true, name: '新增任务' }).click();
  const modal = page.getByRole('dialog').last();
  await modal.getByPlaceholder('请输入任务标题').fill(title);
  await modal.getByPlaceholder('请输入负责人').fill('核验脚本');
  await modal
    .getByRole('button', { name: /保\s*存|确\s*定|确\s*认/ })
    .first()
    .click();
  await page
    .locator('.ant-message-success')
    .first()
    .waitFor({ timeout: 10_000 });
  // 成功提示比"弹窗关闭 + 表格重查"先到一步：不等弹窗关掉就点查询，
  // 这一次点击会被还没散的模态层吞掉，列表停在未筛选的第一页，新行（排在末尾）自然看不见
  await modal.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.getByPlaceholder('标题 / 负责人 / 备注').fill(title);
  await page.getByRole('button', { name: '查询' }).first().click();
  const row = page.locator('.ant-table-tbody .ant-table-row', {
    hasText: title,
  });
  await row.first().waitFor({ timeout: 10_000 });
  check('useCRUD 新增后可检索', true, title);

  await row.first().getByText('编辑').click();
  await modal.waitFor({ state: 'visible' });
  const edited = `${title}-E`;
  await modal.getByPlaceholder('请输入任务标题').fill(edited);
  await modal
    .getByRole('button', { name: /保\s*存|确\s*定|确\s*认/ })
    .first()
    .click();
  await modal.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.getByPlaceholder('标题 / 负责人 / 备注').fill(edited);
  await page.getByRole('button', { name: '查询' }).first().click();
  const editedRow = page.locator('.ant-table-tbody .ant-table-row', {
    hasText: edited,
  });
  check('useCRUD 编辑回填并保存', (await editedRow.count()) > 0, edited);

  await editedRow
    .first()
    .getByRole('button', { exact: true, name: '删除' })
    .click();
  await page
    .getByRole('button', { name: /确\s*定|OK|Yes/ })
    .last()
    .click();
  await page
    .locator('.ant-popover, .ant-modal-confirm')
    .last()
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('标题 / 负责人 / 备注').fill(edited);
  await page.getByRole('button', { name: '查询' }).first().click();
  await page.waitForTimeout(800);
  const stillThere = await page
    .locator('.ant-table-tbody .ant-table-row', { hasText: edited })
    .count();
  check('useCRUD 删除后检索为空', stillThere === 0, `命中 ${stillThere} 行`);

  // 4. 语言切换：壳层标题（含标签页）跟着切
  await page.locator('[data-testid="locale-switcher"]').first().click();
  await page.waitForTimeout(400);
  await page
    .getByRole('menuitem', { name: /English|英文/ })
    .or(page.getByText('English', { exact: true }))
    .first()
    .click();
  await page.waitForTimeout(1200);
  // 标签栏不是 antd 的 Tabs，稳定钩子是 `.tab-list`（e2e 用的是同一个）
  const tabTexts = await page.locator('.tab-list').allInnerTexts();
  const joined = tabTexts.join('|');
  check(
    '切英文后标签页标题转英文',
    /Analytics|Component|Form|Users/i.test(joined) &&
      !/分析面板|组件示例/.test(joined),
    joined.slice(0, 120),
  );

  // 5. 换 custom 账号：菜单裁剪 + 越界落 403
  await signIn('custom', 'custom123');
  const limitedMenus = await page
    .locator('.ant-menu > .ant-menu-submenu')
    .count();
  check(
    'custom 账号菜单被裁剪',
    limitedMenus > 0 && limitedMenus < topMenus,
    `custom ${limitedMenus} / admin ${topMenus}`,
  );
  // custom 的白名单里有 SystemUser，拿它当"越界"页面永远命不中 403；
  // 用它确实没有的 SystemMenu
  await page.goto(`${BASE}/#/system/menu`);
  await page.waitForTimeout(1500);
  check('custom 越界访问落 403', page.url().includes('/error/403'), page.url());

  // 6. 上传：示例页改走 `customRequest` → 应用的 http → 包内 mock（dynamic.ts 现造应答）。
  //    只断言"没有 /upload 逃逸到网络"会假绿 —— 一个文件都没传也是零逃逸。
  //    所以正面断言：文件项必须进到 done 态，那只有 onSuccess 收到信封才会发生。
  await signIn('admin', 'admin123');
  await page.goto(`${BASE}/#/components/upload`);
  await page.waitForTimeout(1200);
  const before = escaped.length;
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    mimeType: 'image/png',
    name: 'probe.png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  const done = page.locator(
    '.ant-upload-list-item:has-text("probe.png").ant-upload-list-item-done',
  );
  const landed = await done
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const uploadEscapes = escaped
    .slice(before)
    .filter((line) => line.split(' ')[2]?.startsWith('/upload'));
  check(
    '上传由包内 mock 接住（文件项落 done 态、无 /upload 逃逸）',
    landed && uploadEscapes.length === 0,
    landed
      ? uploadEscapes.length > 0
        ? uploadEscapes.join(', ').slice(0, 200)
        : 'done，零逃逸'
      : '文件项没进 done 态（应答没回来）',
  );
} catch (error) {
  check('脚本执行完成', false, String(error).slice(0, 300));
}

console.log('\n=== 逃逸到网络的接口请求（应全部由包内 mock 应答） ===');
console.log(escaped.length > 0 ? [...new Set(escaped)].join('\n') : '（无）');
console.log('\n=== console 错误 ===');
console.log(
  consoleErrors.length > 0 ? [...new Set(consoleErrors)].join('\n') : '（无）',
);
const failed = results.filter((r) => !r.ok);
console.log(
  `\n=== 结论：${results.length - failed.length}/${results.length} 通过 ===`,
);
await browser.close();
if (staticServer) await staticServer.close();
process.exit(failed.length > 0 ? 1 : 0);
