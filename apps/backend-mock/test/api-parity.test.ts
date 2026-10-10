import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 前后端接口对账：`apps/web/src/api` 里声明的每一个请求，Nitro 侧都必须有对应 handler。
 *
 * 这条用例的存在理由就是巡检里抓到的一类缺陷：铃铛、通知管理「新增消息」、上传示例页的
 * 8 个 `action` 都是**前端写好了、后端不存在**。接口 404 时页面只弹一句"保存失败"，
 * 用户看到的是一个坏掉的按钮，而不是一条明确的服务端缺失 —— 单页测试也都照样绿，
 * 因为断言的是"点了有反应"，不是"反应是成功"。
 *
 * 所以这里做静态对账：把 `src/api/**` 里的调用抽出来，和 `server/api/**` 的文件约定路由
 * （含 `[id]` / `index` 这类动态段）逐一匹配，任何一边新增而另一边没跟上都会立刻变红。
 */

/** `test/` → `apps/backend-mock/` → `apps/` → 仓库根 */
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const WEB_API_DIR = path.join(REPO_ROOT, 'apps/web/src/api');
const MOCK_API_DIR = path.join(REPO_ROOT, 'apps/backend-mock/server/api');

/** 上传示例页直接写在模板里的 `action="/api/..."`，不走 `src/api`，单独收 */
const WEB_UPLOAD_PAGE = path.join(
  REPO_ROOT,
  'apps/web/src/views/components/upload/index.vue',
);

/** `src/api` 里的调用形态固定：`get<T>('/path'` / `put<T>(\`/path/${id}\`)` */
const API_CALL =
  /\b(get|post|put|del)(?:<[^>]*>)?\s*\(\s*(['`])([^'`\n]+)\2/g;

/** 文件约定路由的方法后缀与动态段：`[id].delete.ts` → `/:id` DELETE */
const ROUTE_SUFFIX = /\.(get|post|put|delete|patch)\.ts$/;

const ALIAS: Record<string, string> = { del: 'delete' };

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name), acc);
    else acc.push(path.join(dir, entry.name));
  }
  return acc;
}

/** `/system/user/${id}` → `/system/user/:x`，与 Nitro 的 `[id]` 同形后再按段比较 */
function normalizeCall(raw: string): string {
  return `/${raw
    .replace(/^\/+/, '')
    .replace(/\$\{[^}]*\}/g, ':x')
    .replace(/\/+$/, '')}`;
}

function collectCalls(): Array<{ method: string; path: string }> {
  const calls: Array<{ method: string; path: string }> = [];
  for (const file of walk(WEB_API_DIR).filter(
    (f) => f.endsWith('.ts') && !f.includes('__tests__'),
  )) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(API_CALL)) {
      calls.push({ method: ALIAS[match[1]!] ?? match[1]!, path: normalizeCall(match[3]!) });
    }
  }
  // 页面模板里的上传地址：`action="/api/upload/xxx"`，前缀 `/api` 由代理剥掉
  const markup = fs.readFileSync(WEB_UPLOAD_PAGE, 'utf8');
  for (const match of markup.matchAll(/action="\/api([^"]+)"/g)) {
    calls.push({ method: 'post', path: normalizeCall(match[1]!) });
  }
  return calls;
}

function collectRoutes(): Array<{ method: string; path: string }> {
  return walk(MOCK_API_DIR)
    .filter((file) => ROUTE_SUFFIX.test(path.basename(file)))
    .map((file) => {
      const method = ROUTE_SUFFIX.exec(path.basename(file))![1]!;
      const relative = path
        .relative(MOCK_API_DIR, file)
        .replaceAll('\\', '/')
        .replace(ROUTE_SUFFIX, '')
        .replace(/\/index$/, '');
      return {
        method,
        path: `/${relative.replaceAll(/\[[^\]]+\]/g, ':x')}`,
      };
    });
}

function matches(routes: Array<{ method: string; path: string }>, call: { method: string; path: string }) {
  const segments = call.path.split('/').filter(Boolean);
  return routes.some((route) => {
    if (route.method !== call.method) return false;
    const own = route.path.split('/').filter(Boolean);
    if (own.length !== segments.length) return false;
    // 两侧的动态段都归一成 `:x`：`:x` 命中任意一段
    return own.every((segment, index) => segment === ':x' || segment === segments[index]);
  });
}

describe('前端调用与 mock 路由对账', () => {
  const routes = collectRoutes();
  const calls = collectCalls();

  it('两侧都扫到了东西（否则这条对账等于没跑）', () => {
    expect(calls.length).toBeGreaterThan(50);
    expect(routes.length).toBeGreaterThan(50);
  });

  it('src/api 与上传页 action 里的每个接口，Nitro 都有对应 handler', () => {
    const missing = calls.filter((call) => !matches(routes, call));
    expect(
      missing.map((call) => `${call.method.toUpperCase()} ${call.path}`),
      '以下接口前端在调、mock 里没有实现（页面会静默失败）',
    ).toEqual([]);
  });

  /**
   * 反向也钉一下，但只钉"路径 + 方法"这个组合层面：
   * mock 里存在却没有前端调用的接口是允许的（面板演示、未来页面、legacy 兼容都算），
   * 真正会咬人的是写漏的那一半。
   */
  it('对账结果可复现：同一路径不同方法不会互相顶掉', () => {
    expect(matches(routes, { method: 'get', path: '/system/user/list' })).toBe(true);
    expect(matches(routes, { method: 'delete', path: '/system/user/1' })).toBe(true);
    expect(matches(routes, { method: 'get', path: '/system/user/1' })).toBe(true);
    // 方法拼错 / 路径不存在都要判负
    expect(matches(routes, { method: 'post', path: '/system/user/list' })).toBe(false);
    expect(matches(routes, { method: 'get', path: '/nope' })).toBe(false);
  });
});

/**
 * 分页参数命名对账。
 *
 * 巡检时抓到的真实缺陷：`BasicTable` 发的是 `pageNum`（与 `pageSize` 成对，
 * 来自 `DEFAULT_FETCH_SETTING.pageField`），而 mock 的列表 handler 是从 legacy 那套
 * `query.page` 抄过来的。两边都对，唯独对不上 —— 于是**每一张表的"下一页"都是第一页**，
 * 翻页控件能点、请求会发、状态码 200，界面上一行都不变。
 *
 * 这类"参数名对不上"的错，前端单测和后端单测各自都发现不了：
 * 前端只断言"我把 pageNum 发出去了"，后端只断言"给我 page 我能切片"。
 * 所以在这里做一次静态对账 —— 新增列表接口若还写 `query.page`，当场变红。
 */
describe('列表接口的分页参数与前端发的名字一致', () => {
  const listHandlers = walk(MOCK_API_DIR).filter((file) =>
    /[\\/]list\.get\.ts$/.test(file),
  );

  /** 只在"真的做了分页切片"的 handler 上要求 pageNum */
  const paginated = listHandlers.filter((file) =>
    /\.slice\(/.test(fs.readFileSync(file, 'utf8')),
  );

  it('扫到了足量的列表接口（否则这条对账等于没跑）', () => {
    expect(paginated.length).toBeGreaterThanOrEqual(8);
  });

  it('每个分页 handler 都认 pageNum', () => {
    const offenders = paginated
      .filter((file) => !/query\.pageNum/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(MOCK_API_DIR, file).replace(/\\/g, '/'));

    expect(
      offenders,
      `以下 mock 只读 query.page，前端发的是 pageNum，翻页会永远停在第一页：${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
